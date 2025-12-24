export const spacing = {
  // Base spacing scale (σε rem)
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px

  // Component-specific spacing
  component: {
    padding: {
      xs: '0.5rem',     // 8px - tight padding
      sm: '0.75rem',    // 12px - small padding
      md: '1rem',       // 16px - default padding
      lg: '1.5rem',     // 24px - large padding
      xl: '2rem',       // 32px - extra large padding
    },
    gap: {
      xs: '0.25rem',    // 4px - tight gap
      sm: '0.5rem',     // 8px - small gap
      md: '1rem',       // 16px - default gap
      lg: '1.5rem',     // 24px - large gap
    },
    margin: {
      xs: '0.25rem',    // 4px
      sm: '0.5rem',     // 8px
      md: '1rem',       // 16px
      lg: '1.5rem',     // 24px
      xl: '2rem',       // 32px
    }
  }
} as const;