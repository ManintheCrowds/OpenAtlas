import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { middleware } from './middleware';

const GRAPH_DETAIL = 'Brain map JSON is served only via GET /api/brain-map/graph';

function requestFor(path: string, method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method });
}

async function jsonBody(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

describe('middleware brain-map static gate', () => {
  it('404s decoded canonical graph JSON with the API-only body', async () => {
    const response = middleware(requestFor('/brain-map-graph.json'));
    expect(response.status).toBe(404);
    const body = await jsonBody(response);
    expect(JSON.stringify(body)).toContain(GRAPH_DETAIL);
    expect(JSON.stringify(body)).not.toContain('"nodes"');
  });

  it('404s AE1 encoded graph URLs with the API-only body, not graph JSON', async () => {
    for (const path of ['/%62rain-map-graph.json', '/brain-map-graph%2Ejson', '/%2Fbrain-map-graph.json']) {
      const response = middleware(requestFor(path));
      expect(response.status, path).toBe(404);
      const body = await jsonBody(response);
      const serialized = JSON.stringify(body);
      expect(serialized, path).toContain(GRAPH_DETAIL);
      expect(serialized, path).not.toContain('"nodes"');
    }
  });

  it('404s encoded .local.json and encoded .json.bak-style suffixes', async () => {
    for (const path of ['/brain-map-graph.local%2Ejson', '/brain-map-graph.json%2Ebak']) {
      const response = middleware(requestFor(path));
      expect(response.status, path).toBe(404);
      const body = await jsonBody(response);
      expect(JSON.stringify(body), path).toContain(GRAPH_DETAIL);
    }
  });

  it('404s duplicate-slash blocked basenames', async () => {
    const response = middleware(requestFor('//brain-map-graph.json'));
    expect(response.status).toBe(404);
    const body = await jsonBody(response);
    expect(JSON.stringify(body)).toContain(GRAPH_DETAIL);
  });

  it('does not return the static denylist JSON for graph API routes', async () => {
    for (const path of ['/api/brain-map/graph', '/api/brain-map/meta']) {
      const response = middleware(requestFor(path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get('x-middleware-next')).toBe('1');
      const body = await jsonBody(response);
      expect(JSON.stringify(body), path).not.toContain(GRAPH_DETAIL);
    }
  });

  it('fail-closes invalid encodings with a generic 404, not next and not graph JSON', async () => {
    const response = middleware(requestFor('/brain-map-graph%.json'));
    expect(response.status).toBe(404);
    expect(response.headers.get('x-middleware-next')).toBeNull();
    const body = await jsonBody(response);
    expect(body).toBeNull();
  });

  it('lets a well-formed non-graph public path next on clean decode', async () => {
    const response = middleware(requestFor('/branding/logo.svg'));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('middleware rate limits on encoded API paths', () => {
  it('applies the survey limiter to an encoded POST path', () => {
    let last = middleware(requestFor('/api%2Fsurvey', 'POST'));
    for (let i = 0; i < 31; i++) {
      last = middleware(requestFor('/api%2Fsurvey', 'POST'));
    }
    expect(last.status).toBe(429);
  });

  it('applies the login limiter to an encoded POST path', () => {
    let last = middleware(requestFor('/api%2Fauth%2Flogin', 'POST'));
    for (let i = 0; i < 11; i++) {
      last = middleware(requestFor('/api%2Fauth%2Flogin', 'POST'));
    }
    expect(last.status).toBe(429);
  });

  it('applies the ingest limiter to an encoded POST path', () => {
    let last = middleware(requestFor('/api%2Foperator-probes%2Fingest', 'POST'));
    for (let i = 0; i < 31; i++) {
      last = middleware(requestFor('/api%2Foperator-probes%2Fingest', 'POST'));
    }
    expect(last.status).toBe(429);
  });

  it('applies the discovery limiter to an encoded GET path', () => {
    let last = middleware(requestFor('/api%2Fcapabilities'));
    for (let i = 0; i < 201; i++) {
      last = middleware(requestFor('/api%2Fcapabilities'));
    }
    expect(last.status).toBe(429);
  });
});

describe('middleware OA-4 encoded test routes', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('404s encoded /test in production when test routes are disallowed', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPENGRIMOIRE_ALLOW_TEST_ROUTES', '');
    const response = middleware(requestFor('/%74est'));
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).toContain('Dev-only routes are disabled');
  });
});
