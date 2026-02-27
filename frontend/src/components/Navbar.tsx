import type { Difficulty } from '../types';
import { useGenerateQuestion } from '../hooks/useApi';
import { useAppStore } from '../stores/appStore';
import { toast } from 'sonner';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function inferCategory(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('finance')) return 'Finance';
  if (p.includes('health')) return 'Healthcare';
  if (p.includes('hr') || p.includes('employee')) return 'HR';
  if (p.includes('social')) return 'Social Media';
  if (p.includes('e-commerce') || p.includes('ecommerce')) return 'E-Commerce';
  if (p.includes('logistics')) return 'Logistics';
  return 'General';
}

export function Navbar() {
  const setIsAIModalOpen = useAppStore((s) => s.setIsAIModalOpen);
  const addQuestion = useAppStore((s) => s.addQuestion);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const generateMutation = useGenerateQuestion();

  const handleQuickGenerate = async (difficulty: Difficulty) => {
    try {
      const response = await generateMutation.mutateAsync({ difficulty });
      addQuestion({
        ...response.question,
        id: response.session_id,
        sessionId: response.session_id,
        schemaName: response.schema_name,
        difficulty,
        category: inferCategory(response.question.description),
        subtitle: 'Generated Practice Question',
        assumptions: [],
        createdAt: new Date().toISOString(),
      });
      toast.success(`Generated ${difficulty} question`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate question');
    }
  };

  return (
    <header className="topbar">
      <div>
        <h1>AIDE</h1>
        <p>SQL Interview Practice • OpenRouter + PostgreSQL</p>
      </div>
      <div className="topbar-actions">
        {DIFFICULTIES.map((d) => (
          <button key={d} onClick={() => handleQuickGenerate(d)} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Generating...' : `New ${d}`}
          </button>
        ))}
        <button className="primary" onClick={() => setIsAIModalOpen(true)}>
          AI Prompt Window
        </button>
        <button onClick={toggleTheme}>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </header>
  );
}
