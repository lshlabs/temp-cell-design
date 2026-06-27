import { Info, Trash2 } from "lucide-react";

type OrderContextMenuProps = {
  contextMenu: { orderId: number; x: number; y: number } | null;
  onOpenDetail: (orderId: number) => void;
  onOpenRemove: (orderId: number) => void;
};

export function OrderContextMenu({
  contextMenu,
  onOpenDetail,
  onOpenRemove,
}: OrderContextMenuProps) {
  if (!contextMenu) return null;

  return (
    <div
      className="kds-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      role="menu"
    >
      <button
        className="kds-context-menu-item"
        onClick={() => onOpenDetail(contextMenu.orderId)}
        role="menuitem"
        type="button"
      >
        <Info size={13} aria-hidden="true" />
        상세정보
      </button>
      <button
        className="kds-context-menu-item danger"
        onClick={() => onOpenRemove(contextMenu.orderId)}
        role="menuitem"
        type="button"
      >
        <Trash2 size={13} aria-hidden="true" />
        제거
      </button>
    </div>
  );
}
