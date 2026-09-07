export const MAX_PATHNAME_DECODE_PASSES = 5;

const RESIDUAL_PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;

export type PathnameNormalizeResult =
  | { ok: true; pathname: string }
  | { ok: false };

/**
 * Canonicalize a request pathname before deny/allow checks.
 * Fail closed on invalid encodings, leftover %HH after the pass cap, or `..` that escapes the URL root.
 */
export function normalizeRequestPathname(pathname: string): PathnameNormalizeResult {
  let current = pathname;
  try {
    for (let i = 0; i < MAX_PATHNAME_DECODE_PASSES; i++) {
      const decoded = decodeURIComponent(current);
      if (decoded === current) {
        break;
      }
      current = decoded;
    }
  } catch {
    return { ok: false };
  }

  if (RESIDUAL_PERCENT_ESCAPE.test(current)) {
    return { ok: false };
  }

  current = current.replace(/\\/g, '/').replace(/\/+/g, '/');

  const isAbsolute = current.startsWith('/');
  const segments = current.split('/');
  const stack: string[] = [];

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (stack.length === 0) {
        return { ok: false };
      }
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  const joined = stack.join('/');
  const resolved = isAbsolute ? `/${joined}` : joined;
  return { ok: true, pathname: resolved === '' && isAbsolute ? '/' : resolved };
}
