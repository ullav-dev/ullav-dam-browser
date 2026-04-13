import {
  login,
  register,
  confirmEmail,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
  getDamAccess,
} from "@/lib/auth-api";

// ── JWT stub builder (no signature verification in getDamAccess) ──────────────

function makeJwt(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${b64}.sig`;
}

function clannJwt(tier: string, status: string): string {
  return makeJwt({ sub: "u1", subscriptions: { clann: { tier, status } } });
}

function noSubsJwt(): string {
  return makeJwt({ sub: "u1" });
}

function mockFetch(status: number, body: unknown, contentType = "application/json") {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mock204() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 204,
    headers: { get: () => "" },
    json: () => Promise.resolve(null),
  } as unknown as Response);
}

// ── login ────────────────────────────────────────────────────────────────────

describe("login", () => {
  it("returns token and user on success", async () => {
    const response = { token: "tok", user: { id: "u1" }, roles: [], permissions: [] };
    mockFetch(200, response);
    await expect(login("user@example.com", "pw")).resolves.toEqual(response);
  });

  it("sends POST with email and password", async () => {
    mockFetch(200, { token: "t", user: {}, roles: [], permissions: [] });
    await login("user@example.com", "secret");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/auth/login");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ email: "user@example.com", password: "secret" });
  });

  it("sets Content-Type: application/json", async () => {
    mockFetch(200, { token: "t", user: {}, roles: [], permissions: [] });
    await login("a@b.com", "pw");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers?.["Content-Type"] ?? init.headers?.get?.("Content-Type"))
      .toContain("application/json");
  });
});

// ── authRequest error handling ───────────────────────────────────────────────

describe("authRequest error handling", () => {
  it("throws using the error field", async () => {
    mockFetch(401, { error: "invalid credentials" });
    await expect(login("a@b.com", "bad")).rejects.toThrow("invalid credentials");
  });

  it("throws using the message field when error is absent", async () => {
    mockFetch(400, { message: "email taken" });
    await expect(login("a@b.com", "pw")).rejects.toThrow("email taken");
  });

  it("throws using the detail field when error and message are absent", async () => {
    mockFetch(422, { detail: "validation failed" });
    await expect(login("a@b.com", "pw")).rejects.toThrow("validation failed");
  });

  it("falls back to HTTP status string", async () => {
    mockFetch(500, {});
    await expect(login("a@b.com", "pw")).rejects.toThrow("HTTP 500");
  });

  it("throws HTTP status for non-JSON error response", async () => {
    mockFetch(503, null, "text/html");
    await expect(login("a@b.com", "pw")).rejects.toThrow("HTTP 503");
  });

  it("returns undefined for 204 Non-JSON response", async () => {
    mockFetch(204, null, "text/plain");
    await expect(confirmEmail("confirm-token")).resolves.toBeUndefined();
  });
});

// ── register ─────────────────────────────────────────────────────────────────

describe("register", () => {
  it("sends username, email, and password", async () => {
    mockFetch(200, { message: "ok", confirmation_token: "ct" });
    await register("alice", "alice@example.com", "pass123");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      username: "alice",
      email: "alice@example.com",
      password: "pass123",
    });
  });

  it("includes app_url when provided", async () => {
    mockFetch(200, { message: "ok", confirmation_token: "ct" });
    await register("alice", "alice@example.com", "pass123", "https://app.example.com");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.app_url).toBe("https://app.example.com");
  });

  it("omits app_url when not provided", async () => {
    mockFetch(200, { message: "ok", confirmation_token: "ct" });
    await register("alice", "alice@example.com", "pass123");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("app_url");
  });
});

// ── confirmEmail ─────────────────────────────────────────────────────────────

describe("confirmEmail", () => {
  it("sends POST with token", async () => {
    mock204();
    await confirmEmail("my-token");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/auth/confirm-email");
    const body = JSON.parse(init.body as string);
    expect(body.token).toBe("my-token");
  });
});

// ── requestPasswordReset ──────────────────────────────────────────────────────

describe("requestPasswordReset", () => {
  it("sends POST with email", async () => {
    mockFetch(200, { message: "sent" });
    await requestPasswordReset("user@example.com");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/auth/password-reset/request");
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe("user@example.com");
  });

  it("includes app_url when provided", async () => {
    mockFetch(200, {});
    await requestPasswordReset("user@example.com", "https://app.example.com");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.app_url).toBe("https://app.example.com");
  });
});

// ── confirmPasswordReset ──────────────────────────────────────────────────────

describe("confirmPasswordReset", () => {
  it("sends token and new_password", async () => {
    mock204();
    await confirmPasswordReset("reset-token", "newpass");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/auth/password-reset/confirm");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ token: "reset-token", new_password: "newpass" });
  });
});

// ── changePassword ────────────────────────────────────────────────────────────

describe("changePassword", () => {
  it("sends PUT to the user password endpoint with bearer token", async () => {
    mock204();
    await changePassword("user-id", "newpass", "oldpass", "bearer-token");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/users/user-id/password");
    expect(init.method).toBe("PUT");
    expect(init.headers?.Authorization).toBe("Bearer bearer-token");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ new_password: "newpass", current_password: "oldpass" });
  });

  it("sends undefined current_password when not provided", async () => {
    mock204();
    await changePassword("user-id", "newpass", undefined, "tok");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.new_password).toBe("newpass");
  });
});

// ── getDamAccess ──────────────────────────────────────────────────────────────

describe("getDamAccess", () => {
  it('returns "none" for null token', () => {
    expect(getDamAccess(null)).toBe("none");
  });

  it('returns "none" for a malformed token', () => {
    expect(getDamAccess("not.a.jwt")).toBe("none");
    expect(getDamAccess("totally-invalid")).toBe("none");
  });

  it('returns "none" when there is no subscriptions claim', () => {
    expect(getDamAccess(noSubsJwt())).toBe("none");
  });

  it('returns "none" for individual active subscription', () => {
    // Individual plan has no DAM access
    expect(getDamAccess(clannJwt("individual", "active"))).toBe("none");
  });

  it('returns "images-only" for family active subscription', () => {
    expect(getDamAccess(clannJwt("family", "active"))).toBe("images-only");
  });

  it('returns "images-only" for family trialing subscription', () => {
    expect(getDamAccess(clannJwt("family", "trialing"))).toBe("images-only");
  });

  it('returns "full" for professional active subscription', () => {
    expect(getDamAccess(clannJwt("professional", "active"))).toBe("full");
  });

  it('returns "full" for enterprise active subscription', () => {
    expect(getDamAccess(clannJwt("enterprise", "active"))).toBe("full");
  });

  it('returns "full" for professional trialing subscription', () => {
    expect(getDamAccess(clannJwt("professional", "trialing"))).toBe("full");
  });

  it('returns "none" for a canceled family subscription', () => {
    // Inactive subscription → no access regardless of tier
    expect(getDamAccess(clannJwt("family", "canceled"))).toBe("none");
  });

  it('returns "none" for a past_due professional subscription', () => {
    expect(getDamAccess(clannJwt("professional", "past_due"))).toBe("none");
  });
});

// ── getDamAccess — comad subscription ─────────────────────────────────────────

function comadJwt(tier: string, status: string): string {
  return makeJwt({ sub: "u1", subscriptions: { comad: { tier, status } } });
}

function bothJwt(comadTier: string, comadStatus: string, clannTier: string, clannStatus: string): string {
  return makeJwt({
    sub: "u1",
    subscriptions: {
      comad: { tier: comadTier, status: comadStatus },
      clann: { tier: clannTier, status: clannStatus },
    },
  });
}

describe("getDamAccess (comad subscription)", () => {
  it('returns "images-only" for comad individual active', () => {
    expect(getDamAccess(comadJwt("individual", "active"))).toBe("images-only");
  });

  it('returns "full" for comad team active', () => {
    expect(getDamAccess(comadJwt("team", "active"))).toBe("full");
  });

  it('returns "full" for comad enterprise active', () => {
    expect(getDamAccess(comadJwt("enterprise", "active"))).toBe("full");
  });

  it('returns "full" for comad team trialing', () => {
    expect(getDamAccess(comadJwt("team", "trialing"))).toBe("full");
  });

  it('returns "none" for comad team canceled', () => {
    expect(getDamAccess(comadJwt("team", "canceled"))).toBe("none");
  });

  it('comad takes priority over clann — comad team + clann individual gives full', () => {
    expect(getDamAccess(bothJwt("team", "active", "individual", "active"))).toBe("full");
  });

  it('falls back to clann when comad is absent — clann family gives images-only', () => {
    expect(getDamAccess(clannJwt("family", "active"))).toBe("images-only");
  });

  it('uses highest access — comad individual + clann professional gives full', () => {
    expect(getDamAccess(bothJwt("individual", "active", "professional", "active"))).toBe("full");
  });
});
