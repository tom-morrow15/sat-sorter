/**
 * Detects an iOS 27+ home-screen (standalone) PWA.
 *
 * iOS 27 draws an unconditional system blur over the top edge of standalone
 * web apps — there is no web-facing opt-out (verified: Safari is crisp, the
 * installed PWA is blurry, regardless of status-bar meta). The app works
 * around it by keeping the blurred band content-free (see index.css
 * `.ios27-pwa` rules).
 */
export function isIOSStandalonePWA(minVersion = 27): boolean {
  if (typeof window === 'undefined') return false;

  const standalone =
    ('standalone' in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone)) ||
    (window.matchMedia?.('(display-mode: standalone)').matches ?? false);
  if (!standalone) return false;

  const ua = navigator.userAgent;
  const isIPhone = /iPhone|iPod/.test(ua);
  // iPadOS 13+ reports a desktop Mac UA; distinguish via touch points
  const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPhone && !isIPad) return false;

  const match = ua.match(/OS (\d+)_/);
  if (match) return parseInt(match[1], 10) >= minVersion;

  // Desktop-style iPad UA has no OS version — assume recent
  return isIPad;
}
