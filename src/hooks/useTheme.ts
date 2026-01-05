import { useEffect, useState } from 'react';
import { type Theme } from "@/contexts/AppContext";
import { useAppContext } from "@/hooks/useAppContext";

/**
 * Hook to get and set the active theme
 * @returns Theme context with theme, setTheme, isDark, and toggle
 */
export function useTheme() {
  const { config, updateConfig } = useAppContext();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Resolve actual theme (handling 'system' option)
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (config.theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        setResolvedTheme(systemTheme);
      } else {
        setResolvedTheme(config.theme);
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (config.theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [config.theme]);

  const setTheme = (theme: Theme) => {
    updateConfig((currentConfig) => ({
      ...currentConfig,
      theme,
    }));
  };

  const toggle = () => {
    // Toggle between light and dark (ignoring system)
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return {
    theme: config.theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setTheme,
    toggle,
  };
}
