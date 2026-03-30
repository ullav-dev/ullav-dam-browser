"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { confirmEmail } from "@/lib/auth-api";

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No confirmation token found in the URL.");
      return;
    }
    confirmEmail(token)
      .then(() => {
        setStatus("success");
        setTimeout(() => router.push("/login"), 3000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Confirmation failed.");
      });
  }, [searchParams, router]);

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
        {status === "loading" && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">Confirming your email…</h1>
            <p className="text-sm text-slate-500">Please wait.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">Email confirmed!</h1>
            <p className="text-sm text-slate-600 mb-4">
              Your account is now active. Redirecting to sign in…
            </p>
            <Link href="/login" className="text-sm text-blue-700 hover:underline">
              Go to sign in
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="font-bold text-lg text-slate-800 mb-2">Confirmation failed</h1>
            <p className="text-sm text-red-600 mb-4">{message}</p>
            <Link href="/login" className="text-sm text-blue-700 hover:underline">
              Back to sign in
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
