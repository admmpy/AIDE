import type { SQLExecuteResponse } from '../types';

interface ResultsTableProps {
  result: SQLExecuteResponse | null;
  isLoading?: boolean;
}

export function ResultsTable({ result, isLoading }: ResultsTableProps) {
  if (isLoading) {
    return (
      <div className="results-loading">
        <div className="spinner" />
        <span>Executing query...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-empty">
        <p>Run a query to see results</p>
        <p className="hint">Press Ctrl+Enter or click Run</p>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="results-error">
        <h4>Error</h4>
        <pre>{result.error}</pre>
      </div>
    );
  }

  if (result.columns.length === 0) {
    return (
      <div className="results-empty">
        <p>Query executed successfully</p>
        <p className="hint">No rows returned</p>
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="results-meta">
        <span>
          {result.row_count} row{result.row_count !== 1 ? 's' : ''}
          {result.truncated && ` (showing first ${result.rows.length})`}
        </span>
        <span>{result.execution_time_ms.toFixed(1)}ms</span>
      </div>
      
      <div className="results-table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              {result.columns.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx}>
                    {cell === null ? (
                      <span className="null-value">NULL</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
