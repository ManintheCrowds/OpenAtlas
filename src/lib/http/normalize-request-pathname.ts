/**
 * Collapse percent-encoding and duplicate slashes so middleware path checks
 * cannot be skipped with `/%62rain-map-graph.json` or `//brain-map-graph.json`.
 *
 * NextRequest.nextUrl.pathname keeps percent-encoding, while Next.js static
 * file serving decodes before looking up `public/`.
 */
const MAX_DECODE_PASSES = 5;

export function normalizeRequestPathname(pathname: string): string {
  let current = pathname;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    let decoded = current;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      break;
    }
    if (decoded === current) {
      break;
    }
    current = decoded;
  }
  return current.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}
