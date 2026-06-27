import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

import type { AuthSession } from "../../../../types";

type KdsAccountMenuProps = {
  loggingOut: boolean;
  session: AuthSession;
  sidebarOpen: boolean;
  onLogout: () => Promise<void>;
};

export function KdsAccountMenu({
  loggingOut,
  session,
  sidebarOpen,
  onLogout,
}: KdsAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const initials = (session.user.name ?? session.store.storeName ?? "?").slice(0, 2).toUpperCase();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await onLogout();
  }

  return (
    <div className="kds-sidebar-account" ref={accountRef}>
      {open ? (
        <div className="kds-account-popover">
          <div className="kds-account-popover-info">
            <div className="kds-account-avatar large">{initials}</div>
            <div>
              <p className="kds-account-name">{session.user.name ?? session.store.storeName}</p>
              <p className="kds-account-login-id">{session.user.loginId}</p>
            </div>
          </div>
          <div className="kds-account-popover-divider" />
          <button
            className="kds-account-popover-item signout"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            type="button"
          >
            <LogOut size={14} aria-hidden="true" />
            {loggingOut ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      ) : null}

      <button
        className={`kds-account-trigger${open ? " active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
        title={session.store.storeName}
        aria-expanded={open}
      >
        <div className="kds-account-avatar">{initials}</div>
        {sidebarOpen ? <span className="kds-account-trigger-name">{session.store.storeName}</span> : null}
      </button>
    </div>
  );
}
