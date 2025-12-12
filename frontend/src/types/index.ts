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

export interface TableSchema {
  name: string;
  columns: string[];
  sample_data: unknown[][];
}

export interface Question {
  title: string;
  description: string;
  tables: TableSchema[];
  setup_sql: string;
  expected_query: string;
  expected_columns: string[];
  hints: string[];
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
  id: string;
  title: string;
  difficulty: Difficulty;
  solved: boolean;
  attempts: number;
  time_taken_ms: number;
  completed_at: string;
}
