/**
 * ChatbotFab
 *
 * Floating Action Button + the floating chatbot panel.
 * All chatbot state lives in useChatbotSession (persisted to sessionStorage).
 *
 * State machine inside the panel:
 *   BOT          → guided Q&A choices rendered as chat messages
 *   AI           → free-text input, simulated AI replies
 *   WAITING_AGENT → input disabled, timer simulates agent connecting
 *   AGENT        → free-text input, simulated agent replies
 *   CLOSED       → read-only, new-session CTA
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle,
  ChevronRight,
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

// ─── BotChoices sub-component ─────────────────────────────────────────────────

type BotChoicesProps = {
  stepId: string;
  onChoose: (label: string, nextStepId?: string, terminal?: string, answer?: string) => void;
};

function BotChoices({ stepId, onChoose }: BotChoicesProps) {
  if (stepId === "initial") {
    return (
      <div className="chatbot-choices">
        {QNA_INITIAL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className="chatbot-choice-btn"
            type="button"
            onClick={() =>
              onChoose(opt.label, opt.nextStepId, opt.terminal)
            }
          >
            <ChevronRight size={13} aria-hidden="true" />
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  const step = QNA_STEPS[stepId];
  if (!step) return null;

  return (
    <div className="chatbot-choices">
      {step.options.map((opt) => (
        <button
          key={opt.id}
          className={`chatbot-choice-btn${
            opt.terminal === "resolved"
              ? " chatbot-choice-resolved"
              : opt.terminal === "agent"
              ? " chatbot-choice-agent"
              : opt.terminal === "ai"
              ? " chatbot-choice-ai"
              : ""
          }`}
          type="button"
          onClick={() =>
            onChoose(opt.label, opt.nextStepId, opt.terminal, opt.answer)
          }
        >
          {opt.terminal === "resolved" ? (
            <CheckCircle size={13} aria-hidden="true" />
          ) : (
            <ChevronRight size={13} aria-hidden="true" />
          )}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Terminal choices (always shown at the end of a resolved branch) ───────────

type TerminalChoicesProps = {
  onResolved: () => void;
  onAI: () => void;
  onAgent: () => void;
  onRestart: () => void;
};

function TerminalChoices({ onResolved, onAI, onAgent, onRestart }: TerminalChoicesProps) {
  return (
    <div className="chatbot-choices">
      <button
        className="chatbot-choice-btn chatbot-choice-resolved"
        type="button"
        onClick={onResolved}
      >
        <CheckCircle size={13} aria-hidden="true" />
        해결됐어요
      </button>
      <button className="chatbot-choice-btn chatbot-choice-ai" type="button" onClick={onAI}>
        <Bot size={13} aria-hidden="true" />
        AI에게 이어서 질문
      </button>
      <button
        className="chatbot-choice-btn chatbot-choice-agent"
        type="button"
        onClick={onAgent}
      >
        <Headphones size={13} aria-hidden="true" />
        상담원 연결
      </button>
      <button className="chatbot-choice-btn" type="button" onClick={onRestart}>
        <RefreshCcw size={13} aria-hidden="true" />
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
  // Tracks which message IDs have already had their choices rendered,
  // so we only render the latest choice prompt and hide older ones.
  const [activeChoicesMsgId, setActiveChoicesMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isOpen, isMinimized, status, selectedPath, currentStepId, unreadCount } = session;

  // ── Scroll to bottom whenever messages change ──────────────────────────────
  useEffect(() => {
    if (isOpen && !isMinimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  // ── Mark read when panel becomes visible ──────────────────────────────────
  useEffect(() => {
    if (isOpen && !isMinimized) markRead();
  }, [isOpen, isMinimized, markRead]);

  // ── Init: show greeting + first choices when session starts fresh ──────────
  useEffect(() => {
    if (status === "BOT" && messages.length === 0) {
      // Check for a FAQ context that was passed in
      const faqContext =
        selectedPath.length === 1 && selectedPath[0].stepId === "faq"
          ? selectedPath[0].selectedOptionLabel
          : null;

      const greetMsg = addMessage({
        role: "bot",
        content: faqContext
          ? `안녕하세요. FAQ에서 이어진 문의를 확인했습니다.\n"${faqContext}"\n\n아래에서 관련 문제 유형을 선택해 주세요.`
          : "안녕하세요. DeepOrder KDS 고객지원입니다. 아래에서 문제 유형을 선택해 주세요.",
      });
      setCurrentStep("initial");
      setActiveChoicesMsgId(greetMsg.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Simulate agent connecting after WAITING_AGENT ─────────────────────────
  useEffect(() => {
    if (status !== "WAITING_AGENT") return;
    if (agentTimerRef.current) clearTimeout(agentTimerRef.current);
    agentTimerRef.current = setTimeout(() => {
      setStatus("AGENT");
      const m = addMessage({ role: "system", content: "상담원이 연결되었습니다." });
      incrementUnread();
      const agentMsg = addMessage({
        role: "agent",
        content:
          "안녕하세요. 상담원입니다. 불편을 드려 죄송합니다. 확인한 내용을 바탕으로 도움을 드리겠습니다.",
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
    // Record user choice as a message
    const userMsg = addMessage({ role: "user", content: label });
    setActiveChoicesMsgId(null);

    const newEntry: QnaPathEntry = {
      stepId: currentStepId ?? "initial",
      question: currentStepId === "initial" ? "어떻게 도와드릴까요?" : (QNA_STEPS[currentStepId ?? ""]?.question ?? ""),
      selectedOptionLabel: label,
    };
    const newPath = [...selectedPath, newEntry];
    setPath(newPath);

    if (terminal === "resolved") {
      // Show the terminal choices (해결/AI/agent/restart)
      const botMsg = addMessage({
        role: "bot",
        content: "문제가 해결되었나요? 아래에서 선택해 주세요.",
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

    // Show answer card if present
    if (answer) {
      addMessage({ role: "bot", content: answer });
    }

    if (nextStepId === "terminal") {
      const botMsg = addMessage({
        role: "bot",
        content: "문제가 해결되었나요? 아래에서 선택해 주세요.",
      });
      setCurrentStep("terminal");
      setActiveChoicesMsgId(botMsg.id);
      return;
    }

    if (nextStepId && QNA_STEPS[nextStepId]) {
      const nextStep = QNA_STEPS[nextStepId];
      const botMsg = addMessage({ role: "bot", content: nextStep.question });
      setCurrentStep(nextStepId);
      setActiveChoicesMsgId(botMsg.id);
    }
  }

  // ── Terminal choice handler ────────────────────────────────────────────────
  function handleTerminalChoice(choice: "resolved" | "ai" | "agent" | "restart") {
    setActiveChoicesMsgId(null);
    if (choice === "resolved") {
      addMessage({ role: "system", content: "문제가 해결되었습니다. 도움이 되었으면 좋겠습니다." });
      endSession();
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
      addMessage({
        role: "system",
        content: `선택 경로: ${summary}`,
      });
    }
    addMessage({
      role: "ai",
      content: summary
        ? `지금까지 선택하신 내용(${summary})을 확인했습니다. 추가로 궁금한 점을 자유롭게 입력해 주세요.\n\nkds-web 기능 범위 내에서 안내하며, 주문·계정·직원 데이터의 직접 변경은 수행하지 않습니다.`
        : "안녕하세요, AI 상담 도우미입니다. 궁금한 점을 자유롭게 입력해 주세요.\n\nkds-web 기능 범위 내에서 안내하며, 주문·계정·직원 데이터의 직접 변경은 수행하지 않습니다.",
    });
    setActiveChoicesMsgId(null);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  function transitionToAgent(path: QnaPathEntry[]) {
    const summary = buildPathSummary(path);
    setStatus("WAITING_AGENT");
    addMessage({
      role: "system",
      content: summary
        ? `상담원에게 지금까지 확인한 내용을 전달합니다.\n선택 경로: ${summary}`
        : "상담원 연결을 요청합니다.",
    });
    addMessage({
      role: "system",
      content: "상담원 연결 대기 중입니다. 이전 상담 내용은 상담원에게 함께 전달됩니다.",
    });
  }

  // ── Free-text send ─────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || sending || status === "CLOSED" || status === "BOT" || status === "WAITING_AGENT") return;
    setInput("");
    setSending(true);
    addMessage({ role: "user", content: text });

    if (status === "AI") {
      await new Promise((r) => setTimeout(r, 900));
      const reply = addMessage({ role: "ai", content: nextAiReply() });
      incrementUnread();
    } else if (status === "AGENT") {
      await new Promise((r) => setTimeout(r, 1200));
      const reply = addMessage({
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
  const canType =
    status === "AI" || status === "AGENT";
  const showInputArea = canType;
  const showAgentBtn = status === "AI";
  const showEndBtn = status === "AI" || status === "AGENT";

  // ── FAB ────────────────────────────────────────────────────────────────────
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
            <div className="chatbot-header-title">
              {status === "AI" ? (
                <Bot size={15} aria-hidden="true" />
              ) : status === "AGENT" || status === "WAITING_AGENT" ? (
                <Headphones size={15} aria-hidden="true" />
              ) : (
                <MessageCircle size={15} aria-hidden="true" />
              )}
              <span>
                {status === "AI"
                  ? "AI 상담"
                  : status === "WAITING_AGENT"
                  ? "상담원 연결 대기"
                  : status === "AGENT"
                  ? "상담원 상담"
                  : status === "CLOSED"
                  ? "상담 종료"
                  : "챗봇 상담"}
              </span>
              <span className={`chatbot-status-badge ${STATUS_CSS[status]}`}>
                {status === "WAITING_AGENT" ? (
                  <Loader size={10} aria-hidden="true" className="chatbot-spin" />
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
                  <Headphones size={13} aria-hidden="true" />
                  <span>상담원</span>
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
              {/* Path breadcrumb */}
              {selectedPath.length > 0 && status === "BOT" ? (
                <div className="chatbot-breadcrumb" aria-label="선택 경로">
                  {selectedPath.map((e, i) => (
                    <span key={i} className="chatbot-breadcrumb-item">
                      {i > 0 ? <span aria-hidden="true"> › </span> : null}
                      {e.selectedOptionLabel}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Messages */}
              <div className="chatbot-messages" role="log" aria-live="polite">
                {messages.map((msg) => {
                  if (msg.role === "system") {
                    return (
                      <div key={msg.id} className="chatbot-msg-system">
                        <span>{msg.content}</span>
                      </div>
                    );
                  }

                  if (msg.role === "user") {
                    return (
                      <div key={msg.id} className="chatbot-msg chatbot-msg--user">
                        <div className="chatbot-bubble chatbot-bubble--user">
                          {msg.content.split("\n").map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                        <time className="chatbot-msg-time">{formatTime(msg.timestamp)}</time>
                      </div>
                    );
                  }

                  if (msg.role === "bot") {
                    const isActive = msg.id === activeChoicesMsgId;
                    return (
                      <div key={msg.id} className="chatbot-msg chatbot-msg--bot">
                        <div className="chatbot-msg-avatar chatbot-msg-avatar--bot">
                          <MessageCircle size={12} aria-hidden="true" />
                        </div>
                        <div className="chatbot-msg-body">
                          <div className="chatbot-bubble chatbot-bubble--bot">
                            {msg.content.split("\n").map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                          <time className="chatbot-msg-time">{formatTime(msg.timestamp)}</time>
                          {/* Render choices only for the currently active message */}
                          {isActive && currentStepId && currentStepId !== "terminal" ? (
                            <BotChoices
                              stepId={currentStepId}
                              onChoose={handleBotChoice}
                            />
                          ) : null}
                          {isActive && currentStepId === "terminal" ? (
                            <TerminalChoices
                              onResolved={() => handleTerminalChoice("resolved")}
                              onAI={() => handleTerminalChoice("ai")}
                              onAgent={() => handleTerminalChoice("agent")}
                              onRestart={() => handleTerminalChoice("restart")}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  }

                  if (msg.role === "ai") {
                    return (
                      <div key={msg.id} className="chatbot-msg chatbot-msg--ai">
                        <div className="chatbot-msg-avatar chatbot-msg-avatar--ai">
                          <Bot size={12} aria-hidden="true" />
                        </div>
                        <div className="chatbot-msg-body">
                          <div className="chatbot-bubble chatbot-bubble--ai">
                            {msg.content.split("\n").map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                          <time className="chatbot-msg-time">{formatTime(msg.timestamp)}</time>
                        </div>
                      </div>
                    );
                  }

                  if (msg.role === "agent") {
                    return (
                      <div key={msg.id} className="chatbot-msg chatbot-msg--agent">
                        <div className="chatbot-msg-avatar chatbot-msg-avatar--agent">
                          <Headphones size={12} aria-hidden="true" />
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
                        status === "AGENT"
                          ? "chatbot-msg-avatar--agent"
                          : "chatbot-msg-avatar--ai"
                      }`}
                    >
                      {status === "AGENT" ? (
                        <Headphones size={12} aria-hidden="true" />
                      ) : (
                        <Bot size={12} aria-hidden="true" />
                      )}
                    </div>
                    <div className="chatbot-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ) : null}

                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              {showInputArea ? (
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
                    <RefreshCcw size={13} aria-hidden="true" />
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
