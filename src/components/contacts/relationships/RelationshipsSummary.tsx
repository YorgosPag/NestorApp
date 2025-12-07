// ============================================================================
// RELATIONSHIPS SUMMARY COMPONENT
// ============================================================================
//
// 📊 Summary view of contact relationships for main tab display
// Shows key statistics, recent relationships, and management actions
//
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UnifiedDashboard, type DashboardStat } from '@/core/dashboards/UnifiedDashboard';
import {
  Users,
  Building2,
  UserCheck,
  TrendingUp,
  Eye,
  Settings,
  Plus,
  ChevronUp,
  ChevronDown,
  Briefcase,
  Calendar,
  Star,
  Target,
  Award,
  Zap
} from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types and hooks
import type { ContactType } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { useRelationshipContext } from './context/RelationshipProvider';
import { useOrganizationTree } from './hooks/useOrganizationTree';
import { OrganizationTree } from './OrganizationTree';
import { getRelationshipDisplayProps } from './utils/relationship-types';

// ============================================================================
// TYPES
// ============================================================================

interface RelationshipsSummaryProps {
  /** Contact ID for the relationship source */
  contactId: string;
  /** Type of contact */
  contactType: ContactType;
  /** Whether in read-only mode */
  readonly?: boolean;
  /** Callback when user wants to manage relationships */
  onManageRelationships?: () => void;
  /** Optional CSS class */
  className?: string;
}

/**
 * 📊 RelationshipsSummary Component
 *
 * Displays a summary of contact relationships in the main tab
 *
 * Features:
 * - Key statistics (total relationships, by type)
 * - Organization chart preview (for companies/services)
 * - Recent relationships preview
 * - Action buttons for management
 * - Responsive design
 */
export const RelationshipsSummary: React.FC<RelationshipsSummaryProps> = ({
  contactId,
  contactType,
  readonly = false,
  onManageRelationships,
  className
}) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const router = useRouter();

  const {
    relationships,
    loading: relationshipsLoading,
    error: relationshipsError,
    refreshRelationships
  } = useRelationshipContext();

  const {
    organizationTree,
    loading: treeLoading,
    error: treeError,
    shouldShowTree
  } = useOrganizationTree(contactId, contactType);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [showAllRelationships, setShowAllRelationships] = useState(false);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch contact names για relationships
  useEffect(() => {
    const fetchContactNames = async () => {
      if (relationships.length === 0) return;

      console.log('🔍 RELATIONSHIPS: Fetching contact names for relationships:', relationships.length);
      console.log('🔍 RELATIONSHIPS: Current contactId:', contactId);

      const names: Record<string, string> = {};

      // Φέρνω τα contact names για κάθε relationship
      for (const relationship of relationships) {
        // Για κάθε relationship, φέρνω το target contact (την άλλη επαφή)
        const targetContactId = relationship.targetContactId === contactId
          ? relationship.sourceContactId  // Αν είμαι target, φέρνω το source
          : relationship.targetContactId; // Αν είμαι source, φέρνω το target

        console.log('🔍 RELATIONSHIPS: Processing relationship:', {
          id: relationship.id,
          sourceId: relationship.sourceContactId,
          targetId: relationship.targetContactId,
          type: relationship.relationshipType,
          resolvedTargetId: targetContactId
        });

        if (!names[targetContactId]) {
          try {
            console.log('🔍 RELATIONSHIPS: Fetching contact for ID:', targetContactId);
            const contact = await ContactsService.getContact(targetContactId);
            if (contact) {
              console.log('🔍 RELATIONSHIPS: Contact object structure:', contact);

              // Try different name fields με προτεραιότητα στο πλήρες όνομα
              let contactName = 'Άγνωστη Επαφή';

              if (contact.name) {
                // Primary name field (πλήρες όνομα)
                contactName = contact.name;
              } else if (contact.firstName && contact.lastName) {
                // Συνδυασμός ονόματος και επωνύμου
                contactName = `${contact.firstName} ${contact.lastName}`;
              } else if (contact.companyName) {
                // Company name
                contactName = contact.companyName;
              } else if (contact.serviceName) {
                // Service name
                contactName = contact.serviceName;
              } else if (contact.firstName) {
                // Μόνο το όνομα αν δεν υπάρχει επώνυμο
                contactName = contact.firstName;
              }

              names[targetContactId] = contactName;
              console.log('✅ RELATIONSHIPS: Found contact:', contactName);
            } else {
              console.warn('⚠️ RELATIONSHIPS: Contact not found for ID:', targetContactId);
              names[targetContactId] = 'Άγνωστη Επαφή';
            }
          } catch (error) {
            console.error('❌ RELATIONSHIPS: Failed to fetch contact name:', targetContactId, error);
            names[targetContactId] = 'Άγνωστη Επαφή';
          }
        }
      }

      console.log('✅ RELATIONSHIPS: Final contact names:', names);
      setContactNames(names);
    };

    fetchContactNames();
  }, [relationships, contactId]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * 🔗 Handle click στη σχέση - μεταβαίνει στη λίστα επαφών με filter
   */
  const handleRelationshipClick = (relationship: any) => {
    // Βρίσκω το target contact ID (την επαφή που θα φιλτραριστεί)
    const targetContactId = relationship.targetContactId === contactId
      ? relationship.sourceContactId
      : relationship.targetContactId;

    const contactName = contactNames[targetContactId];

    console.log('🔗 NAVIGATION: Navigating to contacts with filter:', {
      targetContactId,
      contactName,
      relationshipType: relationship.relationshipType
    });

    // Μεταβαίνω στη λίστα επαφών με query parameter για filtering
    router.push(`/contacts?filter=${encodeURIComponent(contactName || targetContactId)}`);
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isNewContact = !contactId || contactId === 'new-contact';
  const hasRelationships = relationships.length > 0;
  const isLoading = relationshipsLoading || treeLoading;

  // Statistics calculation
  const stats = React.useMemo(() => {
    console.log('📊 RELATIONSHIPS STATS: Current relationships for contactId', contactId, ':', relationships);
    console.log('📊 RELATIONSHIPS TYPES:', relationships.map(r => ({ id: r.id, type: r.relationshipType, source: r.sourceContactId, target: r.targetContactId })));

    const relationshipsByType = relationships.reduce((acc, rel) => {
      acc[rel.relationshipType] = (acc[rel.relationshipType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 RELATIONSHIPS BY TYPE:', relationshipsByType);

    return {
      total: relationships.length,
      byType: relationshipsByType,
      mostCommon: Object.entries(relationshipsByType)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null
    };
  }, [relationships, contactId]);

  // Organization statistics
  const orgStats = React.useMemo(() => {
    // Calculate employees from actual relationships, not organizationTree
    const employees = relationships.filter(rel => rel.relationshipType === 'employee').length;

    if (!organizationTree) {
      return { employees, departments: 0, hierarchyLevels: 0 };
    }

    return {
      employees: Math.max(employees, organizationTree.totalEmployees || 0), // Use the higher count
      departments: organizationTree.departments?.length || 0,
      hierarchyLevels: organizationTree.hierarchyDepth || 0
    };
  }, [relationships, organizationTree]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🆕 Render new contact state
   */
  const renderNewContactState = () => (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="text-center text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-medium text-lg mb-2">Σχέσεις Επαφής</h3>
          <p className="text-sm mb-4">
            Οι σχέσεις θα είναι διαθέσιμες μετά την αποθήκευση της επαφής.
          </p>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600">
              💡 <strong>Συμβουλή:</strong> Αποθηκεύστε την επαφή για να προσθέσετε
              επαγγελματικές σχέσεις, εργαζόμενους και μετόχους.
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Σχέσεις Επαφής</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Φόρτωση σχέσεων...</p>
        </div>
      </CardContent>
    </Card>
  );

  /**
   * 📭 Render empty state
   */
  const renderEmptyState = () => (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Σχέσεις Επαφής</span>
          </div>
          {!readonly && onManageRelationships && (
            <Button
              onClick={onManageRelationships}
              size="sm"
              className="ml-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Προσθήκη
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-medium mb-2">Δεν υπάρχουν σχέσεις</h3>
          <p className="text-gray-500 text-sm mb-4">
            Προσθέστε επαγγελματικές σχέσεις, εργαζόμενους και συνεργάτες.
          </p>
          {!readonly && onManageRelationships && (
            <Button
              onClick={onManageRelationships}
              variant="outline"
              size="sm"
            >
              Ξεκινήστε εδώ
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  /**
   * 🎯 Handle dashboard card click - navigate to contacts with relationship filtering
   */
  const handleDashboardCardClick = (stat: DashboardStat, index: number) => {
    const cardTitle = stat.title;
    console.log('🎯 DASHBOARD CLICK: Relationship filtering for card:', cardTitle);

    // Get the contact names that have the specific relationship types
    const getContactNamesForFilter = () => {
      switch (cardTitle) {
        case 'Εργαζόμενοι':
          return relationships
            .filter(rel => rel.relationshipType === 'employee')
            .map(rel => {
              const targetContactId = rel.targetContactId === contactId ? rel.sourceContactId : rel.targetContactId;
              return contactNames[targetContactId];
            })
            .filter(Boolean);

        case 'Μέτοχοι/Εταίροι':
          return relationships
            .filter(rel => rel.relationshipType === 'shareholder')
            .map(rel => {
              const targetContactId = rel.targetContactId === contactId ? rel.sourceContactId : rel.targetContactId;
              return contactNames[targetContactId];
            })
            .filter(Boolean);

        case 'Σύμβουλοι':
          return relationships
            .filter(rel => rel.relationshipType === 'consultant')
            .map(rel => {
              const targetContactId = rel.targetContactId === contactId ? rel.sourceContactId : rel.targetContactId;
              return contactNames[targetContactId];
            })
            .filter(Boolean);

        case 'Διευθυντικά Στελέχη':
          // 🏢 Enhanced Management filtering - consistent με την calculation logic
          const managementTypes = ['director', 'manager', 'executive', 'ceo', 'chairman'];
          return relationships
            .filter(rel =>
              managementTypes.includes(rel.relationshipType) ||
              (rel.position && (
                rel.position.toLowerCase().includes('διευθυντής') ||
                rel.position.toLowerCase().includes('manager') ||
                rel.position.toLowerCase().includes('ceo') ||
                rel.position.toLowerCase().includes('cto') ||
                rel.position.toLowerCase().includes('γενικός διευθυντής') ||
                rel.position.toLowerCase().includes('ανώτερο στέλεχος')
              ))
            )
            .map(rel => {
              const targetContactId = rel.targetContactId === contactId ? rel.sourceContactId : rel.targetContactId;
              return contactNames[targetContactId];
            })
            .filter(Boolean);

        default:
          // For other cards, use generic relationship search
          return relationships
            .map(rel => {
              const targetContactId = rel.targetContactId === contactId ? rel.sourceContactId : rel.targetContactId;
              return contactNames[targetContactId];
            })
            .filter(Boolean);
      }
    };

    const relatedContactNames = getContactNamesForFilter();

    if (relatedContactNames.length > 0) {
      // Pick the first contact name for filtering (you could also use the relationship type itself)
      const searchTerm = relatedContactNames[0];
      router.push(`/contacts?filter=${encodeURIComponent(searchTerm)}`);
      console.log('🔗 NAVIGATION: Navigated to contacts with filter:', searchTerm, 'Related contacts:', relatedContactNames.length);
    } else {
      // Fallback to type-based search
      const relationshipFilters: Record<string, string> = {
        'Σύνολο Σχέσεων': 'σχέση',
        'Εργαζόμενοι': 'εργαζόμενος',
        'Μέτοχοι/Εταίροι': 'μέτοχος',
        'Συνεργάτες': 'συνεργάτης',
        'Διευθυντικά Στελέχη': 'διευθυντής',
        'Πρόσφατες Σχέσεις': 'πρόσφατη σχέση',
        'Κύριες Σχέσεις': 'κύρια σχέση',
        'Τμήματα': 'τμήμα'
      };

      const searchTerm = relationshipFilters[cardTitle] || cardTitle;
      router.push(`/contacts?filter=${encodeURIComponent(searchTerm)}`);
      console.log('🔗 NAVIGATION: Fallback to generic filter:', searchTerm);
    }
  };

  /**
   * 📊 Centralized Relationships Dashboard - Using UnifiedDashboard
   */
  const renderStatistics = () => {
    // Calculate enhanced statistics
    const employeesCount = stats.byType['employee'] || 0;
    const shareholdersCount = stats.byType['shareholder'] || 0;
    const advisorsCount = stats.byType['consultant'] || 0;
    // 🏢 Enhanced Management Count - Include all management types
    const managementRelationshipTypes = ['director', 'manager', 'executive', 'ceo', 'chairman'];
    const directManagementCount = relationships.filter(rel =>
      managementRelationshipTypes.includes(rel.relationshipType)
    ).length;

    // Additional management based on position field
    const positionBasedManagementCount = relationships.filter(rel =>
      rel.position && (
        rel.position.toLowerCase().includes('διευθυντής') ||
        rel.position.toLowerCase().includes('manager') ||
        rel.position.toLowerCase().includes('ceo') ||
        rel.position.toLowerCase().includes('cto') ||
        rel.position.toLowerCase().includes('γενικός διευθυντής') ||
        rel.position.toLowerCase().includes('ανώτερο στέλεχος')
      ) && !managementRelationshipTypes.includes(rel.relationshipType) // Avoid double counting
    ).length;

    const managementCount = directManagementCount + positionBasedManagementCount;

    console.log('🏢 MANAGEMENT STATS:', {
      directManagementCount,
      positionBasedManagementCount,
      totalManagementCount: managementCount,
      relationshipsByType: stats.byType,
      managementRelationships: relationships.filter(rel =>
        managementRelationshipTypes.includes(rel.relationshipType) ||
        (rel.position && (
          rel.position.toLowerCase().includes('διευθυντής') ||
          rel.position.toLowerCase().includes('manager') ||
          rel.position.toLowerCase().includes('ceo')
        ))
      ).map(r => ({ type: r.relationshipType, position: r.position }))
    });

    const recentRelationshipsCount = relationships.filter(rel => {
      if (!rel.createdAt) return false;
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return new Date(rel.createdAt) > oneMonthAgo;
    }).length;

    const keyRelationshipsCount = relationships.filter(rel =>
      rel.relationshipType === 'employee' ||
      rel.relationshipType === 'shareholder' ||
      rel.relationshipType === 'partner'
    ).length;

    const departmentsCount = new Set(
      relationships
        .filter(rel => rel.department)
        .map(rel => rel.department)
    ).size;

    // 🏢 Create centralized dashboard stats array
    const relationshipDashboardStats: DashboardStat[] = [
      // 🔝 Πάνω σειρά (4 κάρτες) - Βασικά Στοιχεία
      {
        title: "Σύνολο Σχέσεων",
        value: stats.total,
        icon: Users,
        color: "blue"
      },
      {
        title: "Εργαζόμενοι",
        value: employeesCount,
        icon: Briefcase,
        color: "green"
      },
      {
        title: "Μέτοχοι/Εταίροι",
        value: shareholdersCount,
        icon: Award,
        color: "purple"
      },
      {
        title: "Σύμβουλοι",
        value: advisorsCount,
        icon: Zap,
        color: "orange"
      },

      // 🔽 Κάτω σειρά (4 κάρτες) - Λεπτομέρειες
      {
        title: "Διευθυντικά Στελέχη",
        value: managementCount,
        icon: UserCheck,
        color: "indigo"
      },
      {
        title: "Πρόσφατες Σχέσεις",
        value: recentRelationshipsCount,
        icon: Calendar,
        color: "pink"
      },
      {
        title: "Κύριες Σχέσεις",
        value: keyRelationshipsCount,
        icon: Star,
        color: "yellow"
      },
      {
        title: "Τμήματα",
        value: departmentsCount,
        icon: Target,
        color: "cyan"
      }
    ];

    // 🎯 Use centralized UnifiedDashboard component with click functionality
    return (
      <div className="mb-6">
        <UnifiedDashboard
          stats={relationshipDashboardStats}
          columns={4}
          className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg"
          onCardClick={handleDashboardCardClick}
        />
      </div>
    );
  };

  /**
   * 🔍 Render recent relationships preview
   */
  const renderRecentRelationships = () => {
    // Show 3 relationships initially, all when expanded
    const recentRelationships = showAllRelationships
      ? relationships
      : relationships.slice(0, 3);

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Πρόσφατες Σχέσεις</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentRelationships.map((relationship) => {
              const displayProps = getRelationshipDisplayProps(relationship.relationshipType);
              const Icon = displayProps.icon;

              // Get το contact name για αυτή τη σχέση
              const targetContactId = relationship.targetContactId === contactId
                ? relationship.sourceContactId
                : relationship.targetContactId;
              const contactName = contactNames[targetContactId];

              return (
                <div
                  key={relationship.id}
                  onClick={() => handleRelationshipClick(relationship)}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5 text-gray-600" />
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
                    {relationship.createdAt ?
                      new Date(relationship.createdAt).toLocaleDateString('el-GR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) :
                      'Πρόσφατα'
                    }
                  </div>
                </div>
              );
            })}

            {relationships.length > 3 && (
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
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * 🎛️ Render action buttons
   */
  const renderActions = () => (
    <div className="flex justify-center space-x-3">
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

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Handle different states
  if (isNewContact) {
    return renderNewContactState();
  }

  if (isLoading) {
    return renderLoadingState();
  }

  if (!hasRelationships) {
    return renderEmptyState();
  }

  // Main summary view with data
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Σχέσεις Επαφής</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={refreshRelationships}
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                disabled={relationshipsLoading}
                title="🔄 DEBUG: Ανανέωση σχέσεων (Κρυφό για testing)"
              >
                🔄
              </Button>
              {!readonly && onManageRelationships && (
                <Button
                  onClick={onManageRelationships}
                  size="sm"
                  variant="outline"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Διαχείριση
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          {renderStatistics()}

          {/* Organization Tree (για companies/services) */}
          {shouldShowTree && (
            <div className="mt-6 mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h4 className="text-sm font-medium text-gray-900">Οργανωτικό Διάγραμμα</h4>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <OrganizationTree
                  tree={organizationTree}
                  loading={treeLoading}
                  error={treeError}
                  readonly={readonly}
                />
              </div>
            </div>
          )}

          {/* Recent relationships */}
          {renderRecentRelationships()}

          {/* Action buttons */}
          {renderActions()}
        </CardContent>
      </Card>
    </div>
  );
};

export default RelationshipsSummary;