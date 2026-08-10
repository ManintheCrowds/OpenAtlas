'use client';

import { useEffect, useState, useRef } from 'react';
import type { VisualizationSurveyRow } from '@/lib/types/database';
import { OPENGRIMOIRE_SURVEY_DATA_CHANGED } from '@/lib/survey/survey-data-change-event';
import { fetchSurveyVisualizationRows } from '@/lib/visualization/surveyVisualizationFetch';
import { isSurveyVisualizationRow } from '@/lib/visualization/validateSurveyVisualizationRow';

type SurveyRow = VisualizationSurveyRow & {
  attendee: VisualizationSurveyRow['attendee'];
};

const vizDebug =
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_DEBUG_VISUALIZATION === '1';

function logViz(message: string, meta?: Record<string, unknown>) {
  if (vizDebug) {
    if (meta) console.log(message, meta);
    else console.log(message);
  }
}

function warnViz(message: string) {
  if (vizDebug) console.warn(message);
}

const mockData: SurveyRow[] = [
  {
    id: 'mock-1',
    attendee_id: 'mock-attendee-1',
    session_type: 'profile',
    questionnaire_version: 'v1',
    tenure_years: 5,
    learning_style: 'visual',
    shaped_by: 'mentor',
    peak_performance: 'Extrovert, Morning',
    motivation: 'growth',
    unique_quality: 'Mock response 1',
    harness_profile_id: null,
    status: 'pending',
    moderated_at: null,
    test_data: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    attendee: {
      first_name: 'John',
      last_name: 'Doe',
      is_anonymous: false,
    },
    moderation: null,
  },
  {
    id: 'mock-2',
    attendee_id: 'mock-attendee-2',
    session_type: 'profile',
    questionnaire_version: 'v1',
    tenure_years: 10,
    learning_style: 'auditory',
    shaped_by: 'challenge',
    peak_performance: 'Introvert, Morning',
    motivation: 'impact',
    unique_quality: 'Mock response 2',
    harness_profile_id: null,
    status: 'pending',
    moderated_at: null,
    test_data: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    attendee: {
      first_name: 'Jane',
      last_name: 'Smith',
      is_anonymous: false,
    },
    moderation: null,
  },
  {
    id: 'mock-3',
    attendee_id: 'mock-attendee-3',
    session_type: 'profile',
    questionnaire_version: 'v1',
    tenure_years: 15,
    learning_style: 'kinesthetic',
    shaped_by: 'success',
    peak_performance: 'Ambivert, Morning',
    motivation: 'purpose',
    unique_quality: 'Mock response 3',
    harness_profile_id: null,
    status: 'pending',
    moderated_at: null,
    test_data: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    attendee: {
      first_name: 'Bob',
      last_name: 'Johnson',
      is_anonymous: false,
    },
    moderation: null,
  },
];

export function useVisualizationData() {
  const [data, setData] = useState<SurveyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const prevDataLength = useRef(data.length);
  const prevIsLoading = useRef(isLoading);

  useEffect(() => {
    if (prevDataLength.current !== data.length || prevIsLoading.current !== isLoading) {
      logViz('📊 useVisualizationData state changed', {
        dataLength: data.length,
        isLoading,
        error,
        isMockData,
      });
      prevDataLength.current = data.length;
      prevIsLoading.current = isLoading;
    }
  }, [data.length, isLoading, error, isMockData]);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    async function fetchData(isRetry = false) {
      try {
        if (isRetry) {
          setError('Retrying connection...');
        } else {
          setIsLoading(true);
          setError(null);
        }

        const responses = await fetchSurveyVisualizationRows({ mode: 'cohort' });

        if (mounted) {
          if (responses.length > 0) {
            const validResponses = responses.filter(isSurveyVisualizationRow).reduce((acc: SurveyRow[], curr) => {
              const existingIndex = acc.findIndex((r) => r.attendee_id === curr.attendee_id);
              if (existingIndex === -1) {
                acc.push(curr);
              } else if (new Date(curr.updated_at) > new Date(acc[existingIndex].updated_at)) {
                acc[existingIndex] = curr;
              }
              return acc;
            }, []);

            logViz('✅ Loaded data', {
              totalResponses: responses.length,
              validResponses: validResponses.length,
            });
            setData(validResponses);
            setIsMockData(false);
          } else {
            warnViz('⚠️ No data available, using mock data');
            setData(mockData);
            setIsMockData(true);
          }
          setError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch data';
        if (vizDebug) console.error('❌ Error fetching data:', err);
        else console.error('❌ Error fetching data:', msg);
        if (mounted) {
          if (isRetry && retryCount < MAX_RETRIES) {
            retryCount++;
            logViz(`🔄 Retrying data fetch (${retryCount}/${MAX_RETRIES}) in ${1000 * retryCount}ms`);
            setTimeout(() => fetchData(true), 1000 * retryCount);
          } else {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
            logViz('🔄 Fallback to mock data due to error');
            setData(mockData);
            setIsMockData(true);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bump = () => setRefreshToken((t) => t + 1);
    window.addEventListener(OPENGRIMOIRE_SURVEY_DATA_CHANGED, bump);
    return () => window.removeEventListener(OPENGRIMOIRE_SURVEY_DATA_CHANGED, bump);
  }, []);

  return {
    data,
    isLoading,
    error,
    isMockData,
  };
}
