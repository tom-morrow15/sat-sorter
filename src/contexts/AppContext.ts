import { createContext } from "react";

export type Theme = "dark" | "light" | "system";
export type LogoStyle = "bitcoin" | "sats";

export interface Relay {
  url: string;
  read: boolean;
  write: boolean;
  /**
   * Private relays are stored only on this device and are never published
   * in the user's public NIP-65 relay list (e.g. self-hosted relays on a
   * home network). Default: true for user-added relays.
   */
  private?: boolean;
}

export interface RelayMetadata {
  /** List of relays with read/write permissions */
  relays: Relay[];
  /** Unix timestamp of when the relay list was last updated */
  updatedAt: number;
}

export interface AppConfig {
  /** Current theme */
  theme: Theme;
  /** NIP-65 relay list metadata */
  relayMetadata: RelayMetadata;
  /** Logo style preference: bitcoin (₿) or sats (⚡) */
  logoStyle: LogoStyle;
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: Partial<AppConfig>) => Partial<AppConfig>) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
