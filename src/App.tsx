import { KdsPage } from "./pages/KdsPage";
import type { AuthSession } from "./types";

const demoSession: AuthSession = {
  accessToken: "demo-access-token",
  refreshToken: "demo-refresh-token",
  autoLogin: true,
  user: {
    id: 1,
    loginId: "owner",
    name: "관리자",
    role: "STORE_OWNER",
    accountType: "OWNER",
    approvalStatus: "APPROVED",
  },
  store: {
    id: 1,
    storeId: "demo-store",
    storeName: "주방짜장",
    phone: "02-0000-0000",
    zipNo: "04524",
    roadAddress: "서울 중구 세종대로 110",
    jibunAddress: "서울 중구 태평로1가 31",
    addressDetail: "1층",
    approvalStatus: "APPROVED",
  },
};

export default function App() {
  return (
    <KdsPage
      session={demoSession}
      onLogout={async () => undefined}
      onUnauthorized={async () => demoSession.accessToken}
    />
  );
}
