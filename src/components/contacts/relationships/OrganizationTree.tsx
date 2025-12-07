// ============================================================================
// ORGANIZATION TREE COMPONENT
// ============================================================================
//
// 🌳 Component for displaying organization hierarchy tree
// Extracted from ContactRelationshipManager for better modularity
//
// ============================================================================

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types
import type { OrganizationTree as OrganizationTreeType } from '@/types/contacts/relationships';

// 🪝 Import contact name hook
import { useContactName } from './hooks/useContactName';

// 🏢 ENTERPRISE: Helper component for contact badge
interface ContactBadgeProps {
  contactId: string;
  position?: string;
  relationshipType?: string;
}

const ContactBadge: React.FC<ContactBadgeProps> = ({ contactId, position, relationshipType }) => {
  const { contactName, loading } = useContactName(contactId);

  if (loading) {
    return (
      <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-500">
        Φόρτωση...
      </Badge>
    );
  }

  // Display contact name with position if available
  const displayText = contactName && contactName !== 'Άγνωστη Επαφή'
    ? (position ? `${contactName} (${position})` : contactName)
    : (position || relationshipType || 'Εργαζόμενος');

  return (
    <Badge
      variant="outline"
      className="text-xs bg-blue-50 border-blue-200 text-blue-700"
    >
      {displayText}
    </Badge>
  );
};

// 🏢 ENTERPRISE: Component props interface
interface OrganizationTreeProps {
  /** The organization tree data */
  tree: OrganizationTreeType | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Read-only mode */
  readonly?: boolean;
}

/**
 * 🌳 OrganizationTree Component
 *
 * Displays organization hierarchy with statistics and department breakdown
 *
 * Features:
 * - Organization statistics display
 * - Department breakdown
 * - Hierarchy depth visualization
 * - Recent additions preview
 * - Loading and error states
 */
export const OrganizationTree: React.FC<OrganizationTreeProps> = ({
  tree,
  loading,
  error,
  readonly = false
}) => {
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * ⏳ Render loading state
   */
  const renderLoadingState = () => (
    <div className="text-center text-gray-500 py-8">
      <Building2 className="h-8 w-8 mx-auto mb-2 animate-pulse" />
      <p>Φόρτωση οργανωτικού διαγράμματος...</p>
    </div>
  );

  /**
   * ❌ Render error state
   */
  const renderErrorState = () => (
    <div className="text-center text-red-600 py-8">
      <Building2 className="h-8 w-8 mx-auto mb-2" />
      <p className="font-medium">Σφάλμα φόρτωσης</p>
      <p className="text-sm text-gray-600 mt-1">{error}</p>
    </div>
  );

  /**
   * 📭 Render empty state
   */
  const renderEmptyState = () => (
    <div className="text-center text-gray-500 py-8">
      <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
      <p className="font-medium">Κενό οργανωτικό διάγραμμα</p>
      <p className="text-sm mt-1">
        Δεν υπάρχουν σχέσεις εργαζομένων για αυτόν τον οργανισμό.
      </p>
    </div>
  );

  /**
   * 🏗️ Render organization statistics - ADAPTIVE & USER-FRIENDLY
   */
  const renderStatistics = () => {
    if (!tree?.statistics) return null;

    const { totalEmployees, hierarchyDepth, departmentCount } = tree.statistics;

    // Only show statistics that have meaningful values > 0
    const stats = [];

    if ((totalEmployees || 0) > 0) {
      stats.push({
        value: totalEmployees,
        label: 'Συνολικοί Εργαζόμενοι',
        icon: Users,
        color: 'blue'
      });
    }

    if ((departmentCount || 0) > 0) {
      stats.push({
        value: departmentCount,
        label: 'Ενεργά Τμήματα',
        icon: Building2,
        color: 'green'
      });
    }

    if ((hierarchyDepth || 0) > 1) { // Only show if > 1 (meaningful hierarchy)
      stats.push({
        value: hierarchyDepth,
        label: 'Επίπεδα Διοίκησης',
        icon: Building2,
        color: 'purple'
      });
    }

    // If no meaningful stats, show user-friendly message
    if (stats.length === 0) {
      return (
        <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Building2 className="h-8 w-8 mx-auto mb-3 text-gray-400" />
          <h3 className="font-medium text-gray-700 mb-1">Απλό Οργανωτικό Σχήμα</h3>
          <p className="text-sm text-gray-500">
            Αυτή η εταιρεία έχει βασική οργανωσιακή δομή χωρίς πολύπλοκη ιεραρχία.
          </p>
        </div>
      );
    }

    // Render only meaningful statistics
    return (
      <div className={`grid grid-cols-1 ${stats.length > 1 ? 'md:grid-cols-' + Math.min(stats.length, 3) : ''} gap-4 mb-6`}>
        {stats.map(({ value, label, icon: Icon, color }, index) => (
          <div key={index} className={`text-center p-4 bg-${color}-50 rounded-lg`}>
            <Icon className={`h-6 w-6 mx-auto mb-2 text-${color}-600`} />
            <p className={`text-2xl font-bold text-${color}-800`}>{value}</p>
            <p className={`text-sm text-${color}-600`}>{label}</p>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 🏢 Render departments breakdown
   */
  const renderDepartments = () => {
    if (!tree?.departments || Object.keys(tree.departments).length === 0) {
      return null;
    }

    return (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Τμήματα & Εργαζόμενοι</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(tree.departments).map(([department, employees]) => (
            <div
              key={department}
              className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-800">
                  {department || 'Γενικό Τμήμα'}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {Array.isArray(employees) ? employees.length : 0}
                </Badge>
              </div>

              {Array.isArray(employees) && employees.length > 0 && (
                <div className="space-y-1">
                  {employees.slice(0, 3).map((employee, index) => (
                    <p key={index} className="text-xs text-gray-600">
                      • {employee.position || 'Εργαζόμενος'}
                    </p>
                  ))}
                  {employees.length > 3 && (
                    <p className="text-xs text-gray-500 italic">
                      +{employees.length - 3} επιπλέον...
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 👥 Render recent additions
   */
  const renderRecentAdditions = () => {
    if (!tree?.children || tree.children.length === 0) {
      return null;
    }

    return (
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Πρόσφατες Προσθήκες</h4>
        <div className="flex flex-wrap gap-2">
          {tree.children.slice(0, 8).map((child, index) => (
            <ContactBadge
              key={child.id || index}
              contactId={child.id}
              position={child.position}
              relationshipType={child.relationshipType}
            />
          ))}
          {tree.children.length > 8 && (
            <Badge variant="outline" className="text-xs text-gray-500">
              +{tree.children.length - 8} επιπλέον
            </Badge>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Handle loading state
  if (loading) {
    return renderLoadingState();
  }

  // Handle error state
  if (error) {
    return renderErrorState();
  }

  // Handle empty/null tree
  if (!tree) {
    return renderEmptyState();
  }

  return (
    <div className="space-y-6">
      {/* Organization Statistics */}
      {renderStatistics()}

      {/* Departments Breakdown */}
      {renderDepartments()}

      {/* Recent Additions */}
      {renderRecentAdditions()}

      {/* Additional Info */}
      {tree.statistics && (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-4">
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                <strong>Τελευταία ενημέρωση:</strong>{' '}
                {tree.updatedAt
                  ? new Date(tree.updatedAt).toLocaleDateString('el-GR')
                  : 'Άγνωστη'
                }
              </p>
              <p>
                <strong>Δημιουργήθηκε:</strong>{' '}
                {tree.createdAt
                  ? new Date(tree.createdAt).toLocaleDateString('el-GR')
                  : 'Άγνωστη'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrganizationTree;