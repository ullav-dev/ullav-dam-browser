"use client";

// A real category detail view, added alongside Phase B of the comad
// tack-notes migration: editing a category used to be a tiny 3-field
// inline sidebar form with nowhere to put a Notes panel. This modal is
// that missing detail surface -- mirrors AssetDetails.tsx's tab-bar shape
// (Details / Notes) at modal scale, replacing the old inline edit form
// entirely (creation still uses the lightweight inline form -- there's no
// entity to attach notes to until a category actually exists).

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Category } from "@/lib/dam-api";
import { updateCategory } from "@/lib/dam-api";
import { getDescendantIds } from "@/components/CategoryTree";
import { hasTackAccess } from "@/lib/auth-api";
import NotesPanel from "@/components/notes/NotesPanel";

interface Props {
  category: Category;
  categories: Category[];
  token: string;
  onClose: () => void;
  onUpdated: (cat: Category) => void;
}

export default function CategoryDetailsModal({ category, categories, token, onClose, onUpdated }: Props) {
  const t = useTranslations("browse");

  type Tab = "details" | "notes";
  const [activeTab, setActiveTab] = useState<Tab>("details");

  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [parentId, setParentId] = useState(category.parent_id ?? "");
  const [accessLevel, setAccessLevel] = useState(category.access_level ?? "Private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descendantIds = getDescendantIds(category.id, categories);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCategory(
        category.id,
        {
          name: name.trim(),
          description: description.trim() || null,
          parent_id: parentId || null,
          access_level: accessLevel,
        },
        token
      );
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">{t("categoryEditHeading")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-slate-200 shrink-0">
          {([
            { id: "details" as const, label: t("categoryTabDetails") },
            { id: "notes" as const, label: t("categoryTabNotes"), enabled: hasTackAccess(token) },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={tab.enabled === false}
              onClick={() => tab.enabled !== false && setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-700 text-blue-700"
                  : tab.enabled === false
                  ? "border-transparent text-slate-300 cursor-not-allowed"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" && (
            <form onSubmit={handleSave} className="p-6 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t("categoryNamePlaceholder")}
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t("categoryDescriptionPlaceholder")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t("categoryParentLabel")}
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">{t("categoryParentNone")}</option>
                  {categories
                    .filter((c) => c.id !== category.id && !descendantIds.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t("categoryAccessLevelLabel")}
                </label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="Private">Private</option>
                  <option value="Group">Group</option>
                  <option value="Global">Global</option>
                </select>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {t("categoryCancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white transition-colors"
                >
                  {saving ? t("categorySaving") : t("categorySave")}
                </button>
              </div>
            </form>
          )}

          {activeTab === "notes" && (
            <div className="p-2 min-h-[20rem]">
              <NotesPanel entityType="category" entityId={category.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
