// API client for ullav-dam-server with a configurable base URL.
// The base should be the host app's proxy prefix, e.g. "/api/dam".

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
  copyright_notice: string | null;
  available: boolean;
  available_until: string | null;
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
  access_level: string;
  created_at: string;
  updated_at: string;
}

/** The shape returned to the host app when an asset is selected or dragged. */
export interface PickedAsset {
  id: string;
  name: string;
  assetType: string;
  size: number;
  /** Base asset URL — suitable for display, embedding, or linking. */
  url: string;
  thumbnailUrl: string;
}

export interface AssetListParams {
  categoryId?: string;
  q?: string;
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

export function createDamClient(base: string, token: string) {
  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return undefined as T;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
    return data as T;
  }

  return {
    listAssets: (params: AssetListParams = {}): Promise<AssetPage> => {
      const qs = new URLSearchParams();
      if (params.categoryId) qs.set("category_id", params.categoryId);
      if (params.q) qs.set("q", params.q);
      if (params.sortField) qs.set("sort_field", params.sortField);
      if (params.sortDir) qs.set("sort_dir", params.sortDir);
      if (params.page && params.page > 1) qs.set("page", String(params.page));
      if (params.perPage && params.perPage !== 20) qs.set("per_page", String(params.perPage));
      const suffix = qs.toString() ? `?${qs}` : "";
      return get(`/assets${suffix}`);
    },
    listCategories: (): Promise<Category[]> => get("/categories"),
    thumbnailUrl: (id: string): string => `${base}/assets/${id}/thumbnail`,
    assetUrl: (id: string): string => `${base}/assets/${id}`,
  };
}

export type DamClient = ReturnType<typeof createDamClient>;
