// Design tokens — Foundations module
// Colors, spacing, typography, shadows, animation, transitions, semanticColors

// ✅ ENTERPRISE FIX: Direct color definitions since core module doesn't exist
export const colors = {
  background: {
    primary: "#ffffff",
    secondary: "#f8fafc",
    tertiary: "#f1f5f9",
    hover: "#f1f5f9",
    overlay: "rgba(0, 0, 0, 0.5)",
    transparent: "transparent",
    accent: "#e0f2fe", // ✅ ENTERPRISE FIX: Added missing accent color
    muted: "#f8fafc"   // ✅ ENTERPRISE FIX: Added missing muted color
  },
  text: {
    primary: "#1e293b",
    secondary: "#64748b",
    muted: "#94a3b8",
    inverse: "#ffffff",
    tertiary: "#9ca3af"
  },
  border: {
    primary: "#e2e8f0",
    secondary: "#cbd5e1",
    tertiary: "#f3f4f6",
    focus: "#3b82f6" // ✅ ENTERPRISE: Focus border color for AlertConfigurationInterface.styles.ts
  },
  primary: {
    "500": "#3b82f6"
  },
  blue: {
    "200": "#bfdbfe",
    "300": "#93c5fd",
    "400": "#60a5fa",
    "500": "#3b82f6",
    "600": "#2563eb"
  },
  green: {
    "300": "#6ee7b7", // ✅ ENTERPRISE FIX: Added missing 300 shade for design-tokens.ts usage
    "400": "#4ade80", // 🏢 ENTERPRISE: Added for snap indicator overlay
    "500": "#22c55e", // ✅ Updated to match Tailwind standard
    "600": "#059669"
  },
  yellow: {
    "400": "#facc15", // 🏢 ENTERPRISE: Added for zoom window overlay
    "500": "#eab308"
  },
  red: {
    "300": "#fca5a5",
    "500": "#ef4444",
    "600": "#dc2626"
  },
  indigo: {
    "600": "#4f46e5"
  },
  purple: {
    "400": "#a78bfa",
    "500": "#8b5cf6",
    "600": "#7c3aed"
  },
  // ✅ ENTERPRISE FIX: Added error color palette (alias of red) for semantic usage
  error: {
    "50": "#fef2f2",
    "300": "#fca5a5",
    "500": "#ef4444",
    "600": "#dc2626"
  },
  orange: {
    "300": "#fdba74",
    "500": "#f97316",
    "600": "#ea580c"
  },
  gray: {
    "50": "#f9fafb",
    "100": "#f3f4f6",
    "200": "#e5e7eb",
    "300": "#d1d5db",
    "400": "#9ca3af",
    "500": "#6b7280",
    "700": "#374151",
    "800": "#1f2937",
    "900": "#111827"
  },
  // ✅ ENTERPRISE: Alert severity colors for AlertMonitoringDashboard.tsx
  severity: {
    critical: {
      background: "#fef2f2",  // red-50
      icon: "#ef4444",        // red-500
      border: "#fca5a5"       // red-300
    },
    high: {
      background: "#fff7ed",  // orange-50
      icon: "#f97316",        // orange-500
      border: "#fdba74"       // orange-300
    },
    medium: {
      background: "#fffbeb",  // amber-50
      icon: "#f59e0b",        // amber-500
      border: "#fcd34d"       // amber-300
    },
    low: {
      background: "#ecfdf5",  // green-50
      icon: "#22c55e",        // green-500
      border: "#6ee7b7"       // green-300
    },
    info: {
      background: "#eff6ff",  // blue-50
      icon: "#3b82f6",        // blue-500
      border: "#93c5fd"       // blue-300
    }
  }
} as const;

// Legacy design token definitions for backward compatibility
export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem",  // 8px
  md: "1rem",    // 16px
  lg: "1.5rem",  // 24px
  xl: "2rem",    // 32px
  "2xl": "3rem", // 48px ✅ ENTERPRISE FIX: Added for enterprise-token-bridge.ts
  "3xl": "4rem", // 64px ✅ ENTERPRISE FIX: Added for enterprise-token-bridge.ts
  component: {   // ✅ ENTERPRISE FIX: Added missing component spacing
    xs: "0.125rem", // 2px
    sm: "0.25rem",  // 4px
    md: "0.5rem",   // 8px
    lg: "0.75rem",  // 12px
    xl: "1rem",     // 16px
    // ✅ ENTERPRISE FIX: Added padding subcategory για enterprise-token-bridge.ts
    padding: {
      xs: "0.125rem", // 2px
      sm: "0.25rem",  // 4px
      md: "0.5rem",   // 8px
      lg: "0.75rem",  // 12px
      xl: "1rem"      // 16px
    },
    // ✅ ENTERPRISE FIX: Added gap subcategory for InteractiveMap.styles.ts
    gap: {
      xs: "0.25rem",  // 4px
      sm: "0.5rem",   // 8px
      md: "1rem",     // 16px
      lg: "1.5rem"    // 24px
    }
  }
} as const;

export const typography = {
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem", // ✅ ENTERPRISE FIX: Added missing 3xl size for useTypography.ts
    "4xl": "2.25rem",  // ✅ ENTERPRISE FIX: Added missing 4xl size for useTypography.ts
    "5xl": "3rem",    // 🏢 ENTERPRISE: Display size for error/hero headings
    "6xl": "3.75rem"  // 🏢 ENTERPRISE: Extra display size for 404/error headings
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700"
  },
  lineHeight: {
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2"
  }
} as const;

// Shadow definitions for compatibility
export const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  focus: "0 0 0 3px rgba(59, 130, 246, 0.3)" // ✅ ENTERPRISE: Focus ring shadow for AlertConfigurationInterface.styles.ts
} as const;

// Animation definitions for compatibility
export const animation = {
  duration: {
    fast: "150ms",
    normal: "300ms",
    slow: "500ms"
  },
  easing: {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out"
  }
} as const;

export const transitions = {
  all: "all 200ms ease",
  colors: "background-color 150ms ease, color 150ms ease",
  transform: "transform 200ms ease"
} as const;

// Semantic color mapping για application-specific χρώματα
export const semanticColors = {
  // Status colors (χρησιμοποιώντας CSS variables)
  status: {
    success: 'hsl(var(--status-success))',
    info: 'hsl(var(--status-info))',
    warning: 'hsl(var(--status-warning))',
    error: 'hsl(var(--status-error))',
    purple: 'hsl(var(--status-purple))',
  },

  // Property status colors
  propertyStatus: {
    'for-sale': 'hsl(var(--status-success))',     // Green
    'for-rent': 'hsl(var(--status-info))',       // Blue
    'reserved': 'hsl(var(--status-warning))',    // Orange
    'sold': 'hsl(var(--status-error))',          // Red
    'landowner': 'hsl(var(--status-purple))',    // Purple
  },

  // Building status colors
  buildingStatus: {
    active: 'hsl(var(--status-success))',
    construction: 'hsl(var(--status-warning))',
    planned: 'hsl(var(--status-info))',
    completed: 'hsl(var(--status-purple))',
  }
} as const;

// Helper functions για type-safe access
export const getSpacing = (size: keyof typeof spacing) => spacing[size];
export const getTypography = (property: keyof typeof typography, size: string) =>
  typography[property][size as keyof typeof typography[typeof property]];
export const getShadow = (size: keyof typeof shadows) => shadows[size];
export const getAnimation = (property: keyof typeof animation, value: string) =>
  animation[property][value as keyof typeof animation[typeof property]];
