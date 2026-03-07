'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/auth/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext'; // 🏢 ENTERPRISE: Workspace context για company name display
import { getCompanyById } from '@/services/companies.service'; // 🏢 ENTERPRISE: Fetch company name (ADR-031)
import { getContactFormConfig, getContactFormSections, getContactFormRenderer } from './utils/ContactFormConfigProvider';
import { getPhotoUploadHandlers, createUnifiedPhotosChangeHandler, buildRendererPropsForContactType, type CanonicalUploadContext } from './utils/PhotoUploadConfiguration';
// 🎭 ENTERPRISE: Contact Persona System (ADR-121)
import { PersonaSelector } from '@/components/contacts/personas/PersonaSelector';
import { getMergedIndividualSections, getPersonaFields } from '@/config/persona-config';
import type { PersonaType } from '@/types/contacts/personas';
import { createDefaultPersonaData } from '@/types/contacts/personas';
// 🇪🇺 ENTERPRISE: ESCO Professional Classification (ADR-034) + Skills (ADR-132)
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import { EscoSkillPicker } from '@/components/shared/EscoSkillPicker';
import type { EscoPickerValue, EscoSkillValue } from '@/types/contacts/esco-types';
// 🏢 ENTERPRISE: Employer Entity Linking (ADR-177)
import { EmployerPicker } from '@/components/shared/EmployerPicker';
import type { EmployerPickerValue } from '@/components/shared/EmployerPicker';
// 🏢 ENTERPRISE: Multi-KAD Section — primary + N secondary activities
import { ContactKadSection } from '@/components/contacts/dynamic/ContactKadSection';
import type { KadActivity, CompanyAddress } from '@/types/ContactFormTypes';
// 🏢 ENTERPRISE: Multi-address Section — headquarters + N branches
import { CompanyAddressesSection } from '@/components/contacts/dynamic/CompanyAddressesSection';
// 🏢 ENTERPRISE: Ministry Picker — searchable dropdown for supervisionMinistry (services)
import { MinistryPicker } from '@/components/shared/MinistryPicker';
import { PublicServicePicker } from '@/components/contacts/pickers/PublicServicePicker';
import { AdministrativeAddressPicker } from '@/components/contacts/pickers/AdministrativeAddressPicker';
import type { AdministrativeAddress } from '@/components/contacts/pickers/AdministrativeAddressPicker';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { ContactAddressMapPreview } from '@/components/contacts/details/ContactAddressMapPreview';
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
}: UnifiedContactTabbedSectionProps) {

  // 🏢 ENTERPRISE: i18n
  const { t } = useTranslation('contacts');

  // 🏢 ENTERPRISE: Get auth context for file management
  const { user } = useAuth();

  // 🏢 ENTERPRISE: Get workspace context για company name display (ADR-032)
  const { activeWorkspace } = useWorkspace();

  // 🏢 ENTERPRISE: Fetch company name for Technical View display (ADR-031)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  // 🏢 ENTERPRISE: Fetch company name when companyId changes
  useEffect(() => {
    const fetchCompanyName = async () => {
      // 🏢 ENTERPRISE: Get companyId from user context (same as EntityFilesManager uses)
      const companyId = user?.companyId;

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
        setFormData({
          ...formData,
          personaData: {
            ...currentPD,
            [pt]: {
              ...currentFields,
              [name]: value || null,
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

          // 🏢 ENTERPRISE: Multi-address Section — hierarchy + headquarters + N branches + map
          addresses: () => {
            const currentAddresses: CompanyAddress[] = formData.companyAddresses ?? [];
            // Fallback: build from legacy singular fields if no array yet
            const effectiveAddresses: CompanyAddress[] = currentAddresses.length > 0
              ? currentAddresses
              : formData.street
                ? [{ type: 'headquarters' as const, street: formData.street, number: formData.streetNumber ?? '', postalCode: formData.postalCode ?? '', city: formData.city ?? '' }]
                : [{ type: 'headquarters' as const, street: '', number: '', postalCode: '', city: '' }];

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: AddressWithHierarchy for HQ + Branches */}
                <div className="space-y-6">
                  {/* HQ address with hierarchy */}
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
                        // Sync hierarchy to form + update HQ address in companyAddresses
                        const updatedAddresses = [...effectiveAddresses];
                        const hqIdx = updatedAddresses.findIndex(a => a.type === 'headquarters');
                        if (hqIdx >= 0) {
                          updatedAddresses[hqIdx] = {
                            ...updatedAddresses[hqIdx],
                            street: addr.street,
                            number: addr.number,
                            city: addr.settlementName || addr.municipalityName,
                            postalCode: addr.postalCode,
                          };
                        }
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
                          companyAddresses: updatedAddresses,
                        });
                      }
                    }}
                    disabled={disabled}
                  />

                  {/* Branches section */}
                  <CompanyAddressesSection
                    addresses={effectiveAddresses}
                    disabled={disabled}
                    onChange={(newAddresses) => {
                      if (!setFormData) return;
                      // Sync headquarters back to legacy singular fields
                      const hq = newAddresses.find((a) => a.type === 'headquarters') ?? newAddresses[0];
                      setFormData({
                        ...formData,
                        companyAddresses: newAddresses,
                        street: hq?.street ?? '',
                        streetNumber: hq?.number ?? '',
                        postalCode: hq?.postalCode ?? '',
                        city: hq?.city ?? '',
                      });
                    }}
                  />
                </div>

                {/* RIGHT: Map preview */}
                <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-7rem)]">
                  <ContactAddressMapPreview
                    className="!min-h-0 h-full rounded-lg"
                    contactId={formData.id}
                    street={formData.street}
                    streetNumber={formData.streetNumber}
                    city={formData.city}
                    postalCode={formData.postalCode}
                    companyAddresses={formData.companyAddresses}
                  />
                </aside>
              </div>
            );
          },
        } : {}),

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
          const companyId = user?.companyId;

          // Don't render if no contact ID (new contact) or no user
          if (!contactId || !currentUserId || !companyId) {
            return (
              <div className="p-8 text-center text-muted-foreground">
                <p>Το Files tab θα είναι διαθέσιμο αφού αποθηκεύσετε την επαφή.</p>
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
              companyName={companyDisplayName} // 🏢 ENTERPRISE: Pass company name from CompaniesService (ADR-031)
            />
          );
        },

        // 🎭 ENTERPRISE: Custom renderer for personas tab — ADR-121 Contact Persona System
        // Toggle chips that activate conditional field sections
        personas: () => {
          const handlePersonaToggle = (personaType: PersonaType) => {
            if (!setFormData) return;

            const currentActive = formData.activePersonas ?? [];
            const isActive = currentActive.includes(personaType);

            if (isActive) {
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
              disabled={disabled}
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

              {/* RIGHT: Map preview — full height */}
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