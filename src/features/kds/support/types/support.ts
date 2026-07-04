// ─────────────────────────────────────────────────────────────
// Support session types
// ─────────────────────────────────────────────────────────────

export type SupportView = "HOME" | "QNA" | "CHAT";

export type ChatSessionStatus =
  | "BOT"         // guided Q&A in progress
  | "AI"          // AI chatbot
  | "WAITING_AGENT" // awaiting agent connection
  | "AGENT"       // connected to live agent
  | "CLOSED";     // session ended

export type ChatMessageRole = "user" | "bot" | "ai" | "agent" | "system";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
};

export type QnaPathEntry = {
  stepId: string;
  question: string;
  selectedOptionLabel: string;
};
