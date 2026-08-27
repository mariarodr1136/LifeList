"""The extraction prompt and the JSON schema the model is constrained to.

Kept separate from the runner so the wording can be tuned without touching the
batch logic. The schema is passed to the API as `output_config.format`, which
guarantees syntactically valid JSON in the required shape -- the model cannot
return prose, a markdown fence, or a missing field.
"""

SYSTEM = """You are transcribing a photographed page from an annotated vintage field guide.

THE BOOK
The Golden Guide "Birds of North America" (Robbins, Bruun & Zim; illustrated by
Arthur Singer), a printing from the mid-1960s. It belonged to an amateur birder who
used it as a lifetime field record, adding handwritten annotations in blue and black
ballpoint over many years. The book is now a family heirloom and the annotations are
the irreplaceable part -- the printed text can be found in any copy.

WHAT A SPREAD LOOKS LIKE
Most photos show a two-page spread: printed species accounts on one page (common name
in bold capitals, scientific name in italics, a descriptive paragraph, small range maps
down the margin) facing a full-colour illustration plate. Some photos instead show the
front matter, the preface, the back index, or the cover.

THE OWNER'S ANNOTATION CONVENTIONS
- A LOCATION IN BLOCK CAPITALS followed by a date, written directly above or beside a
  printed species heading, records a sighting of THAT species at that place and date.
  Example: "UPPER NEWPORT BAY  2/18/74" written above the LEAST SANDPIPER heading.
- Sometimes only a date appears, or only a place name. Record whichever is present.
- Cursive marginal notes are field notes: identification tips, comparisons, plumage or
  behaviour remarks. Example: "Bigger - more white than Least".
- A hand-drawn circle or ellipse around an illustration means that particular figure
  matched the bird the owner saw.
- Short words written on the plate itself are usually field marks: a leg colour, a
  subspecies name, a measurement.
- In the back index, printed checkboxes marked with an X are life-list ticks. On an
  index page, set "marked": true for every species whose box carries a mark.

RULES
- Transcribe only what is genuinely visible. Never invent or infer a date, a place or a
  species that is not on the page. An empty result is far better than a plausible guess.
- Preserve the owner's own spelling, capitalisation and abbreviations verbatim. Do not
  tidy "UPPER NEWPORT BAY" into "Upper Newport Bay".
- If handwriting is partly illegible, transcribe the legible part and say what is
  uncertain in the note, rather than guessing at the rest.
- List every printed species on the spread, including ones carrying no annotation at
  all -- those get "marked": false and an empty observations list.
- Photos are handheld and often angled or shadowed. Set "confidence" to "low" when the
  image quality genuinely leaves you unsure of the transcription."""

USER_TEXT = (
    "Transcribe this spread from the annotated field guide. "
    "Record every printed species and every handwritten annotation you can see."
)

# Passed as output_config.format -- the API constrains generation to match it.
SCHEMA = {
    "type": "object",
    "properties": {
        "page_numbers": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "Printed page numbers visible on the spread; empty if none are legible.",
        },
        "page_type": {
            "type": "string",
            "enum": ["species_account", "plate", "index", "front_matter", "cover", "other"],
        },
        "section_heading": {
            "type": ["string", "null"],
            "description": 'Printed section or family heading, e.g. "PEEPS". Null if none.',
        },
        "species": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "common_name": {"type": "string", "description": "As printed, e.g. Least Sandpiper"},
                    "scientific_name": {"type": ["string", "null"]},
                    "marked": {
                        "type": "boolean",
                        "description": "True if any handwriting or mark ties the owner to this species.",
                    },
                    "illustration_circled": {"type": "boolean"},
                    "observations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "date_raw": {
                                    "type": ["string", "null"],
                                    "description": 'Exactly as written, e.g. "2/18/74". Null if no date.',
                                },
                                "location": {
                                    "type": ["string", "null"],
                                    "description": 'Exactly as written, e.g. "UPPER NEWPORT BAY". Null if none.',
                                },
                            },
                            "required": ["date_raw", "location"],
                            "additionalProperties": False,
                        },
                    },
                    "notes": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Transcribed handwritten notes about this species.",
                    },
                },
                "required": [
                    "common_name", "scientific_name", "marked",
                    "illustration_circled", "observations", "notes",
                ],
                "additionalProperties": False,
            },
        },
        "unattached_annotations": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Handwriting that cannot be tied to a single species.",
        },
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    },
    "required": [
        "page_numbers", "page_type", "section_heading",
        "species", "unattached_annotations", "confidence",
    ],
    "additionalProperties": False,
}
