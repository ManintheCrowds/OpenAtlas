import { describe, expect, it } from 'vitest';

import {
  syncSessionSubmitUserMessage,
  type SurveySubmitErrorPayload,
} from './sync-session-submit-user-message';

describe('syncSessionSubmitUserMessage', () => {
  it('returns server message for 409', () => {
    const payload: SurveySubmitErrorPayload = {
      success: false,
      message: 'Duplicate email conflict.',
    };
    expect(syncSessionSubmitUserMessage(409, payload)).toBe('Duplicate email conflict.');
  });

  it('returns validation copy for 400 Validation failed', () => {
    const payload: SurveySubmitErrorPayload = { error: 'Validation failed', issues: {} };
    expect(syncSessionSubmitUserMessage(400, payload)).toBe('Please check your answers and try again.');
  });

  it('surfaces Turnstile failures instead of generic validation copy', () => {
    const payload: SurveySubmitErrorPayload = {
      error: 'Validation failed',
      message: 'Invalid or missing Turnstile token',
    };
    expect(syncSessionSubmitUserMessage(400, payload)).toMatch(/captcha/i);
  });

  it('formats 429 with detail and Retry-After', () => {
    const payload: SurveySubmitErrorPayload = {
      error: 'Too many requests',
      detail: 'Sync Session submit rate limit exceeded. Try again later.',
    };
    const msg = syncSessionSubmitUserMessage(429, payload, { retryAfterSeconds: '60' });
    expect(msg).toContain('too quickly');
    expect(msg).toContain('Sync Session submit rate limit exceeded');
    expect(msg).toContain('60 seconds');
  });

  it('formats 429 without Retry-After', () => {
    const payload: SurveySubmitErrorPayload = { error: 'Too many requests', detail: 'Slow down.' };
    const msg = syncSessionSubmitUserMessage(429, payload);
    expect(msg).toContain('Slow down');
    expect(msg).toContain('wait a minute');
  });

  it('formats 401 with API detail and reload hint', () => {
    const payload: SurveySubmitErrorPayload = {
      error: 'Invalid or missing survey post token',
      detail: 'Fetch GET /api/survey/bootstrap-token first',
    };
    const msg = syncSessionSubmitUserMessage(401, payload);
    expect(msg).toContain("couldn't verify");
    expect(msg).toContain('bootstrap-token');
    expect(msg).toMatch(/reload/i);
  });

  it('surfaces 503 token misconfiguration', () => {
    const payload: SurveySubmitErrorPayload = {
      error: 'Survey post token required but server is not configured (SURVEY_POST_BOOTSTRAP_SECRET)',
    };
    const msg = syncSessionSubmitUserMessage(503, payload);
    expect(msg).toContain('Sync Session intake is not configured yet');
    expect(msg).toContain('SURVEY_POST_BOOTSTRAP_SECRET');
    expect(msg).toContain('SQLite');
  });

  it('uses operator-oriented copy for server errors', () => {
    const payload: SurveySubmitErrorPayload = { message: 'Custom server message' };
    expect(syncSessionSubmitUserMessage(500, payload)).toContain('server error');
  });

  it('falls back to generic for unknown 500', () => {
    expect(syncSessionSubmitUserMessage(418, { error: 'Internal' })).toContain('could not save');
  });
});
