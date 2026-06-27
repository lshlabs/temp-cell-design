import { X } from "lucide-react";

import {
  formatDetailTime,
  getOrderTypeLabel,
} from "../lib/orderFormatters";
import type { AuthSession, Order } from "../../../../types";

type OrderDetailModalProps = {
  order: Order | null;
  store: AuthSession["store"];
  onClose: () => void;
};

export function OrderDetailModal({
  order,
  store,
  onClose,
}: OrderDetailModalProps) {
  if (!order) return null;

  const totalAmount = order.items.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const orderedTime = order.ordered_at
    ? formatDetailTime(order.ordered_at)
    : formatDetailTime(order.created_at);
  const platformLabel = getOrderTypeLabel(order.platform);
  const deliveryAddress = `${store.roadAddress ?? store.jibunAddress ?? "-"}${store.addressDetail ? ` ${store.addressDetail}` : ""}`;

  return (
    <div className="kds-modal-backdrop" onClick={onClose}>
      <div className="kds-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="주문 상세정보">
        <div className="kds-modal-head">
          <h2 className="kds-modal-title">주문 #{order.order_number ?? order.id}</h2>
          <button className="kds-modal-close" onClick={onClose} type="button" aria-label="닫기">
            <X size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="kds-modal-body">
          <div className="kds-detail-summary" aria-label="주문 요약">
            <span>{orderedTime}</span>
            <span aria-hidden="true">·</span>
            <span>{platformLabel}</span>
            {totalAmount > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <strong>{totalAmount.toLocaleString()}원</strong>
              </>
            ) : null}
          </div>
          <section className="kds-detail-section" aria-labelledby="kds-detail-menu-title">
            <div className="kds-detail-section-head">
              <div className="kds-detail-section-label" id="kds-detail-menu-title">주문 메뉴</div>
              <div className="kds-detail-section-meta">{order.items.length}개</div>
            </div>
            <div className="kds-detail-items">
              {order.items.map((item) => (
                <div className="kds-detail-item" key={item.id}>
                  <span className="kds-detail-item-qty">{item.quantity}</span>
                  <div className="kds-detail-item-main">
                    <div className="kds-detail-item-name">{item.name}</div>
                    {item.options.length > 0 ? (
                      <ul className="kds-detail-item-options">
                        {item.options.map((opt, i) => <li key={i}>{opt}</li>)}
                      </ul>
                    ) : null}
                  </div>
                  {item.total_price ? (
                    <span className="kds-detail-item-price">{item.total_price.toLocaleString()}원</span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
          <section className="kds-detail-section" aria-labelledby="kds-detail-request-title">
            <div className="kds-detail-section-head">
              <div className="kds-detail-section-label" id="kds-detail-request-title">요청사항</div>
            </div>
            <p className={`kds-detail-text${order.customer_request ? "" : " empty"}`}>
              {order.customer_request?.trim() || "없음"}
            </p>
          </section>
          {order.delivery_request ? (
            <section className="kds-detail-section" aria-labelledby="kds-detail-delivery-request-title">
              <div className="kds-detail-section-head">
                <div className="kds-detail-section-label" id="kds-detail-delivery-request-title">배달 요청</div>
              </div>
              <p className="kds-detail-text">{order.delivery_request}</p>
            </section>
          ) : null}
          <section className="kds-detail-section" aria-labelledby="kds-detail-delivery-title">
            <div className="kds-detail-section-head">
              <div className="kds-detail-section-label" id="kds-detail-delivery-title">배송 정보</div>
            </div>
            <div className="kds-detail-rows">
              <div className="kds-detail-row">
                <span>주소</span>
                <strong>{deliveryAddress}</strong>
              </div>
              <div className="kds-detail-row">
                <span>연락처</span>
                <strong>{store.phone ?? "-"}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
