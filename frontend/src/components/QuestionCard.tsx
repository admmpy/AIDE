import type { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  hintsRevealed: number;
  onRequestHint: () => void;
  isLoadingHint?: boolean;
}

export function QuestionCard({
  question,
  hintsRevealed,
  onRequestHint,
  isLoadingHint,
}: QuestionCardProps) {
  return (
    <div className="question-card">
      <h2 className="question-title">{question.title}</h2>
      
      <p className="question-description">{question.description}</p>
      
      <div className="question-tables">
        <h3>Tables</h3>
        {question.tables.map((table) => (
          <div key={table.name} className="table-schema">
            <h4>{table.name}</h4>
            <div className="table-columns">
              {table.columns.map((col, i) => (
                <code key={i} className="column-def">{col}</code>
              ))}
            </div>
            
            <div className="sample-data">
              <table>
                <thead>
                  <tr>
                    {table.columns.map((col, i) => (
                      <th key={i}>{col.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.sample_data.slice(0, 5).map((row, rowIdx) => (
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
              {table.sample_data.length > 5 && (
                <p className="more-rows">
                  +{table.sample_data.length - 5} more rows
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="question-hints">
        <div className="hints-header">
          <h3>Hints ({hintsRevealed}/{question.hints.length})</h3>
          {hintsRevealed < question.hints.length && (
            <button
              onClick={onRequestHint}
              disabled={isLoadingHint}
              className="hint-button"
            >
              {isLoadingHint ? 'Loading...' : 'Show Hint'}
            </button>
          )}
        </div>
        
        {hintsRevealed > 0 && (
          <ul className="hints-list">
            {question.hints.slice(0, hintsRevealed).map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
