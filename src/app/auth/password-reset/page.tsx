"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset } from "@/lib/auth-api";
import PasswordInput from "@/components/PasswordInput";

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm w-full focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function PasswordResetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-sm text-red-600 mb-4">Invalid or missing reset token.</p>
          <Link href="/login" className="text-sm text-blue-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="font-bold text-lg text-slate-800 mb-2">Password updated!</h1>
          <p className="text-sm text-slate-600 mb-4">Redirecting to sign in…</p>
          <Link href="/login" className="text-sm text-blue-700 hover:underline">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8">
        <h1 className="font-bold text-lg text-slate-800 mb-6">Set new password</h1>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="new-password" className="text-sm font-medium text-slate-700">
              New password
            </label>
            <PasswordInput
              id="new-password"
              required
              minLength={8}
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <PasswordInput
              id="confirm-password"
              required
              value={confirm}
              onChange={setConfirm}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !password || !confirm}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {submitting ? "Please wait…" : "Set new password"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs">
          <Link href="/login" className="text-slate-500 hover:text-slate-700 transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetContent />
    </Suspense>
  );
}
