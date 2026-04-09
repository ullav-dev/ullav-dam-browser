"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { register, requestPasswordReset } from "@/lib/auth-api";
import PasswordInput from "@/components/PasswordInput";
import TermsModal from "@/components/TermsModal";
import DisclaimerModal from "@/components/DisclaimerModal";
import { useTranslations } from "next-intl";

type Tab = "login" | "register";
type Stage = "form" | "verify-email" | "reset-request";

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm w-full focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function SubmitButton({
  loading,
  disabled,
  label,
}: {
  loading: boolean;
  disabled?: boolean;
  label: string;
}) {
  const t = useTranslations("login");
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
    >
      {loading ? t("pleaseWait") : label}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
      {message}
    </div>
  );
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const t = useTranslations("login");

  const [tab, setTab] = useState<Tab>("login");
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regTerms, setRegTerms] = useState(false);
  const [regDisclaimer, setRegDisclaimer] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/browse");
  }, [isLoading, user, router]);

  function errorMessage(err: unknown, fallback: string): string {
    const msg = err instanceof Error ? err.message : "";
    if (/^HTTP 5/.test(msg)) return t("errorServer");
    return msg || fallback;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
      router.push("/browse");
    } catch (err) {
      setError(errorMessage(err, t("errorLoginFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (regPassword !== regConfirm) return setError(t("errorPasswordMismatch"));
    if (!regDisclaimer) return setError(t("errorAcceptDisclaimer"));
    if (!regTerms) return setError(t("errorAcceptTerms"));
    setSubmitting(true);
    try {
      const confirmUrl = window.location.origin;
      await register(regUsername, regEmail, regPassword, confirmUrl);
      setPendingEmail(regEmail);
      setStage("verify-email");
    } catch (err) {
      setError(errorMessage(err, t("errorRegisterFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resetUrl = window.location.origin;
      await requestPasswordReset(resetEmail, resetUrl);
      setResetSent(true);
    } catch (err) {
      setError(errorMessage(err, t("errorResetFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  if (stage === "verify-email") {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="font-bold text-lg text-slate-800 mb-2">{t("checkEmailTitle")}</h1>
          <p
            className="text-sm text-slate-600 mb-6"
            dangerouslySetInnerHTML={{ __html: t("checkEmailBody", { email: pendingEmail }) }}
          />
          {error && <ErrorBox message={error} />}
          <button
            type="button"
            onClick={() => {
              setStage("form");
              setTab("login");
              setError(null);
            }}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {t("backToSignIn")}
          </button>
        </div>
      </div>
    );
  }

  if (stage === "reset-request") {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-7 h-7" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="#1d4ed8"/>
              <rect x="10" y="22" width="44" height="30" rx="4" fill="#93c5fd"/>
              <path d="M10 22 L10 18 Q10 15 13 15 L26 15 Q29 15 30 18 L31 22 Z" fill="#bfdbfe"/>
              <rect x="16" y="28" width="32" height="18" rx="2" fill="#1e40af"/>
              <path d="M20 42 L28 32 L34 38 L38 34 L44 42 Z" fill="#60a5fa"/>
              <circle cx="38" cy="32" r="3" fill="#fbbf24"/>
            </svg>
            <span className="font-bold text-lg text-slate-800">{t("resetPasswordTitle")}</span>
          </div>
          {error && <ErrorBox message={error} />}
          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-sm text-slate-600">{t("resetSentBody")}</p>
              <button
                type="button"
                onClick={() => {
                  setStage("form");
                  setError(null);
                  setResetSent(false);
                }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {t("backToSignIn")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <Field label={t("resetEmailLabel")} htmlFor="reset-email">
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoFocus
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <SubmitButton loading={submitting} label={t("sendResetLink")} />
              <button
                type="button"
                onClick={() => {
                  setStage("form");
                  setError(null);
                }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {t("backToSignIn")}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <svg className="w-8 h-8" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="#1d4ed8"/>
            <rect x="10" y="22" width="44" height="30" rx="4" fill="#93c5fd"/>
            <path d="M10 22 L10 18 Q10 15 13 15 L26 15 Q29 15 30 18 L31 22 Z" fill="#bfdbfe"/>
            <rect x="16" y="28" width="32" height="18" rx="2" fill="#1e40af"/>
            <path d="M20 42 L28 32 L34 38 L38 34 L44 42 Z" fill="#60a5fa"/>
            <circle cx="38" cy="32" r="3" fill="#fbbf24"/>
          </svg>
          <span className="font-bold text-lg text-slate-800">Comad</span>
        </div>

        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {(["login", "register"] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => {
                setTab(tabKey);
                setError(null);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === tabKey
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tabKey === "login" ? t("tabSignIn") : t("tabCreateAccount")}
            </button>
          ))}
        </div>

        {error && <ErrorBox message={error} />}

        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label={t("emailLabel")} htmlFor="login-email">
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t("passwordLabel")} htmlFor="login-password">
              <PasswordInput
                id="login-password"
                required
                value={loginPassword}
                onChange={setLoginPassword}
              />
            </Field>
            <SubmitButton loading={submitting} label={t("tabSignIn")} />
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setStage("reset-request");
                  setError(null);
                }}
                className="text-sm text-slate-500 hover:text-blue-700 transition-colors"
              >
                {t("forgotPassword")}
              </button>
            </div>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label={t("usernameLabel")} htmlFor="reg-username">
              <input
                id="reg-username"
                required
                autoFocus
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className={inputCls}
                placeholder={t("usernamePlaceholder")}
              />
            </Field>
            <Field label={t("emailLabel")} htmlFor="reg-email">
              <input
                id="reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t("passwordLabel")} htmlFor="reg-password">
              <PasswordInput
                id="reg-password"
                required
                minLength={8}
                value={regPassword}
                onChange={setRegPassword}
                placeholder={t("passwordPlaceholder")}
              />
            </Field>
            <Field label={t("confirmPasswordLabel")} htmlFor="reg-confirm">
              <PasswordInput
                id="reg-confirm"
                required
                value={regConfirm}
                onChange={setRegConfirm}
              />
            </Field>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={regDisclaimer}
                onChange={(e) => setRegDisclaimer(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="text-sm text-slate-700">
                {t("disclaimerCheckbox")}{" "}
                <button
                  type="button"
                  onClick={() => setShowDisclaimer(true)}
                  className="text-blue-700 underline hover:text-blue-800 transition-colors"
                >
                  {t("disclaimerLink")}
                </button>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={regTerms}
                onChange={(e) => setRegTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="text-sm text-slate-700">
                {t("termsCheckbox")}{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-blue-700 underline hover:text-blue-800 transition-colors"
                >
                  {t("termsLink")}
                </button>
              </span>
            </label>

            <SubmitButton
              loading={submitting}
              disabled={
                !regUsername ||
                !regEmail ||
                !regPassword ||
                !regConfirm ||
                !regDisclaimer ||
                !regTerms
              }
              label={t("tabCreateAccount")}
            />
          </form>
        )}

        {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
        {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600 transition-colors">
            {t("backToHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
