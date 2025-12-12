import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Question, QuestionResult, Difficulty, HistoryStats } from '../types';

interface PracticeSession {
  question: Question;
  schemaName: string;
  sessionId: string;
  startTime: number;
  hintsRevealed: number;
}

interface RecordResultInput {
  questionId: string;
  question: Question;
  userQuery: string;
  isCorrect: boolean;
  hintsUsed: number;
  executionTimeMs?: number;
}

interface PracticeState {
  // Current session
  currentSession: PracticeSession | null;
  isGenerating: boolean;
  isChecking: boolean;

  // History (persisted)
  history: QuestionResult[];
  
  // Actions
  setSession: (session: PracticeSession | null) => void;
  setGenerating: (generating: boolean) => void;
  setChecking: (checking: boolean) => void;
  incrementHints: () => void;
  
  // History actions
  recordResult: (input: RecordResultInput) => void;
  clearHistory: () => void;
}

/**
 * Compute statistics from question history
 */
export function computeStats(history: QuestionResult[]): HistoryStats {
  if (history.length === 0) {
    return {
      total: 0,
      correct: 0,
      accuracy: 0,
      byDifficulty: {
        easy: { total: 0, correct: 0, accuracy: 0 },
        medium: { total: 0, correct: 0, accuracy: 0 },
        hard: { total: 0, correct: 0, accuracy: 0 },
      },
      recentStreak: 0,
      averageHintsUsed: 0,
    };
  }

  const byDifficulty: Record<Difficulty, { total: number; correct: number; accuracy: number }> = {
    easy: { total: 0, correct: 0, accuracy: 0 },
    medium: { total: 0, correct: 0, accuracy: 0 },
    hard: { total: 0, correct: 0, accuracy: 0 },
  };

  let totalHints = 0;

  for (const result of history) {
    const diff = result.question.difficulty;
    byDifficulty[diff].total++;
    if (result.isCorrect) {
      byDifficulty[diff].correct++;
    }
    totalHints += result.hintsUsed;
  }

  // Calculate accuracy per difficulty
  for (const diff of ['easy', 'medium', 'hard'] as Difficulty[]) {
    if (byDifficulty[diff].total > 0) {
      byDifficulty[diff].accuracy = Math.round(
        (byDifficulty[diff].correct / byDifficulty[diff].total) * 100
      );
    }
  }

  // Calculate recent streak (consecutive correct from most recent)
  const sorted = [...history].sort(
    (a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime()
  );
  
  let recentStreak = 0;
  for (const result of sorted) {
    if (result.isCorrect) {
      recentStreak++;
    } else {
      break;
    }
  }

  const total = history.length;
  const correct = history.filter((r) => r.isCorrect).length;

  return {
    total,
    correct,
    accuracy: Math.round((correct / total) * 100),
    byDifficulty,
    recentStreak,
    averageHintsUsed: Math.round((totalHints / total) * 10) / 10,
  };
}

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      // Initial state
      currentSession: null,
      isGenerating: false,
      isChecking: false,
      history: [],

      // Session actions
      setSession: (session) => set({ currentSession: session }),
      
      setGenerating: (generating) => set({ isGenerating: generating }),
      
      setChecking: (checking) => set({ isChecking: checking }),
      
      incrementHints: () => set((state) => ({
        currentSession: state.currentSession
          ? { ...state.currentSession, hintsRevealed: state.currentSession.hintsRevealed + 1 }
          : null,
      })),

      // History actions
      recordResult: (input) => set((state) => {
        const result: QuestionResult = {
          questionId: input.questionId,
          question: input.question,
          userQuery: input.userQuery,
          isCorrect: input.isCorrect,
          attemptedAt: new Date().toISOString(),
          hintsUsed: input.hintsUsed,
          executionTimeMs: input.executionTimeMs,
        };
        return {
          history: [result, ...state.history].slice(0, 100), // Keep last 100
        };
      }),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'aide-practice-history',
      partialize: (state) => ({ history: state.history }),
    }
  )
);
