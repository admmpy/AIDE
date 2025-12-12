import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  SQLExecuteRequest,
  SQLExecuteResponse,
  GenerateQuestionRequest,
  GenerateCustomQuestionRequest,
  GenerateQuestionResponse,
  CheckAnswerRequest,
  CheckAnswerResponse,
  HintResponse,
} from '../types';

const API_BASE = 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────────────────────

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL Execution
// ─────────────────────────────────────────────────────────────────────────────

export function useExecuteSQL() {
  return useMutation({
    mutationFn: async (request: SQLExecuteRequest): Promise<SQLExecuteResponse> => {
      return fetchApi<SQLExecuteResponse>('/sql/execute', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Practice Mode
// ─────────────────────────────────────────────────────────────────────────────

export function useGenerateQuestion() {
  return useMutation({
    mutationFn: async (request: GenerateQuestionRequest): Promise<GenerateQuestionResponse> => {
      return fetchApi<GenerateQuestionResponse>('/practice/generate', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
  });
}

export function useGenerateCustomQuestion() {
  return useMutation({
    mutationFn: async (request: GenerateCustomQuestionRequest): Promise<GenerateQuestionResponse> => {
      return fetchApi<GenerateQuestionResponse>('/practice/generate-custom', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
  });
}

export function useCheckAnswer() {
  return useMutation({
    mutationFn: async (request: CheckAnswerRequest): Promise<CheckAnswerResponse> => {
      return fetchApi<CheckAnswerResponse>('/practice/check', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
  });
}

export function useGetHint(sessionId: string | null) {
  return useQuery({
    queryKey: ['hint', sessionId],
    queryFn: async (): Promise<HintResponse> => {
      if (!sessionId) throw new Error('No session');
      return fetchApi<HintResponse>(`/practice/hint/${sessionId}`);
    },
    enabled: false, // Manual trigger only
  });
}

export function useCleanupSession() {
  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      await fetchApi(`/practice/session/${sessionId}`, {
        method: 'DELETE',
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      return fetchApi<{ status: string }>('/health');
    },
    refetchInterval: 30000, // Check every 30 seconds
  });
}
