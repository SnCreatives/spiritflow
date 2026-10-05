import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import './utils/masterDiagnostics';
import { ThemeProvider } from './utils/ThemeContext';
import { ToastProvider } from './lib/contexts/ToastContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
