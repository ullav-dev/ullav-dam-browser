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
import UserAvatar from "@/components/UserAvatar";

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

async function gravatarUrl(email: string): Promise<string> {
  const normalised = email.toLowerCase().trim();
  const encoded = new TextEncoder().encode(normalised);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://gravatar.com/avatar/${hex}?s=200&d=identicon`;
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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [gravatarLoading, setGravatarLoading] = useState(false);
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
      setAvatarUrl(user.avatar_url ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    getSubscription("comad", token)
      .then(setSub)
      .catch((err) => setFetchError(err instanceof Error ? err.message : t("loadError")));
  }, [token, t]);

  async function handleUseGravatar() {
    if (!user) return;
    setGravatarLoading(true);
    try {
      setAvatarUrl(await gravatarUrl(user.email));
    } finally {
      setGravatarLoading(false);
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user) return;

    const trimmedUrl = avatarUrl.trim();
    if (trimmedUrl && !trimmedUrl.startsWith("https://")) {
      setProfileError(t("avatarHttpsRequired"));
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const updated = await updateProfile(
        {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          avatar_url: trimmedUrl || null,
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

  // Preview user with current form values so the avatar updates live.
  const previewUser = {
    username: user.username,
    first_name: firstName || null,
    last_name: lastName || null,
    avatar_url: avatarUrl || null,
  };

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
        <form onSubmit={handleProfileSave} className="px-6 py-5 space-y-5">

          {/* Avatar row */}
          <div className="flex items-start gap-4">
            {/* Live preview — key on avatarUrl remounts to reset internal broken state */}
            <div className="shrink-0">
              <UserAvatar key={avatarUrl} user={previewUser} size="lg" />
            </div>

            {/* Avatar URL input + gravatar */}
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">{t("avatarLabel")}</label>
              <div className="flex gap-2">
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://…"
                  type="url"
                />
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="shrink-0 text-xs text-slate-400 hover:text-red-500 transition-colors px-2"
                    title={t("avatarClear")}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleUseGravatar}
                disabled={gravatarLoading}
                className="self-start text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors disabled:opacity-50 mt-0.5"
              >
                {gravatarLoading ? t("avatarGravatarLoading") : t("avatarUseGravatar")}
              </button>
            </div>
          </div>

          {/* Name fields */}
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
