import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function HelpPage() {
  const t = await getTranslations("help");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">{t("title")}</h1>
        <p className="text-slate-500">{t("subtitle")}</p>
      </div>

      <Section title={t("gettingStarted.title")} icon="🚀">
        <Steps>
          <Step number={1} title={t("gettingStarted.step1Title")} body={t("gettingStarted.step1Body")} />
          <Step number={2} title={t("gettingStarted.step2Title")} body={t("gettingStarted.step2Body")} />
          <Step number={3} title={t("gettingStarted.step3Title")} body={t("gettingStarted.step3Body")} />
          <Step number={4} title={t("gettingStarted.step4Title")} body={t("gettingStarted.step4Body")} />
        </Steps>
      </Section>

      <Section title={t("uploading.title")} icon="📤">
        <Cards>
          <Card title={t("uploading.singleTitle")} body={t("uploading.singleBody")} />
          <Card title={t("uploading.metadataTitle")} body={t("uploading.metadataBody")} />
          <Card title={t("uploading.zipTitle")} body={t("uploading.zipBody")} />
          <Card title={t("uploading.categoriesTitle")} body={t("uploading.categoriesBody")} />
        </Cards>
      </Section>

      <Section title={t("browsing.title")} icon="🔍">
        <Cards>
          <Card title={t("browsing.categoriesTitle")} body={t("browsing.categoriesBody")} />
          <Card title={t("browsing.searchTitle")} body={t("browsing.searchBody")} />
          <Card title={t("browsing.sortTitle")} body={t("browsing.sortBody")} />
          <Card title={t("browsing.myAssetsTitle")} body={t("browsing.myAssetsBody")} />
        </Cards>
      </Section>

      <Section title={t("multiSelect.title")} icon="☑️">
        <Cards>
          <Card title={t("multiSelect.selectTitle")} body={t("multiSelect.selectBody")} />
          <Card title={t("multiSelect.rangeTitle")} body={t("multiSelect.rangeBody")} />
          <Card title={t("multiSelect.selectAllTitle")} body={t("multiSelect.selectAllBody")} />
          <Card title={t("multiSelect.downloadTitle")} body={t("multiSelect.downloadBody")} />
          <Card title={t("multiSelect.deleteTitle")} body={t("multiSelect.deleteBody")} />
          <Card title={t("multiSelect.clearTitle")} body={t("multiSelect.clearBody")} />
        </Cards>
      </Section>

      <Section title={t("categories.title")} icon="🗂️">
        <Cards>
          <Card title={t("categories.createTitle")} body={t("categories.createBody")} />
          <Card title={t("categories.hierarchyTitle")} body={t("categories.hierarchyBody")} />
          <Card title={t("categories.assignTitle")} body={t("categories.assignBody")} />
          <Card title={t("categories.moveTitle")} body={t("categories.moveBody")} />
        </Cards>
      </Section>

      <Section title={t("assetDetails.title")} icon="📝">
        <Cards>
          <Card title={t("assetDetails.fieldsTitle")} body={t("assetDetails.fieldsBody")} />
          <Card title={t("assetDetails.availabilityTitle")} body={t("assetDetails.availabilityBody")} />
          <Card title={t("assetDetails.saveTitle")} body={t("assetDetails.saveBody")} />
          <Card title={t("assetDetails.categoriesTitle")} body={t("assetDetails.categoriesBody")} />
        </Cards>
      </Section>

      <Section title={t("imageEditor.title")} icon="✂️">
        <Steps>
          <Step number={1} title={t("imageEditor.step1Title")} body={t("imageEditor.step1Body")} />
          <Step number={2} title={t("imageEditor.step2Title")} body={t("imageEditor.step2Body")} />
          <Step number={3} title={t("imageEditor.step3Title")} body={t("imageEditor.step3Body")} />
          <Step number={4} title={t("imageEditor.step4Title")} body={t("imageEditor.step4Body")} />
        </Steps>
        <div className="mt-4">
          <Cards>
            <Card title={t("imageEditor.cropTitle")} body={t("imageEditor.cropBody")} />
            <Card title={t("imageEditor.rotateTitle")} body={t("imageEditor.rotateBody")} />
            <Card title={t("imageEditor.saveAsNewTitle")} body={t("imageEditor.saveAsNewBody")} />
            <Card title={t("imageEditor.replaceTitle")} body={t("imageEditor.replaceBody")} />
          </Cards>
        </div>
      </Section>

      <Section title={t("visibility.title")} icon="🔒">
        <Cards>
          <Card title={t("visibility.overviewTitle")} body={t("visibility.overviewBody")} />
          <Card title={t("visibility.makePublicTitle")} body={t("visibility.makePublicBody")} />
          <Card title={t("visibility.readTitle")} body={t("visibility.readBody")} />
          <Card title={t("visibility.downloadTitle")} body={t("visibility.downloadBody")} />
          <Card title={t("visibility.writeTitle")} body={t("visibility.writeBody")} />
          <Card title={t("visibility.revertTitle")} body={t("visibility.revertBody")} />
        </Cards>
      </Section>

      <Section title={t("locking.title")} icon="🗑️">
        <Cards>
          <Card title={t("locking.lockTitle")} body={t("locking.lockBody")} />
          <Card title={t("locking.unlockTitle")} body={t("locking.unlockBody")} />
          <Card title={t("locking.deleteTitle")} body={t("locking.deleteBody")} />
          <Card title={t("locking.downloadTitle")} body={t("locking.downloadBody")} />
        </Cards>
      </Section>

      <div className="rounded-2xl bg-blue-50 border border-blue-200 px-6 py-5 flex items-center justify-between gap-4">
        <p className="text-blue-800 text-sm">{t("cta")}</p>
        <Link
          href="/browse"
          className="shrink-0 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {t("ctaButton")}
        </Link>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function Step({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <div className="flex gap-4 bg-white rounded-xl border border-slate-200 p-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">
        {number}
      </div>
      <div>
        <p className="font-semibold text-slate-800 text-sm mb-1">{title}</p>
        <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Cards({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="font-semibold text-slate-800 text-sm mb-1">{title}</p>
      <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
    </div>
  );
}
