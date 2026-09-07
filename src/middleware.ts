import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isBlockedBrainMapStaticPath } from './lib/brain-map/static-path-guard';
import { normalizeRequestPathname } from './lib/http/normalize-request-pathname';
import { getRateLimitClientIp } from './lib/rate-limit/get-client-ip';
import { createRateLimiter } from './lib/rate-limit-in-memory';

/**
 * NOTE: With `src/app`, Next.js loads middleware from `src/middleware.ts` only.
 * A root-level `middleware.ts` is ignored and never enters the middleware manifest.
 */

/** POST /api/survey — single Node instance; not for multi-replica. */
const rateLimitSyncSessionSubmit = createRateLimiter(60_000, 30);

/** POST /api/auth/login — stricter; brute-force protection (per-process only). */
const rateLimitLogin = createRateLimiter(60_000, 10);

/**
 * POST /api/operator-probes/ingest — runner + operator ingest.
 * Per-process in-memory window only; each horizontal replica has its own counter (see OPERATIONAL_TRADEOFFS / ARCHITECTURE § operator probe multi-instance).
 */
const rateLimitOperatorProbeIngest = createRateLimiter(60_000, 30);

/**
 * GET discovery / OpenAPI — generous per-IP limit to reduce scraping noise (single Node; not multi-replica).
 * 200 requests / minute / IP (same window as other limiters).
 */
const rateLimitDiscoveryGet = createRateLimiter(60_000, 200);

const DISCOVERY_GET_PATHS = new Set(['/api/capabilities', '/api/openapi', '/api/openapi.json']);

const BRAIN_MAP_STATIC_404 = {
  error: 'Not found',
  detail:
    'Brain map JSON is served only via GET /api/brain-map/graph (see docs/AGENT_INTEGRATION.md).',
} as const;

/**
 * Dev/demo App Router pages only (OA-4). Blocked in production unless explicitly allowed
 * (e.g. staging). See .env.example OPENGRIMOIRE_ALLOW_TEST_ROUTES.
 *
 * Prefix list is handler-only SSOT. Catch-all matcher (minus Next static/image/favicon)
 * runs this function for encoded `/test*` as well. `isTestDevRoute` treats
 * `pathname === prefix` or `pathname.startsWith(prefix + '/')`.
 */
const TEST_ROUTE_PREFIXES = ['/test', '/test-chord', '/test-context', '/test-sqlite'] as const;

function isTestDevRoute(pathname: string): boolean {
  return TEST_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function testRoutesAllowedInThisDeployment(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const v = process.env.OPENGRIMOIRE_ALLOW_TEST_ROUTES;
  return v === '1' || v === 'true';
}

function genericNotFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

export function middleware(request: NextRequest) {
  const normalized = normalizeRequestPathname(request.nextUrl.pathname);
  if (!normalized.ok) {
    return genericNotFound();
  }
  const { pathname } = normalized;

  if (isTestDevRoute(pathname) && !testRoutesAllowedInThisDeployment()) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Not found</title></head><body><h1>Not found</h1><p>Dev-only routes are disabled in this deployment. To allow (staging only), set <code>OPENGRIMOIRE_ALLOW_TEST_ROUTES=1</code>. See <code>.env.example</code>.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (isBlockedBrainMapStaticPath(pathname)) {
    return NextResponse.json(BRAIN_MAP_STATIC_404, { status: 404 });
  }

  if (pathname === '/api/survey' && request.method === 'POST') {
    const ip = getRateLimitClientIp(request);
    if (!rateLimitSyncSessionSubmit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests', detail: 'Sync Session submit rate limit exceeded. Try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const ip = getRateLimitClientIp(request);
    if (!rateLimitLogin(ip)) {
      return NextResponse.json(
        { error: 'Too many requests', detail: 'Login rate limit exceeded. Try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  if (pathname === '/api/operator-probes/ingest' && request.method === 'POST') {
    const ip = getRateLimitClientIp(request);
    if (!rateLimitOperatorProbeIngest(ip)) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          detail: 'Operator probe ingest rate limit exceeded. Try again later.',
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  if (request.method === 'GET' && DISCOVERY_GET_PATHS.has(pathname)) {
    const ip = getRateLimitClientIp(request);
    if (!rateLimitDiscoveryGet(ip)) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          detail: 'Discovery endpoint rate limit exceeded. Try again later.',
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  return NextResponse.next();
}

/** Catch-all so encoded public/ paths still enter this function. Next internals stay excluded. */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
