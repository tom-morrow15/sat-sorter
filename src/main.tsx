import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

// Initialize secure storage (device encryption key) before app renders
// so that all useLocalStorage calls with encrypted serializers have the key ready.
import { initSecureStorage } from './lib/secureStorage';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

import '@fontsource-variable/inter';

initSecureStorage().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
});
