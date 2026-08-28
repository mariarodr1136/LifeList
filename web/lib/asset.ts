/**
 * Prefix a path in `public/` with the deployment's base path.
 *
 * `basePath` reaches routes, `_next/` assets and the image optimizer's own URLs,
 * but an unoptimized <Image> hands its `src` to the browser untouched — and these
 * images are all unoptimized, being pre-sized by the pipeline. Serving the site
 * from a subdirectory (GitHub Pages) therefore has to be spelled out here.
 *
 * Empty everywhere else, so `next dev` and a root deployment are unaffected.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
