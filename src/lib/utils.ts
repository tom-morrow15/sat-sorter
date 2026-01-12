import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { NUser } from "@nostrify/react/login"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely check if a user's signer supports NIP-44 encryption.
 *
 * This is necessary because accessing `user.signer.nip44` can throw an error
 * when the user logged in via browser extension but the extension is not
 * currently installed (e.g., synced login from another device).
 *
 * @param user The NUser object to check
 * @returns The nip44 interface if available, or null if not
 */
export function getSafeNip44(user: NUser | undefined): NUser['signer']['nip44'] | null {
  if (!user) return null;

  try {
    const signer = user.signer;
    if (!signer) return null;

    const nip44 = signer.nip44;
    return nip44 ?? null;
  } catch {
    // Extension login but extension not available
    return null;
  }
}

/**
 * Safely check if a user's signer supports NIP-04 encryption.
 *
 * Similar to getSafeNip44, this handles the case where a browser extension
 * login exists but the extension is not currently installed.
 *
 * @param user The NUser object to check
 * @returns The nip04 interface if available, or null if not
 */
export function getSafeNip04(user: NUser | undefined): NUser['signer']['nip04'] | null {
  if (!user) return null;

  try {
    const signer = user.signer;
    if (!signer) return null;

    const nip04 = signer.nip04;
    return nip04 ?? null;
  } catch {
    // Extension login but extension not available
    return null;
  }
}

/**
 * Check if a user can perform NIP-44 encryption operations.
 *
 * @param user The NUser object to check
 * @returns true if NIP-44 is available, false otherwise
 */
export function canUseNip44(user: NUser | undefined): boolean {
  return getSafeNip44(user) !== null;
}

/**
 * Check if a user can perform NIP-04 encryption operations.
 *
 * @param user The NUser object to check
 * @returns true if NIP-04 is available, false otherwise
 */
export function canUseNip04(user: NUser | undefined): boolean {
  return getSafeNip04(user) !== null;
}
