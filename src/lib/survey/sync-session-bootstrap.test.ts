import { describe, expect, it } from 'vitest';
import { parseBootstrapTokenResponse } from './sync-session-bootstrap';

describe('parseBootstrapTokenResponse', () => {
  it('treats null token with required false as ok', () => {
    expect(parseBootstrapTokenResponse({ token: null, required: false })).toEqual({
      status: 'ok',
      token: null,
      required: false,
      captchaRequired: false,
    });
  });

  it('treats null token with expiresIn null as ok when gate off', () => {
    expect(parseBootstrapTokenResponse({ token: null, expiresIn: null })).toEqual({
      status: 'ok',
      token: null,
      required: false,
      captchaRequired: false,
    });
  });

  it('requires token when required true', () => {
    expect(parseBootstrapTokenResponse({ token: null, required: true })).toEqual({ status: 'failed' });
    expect(parseBootstrapTokenResponse({ token: 'abc', required: true })).toEqual({
      status: 'ok',
      token: 'abc',
      required: true,
      captchaRequired: false,
    });
  });

  it('surfaces captchaRequired for Sync Session Turnstile gating', () => {
    expect(
      parseBootstrapTokenResponse({ token: null, required: false, captchaRequired: true })
    ).toEqual({
      status: 'ok',
      token: null,
      required: false,
      captchaRequired: true,
    });
  });
});
