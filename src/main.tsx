import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { TrayApp } from './TrayApp';
import { currentWindowLabel } from './lib/backend';
import { StoreProvider } from './store';
import './styles.css';

// No browser context menu or reload shortcuts in the desktop app.
window.addEventListener('contextmenu', (e) => {
  if (!(e.target as HTMLElement).closest('input, textarea')) e.preventDefault();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) e.preventDefault();
});

// The tray mini-window loads the same page; it only reads data and never writes it.
const isTray = currentWindowLabel() === 'tray';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTray ? <TrayApp /> : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>,
);
