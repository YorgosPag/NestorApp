/**
 * Removes confirmed-dead TypeScript type declarations using ts-morph.
 * Only removes types verified to have zero external usage (from check-dead-types.mjs output).
 */

import { Project, SyntaxKind } from 'ts-morph';

// Map of file → array of type names to remove
// Source: check-dead-types.mjs output, grep-verified zero external usage
const DEAD_TYPES = {
  'src/components/admin/role-management/types.ts': ['ChangeStatusResponse', 'ProjectMemberAction'],
  'src/components/generic/UniversalTabsRenderer.tsx': ['PropertyComponentMapping', 'BuildingComponentMapping', 'StorageComponentMapping', 'ParkingComponentMapping'],
  'src/components/obligations/structure-editor/types.ts': ['UpdateSection', 'UpdateArticle', 'UpdateParagraph'],
  'src/components/projects/general-tab/types.ts': ['UseAutosaveState'],
  'src/components/projects/ika/components/WorkerPin.tsx': ['WorkerMarkerStatus'],
  'src/components/projects/ika/contracts.ts': ['ApdPeriod'],
  'src/components/properties/page/PropertiesHeader.tsx': ['UnitsViewMode'],
  'src/components/properties/tabs/PropertyCustomerTab.tsx': ['UnitCustomerTabProps'],
  'src/components/ui/ProductTour/ProductTour.types.ts': ['TourCSSVariables'],
  'src/components/ui/resizable.tsx': ['PanelImperativeHandle'],
  'src/components/ui/theme/ThemeComponents.tsx': ['ContainerType', 'TabTheme'],
  'src/config/address-map-config.ts': ['AddressMapConfig'],
  'src/config/ai-analysis-config.ts': ['AIProviderId', 'AiModelId'],
  'src/config/auto-save-config.ts': ['AutoSaveTiming'],
  'src/config/firestore-collections.ts': ['SubcollectionKey', 'SystemDocKey'],
  'src/config/firestore-schema-map.ts': ['CollectionFieldSchema'],
  'src/config/notification-keys.ts': ['NotificationKey'],
  'src/constants/building-statuses.ts': ['ActiveBuildingStatus', 'InConstructionBuildingStatus'],
  'src/constants/building-types.ts': ['NonResidentialBuildingType'],
  'src/constants/commercial-statuses.ts': ['FinalizedCommercialStatus'],
  'src/constants/domains/dropdown-misc-labels.ts': ['OperationalStatusValue'],
  'src/constants/energy-classes.ts': ['HighEfficiencyEnergyClass'],
  'src/constants/legal-phases.ts': ['PendingLegalPhase', 'SignedLegalPhase'],
  'src/constants/operational-statuses.ts': ['InProgressOperationalStatus'],
  'src/constants/project-statuses.ts': ['ActiveProjectStatus', 'InProgressProjectStatus'],
  'src/constants/property-features-enterprise.ts': ['OperationalStatusType', 'LocationTagType'],
  'src/constants/property-types.ts': ['CommercialPropertyType'],
  'src/constants/renovation-statuses.ts': ['CompletedRenovationStatus'],
  'src/database/migrations/types.ts': ['DataIntegrityCheck'],
  'src/features/floorplan-canvas/types.ts': ['FloorPlanCanvasProps'],
  'src/features/property-details/types.ts': ['AttachmentsData'],
  'src/hooks/useSemanticColors.ts': ['SemanticColorName'],
  'src/lib/auth/types.ts': ['CompanyMemberDocument'],
  'src/lib/pagination.ts': ['DocumentMapper', 'PaginationOptions', 'PaginationState'],
  'src/lib/share-utils.ts': ['LeadShareData'],
  'src/schemas/ai-analysis.ts': ['DocumentTypeValue', 'ExtractedEntities', 'DetectedIntentResult'],
  'src/server/comms/orchestrator.ts': ['ChannelMetadata'],
  'src/server/types/conversations.firestore.ts': ['LegacyCommunicationDocument'],
  'src/services/ai-analysis/providers/IAIAnalysisProvider.ts': ['ProviderFactory'],
  'src/services/ai-pipeline/tools/agentic-tool-definitions.ts': ['ActivityOperation', 'POToolOperation'],
  'src/services/cad-file-mutation-gateway.ts': ['CadFileMetadataLookup'],
  'src/services/calendar/contracts.ts': ['ICalendarEventService'],
  'src/services/crm/tasks/contracts.ts': ['ITasksService'],
  'src/services/email-templates/building-showcase-email.ts': ['BuildBuildingShowcaseEmailParams', 'BuiltBuildingShowcaseEmail'],
  'src/services/email-templates/project-showcase-email.ts': ['BuildProjectShowcaseEmailParams', 'BuiltProjectShowcaseEmail'],
  'src/services/file-audit.service.ts': ['FileAuditQuery'],
  'src/services/navigation/ContextualNavigationService.ts': ['ContextualRoute'],
  'src/services/pdf/contracts.ts': ['PDFSection'],
  'src/services/projects/contracts.ts': ['IProjectsRepository', 'IProjectsService'],
  'src/services/property-search.service.ts': ['UnifiedSearchResult', 'PropertySearchResult'],
  'src/services/two-factor/two-factor.types.ts': ['StartEnrollmentInput', 'CompleteEnrollmentInput'],
  'src/subapps/accounting/services/bank/bank-match-validation.ts': ['MatchRequestInput', 'ReconcileInput', 'AdminUnlockInput'],
  'src/subapps/geo-canvas/cloud/enterprise/types/networking.ts': ['CacheBehavior', 'WAFCondition'],
  'src/subapps/geo-canvas/cloud/enterprise/types/status.ts': ['InfrastructureStatusOriginal'],
  'src/subapps/geo-canvas/config/color-config.ts': ['GeoColorConfig', 'PolygonColorKey', 'SnapColorKey', 'MonitoringColorKey'],
  'src/subapps/geo-canvas/systems/polygon-system/utils/legacy-migration.ts': ['LegacySourceData'],
  'src/subapps/geo-canvas/ui/design-system/search/SearchSystem.styles.ts': ['SearchSystemStylesType'],
  'src/types/assignment-policy.ts': ['PolicyResolutionResult', 'CreateAssignmentPolicyInput', 'UpdateAssignmentPolicyInput', 'AssignmentPolicyQuery'],
  'src/types/associations.ts': ['EntityLinkFirestoreDoc', 'CreateEntityLinkInput', 'ListEntityLinksParams'],
  'src/types/audit-trail.ts': ['EntityAuditQueryOptions'],
  'src/types/building/construction.ts': ['ResourceAssignmentSummary', 'ConstructionDataResponse'],
  'src/types/building/features.ts': ['BuildingFeatureDefinition'],
  'src/types/common/date-types.ts': ['DateFormatOptions', 'DateValidationResult', 'RelationshipDate', 'EventDate'],
  'src/types/company.ts': ['CreateCompanyData', 'UpdateCompanyData'],
  'src/types/contacts/esco-types.ts': ['EscoContactFields', 'IscoMajorGroupCode', 'EscoCsvRow', 'EscoImportConfig'],
  'src/types/conversations.ts': ['AttachmentUploadRequest', 'InboundMessageNormalized'],
  'src/types/email-ingestion-queue.ts': ['EmailIngestionQueueInput'],
  'src/types/entity-associations.ts': ['AssociationRoleValue'],
  'src/types/notifications.ts': ['ErrorCodeMapping', 'NotificationQueue', 'NotificationA11y'],
  'src/types/project-mutation-impact.ts': ['ProjectMutationImpactRequest'],
  'src/types/project.ts': ['ProjectSortKey'],
  'src/types/property.ts': ['PropertySortKey'],
  'src/types/reports/saved-report.ts': ['ListSavedReportsFilter'],
  'src/types/search.ts': ['SearchQueryParams'],
  'src/types/sharing.ts': ['ShareDispatchLog'],
  'src/types/spaces.ts': ['BatchResolveRequest'],
  'src/types/validation/schemas.ts': [
    'ContactCreateData', 'ContactEditData',
    'StorageUnitCreateData', 'StorageUnitEditData',
    'CalculatedFinancialData',
    'BuildingFormData', 'BuildingCreateData', 'BuildingEditData',
    'ProjectCreateData', 'ProjectEditData',
    'LoginData', 'RegisterData', 'ForgotPasswordData', 'ResetPasswordData',
    'OpportunityFormData', 'OpportunityCreateData', 'OpportunityEditData',
    'TaskCreateData', 'TaskEditData',
    'BuildingFiltersData', 'PropertyFiltersData', 'TaskFiltersData',
  ],
  'src/types/workspace.ts': ['WorkspaceFirestoreDoc', 'WorkspaceMember', 'WorkspaceMemberFirestoreDoc'],
  'src/utils/lazyRoutes.tsx': ['LazyRouteComponent'],
};

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
  skipAddingFilesFromTsConfig: true,
});

let totalRemoved = 0;
let totalFiles = 0;
const errors = [];

for (const [filePath, typeNames] of Object.entries(DEAD_TYPES)) {
  const sourceFile = project.addSourceFileAtPath(filePath);
  if (!sourceFile) {
    errors.push(`File not found: ${filePath}`);
    continue;
  }

  let fileRemoved = 0;
  for (const typeName of typeNames) {
    // Try type alias
    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      typeAlias.remove();
      fileRemoved++;
      continue;
    }
    // Try interface
    const iface = sourceFile.getInterface(typeName);
    if (iface) {
      iface.remove();
      fileRemoved++;
      continue;
    }
    // Try enum
    const en = sourceFile.getEnum(typeName);
    if (en) {
      en.remove();
      fileRemoved++;
      continue;
    }
    // Try class (unlikely but possible)
    const cls = sourceFile.getClass(typeName);
    if (cls) {
      cls.remove();
      fileRemoved++;
      continue;
    }
    errors.push(`Not found in AST: ${typeName} in ${filePath}`);
  }

  if (fileRemoved > 0) {
    sourceFile.saveSync();
    console.log(`  ✓ ${filePath}: removed ${fileRemoved}/${typeNames.length} types`);
    totalRemoved += fileRemoved;
    totalFiles++;
  }
}

console.log(`\nDone: removed ${totalRemoved} types from ${totalFiles} files`);
if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`);
  errors.forEach(e => console.log(`  - ${e}`));
}
