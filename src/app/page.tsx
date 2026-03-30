import Link from "next/link";

export default function HomePage() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <section className="rounded-3xl bg-gradient-to-br from-blue-800 to-blue-600 px-8 py-14 text-white text-center shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <svg className="w-14 h-14" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="32" fill="white" fillOpacity="0.15"/>
              <rect x="10" y="22" width="44" height="30" rx="4" fill="white" fillOpacity="0.9"/>
              <path d="M10 22 L10 18 Q10 15 13 15 L26 15 Q29 15 30 18 L31 22 Z" fill="white"/>
              <rect x="16" y="28" width="32" height="18" rx="2" fill="#1e40af"/>
              <path d="M20 42 L28 32 L34 38 L38 34 L44 42 Z" fill="#60a5fa"/>
              <circle cx="38" cy="32" r="3" fill="#fbbf24"/>
            </svg>
            <span className="text-4xl font-bold tracking-tight">DAM Browser</span>
          </div>
          <p className="text-blue-100 text-lg mb-8 max-w-md mx-auto">
            Organise, browse, and manage your digital assets — images, videos, documents and more.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 bg-white text-blue-800 hover:bg-blue-50 font-semibold px-8 py-3 rounded-xl transition-colors shadow-md"
          >
            Open Asset Browser
          </Link>
        </section>

        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: "🗂️", title: "Organised Categories", desc: "Browse assets by hierarchical category trees" },
            { icon: "🔍", title: "Fast Search", desc: "Find assets instantly by name, keywords, or caption" },
            { icon: "✏️", title: "Rich Metadata", desc: "Edit captions, keywords, creator info and rights" },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-slate-800 text-sm mb-1">{f.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
