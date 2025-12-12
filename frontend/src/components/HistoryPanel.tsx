import { usePracticeStore, computeStats } from '../stores/practiceStore';
import type { Difficulty } from '../types';

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

function formatDuration(ms: number | undefined): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function HistoryPanel() {
  const history = usePracticeStore((state) => state.history);
  const clearHistory = usePracticeStore((state) => state.clearHistory);
  const stats = computeStats(history);

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
          <div className="stat-value">{stats.correct}</div>
          <div className="stat-label">Correct</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.accuracy}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>

      <div className="stats-extra">
        <div className="stat-item">
          <span className="stat-label">Current Streak:</span>
          <span className="stat-value">{stats.recentStreak}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Avg Hints Used:</span>
          <span className="stat-value">{stats.averageHintsUsed}</span>
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
              {stats.byDifficulty[d].correct}/{stats.byDifficulty[d].total}
              {stats.byDifficulty[d].total > 0 && (
                <span className="difficulty-accuracy">
                  ({stats.byDifficulty[d].accuracy}%)
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p className="empty-history">No practice history yet. Start practicing!</p>
        ) : (
          history.map((result, index) => (
            <div 
              key={`${result.questionId}-${index}`}
              className={`history-item ${result.isCorrect ? 'solved' : 'failed'}`}
            >
              <div className="history-item-main">
                <span 
                  className="history-difficulty"
                  style={{ backgroundColor: DIFFICULTY_COLORS[result.question.difficulty] }}
                >
                  {result.question.difficulty.charAt(0).toUpperCase()}
                </span>
                <span className="history-title">{result.question.title}</span>
                <span className={`history-status ${result.isCorrect ? 'solved' : 'failed'}`}>
                  {result.isCorrect ? '✓' : '✗'}
                </span>
              </div>
              <div className="history-item-meta">
                <span>{result.hintsUsed} hint{result.hintsUsed !== 1 ? 's' : ''}</span>
                <span>{formatDuration(result.executionTimeMs)}</span>
                <span>{new Date(result.attemptedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
