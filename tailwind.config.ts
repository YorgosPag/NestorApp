import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        // 🏢 ENTERPRISE PERFORMANCE SYSTEM - CSS Variables Integration
        performance: {
          success: {
            DEFAULT: 'var(--color-success)',
            bg: 'var(--performance-success-bg)',
            border: 'var(--performance-success-border)',
            hover: 'var(--hover-success-bg)',
          },
          warning: {
            DEFAULT: 'var(--color-warning)',
            bg: 'var(--performance-warning-bg)',
            border: 'var(--performance-warning-border)',
            hover: 'var(--hover-warning-bg)',
          },
          error: {
            DEFAULT: 'var(--color-error)',
            bg: 'var(--performance-error-bg)',
            border: 'var(--performance-error-border)',
            hover: 'var(--hover-error-bg)',
          },
          info: {
            DEFAULT: 'var(--color-info)',
            bg: 'var(--performance-info-bg)',
            border: 'var(--performance-info-border)',
            hover: 'var(--hover-info-bg)',
          },
          card: {
            DEFAULT: 'var(--performance-card-bg)',
            border: 'var(--performance-card-border)',
          }
        },
      },
      textColor: {
        'sidebar-foreground': 'hsl(var(--sidebar-foreground))',
      },
      // 🏢 ENTERPRISE SPACING SYSTEM - CSS Variables Integration
      spacing: {
        'performance-xs': 'var(--spacing-component-gap-xs)',
        'performance-sm': 'var(--spacing-component-gap-sm)',
        'performance-md': 'var(--spacing-component-gap-md)',
        'performance-lg': 'var(--spacing-component-gap-lg)',
      },
      // 🏢 ENTERPRISE TYPOGRAPHY SYSTEM - CSS Variables Integration
      fontSize: {
        'performance-xs': ['var(--font-size-xs)', { lineHeight: '1.25' }],
        'performance-sm': ['var(--font-size-sm)', { lineHeight: '1.25' }],
      },
      fontWeight: {
        'performance-medium': 'var(--font-weight-medium)',
        'performance-semibold': 'var(--font-weight-semibold)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      boxShadow: {
        'custom-light': '0 2px 8px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
