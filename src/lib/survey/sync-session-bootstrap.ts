export type BootstrapTokenPayload = {
  token?: string | null;
  required?: boolean;
  expiresIn?: number | null;
  /** When true, POST /api/survey requires a valid turnstileToken. */
  captchaRequired?: boolean;
};

export type BootstrapParseResult =
  | { status: 'ok'; token: string | null; required: boolean; captchaRequired: boolean }
  | { status: 'failed' };

/** Parse GET /api/survey/bootstrap-token JSON for client submit gating. */
export function parseBootstrapTokenResponse(data: BootstrapTokenPayload): BootstrapParseResult {
  const required = data.required === true || (data.required !== false && data.expiresIn != null);
  const captchaRequired = data.captchaRequired === true;
  if (data.token) {
    return { status: 'ok', token: data.token, required, captchaRequired };
  }
  if (!required) {
    return { status: 'ok', token: null, required: false, captchaRequired };
  }
  return { status: 'failed' };
}
