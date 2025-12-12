import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { CustomQuestionPanel } from './components/FreeQueryPanel';
import { PracticePanel } from './components/PracticePanel';
import { HistoryPanel } from './components/HistoryPanel';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type Tab = 'query' | 'practice' | 'history';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('practice');

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <h1>AIDE</h1>
          <span className="tagline">SQL Practice Platform</span>
        </div>
        
        <nav className="nav-tabs">
          <button
            className={`tab ${activeTab === 'query' ? 'active' : ''}`}
            onClick={() => setActiveTab('query')}
          >
            Custom Question
          </button>
          <button
            className={`tab ${activeTab === 'practice' ? 'active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            Practice
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'query' && <CustomQuestionPanel />}
        {activeTab === 'practice' && <PracticePanel />}
        {activeTab === 'history' && <HistoryPanel />}
      </main>

      <footer className="app-footer">
        <span>Powered by PostgreSQL 14 & Ollama</span>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
