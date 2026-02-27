import { toast } from 'sonner';
import { useCheckAnswer } from '../hooks/useApi';
import { Editor } from './Editor';
import { getCurrentQuestion, normalizeCategory, useAppStore } from '../stores/appStore';

export function EditorPanel() {
  const state = useAppStore();
  const question = getCurrentQuestion(state);
  const checkMutation = useCheckAnswer();

  const runCheck = async () => {
    if (!question?.sessionId || !question.schemaName) {
      toast.error('Selected question has no active backend session. Regenerate it to run checks.');
      return;
    }
    const sql = state.sqlCode.trim();
    if (!sql) return;

    state.setIsRunning(true);
    const started = Date.now();

    try {
      const response = await checkMutation.mutateAsync({
        query: sql,
        schema_name: question.schemaName,
        session_id: question.sessionId,
      });

      const questionKey = question.id || question.sessionId || '';
      if (!response.error && questionKey) {
        state.setExpectedOutputForQuestion(
          questionKey,
          response.expected_columns,
          response.expected_rows
        );
      }

      const status = response.error ? 'error' : response.correct ? 'correct' : 'wrong';

      state.addSubmission({
        questionId: questionKey,
        sql,
        status,
        result: response,
        submittedAt: new Date().toISOString(),
      });

      state.setCheckResult(response);
      state.setQueryResult({
        success: !response.error,
        columns: response.user_columns,
        rows: response.user_rows,
        row_count: response.user_rows.length,
        truncated: false,
        error: response.error,
        execution_time_ms: Date.now() - started,
      });

      state.updateHistory({
        questionId: questionKey,
        title: question.title,
        category: normalizeCategory(question),
        difficulty: question.difficulty,
        status: response.correct ? 'solved' : response.error ? 'attempted' : 'wrong',
        lastSQL: sql,
        timeTaken: Date.now() - started,
        hintsUsed: state.revealedHints.length,
      });

      if (response.correct) toast.success('Correct answer');
      else if (response.error) {
        const label = response.failure_type === 'none' ? 'execution_error' : response.failure_type;
        toast.error(`[${label}] ${response.failure_message || response.error}`);
      } else {
        toast.error(response.failure_message || `Incorrect result. Row difference: ${response.row_diff}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to check answer');
    } finally {
      state.setIsRunning(false);
    }
  };

  return (
    <section className="editor-panel">
      <div className="panel-title-row">
        <h3>SQL Editor</h3>
        <button className="primary" onClick={runCheck} disabled={state.isRunning || !state.sqlCode.trim()}>
          {state.isRunning ? 'Running...' : 'Run & Check'}
        </button>
      </div>
      <Editor value={state.sqlCode} onChange={state.setSqlCode} onExecute={runCheck} height="100%" />
    </section>
  );
}
