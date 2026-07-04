import { useEffect, useState } from "react";

import { ClearCompletedDialog } from "../features/kds/orders/components/ClearCompletedDialog";
import { OrderBoard } from "../features/kds/orders/components/OrderBoard";
import { OrderContextMenu } from "../features/kds/orders/components/OrderContextMenu";
import { OrderDetailModal } from "../features/kds/orders/components/OrderDetailModal";
import { RemoveOrderDialog } from "../features/kds/orders/components/RemoveOrderDialog";
import { KdsToast } from "../shared/components/KdsToast";
import { KdsSidebar } from "../features/kds/layout/components/KdsSidebar";
import { ChangePasswordModal } from "../features/kds/settings/components/ChangePasswordModal";
import { KdsTopbar } from "../features/kds/layout/components/KdsTopbar";
import { SettingsPanel } from "../features/kds/settings/components/SettingsPanel";
import { StaffPanel } from "../features/kds/staff/components/StaffPanel";
import { StatsPanel } from "../features/kds/stats/components/StatsPanel";
import { MyTasksPanel } from "../features/kds/tasks/components/MyTasksPanel";
import { SupportPanel } from "../features/kds/support/components/SupportPanel";
import { ChatbotFab } from "../features/kds/support/components/ChatbotFab";
import { useAssignedMenus } from "../features/kds/tasks/hooks/useAssignedMenus";
import { useKdsClock } from "../shared/hooks/useKdsClock";
import { useKdsOrders } from "../features/kds/orders/hooks/useKdsOrders";
import { useKdsSettings } from "../features/kds/settings/hooks/useKdsSettings";
import { useStoreContext } from "../features/kds/store-status/hooks/useStoreContext";
import { useToast } from "../shared/hooks/useToast";
import type { AuthSession } from "../types";
import type { BoardTab } from "../types/kds";

type KdsPageProps = {
  session: AuthSession;
  onLogout: () => Promise<void>;
  onUnauthorized: () => Promise<string | null>;
};

export function KdsPage({ session, onLogout, onUnauthorized }: KdsPageProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<BoardTab>("MY_TASKS");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ orderId: number; x: number; y: number } | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [removeOrderId, setRemoveOrderId] = useState<number | null>(null);
  const [clearDoneConfirm, setClearDoneConfirm] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const { hideToast, showToast, toast } = useToast();
  const now = useKdsClock();
  const {
    archiveCompletedOrders,
    archivingCompleted,
    boardOrders,
    counts,
    doneOrders,
    hideOrder,
    hidingOrderId,
    loading,
    orderSortDirection,
    orders,
    receivedOrders,
    refreshOrders,
    refreshing,
    runManualRefresh,
    setOrderSortDirection,
    toggleOrderItemDone,
    updateOrderStatus,
    updatingOrderId,
    updatingOrderItemId,
  } = useKdsOrders({
    accessToken: session.accessToken,
    onUnauthorized,
    showToast,
  });
  const {
    assignedMenus,
    createAssignedMenu,
    deleteAssignedMenu,
    loading: assignedMenusLoading,
    refreshAssignedMenus,
    saving: assignedMenusSaving,
    updateAssignedMenu,
  } = useAssignedMenus({
    accessToken: session.accessToken,
    onUnauthorized,
    showToast,
  });
  const {
    loading: storeSettingsLoading,
    refreshSettings,
    saving: savingSettings,
    settings,
    updateSettings,
  } = useKdsSettings({
    accessToken: session.accessToken,
    onUnauthorized,
    showToast,
  });
  const {
    changeStoreStatus,
    confirmStoreStatusChange,
    pauseMinutes,
    refreshStoreContext,
    savingStoreStatus,
    setPauseMinutes,
    storeStatus,
  } = useStoreContext({
    accessToken: session.accessToken,
    onUnauthorized,
    showToast,
  });

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Element;
      if (!target.closest(".kds-context-menu")) {
        setContextMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  function openChangePasswordModal() {
    setPwModal(true);
  }

  function handleRefreshAll() {
    return runManualRefresh(() =>
      Promise.all([
        refreshOrders(),
        refreshStoreContext(),
        refreshSettings(),
        refreshAssignedMenus(),
      ]).then(() => undefined)
    );
  }

  function handleTopbarTabChange(tab: BoardTab) {
    setActiveTab(tab);
    if (tab === "MY_TASKS" || tab === "STAFF" || tab === "STATS" || tab === "SETTINGS" || tab === "RECEIVED" || tab === "SUPPORT") {
      setSidebarOpen(false);
    }
  }

  function handleOpenOrderDetail(orderId: number) {
    setDetailOrderId(orderId);
    setContextMenu(null);
  }

  function handleOpenRemoveOrder(orderId: number) {
    setRemoveOrderId(orderId);
    setContextMenu(null);
  }

  function handleConfirmRemoveOrder() {
    if (removeOrderId === null) {
      return;
    }
    void hideOrder(removeOrderId).then((success) => {
      if (success) {
        setRemoveOrderId(null);
        setContextMenu(null);
      }
    });
  }

  function handleConfirmClearCompleted() {
    void archiveCompletedOrders().then((success) => {
      if (success) {
        setClearDoneConfirm(false);
      }
    });
  }

  const isManager = session.user.accountType !== "EMPLOYEE";
  const activeOrders = activeTab === "RECEIVED" ? receivedOrders : doneOrders;
  const selectedOrder = detailOrderId !== null
    ? orders.find((order) => order.id === detailOrderId) ?? null
    : null;
  const settingsDisabled = storeSettingsLoading || savingSettings;

  return (
    <div className="kds-shell">
      <KdsSidebar
        activeOrderCount={counts.NEW + counts.COOKING}
        activeTab={activeTab}
        isManager={isManager}
        loggingOut={loggingOut}
        open={sidebarOpen}
        session={session}
        onLogout={handleLogout}
        onOpenChange={setSidebarOpen}
        onTabChange={setActiveTab}
      />

      <div className="kds-main">
        <KdsTopbar
          activeTab={activeTab}
          archivingCompleted={archivingCompleted}
          doneCount={doneOrders.length}
          loading={loading}
          orderSortDirection={orderSortDirection}
          pauseMinutes={pauseMinutes}
          receivedCount={receivedOrders.length}
          refreshing={refreshing}
          savingStoreStatus={savingStoreStatus}
          storeStatus={storeStatus}
          onArchiveClick={() => setClearDoneConfirm(true)}
          onConfirmPaused={confirmStoreStatusChange}
          onPauseMinutesChange={(updater) => setPauseMinutes(updater)}
          onRefresh={handleRefreshAll}
          onSortToggle={() => setOrderSortDirection(
            orderSortDirection === "newest-first" ? "oldest-first" : "newest-first",
          )}
          onStatusChange={changeStoreStatus}
          onTabChange={handleTopbarTabChange}
        />

        {counts.CANCELLED > 0 ? (
          <div className="kds-notice-bar">취소 주문 {counts.CANCELLED}건은 보드에서 제외되어 집계로만 관리됩니다.</div>
        ) : null}

        {activeTab === "MY_TASKS" ? (
          <div className="kds-panel-shell">
            <MyTasksPanel
              assignedMenus={assignedMenus}
              loading={assignedMenusLoading}
              now={now}
              onCreateAssignedMenu={createAssignedMenu}
              onDeleteAssignedMenu={deleteAssignedMenu}
              onUpdateAssignedMenu={updateAssignedMenu}
              orders={boardOrders}
              saving={assignedMenusSaving}
            />
          </div>
        ) : activeTab === "STAFF" && isManager ? (
          <div className="kds-panel-shell">
            <StaffPanel onUnauthorized={onUnauthorized} session={session} />
          </div>
        ) : activeTab === "STATS" ? (
          <StatsPanel orders={orders} />
        ) : activeTab === "SETTINGS" ? (
          <div className="kds-panel-shell">
            <SettingsPanel
              settings={settings}
              onUpdate={updateSettings}
              onChangePasswordClick={openChangePasswordModal}
              disabled={settingsDisabled}
            />
          </div>
        ) : activeTab === "SUPPORT" ? (
          <div className="kds-panel-shell">
            <SupportPanel />
            <ChatbotFab />
          </div>
        ) : (
          <OrderBoard
            orders={activeOrders}
            loading={loading}
            now={now}
            refreshing={refreshing}
            updatingOrderId={updatingOrderId}
            updatingItemId={updatingOrderItemId}
            emptyMessage={activeTab === "RECEIVED" ? "접수된 주문이 없습니다" : "완료된 주문이 없습니다"}
            onRefresh={handleRefreshAll}
            onUpdateStatus={updateOrderStatus}
            onToggleItemDone={toggleOrderItemDone}
            onOpenContextMenu={(orderId, x, y) => setContextMenu({ orderId, x, y })}
          />
        )}
      </div>

      <OrderContextMenu
        contextMenu={contextMenu}
        onOpenDetail={handleOpenOrderDetail}
        onOpenRemove={handleOpenRemoveOrder}
      />

      <OrderDetailModal
        order={selectedOrder}
        store={session.store}
        onClose={() => setDetailOrderId(null)}
      />

      <RemoveOrderDialog
        open={removeOrderId !== null}
        submitting={removeOrderId !== null && hidingOrderId === removeOrderId}
        onCancel={() => setRemoveOrderId(null)}
        onConfirm={handleConfirmRemoveOrder}
      />

      <ClearCompletedDialog
        open={clearDoneConfirm}
        submitting={archivingCompleted}
        onCancel={() => setClearDoneConfirm(false)}
        onConfirm={handleConfirmClearCompleted}
      />

      <ChangePasswordModal
        accessToken={session.accessToken}
        open={pwModal}
        onClose={() => setPwModal(false)}
        onLogout={onLogout}
        onUnauthorized={onUnauthorized}
        showToast={showToast}
      />

      <KdsToast toast={toast} onClose={hideToast} />
    </div>
  );
}
