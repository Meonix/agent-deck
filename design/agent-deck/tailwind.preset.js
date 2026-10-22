export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        input: 'var(--input)',
        section: { folders: 'var(--section-folders)', active: 'var(--section-active)', stash: 'var(--section-stash)' },
        border: 'var(--border)',
        ring: 'var(--ring)',
        running: {
          DEFAULT: 'var(--running)',
          bg: 'var(--running-bg)',
          border: 'var(--running-border)',
          foreground: 'var(--running-foreground)',
        },
        approval: {
          DEFAULT: 'var(--approval)',
          bg: 'var(--approval-bg)',
          border: 'var(--approval-border)',
          foreground: 'var(--approval-foreground)',
        },
        error: {
          DEFAULT: 'var(--error)',
          bg: 'var(--error-bg)',
          border: 'var(--error-border)',
          foreground: 'var(--error-foreground)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
    },
  },
};
