import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Next.js with `src/app` only compiles `src/middleware.ts`.
 * A root-level `middleware.ts` is silently ignored (empty middleware manifest),
 * which disables brain-map static blocking, rate limits, and prod test-route gates.
 */
describe('middleware location', () => {
  it('keeps middleware under src/ and does not leave a dead root middleware.ts', () => {
    const root = process.cwd();
    expect(fs.existsSync(path.join(root, 'src/middleware.ts'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'middleware.ts'))).toBe(false);
  });

  it('uses a catch-all matcher that still excludes Next static assets', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(src).toContain("'/((?!_next/static|_next/image|favicon.ico).*)'");
    expect(src).not.toContain("'/brain-map-graph.json(.*)'");
    expect(src).not.toContain("'/brain-map-graph.local.json(.*)'");
  });
});
