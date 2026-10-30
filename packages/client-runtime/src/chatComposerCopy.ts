/** Hero heading, sub-line and composer placeholder for a chat in each mode. */
export function resolveChatComposerCopy(chatSubMode: "chat" | "work") {
  return chatSubMode === "work"
    ? {
        heading: "What should we work on?",
        subLine: "All tools on your Mac, in the shared Chats folder.",
        placeholder: "Describe the task…",
      }
    : {
        heading: "What do you want to know?",
        subLine: "Search only. Nothing on your Mac is read or changed.",
        placeholder: "Ask anything…",
      };
}
