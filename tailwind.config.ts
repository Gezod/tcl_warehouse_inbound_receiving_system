import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-hover': '#F8FAFC',
        border: '#E5E7EB',
        primary: {
          DEFAULT: '#0A0A0A',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#6B7280',
          foreground: '#0A0A0A',
        },
        muted: {
          DEFAULT: '#9CA3AF',
          foreground: '#6B7280',
        },
        status: {
          draft: {
            bg: '#F3F4F6',
            text: '#4B5563',
            border: '#E5E7EB',
          },
          open: {
            bg: '#EFF6FF',
            text: '#1D4ED8',
            border: '#BFDBFE',
          },
          partial: {
            bg: '#FEF3C7',
            text: '#B45309',
            border: '#FDE68A',
          },
          completed: {
            bg: '#ECFDF5',
            text: '#047857',
            border: '#A7F3D0',
          },
          cancelled: {
            bg: '#FEF2F2',
            text: '#B91C1C',
            border: '#FECACA',
          },
        },
      },
      borderRadius: {
        card: '12px',
        dialog: '12px',
        input: '8px',
        button: '8px',
        pill: '9999px',
      },
      maxWidth: {
        content: '1280px',
      },
      transitionDuration: {
        default: '150ms',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
