// Typed wrappers for the ullav-dam-server API at http://localhost:8080.
// In the browser requests go via the Next.js /api/* rewrite to avoid CORS.

const BASE =
  typeof window === "undefined"
    ? (process.env.API_URL ?? "http://localhost:8080")
    : "/api";

export interface Asset {
  id: string;
  name: string;
  description: string | null;
  asset_type: string;
  size: number;
  storage_key: string;
  bucket: string;
  caption: string | null;
  keywords: string | null;
  creator: string | null;
  owner_id: string;
  copyright_notice: string | null;
  available: boolean;
  available_until: string | null;
  is_private: boolean;
  public_read: boolean;
  public_download: boolean;
  public_write: boolean;
  team_id: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type CustomFieldType = "String" | "Boolean" | "Integer" | "Float" | "DateTime";

export interface CustomFieldSchema {
  id: string;
  team_id: string;
  key: string;
  name: string;
  field_type: CustomFieldType;
  required: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetWithCategories extends Asset {
  categories: Category[];
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  creator: string | null;
  owner_id: string;
  access_level: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithChildren extends Category {
  sub_categories: Category[];
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init });
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json") || contentType.includes("application/ld+json");
  if (!isJson) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return undefined as T;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
  return data as T;
}

function bearerHeaders(token: string, extra?: Record<string, string>) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

// ── Assets ────────────────────────────────────────────────────────────────────

export interface AssetListParams {
  categoryId?: string;
  q?: string;
  myAssets?: boolean;
  sortField?: string;
  sortDir?: string;
  page?: number;
  perPage?: number;
}

export interface AssetPage {
  items: AssetWithCategories[];
  total: number;
  page: number;
  per_page: number;
}

export const listAssets = (token: string, params: AssetListParams = {}): Promise<AssetPage> => {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set("category_id", params.categoryId);
  if (params.q) qs.set("q", params.q);
  if (params.myAssets) qs.set("my_assets", "true");
  if (params.sortField) qs.set("sort_field", params.sortField);
  if (params.sortDir) qs.set("sort_dir", params.sortDir);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  if (params.perPage && params.perPage !== 20) qs.set("per_page", String(params.perPage));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiRequest(`/assets${suffix}`, { headers: bearerHeaders(token) });
};

export const getAsset = (id: string, token: string): Promise<AssetWithCategories> =>
  apiRequest(`/assets/${id}`, { headers: bearerHeaders(token) });

export const createAsset = (
  body: {
    name: string;
    description?: string | null;
    asset_type: string;
    caption?: string | null;
    keywords?: string | null;
    creator?: string | null;
    copyright_notice?: string | null;
    available?: boolean;
    available_until?: string | null;
  },
  token: string
): Promise<Asset> =>
  apiRequest("/assets", {
    method: "POST",
    headers: bearerHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

export const updateAsset = (
  id: string,
  body: Partial<{
    name: string;
    description: string | null;
    asset_type: string;
    caption: string | null;
    keywords: string | null;
    creator: string | null;
    copyright_notice: string | null;
    available: boolean;
    available_until: string | null;
    is_private: boolean;
    public_read: boolean;
    public_download: boolean;
    public_write: boolean;
    team_id: string;
    custom_fields: Record<string, unknown>;
  }>,
  token: string
): Promise<Asset> =>
  apiRequest(`/assets/${id}`, {
    method: "PUT",
    headers: bearerHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

export const deleteAsset = (id: string, token: string): Promise<void> =>
  apiRequest(`/assets/${id}`, {
    method: "DELETE",
    headers: bearerHeaders(token),
  });

export const uploadFile = (id: string, file: File, token: string): Promise<Asset> => {
  const fd = new FormData();
  fd.append("file", file);
  return apiRequest(`/assets/${id}/upload`, {
    method: "POST",
    headers: bearerHeaders(token),
    body: fd,
  });
};

export const thumbnailUrl = (id: string): string => `/api/assets/${id}/thumbnail`;
export const downloadUrl = (id: string): string => `/api/assets/${id}/download`;

// ── IIIF ──────────────────────────────────────────────────────────────────────

/** Fetches the IIIF Manifest for a public asset and returns its canonical `id` URL.
 *  The `id` is the fully-qualified public API URL — safe to share with external viewers. */
export const fetchIiifManifestId = (id: string): Promise<string> =>
  apiRequest<{ id: string }>(`/iiif/manifest/${id}`, { method: "GET" }).then((d) => d.id);

/** Fetches the full IIIF Manifest JSON (works for both public and private assets). */
export const fetchIiifManifestJson = (id: string, token: string): Promise<unknown> =>
  apiRequest<unknown>(`/iiif/manifest/${id}`, { headers: bearerHeaders(token) });

/** Fetches the IIIF Collection for a non-private category and returns its canonical `id` URL. */
export const fetchIiifCollectionId = (id: string): Promise<string> =>
  apiRequest<{ id: string }>(`/iiif/collection/${id}`, { method: "GET" }).then((d) => d.id);

export const refreshThumbnail = (id: string, token: string): Promise<void> =>
  apiRequest(`/assets/${id}/thumbnail`, { method: "DELETE", headers: bearerHeaders(token) })
    .then(() => undefined);

// ── ZIP import ────────────────────────────────────────────────────────────────

export interface ZipUploadResult {
  /** All categories created: root + one per directory in the ZIP. */
  categories: Category[];
  /** All assets successfully uploaded from the ZIP contents. */
  assets: Asset[];
  /** Maps asset_id → [category_id] for every uploaded asset. */
  asset_category_ids: Record<string, string[]>;
  /** Per-entry errors (non-fatal; remaining entries were still processed). */
  errors: string[];
}

export const uploadZip = (file: File, token: string, creator?: string): Promise<ZipUploadResult> => {
  const fd = new FormData();
  fd.append("file", file);
  if (creator) fd.append("creator", creator);
  return apiRequest("/zip/upload", {
    method: "POST",
    headers: bearerHeaders(token),
    body: fd,
  });
};

// ── Categories ────────────────────────────────────────────────────────────────

export const listCategories = (token: string): Promise<Category[]> =>
  apiRequest("/categories", { headers: bearerHeaders(token) });

export const getCategory = (id: string, token: string): Promise<CategoryWithChildren> =>
  apiRequest(`/categories/${id}`, { headers: bearerHeaders(token) });

export const createCategory = (
  body: { name: string; description?: string | null; parent_id?: string | null; creator?: string | null; access_level?: string },
  token: string
): Promise<Category> =>
  apiRequest("/categories", {
    method: "POST",
    headers: bearerHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

export const updateCategory = (
  id: string,
  body: Partial<{ name: string; description: string | null; parent_id: string | null; access_level: string }>,
  token: string
): Promise<Category> =>
  apiRequest(`/categories/${id}`, {
    method: "PUT",
    headers: bearerHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

export const deleteCategory = (id: string, token: string): Promise<void> =>
  apiRequest(`/categories/${id}`, {
    method: "DELETE",
    headers: bearerHeaders(token),
  });

// ── Asset metadata (EXIF / IPTC / XMP) ───────────────────────────────────────

export interface AssetMetadata {
  asset_id: string;
  exif: Record<string, unknown> | null;
  iptc: Record<string, unknown> | null;
  xmp: Record<string, unknown> | null;
  extracted_at: string;
}

export const getAssetMetadata = (id: string, token: string): Promise<AssetMetadata> =>
  apiRequest(`/assets/${id}/metadata`, { headers: bearerHeaders(token) });

// ── Usage ─────────────────────────────────────────────────────────────────────

export interface UsageInfo {
  used_bytes: number;
  asset_count: number;
  storage_limit_bytes: number | null;
  asset_limit: number | null;
  category_count: number;
  category_limit: number | null;
}

export const getUsage = (token: string): Promise<UsageInfo> =>
  apiRequest("/usage", { headers: bearerHeaders(token) });

// ── Asset ↔ Category associations ────────────────────────────────────────────

export const addCategoryToAsset = (
  assetId: string,
  categoryId: string,
  token: string
): Promise<void> =>
  apiRequest(`/assets/${assetId}/categories/${categoryId}`, {
    method: "POST",
    headers: bearerHeaders(token),
  });

export const removeCategoryFromAsset = (
  assetId: string,
  categoryId: string,
  token: string
): Promise<void> =>
  apiRequest(`/assets/${assetId}/categories/${categoryId}`, {
    method: "DELETE",
    headers: bearerHeaders(token),
  });

// ── Custom field schemas ───────────────────────────────────────────────────────

export const listCustomFieldSchemas = (teamId: string, token: string): Promise<CustomFieldSchema[]> =>
  apiRequest(`/teams/${teamId}/custom-field-schemas`, { headers: bearerHeaders(token) });

export const createCustomFieldSchema = (
  teamId: string,
  body: { key: string; name: string; field_type: CustomFieldType; required?: boolean },
  token: string
): Promise<CustomFieldSchema> =>
  apiRequest(`/teams/${teamId}/custom-field-schemas`, {
    method: "POST",
    headers: bearerHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

export const updateCustomFieldSchema = (
  teamId: string,
  schemaId: string,
  body: { name?: string; required?: boolean },
  token: string
): Promise<CustomFieldSchema> =>
  apiRequest(`/teams/${teamId}/custom-field-schemas/${schemaId}`, {
    method: "PUT",
    headers: bearerHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

export const deleteCustomFieldSchema = (
  teamId: string,
  schemaId: string,
  token: string
): Promise<void> =>
  apiRequest(`/teams/${teamId}/custom-field-schemas/${schemaId}`, {
    method: "DELETE",
    headers: bearerHeaders(token),
  });
