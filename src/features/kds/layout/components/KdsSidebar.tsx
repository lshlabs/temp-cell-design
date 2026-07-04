import { ClipboardList, HelpCircle, Menu, Users, X } from "lucide-react";

import type { AuthSession } from "../../../../types";
import type { BoardTab } from "../../../../types/kds";
import { KdsAccountMenu } from "./KdsAccountMenu";

type KdsSidebarProps = {
  activeOrderCount: number;
  activeTab: BoardTab;
  isManager: boolean;
  loggingOut: boolean;
  open: boolean;
  session: AuthSession;
  onLogout: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: BoardTab) => void;
};

export function KdsSidebar({
  activeOrderCount,
  activeTab,
  isManager,
  loggingOut,
  open,
  session,
  onLogout,
  onOpenChange,
  onTabChange,
}: KdsSidebarProps) {
  return (
    <nav className={`kds-sidebar${open ? " open" : ""}`} aria-label="메인 내비게이션">
      <button
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        className="kds-sidebar-toggle"
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
        {open ? <span className="kds-sidebar-toggle-label">닫기</span> : null}
      </button>

      <div className="kds-sidebar-nav">
        <button
          className={`kds-sidebar-item${activeTab === "MY_TASKS" ? " active" : ""}`}
          onClick={() => {
            onTabChange("MY_TASKS");
            onOpenChange(false);
          }}
          type="button"
          title="내 업무"
        >
          <ClipboardList size={16} aria-hidden="true" />
          {open ? (
            <span>
              내 업무
              {activeOrderCount > 0 ? <em className="kds-sidebar-badge">{activeOrderCount}</em> : null}
            </span>
          ) : null}
          {!open && activeOrderCount > 0 ? <em className="kds-sidebar-dot" aria-hidden="true" /> : null}
        </button>

        {isManager ? (
          <button
            className={`kds-sidebar-item${activeTab === "STAFF" ? " active" : ""}`}
            onClick={() => {
              onTabChange("STAFF");
              onOpenChange(false);
            }}
            type="button"
            title="직원"
          >
            <Users size={16} aria-hidden="true" />
            {open ? <span>직원</span> : null}
          </button>
        ) : null}

        <button
          className={`kds-sidebar-item${activeTab === "SUPPORT" ? " active" : ""}`}
          onClick={() => {
            onTabChange("SUPPORT");
            onOpenChange(false);
          }}
          type="button"
          title="고객지원"
        >
          <HelpCircle size={16} aria-hidden="true" />
          {open ? <span>고객지원</span> : null}
        </button>
      </div>

      <KdsAccountMenu
        loggingOut={loggingOut}
        session={session}
        sidebarOpen={open}
        onLogout={onLogout}
      />
    </nav>
  );
}
