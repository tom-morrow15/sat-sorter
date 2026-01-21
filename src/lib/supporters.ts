/**
 * Development Supporters Configuration
 *
 * This file contains the list of supporters who have donated to Sat Sorter's development.
 * To add a new supporter, add their npub to the appropriate tier.
 *
 * Tiers (Bitcoin-themed):
 * - Satoshi Circle: The visionary tier - named after Bitcoin's creator
 * - Bitcoin Whale: Big believers in the mission
 * - Diamond Hodler: Diamond hands supporting development
 * - Sat Stacker: Steadily stacking support
 * - Based Pleb: Every sat counts!
 */

export interface SupporterTier {
  id: string;
  name: string;
  description: string;
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
    icon: '👑',
    color: 'text-amber-500',
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    supporters: [
      // Add npubs here for top-tier donors
      'npub1acu2u940prfg429x4axskgu2e5auvjx4y6ejme8y8t4ns4tz82pqs5l3q0', // devin@primal.net
    ],
  },
  {
    id: 'whale',
    name: 'Bitcoin Whale',
    description: 'Major contributors to Sat Sorter\'s future',
    icon: '🐋',
    color: 'text-blue-500',
    gradient: 'from-blue-400 via-cyan-500 to-teal-500',
    supporters: [
      // Add npubs here
    ],
  },
  {
    id: 'hodler',
    name: 'Diamond Hodler',
    description: 'Committed believers with diamond hands',
    icon: '💎',
    color: 'text-purple-500',
    gradient: 'from-purple-400 via-pink-500 to-rose-500',
    supporters: [
      // Add npubs here
    ],
  },
  {
    id: 'stacker',
    name: 'Sat Stacker',
    description: 'Steadily supporting the stack',
    icon: '⚡',
    color: 'text-orange-500',
    gradient: 'from-orange-400 via-amber-500 to-yellow-500',
    supporters: [
      // Add npubs here
    ],
  },
  {
    id: 'pleb',
    name: 'Based Pleb',
    description: 'Every satoshi counts — thank you!',
    icon: '🙏',
    color: 'text-green-500',
    gradient: 'from-green-400 via-emerald-500 to-teal-500',
    supporters: [
      // Add npubs here
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
