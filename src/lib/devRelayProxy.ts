/**
 * Dev-only relay URL mapping.
 *
 * Bionic's embedded preview browser blocks direct wss:// connections to
 * external relays. When VITE_RELAY_PROXY is set (via .env.local), all relay
 * connections are redirected to a local proxy (see .devtools/relay-proxy.js)
 * that tunnels to a real relay. This is a no-op in production builds.
 */
const PROXY_URL = import.meta.env.VITE_RELAY_PROXY as string | undefined;

export function mapRelayUrl(url: string): string {
  if (import.meta.env.DEV && PROXY_URL) return PROXY_URL;
  return url;
}
