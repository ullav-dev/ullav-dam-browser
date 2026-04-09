"use client";

import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const t = useTranslations("nav");

  function handleLogout() {
    logout();
    router.push("/");
  }

  const navLink = (path: string) =>
    `text-sm font-medium transition-colors ${
      pathname.startsWith(path)
        ? "text-blue-700"
        : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm shrink-0">
      <div className="max-w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <svg className="w-7 h-7" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="32" fill="#1d4ed8"/>
              <rect x="10" y="22" width="44" height="30" rx="4" fill="#93c5fd"/>
              <path d="M10 22 L10 18 Q10 15 13 15 L26 15 Q29 15 30 18 L31 22 Z" fill="#bfdbfe"/>
              <rect x="16" y="28" width="32" height="18" rx="2" fill="#1e40af"/>
              <path d="M20 42 L28 32 L34 38 L38 34 L44 42 Z" fill="#60a5fa"/>
              <circle cx="38" cy="32" r="3" fill="#fbbf24"/>
            </svg>
            <span className="font-bold text-lg text-slate-800 tracking-tight">Comad</span>
          </Link>

          <nav className="flex items-center gap-4">
            {!isLoading && user ? (
              <>
                <Link href="/browse" className={navLink("/browse")}>
                  {t("assets")}
                </Link>
                <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                  <span className="text-sm text-slate-500 hidden sm:block">{user.username}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {t("signOut")}
                  </button>
                </div>
              </>
            ) : !isLoading ? (
              <Link
                href="/login"
                className={`text-sm font-medium px-4 py-1.5 rounded-lg border transition-colors ${
                  pathname === "/login"
                    ? "border-blue-600 text-blue-700 bg-blue-50"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t("signIn")}
              </Link>
            ) : null}
            <Link href="/help" className={navLink("/help")}>
              {t("help")}
            </Link>
            <LocaleSwitcher />
          </nav>
        </div>
      </div>
    </header>
  );
}
