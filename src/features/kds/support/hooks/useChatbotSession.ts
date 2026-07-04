/**
 * useChatbotSession
 *
 * Manages the chatbot floating-panel state across the entire KDS session.
 * State is persisted to sessionStorage so:
 *   - Switching KDS tabs does NOT lose the conversation
 *   - Closing/minimizing the panel does NOT end the session
 *   - A page refresh starts fresh (intentional for an operator tool)
 *
 * Closing the panel  ≠  ending the session.
 * The session only ends when the user explicitly clicks "상담 종료" or
 * "새 문의 시작".
 */

import { useCallback, useEffect, useState } from "react";

import type { ChatMessage, ChatSessionStatus, QnaPathEntry } from "../types/support";

const STORAGE_KEY = "kds_chatbot_session_v1";

export type ChatbotSessionState = {
  sessionId: string;
  isOpen: boolean;
  isMinimized: boolean;
  status: ChatSessionStatus;
  messages: StoredMessage[];
  selectedPath: QnaPathEntry[];
  currentStepId: string | null;
  unreadCount: number;
  startedAt: string; // ISO
};

// Messages stored in sessionStorage need dates serialised as strings
export type StoredMessage = Omit<ChatMessage, "timestamp"> & {
  timestamp: string; // ISO
};

function toStored(msg: ChatMessage): StoredMessage {
  return { ...msg, timestamp: msg.timestamp.toISOString() };
}

function fromStored(msg: StoredMessage): ChatMessage {
  return { ...msg, timestamp: new Date(msg.timestamp) };
}

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createFreshSession(): ChatbotSessionState {
  return {
    sessionId: generateId(),
    isOpen: false,
    isMinimized: false,
    status: "BOT",
    messages: [],
    selectedPath: [],
    currentStepId: null,
    unreadCount: 0,
    startedAt: new Date().toISOString(),
  };
}

function loadSession(): ChatbotSessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatbotSessionState;
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return createFreshSession();
}

function saveSession(state: ChatbotSessionState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

// ─── Singleton: shared across all components in the same render tree ──────────
// We use a module-level subscription pattern so every call to the hook
// gets the same live state without needing a React Context.

type Listener = (state: ChatbotSessionState) => void;

let _state: ChatbotSessionState = loadSession();
const _listeners = new Set<Listener>();

function notify() {
  saveSession(_state);
  for (const l of _listeners) l(_state);
}

function setState(updater: (prev: ChatbotSessionState) => ChatbotSessionState) {
  _state = updater(_state);
  notify();
}

// ─── Public hook ──────────────────────────────────────────────────────────────

export type UseChatbotSessionReturn = {
  /** Full session snapshot — re-renders when anything changes */
  session: ChatbotSessionState;
  /** Computed: messages with Date timestamps (not ISO strings) */
  messages: ChatMessage[];

  // Panel open/close (does NOT end the session)
  open: (context?: string) => void;
  close: () => void;
  minimize: () => void;

  // Conversation state mutations
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => ChatMessage;
  setStatus: (status: ChatSessionStatus) => void;
  setPath: (path: QnaPathEntry[]) => void;
  setCurrentStep: (stepId: string | null) => void;
  markRead: () => void;
  incrementUnread: () => void;

  // Session lifecycle
  endSession: () => void;
  startNewSession: () => void;
};

let _msgCounter = 0;
function nextMsgId(): string {
  _msgCounter += 1;
  return `msg-${_msgCounter}`;
}

export function useChatbotSession(): UseChatbotSessionReturn {
  const [session, setLocalState] = useState<ChatbotSessionState>(_state);

  useEffect(() => {
    _listeners.add(setLocalState);
    return () => {
      _listeners.delete(setLocalState);
    };
  }, []);

  const messages: ChatMessage[] = session.messages.map(fromStored);

  const open = useCallback((context?: string) => {
    setState((prev) => {
      const next = { ...prev, isOpen: true, isMinimized: false, unreadCount: 0 };
      // If a context was passed (e.g. from a FAQ "ask chatbot" button), and the
      // session is still fresh (BOT mode, no messages), record it as the first
      // selected path so the bot can reference it.
      if (context && prev.status === "BOT" && prev.messages.length === 0) {
        next.selectedPath = [
          { stepId: "faq", question: "FAQ에서 이어진 문의", selectedOptionLabel: context },
        ];
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const minimize = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: !prev.isMinimized, unreadCount: 0 }));
  }, []);

  const addMessage = useCallback(
    (msg: Omit<ChatMessage, "id" | "timestamp">): ChatMessage => {
      const full: ChatMessage = {
        ...msg,
        id: nextMsgId(),
        timestamp: new Date(),
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, toStored(full)],
      }));
      return full;
    },
    []
  );

  const setStatus = useCallback((status: ChatSessionStatus) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const setPath = useCallback((path: QnaPathEntry[]) => {
    setState((prev) => ({ ...prev, selectedPath: path }));
  }, []);

  const setCurrentStep = useCallback((stepId: string | null) => {
    setState((prev) => ({ ...prev, currentStepId: stepId }));
  }, []);

  const markRead = useCallback(() => {
    setState((prev) => ({ ...prev, unreadCount: 0 }));
  }, []);

  const incrementUnread = useCallback(() => {
    setState((prev) => {
      // Only increment when panel is not visible/focused
      if (prev.isOpen && !prev.isMinimized) return prev;
      return { ...prev, unreadCount: prev.unreadCount + 1 };
    });
  }, []);

  const endSession = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: "CLOSED",
      isOpen: true,
      isMinimized: false,
    }));
  }, []);

  const startNewSession = useCallback(() => {
    _msgCounter = 0;
    setState(() => ({ ...createFreshSession(), isOpen: true }));
  }, []);

  return {
    session,
    messages,
    open,
    close,
    minimize,
    addMessage,
    setStatus,
    setPath,
    setCurrentStep,
    markRead,
    incrementUnread,
    endSession,
    startNewSession,
  };
}
