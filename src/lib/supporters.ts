/**
 * Development Supporters Configuration
 * 
 * This file contains the list of supporters who have donated to Sat Sorter's development.
 * To add a new supporter, add their npub to the appropriate tier based on their donation amount.
 * 
 * Tiers:
 * - satoshi: $500+ (The visionary tier - named after Bitcoin's creator)
 * - whale: $250-$499 (Big believers in the mission)
 * - hodler: $100-$249 (Diamond hands supporting development)
 * - stacker: $50-$99 (Steadily stacking support)
 * - pleb: <$50 (Every sat counts!)
 */

export interface SupporterTier {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number | null;
  icon: string;
  color: string;
  gradient: string;
  supporters: string[]; // Array of npubs
}

export const supporterTiers: SupporterTier[] = [
  {
    id: 'satoshi',
    name: 'Satoshi Circle',
    description: 'Visionary supporters who believe in the mission',
    minAmount: 500,
    maxAmount: null,
    icon: '👑',
    color: 'text-amber-500',
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    supporters: [
      // Add npubs here for $500+ donors
      // Example: 'npub1abc123...'
    ],
  },
  {
    id: 'whale',
    name: 'Bitcoin Whale',
    description: 'Major contributors to Sat Sorter\'s future',
    minAmount: 250,
    maxAmount: 499,
    icon: '🐋',
    color: 'text-blue-500',
    gradient: 'from-blue-400 via-cyan-500 to-teal-500',
    supporters: [
      // Add npubs here for $250-$499 donors
    ],
  },
  {
    id: 'hodler',
    name: 'Diamond Hodler',
    description: 'Committed believers with diamond hands',
    minAmount: 100,
    maxAmount: 249,
    icon: '💎',
    color: 'text-purple-500',
    gradient: 'from-purple-400 via-pink-500 to-rose-500',
    supporters: [
      // Add npubs here for $100-$249 donors
    ],
  },
  {
    id: 'stacker',
    name: 'Sat Stacker',
    description: 'Steadily supporting the stack',
    minAmount: 50,
    maxAmount: 99,
    icon: '⚡',
    color: 'text-orange-500',
    gradient: 'from-orange-400 via-amber-500 to-yellow-500',
    supporters: [
      // Add npubs here for $50-$99 donors
    ],
  },
  {
    id: 'pleb',
    name: 'Based Pleb',
    description: 'Every satoshi counts — thank you!',
    minAmount: 0,
    maxAmount: 49,
    icon: '🙏',
    color: 'text-green-500',
    gradient: 'from-green-400 via-emerald-500 to-teal-500',
    supporters: [
      // Add npubs here for <$50 donors
    ],
  },
];

/**
 * Get the total number of supporters across all tiers
 */
export function getTotalSupporterCount(): number {
  return supporterTiers.reduce((total, tier) => total + tier.supporters.length, 0);
}

/**
 * Get tiers that have at least one supporter
 */
export function getActiveTiers(): SupporterTier[] {
  return supporterTiers.filter(tier => tier.supporters.length > 0);
}

/**
 * Check if there are any supporters
 */
export function hasSupporters(): boolean {
  return getTotalSupporterCount() > 0;
}
