/** Public Cloudflare Turnstile site key for the Sync Session widget (client-safe). */
export function getPublicTurnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}
