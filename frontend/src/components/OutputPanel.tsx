import { ResultsTable } from './ResultsTable';
import { useAppStore } from '../stores/appStore';

export function OutputPanel() {
  const result = useAppStore((s) => s.queryResult);
  const checkResult = useAppStore((s) => s.checkResult);

  return (
    <section className="output-panel">
      <div className="panel-title-row">
        <h3>Execution Output</h3>
        {checkResult && <span>{checkResult.correct ? 'Correct' : 'Not correct'}</span>}
      </div>
      <ResultsTable result={result} />
    </section>
  );
}
