"use client";

import { useSyncSessionForm } from '@/lib/hooks/useSyncSessionForm';
import { AttendeeStep } from './steps/AttendeeStep';
import { IntentStep } from './steps/IntentStep';
import { ContextStep } from './steps/ContextStep';
import { ShapedByStep } from './steps/ShapedByStep';
import { WorkingStyleStep } from './steps/WorkingStyleStep';
import { ConstraintsStep } from './steps/ConstraintsStep';
import { UniqueQualityStep } from './steps/UniqueQualityStep';
import { SuccessStep } from './steps/SuccessStep';
import '@/styles/brand.css';

const formSteps = [
  AttendeeStep,
  IntentStep,
  ContextStep,
  ShapedByStep,
  WorkingStyleStep,
  ConstraintsStep,
  UniqueQualityStep,
] as const;

const TOTAL_STEPS = formSteps.length + 1; // + Success

export function SyncSessionForm() {
  const {
    currentStep,
    formData,
    isSubmitting,
    error,
    errorKind,
    updateFormData,
    nextStep,
    prevStep,
    submitForm,
    fetchBootstrapToken,
    bootstrapTokenStatus,
    bootstrapRequired,
    captchaRequired,
    turnstileSiteKey,
    onTurnstileTokenChange,
    successIds,
    recentRetries,
  } = useSyncSessionForm();

  const isSuccessStep = currentStep >= formSteps.length;
  const CurrentStepComponent = isSuccessStep ? null : formSteps[currentStep];
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;
  const showRetry = errorKind === 'network' || errorKind === 'submission_5xx' || errorKind === 'rate_limit';
  const showEarlyBootstrapWarn =
    !isSuccessStep && bootstrapRequired && bootstrapTokenStatus === 'failed';

  return (
    <div className="min-h-screen bg-[var(--brand-atmospheric-white)] dark:bg-gray-950" data-testid="sync-session-form-container">
      <div className="max-w-xl w-full mx-auto px-0 pt-4 pb-8">
        <div className="text-center mb-8">
          <h1 className="mb-2 text-2xl font-bold text-[var(--brand-navy-blue)] dark:text-gray-100" style={{ fontFamily: 'Avenir Next World, sans-serif' }}>
            Sync Session
          </h1>
          <p className="mb-2 text-sm text-[var(--brand-secondary-text)] dark:text-gray-300" style={{ fontFamily: 'Avenir Next World, sans-serif' }}>
            A short alignment pass for turning human context into durable agent memory.
          </p>
        </div>

        <div className="mb-2" aria-live="polite" aria-atomic="true">
          <p className="mb-1 text-center text-sm text-[var(--brand-secondary-text)] dark:text-gray-300" id="sync-session-step-status">
            Step {currentStep + 1} of {TOTAL_STEPS}
          </p>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={currentStep + 1} aria-labelledby="sync-session-step-status">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="form-container" data-testid="sync-session-form-steps">
          {showEarlyBootstrapWarn && (
            <div
              className="message message-error mb-4"
              role="status"
              data-testid="sync-session-bootstrap-banner"
            >
              <p>
                Submission token setup failed. Request a new token or reload before you submit —
                required bootstrap did not complete.
              </p>
              <p className="mt-2 text-xs opacity-90">
                Failure class: <code>bootstrap_token</code> · Token status:{' '}
                <code>{bootstrapTokenStatus}</code>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="secondary-button" onClick={() => void fetchBootstrapToken()}>
                  Request new token
                </button>
                <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
                  Reload session
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="message message-error" role="alert">
              <p>{error}</p>
              {errorKind && (
                <p className="mt-2 text-xs opacity-90" data-testid="sync-session-error-kind">
                  Failure class: <code>{errorKind}</code>
                </p>
              )}
              <p className="mt-2 text-xs opacity-90">
                Operator checks: <code>/api/survey/bootstrap-token</code>, <code>/api/survey</code>, rate limit,
                and <code>OPENGRIMOIRE_DB_PATH</code>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {showRetry && (
                  <button type="button" className="secondary-button" onClick={() => void submitForm()}>
                    Retry submit
                  </button>
                )}
                {errorKind === 'auth' || errorKind === 'bootstrap_token' ? (
                  <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
                    Reload session
                  </button>
                ) : null}
                {errorKind === 'bootstrap_token' ? (
                  <button type="button" className="secondary-button" onClick={() => void fetchBootstrapToken()}>
                    Request new token
                  </button>
                ) : null}
              </div>
              <details className="mt-3 rounded border border-red-200 bg-white p-2 text-xs text-red-900 dark:border-red-900 dark:bg-gray-950 dark:text-red-200">
                <summary className="cursor-pointer font-medium">Operator diagnostics</summary>
                <div className="mt-2 space-y-1" data-testid="sync-session-diagnostics-drawer">
                  <p>
                    Token status: <code>{bootstrapTokenStatus}</code>
                    {bootstrapRequired ? ' (required)' : ' (optional)'}
                  </p>
                  <p>Recent retries (latest first):</p>
                  <ul className="list-disc pl-4">
                    {recentRetries.length === 0 ? (
                      <li>none</li>
                    ) : (
                      recentRetries.map((retry) => (
                        <li key={`${retry.ts}-${retry.status ?? 'none'}`}>
                          <code>{retry.ts}</code> status=<code>{retry.status ?? 'network'}</code>{' '}
                          requestId=<code>{retry.requestId ?? 'n/a'}</code>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </details>
            </div>
          )}

          {isSuccessStep ? (
            <SuccessStep formData={formData} successIds={successIds} />
          ) : currentStep === formSteps.length - 1 ? (
            <UniqueQualityStep
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
              submitForm={submitForm}
              isSubmitting={isSubmitting}
              isLastStep
              captchaRequired={captchaRequired}
              turnstileSiteKey={turnstileSiteKey}
              onTurnstileTokenChange={onTurnstileTokenChange}
            />
          ) : CurrentStepComponent ? (
            <CurrentStepComponent
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
              submitForm={submitForm}
              isSubmitting={isSubmitting}
              isLastStep={false}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
