import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				// UI text — Space Grotesk
				sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
				// Headers / logotype — Cochin (classic serif)
				serif: ['Cochin', 'Cormorant Garamond', 'Big Caslon', 'Georgia', 'Times New Roman', 'serif'],
				// Numeric values — Space Mono (ledger/terminal)
				mono: ['Space Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				// Atomic Age Bauhaus named palette
				ink: '#171412',
				'ink-2': '#241F1A',
				linen: '#F3ECDD',
				paper: '#FAF6EC',
				'burnt-orange': '#D9662E',
				'bright-orange': '#E88347',
				mustard: '#D9A63E',
				petrol: '#2F6E6A',
				olive: '#7C8F6B',
				brick: '#A63D2F',
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				// Small, crisp Bauhaus radii
				lg: 'var(--radius)',        /* 10px */
				md: 'calc(var(--radius) - 2px)', /* 8px */
				sm: 'calc(var(--radius) - 4px)', /* 6px */
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'slide-in-up': {
					from: { opacity: '0', transform: 'translateY(16px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-in-down': {
					from: { opacity: '0', transform: 'translateY(-16px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-in': {
					from: { opacity: '0', transform: 'scale(0.97)' },
					to: { opacity: '1', transform: 'scale(1)' }
				},
				'pulse-soft': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				},
				'fade-in-soft': {
					'0%': { opacity: '0', transform: 'translateY(6px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'slide-in-up': 'slide-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'slide-in-down': 'slide-in-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'scale-in': 'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
				'fade-in': 'fadeIn 0.3s ease-out forwards',
				'fade-in-soft': 'fade-in-soft 0.3s ease-out forwards'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
