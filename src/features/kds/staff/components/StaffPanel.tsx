import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import {
  apiCreateStaff,
  apiGetStaff,
  apiRegenerateStaffPin,
  apiUpdateStaff,
  apiUpdateStaffActive,
} from "../../../../lib/api";
import { requestWithReauth } from "../../../../shared/lib/requestWithReauth";
import type { AuthSession, Staff } from "../../../../types";

type StaffModalMode =
  | { type: "add" }
  | { type: "edit"; member: Staff }
  | { type: "pin"; member: Staff }
  | { type: "deactivate"; member: Staff };

type StaffPanelProps = {
  session: AuthSession;
  onUnauthorized: () => Promise<string | null>;
};

export function StaffPanel({
  session,
  onUnauthorized,
}: StaffPanelProps) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<StaffModalMode | null>(null);
  const [form, setForm] = useState({ name: "", loginId: "", role: "직원" });
  const [formError, setFormError] = useState<string | null>(null);
  const [pinVisible, setPinVisible] = useState<number | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);

  function normalizeStaffIdentifier(value: string) {
    return value.trim().toLowerCase();
  }

  function isValidStaffIdentifier(value: string) {
    return /^[a-z0-9][a-z0-9._-]{3,31}$/.test(value);
  }

  const fetchStaff = useCallback(async () => {
    const data = await requestWithReauth(session.accessToken, onUnauthorized, apiGetStaff);
    setStaffList(data.staff);
  }, [onUnauthorized, session.accessToken]);

  useEffect(() => {
    void fetchStaff()
      .catch((error) => {
        setFormError(error instanceof Error ? error.message : "직원 목록을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [fetchStaff]);

  function openAdd() {
    setForm({ name: "", loginId: "", role: "직원" });
    setFormError(null);
    setModal({ type: "add" });
  }

  function openEdit(member: Staff) {
    setForm({ name: member.name, loginId: member.loginId, role: member.positionLabel ?? "직원" });
    setFormError(null);
    setModal({ type: "edit", member });
  }

  async function saveStaff() {
    if (!form.name.trim()) {
      setFormError("이름을 입력하세요.");
      return;
    }
    if (!isValidStaffIdentifier(form.loginId)) {
      setFormError("아이디는 영문 소문자, 숫자, ., _, - 만 사용해 4~32자로 입력해주세요.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const loginId = normalizeStaffIdentifier(form.loginId);
      if (modal?.type === "add") {
        const created = await requestWithReauth(session.accessToken, onUnauthorized, (accessToken) =>
          apiCreateStaff(accessToken, {
            name: form.name.trim(),
            loginId,
            positionLabel: form.role,
          }),
        );
        setPinVisible(created.id);
        setRevealedPin(created.temporaryPin);
      } else if (modal?.type === "edit") {
        await requestWithReauth(session.accessToken, onUnauthorized, (accessToken) =>
          apiUpdateStaff(accessToken, modal.member.id, {
            name: form.name.trim(),
            loginId,
            positionLabel: form.role,
          }),
        );
      }
      setModal(null);
      await fetchStaff();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function reissuePin(member: Staff) {
    setSaving(true);
    try {
      const result = await requestWithReauth(session.accessToken, onUnauthorized, (accessToken) =>
        apiRegenerateStaffPin(accessToken, member.id),
      );
      setPinVisible(member.id);
      setRevealedPin(result.temporaryPin);
      setModal(null);
      await fetchStaff();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "PIN을 재발급하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: Staff) {
    setSaving(true);
    try {
      await requestWithReauth(session.accessToken, onUnauthorized, (accessToken) =>
        apiUpdateStaffActive(accessToken, member.id, { active: !member.active }),
      );
      setModal(null);
      await fetchStaff();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "직원 상태를 변경하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = staffList.filter((member) => member.active).length;

  return (
    <section className="kds-panel" aria-label="직원 관리">
      <div className="kds-panel-header">
        <div>
          <h2 className="kds-panel-title">직원 관리</h2>
          <p className="kds-panel-subtitle">총 {staffList.length}명 · 활성 {activeCount}명</p>
        </div>
        <button className="kds-btn-primary kds-btn-sm" disabled={saving} onClick={openAdd} type="button">
          <Plus size={12} aria-hidden="true" />
          직원 추가
        </button>
      </div>

      {formError && !modal ? <div className="banner error" role="alert">{formError}</div> : null}

      {loading ? <div className="kds-empty">직원 목록을 불러오는 중…</div> : null}

      {!loading ? (
        <div className="kds-table-wrap kds-staff-table-wrap">
          <table className="kds-table kds-staff-table">
            <thead className="align-middle">
              <tr>
                <th>이름</th>
                <th>아이디</th>
                <th style={{ textAlign: "center" }}>역할</th>
                <th style={{ textAlign: "center" }}>상태</th>
                <th>PIN</th>
                <th style={{ textAlign: "right" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((member) => (
                <tr key={member.id} className={!member.active ? "row-inactive" : ""}>
                  <td data-label="이름">
                    <div className="kds-table-cell-name">
                      <div className="kds-staff-avatar-sm" aria-hidden="true">{member.name.slice(0, 1)}</div>
                      <span>{member.name}</span>
                    </div>
                  </td>
                  <td className="kds-table-cell-muted" data-label="아이디">{member.loginId}</td>
                  <td style={{ textAlign: "center" }} data-label="역할">
                    <span className={`kds-badge${member.positionLabel === "매니저" ? " accent" : ""}`}>
                      {member.positionLabel ?? "직원"}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }} data-label="상태">
                    <span className={`kds-badge${member.active ? " green" : " dim"}`}>
                      {member.active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td data-label="PIN">
                    {pinVisible === member.id && revealedPin ? (
                      <div className="kds-pin-reveal">
                        <span className="kds-pin-value">{revealedPin}</span>
                      </div>
                    ) : (
                      <span className="kds-pin-hidden">••••</span>
                    )}
                  </td>
                  <td data-label="작업">
                    <div className="kds-table-actions">
                      <button className="kds-btn-ghost kds-btn-xs" disabled={saving} onClick={() => setModal({ type: "pin", member })} type="button">PIN 재발급</button>
                      <button className="kds-btn-ghost kds-btn-xs" disabled={saving} onClick={() => openEdit(member)} type="button">수정</button>
                      <button
                        disabled={saving}
                        className={`kds-btn-ghost kds-btn-xs${member.active ? " danger" : " green"}`}
                        onClick={() => setModal({ type: "deactivate", member })}
                        type="button"
                      >
                        {member.active ? "비활성화" : "활성화"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {(modal?.type === "add" || modal?.type === "edit") ? (
        <div className="kds-modal-backdrop" onClick={() => setModal(null)}>
          <div className="kds-modal kds-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={modal.type === "add" ? "직원 추가" : "직원 정보 수정"}>
            <div className="kds-modal-head">
              <h2 className="kds-modal-title">{modal.type === "add" ? "직원 추가" : "직원 정보 수정"}</h2>
              <button className="kds-modal-close" onClick={() => setModal(null)} type="button" aria-label="닫기">
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="kds-modal-body">
              <div className="kds-settings-field">
                <label className="kds-settings-label" htmlFor="staff-name">이름</label>
                <input id="staff-name" type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="직원 이름" autoFocus />
              </div>
              <div className="kds-settings-field">
                <label className="kds-settings-label" htmlFor="staff-login-id">아이디</label>
                <input id="staff-login-id" type="text" value={form.loginId} onChange={(e) => setForm((prev) => ({ ...prev, loginId: e.target.value }))} placeholder="example123" />
              </div>
              <div className="kds-settings-field">
                <label className="kds-settings-label">역할</label>
                <div className="kds-segmented">
                  {(["직원", "매니저"] as const).map((label) => (
                    <button key={label} className={`kds-segmented-btn${form.role === label ? " active" : ""}`} onClick={() => setForm((prev) => ({ ...prev, role: label }))} type="button">{label}</button>
                  ))}
                </div>
              </div>
              {modal.type === "add" ? <p className="kds-settings-hint">추가 후 4자리 PIN이 자동 발급됩니다.</p> : null}
              {formError ? <p className="kds-settings-error">{formError}</p> : null}
            </div>
            <div className="kds-modal-foot">
              <button className="kds-modal-btn secondary" onClick={() => setModal(null)} type="button">취소</button>
              <button className="kds-modal-btn primary" disabled={saving} onClick={() => void saveStaff()} type="button">{saving ? "저장중…" : "저장"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal?.type === "pin" ? (
        <div className="kds-modal-backdrop" onClick={() => setModal(null)}>
          <div className="kds-modal kds-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="kds-modal-head"><h2 className="kds-modal-title">PIN 재발급</h2></div>
            <div className="kds-modal-body">
              <p className="kds-modal-desc"><strong>{modal.member.name}</strong>의 PIN을 새로 발급하시겠습니까?<br />기존 PIN은 즉시 사용 불가 처리됩니다.</p>
            </div>
            <div className="kds-modal-foot">
              <button className="kds-modal-btn secondary" onClick={() => setModal(null)} type="button">취소</button>
              <button className="kds-modal-btn primary" disabled={saving} onClick={() => void reissuePin(modal.member)} type="button">{saving ? "발급중…" : "발급"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal?.type === "deactivate" ? (
        <div className="kds-modal-backdrop" onClick={() => setModal(null)}>
          <div className="kds-modal kds-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="kds-modal-head"><h2 className="kds-modal-title">{modal.member.active ? "직원 비활성화" : "직원 활성화"}</h2></div>
            <div className="kds-modal-body">
              <p className="kds-modal-desc">
                <strong>{modal.member.name}</strong>을(를) {modal.member.active ? "비활성화" : "활성화"}하시겠습니까?
                {modal.member.active ? " 비활성화된 직원은 로그인할 수 없습니다." : ""}
              </p>
            </div>
            <div className="kds-modal-foot">
              <button className="kds-modal-btn secondary" onClick={() => setModal(null)} type="button">취소</button>
              <button className={`kds-modal-btn${modal.member.active ? " danger" : " primary"}`} disabled={saving} onClick={() => void toggleActive(modal.member)} type="button">
                {saving ? "처리중…" : modal.member.active ? "비활성화" : "활성화"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
