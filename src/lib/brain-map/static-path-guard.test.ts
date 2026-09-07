import { describe, expect, it } from 'vitest';
import { isBlockedBrainMapStaticPath } from './static-path-guard';

describe('isBlockedBrainMapStaticPath', () => {
  it('blocks canonical graph JSON static paths', () => {
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.json')).toBe(true);
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.local.json')).toBe(true);
  });

  it('blocks backup / renamed copies that would bypass an exact-name allowlist', () => {
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.local.json.pre_e2e_backup')).toBe(true);
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.local.json.bak')).toBe(true);
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.json.bak')).toBe(true);
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.json.old')).toBe(true);
  });

  it('blocks AE1-class encodings of the canonical basename', () => {
    expect(isBlockedBrainMapStaticPath('/%62rain-map-graph.json')).toBe(true);
    expect(isBlockedBrainMapStaticPath('/brain-map-graph%2Ejson')).toBe(true);
    expect(isBlockedBrainMapStaticPath('/%2Fbrain-map-graph.json')).toBe(true);
  });

  it('blocks encoded .local.json and encoded backup suffixes', () => {
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.local%2Ejson')).toBe(true);
    expect(isBlockedBrainMapStaticPath('/brain-map-graph.json%2Ebak')).toBe(true);
  });

  it('does not treat fail-closed encodings as suffix hits', () => {
    expect(isBlockedBrainMapStaticPath('/brain-map-graph%.json')).toBe(false);
  });

  it('does not block the authenticated API route or unrelated paths', () => {
    expect(isBlockedBrainMapStaticPath('/api/brain-map/graph')).toBe(false);
    expect(isBlockedBrainMapStaticPath('/api/brain-map/meta')).toBe(false);
    expect(isBlockedBrainMapStaticPath('/brain-map')).toBe(false);
    expect(isBlockedBrainMapStaticPath('/context-atlas')).toBe(false);
    expect(isBlockedBrainMapStaticPath('/branding/logo.svg')).toBe(false);
  });
});
