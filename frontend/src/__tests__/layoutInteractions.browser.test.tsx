import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../App.css';

type Tab = 'question' | 'solution' | 'hints' | 'submissions';

function clickByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.trim() === text);
  if (!button) throw new Error(`Button not found: ${text}`);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function expectElementUnobstructed(element: Element): void {
  const rect = element.getBoundingClientRect();
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const topElement = document.elementFromPoint(centerX, centerY);
  expect(topElement === element || !!topElement?.closest('button')?.isSameNode(element)).toBe(true);
}

async function waitForCondition(condition: () => unknown, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
  }
}

function LayoutHarness() {
  const [activeTab, setActiveTab] = useState<Tab>('question');
  const [hints, setHints] = useState<string[]>([]);

  const revealHint = () => {
    setHints(['Use GROUP BY customer name.']);
    setActiveTab('hints');
  };

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Questions</h2>
          <span>1</span>
        </div>
        <div className="question-groups">
          <section>
            <h3>General</h3>
            <button className="question-item active">
              <span>Customer Order Summary</span>
              <small>unattempted</small>
            </button>
          </section>
        </div>
      </aside>

      <section className="question-panel">
        <header>
          <div>
            <h2>Customer Order Summary</h2>
            <p>AI Generated SQL Interview Question</p>
          </div>
          <span className="difficulty easy">easy</span>
        </header>

        <nav className="question-tabs">
          {(['question', 'solution', 'hints', 'submissions'] as const).map((tab) => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>

        <div className="question-content">
          {activeTab === 'question' && (
            <>
              <p>Find total orders per customer.</p>
              <button onClick={revealHint}>Reveal next hint</button>
            </>
          )}
          {activeTab === 'solution' && <pre className="solution-box">SELECT customer_id, COUNT(*) FROM orders;</pre>}
          {activeTab === 'hints' && (
            <div className="hints-list">
              {hints.length === 0 && <p>No hints revealed yet.</p>}
              {hints.map((hint, idx) => (
                <div key={idx} className="hint-card">
                  <strong>Hint {idx + 1}</strong>
                  <p>{hint}</p>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'submissions' && <p>No submissions yet.</p>}
        </div>
      </section>

      <div className="right-pane">
        <section className="editor-panel">
          <div className="panel-title-row">
            <h3>SQL Editor</h3>
          </div>
          <div className="editor-container">
            <div className="monaco-editor">
              <div className="margin-view-overlays" />
              <div className="overflow-guard" style={{ height: 320 }} />
            </div>
          </div>
        </section>
        <section className="output-panel">
          <div className="panel-title-row">
            <h3>Execution Output</h3>
          </div>
          <div className="results-empty">Run a query to see results</div>
        </section>
      </div>
    </main>
  );
}

describe('layout interactions in workspace panes', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(async () => {
    container = document.createElement('div');
    container.style.width = '1280px';
    container.style.height = '900px';
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<LayoutHarness />);
    await waitForCondition(() => container?.querySelector('.question-tabs button'));
  });

  afterEach(async () => {
    root?.unmount();
    container?.remove();
    await Promise.resolve();
  });

  it('switches tabs without blocked clicks', async () => {
    const tabButtons = Array.from(container!.querySelectorAll('.question-tabs button'));
    const solutionButton = tabButtons.find((button) => button.textContent?.trim() === 'solution');
    const hintsButton = tabButtons.find((button) => button.textContent?.trim() === 'hints');
    const submissionsButton = tabButtons.find((button) => button.textContent?.trim() === 'submissions');

    expect(solutionButton).toBeTruthy();
    expect(hintsButton).toBeTruthy();
    expect(submissionsButton).toBeTruthy();

    expectElementUnobstructed(solutionButton!);
    expectElementUnobstructed(hintsButton!);
    expectElementUnobstructed(submissionsButton!);

    clickByText(container!, 'solution');
    await Promise.resolve();
    expect(container!.querySelector('.solution-box')).toBeTruthy();

    clickByText(container!, 'hints');
    await Promise.resolve();
    expect(container!.textContent).toContain('No hints revealed yet.');

    clickByText(container!, 'submissions');
    await Promise.resolve();
    expect(container!.textContent).toContain('No submissions yet.');
  });

  it('reveals hints after button click without interception', async () => {
    clickByText(container!, 'question');
    await Promise.resolve();

    const revealButton = Array.from(container!.querySelectorAll('.question-content button')).find(
      (button) => button.textContent?.trim() === 'Reveal next hint'
    );
    expect(revealButton).toBeTruthy();
    revealButton!.scrollIntoView({ block: 'nearest' });

    clickByText(container!, 'Reveal next hint');
    await Promise.resolve();
    expect(container!.textContent).toContain('Hint 1');
    expect(container!.textContent).toContain('Use GROUP BY customer name.');
  });
});
