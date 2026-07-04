import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Headphones, Loader, Send, User, X } from "lucide-react";

import type { ChatMessage, ChatSessionStatus, QnaPathEntry } from "../types/support";

type ChatSessionProps = {
  initialPath: QnaPathEntry[];
  initialStatus: ChatSessionStatus;
  onBack: () => void;
  onResolveFromChat: () => void;
};

let _msgIdCounter = 0;
function nextId() {
  _msgIdCounter += 1;
  return `msg-${_msgIdCounter}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<ChatSessionStatus, string> = {
  BOT: "BOT",
  AI: "AI",
  WAITING_AGENT: "연결 대기",
  AGENT: "상담원",
  CLOSED: "종료",
};

const STATUS_CLASSES: Record<ChatSessionStatus, string> = {
  BOT: "status-bot",
  AI: "status-ai",
  WAITING_AGENT: "status-waiting",
  AGENT: "status-agent",
  CLOSED: "status-closed",
};

function buildPathSummary(path: QnaPathEntry[]): string {
  if (path.length === 0) return "";
  return path.map((e) => e.selectedOptionLabel).join(" > ");
}

function buildInitialMessages(
  path: QnaPathEntry[],
  status: ChatSessionStatus
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (status === "AI" && path.length > 0) {
    const summary = buildPathSummary(path);
    messages.push({
      id: nextId(),
      role: "system",
      content: `선택 경로: ${summary}`,
      timestamp: new Date(),
    });
    messages.push({
      id: nextId(),
      role: "ai",
      content: `안녕하세요. 선택하신 내용(${summary})을 확인했습니다. 추가로 궁금한 점을 자유롭게 입력해 주세요.\n\nkds-web 기능 범위 내에서 안내해 드리며, 주문·계정·직원 데이터의 직접 변경은 수행하지 않습니다.`,
      timestamp: new Date(),
    });
  } else if (status === "AI") {
    messages.push({
      id: nextId(),
      role: "ai",
      content:
        "안녕하세요, AI 상담 도우미입니다. 궁금한 점을 자유롭게 입력해 주세요.\n\nkds-web 기능 범위 내에서 안내해 드리며, 주문·계정·직원 데이터의 직접 변경은 수행하지 않습니다.",
      timestamp: new Date(),
    });
  } else if (status === "WAITING_AGENT") {
    const summary = path.length > 0 ? buildPathSummary(path) : "";
    messages.push({
      id: nextId(),
      role: "system",
      content: summary
        ? `상담원에게 다음 내용을 전달하고 연결합니다.\n선택 경로: ${summary}`
        : "상담원 연결을 요청합니다.",
      timestamp: new Date(),
    });
    messages.push({
      id: nextId(),
      role: "system",
      content: "상담원 연결 대기 중입니다. 이전 상담 내용은 상담원에게 함께 전달됩니다.",
      timestamp: new Date(),
    });
  }

  return messages;
}

// Simulated AI responses
const AI_RESPONSES: string[] = [
  "말씀하신 내용을 확인했습니다. 설정 메뉴에서 해당 항목을 먼저 확인해 보시겠어요?",
  "kds-web 기능 기준으로 안내해 드릴게요. 조금 더 구체적으로 설명해 주시면 더 정확하게 안내 가능합니다.",
  "해당 문제는 권한 설정과 관련이 있을 수 있습니다. 매니저 계정으로 확인이 필요합니다.",
  "직접 데이터 변경은 지원하지 않지만, 화면에서 처리하는 방법을 안내해 드릴 수 있습니다.",
  "이 문제는 상담원 연결이 필요한 경우일 수 있습니다. 상담원 연결을 원하시면 아래 버튼을 눌러주세요.",
];
let _aiIdx = 0;
function getNextAIResponse(): string {
  const res = AI_RESPONSES[_aiIdx % AI_RESPONSES.length];
  _aiIdx += 1;
  return res;
}

export function ChatSession({
  initialPath,
  initialStatus,
  onBack,
  onResolveFromChat,
}: ChatSessionProps) {
  const [status, setStatus] = useState<ChatSessionStatus>(initialStatus);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    buildInitialMessages(initialPath, initialStatus)
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Simulate agent connection after 3 seconds when WAITING_AGENT
  useEffect(() => {
    if (status !== "WAITING_AGENT") return;
    const timer = setTimeout(() => {
      setStatus("AGENT");
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "system",
          content: "상담원이 연결되었습니다.",
          timestamp: new Date(),
        },
      ]);
    }, 3000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(msg: Omit<ChatMessage, "id" | "timestamp">) {
    const full: ChatMessage = { ...msg, id: nextId(), timestamp: new Date() };
    setMessages((prev) => [...prev, full]);
    return full;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || status === "CLOSED") return;
    setInput("");
    setSending(true);

    addMessage({ role: "user", content: text });

    if (status === "AI") {
      // Simulate AI thinking
      await new Promise((r) => setTimeout(r, 900));
      addMessage({ role: "ai", content: getNextAIResponse() });
    } else if (status === "AGENT") {
      // Simulate agent reply
      await new Promise((r) => setTimeout(r, 1200));
      addMessage({
        role: "agent",
        content: "확인했습니다. 조금 더 상세히 확인 후 안내해 드리겠습니다.",
      });
    }
    // WAITING_AGENT: queued until agent connects

    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleConnectAgent() {
    if (status === "AI") {
      setStatus("WAITING_AGENT");
      addMessage({
        role: "system",
        content: "상담원에게 지금까지 확인한 내용을 전달하고 연결합니다.",
      });
      setTimeout(() => {
        setStatus("AGENT");
        addMessage({
          role: "system",
          content: "상담원이 연결되었습니다.",
        });
      }, 3000);
    }
  }

  function handleClose() {
    setStatus("CLOSED");
    addMessage({
      role: "system",
      content: "상담이 종료되었습니다. 같은 문제가 다시 발생하면 고객지원 탭에서 다시 문의해 주세요.",
    });
    setTimeout(() => {
      onResolveFromChat();
    }, 2000);
  }

  const canInput = status === "AI" || status === "AGENT" || status === "WAITING_AGENT" || status === "CLOSED";
  const inputDisabled = status === "CLOSED";
  const showAgentButton = status === "AI";
  const showCloseButton = status === "AGENT" || status === "AI";

  return (
    <div className="support-chat">
      {/* Chat header */}
      <div className="support-chat-header">
        <button
          className="support-chat-back kds-icon-btn"
          onClick={onBack}
          type="button"
          aria-label="뒤로"
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </button>

        <div className="support-chat-title">
          {status === "AI" || status === "BOT" ? (
            <Bot size={15} aria-hidden="true" />
          ) : (
            <Headphones size={15} aria-hidden="true" />
          )}
          <span>
            {status === "AI" ? "AI 상담" : status === "WAITING_AGENT" ? "상담원 연결 대기" : status === "AGENT" ? "상담원 상담" : "상담"}
          </span>
        </div>

        <span className={`support-chat-status ${STATUS_CLASSES[status]}`}>
          {status === "WAITING_AGENT" ? (
            <Loader size={11} aria-hidden="true" className="support-status-spin" />
          ) : null}
          {STATUS_LABELS[status]}
        </span>

        <div className="support-chat-actions">
          {showAgentButton ? (
            <button
              className="kds-btn-ghost kds-btn-xs"
              onClick={handleConnectAgent}
              type="button"
            >
              <Headphones size={12} aria-hidden="true" />
              상담원 연결
            </button>
          ) : null}
          {showCloseButton ? (
            <button
              className="kds-icon-btn"
              aria-label="상담 종료"
              onClick={handleClose}
              title="상담 종료"
              type="button"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Message list */}
      <div className="support-chat-messages" role="log" aria-live="polite">
        {messages.map((msg) => {
          if (msg.role === "system") {
            return (
              <div key={msg.id} className="support-msg-system">
                <span>{msg.content}</span>
                <time className="support-msg-time">{formatTime(msg.timestamp)}</time>
              </div>
            );
          }
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="support-msg support-msg--user">
                <div className="support-msg-bubble">
                  {msg.content.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <div className="support-msg-meta">
                  <User size={12} aria-hidden="true" />
                  <time className="support-msg-time">{formatTime(msg.timestamp)}</time>
                </div>
              </div>
            );
          }
          if (msg.role === "ai") {
            return (
              <div key={msg.id} className="support-msg support-msg--ai">
                <div className="support-msg-avatar support-msg-avatar--ai">
                  <Bot size={13} aria-hidden="true" />
                </div>
                <div className="support-msg-body">
                  <div className="support-msg-bubble">
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  <time className="support-msg-time">{formatTime(msg.timestamp)}</time>
                </div>
              </div>
            );
          }
          if (msg.role === "agent") {
            return (
              <div key={msg.id} className="support-msg support-msg--agent">
                <div className="support-msg-avatar support-msg-avatar--agent">
                  <Headphones size={13} aria-hidden="true" />
                </div>
                <div className="support-msg-body">
                  <div className="support-msg-bubble">
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  <time className="support-msg-time">{formatTime(msg.timestamp)}</time>
                </div>
              </div>
            );
          }
          return null;
        })}

        {sending && (status === "AI" || status === "AGENT") ? (
          <div className="support-msg support-msg--ai">
            <div className={`support-msg-avatar ${status === "AGENT" ? "support-msg-avatar--agent" : "support-msg-avatar--ai"}`}>
              {status === "AGENT" ? (
                <Headphones size={13} aria-hidden="true" />
              ) : (
                <Bot size={13} aria-hidden="true" />
              )}
            </div>
            <div className="support-msg-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {canInput ? (
        <div className="support-chat-input-area">
          <textarea
            ref={textareaRef}
            className="support-chat-textarea"
            disabled={sending || inputDisabled}
            onKeyDown={handleKeyDown}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              status === "WAITING_AGENT"
                ? "상담원 연결 대기 중입니다. 메시지를 입력해 두실 수 있습니다."
                : "메시지를 입력하세요..."
            }
            rows={2}
            value={input}
          />
          <button
            aria-label="보내기"
            className="support-chat-send"
            disabled={!input.trim() || sending || inputDisabled}
            onClick={() => void handleSend()}
            type="button"
          >
            <Send size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {status === "CLOSED" ? (
        <div className="support-chat-closed">
          <p>상담이 종료되었습니다.</p>
          <button className="btn-outline kds-btn-sm" onClick={onBack} type="button">
            처음으로 돌아가기
          </button>
        </div>
      ) : null}
    </div>
  );
}
