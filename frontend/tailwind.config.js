/**
 * Every colour resolves to a CSS custom property rather than a literal.
 * That is what lets the admin Design Studio restyle the live site by
 * writing new token values, without a rebuild.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        soft: 'rgb(var(--c-soft) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        'gold-lit': 'rgb(var(--c-gold-lit) / <alpha-value>)',
        // Set per-product at runtime from products.accent_color.
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-deep': 'rgb(var(--c-accent-deep) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--f-display)', 'Georgia', 'serif'],
        body: ['var(--f-body)', 'system-ui', 'sans-serif'],
        script: ['var(--f-script)', 'cursive'],
      },
      fontSize: {
        // A fixed scale, so nothing drifts between components.
        micro: ['0.72rem', { lineHeight: '1.4', letterSpacing: '0.12em' }],
        tiny: ['0.8125rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.65' }],
        lede: ['1.09rem', { lineHeight: '1.62' }],
        d1: ['clamp(2.7rem,6vw,4.6rem)', { lineHeight: '1.06', letterSpacing: '-0.015em' }],
        d2: ['clamp(1.9rem,3.6vw,2.9rem)', { lineHeight: '1.12', letterSpacing: '-0.01em' }],
        d3: ['clamp(1.35rem,2.1vw,1.7rem)', { lineHeight: '1.2' }],
      },
      borderRadius: {
        DEFAULT: 'var(--r-base)',
        lg: 'var(--r-lg)',
      },
      maxWidth: { shell: 'var(--w-shell)' },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.22, 0.68, 0.28, 1)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'none' } },
        steam: {
          '0%': { opacity: 0, transform: 'translateY(4px) scaleX(0.9)' },
          '35%': { opacity: 0.5 },
          '100%': { opacity: 0, transform: 'translateY(-26px) scaleX(1.25)' },
        },
      },
      animation: {
        rise: 'rise 0.7s cubic-bezier(0.22,0.68,0.28,1) both',
        steam: 'steam 4.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
