"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";

const DISCLAIMER_CONTENT = `
## Disclaimer

**Last updated: 2025**

### No Warranty

The DAM Browser is provided for internal use without any warranty, express or implied. The system administrators and developers make no representations regarding the accuracy, reliability, or completeness of the Service.

### Asset Responsibility

You are solely responsible for the digital assets you upload, store, and manage through this Service. You must ensure that:

- You have the legal right to upload and store each asset
- Assets do not violate any applicable laws or regulations
- Copyright and intellectual property rights are respected
- Appropriate licences are in place for all stored content

### Data Storage

Assets are stored on designated infrastructure. While reasonable precautions are taken to protect stored data, no system is entirely secure. You should maintain independent backups of critical assets.

### Availability

The Service may be subject to scheduled maintenance or unplanned downtime. We do not guarantee continuous or uninterrupted access to the Service or its stored assets.

### Limitation

This disclaimer does not limit any liability that cannot be excluded under applicable law. If you have concerns about specific assets or usage rights, please consult your organisation's legal team.
`;

interface Props {
  onClose: () => void;
}

export default function DisclaimerModal({ onClose }: Props) {
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
        aria-labelledby="disclaimer-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 id="disclaimer-title" className="font-bold text-slate-800">Disclaimer</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 prose prose-slate prose-sm max-w-none">
          <ReactMarkdown>{DISCLAIMER_CONTENT}</ReactMarkdown>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 rounded-lg transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
