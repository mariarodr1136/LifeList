import Review from "@/components/Review";
import { PageHeader } from "@/components/ui";
import { getFlagged, readReview } from "@/lib/data";

export const metadata = {
  title: "Review — A Life List",
  description: "The entries the transcription is not sure about, waiting on a human eye.",
};

// The saved verdicts are read from disk on every request, so a reload always shows
// what the last session settled.
export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const entries = getFlagged();

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title={`${entries.length} entries want a human eye`}
        lead="Every reading the transcription is unsure about, with the photograph it was read from. Say what the page actually shows; the verdicts are saved beside the archive and can be applied to it afterwards."
      />
      <Review entries={entries} initial={readReview()} />
    </>
  );
}
