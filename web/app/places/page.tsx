import Places, { type PlaceView } from "@/components/Places";
import { PageHeader } from "@/components/ui";
import { getJournal } from "@/lib/data";

export const metadata = {
  title: "Places — A Life List",
  description: "The 148 places he named beside a bird, and what he saw at each.",
};

export default function PlacesPage() {
  const j = getJournal();
  const marked = new Set(j.species.filter((s) => s.marked).map((s) => s.name));

  const places: PlaceView[] = j.locations.map((l) => {
    const dates = j.observations
      .filter((o) => o.locationKey === l.key && o.date)
      .map((o) => o.date!)
      .sort();
    return {
      key: l.key,
      name: l.name,
      state: l.state,
      visits: l.visits,
      species: l.species,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      recorded: l.species.filter((s) => marked.has(s)).length,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Places"
        title={`${j.meta.locations} places, written beside a bird`}
        lead="Wherever he wrote a location next to a species, it is here. Names are grouped by their canonical form — the page itself always keeps the wording he used that day."
      />
      <Places places={places} />
    </>
  );
}
