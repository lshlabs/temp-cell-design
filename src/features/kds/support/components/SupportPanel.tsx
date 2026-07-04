import { useState } from "react";
import { Bot, CheckCircle, Headphones, LifeBuoy, MessageCircle } from "lucide-react";

import type { ChatSessionStatus, QnaPathEntry, SupportView } from "../types/support";
import { ChatSession } from "./ChatSession";
import { FaqSection } from "./FaqSection";
import { QnaFlow } from "./QnaFlow";

type SupportScreen =
  | { view: "home" }
  | { view: "faq" }
  | { view: "qna" }
  | { view: "chat"; status: ChatSessionStatus; path: QnaPathEntry[] }
  | { view: "resolved" };

export function SupportPanel() {
  const [screen, setScreen] = useState<SupportScreen>({ view: "home" });

  function goHome() {
    setScreen({ view: "home" });
  }

  function handleAskAI(context: string) {
    const path: QnaPathEntry[] = context
      ? [{ stepId: "faq", question: "FAQ", selectedOptionLabel: context }]
      : [];
    setScreen({ view: "chat", status: "AI", path });
  }

  function handleSwitchToAI(path: QnaPathEntry[]) {
    setScreen({ view: "chat", status: "AI", path });
  }

  function handleConnectAgent(path: QnaPathEntry[]) {
    setScreen({ view: "chat", status: "WAITING_AGENT", path });
  }

  function handleResolved() {
    setScreen({ view: "resolved" });
  }

  // ── Chat view ──────────────────────────────────────
  if (screen.view === "chat") {
    return (
      <div className="support-panel">
        <ChatSession
          initialPath={screen.path}
          initialStatus={screen.status}
          onBack={goHome}
          onResolveFromChat={handleResolved}
        />
      </div>
    );
  }

  // ── Resolved view ──────────────────────────────────
  if (screen.view === "resolved") {
    return (
      <div className="support-panel support-panel--center">
        <div className="support-resolved">
          <CheckCircle size={40} className="support-resolved-icon" aria-hidden="true" />
          <h2>문제가 해결되었나요?</h2>
          <p>같은 문제가 다시 발생하면 고객지원 탭에서 다시 문의해 주세요.</p>
          <button className="btn-outline kds-btn-sm" onClick={goHome} type="button">
            처음으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ── Two-column layout: left sidebar + right panel ──
  return (
    <div className="support-panel support-panel--split">
      {/* Left sidebar — always visible */}
      <aside className="support-sidebar">
        <div className="support-sidebar-brand">
          <LifeBuoy size={18} aria-hidden="true" />
          <span>고객지원</span>
        </div>

        <nav className="support-sidebar-nav" aria-label="지원 메뉴">
          <button
            className={`support-sidebar-item${screen.view === "home" || screen.view === "faq" ? " active" : ""}`}
            onClick={() => setScreen({ view: "faq" })}
            type="button"
          >
            <MessageCircle size={15} aria-hidden="true" />
            자주 묻는 질문
          </button>
          <button
            className={`support-sidebar-item${screen.view === "qna" ? " active" : ""}`}
            onClick={() => setScreen({ view: "qna" })}
            type="button"
          >
            <LifeBuoy size={15} aria-hidden="true" />
            단계별 문제 해결
          </button>
        </nav>

        <div className="support-sidebar-quick">
          <p className="support-sidebar-quick-label">빠른 연결</p>
          <button
            className="support-quick-btn support-quick-btn--ai"
            onClick={() => handleSwitchToAI([])}
            type="button"
          >
            <Bot size={14} aria-hidden="true" />
            <span>
              <strong>AI 상담</strong>
              <em>자유 질문</em>
            </span>
          </button>
          <button
            className="support-quick-btn support-quick-btn--agent"
            onClick={() => handleConnectAgent([])}
            type="button"
          >
            <Headphones size={14} aria-hidden="true" />
            <span>
              <strong>상담원 연결</strong>
              <em>직원과 상담</em>
            </span>
          </button>
        </div>
      </aside>

      {/* Right content area */}
      <main className="support-content" aria-label="지원 내용">
        {screen.view === "home" || screen.view === "faq" ? (
          <>
            <div className="support-content-header">
              <h1 className="support-content-title">자주 묻는 질문</h1>
              <p className="support-content-desc">
                카테고리를 선택해 자주 묻는 질문을 찾아보세요. 해결되지 않으면 AI 상담 또는 상담원 연결을 이용하세요.
              </p>
            </div>
            <FaqSection onAskAI={handleAskAI} />
          </>
        ) : screen.view === "qna" ? (
          <>
            <div className="support-content-header">
              <h1 className="support-content-title">단계별 문제 해결</h1>
              <p className="support-content-desc">
                문제 유형을 선택하면 원인과 해결 방법을 단계적으로 안내합니다.
              </p>
            </div>
            <QnaFlow
              onSwitchToAI={handleSwitchToAI}
              onConnectAgent={handleConnectAgent}
              onResolved={handleResolved}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
