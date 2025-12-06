// ============================================================================
// CONTACT RELATIONSHIP MANAGER - ENTERPRISE ORCHESTRATOR
// ============================================================================
//
// 🎯 Main orchestrator component for managing contact relationships
// Refactored from 825-line monolith into modular Enterprise architecture
//
// Architecture:
// - Uses custom hooks for state management and API operations
// - Imports modular UI components for clean separation of concerns
// - Centralized error handling and loading states
// - Responsive design with optimized performance
//
// ============================================================================

'use client';

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Users, Plus, RefreshCw } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types
import type { ContactType } from '@/types/contacts';
import type { ContactRelationship } from '@/types/contacts/relationships';

// 🏢 ENTERPRISE: Import modular components
import { RelationshipForm } from './RelationshipForm';
import { RelationshipList } from './RelationshipList';
import { OrganizationTree } from './OrganizationTree';

// 🏢 ENTERPRISE: Import custom hooks for state management
import { useRelationshipList } from './hooks/useRelationshipList';
import { useRelationshipForm } from './hooks/useRelationshipForm';
import { useOrganizationTree } from './hooks/useOrganizationTree';

// 🏢 ENTERPRISE: Import types
import type { ContactRelationshipManagerProps } from './types/relationship-manager.types';

/**
 * 🎯 ContactRelationshipManager - Enterprise Orchestrator Component
 *
 * Main controller component that orchestrates relationship management functionality
 *
 * Features:
 * - Modular architecture with separation of concerns
 * - Integrated form and list management
 * - Organization hierarchy tree (for companies/services)
 * - Comprehensive error handling and loading states
 * - Responsive design with optimized performance
 * - Real-time data synchronization
 *
 * @param contactId - The ID of the contact to manage relationships for
 * @param contactType - The type of contact (individual, company, service)
 * @param readonly - Whether the component should be in read-only mode
 */

export const ContactRelationshipManager: React.FC<ContactRelationshipManagerProps> = ({
  contactId,
  contactType,
  readonly = false
}) => {
  // ============================================================================
  // HOOK INTEGRATIONS
  // ============================================================================

  // 📋 Relationship list management hook
  const {
    relationships,
    loading: listLoading,
    error: listError,
    expandedRelationships,
    handleToggleExpanded,
    handleDelete,
    refreshRelationships
  } = useRelationshipList(contactId, contactType);

  // 📝 Relationship form management hook
  const {
    formData,
    setFormData,
    loading: formLoading,
    error: formError,
    editingId,
    successMessage,
    handleSubmit,
    handleEdit,
    handleCancel
  } = useRelationshipForm(contactId, contactType, refreshRelationships);

  // 🌳 Organization tree management hook (for companies/services)
  const {
    organizationTree,
    loading: treeLoading,
    error: treeError,
    refreshTree,
    shouldShowTree
  } = useOrganizationTree(contactId, contactType);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isNewContact = !contactId || contactId === 'new-contact';
  const showForm = !readonly && !isNewContact;
  const anyLoading = listLoading || formLoading || treeLoading;
  const hasAnyError = listError || formError || treeError;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * 🔄 Handle global refresh of all relationship data
   */
  const handleGlobalRefresh = async () => {
    try {
      // Refresh relationships and organization tree in parallel
      await Promise.all([
        refreshRelationships(),
        shouldShowTree ? refreshTree() : Promise.resolve()
      ]);
    } catch (err) {
      console.error('❌ Error refreshing relationship data:', err);
    }
  };

  /**
   * 📝 Handle form show/hide state
   */
  const [showFormCard, setShowFormCard] = React.useState(false);

  const handleShowForm = () => setShowFormCard(true);
  const handleHideForm = () => {
    setShowFormCard(false);
    handleCancel();
  };

  /**
   * ✏️ Handle edit relationship (show form with data)
   */
  const handleEditRelationship = (relationship: ContactRelationship) => {
    handleEdit(relationship); // Load data into form
    setShowFormCard(true);     // Show the form
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 📊 Render header with statistics and actions
   */
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-3">
        <Users className="h-6 w-6 text-gray-600" />
        <div>
          <h3 className="text-lg font-medium">Σχέσεις Επαφής</h3>
          {!isNewContact && (
            <p className="text-sm text-gray-500">
              Σύνολο: {relationships.length} σχέσεις
            </p>
          )}
        </div>
      </div>

      {!readonly && !isNewContact && (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGlobalRefresh}
            disabled={anyLoading}
            title="Ανανέωση δεδομένων"
          >
            <RefreshCw className={`h-4 w-4 ${anyLoading ? 'animate-spin' : ''}`} />
          </Button>

          {!showFormCard && (
            <Button
              onClick={handleShowForm}
              disabled={anyLoading}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Προσθήκη Σχέσης
            </Button>
          )}
        </div>
      )}
    </div>
  );

  /**
   * ⚠️ Render error alerts
   */
  const renderErrors = () => {
    if (!hasAnyError) return null;

    return (
      <div className="space-y-3 mb-6">
        {listError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Σφάλμα λίστας σχέσεων:</strong> {listError}
            </AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Σφάλμα φόρμας:</strong> {formError}
            </AlertDescription>
          </Alert>
        )}

        {treeError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Σφάλμα οργανωσιακού διαγράμματος:</strong> {treeError}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  /**
   * ✅ Render success messages
   */
  const renderSuccess = () => {
    if (!successMessage) return null;

    return (
      <Alert className="mb-6 border-green-200 bg-green-50">
        <AlertCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-700">
          {successMessage}
        </AlertDescription>
      </Alert>
    );
  };


  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header with title and actions */}
      {renderHeader()}

      {/* Error alerts */}
      {renderErrors()}

      {/* Success messages */}
      {renderSuccess()}

      {/* Relationship Form (conditionally shown) */}
      {showForm && showFormCard && (
        <RelationshipForm
          formData={formData}
          setFormData={setFormData}
          contactType={contactType}
          loading={formLoading}
          error={formError}
          editingId={editingId}
          onSubmit={handleSubmit}
          onCancel={handleHideForm}
        />
      )}

      {/* Organization Tree (for companies/services only) */}
      {shouldShowTree && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Οργανωτικό Διάγραμμα</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrganizationTree
              tree={organizationTree}
              loading={treeLoading}
              error={treeError}
              readonly={readonly}
            />
          </CardContent>
        </Card>
      )}

      {/* Relationship List */}
      <RelationshipList
        relationships={relationships}
        contactType={contactType}
        loading={listLoading}
        contactId={contactId}
        readonly={readonly}
        expandedRelationships={expandedRelationships}
        onToggleExpanded={handleToggleExpanded}
        onEdit={handleEditRelationship}
        onDelete={handleDelete}
      />

      {/* Footer note for new contacts */}
      {isNewContact && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-center text-blue-700">
              <p className="font-medium">💡 Σημείωση</p>
              <p className="text-sm mt-2">
                Για να δημιουργήσετε σχέσεις, αποθηκεύστε πρώτα την επαφή.
                Μετά την αποθήκευση θα εμφανιστούν οι επιλογές διαχείρισης σχέσεων.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContactRelationshipManager;