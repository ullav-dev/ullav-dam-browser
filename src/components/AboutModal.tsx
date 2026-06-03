"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AuthUser, DamAccess } from "@/lib/auth-api";

interface Props {
  user: AuthUser | null;
  damAccess: DamAccess;
  onClose: () => void;
}

export default function AboutModal({ user, damAccess, onClose }: Props) {
  const t = useTranslations("about");

  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";

  const planLabel = damAccess === "full" ? t("planFull") : t("planNone");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-700 px-6 py-5 flex items-center gap-4">
          <svg className="w-10 h-10 shrink-0" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="32" fill="#1d4ed8"/>
            <rect x="10" y="22" width="44" height="30" rx="4" fill="#93c5fd"/>
            <path d="M10 22 L10 18 Q10 15 13 15 L26 15 Q29 15 30 18 L31 22 Z" fill="#bfdbfe"/>
            <rect x="16" y="28" width="32" height="18" rx="2" fill="#1e40af"/>
            <path d="M20 42 L28 32 L34 38 L38 34 L44 42 Z" fill="#60a5fa"/>
            <circle cx="38" cy="32" r="3" fill="#fbbf24"/>
          </svg>
          <div>
            <p className="font-bold text-xl text-white leading-tight">Comad</p>
            <p className="text-blue-200 text-sm">{t("tagline")}</p>
          </div>
        </div>

        {/* Info */}
        <div className="px-6 py-5">
          <dl className="divide-y divide-slate-100">
            <Row label={t("version")} value={`v${version}`} mono={false} />
            <Row label={t("build")} value={gitSha} mono />
            {user && (
              <>
                <Row label={t("user")} value={user.username} mono={false} />
                <Row label={t("plan")} value={planLabel} mono={false} />
              </>
            )}
            <EmailRow label={t("support")} email="support@ullav.com" color="text-blue-700" />
            <EmailRow label={t("contact")} email="info@ullav.com" color="text-blue-700" />
          </dl>
        </div>

        {/* Links */}
        {user && (
          <div className="px-6 pb-4 flex gap-2">
            <Link
              href="/help"
              onClick={onClose}
              className="flex-1 text-center text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {t("helpLink")}
            </Link>
            <Link
              href="/account/subscription"
              onClick={onClose}
              className="flex-1 text-center text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {t("accountLink")}
            </Link>
          </div>
        )}

        {/* Close */}
        <div className="px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <dt className="text-sm text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-sm font-medium text-slate-800 truncate text-right ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function EmailRow({ label, email, color }: { label: string; email: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <dt className="text-sm text-slate-500 shrink-0">{label}</dt>
      <dd className="text-sm text-right">
        <a href={`mailto:${email}`} className={`font-medium ${color} hover:underline`}>{email}</a>
      </dd>
    </div>
  );
}
