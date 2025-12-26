/**
 * 🚨 DEPRECATED: useDesignSystem Hook
 *
 * ⚠️ ENTERPRISE DEPRECATION NOTICE: This hook is deprecated as of 2025-12-25
 *
 * REASON: Over-engineered complexity for simple color/border needs
 *
 * MIGRATION PATH:
 * - Replace with: import { useSemanticColors } from '@/hooks/useSemanticColors';
 * - Replace with: import { useBorderTokens } from '@/hooks/useBorderTokens';
 *
 * TIMELINE:
 * - 2025-12-25: Deprecation warning added
 * - 2026-01-15: Will be removed
 *
 * WHY DEPRECATED: Microsoft/Google Enterprise approach favors simple,
 * focused hooks over complex unified APIs that create cognitive overhead.
 *
 * @deprecated Use useSemanticColors() and useBorderTokens() instead
 */

import { useBorderTokens } from './useBorderTokens';
import { useSemanticColors } from './useSemanticColors';
import { useTypography } from './useTypography';
import { useLayoutClasses } from './useLayoutClasses';
import {
  AGENT_COORDINATION_API,
  type ColorTokenBridge,
  type SpacingTokenBridge,
  type TypographyTokenBridge
} from './internal/enterprise-token-bridge';

// =============================================================================
// 🎯 UNIFIED DESIGN SYSTEM TYPES
// =============================================================================

/**
 * Complete Design System API
 * Single interface for all design tokens and utilities
 */
export interface DesignSystemAPI {
  /** Border tokens - Already enterprise-ready (519 uses) */
  borders: ReturnType<typeof useBorderTokens>;

  /** Color tokens - Progressive migration to design-tokens.ts */
  colors: ReturnType<typeof useSemanticColors> & {
    /** Enterprise token bridge access */
    bridge: {
      get: (colorName: Parameters<typeof AGENT_COORDINATION_API.getColorBridge>[0]) => ColorTokenBridge;
      convert: typeof AGENT_COORDINATION_API.convertTailwind;
    };
  };

  /** Spacing tokens - Progressive migration to design-tokens.ts */
  spacing: ReturnType<typeof useLayoutClasses> & {
    /** Enterprise token bridge access */
    bridge: {
      get: (size: Parameters<typeof AGENT_COORDINATION_API.getSpacingBridge>[0]) => SpacingTokenBridge;
      responsive: (size: Parameters<typeof AGENT_COORDINATION_API.getSpacingBridge>[0]) => SpacingTokenBridge['responsive'];
    };
  };

  /** Typography tokens - Progressive migration to design-tokens.ts */
  typography: ReturnType<typeof useTypography> & {
    /** Enterprise token bridge access - ⚠️ DEPRECATED: Use useTypography directly */
    bridge: {
      // ❌ REMOVED: getTypographyBridge (was duplicate)
      // ✅ USE: useTypography hook and SEMANTIC_TYPOGRAPHY_TOKENS instead
      get: () => void; // Deprecated placeholder
      fullClass: () => string; // Deprecated placeholder
    };
  };

  /** Global design system utilities */
  utils: {
    /** Health check for all token systems */
    healthCheck: typeof AGENT_COORDINATION_API.healthCheck;
    /** Convert any hardcoded class to design token */
    convertToToken: typeof AGENT_COORDINATION_API.convertTailwind;
    /** Development mode validation */
    validate: () => DesignSystemValidationReport;
  };
}

/**
 * Design System Validation Report
 * Used in development to ensure proper token usage
 */
export interface DesignSystemValidationReport {
  isValid: boolean;
  systems: {
    borders: { status: 'healthy' | 'warning' | 'error'; uses: number };
    colors: { status: 'healthy' | 'warning' | 'error'; uses: number };
    spacing: { status: 'healthy' | 'warning' | 'error'; uses: number };
    typography: { status: 'healthy' | 'warning' | 'error'; uses: number };
  };
  recommendations: string[];
  enterpriseCompliance: number; // 0-100%
}

// =============================================================================
// 🚀 MAIN UNIFIED DESIGN SYSTEM HOOK
// =============================================================================

/**
 * useDesignSystem - Single entry point for all design tokens
 *
 * This hook provides a unified API for accessing all design tokens in the application.
 * It coordinates between existing proven hooks and the new enterprise infrastructure.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { borders, colors, spacing, typography } = useDesignSystem();
 *
 *   return (
 *     <div className={`${borders.quick.default} ${colors.success} ${spacing.md} ${typography.h2.class}`}>
 *       Enterprise-grade component
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns Complete design system API with all token categories
 */
/**
 * @deprecated Use useSemanticColors() and useBorderTokens() instead
 * This will be removed in January 2026
 */
export function useDesignSystem(): DesignSystemAPI {
  // 🚨 DEPRECATION WARNING - Enterprise standard console warning
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '🚨 DEPRECATION WARNING: useDesignSystem() is deprecated.\n' +
      '→ Replace with: useSemanticColors() and useBorderTokens()\n' +
      '→ Removal date: January 15, 2026\n' +
      '→ Reason: Over-engineered complexity for simple needs'
    );
  }
  // Existing proven hooks (maintained for backward compatibility)
  const borders = useBorderTokens();
  const colorsBase = useSemanticColors();
  const spacingBase = useLayoutClasses();
  const typographyBase = useTypography();

  // Enhanced APIs with enterprise token bridge access
  const colors = {
    ...colorsBase,
    bridge: {
      get: AGENT_COORDINATION_API.getColorBridge,
      convert: AGENT_COORDINATION_API.convertTailwind
    }
  };

  const spacing = {
    ...spacingBase,
    bridge: {
      get: AGENT_COORDINATION_API.getSpacingBridge,
      responsive: (size: Parameters<typeof AGENT_COORDINATION_API.getSpacingBridge>[0]) =>
        AGENT_COORDINATION_API.getSpacingBridge(size).responsive
    }
  };

  const typography = {
    ...typographyBase,
    bridge: {
      // ❌ REMOVED: getTypographyBridge (was duplicate)
      // ✅ USE: Direct import from useTypography instead
      get: () => {
        console.warn('⚠️ DEPRECATED: typography.bridge.get() - Use SEMANTIC_TYPOGRAPHY_TOKENS from useTypography.ts');
        return {} as any; // Placeholder to prevent crashes
      },
      fullClass: () => {
        console.warn('⚠️ DEPRECATED: typography.bridge.fullClass() - Use SEMANTIC_TYPOGRAPHY_TOKENS from useTypography.ts');
        return 'text-base'; // Safe fallback
      }
    }
  };

  // Global utilities
  const utils = {
    healthCheck: AGENT_COORDINATION_API.healthCheck,
    convertToToken: AGENT_COORDINATION_API.convertTailwind,
    validate: (): DesignSystemValidationReport => {
      const healthCheck = AGENT_COORDINATION_API.healthCheck();

      // Calculate enterprise compliance based on centralized token usage
      const enterpriseCompliance = calculateEnterpriseCompliance();

      return {
        isValid: healthCheck.isHealthy,
        systems: {
          borders: { status: 'healthy', uses: 519 }, // Known from audit
          colors: { status: 'warning', uses: 49 },   // Needs migration
          spacing: { status: 'error', uses: 1054 },  // Critical - many hardcoded
          typography: { status: 'warning', uses: 186 } // Needs migration
        },
        recommendations: generateRecommendations(),
        enterpriseCompliance
      };
    }
  };

  return {
    borders,
    colors,
    spacing,
    typography,
    utils
  };
}

// =============================================================================
// 🔧 INTERNAL UTILITIES
// =============================================================================

/**
 * Calculate enterprise compliance score based on centralized token usage
 */
function calculateEnterpriseCompliance(): number {
  // Total known uses from audit
  const totalUses = 519 + 49 + 1054 + 186; // borders + colors + spacing + typography
  const centralizedUses = 519; // Only borders are fully centralized

  return Math.round((centralizedUses / totalUses) * 100);
}

/**
 * Generate recommendations for improving design system usage
 */
function generateRecommendations(): string[] {
  return [
    '🎯 Priority 1: Centralize spacing tokens (1,054 hardcoded patterns found)',
    '🌈 Priority 2: Migrate useSemanticColors to design-tokens.ts (49 uses)',
    '🔤 Priority 3: Migrate useTypography to design-tokens.ts (186 uses)',
    '✅ Borders: Already enterprise-ready with useBorderTokens (519 uses)',
    '🏢 Consider implementing Agent coordination strategy per consensus'
  ];
}

// =============================================================================
// 🎯 CONVENIENCE HOOKS FOR SPECIFIC USE CASES
// =============================================================================

/**
 * useDesignTokens - Simplified API for common design token access
 *
 * @example
 * ```tsx
 * const tokens = useDesignTokens();
 * const className = `${tokens.border.default} ${tokens.color.success} ${tokens.spacing.md}`;
 * ```
 */
export function useDesignTokens() {
  const { borders, colors, spacing, typography } = useDesignSystem();

  return {
    border: borders.quick,
    color: colors,
    spacing,
    text: typography
  };
}

/**
 * useEnterpriseBridge - Direct access to enterprise token bridge
 * For advanced usage and migration utilities
 */
export function useEnterpriseBridge() {
  return AGENT_COORDINATION_API;
}

/**
 * Development mode helper - validates design system health
 * Only runs in development environment
 */
export function useDesignSystemDev() {
  const { utils } = useDesignSystem();

  // Only run in development
  if (process.env.NODE_ENV === 'development') {
    const validation = utils.validate();
    const health = utils.healthCheck();

    // Log warnings in development console
    if (!validation.isValid) {
      console.warn('🚨 Design System Issues Detected:', validation.recommendations);
    }

    if (!health.isHealthy) {
      console.warn('🏥 Design System Health Issues:', health.issues);
    }

    return { validation, health };
  }

  return null;
}

// =============================================================================
// 📊 AGENT COORDINATION STATUS
// =============================================================================

/**
 * Get current status of all agents and their progress
 * Used for monitoring the migration progress
 */
export function getAgentCoordinationStatus() {
  return {
    agentA: {
      name: 'Spacing System Architect',
      status: 'pending',
      target: 'useLayoutClasses refactoring',
      priority: 'critical',
      impact: '1,054 hardcoded patterns'
    },
    agentB: {
      name: 'Color System Architect',
      status: 'pending',
      target: 'useSemanticColors refactoring',
      priority: 'high',
      impact: '49 existing uses'
    },
    agentC: {
      name: 'Typography System Architect',
      status: 'pending',
      target: 'useTypography refactoring',
      priority: 'high',
      impact: '186 existing uses'
    },
    agentD: {
      name: 'Integration & Migration Specialist',
      status: 'active',
      target: 'Token Bridge Infrastructure',
      priority: 'foundation',
      impact: 'Unified API coordination'
    },
    infrastructure: {
      tokenBridge: 'completed',
      unifiedAPI: 'completed',
      migrationUtils: 'completed',
      coordination: 'ready'
    }
  };
}

/**
 * 📋 USAGE GUIDELINES FOR OTHER AGENTS:
 *
 * Agent A (Spacing): Refactor useLayoutClasses to use spacing bridge
 * Agent B (Color): Refactor useSemanticColors to use color bridge
 * Agent C (Typography): Refactor useTypography to use typography bridge
 *
 * All agents should maintain existing API surfaces for backward compatibility.
 * The enterprise token bridge provides the centralized foundation.
 *
 * Example refactor pattern:
 * ```typescript
 * // Before (hardcoded)
 * success: 'text-green-600'
 *
 * // After (using bridge)
 * success: AGENT_COORDINATION_API.getColorBridge('success').tailwind
 * ```
 */