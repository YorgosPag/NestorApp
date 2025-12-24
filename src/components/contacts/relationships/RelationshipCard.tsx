// ============================================================================
// RELATIONSHIP CARD COMPONENT
// ============================================================================
//
// 🃏 Individual relationship card component with expand/collapse functionality
// Extracted from ContactRelationshipManager for better modularity
//
// ============================================================================

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatDate } from '@/lib/intl-utils';
import {
  Edit,
  Trash2,
  Building2,
  Phone,
  Mail,
  Calendar,
  ChevronDown,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// 🏢 ENTERPRISE: Import centralized utilities
import { getRelationshipDisplayProps } from './utils/relationship-types';
import type { RelationshipCardProps } from './types/relationship-manager.types';
import { useContactName } from './hooks/useContactName';
import { HOVER_TEXT_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

/**
 * 🃏 RelationshipCard Component
 *
 * Displays a single relationship with expandable details
 *
 * Features:
 * - Collapsible card design
 * - Relationship type badges with icons
 * - Professional contact information display
 * - Edit and delete actions (when not readonly)
 * - Responsive layout
 */
export const RelationshipCard: React.FC<RelationshipCardProps> = ({
  relationship,
  currentContactId,
  isExpanded,
  onToggleExpanded,
  readonly = false,
  onEdit,
  onDelete
}) => {
  // ============================================================================
  // 🏢 ENTERPRISE: Use centralized contact name hook
  // ============================================================================

  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  // 🔧 ENTERPRISE FIX: Show the "other" contact in the relationship
  // Determine which contact to show based on which one is NOT the current contact
  const contactIdToShow = relationship.sourceContactId === currentContactId
    ? relationship.targetContactId
    : relationship.sourceContactId;


  const { contactName } = useContactName(contactIdToShow);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const displayProps = getRelationshipDisplayProps(relationship.relationshipType);
  const Icon = displayProps.icon;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className="mb-4 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Expand/Collapse Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
              }}
              className="p-1"
            >
              {isExpanded ? (
                <ChevronDown className={iconSizes.sm} />
              ) : (
                <ChevronRight className={iconSizes.sm} />
              )}
            </Button>

            {/* Relationship Icon */}
            <Icon className={`${iconSizes.md} text-gray-600`} />

            {/* Relationship Info - Contact name and relationship type */}
            <div>
              {/* Contact name and relationship type - σε μία σειρά */}
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
                    <div className={`animate-pulse bg-gray-200 h-4 w-24 ${quick.rounded}`}></div>
                    <Badge className={displayProps.color} variant="outline">
                      {displayProps.label}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!readonly && (
            <div className="flex space-x-2">
              {onEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEdit) onEdit();
                  }}
                  className={`${iconSizes.xl} p-0`}
                  title="Επεξεργασία σχέσης"
                >
                  <Edit className={iconSizes.sm} />
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDelete) onDelete();
                  }}
                  className={`${iconSizes.xl} p-0 ${HOVER_TEXT_EFFECTS.RED}`}
                  title="Διαγραφή σχέσης"
                >
                  <Trash2 className={iconSizes.sm} />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Expanded Details */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Department */}
            {relationship.department && (
              <div className="flex items-center space-x-2">
                <Building2 className={`${iconSizes.sm} text-gray-500`} />
                <span className="text-sm">{relationship.department}</span>
              </div>
            )}

            {/* Start Date */}
            {relationship.startDate && (
              <div className="flex items-center space-x-2">
                <Calendar className={`${iconSizes.sm} text-gray-500`} />
                <span className="text-sm">
                  Από: {formatDate(relationship.startDate)}
                </span>
              </div>
            )}

            {/* Business Phone */}
            {relationship.contactInfo?.businessPhone && (
              <div className="flex items-center space-x-2">
                <Phone className={`${iconSizes.sm} text-gray-500`} />
                <span className="text-sm">{relationship.contactInfo.businessPhone}</span>
                {relationship.contactInfo.extensionNumber && (
                  <span className="text-xs text-gray-400">
                    ext. {relationship.contactInfo.extensionNumber}
                  </span>
                )}
              </div>
            )}

            {/* Business Email */}
            {relationship.contactInfo?.businessEmail && (
              <div className="flex items-center space-x-2">
                <Mail className={`${iconSizes.sm} text-gray-500`} />
                <a
                  href={`mailto:${relationship.contactInfo.businessEmail}`}
                  className={`text-sm ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {relationship.contactInfo.businessEmail}
                </a>
              </div>
            )}

            {/* Business Address */}
            {relationship.contactInfo?.businessAddress && (
              <div className="flex items-center space-x-2 md:col-span-2">
                <MapPin className={`${iconSizes.sm} text-gray-500`} />
                <span className="text-sm">{relationship.contactInfo.businessAddress}</span>
              </div>
            )}

            {/* End Date */}
            {relationship.endDate && (
              <div className="flex items-center space-x-2">
                <Calendar className={`${iconSizes.sm} text-red-500`} />
                <span className="text-sm text-red-600">
                  Έως: {formatDate(relationship.endDate)}
                </span>
              </div>
            )}

            {/* Notes */}
            {relationship.notes && (
              <div className="md:col-span-2">
                <p className={`text-sm text-gray-600 bg-gray-50 p-3 ${quick.table}`}>
                  <strong>Σημειώσεις:</strong> {relationship.notes}
                </p>
              </div>
            )}

            {/* Relationship Metadata */}
            <div className={`md:col-span-2 text-xs text-gray-400 ${quick.borderT} pt-2`}>
              <span>
                Δημιουργήθηκε: {
                  relationship.createdAt
                    ? formatDate(relationship.createdAt.seconds ? relationship.createdAt.seconds * 1000 : relationship.createdAt)
                    : 'Πρόσφατα'
                }
              </span>
              {relationship.updatedAt && relationship.updatedAt !== relationship.createdAt && (
                <span className="ml-4">
                  Ενημερώθηκε: {
                    formatDate(relationship.updatedAt.seconds ? relationship.updatedAt.seconds * 1000 : relationship.updatedAt)
                  }
                </span>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default RelationshipCard;