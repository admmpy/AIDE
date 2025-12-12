// ─────────────────────────────────────────────────────────────────────────────
// SQL Execution Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SQLExecuteRequest {
  query: string;
  schema_name?: string;
}

export interface SQLExecuteResponse {
  success: boolean;
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
  error: string | null;
  execution_time_ms: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Practice Mode Types
// ─────────────────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Domain =
  | 'e-commerce'
  | 'HR/employees'
  | 'social media'
  | 'healthcare'
  | 'finance'
  | 'logistics';

export interface TableSchema {
  name: string;
  columns: string[];
  sample_data: unknown[][];
}

export interface Question {
  id?: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  domain?: Domain;
  tables: TableSchema[];
  setup_sql: string;
  expected_query: string;
  expected_columns: string[];
  hints: string[];
  schemaName?: string;
  createdAt?: string;
}

export interface GenerateQuestionRequest {
  difficulty: Difficulty;
  domain?: string;
}

export interface GenerateQuestionResponse {
  question: Question;
  schema_name: string;
  session_id: string;
}

export interface CheckAnswerRequest {
  query: string;
  schema_name: string;
  session_id: string;
}

export interface CheckAnswerResponse {
  correct: boolean;
  user_columns: string[];
  user_rows: unknown[][];
  expected_columns: string[];
  expected_rows: unknown[][];
  row_diff: number;
  error: string | null;
}

export interface HintResponse {
  hints: string[];
  revealed_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Question History
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionResult {
  questionId: string;
  question: Question;
  userQuery: string;
  isCorrect: boolean;
  attemptedAt: string;
  hintsUsed: number;
  executionTimeMs?: number;
}

export interface HistoryStats {
  total: number;
  correct: number;
  accuracy: number;
  byDifficulty: Record<Difficulty, { total: number; correct: number; accuracy: number }>;
  recentStreak: number;
  averageHintsUsed: number;
}

export interface ExportedHistory {
  version: 1;
  exportedAt: string;
  results: QuestionResult[];
}
