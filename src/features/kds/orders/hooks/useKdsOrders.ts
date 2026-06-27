import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  apiArchiveCompletedOrders,
  apiGetKdsOrders,
  apiHideOrder,
  apiUpdateOrderItemProgress,
  apiUpdateOrderStatus,
} from "../../../../lib/api";
import {
  getDoneOrders,
  getOrderCounts,
  getReceivedOrders,
  getVisibleOrders,
} from "../lib/orderSelectors";
import { requestWithReauth } from "../../../../shared/lib/requestWithReauth";
import type { Order, OrderStatus } from "../../../../types";
import type { OrderSortDirection } from "../../../../types/kds";
import type { ShowToast } from "../../../../shared/hooks/useToast";

const POLLING_INTERVAL_MS = 3000;

type UseKdsOrdersParams = {
  accessToken: string;
  onUnauthorized: () => Promise<string | null>;
  showToast: ShowToast;
};

export function useKdsOrders({
  accessToken,
  onUnauthorized,
  showToast,
}: UseKdsOrdersParams) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [updatingOrderItemId, setUpdatingOrderItemId] = useState<number | null>(null);
  const [hidingOrderId, setHidingOrderId] = useState<number | null>(null);
  const [archivingCompleted, setArchivingCompleted] = useState(false);
  const [orderSortDirection, setOrderSortDirection] = useState<OrderSortDirection>("newest-first");

  const refreshOrders = useCallback(async () => {
    try {
      const data = await requestWithReauth(accessToken, onUnauthorized, apiGetKdsOrders);
      setOrders(data.orders);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showToast("로그인이 만료되었습니다.");
        return;
      }
      showToast(error instanceof Error ? error.message : "주문 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, onUnauthorized, showToast]);

  useEffect(() => {
    void refreshOrders();
    const pollingTimer = window.setInterval(() => {
      void refreshOrders();
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(pollingTimer);
    };
  }, [refreshOrders]);

  async function runManualRefresh(task: () => Promise<void>) {
    setRefreshing(true);
    try {
      await task();
    } finally {
      window.setTimeout(() => setRefreshing(false), 600);
    }
  }

  const boardOrders = useMemo(
    () => getVisibleOrders(orders),
    [orders],
  );

  const receivedOrders = useMemo(
    () => getReceivedOrders(boardOrders, orderSortDirection),
    [boardOrders, orderSortDirection],
  );

  const doneOrders = useMemo(
    () => getDoneOrders(boardOrders, orderSortDirection),
    [boardOrders, orderSortDirection],
  );

  const counts = useMemo(
    () => getOrderCounts(boardOrders),
    [boardOrders],
  );

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    try {
      await requestWithReauth(accessToken, onUnauthorized, (nextAccessToken) =>
        apiUpdateOrderStatus(nextAccessToken, orderId, status),
      );
      await refreshOrders();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "주문 상태를 변경하지 못했습니다.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function toggleOrderItemDone(itemId: number, nextDone: boolean) {
    setUpdatingOrderItemId(itemId);
    try {
      await requestWithReauth(accessToken, onUnauthorized, (nextAccessToken) =>
        apiUpdateOrderItemProgress(nextAccessToken, itemId, { done: nextDone }),
      );
      await refreshOrders();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "메뉴 완료 상태를 저장하지 못했습니다.");
    } finally {
      setUpdatingOrderItemId(null);
    }
  }

  async function hideOrder(orderId: number) {
    setHidingOrderId(orderId);
    try {
      await requestWithReauth(accessToken, onUnauthorized, (nextAccessToken) =>
        apiHideOrder(nextAccessToken, orderId),
      );
      await refreshOrders();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "주문을 숨기지 못했습니다.");
      return false;
    } finally {
      setHidingOrderId(null);
    }
  }

  async function archiveCompletedOrders() {
    setArchivingCompleted(true);
    try {
      const result = await requestWithReauth(accessToken, onUnauthorized, (nextAccessToken) =>
        apiArchiveCompletedOrders(nextAccessToken),
      );
      await refreshOrders();
      showToast(
        result.archivedCount > 0 ? `완료 주문 ${result.archivedCount}건을 정리했습니다.` : "정리할 완료 주문이 없습니다.",
        "info",
      );
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "완료 주문을 정리하지 못했습니다.");
      return false;
    } finally {
      setArchivingCompleted(false);
    }
  }

  return {
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
  };
}
