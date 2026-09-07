import { normalizeRequestPathname } from '../http/normalize-request-pathname';

/**
 * Direct static URLs under /public for brain-map graph JSON must be blocked.
 * Clients must use GET /api/brain-map/graph (optional BRAIN_MAP_SECRET / session).
 *
 * Exact-name allowlists miss operator backups such as
 * `/brain-map-graph.local.json.pre_e2e_backup` or `.bak` copies left in public/.
 *
 * Fail-closed encodings are not suffix hits — middleware must 404 those with a generic body.
 */
const BRAIN_MAP_STATIC_PATH_RE = /^\/brain-map-graph(\.local)?\.json(?:$|\.)/i;

export function isBlockedBrainMapStaticPath(pathname: string): boolean {
  const normalized = normalizeRequestPathname(pathname);
  if (!normalized.ok) {
    return false;
  }
  return BRAIN_MAP_STATIC_PATH_RE.test(normalized.pathname);
}
