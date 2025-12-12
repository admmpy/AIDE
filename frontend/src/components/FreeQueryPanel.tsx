import { useState } from 'react';
import { Editor } from './Editor';
import { ResultsTable } from './ResultsTable';
import { useExecuteSQL } from '../hooks/useApi';
import { toast } from 'sonner';

export function FreeQueryPanel() {
  const [query, setQuery] = useState('SELECT 1 as test;');
  const executeMutation = useExecuteSQL();

  const handleExecute = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    try {
      await executeMutation.mutateAsync({ query: query.trim() });
    } catch (error) {
      toast.error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="free-query-panel">
      <div className="panel-header">
        <h2>SQL Editor</h2>
        <button
          onClick={handleExecute}
          disabled={executeMutation.isPending}
          className="run-btn"
        >
          {executeMutation.isPending ? 'Running...' : 'Run (Ctrl+Enter)'}
        </button>
      </div>

      <div className="editor-section">
        <Editor
          value={query}
          onChange={setQuery}
          onExecute={handleExecute}
          height="250px"
        />
      </div>

      <div className="results-section">
        <ResultsTable
          result={executeMutation.data ?? null}
          isLoading={executeMutation.isPending}
        />
      </div>
    </div>
  );
}
