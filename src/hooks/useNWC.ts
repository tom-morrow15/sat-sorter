import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { LN } from '@getalby/sdk';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { getSafeNip44 } from '@/lib/utils';
import { useExtensionReady } from '@/hooks/useExtensionReady';

export interface NWCConnection {
  connectionString: string;
  alias?: string;
  isConnected: boolean;
  client?: LN;
}

export interface NWCInfo {
  alias?: string;
  color?: string;
  pubkey?: string;
  network?: string;
  methods?: string[];
  notifications?: string[];
}

const NWC_CONNECTIONS_KIND = 30079; // NIP-78 Application-specific data for NWC
const NWC_CONNECTIONS_IDENTIFIER = 'sat-sorter/nwc-connections';

// Debug helper to check localStorage state
function debugLocalStorage(prefix: string) {
  if (typeof window === 'undefined') return;

  try {
    const connections = localStorage.getItem('nwc-connections');
    const active = localStorage.getItem('nwc-active-connection');
    console.log(`[NWC Debug] ${prefix}:`, {
      connections: connections ? JSON.parse(connections) : null,
      connectionsRaw: connections?.slice(0, 100),
      active: active ? JSON.parse(active) : null,
      activeRaw: active?.slice(0, 50),
    });
  } catch (e) {
    console.log(`[NWC Debug] ${prefix}: Error reading localStorage:`, e);
  }
}

export function useNWCInternal() {
  const { toast } = useToast();
  const [connections, setConnections] = useLocalStorage<NWCConnection[]>('nwc-connections', []);
  const [activeConnection, setActiveConnection] = useLocalStorage<string | null>('nwc-active-connection', null);
  const { user, loginType } = useCurrentUser();
  const { nostr } = useNostr();
  const [hasDownloadedCloudConnections, setHasDownloadedCloudConnections] = useState(false);

  // Only wait for extension if user logged in via extension
  const needsExtension = loginType === 'extension';
  const { isReady: isExtensionReady } = useExtensionReady();

  // Safely check for NIP-44 support (handles extension not installed case)
  // For extension logins: wait for extension to be ready first
  // For nsec/bunker logins: check immediately (no extension needed)
  const nip44 = useMemo(() => {
    if (needsExtension && !isExtensionReady) return null;
    return getSafeNip44(user);
  }, [user, needsExtension, isExtensionReady]);

  // Debug: Log connection state on mount and changes
  useEffect(() => {
    debugLocalStorage('Hook mounted/updated');
    console.log('[NWC Debug] Current state:', {
      connectionsCount: connections.length,
      hasActiveConnection: !!activeConnection,
      connectionAliases: connections.map(c => c.alias),
      loginType,
      needsExtension,
      isExtensionReady,
      hasNip44: !!nip44,
      hasUser: !!user?.pubkey,
    });
  }, [connections, activeConnection, loginType, needsExtension, isExtensionReady, nip44, user?.pubkey]);
  const [connectionInfo, setConnectionInfo] = useState<Record<string, NWCInfo>>({});

  // Add new connection
  const addConnection = async (uri: string, alias?: string): Promise<boolean> => {
    const parseNWCUri = (uri: string): { connectionString: string } | null => {
      try {
        if (!uri.startsWith('nostr+walletconnect://') && !uri.startsWith('nostrwalletconnect://')) {
          console.error('Invalid NWC URI protocol:', { protocol: uri.split('://')[0] });
          return null;
        }
        return { connectionString: uri };
      } catch (error) {
        console.error('Failed to parse NWC URI:', error);
        return null;
      }
    };

    const parsed = parseNWCUri(uri);
    if (!parsed) {
      toast({
        title: 'Invalid NWC URI',
        description: 'Please check the connection string and try again.',
        variant: 'destructive',
      });
      return false;
    }

    const existingConnection = connections.find(c => c.connectionString === parsed.connectionString);
    if (existingConnection) {
      toast({
        title: 'Connection already exists',
        description: 'This wallet is already connected.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      let timeoutId: NodeJS.Timeout | undefined;
      const testPromise = new Promise((resolve, reject) => {
        try {
          const client = new LN(parsed.connectionString);
          resolve(client);
        } catch (error) {
          reject(error);
        }
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Connection test timeout')), 10000);
      });

      try {
        await Promise.race([testPromise, timeoutPromise]) as LN;
        if (timeoutId) clearTimeout(timeoutId);
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
      }

      const connection: NWCConnection = {
        connectionString: parsed.connectionString,
        alias: alias || 'NWC Wallet',
        isConnected: true,
      };

      setConnectionInfo(prev => ({
        ...prev,
        [parsed.connectionString]: {
          alias: connection.alias,
          methods: ['pay_invoice'],
        },
      }));

      const newConnections = [...connections, connection];
      console.log('[NWC Debug] Saving new connections:', {
        count: newConnections.length,
        aliases: newConnections.map(c => c.alias),
      });
      setConnections(newConnections);

      if (connections.length === 0 || !activeConnection) {
        console.log('[NWC Debug] Setting active connection:', parsed.connectionString.slice(0, 50) + '...');
        setActiveConnection(parsed.connectionString);
      }

      // Verify the save worked
      setTimeout(() => {
        debugLocalStorage('After save verification');
      }, 100);

      toast({
        title: 'Wallet connected',
        description: `Successfully connected to ${connection.alias}.`,
      });

      return true;
    } catch (error) {
      console.error('NWC connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      toast({
        title: 'Connection failed',
        description: `Could not connect to the wallet: ${errorMessage}`,
        variant: 'destructive',
      });
      return false;
    }
  };

  // Remove connection
  const removeConnection = (connectionString: string) => {
    const filtered = connections.filter(c => c.connectionString !== connectionString);
    setConnections(filtered);

    if (activeConnection === connectionString) {
      const newActive = filtered.length > 0 ? filtered[0].connectionString : null;
      setActiveConnection(newActive);
    }

    setConnectionInfo(prev => {
      const newInfo = { ...prev };
      delete newInfo[connectionString];
      return newInfo;
    });

    toast({
      title: 'Wallet disconnected',
      description: 'The wallet connection has been removed.',
    });
  };

  // Download NWC connections from cloud (Nostr)
  const downloadCloudConnections = useCallback(async () => {
    if (!user?.pubkey || !nip44 || hasDownloadedCloudConnections) {
      console.log('[NWC] Cloud download skipped:', {
        hasUser: !!user?.pubkey,
        hasNip44: !!nip44,
        alreadyDownloaded: hasDownloadedCloudConnections,
      });
      return;
    }

    try {
      console.log('[NWC] Downloading NWC connections from cloud...');
      const combinedSignal = AbortSignal.any([AbortSignal.timeout(10000)]);

      const events = await nostr.query([
        {
          kinds: [NWC_CONNECTIONS_KIND],
          authors: [user.pubkey],
          '#d': [NWC_CONNECTIONS_IDENTIFIER],
          limit: 1,
        },
      ], { signal: combinedSignal });

      console.log('[NWC] Cloud query returned', events.length, 'connection events');

      if (events.length === 0) {
        console.log('[NWC] No cloud connections found');
        setHasDownloadedCloudConnections(true);
        return;
      }

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      try {
        console.log('[NWC] Decrypting cloud connections...');
        const decrypted = await nip44.decrypt(user.pubkey, latestEvent.content);
        const remoteData = JSON.parse(decrypted);

        if (!Array.isArray(remoteData.connections)) {
          console.warn('[NWC] Invalid cloud connection data');
          setHasDownloadedCloudConnections(true);
          return;
        }

        console.log('[NWC] Found', remoteData.connections.length, 'cloud connections');

        // Add any cloud connections that don't exist locally
        let addedCount = 0;
        for (const remoteConn of remoteData.connections) {
          const exists = connections.some(c => c.connectionString === remoteConn.connectionString);
          if (!exists) {
            console.log('[NWC] Adding cloud connection:', remoteConn.alias);
            const newConnection: NWCConnection = {
              connectionString: remoteConn.connectionString,
              alias: remoteConn.alias,
              isConnected: true,
            };
            setConnections(prev => [...prev, newConnection]);
            addedCount++;
          }
        }

        if (addedCount > 0) {
          toast({
            title: 'Cloud sync',
            description: `Restored ${addedCount} wallet connection${addedCount !== 1 ? 's' : ''} from cloud.`,
          });
        }

        setHasDownloadedCloudConnections(true);
      } catch (error) {
        console.error('[NWC] Failed to decrypt cloud connections:', error);
        setHasDownloadedCloudConnections(true);
      }
    } catch (error) {
      console.error('[NWC] Failed to download cloud connections:', error);
      setHasDownloadedCloudConnections(true);
    }
  }, [user, nip44, nostr, connections, setConnections, hasDownloadedCloudConnections, toast]);

  // Get active connection
  const getActiveConnection = useCallback((): NWCConnection | null => {
    if (!activeConnection && connections.length > 0) {
      setActiveConnection(connections[0].connectionString);
      return connections[0];
    }

    if (!activeConnection) return null;

    const found = connections.find(c => c.connectionString === activeConnection);
    return found || null;
  }, [activeConnection, connections, setActiveConnection]);

  // Download cloud connections on user login (when NIP-44 is available)
  useEffect(() => {
    if (user?.pubkey && nip44 && !hasDownloadedCloudConnections) {
      downloadCloudConnections();
    }
  }, [user?.pubkey, nip44, hasDownloadedCloudConnections, downloadCloudConnections]);

  // Send payment using the SDK
  const sendPayment = useCallback(async (
    connection: NWCConnection,
    invoice: string
  ): Promise<{ preimage: string }> => {
    if (!connection.connectionString) {
      throw new Error('Invalid connection: missing connection string');
    }

    let client: LN;
    try {
      client = new LN(connection.connectionString);
    } catch (error) {
      console.error('Failed to create NWC client:', error);
      throw new Error(`Failed to create NWC client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Payment timeout after 15 seconds')), 15000);
      });

      const paymentPromise = client.pay(invoice);

      try {
        const response = await Promise.race([paymentPromise, timeoutPromise]) as { preimage: string };
        if (timeoutId) clearTimeout(timeoutId);
        return response;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      console.error('NWC payment failed:', error);

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('Payment timed out. Please try again.');
        } else if (error.message.includes('insufficient')) {
          throw new Error('Insufficient balance in connected wallet.');
        } else if (error.message.includes('invalid')) {
          throw new Error('Invalid invoice or connection. Please check your wallet.');
        } else {
          throw new Error(`Payment failed: ${error.message}`);
        }
      }

      throw new Error('Payment failed with unknown error');
    }
  }, []);

  return {
    connections,
    activeConnection,
    connectionInfo,
    addConnection,
    removeConnection,
    setActiveConnection,
    getActiveConnection,
    sendPayment,
  };
}