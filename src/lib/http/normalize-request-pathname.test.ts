import { describe, expect, it } from 'vitest';
import { normalizeRequestPathname } from './normalize-request-pathname';

describe('normalizeRequestPathname', () => {
  it('leaves a decoded canonical path unchanged besides slash collapse', () => {
    expect(normalizeRequestPathname('/brain-map-graph.json')).toEqual({
      ok: true,
      pathname: '/brain-map-graph.json',
    });
  });

  it('decodes AE1-class encodings to the blocked basename', () => {
    expect(normalizeRequestPathname('/%62rain-map-graph.json')).toEqual({
      ok: true,
      pathname: '/brain-map-graph.json',
    });
    expect(normalizeRequestPathname('/brain-map-graph%2Ejson')).toEqual({
      ok: true,
      pathname: '/brain-map-graph.json',
    });
    expect(normalizeRequestPathname('/brain-map-graph%2ejson')).toEqual({
      ok: true,
      pathname: '/brain-map-graph.json',
    });
    expect(normalizeRequestPathname('/%2Fbrain-map-graph.json')).toEqual({
      ok: true,
      pathname: '/brain-map-graph.json',
    });
  });

  it('collapses duplicate slashes', () => {
    expect(normalizeRequestPathname('//brain-map-graph.json')).toEqual({
      ok: true,
      pathname: '/brain-map-graph.json',
    });
  });

  it('resolves dot segments and fail-closes on root escape', () => {
    expect(normalizeRequestPathname('/foo/./brain-map-graph.json')).toEqual({
      ok: true,
      pathname: '/foo/brain-map-graph.json',
    });
    expect(normalizeRequestPathname('/../brain-map-graph.json')).toEqual({ ok: false });
  });

  it('fail-closes on invalid percent sequences', () => {
    expect(normalizeRequestPathname('/brain-map-graph%.json')).toEqual({ ok: false });
    expect(normalizeRequestPathname('/brain-map-graph%ZZ')).toEqual({ ok: false });
  });
});
