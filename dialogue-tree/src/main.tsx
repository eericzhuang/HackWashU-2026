import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { createSession, getSessionNodes } from '@/lib/db';

// Temporary: expose to window for manual console testing
Object.assign(window, { createSession, getSessionNodes });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
