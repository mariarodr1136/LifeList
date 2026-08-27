import fs from "node:fs/promises";
import { EMPTY_REVIEW, REVIEW_FILE, readReview } from "@/lib/data";
import type { ReviewEntry, Verdict } from "@/lib/types";

/*
  The review queue writes back to data/review.json, beside the transcription rather
  than inside it: the model's reading and the human's verdict stay separate files, so
  neither can quietly overwrite the other.
*/

const VERDICTS: Verdict[] = ["confirmed", "corrected", "unsure"];

export async function GET() {
  return Response.json(readReview());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected JSON" }, { status: 400 });
  }

  const { id, verdict, date, location, note } = (body ?? {}) as {
    id?: string;
    verdict?: string;
    date?: string;
    location?: string;
    note?: string;
  };

  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const file = readReview();

  // No verdict means the reviewer cleared the entry; drop it rather than storing a
  // hollow record.
  if (!verdict) {
    delete file.entries[id];
  } else {
    if (!VERDICTS.includes(verdict as Verdict)) {
      return Response.json({ error: `unknown verdict ${verdict}` }, { status: 400 });
    }
    const entry: ReviewEntry = { verdict: verdict as Verdict, at: new Date().toISOString() };
    if (date?.trim()) entry.date = date.trim();
    if (location?.trim()) entry.location = location.trim();
    if (note?.trim()) entry.note = note.trim();
    file.entries[id] = entry;
  }

  file.version = EMPTY_REVIEW.version;
  file.updated = new Date().toISOString();

  try {
    await fs.writeFile(REVIEW_FILE, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  } catch (err) {
    // A read-only deploy is a legitimate way to run this site; say so plainly so the
    // page can fall back to exporting the verdicts by hand.
    return Response.json(
      { error: `could not write ${REVIEW_FILE}: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return Response.json(file);
}
