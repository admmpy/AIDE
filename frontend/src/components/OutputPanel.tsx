import { ResultsTable } from './ResultsTable';
import { useAppStore } from '../stores/appStore';
import type { CheckAnswerResponse } from '../types';

function getRunStatusLabel(checkResult: CheckAnswerResponse | null): string {
  if (!checkResult) return 'Idle';
  if (checkResult.correct) return 'Correct';
  if (checkResult.error) return `Execution Error (${checkResult.failure_type})`;
  if (checkResult.failure_type === 'wrong_columns') return 'Wrong Answer (columns mismatch)';
  if (checkResult.failure_type === 'wrong_rows') return 'Wrong Answer (rows mismatch)';
  if (checkResult.failure_type === 'wrong_columns_and_rows') return 'Wrong Answer (columns + rows mismatch)';
  return 'Not correct';
}

export function OutputPanel() {
  const state = useAppStore();
  const result = state.queryResult;
  const checkResult = state.checkResult;
  const showExpectedForMismatch = !!checkResult && !checkResult.correct && !checkResult.error;

  const expectedResult = showExpectedForMismatch
    ? {
        success: true,
        columns: checkResult.expected_columns,
        rows: checkResult.expected_rows,
        row_count: checkResult.expected_rows.length,
        truncated: false,
        error: null,
        execution_time_ms: 0,
      }
    : null;

  return (
    <section className="output-panel">
      <div className="panel-title-row">
        <h3>Execution Output</h3>
        <span>{getRunStatusLabel(checkResult)}</span>
      </div>
      <div className="output-sections">
        <div className="output-section">
          <h4>Your Output</h4>
          {checkResult?.failure_message && <p className="output-message">{checkResult.failure_message}</p>}
          <ResultsTable result={result} />
        </div>

        {showExpectedForMismatch && (
          <div className="output-section">
            <h4>Expected Output</h4>
            <ResultsTable result={expectedResult} />
          </div>
        )}
      </div>
    </section>
  );
}
