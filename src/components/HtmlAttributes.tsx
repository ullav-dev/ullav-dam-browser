"use client";

import { useEffect } from "react";

/** Applies lang and body className after hydration to match what the server renders. */
export default function HtmlAttributes({ locale, bodyClass }: { locale: string; bodyClass: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.body.className = bodyClass;
  }, [locale, bodyClass]);
  return null;
}
