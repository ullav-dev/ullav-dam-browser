"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/lib/auth-api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Plan = "individual" | "team" | "enterprise";

interface PlanDef {
  key: Plan;
  highlight?: boolean;
}

const PLANS: PlanDef[] = [
  { key: "individual" },
  { key: "team", highlight: true },
  { key: "enterprise" },
];

// ── Checkout modal ────────────────────────────────────────────────────────────

function CheckoutModal({
  plan,
  onClose,
  token,
}: {
  plan: Plan;
  onClose: () => void;
  token: string;
}) {
  const t = useTranslations("pricing");
  const [provider, setProvider] = useState<"stripe" | "paypal">("stripe");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { url } = await createCheckoutSession(provider, "comad", plan, 1, token);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("checkoutError"));
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-semibold text-slate-800 mb-1">
          {t("checkoutTitle")}
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          {t(`plans.${plan}.name`)}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              {t("paymentProvider")}
            </label>
            <div className="flex gap-2">
              {(["stripe", "paypal"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    provider === p
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p === "stripe" ? "💳 Stripe" : "🅿 PayPal"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? t("redirecting") : t("proceedToPayment")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {t("cancel")}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  planDef,
  onSubscribe,
  isLoggedIn,
}: {
  planDef: PlanDef;
  onSubscribe: (plan: Plan) => void;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("pricing");
  const router = useRouter();
  const { key: plan, highlight } = planDef;

  const isEnterprise = plan === "enterprise";
  const isFree = plan === "individual";

  function handleCta() {
    if (isEnterprise) {
      router.push("/help");
      return;
    }
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (isFree) {
      router.push("/browse");
      return;
    }
    onSubscribe(plan);
  }

  const features = (t.raw(`plans.${plan}.features`) as string[]) ?? [];

  return (
    <div
      className={`relative flex flex-col bg-white rounded-2xl border shadow-sm p-6 ${
        highlight
          ? "border-blue-400 ring-2 ring-blue-400/30"
          : "border-slate-200"
      }`}
    >
      {highlight && (
        <div className="absolute top-4 right-4 text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
          {t("mostPopular")}
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-800">
          {t(`plans.${plan}.name`)}
        </h3>
        <div className="mt-2 flex items-end gap-1">
          <span className="text-3xl font-bold text-slate-900">
            {t(`plans.${plan}.price`)}
          </span>
          {!isFree && !isEnterprise && (
            <span className="text-sm text-slate-400 mb-1">{t("perMonth")}</span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-2">
          {t(`plans.${plan}.description`)}
        </p>
      </div>

      <ul className="flex-1 space-y-2 mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-0.5 text-blue-600 shrink-0">✓</span>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={handleCta}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
          highlight
            ? "bg-blue-700 hover:bg-blue-800 text-white"
            : isEnterprise
            ? "border border-slate-300 text-slate-700 hover:bg-slate-50"
            : "border border-blue-600 text-blue-700 hover:bg-blue-50"
        }`}
      >
        {t(`plans.${plan}.cta`)}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const t = useTranslations("pricing");
  const { user, token } = useAuth();
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  return (
    <div className="py-8 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">{t("heading")}</h1>
        <p className="text-slate-500 max-w-xl mx-auto">{t("subheading")}</p>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto">
        {PLANS.map((planDef) => (
          <PlanCard
            key={planDef.key}
            planDef={planDef}
            isLoggedIn={!!user}
            onSubscribe={(plan) => setCheckoutPlan(plan)}
          />
        ))}
      </div>

      <p className="text-center text-xs text-slate-400 mt-10">
        {t("trialNote")}{" "}
        <Link href="/help" className="underline hover:text-slate-600 transition-colors">
          {t("learnMore")}
        </Link>
      </p>

      {checkoutPlan && token && (
        <CheckoutModal
          plan={checkoutPlan}
          token={token}
          onClose={() => setCheckoutPlan(null)}
        />
      )}
    </div>
  );
}
