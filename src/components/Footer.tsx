"use client";

import { useState } from "react";
import TermsModal from "@/components/TermsModal";
import DisclaimerModal from "@/components/DisclaimerModal";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  const [showTerms, setShowTerms] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-200 py-3 shrink-0">
        <div className="max-w-full px-4 sm:px-6 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>{t("copyright", { year: new Date().getFullYear() })}</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDisclaimer(true)}
              className="hover:text-slate-600 transition-colors underline underline-offset-2"
            >
              {t("disclaimer")}
            </button>
            <button
              onClick={() => setShowTerms(true)}
              className="hover:text-slate-600 transition-colors underline underline-offset-2"
            >
              {t("terms")}
            </button>
          </div>
        </div>
      </footer>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    </>
  );
}
