/**
 * UNIFIED PROVIDERS SYSTEM
 * Απλοποιημένο provider tree που αντικαθιστά 12+ contexts
 * Διατηρεί backward compatibility για smooth transition
 */

'use client';

import React from 'react';
// 🗑️ REMOVED (2025-10-06): ConfigurationProvider - MERGED into DxfSettingsProvider
// import { ConfigurationProvider } from './ConfigurationProvider';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Full Enterprise Migration (old provider removed)
// StyleManagerProvider moved to DxfViewerApp.tsx (needs EnterpriseDxfSettingsProvider context)
// import { StyleManagerProvider } from './StyleManagerProvider';
// import { EXPERIMENTAL_FEATURES } from '../config/experimental-features';

// Import των υπαρχόντων providers για backward compatibility
import { ProjectHierarchyProvider } from '../contexts/ProjectHierarchyContext';
import { GripProvider } from './GripProvider';
import { SnapProvider } from '../snapping/context/SnapContext';

// ===== ΝΕΟΣ ΑΠΛΟΠΟΙΗΜΕΝΟΣ PROVIDER TREE =====

interface UnifiedProvidersProps {
  children: React.ReactNode;
  enableLegacyMode?: boolean; // Για σταδιακή μετάβαση
}

export function UnifiedProviders({
  children,
  enableLegacyMode = true // Default true για safety
}: UnifiedProvidersProps) {

  // 🏢 PHASE 3.2 COMPLETE: FULL ENTERPRISE MIGRATION
  // Old provider removed - Enterprise is now primary
  // All backward compatibility built into EnterpriseDxfSettingsProvider
  return (
    <ProjectHierarchyProvider>
      <GripProvider>
        <SnapProvider>
          {/* ✅ StyleManagerProvider MOVED - Must be INSIDE EnterpriseDxfSettingsProvider */}
          {/* StyleManagerProvider needs useEnterpriseDxfSettings, so it goes in DxfViewerApp.tsx */}
          {children}
        </SnapProvider>
      </GripProvider>
    </ProjectHierarchyProvider>
  );
}

// ===== COMPATIBILITY LAYER =====

/**
 * Wrapper που εμπλουτίζει τα νέα providers με compatibility hooks
 * για υπάρχοντα components που χρησιμοποιούν παλιά APIs
 */
export function CompatibilityWrapper({ children }: { children: React.ReactNode }) {
  return (
    <UnifiedProviders enableLegacyMode={true}>
      {children}
    </UnifiedProviders>
  );
}

// ===== CLEAN FUTURE WRAPPER =====

/**
 * Καθαρό wrapper για το μέλλον χωρίς legacy dependencies
 */
export function CleanProviders({ children }: { children: React.ReactNode }) {
  return (
    <UnifiedProviders enableLegacyMode={false}>
      {children}
    </UnifiedProviders>
  );
}