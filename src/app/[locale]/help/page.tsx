import { getTranslations } from "next-intl/server";
import HelpPageClient, { type HelpSection } from "@/components/HelpPageClient";

export default async function HelpPage() {
  const t = await getTranslations("help");

  const sections: HelpSection[] = [
    {
      id: "gettingStarted",
      icon: "🚀",
      title: t("gettingStarted.title"),
      steps: [
        { number: 1, title: t("gettingStarted.step1Title"), body: t("gettingStarted.step1Body") },
        { number: 2, title: t("gettingStarted.step2Title"), body: t("gettingStarted.step2Body") },
        { number: 3, title: t("gettingStarted.step3Title"), body: t("gettingStarted.step3Body") },
        { number: 4, title: t("gettingStarted.step4Title"), body: t("gettingStarted.step4Body") },
      ],
    },
    {
      id: "uploading",
      icon: "📤",
      title: t("uploading.title"),
      cards: [
        { title: t("uploading.singleTitle"), body: t("uploading.singleBody") },
        { title: t("uploading.metadataTitle"), body: t("uploading.metadataBody") },
        { title: t("uploading.zipTitle"), body: t("uploading.zipBody") },
        { title: t("uploading.categoriesTitle"), body: t("uploading.categoriesBody") },
      ],
    },
    {
      id: "browsing",
      icon: "🔍",
      title: t("browsing.title"),
      cards: [
        { title: t("browsing.categoriesTitle"), body: t("browsing.categoriesBody") },
        { title: t("browsing.searchTitle"), body: t("browsing.searchBody") },
        { title: t("browsing.sortTitle"), body: t("browsing.sortBody") },
        { title: t("browsing.myAssetsTitle"), body: t("browsing.myAssetsBody") },
      ],
    },
    {
      id: "multiSelect",
      icon: "☑️",
      title: t("multiSelect.title"),
      cards: [
        { title: t("multiSelect.selectTitle"), body: t("multiSelect.selectBody") },
        { title: t("multiSelect.rangeTitle"), body: t("multiSelect.rangeBody") },
        { title: t("multiSelect.selectAllTitle"), body: t("multiSelect.selectAllBody") },
        { title: t("multiSelect.downloadTitle"), body: t("multiSelect.downloadBody") },
        { title: t("multiSelect.deleteTitle"), body: t("multiSelect.deleteBody") },
        { title: t("multiSelect.clearTitle"), body: t("multiSelect.clearBody") },
      ],
    },
    {
      id: "categories",
      icon: "🗂️",
      title: t("categories.title"),
      cards: [
        { title: t("categories.createTitle"), body: t("categories.createBody") },
        { title: t("categories.hierarchyTitle"), body: t("categories.hierarchyBody") },
        { title: t("categories.assignTitle"), body: t("categories.assignBody") },
        { title: t("categories.moveTitle"), body: t("categories.moveBody") },
      ],
    },
    {
      id: "assetDetails",
      icon: "📝",
      title: t("assetDetails.title"),
      cards: [
        { title: t("assetDetails.fieldsTitle"), body: t("assetDetails.fieldsBody") },
        { title: t("assetDetails.availabilityTitle"), body: t("assetDetails.availabilityBody") },
        { title: t("assetDetails.saveTitle"), body: t("assetDetails.saveBody") },
        { title: t("assetDetails.categoriesTitle"), body: t("assetDetails.categoriesBody") },
      ],
    },
    {
      id: "imageEditor",
      icon: "✂️",
      title: t("imageEditor.title"),
      steps: [
        { number: 1, title: t("imageEditor.step1Title"), body: t("imageEditor.step1Body") },
        { number: 2, title: t("imageEditor.step2Title"), body: t("imageEditor.step2Body") },
        { number: 3, title: t("imageEditor.step3Title"), body: t("imageEditor.step3Body") },
        { number: 4, title: t("imageEditor.step4Title"), body: t("imageEditor.step4Body") },
      ],
      cards: [
        { title: t("imageEditor.cropTitle"), body: t("imageEditor.cropBody") },
        { title: t("imageEditor.rotateTitle"), body: t("imageEditor.rotateBody") },
        { title: t("imageEditor.saveAsNewTitle"), body: t("imageEditor.saveAsNewBody") },
        { title: t("imageEditor.replaceTitle"), body: t("imageEditor.replaceBody") },
      ],
    },
    {
      id: "visibility",
      icon: "🔒",
      title: t("visibility.title"),
      cards: [
        { title: t("visibility.overviewTitle"), body: t("visibility.overviewBody") },
        { title: t("visibility.makePublicTitle"), body: t("visibility.makePublicBody") },
        { title: t("visibility.readTitle"), body: t("visibility.readBody") },
        { title: t("visibility.downloadTitle"), body: t("visibility.downloadBody") },
        { title: t("visibility.writeTitle"), body: t("visibility.writeBody") },
        { title: t("visibility.revertTitle"), body: t("visibility.revertBody") },
      ],
    },
    {
      id: "locking",
      icon: "🗑️",
      title: t("locking.title"),
      cards: [
        { title: t("locking.lockTitle"), body: t("locking.lockBody") },
        { title: t("locking.unlockTitle"), body: t("locking.unlockBody") },
        { title: t("locking.deleteTitle"), body: t("locking.deleteBody") },
        { title: t("locking.downloadTitle"), body: t("locking.downloadBody") },
      ],
    },
    {
      id: "contactUs",
      icon: "✉️",
      title: t("contactUs.title"),
      cards: [
        { title: t("contactUs.supportTitle"), body: t("contactUs.supportBody"), email: "support@ullav.com" },
        { title: t("contactUs.contactTitle"), body: t("contactUs.contactBody"), email: "info@ullav.com" },
        { title: t("contactUs.accountTitle"), body: t("contactUs.accountBody"), email: "support@ullav.com" },
      ],
    },
  ];

  return (
    <HelpPageClient
      title={t("title")}
      subtitle={t("subtitle")}
      sections={sections}
      ctaText={t("cta")}
      ctaButtonText={t("ctaButton")}
      ctaHref="/browse"
    />
  );
}
