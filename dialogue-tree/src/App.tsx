import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionList } from '@/components/session/SessionList';
import { ExplorationPage } from '@/pages/ExplorationPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionList />} />
        <Route path="/session/:sessionId" element={<ExplorationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
