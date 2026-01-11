import { useMemo } from 'react';
import { useNWC } from '@/hooks/useNWCContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export interface WalletStatus {
  hasAlbyHub: boolean;
  hasLNbits: boolean;
  activeNWC: ReturnType<typeof useNWC>['getActiveConnection'] extends () => infer T ? T : null;
  availableMethods: Array<'alby' | 'lnbits' | 'csv' | 'manual'>;
}

export interface LNbitsConfig {
  url: string;
  adminKey: string;
}

export function useWallet() {
  const { connections, getActiveConnection } = useNWC();
  const [lnbitsConfig] = useLocalStorage<LNbitsConfig | null>('lnbits-config', null);

  // Get the active NWC connection
  const activeNWC = getActiveConnection();

  // Check connection status
  // We consider a wallet connected if we have the connectionString stored
  // The actual connection is established on-demand when making payments
  const hasAlbyHub = useMemo(() => {
    return connections.length > 0 && connections.some(c => c.connectionString);
  }, [connections]);

  const hasLNbits = useMemo(() => {
    return lnbitsConfig !== null && !!lnbitsConfig.url && !!lnbitsConfig.adminKey;
  }, [lnbitsConfig]);

  // Build list of available methods
  const availableMethods = useMemo(() => {
    const methods: Array<'alby' | 'lnbits' | 'csv' | 'manual'> = [];
    if (hasAlbyHub) methods.push('alby');
    if (hasLNbits) methods.push('lnbits');
    methods.push('csv'); // Always available
    methods.push('manual'); // Always available
    return methods;
  }, [hasAlbyHub, hasLNbits]);

  const status: WalletStatus = {
    hasAlbyHub,
    hasLNbits,
    activeNWC,
    availableMethods,
  };

  return status;
}
