import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

function renderError(error) {
  const root = document.getElementById('root');
  root.innerHTML = `
    <main style="font-family: system-ui, sans-serif; padding: 32px; max-width: 760px;">
      <h1 style="margin: 0 0 12px; color: #17201c;">Biblia en Contexto</h1>
      <p style="color: #8d3f45; font-weight: 700;">La app no pudo iniciar.</p>
      <pre style="white-space: pre-wrap; background: #fff8f4; border: 1px solid #ead2c9; padding: 16px; border-radius: 8px;">${String(error?.message ?? error)}</pre>
    </main>
  `;
}

window.addEventListener('error', (event) => renderError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => renderError(event.reason));

try {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  renderError(error);
}
