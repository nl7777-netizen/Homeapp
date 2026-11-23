import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePlannerStore } from './store/usePlannerStore';
import './index.css';

// Auto-save: persist store to localStorage (debounced) whenever it changes.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
usePlannerStore.subscribe((state) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    usePlannerStore.getState().persistNow();
  }, 400);
});

// Apply persisted theme on boot.
const theme = usePlannerStore.getState().state.theme;
document.documentElement.classList.toggle('dark', theme === 'dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
