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
import { ContactAddressMapPreview } from '@/components/contacts/details/ContactAddressMapPreview';
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
  const unifiedPhotosChange = useMemo(() =>
    createUnifiedPhotosChangeHandler({
      onPhotosChange,
      handleMultiplePhotosChange,
      setFormData,
      formData
    }),
    [onPhotosChange, handleMultiplePhotosChange, setFormData, formData]
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
              disabled={fieldDisabled}
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
          )
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
        } : {})
      },
      sectionFooterRenderers: {
        address: () => (
          <ContactAddressMapPreview
            contactId={formData.id}
            street={formData.street}
            streetNumber={formData.streetNumber}
            city={formData.city}
            postalCode={formData.postalCode}
          />
        ),
        contact: () => (
          <ContactAddressMapPreview
            contactId={formData.id}
            street={formData.street}
            streetNumber={formData.streetNumber}
            city={formData.city}
            postalCode={formData.postalCode}
          />
        ),
        addresses: () => (
          <ContactAddressMapPreview
            contactId={formData.id}
            street={formData.street}
            streetNumber={formData.streetNumber}
            city={formData.city}
            postalCode={formData.postalCode}
          />
        ),
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