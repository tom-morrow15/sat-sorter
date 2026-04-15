import { BudgetState, BudgetPartner } from './budgetTypes';

/**
 * Versioning system for Nostr budget backups
 * Each snapshot is immutable and includes full state + metadata
 */

export interface DeletionRecord {
  itemType: 'transaction' | 'lineItem' | 'bucket';
  itemId: string;
  deletedAt: number;
}

export interface BudgetSnapshot {
  // Original budget state
  currentMonth: string;
  budgets: any[];
  currency: 'sats' | 'usd';
  partners?: BudgetPartner[]; // Budget partners with their permissions
  userRole?: 'owner' | 'editor' | 'viewer'; // Current user's role
  
  // Versioning metadata
  version: number;
  checksum: string; // SHA-256 of entire content
  createdAt: number; // Unix timestamp
  lastModified: number; // When user last modified locally
  previousChecksum?: string; // Link to previous version
  
  // Deletions tracking
  deletions: DeletionRecord[];
}

export interface SyncStatus {
  localVersion: number;
  localChecksum: string;
  localTimestamp: number;
  
  cloudVersion?: number;
  cloudChecksum?: string;
  cloudTimestamp?: number;
  
  status: 'synced' | 'local-newer' | 'cloud-newer' | 'conflict' | 'local-only';
}

/**
 * Calculate SHA-256 checksum of budget state
 * Used to verify data integrity and detect conflicts
 */
export async function calculateChecksum(state: BudgetSnapshot): Promise<string> {
  const content = JSON.stringify({
    currentMonth: state.currentMonth,
    budgets: state.budgets,
    currency: state.currency,
    partners: state.partners || [],
    userRole: state.userRole || 'owner',
    deletions: state.deletions,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create an immutable snapshot from current budget state
 */
export async function createSnapshot(
  state: BudgetState,
  deletions: DeletionRecord[],
  previousChecksum?: string,
): Promise<BudgetSnapshot> {
  const snapshot: BudgetSnapshot = {
    currentMonth: state.currentMonth,
    budgets: state.budgets,
    currency: state.currency,
    partners: state.partners,
    userRole: state.userRole,
    version: (state as any).version ? (state as any).version + 1 : 1,
    checksum: '', // Will be calculated
    createdAt: Math.floor(Date.now() / 1000),
    lastModified: (state as any).lastModified || Math.floor(Date.now() / 1000),
    previousChecksum,
    deletions,
  };

  snapshot.checksum = await calculateChecksum(snapshot);
  return snapshot;
}

/**
 * Verify integrity of a snapshot using its checksum
 */
export async function verifyIntegrity(snapshot: BudgetSnapshot): Promise<{
  valid: boolean;
  reason?: string;
}> {
  const originalChecksum = snapshot.checksum;
  snapshot.checksum = ''; // Clear for recalculation

  const recalculated = await calculateChecksum(snapshot);
  snapshot.checksum = originalChecksum; // Restore

  if (recalculated === originalChecksum) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: 'Checksum mismatch - data may be corrupted',
  };
}

/**
 * Compare two snapshots and determine sync status
 */
export function compareSnapshots(
  local: BudgetSnapshot,
  cloud: BudgetSnapshot | null,
): SyncStatus {
  if (!cloud) {
    return {
      localVersion: local.version,
      localChecksum: local.checksum,
      localTimestamp: local.createdAt,
      status: 'local-only',
    };
  }

  const status: SyncStatus = {
    localVersion: local.version,
    localChecksum: local.checksum,
    localTimestamp: local.createdAt,
    cloudVersion: cloud.version,
    cloudChecksum: cloud.checksum,
    cloudTimestamp: cloud.createdAt,
    status: 'synced', // Default, will be overridden
  };

  // Same checksum = already synced
  if (local.checksum === cloud.checksum) {
    status.status = 'synced';
    return status;
  }

  // Compare timestamps
  if (local.createdAt > cloud.createdAt) {
    status.status = 'local-newer';
  } else if (cloud.createdAt > local.createdAt) {
    status.status = 'cloud-newer';
  } else {
    // Same timestamp but different content = conflict
    status.status = 'conflict';
  }

  return status;
}

/**
 * Detect if versions can be merged or if user must choose one
 */
export function detectConflicts(
  local: BudgetSnapshot,
  cloud: BudgetSnapshot,
): {
  canAutoMerge: boolean;
  conflicts: string[];
} {
  const conflicts: string[] = [];

  // Check for conflicting deletions
  const localDeletedIds = new Set(local.deletions.map(d => d.itemId));
  const cloudDeletedIds = new Set(cloud.deletions.map(d => d.itemId));

  // If same item deleted in both, that's OK
  // If item deleted in one but modified in other, that's a conflict
  const localOnly = new Set(
    local.budgets
      .flatMap(b => b.lineItems.map((li: any) => li.id))
      .concat(local.budgets.flatMap((b: any) => b.id)),
  );

  const cloudOnly = new Set(
    cloud.budgets
      .flatMap(b => b.lineItems.map((li: any) => li.id))
      .concat(cloud.budgets.flatMap((b: any) => b.id)),
  );

  // For now, if checksums are different, user must choose
  if (local.checksum !== cloud.checksum) {
    conflicts.push('Budget state differs - manual resolution required');
  }

  return {
    canAutoMerge: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Merge two snapshots by taking local deletions + cloud additions
 * This is a simple strategy: if it was deleted, keep it deleted
 */
export async function mergeSnapshots(
  local: BudgetSnapshot,
  cloud: BudgetSnapshot,
): Promise<BudgetSnapshot> {
  // Start with local as base (user's current work)
  const merged: BudgetSnapshot = {
    ...local,
    version: Math.max(local.version, cloud.version) + 1,
    previousChecksum: local.checksum,
  };

  // Merge deletions: combine both sets
  const mergedDeletions = new Map<string, DeletionRecord>();

  for (const deletion of local.deletions) {
    mergedDeletions.set(deletion.itemId, deletion);
  }

  for (const deletion of cloud.deletions) {
    mergedDeletions.set(deletion.itemId, deletion);
  }

  merged.deletions = Array.from(mergedDeletions.values());
  merged.checksum = await calculateChecksum(merged);

  return merged;
}

/**
 * Format timestamp for display
 */
export function formatSyncTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get human-readable sync status message
 */
export function getSyncStatusMessage(status: SyncStatus): string {
  switch (status.status) {
    case 'synced':
      return 'Already synced';
    case 'local-newer':
      return `Local is newer (${formatSyncTime(status.localTimestamp)})`;
    case 'cloud-newer':
      return `Cloud is newer (${formatSyncTime(status.cloudTimestamp!)})`;
    case 'conflict':
      return 'Different versions - manual resolution needed';
    case 'local-only':
      return 'No cloud backup found';
    default:
      return 'Unknown status';
  }
}

/**
 * Serialize snapshot for Nostr transmission
 * Uses compact JSON format and compression to minimize size
 */
export async function serializeSnapshot(snapshot: BudgetSnapshot): Promise<string> {
  const json = JSON.stringify(snapshot);
  
  // Compress using gzip via the Compression Streams API if available
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(new TextEncoder().encode(json));
      writer.close();
      
      const compressedChunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        compressedChunks.push(value);
      }
      
      // Convert compressed data to base64 for JSON serialization
      const compressed = new Uint8Array(
        compressedChunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[])
      );
      return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
    } catch (error) {
      console.warn('Compression failed, using uncompressed:', error);
      return json;
    }
  }
  
  return json;
}

/**
 * Deserialize snapshot from Nostr
 */
export async function deserializeSnapshot(data: string): Promise<BudgetSnapshot> {
  try {
    // Try to decompress if it looks like base64
    if (data.length > 0 && !data.startsWith('{')) {
      const compressed = new Uint8Array(
        atob(data).split('').map(c => c.charCodeAt(0))
      );
      
      if (typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(compressed);
        writer.close();
        
        const decompressedChunks: Uint8Array[] = [];
        const reader = ds.readable.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          decompressedChunks.push(value);
        }
        
        const decompressed = new TextDecoder().decode(
          new Uint8Array(
            decompressedChunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[])
          )
        );
        return JSON.parse(decompressed) as BudgetSnapshot;
      }
    }
  } catch (error) {
    console.warn('Decompression failed, trying raw JSON:', error);
  }
  
  // Fallback to raw JSON parsing
  return JSON.parse(data) as BudgetSnapshot;
}
