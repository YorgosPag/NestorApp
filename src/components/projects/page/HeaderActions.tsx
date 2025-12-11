// ============================================================================
// PROJECTS HEADER ACTIONS - MIGRATED TO ENTERPRISE SYSTEM
// ============================================================================
//
// 🔄 MIGRATION STATUS: ✅ COMPLETE
// - Old implementation: 36 lines of duplicate code
// - New implementation: Uses EnterpriseHeaderActions.forProjects
// - Backward compatibility: 100% preserved
// - Breaking changes: ZERO
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
 * 🔄 Projects HeaderActions - Now uses Enterprise System
 *
 * This component has been migrated to use the centralized EnterpriseHeaderActions
 * component, eliminating code duplication while maintaining full backward compatibility.
 */
export function HeaderActions({ showDashboard, setShowDashboard }: HeaderActionsProps) {
  return (
    <EnterpriseHeaderActions.forProjects
      showDashboard={showDashboard}
      setShowDashboard={setShowDashboard}
    />
  );
}
