/**
 * Tests for AssetGrid — covers:
 *  • empty / idle state rendering
 *  • sort button interactions (fires onSortChange)
 *  • My Assets toggle (fires onMyAssetsToggle)
 *  • pagination controls (fires onPageChange / onPageSizeChange)
 *  • typeInfo badge labels
 *  • formatSize display
 *
 * Filtering, sorting order, and visibility are now server-side.
 * The grid is a controlled render layer — it renders what it receives.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetWithCategories } from "@/lib/dam-api";
import AssetGrid, { typeInfo } from "@/components/AssetGrid";
import type { SortField, SortDir } from "@/components/AssetGrid";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/components/ImageEditorModal", () => () => null);

// ── Helpers ───────────────────────────────────────────────────────────────────

let idSeq = 0;
function makeAsset(overrides: Partial<AssetWithCategories> = {}): AssetWithCategories {
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
    ocr_text: null,
    creator: "alice",
    owner_id: "owner-1",
    copyright_notice: null,
    available: true,
    available_until: null,
    is_private: false,
    public_read: true,
    public_download: true,
    public_write: false,
    team_id: null,
    custom_fields: null,
    created_at: `2024-01-0${idSeq}T00:00:00Z`,
    updated_at: `2024-01-0${idSeq}T00:00:00Z`,
    categories: [],
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  total: 0,
  page: 1,
  perPage: 20,
  sortField: "created_at" as SortField,
  sortDir: "desc" as SortDir,
  myAssetsOnly: false,
  isIdle: false,
  hasFilter: false,
  selectedAssetId: null,
  lockedIds: new Set<string>(),
  username: "alice",
  token: "tok",
  onSelect: jest.fn(),
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
  onAssetCreated: jest.fn(),
  onAssetUpdated: jest.fn(),
  onPageChange: jest.fn(),
  onPageSizeChange: jest.fn(),
  onSortChange: jest.fn(),
  onMyAssetsToggle: jest.fn(),
};

function renderGrid(assets: AssetWithCategories[], props: Partial<typeof DEFAULT_PROPS> = {}) {
  const merged = { ...DEFAULT_PROPS, ...props, total: props.total ?? assets.length };
  return render(<AssetGrid assets={assets} {...merged} />);
}

// ── Empty / idle state ────────────────────────────────────────────────────────

describe("empty state", () => {
  it("shows empty prompt when isIdle is true", () => {
    renderGrid([], { isIdle: true });
    expect(screen.getByText("emptyPrompt")).toBeInTheDocument();
  });

  it("shows noResults when filter is active but total is 0", () => {
    renderGrid([], { isIdle: false, hasFilter: true, total: 0 });
    expect(screen.getByText("noResults")).toBeInTheDocument();
  });

  it("shows noAssets when no filter active and total is 0", () => {
    renderGrid([], { isIdle: false, hasFilter: false, total: 0 });
    expect(screen.getByText("noAssets")).toBeInTheDocument();
  });

  it("renders asset cards when assets are provided", () => {
    renderGrid([makeAsset({ name: "My Photo" })]);
    expect(screen.getByText("My Photo")).toBeInTheDocument();
  });
});

// ── Sort interactions ─────────────────────────────────────────────────────────

describe("sort interactions", () => {
  it("calls onSortChange with new field and asc on first click", async () => {
    const onSortChange = jest.fn();
    renderGrid([makeAsset()], { onSortChange });
    await userEvent.click(screen.getByText("sortName"));
    expect(onSortChange).toHaveBeenCalledWith("name", "asc");
  });

  it("calls onSortChange toggling direction when same field clicked", async () => {
    const onSortChange = jest.fn();
    renderGrid([makeAsset()], { sortField: "name", sortDir: "asc", onSortChange });
    await userEvent.click(screen.getByText("sortName"));
    expect(onSortChange).toHaveBeenCalledWith("name", "desc");
  });

  it("calls onSortChange with desc when active desc field is clicked", async () => {
    const onSortChange = jest.fn();
    renderGrid([makeAsset()], { sortField: "name", sortDir: "desc", onSortChange });
    await userEvent.click(screen.getByText("sortName"));
    expect(onSortChange).toHaveBeenCalledWith("name", "asc");
  });

  it("shows active sort indicator on the current sort field", () => {
    renderGrid([makeAsset()], { sortField: "size", sortDir: "asc" });
    // Active button has the sort arrow
    expect(screen.getByText("▲")).toBeInTheDocument();
  });
});

// ── My Assets toggle ──────────────────────────────────────────────────────────

describe("My Assets toggle", () => {
  it("calls onMyAssetsToggle when clicked", async () => {
    const onMyAssetsToggle = jest.fn();
    renderGrid([makeAsset()], { onMyAssetsToggle });
    await userEvent.click(screen.getByText("myAssets"));
    expect(onMyAssetsToggle).toHaveBeenCalledTimes(1);
  });

  it("does not show My Assets toggle when username is not provided", () => {
    renderGrid([makeAsset()], { username: undefined });
    expect(screen.queryByText("myAssets")).not.toBeInTheDocument();
  });

  it("renders toggle with active styling when myAssetsOnly is true", () => {
    renderGrid([makeAsset()], { myAssetsOnly: true });
    const btn = screen.getByText("myAssets");
    expect(btn.className).toContain("bg-emerald-600");
  });
});

// ── Pagination controls ───────────────────────────────────────────────────────

describe("pagination controls", () => {
  it("shows pagination bar when total exceeds perPage", () => {
    renderGrid(Array.from({ length: 20 }, () => makeAsset()), { total: 25, perPage: 20 });
    expect(screen.getByText("paginationNext")).toBeInTheDocument();
  });

  it("does not show pagination bar when all assets fit on one page", () => {
    renderGrid(Array.from({ length: 5 }, () => makeAsset()), { total: 5, perPage: 20 });
    expect(screen.queryByText("paginationNext")).not.toBeInTheDocument();
  });

  it("calls onPageChange(2) when Next is clicked", async () => {
    const onPageChange = jest.fn();
    renderGrid(Array.from({ length: 20 }, () => makeAsset()), { total: 25, perPage: 20, page: 1, onPageChange });
    await userEvent.click(screen.getByText("paginationNext"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange(1) when Prev is clicked on page 2", async () => {
    const onPageChange = jest.fn();
    renderGrid(Array.from({ length: 5 }, () => makeAsset()), { total: 25, perPage: 20, page: 2, onPageChange });
    await userEvent.click(screen.getByText("paginationPrev"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables Prev button on page 1", () => {
    renderGrid(Array.from({ length: 20 }, () => makeAsset()), { total: 25, perPage: 20, page: 1 });
    expect(screen.getByText("paginationPrev")).toBeDisabled();
  });

  it("calls onPageSizeChange when page size selector changes", async () => {
    const onPageSizeChange = jest.fn();
    renderGrid(Array.from({ length: 20 }, () => makeAsset()), { total: 25, perPage: 20, onPageSizeChange });
    await userEvent.selectOptions(screen.getByRole("combobox"), "10");
    expect(onPageSizeChange).toHaveBeenCalledWith(10);
  });
});

// ── typeInfo badge labels ─────────────────────────────────────────────────────

describe("typeInfo badge labels", () => {
  function badgeFor(asset_type: string): string | null {
    const asset = makeAsset({ name: "badge-test", asset_type });
    const { container } = renderGrid([asset]);
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
    expect(badgeFor("application/vnd.ms-excel")).toBe("XLS");
  });

  it("renders PPT badge for PowerPoint MIME", () => {
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

  // typeInfo is also directly testable since it's exported
  it("typeInfo returns correct label for image/png", () => {
    expect(typeInfo("image/png").label).toBe("PNG");
  });
});

// ── formatSize display ────────────────────────────────────────────────────────

describe("formatSize display", () => {
  function sizeText(size: number): string | undefined {
    const asset = makeAsset({ name: "size-test", size });
    const { container } = renderGrid([asset]);
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
