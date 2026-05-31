"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { CustomFieldSchema, CustomFieldType } from "@/lib/dam-api";
import {
  listCustomFieldSchemas,
  createCustomFieldSchema,
  updateCustomFieldSchema,
  deleteCustomFieldSchema,
} from "@/lib/dam-api";

const KEY_REGEX = /^[a-z][a-z0-9_]*$/;

const FIELD_TYPES: CustomFieldType[] = ["String", "Boolean", "Integer", "Float", "DateTime"];

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm w-full focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function typeBadge(type: CustomFieldType) {
  const colours: Record<CustomFieldType, string> = {
    String: "bg-slate-100 text-slate-600",
    Boolean: "bg-purple-50 text-purple-700",
    Integer: "bg-blue-50 text-blue-700",
    Float: "bg-cyan-50 text-cyan-700",
    DateTime: "bg-amber-50 text-amber-700",
  };
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colours[type]}`;
}

interface Props {
  teamId: string;
  token: string;
  isAdmin: boolean;
}

export default function TeamCustomFields({ teamId, token, isAdmin }: Props) {
  const t = useTranslations("team");

  const [schemas, setSchemas] = useState<CustomFieldSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("String");
  const [newRequired, setNewRequired] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRequired, setEditRequired] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCustomFieldSchemas(teamId, token)
      .then((s) => { if (!cancelled) { setSchemas(s); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed to load"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [teamId, token]);

  function resetCreate() {
    setNewKey("");
    setNewName("");
    setNewType("String");
    setNewRequired(false);
    setCreateError(null);
    setShowCreate(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const key = newKey.trim();
    const name = newName.trim();
    if (!KEY_REGEX.test(key)) {
      setCreateError(t("fieldKeyInvalid"));
      return;
    }
    if (!name) {
      setCreateError(t("fieldNameRequired"));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const schema = await createCustomFieldSchema(teamId, { key, name, field_type: newType, required: newRequired }, token);
      setSchemas((prev) => [...prev, schema].sort((a, b) => a.name.localeCompare(b.name)));
      resetCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t("fieldCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(schema: CustomFieldSchema) {
    setEditingId(schema.id);
    setEditName(schema.name);
    setEditRequired(schema.required);
    setEditError(null);
  }

  async function handleEditSave(schemaId: string) {
    const name = editName.trim();
    if (!name) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateCustomFieldSchema(teamId, schemaId, { name, required: editRequired }, token);
      setSchemas((prev) => prev.map((s) => s.id === schemaId ? updated : s).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t("fieldUpdateFailed"));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(schema: CustomFieldSchema) {
    if (!confirm(t("deleteFieldConfirm", { name: schema.name }))) return;
    try {
      await deleteCustomFieldSchema(teamId, schema.id, token);
      setSchemas((prev) => prev.filter((s) => s.id !== schema.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("fieldDeleteFailed"));
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-8">{t("loading")}</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 text-center py-8">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {schemas.length === 0 && !showCreate ? (
        <p className="text-sm text-slate-400 text-center py-8">{t("noCustomFields")}</p>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {schemas.map((schema) => (
            <div key={schema.id} className="p-3">
              {editingId === schema.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{schema.key}</code>
                    <span className={typeBadge(schema.field_type)}>{t(`fieldType_${schema.field_type}`)}</span>
                  </div>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputCls}
                    autoFocus
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRequired}
                      onChange={(e) => setEditRequired(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {t("fieldRequired")}
                  </label>
                  {editError && <p className="text-xs text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={editSaving}
                      className="text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      onClick={() => handleEditSave(schema.id)}
                      disabled={editSaving}
                      className="text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
                    >
                      {editSaving ? t("saving") : t("save")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{schema.name}</span>
                      {schema.required && (
                        <span className="text-xs text-red-500 font-medium">*</span>
                      )}
                      <span className={typeBadge(schema.field_type)}>{t(`fieldType_${schema.field_type}`)}</span>
                    </div>
                    <code className="text-xs font-mono text-slate-400">{schema.key}</code>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(schema)}
                        className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        {t("edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(schema)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        {t("deleteField")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        showCreate ? (
          <form onSubmit={handleCreate} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
            <p className="text-sm font-medium text-slate-700">{t("addField")}</p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t("fieldKey")}</label>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toLowerCase())}
                placeholder="e.g. project_code"
                className={inputCls}
                autoFocus
              />
              <p className="text-xs text-slate-400">{t("fieldKeyHint")}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t("fieldDisplayName")}</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Project Code"
                className={inputCls}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t("fieldType")}</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CustomFieldType)}
                className={inputCls}
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{t(`fieldType_${ft}`)}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {t("fieldRequired")}
            </label>

            {createError && <p className="text-xs text-red-600">{createError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetCreate}
                disabled={creating}
                className="text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
              >
                {creating ? t("creating") : t("createField")}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full text-sm font-medium text-blue-700 hover:text-blue-800 border border-dashed border-blue-300 hover:border-blue-500 rounded-xl py-3 transition-colors"
          >
            + {t("addField")}
          </button>
        )
      )}
    </div>
  );
}
