/**
 * UNIFIED PROVIDERS SYSTEM
 * Απλοποιημένο provider tree που αντικαθιστά 12+ contexts
 * Διατηρεί backward compatibility για smooth transition
 */

'use client';

import React from 'react';
// 🗑️ REMOVED (2025-10-06): ConfigurationProvider - MERGED into DxfSettingsProvider
// import { ConfigurationProvider } from './ConfigurationProvider';
import { StyleManagerProvider } from './StyleManagerProvider';
import { DxfSettingsProvider } from './DxfSettingsProvider';

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

  if (enableLegacyMode) {
    // LEGACY MODE: Διατηρεί υπάρχοντα providers + προσθέτει νέα
    return (
      <ProjectHierarchyProvider>
        <GripProvider>
          <SnapProvider>
            {/* 🗑️ REMOVED: ConfigurationProvider - Now using DxfSettingsProvider */}
            <DxfSettingsProvider>
              <StyleManagerProvider>
                {children}
              </StyleManagerProvider>
            </DxfSettingsProvider>
          </SnapProvider>
        </GripProvider>
      </ProjectHierarchyProvider>
    );
  }

  // FUTURE MODE: Μόνο νέα unified providers
  return (
    <ProjectHierarchyProvider>
      {/* 🗑️ REMOVED: ConfigurationProvider - Now using DxfSettingsProvider */}
      <DxfSettingsProvider>
        <StyleManagerProvider>
          <SnapProvider>
            {children}
          </SnapProvider>
        </StyleManagerProvider>
      </DxfSettingsProvider>
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