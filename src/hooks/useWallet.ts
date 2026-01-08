import { useMemo } from 'react';
import { useNWC } from '@/hooks/useNWCContext';
import type { WebLNProvider } from '@webbtc/webln-types';

export interface WalletStatus {
  hasNWC: boolean;
  hasWebLN: boolean;
  webln: WebLNProvider | null;
  activeNWC: ReturnType<typeof useNWC>['getActiveConnection'] extends () => infer T ? T : null;
  // Priority: NWC > WebLN > LNbits > Direct Node > Manual
  preferredMethod: 'nwc' | 'webln' | 'lnbits' | 'node' | 'manual';
  availableMethods: Array<'nwc' | 'webln' | 'lnbits' | 'node' | 'manual'>;
}

export interface LNbitsConfig {
  url: string;
  adminKey: string;
}

export interface DirectNodeConfig {
  type: 'lnd' | 'clightning' | 'eclair';
  host: string;
  port: number;
  macaroon?: string;
  tlsCert?: string;
}

export function useWallet() {
  const { connections, getActiveConnection } = useNWC();

  // Get the active connection directly - no memoization to avoid stale state
  const activeNWC = getActiveConnection();

  // Access WebLN directly from browser global scope
  const webln = (globalThis as { webln?: WebLNProvider }).webln || null;

  // Check for LNbits configuration (stored in localStorage)
  const lnbitsConfig = useMemo(() => {
    try {
      const stored = localStorage.getItem('sat-sorter-lnbits');
      if (stored) {
        return JSON.parse(stored) as LNbitsConfig;
      }
    } catch (e) {
      console.error('Failed to parse LNbits config:', e);
    }
    return null;
  }, []);

  // Check for Direct Node configuration (stored in localStorage)
  const nodeConfig = useMemo(() => {
    try {
      const stored = localStorage.getItem('sat-sorter-node');
      if (stored) {
        return JSON.parse(stored) as DirectNodeConfig;
      }
    } catch (e) {
      console.error('Failed to parse node config:', e);
    }
    return null;
  }, []);

  // Calculate status values reactively
  const hasNWC = useMemo(() => {
    return connections.length > 0 && connections.some(c => c.isConnected);
  }, [connections]);

  const hasWebLN = useMemo(() => {
    return webln !== null;
  }, [webln]);

  const hasLNbits = useMemo(() => {
    return lnbitsConfig !== null && lnbitsConfig.url && lnbitsConfig.adminKey;
  }, [lnbitsConfig]);

  const hasNode = useMemo(() => {
    return nodeConfig !== null && nodeConfig.host && nodeConfig.port;
  }, [nodeConfig]);

  // Build list of available methods in priority order
  const availableMethods = useMemo(() => {
    const methods: Array<'nwc' | 'webln' | 'lnbits' | 'node' | 'manual'> = [];
    if (hasNWC) methods.push('nwc');
    if (hasWebLN) methods.push('webln');
    if (hasLNbits) methods.push('lnbits');
    if (hasNode) methods.push('node');
    methods.push('manual'); // Always available as fallback
    return methods;
  }, [hasNWC, hasWebLN, hasLNbits, hasNode]);

  // Determine preferred payment method (uses first available)
  const preferredMethod: WalletStatus['preferredMethod'] = availableMethods[0] || 'manual';

  const status: WalletStatus = {
    hasNWC,
    hasWebLN,
    webln,
    activeNWC,
    preferredMethod,
    availableMethods,
  };

  return status;
}

/**
 * Store LNbits configuration
 */
export function saveLNbitsConfig(config: LNbitsConfig) {
  localStorage.setItem('sat-sorter-lnbits', JSON.stringify(config));
}

/**
 * Clear LNbits configuration
 */
export function clearLNbitsConfig() {
  localStorage.removeItem('sat-sorter-lnbits');
}

/**
 * Store Direct Node configuration
 */
export function saveNodeConfig(config: DirectNodeConfig) {
  localStorage.setItem('sat-sorter-node', JSON.stringify(config));
}

/**
 * Clear Direct Node configuration
 */
export function clearNodeConfig() {
  localStorage.removeItem('sat-sorter-node');
}