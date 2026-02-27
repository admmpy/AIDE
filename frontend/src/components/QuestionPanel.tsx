import { useGetHint } from '../hooks/useApi';
import { getCurrentQuestion, useAppStore } from '../stores/appStore';

export function QuestionPanel() {
  const state = useAppStore();
  const question = getCurrentQuestion(state);
  const hintQuery = useGetHint(question?.sessionId || null);
  const questionKey = question?.id || question?.sessionId || '';
  const latestExpected = questionKey ? state.expectedByQuestionId[questionKey] : null;

  if (!question) {
    return <section className="question-panel empty">Generate or select a question to start.</section>;
  }

  const revealHint = async () => {
    if (!question.sessionId) return;
    const response = await hintQuery.refetch();
    if (response.data) {
      state.setRevealedHints(response.data.hints);
      state.setActiveTab('hints');
    }
  };

  return (
    <section className="question-panel">
      <header>
        <div>
          <h2>{question.title}</h2>
          <p>{question.subtitle || 'SQL Interview Question'}</p>
        </div>
        <span className={`difficulty ${question.difficulty}`}>{question.difficulty}</span>
      </header>

      <nav className="question-tabs">
        {(['question', 'solution', 'hints', 'submissions'] as const).map((tab) => (
          <button key={tab} className={state.activeTab === tab ? 'active' : ''} onClick={() => state.setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      <div className="question-content">
        {state.activeTab === 'question' && (
          <>
            <p className="question-description">{question.description}</p>
            <h4>Tables</h4>
            {question.tables.map((t) => (
              <div key={t.name} className="table-card">
                <strong>{t.name}</strong>
                <h5>Schema</h5>
                <ul>
                  {t.columns.map((col, idx) => (
                    <li key={idx}>{col}</li>
                  ))}
                </ul>
                <h5>Initial Rows</h5>
                <div className="results-table-wrapper table-sample-wrapper">
                  <table className="results-table table-sample">
                    <thead>
                      <tr>
                        {t.columns.map((col, idx) => (
                          <th key={idx}>{col.split(' ')[0]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.sample_data.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx}>{cell === null ? 'NULL' : String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {latestExpected && (
              <div className="latest-expected-block">
                <h4>Latest Expected Output</h4>
                <p className="hint">From your most recent valid Run &amp; Check.</p>
                <div className="results-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        {latestExpected.columns.map((col, idx) => (
                          <th key={idx}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {latestExpected.rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx}>{cell === null ? 'NULL' : String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button onClick={revealHint} disabled={state.revealedHints.length >= question.hints.length || hintQuery.isFetching}>
              {state.revealedHints.length >= question.hints.length ? 'All hints revealed' : 'Reveal next hint'}
            </button>
          </>
        )}

        {state.activeTab === 'solution' && (
          <pre className="solution-box">{question.expected_query}</pre>
        )}

        {state.activeTab === 'hints' && (
          <div className="hints-list">
            {state.revealedHints.length === 0 && <p>No hints revealed yet.</p>}
            {state.revealedHints.map((hint, idx) => (
              <div key={idx} className="hint-card">
                <strong>Hint {idx + 1}</strong>
                <p>{hint}</p>
              </div>
            ))}
          </div>
        )}

        {state.activeTab === 'submissions' && (
          <div className="submissions-list">
            {state.submissions.filter((s) => s.questionId === question.id).length === 0 && <p>No submissions yet.</p>}
            {state.submissions
              .filter((s) => s.questionId === question.id)
              .map((s, idx) => (
                <div key={idx} className="submission-card">
                  <div>
                    <strong>{s.status}</strong>
                    <small>{new Date(s.submittedAt).toLocaleString()}</small>
                  </div>
                  <pre>{s.sql}</pre>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
