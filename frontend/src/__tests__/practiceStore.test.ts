import { describe, it, expect } from 'vitest';
import { computeStats } from '../stores/practiceStore';
import type { Question, QuestionResult, Difficulty } from '../types';

// Helper to create a mock question
function createMockQuestion(overrides: Partial<Question> = {}): Question {
  return {
    title: 'Test Question',
    description: 'Test description',
    difficulty: 'easy' as Difficulty,
    tables: [],
    hints: ['Hint 1', 'Hint 2'],
    setup_sql: 'CREATE TABLE test (id INT);',
    expected_query: 'SELECT * FROM test;',
    expected_columns: ['id'],
    ...overrides,
  };
}

// Helper to create a mock result
function createMockResult(overrides: Partial<QuestionResult> = {}): QuestionResult {
  return {
    questionId: 'q1',
    question: createMockQuestion(),
    userQuery: 'SELECT * FROM test;',
    isCorrect: true,
    attemptedAt: new Date().toISOString(),
    hintsUsed: 0,
    ...overrides,
  };
}

describe('computeStats', () => {
  it('returns zero stats for empty history', () => {
    const stats = computeStats([]);

    expect(stats.total).toBe(0);
    expect(stats.correct).toBe(0);
    expect(stats.accuracy).toBe(0);
    expect(stats.recentStreak).toBe(0);
    expect(stats.averageHintsUsed).toBe(0);
  });

  it('computes basic stats correctly', () => {
    const results = [
      createMockResult({ isCorrect: true }),
      createMockResult({ isCorrect: true }),
      createMockResult({ isCorrect: false }),
    ];

    const stats = computeStats(results);

    expect(stats.total).toBe(3);
    expect(stats.correct).toBe(2);
    expect(stats.accuracy).toBe(67); // 2/3 = 66.67% rounds to 67%
  });

  it('computes stats by difficulty', () => {
    const results = [
      createMockResult({
        question: createMockQuestion({ difficulty: 'easy' }),
        isCorrect: true,
      }),
      createMockResult({
        question: createMockQuestion({ difficulty: 'easy' }),
        isCorrect: false,
      }),
      createMockResult({
        question: createMockQuestion({ difficulty: 'medium' }),
        isCorrect: true,
      }),
      createMockResult({
        question: createMockQuestion({ difficulty: 'hard' }),
        isCorrect: true,
      }),
    ];

    const stats = computeStats(results);

    expect(stats.byDifficulty.easy.total).toBe(2);
    expect(stats.byDifficulty.easy.correct).toBe(1);
    expect(stats.byDifficulty.easy.accuracy).toBe(50);
    expect(stats.byDifficulty.medium.total).toBe(1);
    expect(stats.byDifficulty.medium.correct).toBe(1);
    expect(stats.byDifficulty.hard.total).toBe(1);
    expect(stats.byDifficulty.hard.correct).toBe(1);
  });

  it('computes recent streak correctly', () => {
    const now = new Date();
    const results = [
      createMockResult({
        isCorrect: true,
        attemptedAt: new Date(now.getTime() - 3000).toISOString(), // 3s ago
      }),
      createMockResult({
        isCorrect: true,
        attemptedAt: new Date(now.getTime() - 2000).toISOString(), // 2s ago
      }),
      createMockResult({
        isCorrect: true,
        attemptedAt: new Date(now.getTime() - 1000).toISOString(), // 1s ago (most recent)
      }),
    ];

    const stats = computeStats(results);
    expect(stats.recentStreak).toBe(3);
  });

  it('breaks streak on incorrect answer', () => {
    const now = new Date();
    const results = [
      createMockResult({
        isCorrect: true,
        attemptedAt: new Date(now.getTime() - 3000).toISOString(),
      }),
      createMockResult({
        isCorrect: false,
        attemptedAt: new Date(now.getTime() - 2000).toISOString(),
      }),
      createMockResult({
        isCorrect: true,
        attemptedAt: new Date(now.getTime() - 1000).toISOString(), // most recent
      }),
    ];

    const stats = computeStats(results);
    expect(stats.recentStreak).toBe(1); // Only the most recent correct counts
  });

  it('computes average hints used', () => {
    const results = [
      createMockResult({ hintsUsed: 0 }),
      createMockResult({ hintsUsed: 2 }),
      createMockResult({ hintsUsed: 1 }),
    ];

    const stats = computeStats(results);
    expect(stats.averageHintsUsed).toBe(1); // (0+2+1)/3 = 1
  });

  it('rounds average hints to one decimal place', () => {
    const results = [
      createMockResult({ hintsUsed: 1 }),
      createMockResult({ hintsUsed: 1 }),
      createMockResult({ hintsUsed: 2 }),
    ];

    const stats = computeStats(results);
    expect(stats.averageHintsUsed).toBe(1.3); // (1+1+2)/3 = 1.333... rounds to 1.3
  });
});

describe('practiceStore', () => {
  it('should export computeStats function', () => {
    expect(typeof computeStats).toBe('function');
  });
});
