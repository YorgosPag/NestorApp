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

// 🏢 ENTERPRISE: Import centralized utilities
import { getRelationshipDisplayProps } from './utils/relationship-types';
import type { RelationshipCardProps } from './types/relationship-manager.types';

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
  isExpanded,
  onToggleExpanded,
  readonly = false,
  onEdit,
  onDelete
}) => {
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
              variant="ghost"
              size="sm"
              onClick={onToggleExpanded}
              className="p-1"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            {/* Relationship Icon */}
            <Icon className="h-5 w-5 text-gray-600" />

            {/* Relationship Info */}
            <div>
              <Badge className={displayProps.color}>
                {displayProps.label}
              </Badge>
              {relationship.position && (
                <p className="text-sm text-gray-600 mt-1">{relationship.position}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {!readonly && (
            <div className="flex space-x-2">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-8 w-8 p-0"
                  title="Επεξεργασία σχέσης"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  title="Διαγραφή σχέσης"
                >
                  <Trash2 className="h-4 w-4" />
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
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{relationship.department}</span>
              </div>
            )}

            {/* Start Date */}
            {relationship.startDate && (
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  Από: {new Date(relationship.startDate).toLocaleDateString('el-GR')}
                </span>
              </div>
            )}

            {/* Business Phone */}
            {relationship.contactInfo?.businessPhone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-500" />
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
                <Mail className="h-4 w-4 text-gray-500" />
                <a
                  href={`mailto:${relationship.contactInfo.businessEmail}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {relationship.contactInfo.businessEmail}
                </a>
              </div>
            )}

            {/* Business Address */}
            {relationship.contactInfo?.businessAddress && (
              <div className="flex items-center space-x-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{relationship.contactInfo.businessAddress}</span>
              </div>
            )}

            {/* End Date */}
            {relationship.endDate && (
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">
                  Έως: {new Date(relationship.endDate).toLocaleDateString('el-GR')}
                </span>
              </div>
            )}

            {/* Notes */}
            {relationship.notes && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  <strong>Σημειώσεις:</strong> {relationship.notes}
                </p>
              </div>
            )}

            {/* Relationship Metadata */}
            <div className="md:col-span-2 text-xs text-gray-400 border-t pt-2">
              <span>Δημιουργήθηκε: {new Date(relationship.createdAt || '').toLocaleDateString('el-GR')}</span>
              {relationship.updatedAt && relationship.updatedAt !== relationship.createdAt && (
                <span className="ml-4">
                  Ενημερώθηκε: {new Date(relationship.updatedAt).toLocaleDateString('el-GR')}
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