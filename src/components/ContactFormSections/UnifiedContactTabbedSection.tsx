'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ContactType } from '@/types/contacts';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import { ContactRelationshipManager } from '@/components/contacts/relationships/ContactRelationshipManager';
import { RelationshipsSummary } from '@/components/contacts/relationships/RelationshipsSummary';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { DynamicContactArrays } from '@/components/contacts/dynamic/DynamicContactArrays';
// 🏢 ENTERPRISE: File Management System (ADR-031)
import { EntityFilesManager } from '@/components/shared/files';
// 🏢 ENTERPRISE: Banking System (ADR-126)
import { ContactBankingTab } from '@/components/contacts/tabs/ContactBankingTab';
// 🏢 ENTERPRISE: Audit Trail / Activity History (ADR-195)
import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useWorkspace } from '@/contexts/WorkspaceContext'; // 🏢 ENTERPRISE: Workspace context για company name display
import { getCompanyById } from '@/services/companies.service'; // 🏢 ENTERPRISE: Fetch company name (ADR-031)
import { getContactFormConfig, getContactFormSections, getContactFormRenderer } from './utils/ContactFormConfigProvider';
import { getPhotoUploadHandlers, createUnifiedPhotosChangeHandler, buildRendererPropsForContactType, type CanonicalUploadContext } from './utils/PhotoUploadConfiguration';
// 🎭 ENTERPRISE: Contact Persona System (ADR-121)
import { PersonaSelector } from '@/components/contacts/personas/PersonaSelector';
import { getMergedIndividualSections, getPersonaFields } from '@/config/persona-config';
import type { PersonaType } from '@/types/contacts/personas';
import { createDefaultPersonaData } from '@/types/contacts/personas';
// 🏢 ENTERPRISE: Brokerage guard — prevent persona removal when active records exist
import { BrokerageService } from '@/services/brokerage.service';
// 🛡️ ENTERPRISE: Client guard — prevent persona removal when active purchases exist (ADR-121)
import { ClientService } from '@/services/client.service';
import { toast } from 'sonner';
// 🇪🇺 ENTERPRISE: ESCO Professional Classification (ADR-034) + Skills (ADR-132)
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import { EscoSkillPicker } from '@/components/shared/EscoSkillPicker';
import type { EscoPickerValue, EscoSkillValue } from '@/types/contacts/esco-types';
// 🏢 ENTERPRISE: Employer Entity Linking (ADR-177)
import { EmployerPicker } from '@/components/shared/EmployerPicker';
import type { EmployerPickerValue } from '@/components/shared/EmployerPicker';
// 🏗️ ENTERPRISE: Insurance class auto-fill (ADR-090)
import { DEFAULT_INSURANCE_CLASSES } from '@/components/projects/ika/contracts';
// 🏢 ENTERPRISE: Multi-KAD Section — primary + N secondary activities
import { ContactKadSection } from '@/components/contacts/dynamic/ContactKadSection';
import type { KadActivity, CompanyAddress } from '@/types/ContactFormTypes';
// 🏢 ENTERPRISE: Multi-address Section — headquarters + N branches
import { CompanyAddressesSection } from '@/components/contacts/dynamic/CompanyAddressesSection';
// 🏢 ADR-241: Addresses fullscreen wrapper (standalone component for proper hook lifecycle)
import { AddressesSectionWithFullscreen } from '@/components/contacts/dynamic/AddressesSectionWithFullscreen';
// 🏢 ENTERPRISE: Ministry Picker — searchable dropdown for supervisionMinistry (services)
import { MinistryPicker } from '@/components/shared/MinistryPicker';
import { PublicServicePicker } from '@/components/contacts/pickers/PublicServicePicker';
import { AdministrativeAddressPicker } from '@/components/contacts/pickers/AdministrativeAddressPicker';
import type { AdministrativeAddress } from '@/components/contacts/pickers/AdministrativeAddressPicker';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { ContactAddressMapPreview, type DragResolvedAddress } from '@/components/contacts/details/ContactAddressMapPreview';
// 🏢 ENTERPRISE: Κεντρικοποιημένος DoyPicker (ADR-ACC-013)
import { DoyPicker } from '@/components/ui/doy-picker';
// 🏢 ENTERPRISE: VAT Uniqueness Validation — cross-type duplicate detection
import { VatNumberField } from '@/components/contacts/fields/VatNumberField';
import { useTranslation } from 'react-i18next';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('UnifiedContactTabbedSection');

/** Custom renderer field interface */
interface CustomRendererField {
  name: string;
  type?: string;
  label?: string;
  [key: string]: unknown;
}

/**
 * 🏢 ENTERPRISE CENTRALIZED CONTACT FORM SECTION
 *
 * Single component που αντικαθιστά όλα τα διάσπαρτα ContactFormSection components:
 * - CompanyContactTabbedSection ❌ → UnifiedContactTabbedSection ✅
 * - ServiceContactTabbedSection ❌ → UnifiedContactTabbedSection ✅
 * - IndividualContactTabbedSection ❌ → UnifiedContactTabbedSection ✅
 * - CompanyContactSection ❌ → UnifiedContactTabbedSection ✅
 * - ServiceContactSection ❌ → UnifiedContactTabbedSection ✅
 * - IndividualContactSection ❌ → UnifiedContactTabbedSection ✅
 * - CommonContactSection ❌ → UnifiedContactTabbedSection ✅
 *
 * SINGLE SOURCE OF TRUTH για όλες τις επαφές!
 */
interface UnifiedContactTabbedSectionProps {
  contactType: ContactType;
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;

  // 🔄 Legacy handlers (για backward compatibility)
  handleFileChange?: (file: File | null) => void;
  handleLogoChange?: (file: File | null) => void;

  // 🏢 Enterprise photo system handlers
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
  handleProfilePhotoSelection?: (index: number) => void;

  // 🔗 URL handlers (για server-side uploads)
  handleUploadedLogoURL?: (logoURL: string) => void;
  handleUploadedPhotoURL?: (photoURL: string) => void;

  // 📝 Form state
  setFormData?: (data: ContactFormData) => void;
  disabled?: boolean;

  // 🔗 Relationships mode control
  relationshipsMode?: 'summary' | 'full'; // 'summary' for main tab, 'full' for modal

  // 🖼️ Photo click handler για gallery preview
  onPhotoClick?: (index: number) => void;

  // 🏢 CANONICAL UPLOAD CONTEXT (ADR-031)
  // If provided, photo uploads use canonical pipeline instead of legacy folderPath
  canonicalUploadContext?: CanonicalUploadContext;

  // 🏢 ENTERPRISE: Callback when active tab changes (for hiding save controls on subcollection tabs)
  onActiveTabChange?: (tabId: string) => void;
  // 🏢 ENTERPRISE: Initial tab (from sessionStorage — survives remounts)
  initialTab?: string;

  // 🎭 ENTERPRISE: Dedicated persona toggle callback (ADR-121)
  // Works in both view and edit mode — in view mode, saves directly to Firestore
  onPersonaToggle?: (personaType: PersonaType) => void;
}

// Configuration logic moved to ContactFormConfigProvider utility

export function UnifiedContactTabbedSection({
  contactType,
  formData,
  handleChange,
  handleSelectChange,
  handleFileChange,
  handleLogoChange,
  onPhotosChange,
  handleMultiplePhotosChange,
  handleMultiplePhotoUploadComplete,
  handleProfilePhotoSelection,
  handleUploadedLogoURL,
  handleUploadedPhotoURL,
  setFormData,
  disabled = false,
  relationshipsMode = 'full',
  onPhotoClick,
  canonicalUploadContext,
  onActiveTabChange,
  initialTab,
  onPersonaToggle,
}: UnifiedContactTabbedSectionProps) {

  // 🏢 ENTERPRISE: i18n
  const { t } = useTranslation('contacts');

  // 🏢 ENTERPRISE: Get auth context for file management
  const { user } = useAuth();
  const resolvedCompanyId = useCompanyId()?.companyId;

  // 🏢 ENTERPRISE: Get workspace context για company name display (ADR-032)
  const { activeWorkspace } = useWorkspace();

  // 🏢 ENTERPRISE: Fetch company name for Technical View display (ADR-031)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  // 🏢 ENTERPRISE: Fetch company name when companyId changes
  useEffect(() => {
    const fetchCompanyName = async () => {
      // 🏢 ENTERPRISE: Get companyId from user context (same as EntityFilesManager uses)
      const companyId = resolvedCompanyId;

      if (!companyId) {
        setCompanyDisplayName(undefined);
        return;
      }

      try {
        logger.info(`[UnifiedContactTabbedSection] Fetching company name for ID: ${companyId}`);
        const company = await getCompanyById(companyId);

        if (company && company.type === 'company') {
          // 🏢 ENTERPRISE: Use companyName or tradeName as fallback
          const displayName = company.companyName || company.tradeName || companyId;
          logger.info(`[UnifiedContactTabbedSection] Company name fetched: ${displayName}`);
          setCompanyDisplayName(displayName);
        } else {
          logger.warn(`[UnifiedContactTabbedSection] Company not found, using ID: ${companyId}`);
          setCompanyDisplayName(companyId); // Fallback to ID if company not found
        }
      } catch (error) {
        logger.error('[UnifiedContactTabbedSection] Failed to fetch company name:', { error: error });
        setCompanyDisplayName(companyId); // Fallback to ID on error
      }
    };

    fetchCompanyName();
  }, [user?.companyId]);

  // 🏢 ENTERPRISE: Get configuration dynamically based on contact type
  const config = useMemo(() => getContactFormConfig(contactType), [contactType]);

  // 🏢 ENTERPRISE: Tax Office (DOY) — κεντρικοποιημένο DoyPicker component

  // 🎭 ENTERPRISE: Dynamic sections — merge standard + persona sections for individuals (ADR-121)
  const sections = useMemo(() => {
    if (contactType === 'individual') {
      return getMergedIndividualSections(formData.activePersonas ?? []);
    }
    return getContactFormSections(contactType);
  }, [contactType, formData.activePersonas]);

  // 🎭 ENTERPRISE: Persona field → personaType lookup (ADR-121)
  // Maps each persona field ID to its owning persona type for routing onChange events
  const personaFieldLookup = useMemo(() => {
    if (contactType !== 'individual') return new Map<string, PersonaType>();

    const lookup = new Map<string, PersonaType>();
    for (const pt of (formData.activePersonas ?? [])) {
      for (const field of getPersonaFields(pt)) {
        lookup.set(field.id, pt);
      }
    }
    return lookup;
  }, [contactType, formData.activePersonas]);

  // 🎭 ENTERPRISE: Enhanced formData with persona fields flattened to top level (ADR-121)
  // IndividualFormRenderer reads formData[field.id] — persona values must be at top level
  const enhancedFormData = useMemo((): ContactFormData => {
    if (contactType !== 'individual' || personaFieldLookup.size === 0) return formData;

    const pd = formData.personaData ?? {};
    const flat: Record<string, string | number | null> = {};

    for (const pt of (formData.activePersonas ?? [])) {
      const fields = pd[pt];
      if (fields) {
        Object.assign(flat, fields);
      }
    }

    // Extra keys are ignored by TS but accessible at runtime via Record<string, ...> cast
    return { ...formData, ...flat } as ContactFormData;
  }, [contactType, formData, personaFieldLookup]);

  // 🎭 ENTERPRISE: Wrapped onChange — routes persona field changes to personaData (ADR-121)
  const wrappedHandleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const fieldId = e.target.name;
      const pt = personaFieldLookup.get(fieldId);

      if (pt && setFormData) {
        const currentPD = formData.personaData ?? {};
        const currentFields = currentPD[pt] ?? {};
        setFormData({
          ...formData,
          personaData: {
            ...currentPD,
            [pt]: {
              ...currentFields,
              [fieldId]: e.target.value || null,
            },
          },
        });
      } else {
        handleChange(e);
      }
    },
    [formData, handleChange, setFormData, personaFieldLookup]
  );

  // 🎭 ENTERPRISE: Wrapped onSelectChange — routes persona select fields to personaData (ADR-121)
  const wrappedHandleSelectChange = useCallback(
    (name: string, value: string) => {
      const pt = personaFieldLookup.get(name);

      if (pt && setFormData) {
        const currentPD = formData.personaData ?? {};
        const currentFields = currentPD[pt] ?? {};

        // 🏗️ ADR-090: Auto-fill dailyWage when insuranceClassId changes
        const extraFields: Record<string, string | number | null> = {};
        if (name === 'insuranceClassId' && pt === 'construction_worker') {
          const classNum = parseInt(value, 10);
          const matched = DEFAULT_INSURANCE_CLASSES.find(c => c.classNumber === classNum);
          if (matched) {
            extraFields.dailyWage = matched.imputedDailyWage;
          }
        }

        setFormData({
          ...formData,
          personaData: {
            ...currentPD,
            [pt]: {
              ...currentFields,
              [name]: value || null,
              ...extraFields,
            },
          },
        });
      } else {
        handleSelectChange(name, value);
      }
    },
    [formData, handleSelectChange, setFormData, personaFieldLookup]
  );

  // 🔄 UNIFIED PHOTO HANDLER: Consolidate all photo change handlers (extracted)
  // 🔧 FIX (ADR-190): Removed formData from deps — it caused callback recreation on every
  // formData change, which triggered re-renders → re-uploads → flickering loop.
  // The fallback handler is never reached because handleMultiplePhotosChange is always provided.
  const unifiedPhotosChange = useMemo(() =>
    createUnifiedPhotosChangeHandler({
      onPhotosChange,
      handleMultiplePhotosChange,
      setFormData,
      formData
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onPhotosChange, handleMultiplePhotosChange, setFormData]
  );

  // 🎯 DYNAMIC RENDERER: Choose the right renderer for this contact type
  const RendererComponent = getContactFormRenderer(contactType);

  // 🏗️ DYNAMIC PROPS: Build props object based on renderer type (extracted)
  const rendererProps = useMemo(() => {
    const baseProps = {
      sections,
      formData: enhancedFormData,
      onChange: wrappedHandleChange,
      onSelectChange: wrappedHandleSelectChange,
      disabled,
      onActiveTabChange, // 🏢 ENTERPRISE: Pass tab change callback for hiding header save controls
      initialTab, // 🏢 ENTERPRISE: Preserved tab from sessionStorage
      customRenderers: {
        // 🚀 DYNAMIC COMMUNICATION: Custom renderer for communication & social media
        communication: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
          <div className="w-full max-w-none min-w-full col-span-full">
            <DynamicContactArrays
              phones={formData.phones || []}
              emails={formData.emails || []}
              websites={Array.isArray(formData.websites) ? formData.websites : []}
              socialMedia={formData.socialMediaArray || []}
              disabled={fieldDisabled ?? disabled}
              contactType={contactType}
              onPhonesChange={(phones) => {
                logger.info('UnifiedContactTabbedSection: onPhonesChange called with:', { count: phones.length });
                if (setFormData) {
                  const newFormData = { ...formData, phones };
                  logger.info('UnifiedContactTabbedSection: Updating formData with phones:', { data: newFormData.phones?.length });
                  setFormData(newFormData);
                } else {
                  logger.warn('UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'phones', value: JSON.stringify(phones) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
              onEmailsChange={(emails) => {
                logger.info('UnifiedContactTabbedSection: onEmailsChange called with:', { count: emails.length });
                if (setFormData) {
                  const newFormData = { ...formData, emails };
                  logger.info('UnifiedContactTabbedSection: Updating formData with emails:', { data: newFormData.emails?.length });
                  setFormData(newFormData);
                } else {
                  logger.warn('UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'emails', value: JSON.stringify(emails) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
              onWebsitesChange={(websites) => {
                logger.info('UnifiedContactTabbedSection: onWebsitesChange called with:', { count: websites.length });
                if (setFormData) {
                  const newFormData = { ...formData, websites };
                  logger.info('UnifiedContactTabbedSection: Updating formData with websites:', { data: newFormData.websites?.length });
                  setFormData(newFormData);
                } else {
                  logger.warn('UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'websites', value: JSON.stringify(websites) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
              onSocialMediaChange={(socialMedia) => {
                logger.info('UnifiedContactTabbedSection: onSocialMediaChange called with:', { count: socialMedia.length });
                if (setFormData) {
                  const newFormData = { ...formData, socialMediaArray: socialMedia };
                  logger.info('UnifiedContactTabbedSection: Updating formData with socialMediaArray:', { data: newFormData.socialMediaArray?.length });
                  setFormData(newFormData);
                } else {
                  logger.warn('UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'socialMediaArray', value: JSON.stringify(socialMedia) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
            />
          </div>
        ),

        // 🏢 ENTERPRISE: VAT Uniqueness Validation — real-time cross-type duplicate detection
        vatNumber: (field: CustomRendererField, fieldFormData: Record<string, unknown>, fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
          <VatNumberField
            field={field as unknown as import('@/config/individual-config').IndividualFieldConfig}
            value={String(fieldFormData[field.name ?? 'vatNumber'] ?? fieldFormData['vatNumber'] ?? '')}
            onChange={fieldOnChange}
            disabled={fieldDisabled ?? disabled}
            excludeContactId={formData.id}
          />
        ),

        // 🏢 ENTERPRISE: Custom renderer για companyPhotos (UnifiedPhotoManager) - only for companies
        // ⚠️ NOTE: This renderer is called as section-level (no args) by GenericFormTabRenderer,
        // so fieldDisabled is always undefined. We use the `disabled` prop from the closure instead.
        ...(contactType === 'company' ? {
          companyPhotos: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, _fieldDisabled: boolean) => (
            <UnifiedPhotoManager
              contactType="company"
              formData={formData}
              handlers={{
                handleLogoChange,
                handleFileChange,
                handleUploadedLogoURL,
                handleUploadedPhotoURL
              }}
              uploadHandlers={getPhotoUploadHandlers(formData, canonicalUploadContext)}
              disabled={disabled}
              className="mt-4"
            />
          ),

          // 🏢 ENTERPRISE: Multi-KAD Activities Section — primary + N secondary ΚΑΔ
          // Section-level renderer replacing entire "Δραστηριότητες & ΚΑΔ" tab
          activities: () => {
            const currentActivities: KadActivity[] = formData.activities ?? [];
            // Fallback: if no activities array, build from legacy singular fields
            const effectiveActivities: KadActivity[] = currentActivities.length > 0
              ? currentActivities
              : formData.activityCodeKAD
                ? [{ code: formData.activityCodeKAD, description: formData.activityDescription ?? '', type: 'primary' as const }]
                : [];

            return (
              <ContactKadSection
                activities={effectiveActivities}
                chamber={formData.chamber ?? ''}
                disabled={disabled}
                onChange={({ activities: newActivities, chamber }) => {
                  if (!setFormData) return;
                  // Sync primary KAD back to legacy singular fields
                  const primary = newActivities.find((a) => a.type === 'primary');
                  setFormData({
                    ...formData,
                    activities: newActivities,
                    chamber,
                    activityCodeKAD: primary?.code ?? '',
                    activityDescription: primary?.description ?? '',
                    activityType: 'main',
                  });
                }}
              />
            );
          },

          // 🏢 ADR-241: Standalone component for proper hook lifecycle (fullscreen)
          addresses: () => (
            <AddressesSectionWithFullscreen
              formData={formData}
              setFormData={setFormData}
              disabled={disabled}
            />
          ),

        } : {}),

        // 🏢 ENTERPRISE: Tax Office (DOY) — κεντρικοποιημένος DoyPicker για ΟΛΟΥΣ τους τύπους επαφών (ADR-ACC-013)
        taxOffice: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
          <DoyPicker
            value={formData.taxOffice ?? ''}
            onValueChange={(value) => {
              handleSelectChange('taxOffice', value);
            }}
            disabled={fieldDisabled ?? disabled}
          />
        ),

        // 🏢 ENTERPRISE: Custom renderer for relationships tab - for ALL contact types
        // ⚠️ NOTE: Called as section-level (no args) by GenericFormTabRenderer — use `disabled` from closure
        relationships: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, _fieldDisabled: boolean) => {
          // ✅ FIXED: Now formData.id is correctly included from the contact mappers
          const contactId = formData.id || 'new-contact';

          // 🚀 PERFORMANCE: Wrap με RelationshipProvider to prevent duplicate API calls
          return (
            <RelationshipProvider
              contactId={contactId}
              contactType={contactType}
              onRelationshipsChange={(relationships) => {
                logger.info('Relationships updated:', { count: relationships.length });
              }}
            >
              {relationshipsMode === 'summary' ? (
                <RelationshipsSummary
                  contactId={contactId}
                  contactType={contactType}
                  readonly={disabled}
                  className="mt-4"
                  onManageRelationships={undefined} // 🎯 No modal needed - inline editing
                />
              ) : (
                <ContactRelationshipManager
                  contactId={contactId}
                  contactType={contactType}
                  readonly={disabled}
                  className="mt-4"
                  onRelationshipsChange={(relationships) => {
                    // Optionally update form data with relationship count for display
                    logger.info('Relationships updated:', { count: relationships.length });
                  }}
                />
              )}
            </RelationshipProvider>
          );
        },

        // 🏢 ENTERPRISE: Custom renderer for files tab - ADR-031 Canonical File Storage
        files: () => {
          const contactId = formData.id;
          const currentUserId = user?.uid;
          const companyId = resolvedCompanyId;

          // Don't render if no contact ID (new contact) or no user
          if (!contactId || !currentUserId || !companyId) {
            return (
              <div className="p-8 text-center text-muted-foreground">
                <p>{t('individual.sections.files.description')}</p>
              </div>
            );
          }

          // Get entity label for display names
          let entityLabel = '';
          if (contactType === 'individual') {
            const firstName = (formData.firstName as string) || '';
            const lastName = (formData.lastName as string) || '';
            entityLabel = `${firstName} ${lastName}`.trim();
          } else if (contactType === 'company') {
            entityLabel = (formData.companyName as string) || (formData.tradeName as string) || '';
          } else if (contactType === 'service') {
            entityLabel = (formData.serviceName as string) || (formData.name as string) || '';
          }

          return (
            <EntityFilesManager
              entityType="contact"
              entityId={contactId}
              companyId={companyId}
              domain="admin"
              category="documents"
              currentUserId={currentUserId}
              entityLabel={entityLabel}
              companyName={companyDisplayName}
              contactType={contactType}
              activePersonas={formData.activePersonas}
            />
          );
        },

        // 🎭 ENTERPRISE: Custom renderer for personas tab — ADR-121 Contact Persona System
        // Toggle chips that activate conditional field sections
        personas: () => {
          const handlePersonaToggle = async (personaType: PersonaType) => {
            // Dedicated callback takes priority (works in both view + edit mode)
            if (onPersonaToggle) {
              onPersonaToggle(personaType);
              return;
            }
            if (!setFormData) return;

            const currentActive = formData.activePersonas ?? [];
            const isActive = currentActive.includes(personaType);

            if (isActive) {
              // 🛡️ GUARD: Prevent removal of real_estate_agent if active brokerage records exist
              if (personaType === 'real_estate_agent' && formData.id) {
                const { hasAgreements, hasCommissions } = await BrokerageService.hasActiveRecords(formData.id);
                if (hasAgreements || hasCommissions) {
                  toast.error(
                    'Δεν μπορεί να αφαιρεθεί η ιδιότητα «Μεσίτης Ακινήτων» — υπάρχουν ενεργές συμβάσεις ή εκκρεμείς προμήθειες για αυτήν την επαφή.',
                    { duration: 5000 }
                  );
                  return;
                }
              }

              // 🛡️ GUARD: Prevent removal of client if active purchased units exist (ADR-121)
              if (personaType === 'client' && formData.id) {
                const { hasUnits, hasParking, hasStorage } = await ClientService.hasActiveUnits(formData.id);
                if (hasUnits || hasParking || hasStorage) {
                  toast.error(
                    'Δεν μπορεί να αφαιρεθεί η ιδιότητα «Πελάτης» — υπάρχουν ενεργές αγορές συνδεδεμένες.',
                    { duration: 5000 }
                  );
                  return;
                }
              }

              // Deactivate: remove from activePersonas (data stays in personaData for re-activation)
              setFormData({
                ...formData,
                activePersonas: currentActive.filter(p => p !== personaType),
              });
            } else {
              // Activate: add to activePersonas, init personaData if needed
              const currentData = formData.personaData ?? {};
              const existingData = currentData[personaType];
              const defaultData = createDefaultPersonaData(personaType);
              // Extract field values from default (all null), use existing if available
              const { personaType: _pt, status: _s, activatedAt: _a, deactivatedAt: _d, notes: _n, ...defaultFields } = defaultData;

              setFormData({
                ...formData,
                activePersonas: [...currentActive, personaType],
                personaData: {
                  ...currentData,
                  [personaType]: existingData ?? (defaultFields as Record<string, string | number | null>),
                },
              });
            }
          };

          return (
            <PersonaSelector
              activePersonas={formData.activePersonas ?? []}
              onToggle={handlePersonaToggle}
              disabled={false}
            />
          );
        },

        // 🏢 ENTERPRISE: Custom renderer for banking tab - ADR-126 Bank Accounts System
        // 🎯 ENTERPRISE PATTERN (Salesforce/SAP/Dynamics): Banking is ALWAYS editable via modals
        // The parent's edit mode does NOT affect banking - subcollections save independently
        banking: () => {
          // ContactBankingTab expects `data` prop with the contact
          // Convert formData to Contact-like structure
          return (
            <ContactBankingTab
              data={{
                id: formData.id || '',
                type: contactType,
                ...(formData as unknown as Record<string, unknown>)
              } as Parameters<typeof ContactBankingTab>[0]['data']}
              additionalData={{ disabled: false }} // 🏢 ENTERPRISE: Always editable - subcollections save independently
            />
          );
        },

        // 🏢 ENTERPRISE: Custom renderer for history tab — ADR-195 Centralized Audit Trail
        // Read-only timeline of all changes to this contact
        history: () => {
          const contactId = formData.id;
          if (!contactId) {
            return (
              <div className="p-8 text-center text-muted-foreground">
                <p>{t('individual.sections.history.description')}</p>
              </div>
            );
          }
          return (
            <ActivityTab
              entityType="contact"
              entityId={contactId}
            />
          );
        },

        // 🇪🇺 ENTERPRISE: ESCO Occupation Picker — field-level custom renderer for "profession" (ADR-034)
        // Replaces free-text input with autocomplete backed by EU ESCO taxonomy
        // Backward compatible: free-text fallback always available
        ...(contactType === 'individual' ? {
          profession: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
            <EscoOccupationPicker
              value={formData.profession ?? ''}
              escoUri={formData.escoUri ?? undefined}
              iscoCode={formData.iscoCode ?? undefined}
              disabled={fieldDisabled}
              onChange={(escoValue: EscoPickerValue) => {
                if (setFormData) {
                  setFormData({
                    ...formData,
                    profession: escoValue.profession,
                    escoUri: escoValue.escoUri ?? '',
                    escoLabel: escoValue.escoLabel ?? '',
                    iscoCode: escoValue.iscoCode ?? '',
                  });
                }
              }}
            />
          ),

          // 🏢 ENTERPRISE: Employer Picker — field-level custom renderer for "employer" (ADR-177)
          // Autocomplete backed by existing Company contacts with entity linking
          employer: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
            <EmployerPicker
              value={formData.employer ?? ''}
              employerId={formData.employerId ?? undefined}
              disabled={fieldDisabled}
              onChange={(empValue: EmployerPickerValue) => {
                if (setFormData) {
                  setFormData({
                    ...formData,
                    employer: empValue.employer,
                    employerId: empValue.employerId ?? '',
                  });
                }
              }}
            />
          ),

          // 🇪🇺 ENTERPRISE: ESCO Skills Picker — field-level custom renderer for "skills" (ADR-132)
          // Multi-select picker backed by EU ESCO skills taxonomy (13.485 skills)
          skills: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
            <EscoSkillPicker
              value={formData.escoSkills ?? []}
              disabled={fieldDisabled}
              onChange={(skills: EscoSkillValue[]) => {
                if (setFormData) {
                  setFormData({
                    ...formData,
                    escoSkills: skills,
                  });
                }
              }}
            />
          ),

          // 🛡️ ENTERPRISE: clientSince — read-only date + sales link (ADR-121 Client Tab Redesign)
          clientSince: () => {
            const rawValue = (formData as Record<string, unknown>).clientSince as string | null;
            const displayDate = rawValue
              ? new Date(rawValue).toLocaleDateString('el-GR', { year: 'numeric', month: 'long', day: 'numeric' })
              : t('persona.fields.clientSinceEmpty', 'Δεν έχει οριστεί');

            return (
              <section className="col-span-full space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('persona.fields.clientSince', 'Πελάτης από')}
                  </label>
                  <span className="text-sm font-semibold">{displayDate}</span>
                </div>
                <Link
                  href="/sales/available-apartments"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('persona.links.viewClientPurchases', 'Προβολή αγορών πελάτη')}
                </Link>
              </section>
            );
          },
        } : {}),

        // 🏢 ENTERPRISE: Public Service Registry Picker + Ministry Picker (services only)
        ...(contactType === 'service' ? {
          name: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
            <PublicServicePicker
              value={(formData.name as string) ?? ''}
              disabled={fieldDisabled}
              onNameChange={(name: string) => {
                if (setFormData) {
                  setFormData({ ...formData, name });
                }
              }}
              onEntitySelected={(entity) => {
                if (setFormData) {
                  setFormData({
                    ...formData,
                    name: entity.name,
                    supervisionMinistry: entity.supervisingMinistry,
                  });
                }
              }}
            />
          ),
          supervisionMinistry: (_field: CustomRendererField, _fieldFormData: Record<string, unknown>, _fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, _fieldOnSelectChange: (name: string, value: string) => void, fieldDisabled: boolean) => (
            <MinistryPicker
              value={formData.supervisionMinistry ?? ''}
              disabled={fieldDisabled}
              onChange={(name: string) => {
                if (setFormData) {
                  setFormData({
                    ...formData,
                    supervisionMinistry: name,
                  });
                }
              }}
            />
          ),
        } : {}),

        // Service address: 2-column layout (AddressWithHierarchy left, map right)
        ...(contactType === 'service' ? {
          address: () => (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Centralized AddressWithHierarchy */}
              <AddressWithHierarchy
                value={{
                  street: (formData.street as string) || '',
                  number: (formData.streetNumber as string) || '',
                  postalCode: (formData.postalCode as string) || '',
                  settlementName: (formData.settlement as string) || (formData.city as string) || '',
                  settlementId: (formData.settlementId as string | null) ?? null,
                  communityName: (formData.community as string) || '',
                  municipalUnitName: (formData.municipalUnit as string) || '',
                  municipalityName: (formData.municipality as string) || '',
                  municipalityId: (formData.municipalityId as string | null) ?? null,
                  regionalUnitName: (formData.regionalUnit as string) || '',
                  regionName: (formData.region as string) || '',
                  decentAdminName: (formData.decentAdmin as string) || '',
                  majorGeoName: (formData.majorGeo as string) || '',
                }}
                onChange={(addr: AddressWithHierarchyValue) => {
                  if (setFormData) {
                    setFormData({
                      ...formData,
                      street: addr.street,
                      streetNumber: addr.number,
                      postalCode: addr.postalCode,
                      city: addr.settlementName || addr.municipalityName,
                      settlement: addr.settlementName,
                      settlementId: addr.settlementId,
                      community: addr.communityName,
                      municipalUnit: addr.municipalUnitName,
                      municipality: addr.municipalityName,
                      municipalityId: addr.municipalityId,
                      regionalUnit: addr.regionalUnitName,
                      region: addr.regionName,
                      decentAdmin: addr.decentAdminName,
                      majorGeo: addr.majorGeoName,
                    });
                  }
                }}
                disabled={disabled}
              />

              {/* RIGHT: Map preview — draggable pin in edit mode */}
              <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-7rem)]">
                <ContactAddressMapPreview
                  className="!min-h-0 h-full rounded-lg"
                  contactId={formData.id}
                  street={formData.street}
                  streetNumber={formData.streetNumber}
                  city={formData.city}
                  postalCode={formData.postalCode}
                  municipality={formData.municipality as string}
                  regionalUnit={formData.regionalUnit as string}
                  region={formData.region as string}
                  draggable={!disabled}
                  onDragResolve={!disabled && setFormData ? (addr: DragResolvedAddress, _index: number) => {
                    setFormData({
                      ...formData,
                      street: addr.street,
                      streetNumber: addr.number,
                      postalCode: addr.postalCode,
                      city: addr.city,
                      settlement: addr.city,
                      settlementId: null,
                      community: '',
                      municipalUnit: '',
                      municipality: '',
                      municipalityId: null,
                      regionalUnit: '',
                      region: '',
                      decentAdmin: '',
                      majorGeo: '',
                    });
                  } : undefined}
                />
              </aside>
            </div>
          ),
        } : {}),

        // Individual address: 2-column layout (AddressWithHierarchy left, map right)
        ...(contactType === 'individual' ? {
          address: () => (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Centralized AddressWithHierarchy */}
              <AddressWithHierarchy
                value={{
                  street: (formData.street as string) || '',
                  number: (formData.streetNumber as string) || '',
                  postalCode: (formData.postalCode as string) || '',
                  settlementName: (formData.settlement as string) || (formData.city as string) || '',
                  settlementId: (formData.settlementId as string | null) ?? null,
                  communityName: (formData.community as string) || '',
                  municipalUnitName: (formData.municipalUnit as string) || '',
                  municipalityName: (formData.municipality as string) || '',
                  municipalityId: (formData.municipalityId as string | null) ?? null,
                  regionalUnitName: (formData.regionalUnit as string) || '',
                  regionName: (formData.region as string) || '',
                  decentAdminName: (formData.decentAdmin as string) || '',
                  majorGeoName: (formData.majorGeo as string) || '',
                }}
                onChange={(addr: AddressWithHierarchyValue) => {
                  if (setFormData) {
                    setFormData({
                      ...formData,
                      street: addr.street,
                      streetNumber: addr.number,
                      postalCode: addr.postalCode,
                      city: addr.settlementName || addr.municipalityName,
                      settlement: addr.settlementName,
                      settlementId: addr.settlementId,
                      community: addr.communityName,
                      municipalUnit: addr.municipalUnitName,
                      municipality: addr.municipalityName,
                      municipalityId: addr.municipalityId,
                      regionalUnit: addr.regionalUnitName,
                      region: addr.regionName,
                      decentAdmin: addr.decentAdminName,
                      majorGeo: addr.majorGeoName,
                    });
                  }
                }}
                disabled={disabled}
              />

              {/* RIGHT: Map preview */}
              <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-7rem)]">
                <ContactAddressMapPreview
                  className="!min-h-0 h-full rounded-lg"
                  contactId={formData.id}
                  street={formData.street}
                  streetNumber={formData.streetNumber}
                  city={formData.city}
                  postalCode={formData.postalCode}
                  municipality={formData.municipality as string}
                  regionalUnit={formData.regionalUnit as string}
                  region={formData.region as string}
                  draggable={!disabled}
                  onDragResolve={!disabled && setFormData ? (resolved: DragResolvedAddress, _index: number) => {
                    setFormData({
                      ...formData,
                      street: resolved.street,
                      streetNumber: resolved.number,
                      postalCode: resolved.postalCode,
                      city: resolved.city,
                      settlement: resolved.city,
                      settlementId: null,
                      community: '',
                      municipalUnit: '',
                      municipality: '',
                      municipalityId: null,
                      regionalUnit: '',
                      region: '',
                      decentAdmin: '',
                      majorGeo: '',
                    });
                  } : undefined}
                />
              </aside>
            </div>
          ),
        } : {}),

      },
      sectionFooterRenderers: {
        // Address footer removed for individual/service/company — map is inside customRenderers
        contact: () => (
          <ContactAddressMapPreview
            contactId={formData.id}
            street={formData.street}
            streetNumber={formData.streetNumber}
            city={formData.city}
            postalCode={formData.postalCode}
          />
        ),
        // addresses footer removed — map is now inside the addresses customRenderer
      }
    };

    // Use utility function για props building
    return buildRendererPropsForContactType(contactType, baseProps, {
      handleLogoChange,
      handleFileChange,
      handleUploadedLogoURL,
      handleUploadedPhotoURL,
      unifiedPhotosChange,
      handleMultiplePhotoUploadComplete,
      handleProfilePhotoSelection,
      setFormData,
      formData,
      onPhotoClick
    });
  }, [
    sections, formData, enhancedFormData, wrappedHandleChange, wrappedHandleSelectChange,
    disabled, contactType,
    handleFileChange, unifiedPhotosChange, handleMultiplePhotoUploadComplete,
    handleProfilePhotoSelection, handleLogoChange, handleUploadedLogoURL,
    handleUploadedPhotoURL, setFormData, relationshipsMode, onPhotoClick,
    canonicalUploadContext, onActiveTabChange,
    companyDisplayName, // 🏢 ENTERPRISE: Re-render when company name is fetched (ADR-031)
    user?.companyId, // 🏢 ENTERPRISE: Re-render when companyId changes
  ]);

  return (
    <div className="unified-contact-section -mt-px">
      {/* 🎯 DYNAMIC RENDERER */}
      <RendererComponent {...rendererProps} />
    </div>
  );
}

export default UnifiedContactTabbedSection;

/**
 * 🏷️ EXPORT ALIASES για backward compatibility
 * Αυτά θα επιτρέψουν στα existing imports να συνεχίσουν να δουλεύουν
 */
export { UnifiedContactTabbedSection as CompanyContactTabbedSection };
export { UnifiedContactTabbedSection as ServiceContactTabbedSection };
export { UnifiedContactTabbedSection as IndividualContactTabbedSection };
export { UnifiedContactTabbedSection as CompanyContactSection };
export { UnifiedContactTabbedSection as ServiceContactSection };
export { UnifiedContactTabbedSection as IndividualContactSection };
export { UnifiedContactTabbedSection as CommonContactSection };