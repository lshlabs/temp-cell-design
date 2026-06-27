import type {
  ArchiveCompletedOrdersResponse,
  AssignedMenu,
  AssignedMenuListResponse,
  AuthResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  CreateAssignedMenuRequest,
  CreateStaffRequest,
  CurrentUserResponse,
  HideOrderResponse,
  IdentifierAvailabilityResponse,
  KdsOrdersResponse,
  KdsStoreContext,
  LoginRequest,
  Order,
  OrderItemProgressResponse,
  OrderStatus,
  RefreshResponse,
  RegenerateStaffPinResponse,
  RegisterRequest,
  RegisterResponse,
  Staff,
  StaffListResponse,
  StaffWithTemporaryPin,
  StoreSettings,
  UpdateAssignedMenuRequest,
  UpdateOrderItemProgressRequest,
  UpdateStaffActiveRequest,
  UpdateStaffRequest,
  UpdateStoreSettingsRequest,
  UpdateStoreStatusRequest,
} from "../types";

export const API_ORIGIN = window.location.origin;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const currentUser: CurrentUserResponse = {
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

let staff: Staff[] = [
  { id: 101, loginId: "kitchen.kong-1", name: "주방직원1", accountType: "EMPLOYEE", positionLabel: "직원", active: true },
  { id: 102, loginId: "kitchen.kong-2", name: "주방직원2", accountType: "EMPLOYEE", positionLabel: "직원", active: true },
  { id: 103, loginId: "kitchen.kong-3", name: "주방직원3", accountType: "EMPLOYEE", positionLabel: "직원", active: true },
];

let assignedMenus: AssignedMenu[] = [
  { id: 201, menuName: "짜장면", normalizedMenuName: "짜장면", sortOrder: 1 },
  { id: 202, menuName: "짬뽕", normalizedMenuName: "짬뽕", sortOrder: 2 },
  { id: 203, menuName: "고추짜장", normalizedMenuName: "고추짜장", sortOrder: 3 },
  { id: 204, menuName: "탕수육", normalizedMenuName: "탕수육", sortOrder: 4 },
  { id: 205, menuName: "고추짬뽕", normalizedMenuName: "고추짬뽕", sortOrder: 5 },
];

let storeContext: KdsStoreContext = {
  storeId: "demo-store",
  storeName: "주방짜장",
  operatingStatus: "OPEN",
  pausedUntil: null,
  statusSource: "MANUAL",
};

let settings: StoreSettings = {
  notificationsEnabled: true,
  notificationSound: "default",
  breaktimeEnabled: false,
  breaktimeStartHour: 15,
  breaktimeStartMinute: 0,
  breaktimeDurationMinutes: 30,
  autoAccept: false,
};

let orders: Order[] = createOrders();

export async function apiLogin(payload: LoginRequest): Promise<AuthResponse> {
  return {
    accessToken: "demo-access-token",
    refreshToken: "demo-refresh-token",
    autoLogin: payload.autoLogin,
    ...currentUser,
  };
}

export async function apiRegister(_payload: RegisterRequest): Promise<RegisterResponse> {
  return currentUser;
}

export async function apiCheckIdentifier(loginId: string): Promise<IdentifierAvailabilityResponse> {
  const taken = staff.some((member) => member.loginId === loginId) || currentUser.user.loginId === loginId;
  return { available: !taken, message: taken ? "이미 사용 중인 아이디입니다." : "사용 가능한 아이디입니다." };
}

export async function apiRefresh(_refreshToken: string): Promise<RefreshResponse> {
  return { accessToken: "demo-access-token" };
}

export async function apiLogout(_refreshToken: string): Promise<void> {
  return undefined;
}

export async function apiGetCurrentUser(_accessToken: string): Promise<CurrentUserResponse> {
  return currentUser;
}

export async function apiChangePassword(
  _accessToken: string,
  _payload: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  return { message: "비밀번호가 변경되었습니다." };
}

export async function apiGetKdsOrders(_accessToken: string): Promise<KdsOrdersResponse> {
  return { orders: clone(orders) };
}

export async function apiGetStoreContext(_accessToken: string): Promise<KdsStoreContext> {
  return clone(storeContext);
}

export async function apiUpdateStoreStatus(
  _accessToken: string,
  payload: UpdateStoreStatusRequest,
): Promise<KdsStoreContext> {
  storeContext = {
    ...storeContext,
    operatingStatus: payload.operatingStatus,
    pausedUntil: payload.operatingStatus === "PAUSED" ? new Date(Date.now() + (payload.pauseMinutes ?? 10) * 60000).toISOString() : null,
    statusSource: "MANUAL",
  };
  return clone(storeContext);
}

export async function apiGetKdsSettings(_accessToken: string): Promise<StoreSettings> {
  return clone(settings);
}

export async function apiUpdateKdsSettings(
  _accessToken: string,
  payload: UpdateStoreSettingsRequest,
): Promise<StoreSettings> {
  settings = { ...payload };
  return clone(settings);
}

export async function apiGetAssignedMenus(_accessToken: string): Promise<AssignedMenuListResponse> {
  return { menus: clone(assignedMenus) };
}

export async function apiCreateAssignedMenu(
  _accessToken: string,
  payload: CreateAssignedMenuRequest,
): Promise<void> {
  assertUniqueAssignedMenu(payload.menuName);
  assignedMenus = [
    ...assignedMenus,
    {
      id: nextId(assignedMenus),
      menuName: payload.menuName,
      normalizedMenuName: normalizeName(payload.menuName),
      sortOrder: payload.sortOrder ?? assignedMenus.length + 1,
    },
  ];
}

export async function apiUpdateAssignedMenu(
  _accessToken: string,
  menuId: number,
  payload: UpdateAssignedMenuRequest,
): Promise<void> {
  assertUniqueAssignedMenu(payload.menuName, menuId);
  assignedMenus = assignedMenus.map((menu) =>
    menu.id === menuId
      ? { ...menu, menuName: payload.menuName, normalizedMenuName: normalizeName(payload.menuName), sortOrder: payload.sortOrder ?? menu.sortOrder }
      : menu,
  );
}

export async function apiDeleteAssignedMenu(_accessToken: string, menuId: number): Promise<void> {
  assignedMenus = assignedMenus.filter((menu) => menu.id !== menuId);
}

export async function apiGetStaff(_accessToken: string): Promise<StaffListResponse> {
  return { staff: clone(staff) };
}

export async function apiCreateStaff(
  _accessToken: string,
  payload: CreateStaffRequest,
): Promise<StaffWithTemporaryPin> {
  assertUniqueStaffLoginId(payload.loginId);
  const created: StaffWithTemporaryPin = {
    id: nextId(staff),
    loginId: payload.loginId,
    name: payload.name,
    accountType: "EMPLOYEE",
    positionLabel: payload.positionLabel ?? "직원",
    active: true,
    temporaryPin: createPin(),
  };
  staff = [...staff, stripTemporaryPin(created)];
  return created;
}

export async function apiUpdateStaff(
  _accessToken: string,
  staffId: number,
  payload: UpdateStaffRequest,
): Promise<Staff> {
  assertUniqueStaffLoginId(payload.loginId, staffId);
  let updated: Staff | null = null;
  staff = staff.map((member) => {
    if (member.id !== staffId) return member;
    updated = { ...member, loginId: payload.loginId, name: payload.name, positionLabel: payload.positionLabel ?? "직원" };
    return updated;
  });
  if (!updated) throw new ApiError(404, "직원을 찾지 못했습니다.");
  return clone(updated);
}

export async function apiUpdateStaffActive(
  _accessToken: string,
  staffId: number,
  payload: UpdateStaffActiveRequest,
): Promise<Staff> {
  let updated: Staff | null = null;
  staff = staff.map((member) => {
    if (member.id !== staffId) return member;
    updated = { ...member, active: payload.active };
    return updated;
  });
  if (!updated) throw new ApiError(404, "직원을 찾지 못했습니다.");
  return clone(updated);
}

export async function apiRegenerateStaffPin(
  _accessToken: string,
  staffId: number,
): Promise<RegenerateStaffPinResponse> {
  if (!staff.some((member) => member.id === staffId)) {
    throw new ApiError(404, "직원을 찾지 못했습니다.");
  }
  return { id: staffId, temporaryPin: createPin() };
}

export async function apiUpdateOrderStatus(
  _accessToken: string,
  orderId: number,
  status: OrderStatus,
): Promise<{ id: number; status: OrderStatus }> {
  orders = orders.map((order) => order.id === orderId ? { ...order, status, updated_at: new Date().toISOString() } : order);
  return { id: orderId, status };
}

export async function apiHideOrder(_accessToken: string, orderId: number): Promise<HideOrderResponse> {
  orders = orders.map((order) => order.id === orderId ? { ...order, hidden: true, hiddenAt: new Date().toISOString() } : order);
  return { orderId, hidden: true };
}

export async function apiArchiveCompletedOrders(_accessToken: string): Promise<ArchiveCompletedOrdersResponse> {
  let archivedCount = 0;
  orders = orders.map((order) => {
    if (order.status !== "DONE" || order.archived) return order;
    archivedCount += 1;
    return { ...order, archived: true, archivedAt: new Date().toISOString() };
  });
  return { archivedCount };
}

export async function apiUpdateOrderItemProgress(
  _accessToken: string,
  orderItemId: number,
  payload: UpdateOrderItemProgressRequest,
): Promise<OrderItemProgressResponse> {
  const doneAt = payload.done ? new Date().toISOString() : null;
  orders = orders.map((order) => ({
    ...order,
    items: order.items.map((item) =>
      item.id === orderItemId ? { ...item, done: payload.done, doneAt, doneByUserId: payload.done ? currentUser.user.id : null } : item,
    ),
  }));
  return { orderItemId, done: payload.done, doneAt, doneByUserId: payload.done ? currentUser.user.id : null };
}

function createOrders(): Order[] {
  const base = Date.now();
  return [
    createOrder(301, "IN4XCO", "NEW", base - 12 * 60000, [
      ["짜장면", 11],
      ["짬뽕", 9],
      ["고추짜장", 3],
    ]),
    createOrder(302, "HP7V12", "COOKING", base - 6 * 60000, [
      ["짜장면", 1],
      ["짬뽕", 1],
      ["고추짜장", 1],
    ]),
    createOrder(303, "VO0NHF", "DONE", base - 32 * 60000, [
      ["짜장면", 1],
      ["짬뽕", 1],
    ]),
    createOrder(304, "YDJG3P", "DONE", base - 45 * 60000, [["짜장면", 1]]),
    createOrder(305, "J6WOUB", "DONE", base - 51 * 60000, [["짜장면", 1]]),
  ];
}

function createOrder(
  id: number,
  orderNumber: string,
  status: OrderStatus,
  timestamp: number,
  items: Array<[string, number]>,
): Order {
  const iso = new Date(timestamp).toISOString();
  return {
    id,
    platform: "demo",
    store_id: "demo-store",
    external_order_id: `demo-${id}`,
    order_number: orderNumber,
    status,
    customer_request: null,
    delivery_request: null,
    ordered_at: iso,
    created_at: iso,
    updated_at: iso,
    hidden: false,
    hiddenAt: null,
    archived: false,
    archivedAt: null,
    items: items.map(([name, quantity], index) => ({
      id: id * 10 + index,
      name,
      quantity,
      options: [],
      unit_price: null,
      total_price: null,
      done: status === "DONE",
      doneAt: status === "DONE" ? iso : null,
      doneByUserId: status === "DONE" ? currentUser.user.id : null,
    })),
    aiAnalysis: null,
  };
}

function assertUniqueAssignedMenu(menuName: string, ignoreId?: number) {
  const normalized = normalizeName(menuName);
  if (assignedMenus.some((menu) => menu.id !== ignoreId && menu.normalizedMenuName === normalized)) {
    throw new ApiError(409, "이미 등록된 담당 메뉴입니다.");
  }
}

function assertUniqueStaffLoginId(loginId: string, ignoreId?: number) {
  if (staff.some((member) => member.id !== ignoreId && member.loginId === loginId)) {
    throw new ApiError(409, "이미 사용 중인 직원 아이디입니다.");
  }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function nextId<T extends { id: number }>(items: T[]) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

function createPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function stripTemporaryPin(member: StaffWithTemporaryPin): Staff {
  const { temporaryPin: _temporaryPin, ...staffMember } = member;
  return staffMember;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
