"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";

export default function SubscriptionSuccessPage() {
  const t = useTranslations("subscriptionSuccess");
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{t("heading")}</h1>
        <p className="text-sm text-slate-500 mb-8">{t("message")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/account/subscription"
            className="inline-flex items-center justify-center bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {t("viewSubscription")}
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {t("goToBrowse")}
          </Link>
        </div>
      </div>
    </div>
  );
}
