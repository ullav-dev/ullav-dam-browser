/**
 * Tests for AssetGrid — covers:
 *  • visibility filtering (private assets from other users hidden)
 *  • search filtering (name / caption / keywords / creator / description)
 *  • category filtering (via assetCategories map; optimistic display)
 *  • my-assets filter
 *  • sorting (name, size, type, created_at)
 *  • pagination (page-slice, page controls)
 *  • typeInfo badge labels
 *  • formatSize display
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset } from "@/lib/dam-api";
import AssetGrid from "@/components/AssetGrid";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/components/ImageEditorModal", () => () => null);

// ── Helpers ───────────────────────────────────────────────────────────────────

let idSeq = 0;
function makeAsset(overrides: Partial<Asset> = {}): Asset {
  const id = `asset-${++idSeq}`;
  return {
    id,
    name: `Asset ${idSeq}`,
    description: null,
    asset_type: "image/png",
    size: 1024,
    storage_key: `key-${idSeq}`,
    bucket: "bucket",
    caption: null,
    keywords: null,
    creator: "alice",
    copyright_notice: null,
    available: true,
    available_until: null,
    is_private: false,
    public_read: true,
    public_download: true,
    public_write: false,
    created_at: `2024-01-0${idSeq}T00:00:00Z`,
    updated_at: `2024-01-0${idSeq}T00:00:00Z`,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  assetCategories: new Map<string, string[]>(),
  selectedCategoryId: null as string | null | undefined,
  searchQuery: "",
  selectedAssetId: null,
  lockedIds: new Set<string>(),
  username: "alice",
  token: "tok",
  onSelect: jest.fn(),
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
  onAssetCreated: jest.fn(),
  onAssetUpdated: jest.fn(),
};

function renderGrid(assets: Asset[], props: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(
    <AssetGrid assets={assets} {...DEFAULT_PROPS} {...props} />,
  );
}

// ── Empty / initial state ─────────────────────────────────────────────────────

describe("empty state", () => {
  it("shows empty prompt when selectedCategoryId is undefined and no search", () => {
    renderGrid([], { selectedCategoryId: undefined, searchQuery: "" });
    expect(screen.getByText("emptyPrompt")).toBeInTheDocument();
  });

  it("shows noResults when category is selected but no assets match", () => {
    renderGrid([], { selectedCategoryId: "cat-1" });
    expect(screen.getByText("noResults")).toBeInTheDocument();
  });

  it("shows noAssets when All Assets (null) is selected with no assets", () => {
    renderGrid([], { selectedCategoryId: null });
    expect(screen.getByText("noAssets")).toBeInTheDocument();
  });
});

// ── Visibility filtering ──────────────────────────────────────────────────────

describe("visibility filtering", () => {
  it("shows public assets from other users", () => {
    const asset = makeAsset({ name: "Public Bob", creator: "bob", is_private: false });
    renderGrid([asset], { selectedCategoryId: null });
    expect(screen.getByText("Public Bob")).toBeInTheDocument();
  });

  it("hides private assets from other users", () => {
    const asset = makeAsset({ name: "Secret Bob", creator: "bob", is_private: true });
    renderGrid([asset], { selectedCategoryId: null });
    expect(screen.queryByText("Secret Bob")).not.toBeInTheDocument();
  });

  it("shows own private assets", () => {
    const asset = makeAsset({ name: "My Draft", creator: "alice", is_private: true });
    renderGrid([asset], { selectedCategoryId: null, username: "alice" });
    expect(screen.getByText("My Draft")).toBeInTheDocument();
  });
});

// ── Search filtering ──────────────────────────────────────────────────────────

describe("search filtering", () => {
  const assets = [
    makeAsset({ name: "Mountain Photo", caption: null, keywords: null, creator: "alice", description: null }),
    makeAsset({ name: "Beach Photo", caption: "sunset view", keywords: null, creator: "alice", description: null }),
    makeAsset({ name: "City Skyline", caption: null, keywords: "urban architecture", creator: "bob", description: null }),
    makeAsset({ name: "Forest Trail", caption: null, keywords: null, creator: "alice", description: "hiking path" }),
  ];

  it("filters by name (case-insensitive)", () => {
    renderGrid(assets, { selectedCategoryId: undefined, searchQuery: "mountain" });
    expect(screen.getByText("Mountain Photo")).toBeInTheDocument();
    expect(screen.queryByText("Beach Photo")).not.toBeInTheDocument();
  });

  it("filters by caption", () => {
    renderGrid(assets, { selectedCategoryId: undefined, searchQuery: "sunset" });
    expect(screen.getByText("Beach Photo")).toBeInTheDocument();
    expect(screen.queryByText("Mountain Photo")).not.toBeInTheDocument();
  });

  it("filters by keywords", () => {
    renderGrid(assets, { selectedCategoryId: undefined, searchQuery: "urban" });
    expect(screen.getByText("City Skyline")).toBeInTheDocument();
  });

  it("filters by creator", () => {
    renderGrid(assets, { selectedCategoryId: undefined, searchQuery: "bob" });
    expect(screen.getByText("City Skyline")).toBeInTheDocument();
    expect(screen.queryByText("Mountain Photo")).not.toBeInTheDocument();
  });

  it("filters by description", () => {
    renderGrid(assets, { selectedCategoryId: undefined, searchQuery: "hiking" });
    expect(screen.getByText("Forest Trail")).toBeInTheDocument();
    expect(screen.queryByText("Mountain Photo")).not.toBeInTheDocument();
  });

  it("shows all public assets matching the query regardless of category selection", () => {
    renderGrid(assets, { selectedCategoryId: undefined, searchQuery: "photo" });
    expect(screen.getByText("Mountain Photo")).toBeInTheDocument();
    expect(screen.getByText("Beach Photo")).toBeInTheDocument();
    expect(screen.queryByText("City Skyline")).not.toBeInTheDocument();
  });
});

// ── Category filtering ────────────────────────────────────────────────────────

describe("category filtering", () => {
  it("shows only assets in the selected category", () => {
    const a1 = makeAsset({ name: "In Cat" });
    const a2 = makeAsset({ name: "Not In Cat" });
    const assetCategories = new Map([
      [a1.id, ["cat-1"]],
      [a2.id, ["cat-2"]],
    ]);
    renderGrid([a1, a2], { selectedCategoryId: "cat-1", assetCategories });
    expect(screen.getByText("In Cat")).toBeInTheDocument();
    expect(screen.queryByText("Not In Cat")).not.toBeInTheDocument();
  });

  it("shows asset optimistically when categories not yet loaded", () => {
    const asset = makeAsset({ name: "Optimistic Asset" });
    // assetCategories has no entry for this asset → show it
    renderGrid([asset], { selectedCategoryId: "cat-1", assetCategories: new Map() });
    expect(screen.getByText("Optimistic Asset")).toBeInTheDocument();
  });

  it("shows all assets when selectedCategoryId is null", () => {
    const a1 = makeAsset({ name: "First" });
    const a2 = makeAsset({ name: "Second" });
    renderGrid([a1, a2], { selectedCategoryId: null });
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});

// ── My Assets filter ──────────────────────────────────────────────────────────

describe("My Assets filter", () => {
  it("filters to only the current user's assets when toggled", async () => {
    const mine = makeAsset({ name: "My Asset", creator: "alice" });
    const theirs = makeAsset({ name: "Their Asset", creator: "bob", is_private: false });
    renderGrid([mine, theirs], { selectedCategoryId: null, username: "alice" });

    expect(screen.getByText("My Asset")).toBeInTheDocument();
    expect(screen.getByText("Their Asset")).toBeInTheDocument();

    await userEvent.click(screen.getByText("myAssets"));

    expect(screen.getByText("My Asset")).toBeInTheDocument();
    expect(screen.queryByText("Their Asset")).not.toBeInTheDocument();
  });

  it("shows My Assets toggle only when username is provided", () => {
    renderGrid([makeAsset()], { selectedCategoryId: null, username: undefined });
    expect(screen.queryByText("myAssets")).not.toBeInTheDocument();
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

function getCardNames(): string[] {
  // Asset names are rendered as truncated text in each card's <p>
  return screen.getAllByRole("paragraph").map((el) => el.textContent ?? "");
}

describe("sorting", () => {
  const assets = [
    makeAsset({ name: "Zebra", size: 3000, asset_type: "image/png", created_at: "2024-01-03T00:00:00Z" }),
    makeAsset({ name: "Apple", size: 1000, asset_type: "application/pdf", created_at: "2024-01-01T00:00:00Z" }),
    makeAsset({ name: "Mango", size: 2000, asset_type: "image/jpeg", created_at: "2024-01-02T00:00:00Z" }),
  ];

  it("sorts by name ascending on first click", async () => {
    renderGrid(assets, { selectedCategoryId: null });
    await userEvent.click(screen.getByText("sortName"));
    const names = getCardNames();
    expect(names).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("sorts by name descending on second click (toggle)", async () => {
    renderGrid(assets, { selectedCategoryId: null });
    await userEvent.click(screen.getByText("sortName"));
    await userEvent.click(screen.getByText("sortName"));
    const names = getCardNames();
    expect(names).toEqual(["Zebra", "Mango", "Apple"]);
  });

  it("sorts by size ascending", async () => {
    renderGrid(assets, { selectedCategoryId: null });
    await userEvent.click(screen.getByText("sortSize"));
    const names = getCardNames();
    expect(names).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("sorts by type ascending", async () => {
    renderGrid(assets, { selectedCategoryId: null });
    await userEvent.click(screen.getByText("sortType"));
    const names = getCardNames();
    // application/pdf < image/jpeg < image/png alphabetically
    expect(names).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("default sort is created_at descending (newest first)", () => {
    renderGrid(assets, { selectedCategoryId: null });
    const names = getCardNames();
    expect(names).toEqual(["Zebra", "Mango", "Apple"]);
  });
});

// ── typeInfo badge labels ─────────────────────────────────────────────────────

describe("typeInfo badge labels", () => {
  function badgeFor(asset_type: string): string | null {
    const asset = makeAsset({ name: "badge-test", asset_type });
    const { container } = renderGrid([asset], { selectedCategoryId: null });
    // Badges are <span> elements rendered inside the card
    const spans = container.querySelectorAll("span.rounded");
    for (const span of spans) {
      const text = span.textContent;
      if (text && text !== "badge-test") return text;
    }
    return null;
  }

  it("renders PNG badge for image/png", () => {
    expect(badgeFor("image/png")).toBe("PNG");
  });

  it("renders JPEG badge for image/jpeg", () => {
    expect(badgeFor("image/jpeg")).toBe("JPEG");
  });

  it("renders PDF badge for application/pdf", () => {
    expect(badgeFor("application/pdf")).toBe("PDF");
  });

  it("renders VIDEO badge for video/mp4", () => {
    expect(badgeFor("video/mp4")).toBe("VIDEO");
  });

  it("renders AUDIO badge for audio/mpeg", () => {
    expect(badgeFor("audio/mpeg")).toBe("AUDIO");
  });

  it("renders XLS badge for Excel MIME", () => {
    // vnd.ms-excel contains "excel" and does not contain "document"
    expect(badgeFor("application/vnd.ms-excel")).toBe("XLS");
  });

  it("renders PPT badge for PowerPoint MIME", () => {
    // vnd.ms-powerpoint contains "powerpoint" and does not contain "document"
    expect(badgeFor("application/vnd.ms-powerpoint")).toBe("PPT");
  });

  it("renders ZIP badge for application/zip", () => {
    expect(badgeFor("application/zip")).toBe("ZIP");
  });

  it("renders PAGES badge for Apple Pages MIME", () => {
    expect(badgeFor("application/x-iwork-pages-sffpages")).toBe("PAGES");
  });

  it("renders NUMBERS badge for Apple Numbers MIME", () => {
    expect(badgeFor("application/x-iwork-numbers-sffnumbers")).toBe("NUMBERS");
  });

  it("renders KEYNOTE badge for Apple Keynote MIME", () => {
    expect(badgeFor("application/x-iwork-keynote-sffkey")).toBe("KEYNOTE");
  });

  it("renders FILE badge for application/octet-stream", () => {
    expect(badgeFor("application/octet-stream")).toBe("FILE");
  });
});

// ── formatSize display ────────────────────────────────────────────────────────

describe("formatSize display", () => {
  function sizeText(size: number): string | undefined {
    const asset = makeAsset({ name: "size-test", size });
    const { container } = renderGrid([asset], { selectedCategoryId: null });
    // The size is the last text in each card's bottom row
    const sizeSpans = container.querySelectorAll("span.text-slate-400.shrink-0");
    return sizeSpans[0]?.textContent ?? undefined;
  }

  it("shows — for 0 bytes", () => {
    expect(sizeText(0)).toBe("—");
  });

  it("shows bytes for values under 1 KB", () => {
    expect(sizeText(512)).toBe("512 B");
  });

  it("shows KB for values under 1 MB", () => {
    expect(sizeText(1536)).toBe("1.5 KB");
  });

  it("shows MB for values 1 MB and above", () => {
    expect(sizeText(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe("pagination", () => {
  it("shows only the default page size (20) assets initially", () => {
    const assets = Array.from({ length: 25 }, () => makeAsset());
    renderGrid(assets, { selectedCategoryId: null });
    // 20 asset names should appear (each card has a <p> with the name)
    expect(screen.getAllByRole("paragraph")).toHaveLength(20);
  });

  it("shows Next button when there are multiple pages", () => {
    const assets = Array.from({ length: 25 }, () => makeAsset());
    renderGrid(assets, { selectedCategoryId: null });
    expect(screen.getByText("paginationNext")).toBeInTheDocument();
  });

  it("navigates to page 2 on Next click", async () => {
    // Default sort is created_at descending — oldest 5 assets land on page 2.
    // Give the first 5 explicitly old dates so they sort to the end.
    const assets = Array.from({ length: 25 }, (_, i) =>
      makeAsset({
        name: i < 5 ? `OldAsset-${i}` : `NewAsset-${i}`,
        created_at: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );
    renderGrid(assets, { selectedCategoryId: null });

    await userEvent.click(screen.getByText("paginationNext"));

    expect(screen.getByText("OldAsset-0")).toBeInTheDocument();
    expect(screen.getByText("OldAsset-4")).toBeInTheDocument();
  });

  it("does not show pagination bar when all assets fit on one page", () => {
    const assets = Array.from({ length: 5 }, () => makeAsset());
    renderGrid(assets, { selectedCategoryId: null });
    expect(screen.queryByText("paginationNext")).not.toBeInTheDocument();
  });
});
