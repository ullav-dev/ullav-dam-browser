"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import { confirmEmail } from "@/lib/auth-api";
import { useTranslations } from "next-intl";

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("confirmEmail");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage(t("errorNoToken"));
      return;
    }
    confirmEmail(token)
      .then(() => {
        setStatus("success");
        setTimeout(() => router.push("/login"), 3000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : t("failureTitle"));
      });
  }, [searchParams, router, t]);

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
        {status === "loading" && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">{t("loadingTitle")}</h1>
            <p className="text-sm text-slate-500">{t("loadingBody")}</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">{t("successTitle")}</h1>
            <p className="text-sm text-slate-600 mb-4">{t("successBody")}</p>
            <Link href="/login" className="text-sm text-blue-700 hover:underline">
              {t("goToSignIn")}
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">{t("failureTitle")}</h1>
            <p className="text-sm text-red-600 mb-4">{message}</p>
            <Link href="/login" className="text-sm text-blue-700 hover:underline">
              {t("goToSignIn")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
