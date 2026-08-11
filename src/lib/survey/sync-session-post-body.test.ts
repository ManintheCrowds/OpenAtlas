import { describe, expect, it } from 'vitest';
import { buildSyncSessionPostBody } from './sync-session-post-body';

describe('buildSyncSessionPostBody', () => {
  it('omits turnstileToken when unset', () => {
    const body = buildSyncSessionPostBody({
      first_name: 'Ada',
      is_anonymous: false,
      email: 'ada@example.com',
      unique_quality: 'Analytical',
    });
    expect(body.turnstileToken).toBeUndefined();
    expect(body.firstName).toBe('Ada');
  });

  it('includes turnstileToken when provided', () => {
    const body = buildSyncSessionPostBody(
      {
        first_name: 'Ada',
        is_anonymous: true,
        unique_quality: 'Analytical',
      },
      { turnstileToken: '  cf-turnstile-response  ' }
    );
    expect(body.turnstileToken).toBe('cf-turnstile-response');
    expect(body.isAnonymous).toBe(true);
    expect(body.email).toBe('');
  });
});
