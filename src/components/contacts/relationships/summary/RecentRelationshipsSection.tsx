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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { ContactRelationship } from '@/types/contacts/relationships';
import { getRelationshipDisplayProps } from '../utils/relationship-types';
import type { ContactNamesMap } from '../utils/summary/contact-navigation';
import type { FlexibleDateInput } from '@/types/common/date-types'; // 🏢 ENTERPRISE: Type-safe dates

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
   * 📅 Format relationship creation date - ENTERPRISE TYPE SAFE
   */
  const formatCreatedDate = (createdAt: FlexibleDateInput): string => {
    if (!createdAt) return 'Πρόσφατα';

    try {
      let date: Date;

      if (createdAt.seconds) {
        // Firestore Timestamp {seconds: number, nanoseconds: number}
        date = new Date(createdAt.seconds * 1000);
      } else if (typeof createdAt === 'object' && 'toDate' in createdAt) {
        // Firestore Timestamp with toDate() method
        date = createdAt.toDate();
      } else {
        // Regular Date string/object
        date = new Date(createdAt);
      }

      return date.toLocaleDateString('el-GR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting date:', error, createdAt);
      return 'Πρόσφατα';
    }
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
    const { targetContactId, contactName } = getTargetContactInfo(relationship);

    return (
      <div
        key={relationship.id}
        onClick={() => onRelationshipClick?.(relationship)}
        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
      >
        <div className="flex items-center space-x-3">
          <Icon className="h-5 w-5 text-gray-600" />
          <div>
            <div className="flex items-center gap-2">
              {contactName ? (
                <>
                  <span className="text-sm font-medium text-gray-900">
                    {contactName}
                  </span>
                  <Badge className={displayProps.color} variant="outline">
                    {displayProps.label}
                  </Badge>
                  {relationship.position && (
                    <span className="text-xs text-gray-600">• {relationship.position}</span>
                  )}
                </>
              ) : (
                <>
                  <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div>
                  <Badge className={displayProps.color} variant="outline">
                    {displayProps.label}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-400">
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
          className="text-blue-600 hover:bg-blue-50"
        >
          {showAllRelationships ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Προβολή λίγων
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Προβολή όλων ({relationships.length - 3} ακόμα)
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
        <CardTitle className="text-base">Πρόσφατες Σχέσεις</CardTitle>
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