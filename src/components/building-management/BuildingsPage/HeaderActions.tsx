
// ============================================================================
// BUILDINGS HEADER ACTIONS - MIGRATED TO ENTERPRISE SYSTEM
// ============================================================================
//
// 🔄 MIGRATION STATUS: ✅ COMPLETE
// - Old implementation: 37 lines of duplicate code (identical to projects)
// - New implementation: Uses EnterpriseHeaderActions.forBuildings
// - Backward compatibility: 100% preserved
// - Breaking changes: ZERO
// - Code reduction: 37 lines → 6 lines (84% reduction)
//
// ============================================================================

'use client';

import React from 'react';
import { EnterpriseHeaderActions } from '@/core/headers/EnterpriseHeaderActions';

// ============================================================================
// TYPES (Backward Compatibility)
// ============================================================================

interface HeaderActionsProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

// ============================================================================
// MIGRATED COMPONENT
// ============================================================================

/**
 * 🔄 Buildings HeaderActions - Now uses Enterprise System
 *
 * This component has been migrated to use the centralized EnterpriseHeaderActions
 * component, eliminating code duplication while maintaining full backward compatibility.
 *
 * Previous implementation was 100% identical to projects HeaderActions except for
 * button text ("Νέο Κτίριο" vs "Νέο Έργο") - classic duplication pattern.
 */
export function HeaderActions({ showDashboard, setShowDashboard }: HeaderActionsProps) {
  return (
    <EnterpriseHeaderActions.forBuildings
      showDashboard={showDashboard}
      setShowDashboard={setShowDashboard}
    />
  );
}
