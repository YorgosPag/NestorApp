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
import '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Users, Plus, RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
// 🛡️ ENTERPRISE: Auto-save guard for pending relationship data
import { PendingRelationshipGuard } from '@/utils/pending-relationship-guard';

// 🏢 ENTERPRISE: Import centralized types
import type { ContactRelationship } from '@/types/contacts/relationships';

// 🏢 ENTERPRISE: Import modular components
import { RelationshipForm } from './RelationshipForm';
import { RelationshipList } from './RelationshipList';
import { OrganizationTree } from './OrganizationTree';

// 🏢 ENTERPRISE: Import custom hooks for state management
import { useRelationshipContext } from './context/RelationshipProvider';
import { useRelationshipForm } from './hooks/useRelationshipForm';
import { useOrganizationTree } from './hooks/useOrganizationTree';
import { getRelationshipGovernanceInfo } from '@/services/contact-relationships/core/relationship-governance';
import { syncWorkAddressOnRelationship } from '@/services/contact-relationships/work-address-sync.service';

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

const logger = createModuleLogger('ContactRelationshipManager');

export const ContactRelationshipManager: React.FC<ContactRelationshipManagerProps> = ({
  contactId,
  contactType,
  readonly = false
}) => {
  // ============================================================================
  // HOOK INTEGRATIONS
  // ============================================================================

  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const { confirm, dialogProps } = useConfirmDialog();

  // 📋 Relationship list management hook
  const {
    relationships,
    loading: listLoading,
    error: listError,
    expandedRelationships,
    toggleExpanded: handleToggleExpanded,
    deleteRelationship,
    terminateRelationship,
    refreshRelationships
  } = useRelationshipContext();

  // 🌳 Organization tree management hook (for companies/services)
  const {
    organizationTree,
    loading: treeLoading,
    error: treeError,
    refreshTree,
    shouldShowTree
  } = useOrganizationTree(contactId, contactType);

  // 🔄 Global refresh callback that updates both relationships and organization tree
  // 🔧 FIX: Simplified — removed stale-closure retry logic that used relationships.length
  const handleGlobalRefresh = React.useCallback(async () => {
    try {
      // Clear organization tree cache if it exists
      if (shouldShowTree && typeof window !== 'undefined' && window.localStorage) {
        const orgCacheKeys = Object.keys(window.localStorage).filter(key =>
          key.includes('organization:') && key.includes(contactId)
        );
        orgCacheKeys.forEach(key => window.localStorage.removeItem(key));
      }

      // Refresh relationships and organization tree in parallel
      await Promise.all([
        refreshRelationships(),
        shouldShowTree ? refreshTree() : Promise.resolve()
      ]);
    } catch (err) {
      logger.error('Global refresh failed:', { error: err });
    }
  }, [refreshRelationships, refreshTree, shouldShowTree, contactId]);

  // 📝 Relationship form management hook
  // 🔧 FIX: After successful save → hide form + quiet refresh (no full page re-render)
  const handleAfterSave = React.useCallback(async () => {
    // 🔧 FIX: Clear guard IMMEDIATELY — prevents race condition where user clicks
    // main "Save" before React re-renders and guard re-submits with stale formData
    PendingRelationshipGuard.setHasPendingData(false);
    setShowFormCard(false);
    // Quiet refresh — only update the relationship list, without causing parent re-renders
    try {
      await refreshRelationships();
    } catch (err) {
      logger.error('Post-save refresh failed:', { error: err });
    }
  }, [refreshRelationships]);

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
  } = useRelationshipForm(contactId, contactType, handleAfterSave);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isNewContact = !contactId || contactId === 'new-contact';
  const showForm = !readonly && !isNewContact;
  const anyLoading = listLoading || formLoading || treeLoading;
  const hasAnyError = listError || formError || treeError;
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  // 🔁 Retroactive work-address sync (ADR-318): heals data for relationships created
  // before the on-save sync existed. Idempotent — sync is a no-op if up-to-date.
  React.useEffect(() => {
    if (!relationships || relationships.length === 0) return;
    relationships.forEach(rel => {
      syncWorkAddressOnRelationship(rel).catch(err =>
        logger.warn('Retro work-address sync failed (non-critical)', { error: err })
      );
    });
  }, [relationships]);

  // 🏢 ENTERPRISE: Compute used relationship types for the selected target contact
  // Prevents duplicate selections by filtering out already-used types from the dropdown
  const usedRelationshipTypes = React.useMemo(() => {
    const targetId = formData.targetContactId;
    if (!targetId) return [];

    return relationships
      .filter(rel =>
        // Match relationships involving the target contact
        (rel.sourceContactId === targetId || rel.targetContactId === targetId) &&
        // Exclude the relationship being edited (so its type remains selectable)
        rel.id !== editingId
      )
      .map(rel => rel.relationshipType);
  }, [relationships, formData.targetContactId, editingId]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================


  /**
   * 📝 Handle form show/hide state
   */
  const [showFormCard, setShowFormCard] = React.useState(false);

  const handleShowForm = () => {
    setActionMessage(null);
    setShowFormCard(true);
  };
  const handleHideForm = () => {
    setShowFormCard(false);
    handleCancel();
  };

  const buildImpactMessages = React.useCallback((relationship: ContactRelationship): string[] => {
    const governance = getRelationshipGovernanceInfo(relationship);
    const messages: string[] = [];

    if (governance.isProtectedRole) messages.push(t('relationships.governance.impact.protectedRole'));
    if (governance.affectsHierarchy) messages.push(t('relationships.governance.impact.hierarchy'));
    if (governance.affectsReciprocal) messages.push(t('relationships.governance.impact.reciprocal'));

    return messages;
  }, [t]);

  const handleRelationshipRemoval = React.useCallback(async (relationship: ContactRelationship) => {
    const governance = getRelationshipGovernanceInfo(relationship);
    const impactMessages = buildImpactMessages(relationship);
    const description = impactMessages.length > 0 ? (
      <div className="space-y-3">
        <p>{governance.requiresTermination ? t('relationships.governance.confirmTerminateBody') : t('relationships.governance.confirmDeleteBody')}</p>
        <ul className="list-disc pl-5 space-y-1">
          {impactMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    ) : (
      governance.requiresTermination
        ? t('relationships.governance.confirmTerminateBody')
        : t('relationships.governance.confirmDeleteBody')
    );

    try {
      if (governance.requiresTermination) {
        const shouldTerminate = await confirm({
          title: t('relationships.governance.confirmTerminateTitle'),
          description,
          variant: 'warning',
        });
        if (!shouldTerminate) return;
        await terminateRelationship(relationship.id);
        setActionMessage(t('relationships.status.terminateSuccess'));
        return;
      }

      const shouldDelete = await confirm({
        title: t('relationships.governance.confirmDeleteTitle'),
        description,
        variant: 'destructive',
      });
      if (!shouldDelete) return;
      await deleteRelationship(relationship.id);
      setActionMessage(t('relationships.status.deleteSuccess'));
    } catch (err) {
      logger.error('Relationship removal flow failed:', { error: err });
    }
  }, [buildImpactMessages, confirm, deleteRelationship, terminateRelationship, t]);

  /**
   * ✏️ Handle edit relationship (show form with data)
   */
  const handleEditRelationship = (relationship: ContactRelationship) => {
    handleEdit(relationship); // Load data into form
    setShowFormCard(true);     // Show the form
  };

  // 🛡️ ENTERPRISE: Register pending relationship guard for auto-save
  React.useEffect(() => {
    PendingRelationshipGuard.register(handleSubmit);
    return () => {
      PendingRelationshipGuard.unregister();
    };
  }, [handleSubmit]);

  // 🛡️ Track dirty state — form is ready to submit ONLY when both contact AND type are set
  React.useEffect(() => {
    const hasPending = showFormCard && !!formData.targetContactId && !!formData.relationshipType;
    PendingRelationshipGuard.setHasPendingData(hasPending);
  }, [showFormCard, formData.targetContactId, formData.relationshipType]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 📊 Render header with statistics and actions
   */
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-2">
        <Users className={`${iconSizes.lg} ${colors.text.muted}`} />
        <div>
          <h3 className="text-lg font-medium">{t('relationships.summary.title')}</h3>
          {!isNewContact && (
            <p className={`text-sm ${colors.text.muted}`}>
              {t('relationships.manager.totalCount', { count: relationships.length })}
            </p>
          )}
        </div>
      </div>

      {!readonly && !isNewContact && (
        <div className="flex space-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGlobalRefresh}
                disabled={anyLoading}
              >
                <RefreshCw className={`${iconSizes.sm} ${anyLoading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('relationships.manager.refreshData')}</TooltipContent>
          </Tooltip>

          {!showFormCard && (
            <Button
              onClick={handleShowForm}
              disabled={anyLoading}
              size="sm"
            >
              <Plus className={`${iconSizes.sm} mr-2`} />
              {t('relationships.manager.addRelationship')}
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
            <AlertCircle className={iconSizes.sm} />
            <AlertDescription>
              {t(listError, { defaultValue: t('relationships.manager.errors.listError') })}
            </AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive">
            <AlertCircle className={iconSizes.sm} />
            <AlertDescription>
              {t(formError, { defaultValue: formError })}
            </AlertDescription>
          </Alert>
        )}

        {treeError && (
          <Alert variant="destructive">
            <AlertCircle className={iconSizes.sm} />
            <AlertDescription>
              {t(treeError, { defaultValue: t('relationships.manager.errors.treeError') })}
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
    if (!successMessage && !actionMessage) return null;

    return (
      <Alert className={`mb-6 ${getStatusBorder('success')} ${colors.bg.success}`}>
        <AlertCircle className={`${iconSizes.sm} ${colors.text.success}`} />
        <AlertDescription className={`${colors.text.success}`}>
          {successMessage || actionMessage}
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
            currentContactId={contactId}
            loading={formLoading}
            error={formError}
            editingId={editingId}
            usedRelationshipTypes={usedRelationshipTypes}
            onSubmit={handleSubmit}
            onCancel={handleHideForm}
          />
        )}

        {/* Organization Tree (for companies/services only) */}
        {shouldShowTree && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className={iconSizes.md} />
                <span>{t('relationships.summary.organizationChart')}</span>
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
          onDelete={handleRelationshipRemoval}
        />

        {/* Footer note for new contacts */}
        {isNewContact && (
          <Card className={`${getStatusBorder('info')} ${colors.bg.info}`}>
            <CardContent className="pt-6">
              <div className={`text-center ${colors.text.info}`}>
                <p className="font-medium">💡 {t('relationships.manager.newContact.note')}</p>
                <p className="text-sm mt-2">
                  {t('relationships.manager.newContact.description')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <ConfirmDialog {...dialogProps} />
      </div>
  );
};

export default ContactRelationshipManager;