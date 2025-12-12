import { usePracticeStore } from '../stores/practiceStore';
import type { Difficulty } from '../types';

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function HistoryPanel() {
  const { history, getStats, clearHistory } = usePracticeStore();
  const stats = getStats();

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2>Practice History</h2>
        {history.length > 0 && (
          <button onClick={clearHistory} className="clear-btn">
            Clear History
          </button>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Attempted</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.solved}</div>
          <div className="stat-label">Solved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {stats.total > 0 
              ? Math.round((stats.solved / stats.total) * 100) 
              : 0}%
          </div>
          <div className="stat-label">Success Rate</div>
        </div>
      </div>

      <div className="difficulty-stats">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <div key={d} className="difficulty-stat">
            <span 
              className="difficulty-label"
              style={{ color: DIFFICULTY_COLORS[d] }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </span>
            <span className="difficulty-progress">
              {stats.byDifficulty[d].solved}/{stats.byDifficulty[d].total}
            </span>
          </div>
        ))}
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p className="empty-history">No practice history yet. Start practicing!</p>
        ) : (
          history.map((result) => (
            <div 
              key={result.id} 
              className={`history-item ${result.solved ? 'solved' : 'failed'}`}
            >
              <div className="history-item-main">
                <span 
                  className="history-difficulty"
                  style={{ backgroundColor: DIFFICULTY_COLORS[result.difficulty] }}
                >
                  {result.difficulty.charAt(0).toUpperCase()}
                </span>
                <span className="history-title">{result.title}</span>
                <span className={`history-status ${result.solved ? 'solved' : 'failed'}`}>
                  {result.solved ? '✓' : '✗'}
                </span>
              </div>
              <div className="history-item-meta">
                <span>{result.attempts} attempt{result.attempts !== 1 ? 's' : ''}</span>
                <span>{formatDuration(result.time_taken_ms)}</span>
                <span>{new Date(result.completed_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
