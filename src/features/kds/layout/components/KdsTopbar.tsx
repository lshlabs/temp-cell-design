import { useEffect, useState } from "react";
import { ClockArrowDown, ClockArrowUp, RefreshCw, Trash2 } from "lucide-react";

import type { BoardTab, OrderSortDirection, StoreStatus } from "../../../../types/kds";
import { StoreStatusControl } from "../../store-status/components/StoreStatusControl";

type KdsTopbarProps = {
  activeTab: BoardTab;
  archivingCompleted: boolean;
  doneCount: number;
  loading: boolean;
  orderSortDirection: OrderSortDirection;
  pauseMinutes: number;
  receivedCount: number;
  refreshing: boolean;
  savingStoreStatus: boolean;
  storeStatus: StoreStatus;
  onArchiveClick: () => void;
  onConfirmPaused: () => Promise<void>;
  onPauseMinutesChange: (updater: (minutes: number) => number) => void;
  onRefresh: () => Promise<void>;
  onSortToggle: () => void;
  onStatusChange: (status: StoreStatus) => Promise<void>;
  onTabChange: (tab: BoardTab) => void;
};

export function KdsTopbar({
  activeTab,
  archivingCompleted,
  doneCount,
  loading,
  orderSortDirection,
  pauseMinutes,
  receivedCount,
  refreshing,
  savingStoreStatus,
  storeStatus,
  onArchiveClick,
  onConfirmPaused,
  onPauseMinutesChange,
  onRefresh,
  onSortToggle,
  onStatusChange,
  onTabChange,
}: KdsTopbarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const hideRefreshButton = isMobile && (activeTab === "RECEIVED" || activeTab === "DONE");

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 520px)");
    const updateIsMobile = () => setIsMobile(mobileQuery.matches);
    updateIsMobile();
    mobileQuery.addEventListener("change", updateIsMobile);
    return () => mobileQuery.removeEventListener("change", updateIsMobile);
  }, []);

  return (
    <header className="kds-topbar">
      <div className="kds-topbar-left">
        <StoreStatusControl
          pauseMinutes={pauseMinutes}
          saving={savingStoreStatus}
          status={storeStatus}
          onConfirmPaused={onConfirmPaused}
          onPauseMinutesChange={onPauseMinutesChange}
          onStatusChange={onStatusChange}
        />
      </div>

      {activeTab === "MY_TASKS" ? (
        <div className="kds-topbar-tabs" role="tablist">
          <button
            aria-selected={activeTab === "MY_TASKS"}
            className="kds-tab active"
            onClick={() => onTabChange("MY_TASKS")}
            role="tab"
            type="button"
          >
            내 업무
          </button>
        </div>
      ) : (
        <div className="kds-topbar-page-title">
          {activeTab === "STAFF" ? "직원 관리" : activeTab === "STATS" ? "통계" : "설정"}
        </div>
      )}

      <div className="kds-topbar-right">
        {activeTab === "DONE" && doneCount > 0 ? (
          <button
            aria-label="완료 주문 내역 정리"
            className="kds-icon-btn"
            disabled={archivingCompleted}
            onClick={onArchiveClick}
            title="완료 주문 정리"
            type="button"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        ) : null}
        <button
          aria-label={
            orderSortDirection === "newest-first"
              ? "현재 최신 주문 우선, 클릭하여 과거 주문 우선으로 변경"
              : "현재 과거 주문 우선, 클릭하여 최신 주문 우선으로 변경"
          }
          className="kds-icon-btn"
          onClick={onSortToggle}
          title={orderSortDirection === "newest-first" ? "최신 주문 우선" : "과거 주문 우선"}
          type="button"
        >
          {orderSortDirection === "newest-first" ? (
            <ClockArrowDown size={15} aria-hidden="true" />
          ) : (
            <ClockArrowUp size={15} aria-hidden="true" />
          )}
        </button>
        {!hideRefreshButton ? (
          <button
            aria-label="주문 새로고침"
            className={`kds-icon-btn${loading || refreshing ? " spinning" : ""}`}
            disabled={loading || refreshing}
            onClick={() => void onRefresh()}
            type="button"
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
