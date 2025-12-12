import { useMemo, useCallback } from 'react';
import { usePracticeStore, computeStats } from '../stores/practiceStore';
import type { QuestionResult, HistoryStats, ExportedHistory, Difficulty } from '../types';

interface UsePracticeHistoryReturn {
  /** History sorted by date (most recent first) */
  history: QuestionResult[];
  /** Computed statistics from history */
  stats: HistoryStats;
  /** Clear all history */
  clearHistory: () => void;
  /** Export history as JSON string for backup */
  exportHistory: () => string;
  /** Import history from JSON string (merges with existing, deduplicates by questionId + attemptedAt) */
  importHistory: (jsonString: string) => { imported: number; duplicates: number };
  /** Filter history by difficulty */
  filterByDifficulty: (difficulty: Difficulty) => QuestionResult[];
  /** Get results for a specific question ID */
  getResultsForQuestion: (questionId: string) => QuestionResult[];
}

/**
 * Convenience hook for working with practice question history.
 * Provides sorted history, computed stats, and export/import utilities.
 */
export function usePracticeHistory(): UsePracticeHistoryReturn {
  const history = usePracticeStore((state) => state.history);
  const clearHistoryAction = usePracticeStore((state) => state.clearHistory);
  const recordResult = usePracticeStore((state) => state.recordResult);

  // Sort history by date (most recent first)
  const sortedHistory = useMemo(() => {
    return [...history].sort(
      (a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime()
    );
  }, [history]);

  // Compute stats
  const stats = useMemo(() => computeStats(history), [history]);

  // Export history as JSON
  const exportHistory = useCallback((): string => {
    const exportData: ExportedHistory = {
      version: 1,
      exportedAt: new Date().toISOString(),
      results: sortedHistory,
    };
    return JSON.stringify(exportData, null, 2);
  }, [sortedHistory]);

  // Import history from JSON
  const importHistory = useCallback(
    (jsonString: string): { imported: number; duplicates: number } => {
      const parsed = JSON.parse(jsonString) as ExportedHistory;

      if (parsed.version !== 1) {
        throw new Error(`Unsupported export version: ${parsed.version}`);
      }

      if (!Array.isArray(parsed.results)) {
        throw new Error('Invalid export format: results must be an array');
      }

      // Create a set of existing result keys for deduplication
      const existingKeys = new Set(
        history.map((r) => `${r.questionId}:${r.attemptedAt}`)
      );

      let imported = 0;
      let duplicates = 0;

      for (const result of parsed.results) {
        const key = `${result.questionId}:${result.attemptedAt}`;
        if (existingKeys.has(key)) {
          duplicates++;
        } else {
          // Record result with the original data
          recordResult({
            questionId: result.questionId,
            question: result.question,
            userQuery: result.userQuery,
            isCorrect: result.isCorrect,
            hintsUsed: result.hintsUsed,
            executionTimeMs: result.executionTimeMs,
          });
          existingKeys.add(key);
          imported++;
        }
      }

      return { imported, duplicates };
    },
    [history, recordResult]
  );

  // Filter by difficulty
  const filterByDifficulty = useCallback(
    (difficulty: Difficulty): QuestionResult[] => {
      return sortedHistory.filter((r) => r.question.difficulty === difficulty);
    },
    [sortedHistory]
  );

  // Get results for a specific question
  const getResultsForQuestion = useCallback(
    (questionId: string): QuestionResult[] => {
      return sortedHistory.filter((r) => r.questionId === questionId);
    },
    [sortedHistory]
  );

  return {
    history: sortedHistory,
    stats,
    clearHistory: clearHistoryAction,
    exportHistory,
    importHistory,
    filterByDifficulty,
    getResultsForQuestion,
  };
}
