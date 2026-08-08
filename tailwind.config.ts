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
				sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
				serif: ['Cochin', 'Cormorant Garamond', 'Iowan Old Style', 'Apple Garamond', 'Baskerville', 'Times New Roman', 'serif'],
			},
			backgroundImage: {
				'gradient-primary': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(28 70% 45%) 100%)',
				'gradient-primary-subtle': 'linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(28 70% 45% / 0.08) 100%)',
				'header-gradient': 'linear-gradient(180deg, hsl(0 0% 4%) 0%, hsl(0 0% 6%) 40%, hsl(220 8% 10%) 100%)',
				'header-gradient-scrolled': 'linear-gradient(180deg, hsl(220 8% 10%) 0%, hsl(220 8% 12%) 50%, hsl(220 8% 14%) 100%)',
				'mesh-gradient': 'radial-gradient(at 20% 50%, hsl(var(--primary) / 0.12), transparent), radial-gradient(at 80% 80%, hsl(28 80% 48% / 0.08), transparent)',
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
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
		keyframes: {
			'accordion-down': {
				from: {
					height: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)'
				},
				to: {
					height: '0'
				}
			},
			'slide-in-up': {
				from: {
					opacity: '0',
					transform: 'translateY(20px)'
				},
				to: {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			'slide-in-down': {
				from: {
					opacity: '0',
					transform: 'translateY(-20px)'
				},
				to: {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			'scale-in': {
				from: {
					opacity: '0',
					transform: 'scale(0.95)'
				},
				to: {
					opacity: '1',
					transform: 'scale(1)'
				}
			},
			'pulse-soft': {
				'0%, 100%': {
					opacity: '1'
				},
				'50%': {
					opacity: '0.5'
				}
			},
			'wormhole-grid': {
				'0%': {
					transform: 'perspective(600px) rotateX(0deg) translateY(0px) scale(1)',
					opacity: '0.12'
				},
				'50%': {
					transform: 'perspective(600px) rotateX(2deg) translateY(-10px) scale(1.05)',
					opacity: '0.18'
				},
				'100%': {
					transform: 'perspective(600px) rotateX(0deg) translateY(0px) scale(1)',
					opacity: '0.12'
				}
			},
			'wormhole-pulse': {
				'0%, 100%': {
					opacity: '0.06'
				},
				'50%': {
					opacity: '0.14'
				}
			},
			'float-up': {
				'0%': {
					opacity: '0',
					transform: 'translateY(24px) scale(0.98)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0) scale(1)'
				}
			},
			'fade-in-soft': {
				'0%': {
					opacity: '0',
					transform: 'translateY(8px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'slide-in-up': 'slide-in-up 0.5s ease-out forwards',
			'slide-in-down': 'slide-in-down 0.4s ease-out forwards',
			'scale-in': 'scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
			'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
			'fade-in': 'fadeIn 0.3s ease-out forwards',
			'wormhole-grid': 'wormhole-grid 20s ease-in-out infinite',
			'wormhole-pulse': 'wormhole-pulse 12s ease-in-out infinite',
			'float-up': 'float-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
			'fade-in-soft': 'fade-in-soft 0.35s ease-out forwards'
		}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
