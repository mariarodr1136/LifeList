import LifeList from "@/components/LifeList";
import { PageHeader } from "@/components/ui";
import { getGroups, getJournal, getLifeList } from "@/lib/data";

export default function Page() {
  const j = getJournal();
  const species = getLifeList();

  const decades = [
    ...new Set(j.observations.map((o) => o.date?.slice(0, 3)).filter(Boolean)),
  ]
    .sort()
    .map((d) => `${d}0`);

  // Only places he actually named more than once are worth a menu row; the long
  // tail of single visits is reachable through search.
  const locations = j.locations.filter((l) => l.visits > 1);

  return (
    <>
      <PageHeader
        eyebrow="Life list"
        title={`${j.meta.speciesRecorded} birds, written in by hand`}
        lead="Every species he ticked, circled or dated in his copy of the Golden Guide. Select one to read the sightings exactly as he recorded them."
      />
      <LifeList
        species={species}
        groups={getGroups()}
        locations={locations}
        decades={decades}
      />
    </>
  );
}
