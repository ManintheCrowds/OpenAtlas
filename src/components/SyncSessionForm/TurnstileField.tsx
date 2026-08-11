'use client';

import { useEffect, useRef } from 'react';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SCRIPT_ID = 'cf-turnstile-api';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile requires a browser'));
  }
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (window.turnstile) {
          resolve(window.turnstile);
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error('Turnstile script loaded but API missing'));
          return;
        }
        window.setTimeout(poll, 50);
      };
      poll();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error('Turnstile API unavailable after script load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Turnstile script'));
    document.head.appendChild(script);
  });
}

type TurnstileFieldProps = {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
};

/** Explicit Cloudflare Turnstile widget for Sync Session submit. */
export function TurnstileField({ siteKey, onTokenChange }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container || !siteKey) return;

    void (async () => {
      try {
        const api = await loadTurnstileScript();
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token) => {
            onTokenChangeRef.current(token);
          },
          'expired-callback': () => {
            onTokenChangeRef.current(null);
          },
          'error-callback': () => {
            onTokenChangeRef.current(null);
          },
        });
      } catch {
        if (!cancelled) {
          onTokenChangeRef.current(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* ignore */
        }
      }
      onTokenChangeRef.current(null);
    };
  }, [siteKey]);

  return (
    <div className="mt-4" data-testid="sync-session-turnstile">
      <div ref={containerRef} />
    </div>
  );
}
