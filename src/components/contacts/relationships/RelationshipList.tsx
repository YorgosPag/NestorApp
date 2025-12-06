// ============================================================================
// RELATIONSHIP LIST COMPONENT
// ============================================================================
//
// 📋 List component for displaying relationships with different states
// Extracted from ContactRelationshipManager for better modularity
//
// ============================================================================

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types and components
import type { ContactRelationship } from '@/types/contacts/relationships';
import { RelationshipCard } from './RelationshipCard';
import type { RelationshipListProps } from './types/relationship-manager.types';

/**
 * 📋 RelationshipList Component
 *
 * Manages the display of relationship lists with various states
 *
 * Features:
 * - Empty state handling for new contacts
 * - Loading state display
 * - Scrollable relationship list
 * - Individual relationship cards with actions
 * - Responsive design
 */
export const RelationshipList: React.FC<RelationshipListProps> = ({
  relationships,
  contactType,
  loading,
  contactId,
  readonly = false,
  expandedRelationships,
  onToggleExpanded,
  onEdit,
  onDelete
}) => {
  // ============================================================================
  // STATE COMPUTATION
  // ============================================================================

  const isNewContact = !contactId || contactId === 'new-contact';
  const isEmptyList = relationships.length === 0;
  const isLoading = loading && isEmptyList;

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🆕 Render state for new contacts (no contact ID)
   */
  const renderNewContactState = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="font-medium">Δημιουργία σχέσεων</p>
          <p className="text-sm mt-2">
            Για να δημιουργήσετε σχέσεις, πρώτα αποθηκεύστε την επαφή.
            Μετά την αποθήκευση θα μπορείτε να προσθέσετε επαγγελματικές σχέσεις.
          </p>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600">
              💡 <strong>Συμβουλή:</strong> Συμπληρώστε τα βασικά στοιχεία και κάντε κλικ "Ενημέρωση Επαφής"
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  /**
   * ⏳ Render loading state
   */
  const renderLoadingState = () => (
    <Card>
      <CardContent className="pt-6">
        <p className="text-center text-gray-500">Φόρτωση σχέσεων...</p>
      </CardContent>
    </Card>
  );

  /**
   * 📭 Render empty list state
   */
  const renderEmptyState = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Δεν υπάρχουν καταχωρημένες σχέσεις</p>
          {!readonly && (
            <p className="text-sm">
              Κάντε κλικ στο κουμπί "Προσθήκη Σχέσης" για να προσθέσετε την πρώτη σχέση.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  /**
   * 📋 Render relationship list with scrollable area
   */
  const renderRelationshipList = () => (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4">
        {relationships.map((relationship) => {
          const relationshipId = relationship.id;
          if (!relationshipId) return null;

          return (
            <RelationshipCard
              key={relationshipId}
              relationship={relationship}
              isExpanded={expandedRelationships.has(relationshipId)}
              onToggleExpanded={() => onToggleExpanded(relationshipId)}
              readonly={readonly}
              onEdit={onEdit ? () => onEdit(relationship) : undefined}
              onDelete={onDelete ? () => onDelete(relationshipId) : undefined}
            />
          );
        })}
      </div>
    </ScrollArea>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Handle different states based on contact and data status
  if (isNewContact) {
    return renderNewContactState();
  }

  if (isLoading) {
    return renderLoadingState();
  }

  if (isEmptyList) {
    return renderEmptyState();
  }

  return renderRelationshipList();
};

export default RelationshipList;