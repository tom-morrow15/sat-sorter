import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

// iOS 27 standalone PWAs get a system blur over the top edge — tag the
// document so CSS can keep that band content-free (see index.css)
import { isIOSStandalonePWA } from './lib/iosStandalone';
if (isIOSStandalonePWA()) {
  document.documentElement.classList.add('ios27-pwa');
}

// Dev-only console bridge (must run before app code logs anything)
import './lib/devConsoleBridge';

// Initialize secure storage (device encryption key) before app renders
// so that all useLocalStorage calls with encrypted serializers have the key ready.
import { initSecureStorage } from './lib/secureStorage';
import { installDebugLogCapture } from '@/lib/debugLog';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// Capture sync/partner logs into the in-app debug buffer so users can view
// them on mobile (where there's no browser console).
installDebugLogCapture();

// Space Grotesk — all UI text
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
// Space Mono — all numeric values (ledger/terminal precision)
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
// Cormorant Garamond — serif fallback for Cochin (headers/logotype)
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';

initSecureStorage().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
});
