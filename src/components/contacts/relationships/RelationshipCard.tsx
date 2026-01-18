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
  Calendar,
  ChevronDown,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized entity icons (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 ENTERPRISE: Import centralized utilities
import { getRelationshipDisplayProps } from './utils/relationship-types';
import type { RelationshipCardProps } from './types/relationship-manager.types';
import { useContactName } from './hooks/useContactName';
import { HOVER_TEXT_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  // 🏢 ENTERPRISE: Use centralized contact name hook + i18n
  // ============================================================================
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const { quick, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

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
  // 🏢 ENTERPRISE: Translate i18n label key
  const translatedTypeLabel = t(displayProps.label);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className={`mb-4 ${getDirectionalBorder('info', 'left', 'bold')}`}>
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
            <Icon className={`${iconSizes.md} ${colors.text.muted}`} />

            {/* Relationship Info - Contact name and relationship type */}
            <div>
              {/* Contact name and relationship type - σε μία σειρά */}
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
                    <div className={`animate-pulse ${colors.bg.muted} h-4 w-24 ${quick.rounded}`}></div>
                    <Badge className={displayProps.color} variant="outline">
                      {translatedTypeLabel}
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
                  title={t('relationships.card.editTitle')}
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
                  title={t('relationships.card.deleteTitle')}
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

            {/* Department - 🏢 ENTERPRISE: Using centralized building icon */}
            {relationship.department && (
              <div className="flex items-center space-x-2">
                <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color)} />
                <span className="text-sm">{relationship.department}</span>
              </div>
            )}

            {/* Start Date */}
            {relationship.startDate && (
              <div className="flex items-center space-x-2">
                <Calendar className={`${iconSizes.sm} ${colors.text.muted}`} />
                <span className="text-sm">
                  {t('relationships.card.from')} {formatDate(relationship.startDate)}
                </span>
              </div>
            )}

            {/* Business Phone - 🏢 ENTERPRISE: Using centralized phone icon */}
            {relationship.contactInfo?.businessPhone && (
              <div className="flex items-center space-x-2">
                <NAVIGATION_ENTITIES.phone.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.phone.color)} />
                <span className="text-sm">{relationship.contactInfo.businessPhone}</span>
                {relationship.contactInfo.extensionNumber && (
                  <span className={`text-xs ${colors.text.light}`}>
                    ext. {relationship.contactInfo.extensionNumber}
                  </span>
                )}
              </div>
            )}

            {/* Business Email - 🏢 ENTERPRISE: Using centralized email icon */}
            {relationship.contactInfo?.businessEmail && (
              <div className="flex items-center space-x-2">
                <NAVIGATION_ENTITIES.email.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.email.color)} />
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
                <MapPin className={`${iconSizes.sm} ${colors.text.muted}`} />
                <span className="text-sm">{relationship.contactInfo.businessAddress}</span>
              </div>
            )}

            {/* End Date */}
            {relationship.endDate && (
              <div className="flex items-center space-x-2">
                <Calendar className={`${iconSizes.sm} ${colors.text.error}`} />
                <span className={`text-sm ${colors.text.error}`}>
                  {t('relationships.card.to')} {formatDate(relationship.endDate)}
                </span>
              </div>
            )}

            {/* Notes */}
            {relationship.notes && (
              <div className="md:col-span-2">
                <p className={`text-sm ${colors.text.muted} ${colors.bg.secondary} p-3 ${quick.table}`}>
                  <strong>{t('relationships.card.notes')}</strong> {relationship.notes}
                </p>
              </div>
            )}

            {/* Relationship Metadata */}
            <div className={`md:col-span-2 text-xs ${colors.text.light} ${quick.borderT} pt-2`}>
              <span>
                {t('relationships.card.createdAt')} {
                  relationship.createdAt
                    ? formatDate(relationship.createdAt.seconds ? relationship.createdAt.seconds * 1000 : relationship.createdAt)
                    : t('relationships.card.recently')
                }
              </span>
              {relationship.updatedAt && relationship.updatedAt !== relationship.createdAt && (
                <span className="ml-4">
                  {t('relationships.card.updatedAt')} {
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