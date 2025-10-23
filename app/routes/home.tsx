import { useState, useEffect, useRef } from "react";

interface Message {
  role: string;
  content: string;
  isStreaming?: boolean;
}

// Conversation states for storytelling flow
type ConversationState =
  | "waiting_for_items"
  | "waiting_for_action"
  | "waiting_for_location"
  | "telling_story"
  | "story_complete";

export default function Index() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationState, setConversationState] =
    useState<ConversationState>("waiting_for_items");
  const [storyElements, setStoryElements] = useState({
    items: [] as string[],
    action: "",
    location: "",
  });
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize conversation with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      role: "assistant",
      content:
        "Hello! I'm your storytelling assistant. Let's create an amazing story together!\n\nTo get started, please give me 3 random items (they can be anything - objects, animals, concepts, etc.). Just list them separated by commas.",
      isStreaming: false,
    };
    setMessages([welcomeMessage]);
  }, []);

  // Process user input based on conversation state
  const processUserInput = (userInput: string): string => {
    switch (conversationState) {
      case "waiting_for_items":
        // Parse items from user input
        const items = userInput
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        if (items.length >= 3) {
          setStoryElements((prev) => ({ ...prev, items: items.slice(0, 3) }));
          setConversationState("waiting_for_action");
          return `Great! I have your three items: ${items.slice(0, 3).join(", ")}.\n\nNow, please tell me what specific action should happen in our story. For example: "escaping from danger", "solving a mystery", "going on an adventure", "having a celebration", etc.`;
        } else {
          return `I need exactly 3 items to create our story. You gave me ${items.length} item(s). Please try again with 3 random items separated by commas.`;
        }

      case "waiting_for_action":
        setStoryElements((prev) => ({ ...prev, action: userInput.trim() }));
        setConversationState("waiting_for_location");
        return `Perfect! Our story will involve "${userInput.trim()}".\n\nNow, where should this story take place? Please give me a specific location (like "an abandoned castle", "a bustling marketplace", "a mysterious forest", "a space station", etc.).`;

      case "waiting_for_location":
        setStoryElements((prev) => ({ ...prev, location: userInput.trim() }));
        setConversationState("telling_story");
        return `Excellent! Now I have everything I need:\n• Items: ${storyElements.items.join(", ")}\n• Action: ${storyElements.action}\n• Location: ${userInput.trim()}\n\nLet me craft an exciting story for you...`;

      case "telling_story":
        // Prevent input during story generation
        return "Please wait while I'm generating your story...";

      case "story_complete":
        // Reset for a new story
        setStoryElements({ items: [], action: "", location: "" });
        setConversationState("waiting_for_items");
        return "Let's create another story! Please give me 3 new random items separated by commas.";

      default:
        return "I'm not sure what to do with that. Let's start over with 3 random items.";
    }
  };

  // Generate the story when we have all elements
  const generateStory = (): string => {
    const { items, action, location } = storyElements;
    return `You are a creative storyteller. Create a short, engaging story that incorporates these three items: ${items.join(", ")}. The story should involve ${action} and take place in ${location}. Make the story vivid and entertaining while connecting all the elements in a meaningful way. Keep the story concise - aim for 3-4 short paragraphs with a clear beginning, middle, and end. Focus on the key moments and avoid lengthy descriptions.`;
  };

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isGeneratingStory) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const currentInput = input;
    setInput("");

    // Process the input based on conversation state
    let assistantResponse = processUserInput(currentInput);
    let shouldCallAPI = false;
    let apiPrompt = "";

    // If we're ready to tell the story, prepare for API call
    if (conversationState === "telling_story") {
      shouldCallAPI = true;
      apiPrompt = generateStory();
      setIsGeneratingStory(true);
      setConversationState("story_complete");
    }

    if (shouldCallAPI) {
      // Add a streaming assistant message placeholder
      const streamingMessage: Message = {
        role: "assistant",
        content: assistantResponse + "\n\n",
        isStreaming: true,
      };
      setMessages([...newMessages, streamingMessage]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: apiPrompt,
            context: "", // Start fresh for story generation
          }),
        });

        // Handle stream - update the last message in real-time
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = assistantResponse + "\n\n";

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

        // Mark streaming as complete and add restart prompt
        const finalContent =
          fullText +
          "\n\n---\n\nThat was fun! Would you like to create another story? Just give me 3 new random items!";
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: finalContent, isStreaming: false },
        ]);

        // Re-enable input after story is complete
        setIsGeneratingStory(false);
      } catch (error) {
        console.error("Error generating story:", error);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content:
              assistantResponse +
              "\n\nSorry, there was an error generating your story. Let's try again with 3 new items.",
            isStreaming: false,
          },
        ]);
        // Reset state on error
        setStoryElements({ items: [], action: "", location: "" });
        setConversationState("waiting_for_items");
        setIsGeneratingStory(false);
      }
    } else {
      // Just add the processed response without API call
      setMessages([
        ...newMessages,
        { role: "assistant", content: assistantResponse, isStreaming: false },
      ]);
    }
  }

  const getPlaceholderText = (): string => {
    if (isGeneratingStory) {
      return "Story is being generated... Please wait...";
    }

    switch (conversationState) {
      case "waiting_for_items":
        return "Enter 3 random items separated by commas...";
      case "waiting_for_action":
        return "Describe what action should happen in the story...";
      case "waiting_for_location":
        return "Describe where the story should take place...";
      case "telling_story":
        return "Story is being generated... Please wait...";
      case "story_complete":
        return "Want another story? Enter 3 new items...";
      default:
        return "Type your message...";
    }
  };

  const isInputDisabled = (): boolean => {
    return (
      isGeneratingStory ||
      messages.some((m) => m.isStreaming) ||
      conversationState === "telling_story"
    );
  };

  return (
    <main className="chat-container">
      <header className="chat-header">
        <h1 className="chat-title">📚 Story Creator</h1>
        <p className="chat-subtitle">Let's create amazing stories together!</p>
      </header>

      {/* Chat messages area */}
      <div className="messages-container">
        {messages.map((msg, i) => (
          <div key={i} className={`message-wrapper ${msg.role}`}>
            <div className={`message-bubble ${msg.role}`}>
              <div className="message-header">
                {msg.role === "user" ? "You" : "Story Assistant"}
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
            placeholder={getPlaceholderText()}
            className="message-input"
            disabled={isInputDisabled()}
          />
          <button
            type="submit"
            disabled={!input.trim() || isInputDisabled()}
            className="send-button"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
