"use client";

import { useState } from "react";
import TermsModal from "@/components/TermsModal";
import DisclaimerModal from "@/components/DisclaimerModal";

export default function Footer() {
  const [showTerms, setShowTerms] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-200 py-3 shrink-0">
        <div className="max-w-full px-4 sm:px-6 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} DAM Browser</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDisclaimer(true)}
              className="hover:text-slate-600 transition-colors underline underline-offset-2"
            >
              Disclaimer
            </button>
            <button
              onClick={() => setShowTerms(true)}
              className="hover:text-slate-600 transition-colors underline underline-offset-2"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    </>
  );
}
