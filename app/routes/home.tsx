import { useState, useEffect, useRef } from "react";

export default function Index() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: string; content: string; isStreaming?: boolean }[]
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Add a streaming assistant message placeholder
    const streamingMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages([...newMessages, streamingMessage]);

    const currentInput = input;
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          context: newMessages.map((m) => `${m.role}: ${m.content}`).join("\n"),
        }),
      });

      // Handle stream - update the last message in real-time
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Update the streaming message in place
        setMessages((prev) => [
          ...prev.slice(0, -1), // All messages except the last
          { role: "assistant", content: fullText, isStreaming: true },
        ]);
      }

      // Mark streaming as complete
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: fullText, isStreaming: false },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      // Replace streaming message with error
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "Sorry, there was an error processing your message.",
          isStreaming: false,
        },
      ]);
    }
  }

  return (
    <main className="flex flex-col h-screen max-w-4xl mx-auto bg-gray-900">
      <header className="p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white">🧠 Ollama Chat</h1>
      </header>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-3xl px-4 py-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-100"
              }`}
            >
              <div className="text-sm font-medium mb-1 opacity-70">
                {msg.role === "user" ? "You" : "Assistant"}
                {msg.isStreaming && (
                  <span className="ml-2 animate-pulse">●</span>
                )}
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {/* Invisible div to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border border-gray-600 p-3 rounded-lg text-white bg-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500"
            disabled={messages.some((m) => m.isStreaming)}
          />
          <button
            type="submit"
            disabled={!input.trim() || messages.some((m) => m.isStreaming)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
