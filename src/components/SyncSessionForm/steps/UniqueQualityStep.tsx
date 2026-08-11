"use client";

import React from 'react';
import type { SyncSessionFormData } from '@/lib/hooks/useSyncSessionForm';
import { TurnstileField } from '../TurnstileField';

interface UniqueQualityStepProps {
  formData: SyncSessionFormData;
  updateFormData: (data: Partial<SyncSessionFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  submitForm: () => void;
  isSubmitting: boolean;
  isLastStep: boolean;
  captchaRequired?: boolean;
  turnstileSiteKey?: string | null;
  onTurnstileTokenChange?: (token: string | null) => void;
}

export function UniqueQualityStep({
  formData,
  updateFormData,
  nextStep,
  prevStep,
  submitForm,
  isSubmitting,
  isLastStep,
  captchaRequired = false,
  turnstileSiteKey = null,
  onTurnstileTokenChange,
}: UniqueQualityStepProps) {
  const [error, setError] = React.useState<string | null>(null);
  const showTurnstile = Boolean(isLastStep && (captchaRequired || turnstileSiteKey) && turnstileSiteKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unique_quality?.trim()) {
      setError('Please share your unique quality');
      return;
    }
    if (isLastStep) {
      await submitForm();
    } else {
      nextStep();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="unique_quality" className="block text-lg font-medium text-gray-900 mb-4">
          What unique quality or perspective do you bring to your team?
        </label>
        <div className="mt-2">
          <textarea
            id="unique_quality"
            data-testid="unique-quality-input"
            rows={4}
            value={formData.unique_quality || ''}
            onChange={(e) => {
              setError(null);
              updateFormData({ unique_quality: e.target.value });
            }}
            placeholder="Share your thoughts..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            aria-invalid={!!error}
            aria-describedby={error ? 'unique_quality_error' : undefined}
          />
          {error && <p id="unique_quality_error" className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          This response will be reviewed before being included in the visualization.
          Your identity can remain anonymous if you chose that option earlier.
        </p>
        {showTurnstile && turnstileSiteKey && onTurnstileTokenChange ? (
          <TurnstileField siteKey={turnstileSiteKey} onTokenChange={onTurnstileTokenChange} />
        ) : null}
        {isLastStep && captchaRequired && !turnstileSiteKey ? (
          <p className="mt-4 text-sm text-red-600" role="alert" data-testid="sync-session-turnstile-missing-site-key">
            Captcha is required, but the Turnstile site key is not configured on this deployment.
          </p>
        ) : null}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          data-testid="prev-button"
        >
          Previous
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid={isLastStep ? 'submit-button' : 'next-button'}
          className={`
            inline-flex justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${
              isSubmitting
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }
          `}
        >
          {isSubmitting ? 'Submitting...' : isLastStep ? 'Submit' : 'Next'}
        </button>
      </div>
    </form>
  );
} 