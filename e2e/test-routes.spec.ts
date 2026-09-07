import { test, expect } from '@playwright/test';

/**
 * OA-4: /test* dev routes — available under `next dev`; gated in production
 * (middleware + OPENGRIMOIRE_ALLOW_TEST_ROUTES). E2E runs against dev server.
 *
 * Keep route list aligned with `TEST_ROUTE_PREFIXES` in `src/middleware.ts`
 * (same basename set: /test, /test-chord, /test-context, /test-sqlite).
 * Matcher is catch-all; prefixes are handler-only.
 */
test.describe('Dev test routes (OA-4)', () => {
  test('/test loads in development (Playwright webServer)', async ({ page }) => {
    await page.goto('/test');
    await expect(page.getByRole('heading', { name: /Event Visualization Test Environment/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('/test-chord loads with expected heading', async ({ page }) => {
    await page.goto('/test-chord');
    await expect(page.getByRole('heading', { name: /Chord Diagram Test \(Mock Data\)/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('/test-context loads with expected heading', async ({ page }) => {
    await page.goto('/test-context');
    await expect(page.getByRole('heading', { name: /AppContext Test Page/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('/test-sqlite loads with expected heading', async ({ page }) => {
    await page.goto('/test-sqlite');
    await expect(page.getByRole('heading', { name: /Local SQLite API/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('/test-supabase redirects to /test-sqlite', async ({ page }) => {
    await page.goto('/test-supabase');
    await expect(page).toHaveURL(/\/test-sqlite\/?$/);
    await expect(page.getByRole('heading', { name: /Local SQLite API/i })).toBeVisible({
      timeout: 15000,
    });
  });
});
