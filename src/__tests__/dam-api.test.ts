import {
  thumbnailUrl,
  downloadUrl,
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  uploadFile,
  addCategoryToAsset,
  removeCategoryFromAsset,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/dam-api";

const TOKEN = "test-token";

function mockFetch(status: number, body: unknown, contentType = "application/json") {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

// ── URL helpers ──────────────────────────────────────────────────────────────

describe("thumbnailUrl", () => {
  it("returns the correct thumbnail path", () => {
    expect(thumbnailUrl("abc-123")).toBe("/api/assets/abc-123/thumbnail");
  });
});

describe("downloadUrl", () => {
  it("returns the correct download path", () => {
    expect(downloadUrl("abc-123")).toBe("/api/assets/abc-123/download");
  });
});

// ── apiRequest — success paths ───────────────────────────────────────────────

describe("listAssets", () => {
  it("returns parsed JSON on 200", async () => {
    const assets = [{ id: "1", name: "Photo" }];
    mockFetch(200, assets);
    await expect(listAssets(TOKEN)).resolves.toEqual(assets);
  });

  it("sends Authorization header", async () => {
    mockFetch(200, []);
    await listAssets(TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/assets"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });
});

describe("apiRequest — error handling", () => {
  it("throws using the error field from JSON body", async () => {
    mockFetch(400, { error: "invalid request" });
    await expect(listAssets(TOKEN)).rejects.toThrow("invalid request");
  });

  it("throws using the message field when error is absent", async () => {
    mockFetch(400, { message: "bad input" });
    await expect(listAssets(TOKEN)).rejects.toThrow("bad input");
  });

  it("falls back to HTTP status when no error fields present", async () => {
    mockFetch(500, {});
    await expect(listAssets(TOKEN)).rejects.toThrow("HTTP 500");
  });

  it("throws HTTP status for non-JSON error responses", async () => {
    mockFetch(404, null, "text/plain");
    await expect(listAssets(TOKEN)).rejects.toThrow("HTTP 404");
  });

  it("returns undefined for 204 No Content", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve(null),
    } as unknown as Response);
    await expect(listAssets(TOKEN)).resolves.toBeUndefined();
  });

  it("returns undefined for non-JSON 200 response", async () => {
    mockFetch(200, null, "text/html");
    await expect(listAssets(TOKEN)).resolves.toBeUndefined();
  });
});

// ── Individual endpoint methods ──────────────────────────────────────────────

describe("getAsset", () => {
  it("calls the correct URL", async () => {
    const asset = { id: "abc", categories: [] };
    mockFetch(200, asset);
    await getAsset("abc", TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/assets/abc"),
      expect.anything(),
    );
  });
});

describe("createAsset", () => {
  it("sends POST with JSON body", async () => {
    const created = { id: "new-id", name: "Logo" };
    mockFetch(200, created);
    const result = await createAsset(
      { name: "Logo", asset_type: "image/png" },
      TOKEN,
    );
    expect(result).toEqual(created);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/assets"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });
});

describe("updateAsset", () => {
  it("sends PUT to the correct URL", async () => {
    const updated = { id: "id-1", name: "Updated" };
    mockFetch(200, updated);
    await updateAsset("id-1", { name: "Updated" }, TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/assets/id-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("deleteAsset", () => {
  it("sends DELETE to the correct URL and returns undefined on 204", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => "application/json" },
      json: () => Promise.resolve(null),
    } as unknown as Response);
    await expect(deleteAsset("id-1", TOKEN)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/assets/id-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("uploadFile", () => {
  it("sends POST with FormData containing the file", async () => {
    const updated = { id: "id-1", name: "Photo" };
    mockFetch(200, updated);
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await uploadFile("id-1", file, TOKEN);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
  });
});

// ── Category endpoints ───────────────────────────────────────────────────────

describe("listCategories", () => {
  it("calls GET /categories", async () => {
    mockFetch(200, []);
    await listCategories(TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories"),
      expect.anything(),
    );
  });
});

describe("createCategory", () => {
  it("sends POST with JSON body", async () => {
    const cat = { id: "c1", name: "Nature" };
    mockFetch(200, cat);
    const result = await createCategory({ name: "Nature" }, TOKEN);
    expect(result).toEqual(cat);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Nature");
  });
});

describe("updateCategory", () => {
  it("sends PUT to the correct URL", async () => {
    const cat = { id: "c1", name: "Updated" };
    mockFetch(200, cat);
    await updateCategory("c1", { name: "Updated" }, TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories/c1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("deleteCategory", () => {
  it("sends DELETE to the correct URL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 204,
      headers: { get: () => "" },
      json: () => Promise.resolve(null),
    } as unknown as Response);
    await deleteCategory("c1", TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories/c1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("addCategoryToAsset", () => {
  it("sends POST to asset category sub-resource", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 204,
      headers: { get: () => "" },
      json: () => Promise.resolve(null),
    } as unknown as Response);
    await addCategoryToAsset("asset-1", "cat-1", TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-1/categories/cat-1"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("removeCategoryFromAsset", () => {
  it("sends DELETE to asset category sub-resource", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 204,
      headers: { get: () => "" },
      json: () => Promise.resolve(null),
    } as unknown as Response);
    await removeCategoryFromAsset("asset-1", "cat-1", TOKEN);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-1/categories/cat-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
