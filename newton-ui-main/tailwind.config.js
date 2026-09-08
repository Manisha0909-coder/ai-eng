/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
  	extend: {
  		animation: {
  			'spin-slow': 'spin 8s linear infinite',
  			'spin-slow-reverse': 'spin 12s linear infinite reverse'
  		},
  		fontFamily: {
  			display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
  			sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
  			mono: ['"Spline Sans Mono"', 'ui-monospace', 'monospace'],
  		},
  		borderRadius: {
  			lg: 'var(--border-radius-lg)',
  			md: 'var(--border-radius-md)',
  			sm: 'var(--border-radius-sm)',
  		},
  		colors: {
  			primary: {
  				DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
  				foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
  			},
  			secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
  			accent: 'rgb(var(--color-accent) / <alpha-value>)',
  			surface: 'rgb(var(--color-surface) / <alpha-value>)',
  			'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)',
  			background: 'rgb(var(--color-background) / <alpha-value>)',
  			'text-main': 'rgb(var(--color-text) / <alpha-value>)',
  			'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
  			'border-main': 'rgb(var(--color-border) / <alpha-value>)',
  			'input-bg': 'rgb(var(--color-input-bg) / <alpha-value>)',
			status: {
				error: 'rgb(var(--color-error) / <alpha-value>)',
				success: 'rgb(var(--color-success) / <alpha-value>)',
				warning: 'rgb(var(--color-warning) / <alpha-value>)',
				info: 'rgb(var(--color-info) / <alpha-value>)',
			},
			entity: {
				role: 'rgb(var(--color-entity-role) / <alpha-value>)',
				persona: 'rgb(var(--color-entity-persona) / <alpha-value>)',
				'doc-tag': 'rgb(var(--color-entity-doc-tag) / <alpha-value>)',
				'tool-tag': 'rgb(var(--color-entity-tool-tag) / <alpha-value>)',
				server: 'rgb(var(--color-entity-server) / <alpha-value>)',
				datasource: 'rgb(var(--color-entity-datasource) / <alpha-value>)',
			},
			'oauth-microsoft': 'rgb(var(--color-oauth-microsoft) / <alpha-value>)',
			'oauth-microsoft-hover': 'rgb(var(--color-oauth-microsoft-hover) / <alpha-value>)',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'rgb(var(--color-border) / <alpha-value>)',
  			input: 'rgb(var(--color-border) / <alpha-value>)',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
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
  		spacing: {
  			'icon-sm': '20px',
  			'icon-md': '28px',
  			'icon-lg': '42px',
  		},
  		maxWidth: {
  			'dialog-sm': '360px',
  			'dialog-md': '560px',
  			'dialog-lg': '860px',
  		},
  		fontSize: {
  			/* Micro-text floor: 11px is the smallest comfortably readable size
  			   on mobile; 3xs is for dense numeric badges only. */
  			'2xs': ['11px', { lineHeight: '15px' }],
  			'3xs': ['10px', { lineHeight: '13px' }],
  		},
  		boxShadow: {
  			elevated: 'var(--shadow-elevated)',
  			'elevated-hover': 'var(--shadow-elevated-hover)',
  			lift: '0 1px 2px rgb(16 24 20 / 0.05), 0 8px 24px -12px rgb(16 24 20 / 0.12)',
  			dialog: '0 24px 64px -16px rgb(8 14 11 / 0.35)',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
