import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

function graphStaticRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3001${path}`);
}

async function blockedDetail(path: string): Promise<{ status: number; error: string }> {
  const response = middleware(graphStaticRequest(path));
  const body = (await response.json()) as { error?: string };
  return { status: response.status, error: body.error ?? '' };
}

describe('middleware brain-map static guard', () => {
  it('blocks canonical static graph URLs', async () => {
    await expect(blockedDetail('/brain-map-graph.json')).resolves.toEqual({
      status: 404,
      error: 'Not found',
    });
    await expect(blockedDetail('/brain-map-graph.local.json')).resolves.toEqual({
      status: 404,
      error: 'Not found',
    });
  });

  it('blocks percent-encoded static graph URLs that skip literal matchers', async () => {
    await expect(blockedDetail('/%62rain-map-graph.json')).resolves.toEqual({
      status: 404,
      error: 'Not found',
    });
    await expect(blockedDetail('/brain-map-graph%2Ejson')).resolves.toEqual({
      status: 404,
      error: 'Not found',
    });
    await expect(blockedDetail('/%2Fbrain-map-graph.json')).resolves.toEqual({
      status: 404,
      error: 'Not found',
    });
  });
});
