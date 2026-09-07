import { describe, expect, it } from 'vitest';
import { normalizeRequestPathname } from './normalize-request-pathname';

describe('normalizeRequestPathname', () => {
  it('leaves already-decoded paths unchanged', () => {
    expect(normalizeRequestPathname('/brain-map-graph.json')).toBe('/brain-map-graph.json');
    expect(normalizeRequestPathname('/api/survey')).toBe('/api/survey');
  });

  it('decodes percent-encoded segments used to skip static-path matchers', () => {
    expect(normalizeRequestPathname('/%62rain-map-graph.json')).toBe('/brain-map-graph.json');
    expect(normalizeRequestPathname('/brain-map-graph%2Ejson')).toBe('/brain-map-graph.json');
    expect(normalizeRequestPathname('/%2Fbrain-map-graph.json')).toBe('/brain-map-graph.json');
  });

  it('collapses repeated decoding and duplicate slashes', () => {
    expect(normalizeRequestPathname('/%2562rain-map-graph.json')).toBe('/brain-map-graph.json');
    expect(normalizeRequestPathname('//brain-map-graph.json')).toBe('/brain-map-graph.json');
  });

  it('keeps malformed percent sequences instead of throwing', () => {
    expect(normalizeRequestPathname('/brain-map-graph%.json')).toBe('/brain-map-graph%.json');
  });
});
