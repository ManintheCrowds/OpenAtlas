import { NextResponse } from 'next/server';
import {
  isSurveyPostTokenRequired,
  signSurveyPostBootstrapToken,
} from '@/lib/survey/survey-post-bootstrap';
import { isSurveyPostCaptchaRequired } from '@/lib/survey/survey-post-captcha';

/**
 * Issues a short-lived JWT for POST /api/survey when SURVEY_POST_REQUIRE_TOKEN is enabled.
 * Same-origin Sync Session UI fetches this and sends the token as x-survey-post-token.
 *
 * **Threat model:** Public GET when the gate is on — thin control vs scripted same-origin clients and
 * server-side automation; not a substitute for Turnstile, rate limits, or WAF. See
 * [docs/security/SURVEY_POST_BOOTSTRAP_THREAT_MODEL.md](../../../../../docs/security/SURVEY_POST_BOOTSTRAP_THREAT_MODEL.md).
 */
export async function GET() {
  const captchaRequired = isSurveyPostCaptchaRequired();
  if (!isSurveyPostTokenRequired()) {
    return NextResponse.json({ token: null, expiresIn: null, required: false, captchaRequired });
  }
  if (!process.env.SURVEY_POST_BOOTSTRAP_SECRET?.trim()) {
    return NextResponse.json(
      { error: 'Survey post token is required but SURVEY_POST_BOOTSTRAP_SECRET is not set' },
      { status: 503 }
    );
  }
  try {
    const token = await signSurveyPostBootstrapToken();
    return NextResponse.json({ token, expiresIn: 900, required: true, captchaRequired });
  } catch (e) {
    console.error('[survey/bootstrap-token]', e);
    return NextResponse.json({ error: 'Could not issue token' }, { status: 500 });
  }
}
