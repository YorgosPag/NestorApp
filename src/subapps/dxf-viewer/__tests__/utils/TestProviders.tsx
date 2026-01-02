/**
 * TEST PROVIDERS - Enterprise Test Infrastructure
 *
 * @module __tests__/utils/TestProviders
 *
 * 🏢 ENTERPRISE RULES (STRICT):
 * 1. ΕΝΑ ΚΑΙ ΜΟΝΟ ΣΗΜΕΙΟ - Κανένας άλλος wrapper πουθενά αλλού
 * 2. ΟΧΙ Firebase, ΟΧΙ side effects - Μόνο in-memory/test-safe configs
 * 3. REAL PROVIDERS, ΟΧΙ MOCKED HOOKS - Mock dependencies, όχι hooks
 * 4. ZERO BUSINESS LOGIC - Μόνο wiring
 *
 * @usage
 * ```tsx
 * import { TestProviders } from '../utils/TestProviders';
 *
 * const { result } = renderHook(() => useUnifiedDrawing(), {
 *   wrapper: TestProviders
 * });
 * ```
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @created 2026-01-02
 * @enterprise-grade
 */

import React, { type ReactNode } from 'react';

// Real providers with test-safe configuration
import { LevelsSystem } from '../../systems/levels/LevelsSystem';
import { EnterpriseDxfSettingsProvider } from '../../settings-provider/EnterpriseDxfSettingsProvider';
import { SnapProvider } from '../../snapping/context/SnapContext';
import { ProjectHierarchyProvider } from '../../contexts/ProjectHierarchyContext';
import { GripProvider } from '../../providers/GripProvider';

/**
 * TestProviders Props
 *
 * Minimal interface - No options, no flags (per enterprise requirements)
 */
interface TestProvidersProps {
  children: ReactNode;
}

/**
 * TestProviders - Enterprise Test Infrastructure
 *
 * Wraps components with all required providers in test-safe configuration.
 *
 * Provider Order (dependency hierarchy):
 * 1. LevelsSystem - Core domain state (no Firestore in tests)
 * 2. EnterpriseDxfSettingsProvider - Settings (no syncDeps = in-memory only)
 * 3. ProjectHierarchyProvider - Hierarchy state
 * 4. GripProvider - Grip state
 * 5. SnapProvider - Snap state
 *
 * TEST-SAFE GUARANTEES:
 * - LevelsSystem: enableFirestore=false → in-memory only
 * - EnterpriseDxfSettingsProvider: enabled + NO syncDeps → context active, no Firebase
 * - All other providers: stateless or in-memory
 *
 * @enterprise-grade
 */
export function TestProviders({ children }: TestProvidersProps) {
  return (
    <LevelsSystem enableFirestore={false}>
      <EnterpriseDxfSettingsProvider enabled>
        <ProjectHierarchyProvider>
          <GripProvider>
            <SnapProvider>
              {children}
            </SnapProvider>
          </GripProvider>
        </ProjectHierarchyProvider>
      </EnterpriseDxfSettingsProvider>
    </LevelsSystem>
  );
}
