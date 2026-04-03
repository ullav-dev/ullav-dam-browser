"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";

const TERMS_CONTENT = `
## Terms of Service

**Last updated: 2025**

### 1. Acceptance of Terms

By accessing and using the DAM Browser ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.

### 2. Use of the Service

The Service is provided for managing digital assets within your organisation. You agree to:

- Use the Service only for lawful purposes
- Not upload content that infringes third-party intellectual property rights
- Maintain the confidentiality of your login credentials
- Not attempt to gain unauthorised access to any part of the Service

### 3. Content and Intellectual Property

You retain ownership of any digital assets you upload. By uploading assets, you confirm that you have the rights to store and manage those assets through the Service.

### 4. Privacy

Your use of the Service is subject to our Privacy Policy. We collect only the information necessary to provide the Service and do not share personal data with third parties except as required by law.

### 5. Disclaimers

The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service.

### 6. Limitation of Liability

To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.

### 7. Changes to Terms

We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the revised terms.

### 8. Contact

For questions about these terms, please contact the system administrator.
`;

interface Props {
  onClose: () => void;
}

export default function TermsModal({ onClose }: Props) {
  const t = useTranslations("modals");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 id="terms-title" className="font-bold text-slate-800">{t("termsTitle")}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
            aria-label={t("close")}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 prose prose-slate prose-sm max-w-none">
          <ReactMarkdown>{TERMS_CONTENT}</ReactMarkdown>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 rounded-lg transition-colors text-sm"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
