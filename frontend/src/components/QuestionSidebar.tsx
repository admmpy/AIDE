import { useMemo } from 'react';
import { useAppStore, getAttemptStatus, normalizeCategory } from '../stores/appStore';

const statusOrder = ['solved', 'attempted', 'wrong', 'unattempted'] as const;

export function QuestionSidebar() {
  const {
    questions,
    currentQuestionId,
    setCurrentQuestionId,
    history,
    groupBy,
    setGroupBy,
    sidebarSearch,
    setSidebarSearch,
  } = useAppStore();

  const filtered = useMemo(() => {
    const q = sidebarSearch.toLowerCase().trim();
    if (!q) return questions;
    return questions.filter((item) => {
      const category = normalizeCategory(item).toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        category.includes(q) ||
        item.difficulty.toLowerCase().includes(q)
      );
    });
  }, [questions, sidebarSearch]);

  const grouped = useMemo(() => {
    const out: Record<string, typeof filtered> = {};
    filtered.forEach((q) => {
      const key = groupBy === 'category' ? normalizeCategory(q) : q.difficulty;
      if (!out[key]) out[key] = [];
      out[key].push(q);
    });
    return Object.entries(out).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Questions</h2>
        <span>{questions.length}</span>
      </div>

      <input
        className="sidebar-search"
        placeholder="Search questions"
        value={sidebarSearch}
        onChange={(e) => setSidebarSearch(e.target.value)}
      />

      <div className="group-toggle">
        <button className={groupBy === 'category' ? 'active' : ''} onClick={() => setGroupBy('category')}>
          Category
        </button>
        <button className={groupBy === 'difficulty' ? 'active' : ''} onClick={() => setGroupBy('difficulty')}>
          Difficulty
        </button>
      </div>

      <div className="question-groups">
        {grouped.map(([name, items]) => (
          <section key={name}>
            <h3>{name}</h3>
            {items.map((q) => {
              const status = getAttemptStatus(history, q.id || '');
              return (
                <button
                  key={q.id}
                  className={`question-item ${q.id === currentQuestionId ? 'active' : ''}`}
                  onClick={() => q.id && setCurrentQuestionId(q.id)}
                >
                  <span>{q.title}</span>
                  <small>{status}</small>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <footer className="sidebar-footer">
        {statusOrder.map((status) => {
          const count = questions.filter((q) => getAttemptStatus(history, q.id || '') === status).length;
          return (
            <span key={status}>
              {count} {status}
            </span>
          );
        })}
      </footer>
    </aside>
  );
}
