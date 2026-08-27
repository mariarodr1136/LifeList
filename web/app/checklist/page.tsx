import Checklist from "@/components/Checklist";
import { PageHeader } from "@/components/ui";
import { getChecklist, getJournal } from "@/lib/data";

export const metadata = {
  title: "Checklist — A Life List",
  description: "All 1,357 species printed in the guide, and which of them he ticked.",
};

export default function ChecklistPage() {
  const groups = getChecklist();
  const { meta } = getJournal();

  return (
    <>
      <PageHeader
        eyebrow="Checklist"
        title="Every bird the book prints"
        lead={`All ${meta.speciesOnPages.toLocaleString()} species in the guide, grouped the way the book groups them. A filled tick is one he marked; the index pages that carry most of the ticks were photographed at an angle, so this total is the softest number here.`}
      />
      <Checklist groups={groups} />
    </>
  );
}
