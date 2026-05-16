// Typed wrappers for the user-management service at http://localhost:8081.
// In the browser requests go via the Next.js /auth-api/* rewrite to avoid CORS.

const BASE =
  typeof window === "undefined"
    ? (process.env.AUTH_URL ?? "http://localhost:8081")
    : "/auth-api";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  roles: string[];
  permissions: string[];
}

export interface RegisterResponse {
  message: string;
  confirmation_token: string;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (res.status === 204 || !contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return undefined as T;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? data.message ?? data.detail ?? `HTTP ${res.status}`);
  return data as T;
}

// ── DAM access level (derived client-side from JWT claims) ────────────────────

export type DamAccess = "none" | "images-only" | "full";

/** Comad subscription tiers. */
export type ComadTier = "individual" | "team" | "enterprise" | null;

export interface ComadSubscription {
  tier: ComadTier;
  status: string | null;
  isActive: boolean;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function isActiveStatus(status: string | undefined): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Decode the JWT payload without verification (server enforces; client uses for UX only).
 * Admins always get full access. Otherwise checks subscriptions["comad"] first,
 * then falls back to subscriptions["clann"] for users who have DAM access bundled
 * with their Clann plan.
 */
export function getDamAccess(token: string | null): DamAccess {
  if (!token) return "none";
  const payload = decodePayload(token);
  if (!payload) return "none";

  // Admins bypass all subscription checks.
  const roles = (payload.roles ?? []) as string[];
  if (roles.includes("admin")) return "full";

  const subs = (payload.subscriptions ?? {}) as Record<string, { tier?: string; status?: string }>;

  // Comad standalone subscription access
  const comad = subs["comad"];
  const comadAccess: DamAccess = comad && isActiveStatus(comad.status)
    ? comad.tier === "team" || comad.tier === "enterprise"
      ? "full"
      : comad.tier === "individual"
      ? "images-only"
      : "none"
    : "none";

  // Clann bundled DAM access
  const clann = subs["clann"];
  const clannAccess: DamAccess = clann && isActiveStatus(clann.status)
    ? clann.tier === "professional" || clann.tier === "enterprise"
      ? "full"
      : clann.tier === "family"
      ? "images-only"
      : "none"
    : "none";

  // Return the highest access level from either subscription.
  if (comadAccess === "full" || clannAccess === "full") return "full";
  if (comadAccess === "images-only" || clannAccess === "images-only") return "images-only";
  return "none";
}

/** Decode Comad subscription details from a JWT (client-side, no signature verification). */
export function decodeComadSubscription(token: string | null): ComadSubscription {
  const none: ComadSubscription = { tier: null, status: null, isActive: false };
  if (!token) return none;
  const payload = decodePayload(token);
  if (!payload) return none;
  const subs = (payload.subscriptions ?? {}) as Record<string, { tier?: string; status?: string }>;
  const comad = subs["comad"];
  if (!comad) return none;
  const status = comad.status ?? null;
  const isActive = isActiveStatus(comad.status);
  const tier = isActive ? (comad.tier as ComadTier) ?? "individual" : null;
  return { tier, status, isActive };
}

/**
 * Returns true if the user's Comad subscription allows team creation
 * (team or enterprise tier, active status).
 */
export function canCreateTeam(token: string | null): boolean {
  if (!token) return false;
  const payload = decodePayload(token);
  if (!payload) return false;
  const roles = (payload.roles ?? []) as string[];
  if (roles.includes("admin")) return true;
  const subs = (payload.subscriptions ?? {}) as Record<string, { tier?: string; status?: string }>;
  const comad = subs["comad"];
  return !!(comad && isActiveStatus(comad.status) && (comad.tier === "team" || comad.tier === "enterprise"));
}

export const login = (email: string, password: string): Promise<LoginResponse> =>
  authRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const register = (
  username: string,
  email: string,
  password: string,
  app_url?: string
): Promise<RegisterResponse> =>
  authRequest("/users", {
    method: "POST",
    body: JSON.stringify({ username, email, password, ...(app_url ? { app_url } : {}) }),
  });

export const confirmEmail = (token: string): Promise<void> =>
  authRequest("/auth/confirm-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const requestPasswordReset = (
  email: string,
  app_url?: string
): Promise<{ reset_token?: string; message?: string }> =>
  authRequest("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email, ...(app_url ? { app_url } : {}) }),
  });

export const confirmPasswordReset = (token: string, new_password: string): Promise<void> =>
  authRequest("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password }),
  });

export const changePassword = (
  userId: string,
  newPassword: string,
  currentPassword: string | undefined,
  bearerToken: string
): Promise<void> =>
  authRequest(`/users/${userId}/password`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify({ new_password: newPassword, current_password: currentPassword }),
  });

// ── Subscription API ──────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  id: string;
  product: string;
  plan: string;
  status: string;
  seat_count: number;
  trial_end?: string;
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
}

export interface CheckoutResponse {
  url: string;
}

export const getSubscription = (product: string, token: string): Promise<SubscriptionInfo> =>
  authRequest(`/subscriptions/current?product=${encodeURIComponent(product)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const createCheckoutSession = (
  provider: string,
  product: string,
  plan: string,
  seatCount: number,
  token: string
): Promise<CheckoutResponse> =>
  authRequest("/subscriptions/checkout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ provider, product, plan, seat_count: seatCount }),
  });

export const createPortalSession = (token: string): Promise<CheckoutResponse> =>
  authRequest("/subscriptions/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
