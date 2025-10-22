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
    <main className="chat-container">
      <header className="chat-header">
        <h1 className="chat-title">🧠 Ollama Chat</h1>
      </header>

      {/* Chat messages area */}
      <div className="messages-container">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message-wrapper ${msg.role}`}
          >
            <div className={`message-bubble ${msg.role}`}>
              <div className="message-header">
                {msg.role === "user" ? "You" : "Assistant"}
                {msg.isStreaming && (
                  <span className="streaming-indicator">●</span>
                )}
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          </div>
        ))}
        {/* Invisible div to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="input-container">
        <form onSubmit={sendMessage} className="input-form">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="message-input"
            disabled={messages.some((m) => m.isStreaming)}
          />
          <button
            type="submit"
            disabled={!input.trim() || messages.some((m) => m.isStreaming)}
            className="send-button"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
