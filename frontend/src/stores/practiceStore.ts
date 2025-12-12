import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Question, QuestionResult, Difficulty } from '../types';

interface PracticeSession {
  question: Question;
  schemaName: string;
  sessionId: string;
  startTime: number;
  hintsRevealed: number;
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
  addToHistory: (result: QuestionResult) => void;
  clearHistory: () => void;
  
  // Stats
  getStats: () => {
    total: number;
    solved: number;
    byDifficulty: Record<Difficulty, { total: number; solved: number }>;
  };
}

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set, get) => ({
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
      addToHistory: (result) => set((state) => ({
        history: [result, ...state.history].slice(0, 100), // Keep last 100
      })),

      clearHistory: () => set({ history: [] }),

      // Stats computation
      getStats: () => {
        const { history } = get();
        const byDifficulty: Record<Difficulty, { total: number; solved: number }> = {
          easy: { total: 0, solved: 0 },
          medium: { total: 0, solved: 0 },
          hard: { total: 0, solved: 0 },
        };

        for (const result of history) {
          byDifficulty[result.difficulty].total++;
          if (result.solved) {
            byDifficulty[result.difficulty].solved++;
          }
        }

        return {
          total: history.length,
          solved: history.filter((r) => r.solved).length,
          byDifficulty,
        };
      },
    }),
    {
      name: 'aide-practice-history',
      partialize: (state) => ({ history: state.history }),
    }
  )
);
