import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CheckAnswerResponse, Difficulty, Question, SQLExecuteResponse } from '../types';

export type ActiveTab = 'question' | 'solution' | 'hints' | 'submissions';
export type GroupBy = 'category' | 'difficulty';
export type AttemptStatus = 'unattempted' | 'attempted' | 'solved' | 'wrong';

export interface HistoryEntry {
  questionId: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  lastAttemptedAt: string;
  status: AttemptStatus;
  lastSQL?: string;
  timeTaken?: number;
  hintsUsed?: number;
}

export interface Submission {
  questionId: string;
  sql: string;
  result: CheckAnswerResponse;
  status: 'correct' | 'wrong' | 'error';
  submittedAt: string;
}

interface AppState {
  questions: Question[];
  currentQuestionId: string | null;
  setCurrentQuestionId: (id: string) => void;
  addQuestion: (q: Question) => void;

  history: HistoryEntry[];
  updateHistory: (entry: Omit<HistoryEntry, 'lastAttemptedAt'>) => void;

  submissions: Submission[];
  addSubmission: (sub: Submission) => void;

  sqlCode: string;
  setSqlCode: (sql: string) => void;

  queryResult: SQLExecuteResponse | null;
  setQueryResult: (result: SQLExecuteResponse | null) => void;

  checkResult: CheckAnswerResponse | null;
  setCheckResult: (result: CheckAnswerResponse | null) => void;

  revealedHints: string[];
  setRevealedHints: (hints: string[]) => void;
  resetHints: () => void;

  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  groupBy: GroupBy;
  setGroupBy: (groupBy: GroupBy) => void;

  sidebarSearch: string;
  setSidebarSearch: (value: string) => void;

  isAIModalOpen: boolean;
  setIsAIModalOpen: (open: boolean) => void;

  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      questions: [],
      currentQuestionId: null,
      setCurrentQuestionId: (id) => {
        set({
          currentQuestionId: id,
          activeTab: 'question',
          revealedHints: [],
          checkResult: null,
          queryResult: null,
          sqlCode: '-- Write your SQL query here\n',
        });
      },
      addQuestion: (q) => {
        set((state) => {
          const deduped = [q, ...state.questions.filter((x) => x.id !== q.id)].slice(0, 200);
          return {
            questions: deduped,
            currentQuestionId: q.id || null,
            activeTab: 'question',
            revealedHints: [],
            checkResult: null,
            queryResult: null,
            sqlCode: '-- Write your SQL query here\n',
          };
        });
      },

      history: [],
      updateHistory: (entry) => {
        set((state) => {
          const now = new Date().toISOString();
          const existing = state.history.find((x) => x.questionId === entry.questionId);
          if (existing) {
            return {
              history: state.history.map((x) =>
                x.questionId === entry.questionId
                  ? {
                      ...x,
                      ...entry,
                      lastAttemptedAt: now,
                    }
                  : x
              ),
            };
          }
          return {
            history: [{ ...entry, lastAttemptedAt: now }, ...state.history].slice(0, 500),
          };
        });
      },

      submissions: [],
      addSubmission: (sub) => set((state) => ({ submissions: [sub, ...state.submissions].slice(0, 500) })),

      sqlCode: '-- Write your SQL query here\n',
      setSqlCode: (sql) => set({ sqlCode: sql }),

      queryResult: null,
      setQueryResult: (result) => set({ queryResult: result }),

      checkResult: null,
      setCheckResult: (result) => set({ checkResult: result }),

      revealedHints: [],
      setRevealedHints: (hints) => set({ revealedHints: hints }),
      resetHints: () => set({ revealedHints: [] }),

      activeTab: 'question',
      setActiveTab: (tab) => set({ activeTab: tab }),

      groupBy: 'category',
      setGroupBy: (groupBy) => set({ groupBy }),

      sidebarSearch: '',
      setSidebarSearch: (value) => set({ sidebarSearch: value }),

      isAIModalOpen: false,
      setIsAIModalOpen: (open) => set({ isAIModalOpen: open }),

      isRunning: false,
      setIsRunning: (running) => set({ isRunning: running }),
    }),
    {
      name: 'aide-app-store-v2',
      partialize: (state) => ({
        questions: state.questions,
        history: state.history,
        submissions: state.submissions,
        groupBy: state.groupBy,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const questions = state.questions || [];
        state.currentQuestionId = questions.length > 0 ? questions[0].id || null : null;
      },
    }
  )
);

export function getCurrentQuestion(state: AppState): Question | null {
  if (!state.currentQuestionId) return null;
  return state.questions.find((q) => q.id === state.currentQuestionId) || null;
}

export function getAttemptStatus(history: HistoryEntry[], questionId: string): AttemptStatus {
  return history.find((h) => h.questionId === questionId)?.status || 'unattempted';
}

export function normalizeCategory(question: Question): string {
  return question.category || question.domain || 'General';
}

export function normalizeDifficultyLabel(diff: Difficulty): string {
  return diff.charAt(0).toUpperCase() + diff.slice(1);
}
