"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSubscription,
  updateProfile,
  type SubscriptionInfo,
} from "@/lib/auth-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    trialing: "bg-sky-100 text-sky-700",
    past_due: "bg-amber-100 text-amber-700",
    cancelled: "bg-slate-100 text-slate-500",
    pending: "bg-slate-100 text-slate-500",
  };
  const cls = colours[status] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const t = useTranslations("subscription");
  const { user, token, roles, setSession, isLoading } = useAuth();
  const router = useRouter();

  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    getSubscription("comad", token)
      .then(setSub)
      .catch((err) => setFetchError(err instanceof Error ? err.message : t("loadError")));
  }, [token, t]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const updated = await updateProfile(
        {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
        },
        token
      );
      setSession({ token, user: updated, roles });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t("profileSaveError"));
    } finally {
      setProfileSaving(false);
    }
  }

  if (isLoading || !user) return null;

  const isPaid = sub && sub.plan !== "individual";
  const isTrialing = sub?.status === "trialing";

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/browse" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          ← {t("backToBrowse")}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">{t("heading")}</h1>
      <p className="text-sm text-slate-500 mb-8">{t("subheading")}</p>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="font-semibold text-slate-800">{t("profileHeading")}</p>
          <p className="text-xs text-slate-400 mt-0.5">{user.username} · {user.email}</p>
        </div>
        <form onSubmit={handleProfileSave} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">{t("profileFirstName")}</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
                placeholder={t("profileFirstNamePlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">{t("profileLastName")}</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
                placeholder={t("profileLastNamePlaceholder")}
              />
            </div>
          </div>
          {profileError && (
            <p className="text-sm text-red-600">{profileError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={profileSaving}
              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {profileSaving ? t("profileSaving") : t("profileSave")}
            </button>
            {profileSaved && (
              <span className="text-sm text-emerald-600">{t("profileSaved")}</span>
            )}
          </div>
        </form>
      </div>

      {fetchError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm mb-6">
          {fetchError}
        </div>
      )}

      {sub && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {/* Plan header */}
          <div className="px-6 py-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
                {t("currentPlan")}
              </p>
              <p className="text-xl font-bold text-slate-900 capitalize">{sub.plan}</p>
              {isTrialing && sub.trial_end && (
                <p className="text-xs text-sky-600 mt-1">
                  {t("trialEnds", { date: formatDate(sub.trial_end) })}
                </p>
              )}
            </div>
            <StatusBadge status={sub.status} />
          </div>

          {/* Details grid */}
          <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4">
            <Detail label={t("product")} value="Comad" />
            <Detail label={t("seats")} value={String(sub.seat_count)} />
            {sub.current_period_start && (
              <Detail label={t("periodStart")} value={formatDate(sub.current_period_start)} />
            )}
            {sub.current_period_end && (
              <Detail label={t("periodEnd")} value={formatDate(sub.current_period_end)} />
            )}
            <Detail label={t("memberSince")} value={formatDate(sub.created_at)} />
          </div>

          {/* Actions */}
          {isPaid && (
            <div className="px-6 py-5 flex flex-col sm:flex-row gap-3">
              <button
                disabled
                className="inline-flex items-center justify-center bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {t("manageBilling")}
              </button>
              <button
                disabled
                className="inline-flex items-center justify-center border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {t("changePlan")}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-slate-400 text-center">
        {t("helpText")}{" "}
        <Link href="/help" className="underline hover:text-slate-600 transition-colors">
          {t("helpLink")}
        </Link>
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value}</p>
    </div>
  );
}
