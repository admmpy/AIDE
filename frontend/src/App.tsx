import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AIGeneratorModal } from './components/AIGeneratorModal';
import { EditorPanel } from './components/EditorPanel';
import { Navbar } from './components/Navbar';
import { OutputPanel } from './components/OutputPanel';
import { QuestionPanel } from './components/QuestionPanel';
import { QuestionSidebar } from './components/QuestionSidebar';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function AppContent() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="workspace">
        <QuestionSidebar />
        <QuestionPanel />
        <div className="right-pane">
          <EditorPanel />
          <OutputPanel />
        </div>
      </main>
      <AIGeneratorModal />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
