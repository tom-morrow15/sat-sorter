import type { NostrMetadata } from '@nostrify/nostrify';

/**
 * Leniently parse a kind-0 (profile) content string.
 *
 * Nostr profile content is free-form JSON — clients emit extra fields, odd
 * casing, and occasional trailing whitespace. Strict schema validation (e.g.
 * NSchema's metadata pipe) rejects perfectly readable profiles, which made
 * apps fall back to generated placeholder names. Accept anything that parses
 * to a JSON object.
 */
export function parseProfileMetadata(content: string | undefined): NostrMetadata | undefined {
  if (!content) return undefined;
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return parsed as NostrMetadata;
  } catch {
    return undefined;
  }
}
