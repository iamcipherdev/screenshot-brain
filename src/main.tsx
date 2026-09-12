import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles/app.css';

const rootEl = document.getElementById('root')!;
// keep boot splash until React paints
createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
