export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { message, context } = await request.json();

    // Make request to Ollama
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2", // You can change this to your preferred model
        prompt: context ? `${context}\nuser: ${message}` : message,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    // Create a readable stream to forward the Ollama response
    const readable = new ReadableStream({
      start(controller) {
        const reader = response.body!.getReader();

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }

            // Parse the streaming JSON responses from Ollama
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  // Forward only the text content
                  controller.enqueue(new TextEncoder().encode(data.response));
                }
              } catch (e) {
                // Skip malformed JSON lines
              }
            }

            return pump();
          });
        }

        return pump();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
