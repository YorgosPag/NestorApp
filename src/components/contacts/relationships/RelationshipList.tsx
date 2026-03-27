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
import { Users } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types and components
import { RelationshipCard } from './RelationshipCard';
import type { RelationshipListProps } from './types/relationship-manager.types';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';

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
  contactType: _contactType,
  loading,
  contactId,
  readonly = false,
  expandedRelationships,
  onToggleExpanded,
  onEdit,
  onDelete
}) => {
  // ============================================================================
  // 🏢 ENTERPRISE: i18n hook for translations
  // ============================================================================
  const { t } = useTranslation('contacts');

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
          <p className="font-medium">{t('relationships.list.newContact.title')}</p>
          <p className="text-sm mt-2">
            {t('relationships.list.newContact.description')}
          </p>
          <div className={`mt-2 p-2 ${getStatusColor('info', 'bg')} rounded-lg`}>
            <p className={`text-xs ${getStatusColor('info', 'text')}`}>
              💡 <strong>{t('relationships.list.newContact.tip')}</strong> {t('relationships.list.newContact.tipText')}
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
        <p className="text-center text-gray-500">{t('relationships.list.loading')}</p>
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
          <p>{t('relationships.list.empty.title')}</p>
          {!readonly && (
            <p className="text-sm">
              {t('relationships.list.empty.addHint')}
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
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {relationships.map((relationship) => {
        const relationshipId = relationship.id;
        if (!relationshipId) return null;

        return (
          <RelationshipCard
            key={relationshipId}
            relationship={relationship}
            currentContactId={contactId}
            isExpanded={expandedRelationships.has(relationshipId)}
            onToggleExpanded={() => onToggleExpanded(relationshipId)}
            readonly={readonly}
            onEdit={onEdit ? () => onEdit(relationship) : undefined}
            onDelete={onDelete ? () => onDelete(relationshipId) : undefined}
          />
        );
      })}
    </div>
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