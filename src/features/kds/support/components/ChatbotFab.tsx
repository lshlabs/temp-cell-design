/**
 * ChatbotFab
 *
 * Floating Action Button + the floating chatbot panel.
 * All chatbot state lives in useChatbotSession (persisted to sessionStorage).
 *
 * Design reference: Air Premia chatbot — plain text bot messages, user selections
 * appear as right-aligned pill chips (not left-side bot choices).
 *
 * State machine:
 *   BOT          → guided Q&A; user choices shown as right-aligned chips
 *   AI           → free-text input, simulated AI replies
 *   WAITING_AGENT → input disabled, timer simulates agent connecting
 *   AGENT        → free-text input, simulated agent replies
 *   CLOSED       → read-only, new-session CTA
 */

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle,
  Headphones,
  Loader,
  MessageCircle,
  Minus,
  RefreshCcw,
  Send,
  X,
} from "lucide-react";

import { QNA_INITIAL_OPTIONS, QNA_STEPS } from "../data/supportData";
import { useChatbotSession } from "../hooks/useChatbotSession";
import type { ChatMessage, ChatSessionStatus, QnaPathEntry } from "../types/support";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function buildPathSummary(path: QnaPathEntry[]): string {
  return path.map((e) => e.selectedOptionLabel).join(" > ");
}

const STATUS_LABELS: Record<ChatSessionStatus, string> = {
  BOT: "챗봇",
  AI: "AI 상담",
  WAITING_AGENT: "연결 대기",
  AGENT: "상담원",
  CLOSED: "종료",
};

const STATUS_CSS: Record<ChatSessionStatus, string> = {
  BOT: "status-bot",
  AI: "status-ai",
  WAITING_AGENT: "status-waiting",
  AGENT: "status-agent",
  CLOSED: "status-closed",
};

const SIMULATED_AI: string[] = [
  "말씀하신 내용을 확인했습니다. 설정 메뉴에서 해당 항목을 먼저 확인해 보시겠어요?",
  "kds-web 기능 기준으로 안내해 드릴게요. 조금 더 구체적으로 설명해 주시면 더 정확히 안내 가능합니다.",
  "해당 문제는 권한 설정과 관련이 있을 수 있습니다. 매니저 계정으로 확인이 필요합니다.",
  "직접 데이터 변경은 지원하지 않지만, 화면에서 처리하는 방법을 안내해 드릴 수 있습니다.",
  "이 문제는 상담원 연결이 필요한 경우일 수 있습니다. 상담원 연결을 원하시면 아래 버튼을 눌러주세요.",
];
let _aiIdx = 0;
function nextAiReply(): string {
  const r = SIMULATED_AI[_aiIdx % SIMULATED_AI.length];
  _aiIdx += 1;
  return r;
}

// ─── UserChoiceChips ──────────────────────────────────────────────────────────
// Renders the guided Q&A options as right-aligned pill chips (user's perspective).

type UserChoiceChipsProps = {
  stepId: string;
  onChoose: (label: string, nextStepId?: string, terminal?: string, answer?: string) => void;
};

function UserChoiceChips({ stepId, onChoose }: UserChoiceChipsProps) {
  const options =
    stepId === "initial"
      ? QNA_INITIAL_OPTIONS.map((opt) => ({
          id: opt.id,
          label: opt.label,
          nextStepId: opt.nextStepId,
          terminal: opt.terminal,
          answer: undefined as string | undefined,
        }))
      : (QNA_STEPS[stepId]?.options ?? []).map((opt) => ({
          id: opt.id,
          label: opt.label,
          nextStepId: opt.nextStepId,
          terminal: opt.terminal,
          answer: opt.answer,
        }));

  if (options.length === 0) return null;

  return (
    <div className="chatbot-user-chips">
      {options.map((opt) => (
        <button
          key={opt.id}
          className="chatbot-user-chip"
          type="button"
          onClick={() => onChoose(opt.label, opt.nextStepId, opt.terminal, opt.answer)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── TerminalChips ────────────────────────────────────────────────────────────

type TerminalChipsProps = {
  onResolved: () => void;
  onUnresolved: () => void;
  onAI: () => void;
  onAgent: () => void;
  onRestart: () => void;
};

function TerminalChips({ onResolved, onUnresolved, onAI, onAgent, onRestart }: TerminalChipsProps) {
  return (
    <div className="chatbot-user-chips">
      <button className="chatbot-user-chip chatbot-user-chip--green" type="button" onClick={onResolved}>
        <CheckCircle size={12} aria-hidden="true" />
        해결됐어요
      </button>
      <button className="chatbot-user-chip" type="button" onClick={onUnresolved}>
        아직 해결되지 않았어요
      </button>
      <button className="chatbot-user-chip chatbot-user-chip--blue" type="button" onClick={onAI}>
        <Bot size={12} aria-hidden="true" />
        AI에게 질문
      </button>
      <button className="chatbot-user-chip" type="button" onClick={onAgent}>
        <Headphones size={12} aria-hidden="true" />
        상담원 연결
      </button>
      <button className="chatbot-user-chip" type="button" onClick={onRestart}>
        <RefreshCcw size={12} aria-hidden="true" />
        처음으로
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatbotFab() {
  const {
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
  } = useChatbotSession();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeChoicesMsgId, setActiveChoicesMsgId] = useState<string | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the user has scrolled up away from the bottom
  const userScrolledUpRef = useRef(false);
  // Guard: prevent duplicate welcome message across StrictMode double-effects / re-opens
  const initDoneRef = useRef(false);

  const { isOpen, isMinimized, status, selectedPath, currentStepId, unreadCount } = session;

  // ── Smart scroll: only auto-scroll when user is at/near the bottom ─────────
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const el = messagesRef.current;
    if (!el) return;
    // If the user has scrolled up, don't hijack their scroll position
    if (userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isOpen, isMinimized]);

  // Track whether user has scrolled away from the bottom
  function handleMessagesScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distFromBottom > 60;
  }

  // When panel is opened/un-minimized, reset scroll lock
  useEffect(() => {
    if (isOpen && !isMinimized) {
      userScrolledUpRef.current = false;
      markRead();
    }
  }, [isOpen, isMinimized, markRead]);

  // ── Init: show greeting + first choices when session starts fresh ──────────
  // Runs on mount AND whenever the session ID changes (i.e. startNewSession was called).
  useEffect(() => {
    // Reset guard whenever session ID changes
    initDoneRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId]);

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    if (status !== "BOT") return;

    if (messages.length > 0) {
      // Session already has messages (restored from storage) — restore active chips
      if (currentStepId) {
        const lastBotMsg = [...messages].reverse().find((m) => m.role === "bot");
        if (lastBotMsg) setActiveChoicesMsgId(lastBotMsg.id);
      }
      return;
    }

    // Fresh session — show welcome message + initial choices immediately
    const faqContext =
      selectedPath.length === 1 && selectedPath[0].stepId === "faq"
        ? selectedPath[0].selectedOptionLabel
        : null;

    const greetMsg = addMessage({
      role: "bot",
      content: faqContext
        ? `안녕하세요. FAQ에서 이어진 문의를 확인했습니다.\n"${faqContext}"\n\n아래에서 관련 문제 유형을 선택해 주세요.`
        : "안녕하세요. DeepOrder KDS 고객지원입니다.\n아래에서 문제 유형을 선택해 주세요.",
    });
    setCurrentStep("initial");
    setActiveChoicesMsgId(greetMsg.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId]);

  // ── Simulate agent connecting after WAITING_AGENT ─────────────────────────
  useEffect(() => {
    if (status !== "WAITING_AGENT") return;
    if (agentTimerRef.current) clearTimeout(agentTimerRef.current);
    agentTimerRef.current = setTimeout(() => {
      setStatus("AGENT");
      addMessage({ role: "system", content: "상담원이 연결되었습니다." });
      incrementUnread();
      addMessage({
        role: "agent",
        content: "안녕하세요. 상담원입니다. 불편을 드려 죄송합니다. 확인한 내용을 바탕으로 도움을 드리겠습니다.",
      });
      setActiveChoicesMsgId(null);
      incrementUnread();
    }, 3000);
    return () => {
      if (agentTimerRef.current) clearTimeout(agentTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ── BOT choice handler ─────────────────────────────────────────────────────
  function handleBotChoice(
    label: string,
    nextStepId?: string,
    terminal?: string,
    answer?: string
  ) {
    // Record user selection as a user bubble (right-side)
    addMessage({ role: "user", content: label });
    setActiveChoicesMsgId(null);
    userScrolledUpRef.current = false; // auto-scroll after user action

    const newEntry: QnaPathEntry = {
      stepId: currentStepId ?? "initial",
      question:
        currentStepId === "initial"
          ? "어떻게 도와드릴까요?"
          : (QNA_STEPS[currentStepId ?? ""]?.question ?? ""),
      selectedOptionLabel: label,
    };
    const newPath = [...selectedPath, newEntry];
    setPath(newPath);

    if (terminal === "resolved") {
      const botMsg = addMessage({
        role: "bot",
        content: "문제가 해결되었나요?",
      });
      setCurrentStep("terminal");
      setActiveChoicesMsgId(botMsg.id);
      return;
    }
    if (terminal === "agent") {
      transitionToAgent(newPath);
      return;
    }
    if (terminal === "ai") {
      transitionToAI(newPath);
      return;
    }

    if (answer) {
      addMessage({ role: "bot", content: answer });
    }

    if (nextStepId === "terminal") {
      const botMsg = addMessage({
        role: "bot",
        content: "문제가 해결되었나요?",
      });
      setCurrentStep("terminal");
      setActiveChoicesMsgId(botMsg.id);
      return;
    }

    if (nextStepId && QNA_STEPS[nextStepId]) {
      const nextStep = QNA_STEPS[nextStepId];
      const botMsg = addMessage({ role: "bot", content: nextStep.question });

      if (nextStep.autoTerminal) {
        // Deliver answer directly — skip confirm chip, go straight to terminal
        const terminalMsg = addMessage({ role: "bot", content: "문제가 해결되었나요?" });
        setCurrentStep("terminal");
        setActiveChoicesMsgId(terminalMsg.id);
      } else {
        setCurrentStep(nextStepId);
        setActiveChoicesMsgId(botMsg.id);
      }
    }
  }

  // ── Terminal choice handler ────────────────────────────────────────────────
  function handleTerminalChoice(choice: "resolved" | "unresolved" | "ai" | "agent" | "restart") {
    setActiveChoicesMsgId(null);
    userScrolledUpRef.current = false;
    if (choice === "resolved") {
      addMessage({ role: "system", content: "문제가 해결되었습니다. 도움이 되었으면 좋겠습니다." });
      endSession();
      return;
    }
    if (choice === "unresolved") {
      transitionToAgent(selectedPath);
      return;
    }
    if (choice === "ai") transitionToAI(selectedPath);
    if (choice === "agent") transitionToAgent(selectedPath);
    if (choice === "restart") {
      addMessage({ role: "system", content: "처음으로 돌아갑니다." });
      setPath([]);
      setCurrentStep("initial");
      setStatus("BOT");
      const botMsg = addMessage({
        role: "bot",
        content: "아래에서 문제 유형을 다시 선택해 주세요.",
      });
      setActiveChoicesMsgId(botMsg.id);
    }
  }

  function transitionToAI(path: QnaPathEntry[]) {
    const summary = buildPathSummary(path);
    setStatus("AI");
    if (summary) {
      addMessage({ role: "system", content: `선택 경로: ${summary}` });
    }
    addMessage({
      role: "ai",
      content: summary
        ? `지금까지 선택하신 내용을 확인했습니다.\n추가로 궁금한 점을 자유롭게 입력해 주세요.`
        : "안녕하세요, AI 상담 도우미입니다. 궁금한 점을 자유롭게 입력해 주세요.",
    });
    setActiveChoicesMsgId(null);
    userScrolledUpRef.current = false;
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  function transitionToAgent(path: QnaPathEntry[]) {
    const summary = buildPathSummary(path);
    setStatus("WAITING_AGENT");
    addMessage({
      role: "system",
      content: summary
        ? `상담원에게 이전 내용을 전달합니다.\n선택 경로: ${summary}`
        : "상담원 연결을 요청합니다.",
    });
    addMessage({
      role: "system",
      content: "상담원 연결 대기 중입니다. 이전 상담 내용은 상담원에게 함께 전달됩니다.",
    });
    userScrolledUpRef.current = false;
  }

  // ── Free-text send ─────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || sending || status === "CLOSED" || status === "BOT" || status === "WAITING_AGENT") return;
    setInput("");
    setSending(true);
    userScrolledUpRef.current = false;
    addMessage({ role: "user", content: text });

    if (status === "AI") {
      await new Promise((r) => setTimeout(r, 900));
      addMessage({ role: "ai", content: nextAiReply() });
      incrementUnread();
    } else if (status === "AGENT") {
      await new Promise((r) => setTimeout(r, 1200));
      addMessage({
        role: "agent",
        content: "확인했습니다. 조금 더 상세히 확인 후 안내해 드리겠습니다.",
      });
      incrementUnread();
    }

    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !(e.keyCode === 229)) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleConnectAgent() {
    if (status === "AI") transitionToAgent(selectedPath);
  }

  function handleClose() {
    setStatus("CLOSED");
    addMessage({
      role: "system",
      content: "상담이 종료되었습니다. 추가 문의 사항이 있으면 새 문의를 시작해 주세요.",
    });
  }

  // ── Computed flags ─────────────────────────────────────────────────────────
  const canType = status === "AI" || status === "AGENT";
  const showAgentBtn = status === "AI";
  const showEndBtn = status === "AI" || status === "AGENT";

  // ── FAB label ──────────────────────────────────────────────────────────────
  const fabLabel = isOpen && !isMinimized ? "챗봇 최소화" : "챗봇 상담 열기";

  return (
    <>
      {/* Floating panel */}
      {isOpen ? (
        <div
          className={`chatbot-panel${isMinimized ? " chatbot-panel--minimized" : ""}`}
          role="dialog"
          aria-label="챗봇 상담"
          aria-modal="false"
        >
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-icon" aria-hidden="true">
              {status === "AI" ? (
                <Bot size={16} />
              ) : status === "AGENT" || status === "WAITING_AGENT" ? (
                <Headphones size={16} />
              ) : (
                <MessageCircle size={16} />
              )}
            </div>
            <div className="chatbot-header-title">
              <span className="chatbot-header-name">
                {status === "AI"
                  ? "AI 상담"
                  : status === "WAITING_AGENT"
                  ? "상담원 연결 대기"
                  : status === "AGENT"
                  ? "상담원 상담"
                  : status === "CLOSED"
                  ? "상담 종료"
                  : "고객지원 챗봇"}
              </span>
              <span className={`chatbot-status-badge ${STATUS_CSS[status]}`}>
                {status === "WAITING_AGENT" ? (
                  <Loader size={9} aria-hidden="true" className="chatbot-spin" />
                ) : null}
                {STATUS_LABELS[status]}
              </span>
            </div>
            <div className="chatbot-header-actions">
              {showAgentBtn ? (
                <button
                  className="chatbot-header-action-btn"
                  onClick={handleConnectAgent}
                  type="button"
                  title="상담원 연결"
                >
                  <Headphones size={12} aria-hidden="true" />
                  상담원
                </button>
              ) : null}
              {showEndBtn ? (
                <button
                  className="chatbot-header-icon-btn"
                  onClick={handleClose}
                  type="button"
                  title="상담 종료"
                  aria-label="상담 종료"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
              <button
                className="chatbot-header-icon-btn"
                onClick={minimize}
                type="button"
                title={isMinimized ? "펼치기" : "최소화"}
                aria-label={isMinimized ? "펼치기" : "최소화"}
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <button
                className="chatbot-header-icon-btn"
                onClick={close}
                type="button"
                title="닫기"
                aria-label="닫기"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Body — hidden when minimized */}
          {!isMinimized ? (
            <>
              {/* Messages */}
              <div
                className="chatbot-messages"
                ref={messagesRef}
                role="log"
                aria-live="polite"
                onScroll={handleMessagesScroll}
              >
                {messages.map((msg) => {
                  // ── System message ─────────────────────────────────────────
                  if (msg.role === "system") {
                    return (
                      <div key={msg.id} className="chatbot-msg-system">
                        <span>{msg.content}</span>
                      </div>
                    );
                  }

                  // ── User message (text typed by user) ──────────────────────
                  if (msg.role === "user") {
                    return (
                      <div key={msg.id} className="chatbot-msg chatbot-msg--user">
                        <div className="chatbot-msg-body chatbot-msg-body--user">
                          <div className="chatbot-bubble chatbot-bubble--user">
                            {msg.content.split("\n").map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                          <time className="chatbot-msg-time chatbot-msg-time--user">
                            {formatTime(msg.timestamp)}
                          </time>
                        </div>
                      </div>
                    );
                  }

                  // ── Bot message (from guided Q&A) ──────────────────────────
                  if (msg.role === "bot") {
                    const isActive = msg.id === activeChoicesMsgId;
                    return (
                      <div key={msg.id} className="chatbot-msg-group">
                        {/* Bot bubble row */}
                        <div className="chatbot-msg chatbot-msg--bot">
                          <div className="chatbot-msg-avatar chatbot-msg-avatar--bot" aria-hidden="true">
                            <MessageCircle size={12} />
                          </div>
                          <div className="chatbot-msg-body">
                            <div className="chatbot-bubble chatbot-bubble--bot">
                              {msg.content.split("\n").map((line, i) => (
                                <p key={i}>{line || "\u00A0"}</p>
                              ))}
                            </div>
                            <time className="chatbot-msg-time">{formatTime(msg.timestamp)}</time>
                          </div>
                        </div>
                        {/* Chips row — right-aligned, outside the bot bubble */}
                        {isActive && currentStepId && currentStepId !== "terminal" ? (
                          <div className="chatbot-choice-row">
                            <UserChoiceChips stepId={currentStepId} onChoose={handleBotChoice} />
                          </div>
                        ) : null}
                        {isActive && currentStepId === "terminal" ? (
                          <div className="chatbot-choice-row">
                            <TerminalChips
                              onResolved={() => handleTerminalChoice("resolved")}
                              onUnresolved={() => handleTerminalChoice("unresolved")}
                              onAI={() => handleTerminalChoice("ai")}
                              onAgent={() => handleTerminalChoice("agent")}
                              onRestart={() => handleTerminalChoice("restart")}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  // ── AI message ─────────────────────────────────────────────
                  if (msg.role === "ai") {
                    return (
                      <div key={msg.id} className="chatbot-msg chatbot-msg--ai">
                        <div className="chatbot-msg-avatar chatbot-msg-avatar--ai" aria-hidden="true">
                          <Bot size={12} />
                        </div>
                        <div className="chatbot-msg-body">
                          <div className="chatbot-bubble chatbot-bubble--ai">
                            {msg.content.split("\n").map((line, i) => (
                              <p key={i}>{line || "\u00A0"}</p>
                            ))}
                          </div>
                          <time className="chatbot-msg-time">{formatTime(msg.timestamp)}</time>
                        </div>
                      </div>
                    );
                  }

                  // ── Agent message ──────────────────────────────────────────
                  if (msg.role === "agent") {
                    return (
                      <div key={msg.id} className="chatbot-msg chatbot-msg--agent">
                        <div className="chatbot-msg-avatar chatbot-msg-avatar--agent" aria-hidden="true">
                          <Headphones size={12} />
                        </div>
                        <div className="chatbot-msg-body">
                          <div className="chatbot-bubble chatbot-bubble--agent">
                            {msg.content.split("\n").map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                          <time className="chatbot-msg-time">{formatTime(msg.timestamp)}</time>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}

                {/* Typing indicator */}
                {sending && (status === "AI" || status === "AGENT") ? (
                  <div className="chatbot-msg chatbot-msg--ai">
                    <div
                      className={`chatbot-msg-avatar ${
                        status === "AGENT" ? "chatbot-msg-avatar--agent" : "chatbot-msg-avatar--ai"
                      }`}
                      aria-hidden="true"
                    >
                      {status === "AGENT" ? <Headphones size={12} /> : <Bot size={12} />}
                    </div>
                    <div className="chatbot-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Free-text input area */}
              {canType ? (
                <div className="chatbot-input-area">
                  <textarea
                    ref={textareaRef}
                    className="chatbot-textarea"
                    disabled={sending}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지를 입력하세요..."
                    rows={2}
                    value={input}
                  />
                  <button
                    aria-label="보내기"
                    className="chatbot-send-btn"
                    disabled={!input.trim() || sending}
                    onClick={() => void handleSend()}
                    type="button"
                  >
                    <Send size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              {/* Waiting state notice */}
              {status === "WAITING_AGENT" ? (
                <div className="chatbot-waiting-notice">
                  <Loader size={13} aria-hidden="true" className="chatbot-spin" />
                  <span>상담원 연결 대기 중...</span>
                </div>
              ) : null}

              {/* Closed state CTA */}
              {status === "CLOSED" ? (
                <div className="chatbot-closed-footer">
                  <p>상담이 종료되었습니다.</p>
                  <button
                    className="chatbot-new-session-btn"
                    onClick={startNewSession}
                    type="button"
                  >
                    <RefreshCcw size={12} aria-hidden="true" />
                    새 문의 시작
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {/* FAB */}
      <button
        aria-label={fabLabel}
        className={`chatbot-fab${isOpen && !isMinimized ? " chatbot-fab--open" : ""}`}
        onClick={() => (isOpen ? minimize() : open())}
        type="button"
      >
        {isOpen && !isMinimized ? (
          <Minus size={22} aria-hidden="true" />
        ) : (
          <MessageCircle size={22} aria-hidden="true" />
        )}
        {unreadCount > 0 && (!isOpen || isMinimized) ? (
          <span className="chatbot-fab-badge" aria-label={`읽지 않은 메시지 ${unreadCount}개`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
    </>
  );
}
