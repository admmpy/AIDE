import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useGenerateCustomQuestion, useGetModels } from '../hooks/useApi';
import { normalizeCategory, useAppStore } from '../stores/appStore';
import type { Difficulty, Question } from '../types';

function inferDifficulty(prompt: string): Difficulty {
  const p = prompt.toLowerCase();
  if (p.includes('hard')) return 'hard';
  if (p.includes('easy')) return 'easy';
  return 'medium';
}

export function AIGeneratorModal() {
  const isOpen = useAppStore((s) => s.isAIModalOpen);
  const setOpen = useAppStore((s) => s.setIsAIModalOpen);
  const addQuestion = useAppStore((s) => s.addQuestion);

  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const modelsQuery = useGetModels();
  const generateMutation = useGenerateCustomQuestion();

  const models = modelsQuery.data;

  const defaultModel = useMemo(() => {
    const resolved = models || [];
    const d = resolved.find((m) => m.is_default)?.id;
    return d || resolved[0]?.id || '';
  }, [models]);

  const modelValue = selectedModel || defaultModel;

  const close = () => {
    setOpen(false);
    setPrompt('');
  };

  const generate = async () => {
    if (prompt.trim().length < 10) {
      toast.error('Prompt must be at least 10 characters');
      return;
    }

    try {
      const response = await generateMutation.mutateAsync({
        user_prompt: prompt.trim(),
        model_id: modelValue || undefined,
      });

      const q: Question = {
        ...response.question,
        id: response.session_id,
        sessionId: response.session_id,
        schemaName: response.schema_name,
        difficulty: inferDifficulty(prompt),
        category: normalizeCategory(response.question),
        subtitle: 'AI Generated SQL Interview Question',
        assumptions: [],
        createdAt: new Date().toISOString(),
      };

      addQuestion(q);
      toast.success('Question generated');
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>AI Window: Generate SQL Interview Question</h3>
          <button onClick={close}>Close</button>
        </div>

        <label>Model</label>
        <select value={modelValue} onChange={(e) => setSelectedModel(e.target.value)}>
          {(models || []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.description ? `- ${m.description}` : ''}
            </option>
          ))}
        </select>

        <label>Prompt</label>
        <textarea
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Generate a medium difficulty SQL interview question about customer retention using joins and aggregation"
        />

        <p className="modal-help">OpenRouter key is read from backend `.env` and never exposed to the browser.</p>

        <div className="modal-actions">
          <button onClick={close}>Cancel</button>
          <button className="primary" onClick={generate} disabled={generateMutation.isPending || modelsQuery.isLoading}>
            {generateMutation.isPending ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
