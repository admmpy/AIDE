import { useState } from 'react';
import type { Difficulty } from '../types';
import { usePracticeStore } from '../stores/practiceStore';
import { useGenerateQuestion, useCheckAnswer, useCleanupSession } from '../hooks/useApi';
import { QuestionCard } from './QuestionCard';
import { Editor } from './Editor';
import { ResultsTable } from './ResultsTable';
import { toast } from 'sonner';

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Easy', color: '#22c55e' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'hard', label: 'Hard', color: '#ef4444' },
];

export function PracticePanel() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [query, setQuery] = useState('');
  const [attempts, setAttempts] = useState(0);
  
  const {
    currentSession,
    isGenerating,
    isChecking,
    setSession,
    setGenerating,
    setChecking,
    incrementHints,
    addToHistory,
  } = usePracticeStore();

  const generateMutation = useGenerateQuestion();
  const checkMutation = useCheckAnswer();
  const cleanupMutation = useCleanupSession();

  const handleGenerateQuestion = async () => {
    // Cleanup previous session if exists
    if (currentSession) {
      cleanupMutation.mutate(currentSession.sessionId);
    }

    setGenerating(true);
    setQuery('');
    setAttempts(0);

    try {
      const response = await generateMutation.mutateAsync({ difficulty });
      
      setSession({
        question: response.question,
        schemaName: response.schema_name,
        sessionId: response.session_id,
        startTime: Date.now(),
        hintsRevealed: 0,
      });

      toast.success('New question generated!');
    } catch (error) {
      toast.error(`Failed to generate question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCheckAnswer = async () => {
    if (!currentSession || !query.trim()) {
      toast.error('Please write a query first');
      return;
    }

    setChecking(true);
    setAttempts((a) => a + 1);

    try {
      const response = await checkMutation.mutateAsync({
        query: query.trim(),
        schema_name: currentSession.schemaName,
        session_id: currentSession.sessionId,
      });

      if (response.correct) {
        toast.success('Correct! Well done! 🎉');
        
        // Add to history
        addToHistory({
          id: currentSession.sessionId,
          title: currentSession.question.title,
          difficulty,
          solved: true,
          attempts: attempts + 1,
          time_taken_ms: Date.now() - currentSession.startTime,
          completed_at: new Date().toISOString(),
        });
      } else if (response.error) {
        toast.error(`Query error: ${response.error}`);
      } else {
        toast.error(`Incorrect. Row difference: ${response.row_diff}`);
      }
    } catch (error) {
      toast.error(`Failed to check answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setChecking(false);
    }
  };

  const handleRequestHint = () => {
    if (currentSession) {
      incrementHints();
    }
  };

  const handleGiveUp = () => {
    if (!currentSession) return;

    // Add to history as unsolved
    addToHistory({
      id: currentSession.sessionId,
      title: currentSession.question.title,
      difficulty,
      solved: false,
      attempts,
      time_taken_ms: Date.now() - currentSession.startTime,
      completed_at: new Date().toISOString(),
    });

    // Show expected query
    setQuery(currentSession.question.expected_query);
    toast.info('Here\'s the expected solution');
  };

  return (
    <div className="practice-panel">
      <div className="practice-header">
        <h1>Practice Mode</h1>
        
        <div className="practice-controls">
          <div className="difficulty-selector">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`difficulty-btn ${difficulty === d.value ? 'active' : ''}`}
                style={{ '--btn-color': d.color } as React.CSSProperties}
              >
                {d.label}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleGenerateQuestion}
            disabled={isGenerating}
            className="generate-btn"
          >
            {isGenerating ? 'Generating...' : 'New Question'}
          </button>
        </div>
      </div>

      {currentSession ? (
        <div className="practice-content">
          <div className="practice-question">
            <QuestionCard
              question={currentSession.question}
              hintsRevealed={currentSession.hintsRevealed}
              onRequestHint={handleRequestHint}
            />
          </div>

          <div className="practice-editor">
            <div className="editor-header">
              <h3>Your Solution</h3>
              <div className="editor-actions">
                <button
                  onClick={handleGiveUp}
                  className="give-up-btn"
                  disabled={isChecking}
                >
                  Give Up
                </button>
                <button
                  onClick={handleCheckAnswer}
                  disabled={isChecking || !query.trim()}
                  className="check-btn"
                >
                  {isChecking ? 'Checking...' : 'Check Answer'}
                </button>
              </div>
            </div>
            
            <Editor
              value={query}
              onChange={setQuery}
              onExecute={handleCheckAnswer}
              height="200px"
            />

            {checkMutation.data && (
              <div className="practice-results">
                <h4>Your Results</h4>
                <ResultsTable
                  result={{
                    success: !checkMutation.data.error,
                    columns: checkMutation.data.user_columns,
                    rows: checkMutation.data.user_rows,
                    row_count: checkMutation.data.user_rows.length,
                    truncated: false,
                    error: checkMutation.data.error,
                    execution_time_ms: 0,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="practice-empty">
          <p>Select a difficulty and click "New Question" to start practicing!</p>
        </div>
      )}
    </div>
  );
}
