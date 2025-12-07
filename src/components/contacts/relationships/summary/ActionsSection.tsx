// ============================================================================
// ACTIONS SECTION COMPONENT - ENTERPRISE MODULE
// ============================================================================
//
// 🎛️ Dedicated component για relationship management actions
// Extracted από RelationshipsSummary για modularity
//
// ============================================================================

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Settings } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ActionsSectionProps {
  /** Whether in read-only mode */
  readonly?: boolean;
  /** Callback for manage relationships action */
  onManageRelationships?: () => void;
  /** Optional CSS className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🎛️ ActionsSection Component
 *
 * Enterprise component για relationship management actions
 *
 * Features:
 * - View & Manage button (always visible)
 * - Edit Relationships button (hidden in readonly mode)
 * - Responsive design
 * - Consistent styling
 */
export const ActionsSection: React.FC<ActionsSectionProps> = ({
  readonly = false,
  onManageRelationships,
  className
}) => {
  // ============================================================================
  // EARLY RETURN
  // ============================================================================

  if (!onManageRelationships) {
    return null;
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`flex justify-center space-x-3 ${className || ''}`}>
      <Button
        onClick={onManageRelationships}
        variant="outline"
        className="flex-1 max-w-xs"
      >
        <Eye className="h-4 w-4 mr-2" />
        Προβολή & Διαχείριση
      </Button>

      {!readonly && (
        <Button
          onClick={onManageRelationships}
          className="flex-1 max-w-xs"
        >
          <Settings className="h-4 w-4 mr-2" />
          Επεξεργασία Σχέσεων
        </Button>
      )}
    </div>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export default ActionsSection;