import { useState } from 'react';
import type { Difficulty, Question } from '../types';
import { usePracticeStore } from '../stores/practiceStore';
import { useGenerateCustomQuestion, useCheckAnswer, useCleanupSession } from '../hooks/useApi';
import { QuestionCard } from './QuestionCard';
import { Editor } from './Editor';
import { ResultsTable } from './ResultsTable';
import { toast } from 'sonner';

function inferDifficulty(userPrompt: string): Difficulty {
  const p = userPrompt.toLowerCase();
  if (p.includes('hard')) return 'hard';
  if (p.includes('easy')) return 'easy';
  if (p.includes('medium')) return 'medium';
  return 'medium';
}

export function CustomQuestionPanel() {
  const [userPrompt, setUserPrompt] = useState('');
  const [query, setQuery] = useState('');

  const {
    currentSession,
    isGenerating,
    isChecking,
    setSession,
    setGenerating,
    setChecking,
    incrementHints,
    recordResult,
  } = usePracticeStore();

  const generateMutation = useGenerateCustomQuestion();
  const checkMutation = useCheckAnswer();
  const cleanupMutation = useCleanupSession();

  const handleGenerateQuestion = async () => {
    if (userPrompt.trim().length < 10) {
      toast.error('Please enter a more detailed prompt (10+ characters)');
      return;
    }

    if (currentSession) {
      cleanupMutation.mutate(currentSession.sessionId);
    }

    setGenerating(true);
    setQuery('');

    try {
      const response = await generateMutation.mutateAsync({ user_prompt: userPrompt.trim() });
      const difficulty = inferDifficulty(userPrompt);

      const questionWithMeta: Question = {
        ...response.question,
        id: response.session_id,
        difficulty,
        schemaName: response.schema_name,
        createdAt: new Date().toISOString(),
      };

      setSession({
        question: questionWithMeta,
        schemaName: response.schema_name,
        sessionId: response.session_id,
        startTime: Date.now(),
        hintsRevealed: 0,
      });

      toast.success('Custom question generated!');
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
    const startTime = Date.now();

    try {
      const response = await checkMutation.mutateAsync({
        query: query.trim(),
        schema_name: currentSession.schemaName,
        session_id: currentSession.sessionId,
      });

      const executionTimeMs = Date.now() - startTime;

      if (response.correct) {
        toast.success('Correct! Well done! 🎉');
        recordResult({
          questionId: currentSession.sessionId,
          question: currentSession.question,
          userQuery: query.trim(),
          isCorrect: true,
          hintsUsed: currentSession.hintsRevealed,
          executionTimeMs,
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

    recordResult({
      questionId: currentSession.sessionId,
      question: currentSession.question,
      userQuery: query.trim() || '-- gave up',
      isCorrect: false,
      hintsUsed: currentSession.hintsRevealed,
      executionTimeMs: Date.now() - currentSession.startTime,
    });

    setQuery(currentSession.question.expected_query);
    toast.info("Here's the expected solution");
  };

  return (
    <div className="custom-question-panel">
      <div className="panel-header">
        <h2>Custom Question</h2>
        <button
          onClick={handleGenerateQuestion}
          disabled={isGenerating}
          className="generate-btn"
        >
          {isGenerating ? 'Generating...' : 'Generate Question'}
        </button>
      </div>

      <textarea
        className="prompt-textarea"
        value={userPrompt}
        onChange={(e) => setUserPrompt(e.target.value)}
        placeholder="e.g. Medium difficulty question using window functions for marketing campaign analysis"
        rows={4}
      />

      {currentSession ? (
        <div className="practice-content" style={{ marginTop: '1.5rem' }}>
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
        <div className="practice-empty" style={{ marginTop: '1.5rem' }}>
          <p>Enter a prompt and click "Generate Question" to start practicing!</p>
        </div>
      )}
    </div>
  );
}
