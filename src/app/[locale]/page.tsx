import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

function DamIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full max-w-sm mx-auto" aria-hidden="true">
      {/* Folder base */}
      <rect x="20" y="60" width="280" height="165" rx="8" fill="white" fillOpacity="0.15" />
      <path d="M20 60 L20 52 Q20 44 28 44 L110 44 Q118 44 122 52 L128 60 Z" fill="white" fillOpacity="0.25" />

      {/* Image thumbnails — row 1 */}
      <rect x="32" y="72" width="72" height="56" rx="5" fill="#1e3a8a" fillOpacity="0.7" />
      <path d="M32 114 L52 92 L64 104 L74 96 L104 114 Z" fill="#60a5fa" fillOpacity="0.7" />
      <circle cx="88" cy="84" r="7" fill="#fbbf24" fillOpacity="0.8" />

      <rect x="116" y="72" width="72" height="56" rx="5" fill="#1e3a8a" fillOpacity="0.7" />
      <path d="M116 114 L138 98 L150 108 L162 90 L188 114 Z" fill="#34d399" fillOpacity="0.6" />
      <circle cx="174" cy="82" r="6" fill="#fbbf24" fillOpacity="0.8" />

      <rect x="200" y="72" width="72" height="56" rx="5" fill="#1e3a8a" fillOpacity="0.7" />
      {/* PDF icon */}
      <rect x="214" y="82" width="36" height="46" rx="3" fill="white" fillOpacity="0.2" />
      <rect x="218" y="88" width="24" height="3" rx="1" fill="#f87171" fillOpacity="0.9" />
      <rect x="218" y="95" width="20" height="3" rx="1" fill="white" fillOpacity="0.5" />
      <rect x="218" y="102" width="22" height="3" rx="1" fill="white" fillOpacity="0.5" />
      <text x="236" y="122" textAnchor="middle" fontSize="9" fill="white" fillOpacity="0.8" fontWeight="bold">PDF</text>

      {/* Image thumbnails — row 2 */}
      <rect x="32" y="140" width="72" height="56" rx="5" fill="#1e3a8a" fillOpacity="0.7" />
      {/* Doc icon */}
      <rect x="46" y="150" width="36" height="46" rx="3" fill="white" fillOpacity="0.2" />
      <rect x="50" y="156" width="24" height="3" rx="1" fill="#818cf8" fillOpacity="0.9" />
      <rect x="50" y="163" width="20" height="3" rx="1" fill="white" fillOpacity="0.5" />
      <rect x="50" y="170" width="22" height="3" rx="1" fill="white" fillOpacity="0.5" />
      <text x="64" y="190" textAnchor="middle" fontSize="9" fill="white" fillOpacity="0.8" fontWeight="bold">DOCX</text>

      <rect x="116" y="140" width="72" height="56" rx="5" fill="#1e3a8a" fillOpacity="0.7" />
      <path d="M116 182 L140 158 L154 170 L164 160 L188 182 Z" fill="#a78bfa" fillOpacity="0.6" />
      <circle cx="174" cy="150" r="6" fill="#fbbf24" fillOpacity="0.8" />

      <rect x="200" y="140" width="72" height="56" rx="5" fill="#1e3a8a" fillOpacity="0.7" />
      <path d="M200 182 L220 162 L236 174 L248 155 L272 182 Z" fill="#6ee7b7" fillOpacity="0.6" />
      <circle cx="258" cy="150" r="7" fill="#fbbf24" fillOpacity="0.8" />

      {/* Search overlay */}
      <circle cx="258" cy="40" r="18" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="256" cy="38" r="8" fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="2" />
      <line x1="262" y1="44" x2="268" y2="50" stroke="white" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />

      {/* Upload arrow */}
      <circle cx="48" cy="36" r="18" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
      <line x1="48" y1="44" x2="48" y2="26" stroke="white" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
      <polyline points="42,32 48,26 54,32" fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function LandingPage() {
  const t = await getTranslations("landing");

  const features = [
    { icon: "🗂️", title: t("features.categories.title"), description: t("features.categories.description") },
    { icon: "🔍", title: t("features.search.title"), description: t("features.search.description") },
    { icon: "✏️", title: t("features.metadata.title"), description: t("features.metadata.description") },
    { icon: "📤", title: t("features.upload.title"), description: t("features.upload.description") },
    { icon: "🖼️", title: t("features.editor.title"), description: t("features.editor.description") },
    { icon: "🔒", title: t("features.privacy.title"), description: t("features.privacy.description") },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-14">

        {/* Hero */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-600 px-8 py-12 sm:px-16 overflow-hidden shadow-xl">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            <div className="flex-1 text-white">
              <div className="flex items-center gap-3 mb-5">
                <svg className="w-12 h-12 shrink-0" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="32" cy="32" r="32" fill="white" fillOpacity="0.15"/>
                  <rect x="10" y="22" width="44" height="30" rx="4" fill="white" fillOpacity="0.9"/>
                  <path d="M10 22 L10 18 Q10 15 13 15 L26 15 Q29 15 30 18 L31 22 Z" fill="white"/>
                  <rect x="16" y="28" width="32" height="18" rx="2" fill="#1e40af"/>
                  <path d="M20 42 L28 32 L34 38 L38 34 L44 42 Z" fill="#60a5fa"/>
                  <circle cx="38" cy="32" r="3" fill="#fbbf24"/>
                </svg>
                <span className="text-4xl font-bold tracking-tight">Comad</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
                {t("heroHeading1")}<br />{t("heroHeading2")}
              </h1>
              <p className="text-blue-100 text-lg mb-8 max-w-md">{t("heroDescription")}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-2 bg-white text-blue-800 hover:bg-blue-50 font-semibold px-6 py-3 rounded-xl transition-colors shadow-md"
                >
                  {t("openBrowser")}
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 border border-white/40 text-white hover:bg-white/10 font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  {t("seePricing")}
                </Link>
              </div>
            </div>
            <div className="flex-1 w-full lg:max-w-sm opacity-90">
              <DamIllustration />
            </div>
          </div>
        </section>

        {/* Features */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">{t("featuresHeading")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-6">
          <p className="text-slate-500 mb-5">{t("ctaText")}</p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/browse"
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
            >
              {t("openBrowser")}
            </Link>
            <Link
              href="/pricing"
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {t("seePricing")}
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
