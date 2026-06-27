import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import type { StoreStatus } from "../../../../types/kds";
import { StoreStatusDot } from "./StoreStatusDot";

type StoreStatusControlProps = {
  pauseMinutes: number;
  saving: boolean;
  status: StoreStatus;
  onConfirmPaused: () => Promise<void>;
  onPauseMinutesChange: (updater: (minutes: number) => number) => void;
  onStatusChange: (status: StoreStatus) => Promise<void>;
};

export function StoreStatusControl({
  pauseMinutes,
  saving,
  status,
  onConfirmPaused,
  onPauseMinutesChange,
  onStatusChange,
}: StoreStatusControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={rootRef}>
      <button
        className={`kds-store-status kds-store-status--${status.toLowerCase()}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-label="매장 상태 변경"
      >
        <StoreStatusDot status={status} />
        {status === "OPEN" ? "영업중" : status === "PAUSED" ? "일시중지" : "영업종료"}
      </button>

      {open ? (
        <div className="kds-store-status-popup" role="dialog" aria-modal="true" aria-label="매장 상태 변경">
          <p className="kds-store-status-popup-title">매장 상태</p>
          {(["OPEN", "PAUSED", "CLOSED"] as StoreStatus[]).map((nextStatus) => (
            <button
              key={nextStatus}
              className={`kds-store-status-popup-btn${status === nextStatus ? " active" : ""}`}
              onClick={() => void onStatusChange(nextStatus)}
              type="button"
            >
              <StoreStatusDot status={nextStatus} />
              {nextStatus === "OPEN" ? "영업중" : nextStatus === "PAUSED" ? "일시중지" : "영업종료"}
            </button>
          ))}
          {status === "PAUSED" ? (
            <div className="kds-pause-duration">
              <span className="kds-pause-duration-label">일시중지 시간</span>
              <div className="kds-pause-duration-control">
                <button
                  className="kds-pause-stepper"
                  onClick={() => onPauseMinutesChange((minutes) => Math.max(10, minutes - 10))}
                  type="button"
                  aria-label="10분 감소"
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <span className="kds-pause-duration-value">{pauseMinutes}분</span>
                <button
                  className="kds-pause-stepper"
                  onClick={() => onPauseMinutesChange((minutes) => minutes + 10)}
                  type="button"
                  aria-label="10분 증가"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
              <button
                className="kds-pause-confirm"
                disabled={saving}
                onClick={() => void onConfirmPaused()}
                type="button"
              >{saving ? "저장 중…" : "확인"}</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
