"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AboutModal from "@/components/AboutModal";
import UserAvatar, { userDisplayName } from "@/components/UserAvatar";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout, damAccess } = useAuth();
  const t = useTranslations("nav");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  function handleLogout() {
    setDropdownOpen(false);
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
    <>
      <header className="bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="max-w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
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
                  {/* Primary nav links */}
                  <Link href="/browse" className={navLink("/browse")}>
                    {t("assets")}
                  </Link>
                  <Link href="/team" className={navLink("/team")}>
                    {t("team")}
                  </Link>

                  {/* User dropdown */}
                  <div className="relative pl-3 border-l border-slate-200" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen((v) => !v)}
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                      aria-haspopup="true"
                      aria-expanded={dropdownOpen}
                    >
                      <UserAvatar user={user} size="md" />
                      <span className="hidden sm:block">{userDisplayName(user)}</span>
                      {/* Chevron */}
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M4 6l4 4 4-4H4z" />
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50">
                        <DropdownLink href="/account/subscription" onClick={() => setDropdownOpen(false)}>
                          {t("account")}
                        </DropdownLink>
                        <DropdownLink href="/help" onClick={() => setDropdownOpen(false)}>
                          {t("help")}
                        </DropdownLink>
                        <DropdownButton onClick={() => { setDropdownOpen(false); setShowAbout(true); }}>
                          {t("about")}
                        </DropdownButton>
                        <div className="my-1 border-t border-slate-100" />
                        <DropdownButton onClick={handleLogout} destructive>
                          {t("signOut")}
                        </DropdownButton>
                      </div>
                    )}
                  </div>
                </>
              ) : !isLoading ? (
                <>
                  <Link href="/pricing" className={navLink("/pricing")}>
                    {t("pricing")}
                  </Link>
                  <Link href="/help" className={navLink("/help")}>
                    {t("help")}
                  </Link>
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
                </>
              ) : null}
              <LocaleSwitcher />
            </nav>
          </div>
        </div>
      </header>

      {showAbout && (
        <AboutModal user={user} damAccess={damAccess} onClose={() => setShowAbout(false)} />
      )}
    </>
  );
}

function DropdownLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
    >
      {children}
    </Link>
  );
}

function DropdownButton({
  onClick,
  destructive = false,
  children,
}: {
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
