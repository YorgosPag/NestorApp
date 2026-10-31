// ============================================================================
// RECENT RELATIONSHIPS SECTION COMPONENT - ENTERPRISE MODULE
// ============================================================================
//
// 🔍 Dedicated component για recent relationships list
// Extracted από RelationshipsSummary για modularity
//
// ============================================================================

'use client';

import React, { useState } from 'react';
import '@/lib/design-system';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { ContactRelationship } from '@/types/contacts/relationships';
import { getRelationshipDisplayProps } from '../utils/relationship-types';
import type { ContactNamesMap } from '../utils/summary/contact-navigation';
import type { FlexibleDateInput } from '@/types/common/date-types'; // 🏢 ENTERPRISE: Type-safe dates
import { formatFlexibleDateTime } from '@/lib/intl-utils'; // 🏢 ENTERPRISE: Centralized date formatting (ADR-208)
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================


interface RecentRelationshipsSectionProps {
  /** Array of contact relationships */
  relationships: ContactRelationship[];
  /** Contact names mapping */
  contactNames: ContactNamesMap;
  /** Current contact ID */
  contactId: string;
  /** Callback when relationship is clicked */
  onRelationshipClick?: (relationship: ContactRelationship) => void;
  /** Optional CSS className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🔍 RecentRelationshipsSection Component
 *
 * Enterprise component για displaying recent relationships
 *
 * Features:
 * - Expandable list (3 initial, show all on demand)
 * - Interactive relationship cards
 * - Smart date formatting
 * - Loading states for contact names
 */
export const RecentRelationshipsSection: React.FC<RecentRelationshipsSectionProps> = ({
  relationships,
  contactNames,
  contactId,
  onRelationshipClick,
  className = "mb-6"
}) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');
  // ============================================================================
  // STATE
  // ============================================================================

  const [showAllRelationships, setShowAllRelationships] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Show 3 relationships initially, all when expanded
  const displayedRelationships = showAllRelationships
    ? relationships
    : relationships.slice(0, 3);

  const hasMore = relationships.length > 3;

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * 📅 Format relationship creation date — centralized (ADR-208)
   */
  const formatCreatedDate = (createdAt: FlexibleDateInput): string => {
    const result = formatFlexibleDateTime(createdAt, { year: 'numeric', month: '2-digit', day: '2-digit' });
    return result === '-' ? t('relationships.card.recently') : result;
  };

  /**
   * 🎯 Get target contact info for relationship
   */
  const getTargetContactInfo = (relationship: ContactRelationship) => {
    const targetContactId = relationship.targetContactId === contactId
      ? relationship.sourceContactId
      : relationship.targetContactId;

    const contactName = contactNames[targetContactId];

    return { targetContactId, contactName };
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🎨 Render individual relationship card
   */
  const renderRelationshipCard = (relationship: ContactRelationship) => {
    const displayProps = getRelationshipDisplayProps(relationship.relationshipType);
    const Icon = displayProps.icon;
    const { targetContactId: _targetContactId, contactName } = getTargetContactInfo(relationship);
    // 🏢 ENTERPRISE: Translate i18n label key
    const translatedTypeLabel = t(displayProps.label);

    return (
      <div
        key={relationship.id}
        onClick={() => onRelationshipClick?.(relationship)}
        className={`flex items-center justify-between p-2 ${quick.card} cursor-pointer ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
      >
        <div className="flex items-center space-x-2">
          <Icon className={`${iconSizes.md} ${colors.text.muted}`} />
          <div>
            <div className="flex items-center gap-2">
              {contactName ? (
                <>
                  <span className={`text-sm font-medium ${colors.text.primary}`}>
                    {contactName}
                  </span>
                  <Badge className={displayProps.color} variant="outline">
                    {translatedTypeLabel}
                  </Badge>
                  {relationship.position && (
                    <span className={`text-xs ${colors.text.muted}`}>• {relationship.position}</span>
                  )}
                </>
              ) : (
                <>
                  <div className={`animate-pulse ${colors.bg.muted} h-4 w-24 rounded`} />
                  <Badge className={displayProps.color} variant="outline">
                    {translatedTypeLabel}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={`text-xs ${colors.text.muted}`}>
          {formatCreatedDate(relationship.createdAt)}
        </div>
      </div>
    );
  };

  /**
   * 🔽 Render expand/collapse button
   */
  const renderExpandButton = () => {
    if (!hasMore) return null;

    return (
      <div className="text-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAllRelationships(!showAllRelationships)}
          className={`${INTERACTIVE_PATTERNS.TEXT_PRIMARY} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
        >
          {showAllRelationships ? (
            <>
              <ChevronUp className={`${iconSizes.sm} mr-2`} />
              {t('relationships.recent.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className={`${iconSizes.sm} mr-2`} />
              {t('relationships.recent.showAll', { count: relationships.length - 3 })}
            </>
          )}
        </Button>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{t('relationships.recent.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedRelationships.map(renderRelationshipCard)}
          {renderExpandButton()}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export default RecentRelationshipsSection;
