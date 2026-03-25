/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ContactType } from '@/types/contacts';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getCompanyById } from '@/services/companies.service';
import { getContactFormConfig, getContactFormSections, getContactFormRenderer } from './utils/ContactFormConfigProvider';
import { createUnifiedPhotosChangeHandler, buildRendererPropsForContactType, type CanonicalUploadContext } from './utils/PhotoUploadConfiguration';
import { getMergedIndividualSections, getPersonaFields } from '@/config/persona-config';
import type { PersonaType } from '@/types/contacts/personas';
import { DEFAULT_INSURANCE_CLASSES } from '@/components/projects/ika/contracts';
import { useTranslation } from 'react-i18next';
import { buildCoreRenderers, buildCompanyRenderers, type RendererContext } from './contactRenderersCore';
import { buildIndividualRenderers, buildServiceRenderers, buildSectionFooterRenderers } from './contactRenderersTyped';

/**
 * 🏢 ENTERPRISE CENTRALIZED CONTACT FORM SECTION
 *
 * Single component που αντικαθιστά όλα τα διάσπαρτα ContactFormSection components.
 * SINGLE SOURCE OF TRUTH για όλες τις επαφές!
 */
interface UnifiedContactTabbedSectionProps {
  contactType: ContactType;
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleFileChange?: (file: File | null) => void;
  handleLogoChange?: (file: File | null) => void;
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
  handleProfilePhotoSelection?: (index: number) => void;
  handleUploadedLogoURL?: (logoURL: string) => void;
  handleUploadedPhotoURL?: (photoURL: string) => void;
  setFormData?: (data: ContactFormData) => void;
  disabled?: boolean;
  relationshipsMode?: 'summary' | 'full';
  onPhotoClick?: (index: number) => void;
  canonicalUploadContext?: CanonicalUploadContext;
  onActiveTabChange?: (tabId: string) => void;
  initialTab?: string;
  onPersonaToggle?: (personaType: PersonaType) => void;
}

export function UnifiedContactTabbedSection({
  contactType, formData, handleChange, handleSelectChange,
  handleFileChange, handleLogoChange,
  onPhotosChange, handleMultiplePhotosChange,
  handleMultiplePhotoUploadComplete, handleProfilePhotoSelection,
  handleUploadedLogoURL, handleUploadedPhotoURL,
  setFormData, disabled = false, relationshipsMode = 'full',
  onPhotoClick, canonicalUploadContext,
  onActiveTabChange, initialTab, onPersonaToggle,
}: UnifiedContactTabbedSectionProps) {
  const { t } = useTranslation('contacts');
  const { user } = useAuth();
  const resolvedCompanyId = useCompanyId()?.companyId;
  // Workspace context used for company name display (ADR-032)
  useWorkspace();

  // ── Company Display Name ─────────────────────────────────────
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchCompanyName = async () => {
      const companyId = resolvedCompanyId;
      if (!companyId) { setCompanyDisplayName(undefined); return; }
      try {
        const company = await getCompanyById(companyId);
        if (company && company.type === 'company') {
          setCompanyDisplayName(company.companyName || company.tradeName || companyId);
        } else {
          setCompanyDisplayName(companyId);
        }
      } catch {
        setCompanyDisplayName(companyId);
      }
    };
    fetchCompanyName();
  }, [user?.companyId]);

  // ── Configuration ────────────────────────────────────────────
  // Config loaded for side effects (field registration)
  useMemo(() => getContactFormConfig(contactType), [contactType]);

  // ── Persona Sections (ADR-121) ───────────────────────────────
  const sections = useMemo(() => {
    if (contactType === 'individual') return getMergedIndividualSections(formData.activePersonas ?? []);
    return getContactFormSections(contactType);
  }, [contactType, formData.activePersonas]);

  const personaFieldLookup = useMemo(() => {
    if (contactType !== 'individual') return new Map<string, PersonaType>();
    const lookup = new Map<string, PersonaType>();
    for (const pt of (formData.activePersonas ?? [])) {
      for (const field of getPersonaFields(pt)) lookup.set(field.id, pt);
    }
    return lookup;
  }, [contactType, formData.activePersonas]);

  // ── Enhanced FormData (flatten persona fields) ───────────────
  const enhancedFormData = useMemo((): ContactFormData => {
    if (contactType !== 'individual' || personaFieldLookup.size === 0) return formData;
    const pd = formData.personaData ?? {};
    const flat: Record<string, string | number | null> = {};
    for (const pt of (formData.activePersonas ?? [])) {
      const fields = pd[pt];
      if (fields) Object.assign(flat, fields);
    }
    return { ...formData, ...flat } as ContactFormData;
  }, [contactType, formData, personaFieldLookup]);

  // ── Wrapped Handlers (persona routing) ───────────────────────
  const wrappedHandleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const pt = personaFieldLookup.get(e.target.name);
      if (pt && setFormData) {
        const currentPD = formData.personaData ?? {};
        setFormData({ ...formData, personaData: { ...currentPD, [pt]: { ...currentPD[pt] ?? {}, [e.target.name]: e.target.value || null } } });
      } else {
        handleChange(e);
      }
    },
    [formData, handleChange, setFormData, personaFieldLookup]
  );

  const wrappedHandleSelectChange = useCallback(
    (name: string, value: string) => {
      const pt = personaFieldLookup.get(name);
      if (pt && setFormData) {
        const currentPD = formData.personaData ?? {};
        const currentFields = currentPD[pt] ?? {};
        const extraFields: Record<string, string | number | null> = {};
        if (name === 'insuranceClassId' && pt === 'construction_worker') {
          const matched = DEFAULT_INSURANCE_CLASSES.find(c => c.classNumber === parseInt(value, 10));
          if (matched) extraFields.dailyWage = matched.imputedDailyWage;
        }
        setFormData({ ...formData, personaData: { ...currentPD, [pt]: { ...currentFields, [name]: value || null, ...extraFields } } });
      } else {
        handleSelectChange(name, value);
      }
    },
    [formData, handleSelectChange, setFormData, personaFieldLookup]
  );

  // ── Photo Handler ────────────────────────────────────────────
  const unifiedPhotosChange = useMemo(
    () => createUnifiedPhotosChangeHandler({ onPhotosChange, handleMultiplePhotosChange, setFormData, formData }),
    [onPhotosChange, handleMultiplePhotosChange, setFormData] // formData excluded intentionally (ADR-190: prevents re-render loop)
  );

  // ── Renderer + Props ─────────────────────────────────────────
  const RendererComponent = getContactFormRenderer(contactType);

  const rendererProps = useMemo(() => {
    const ctx: RendererContext = {
      formData, setFormData, disabled, contactType,
      handleChange, handleSelectChange,
      userId: user?.uid, resolvedCompanyId, companyDisplayName,
      t, relationshipsMode,
      onPersonaToggle, canonicalUploadContext,
      handleLogoChange, handleFileChange,
      handleUploadedLogoURL, handleUploadedPhotoURL,
    };

    const customRenderers = {
      ...buildCoreRenderers(ctx),
      ...buildCompanyRenderers(ctx),
      ...buildIndividualRenderers(ctx),
      ...buildServiceRenderers(ctx),
    };

    const baseProps = {
      sections,
      formData: enhancedFormData,
      onChange: wrappedHandleChange,
      onSelectChange: wrappedHandleSelectChange,
      disabled,
      onActiveTabChange,
      initialTab,
      customRenderers,
      sectionFooterRenderers: buildSectionFooterRenderers(ctx),
    };

    return buildRendererPropsForContactType(contactType, baseProps, {
      handleLogoChange, handleFileChange,
      handleUploadedLogoURL, handleUploadedPhotoURL,
      unifiedPhotosChange, handleMultiplePhotoUploadComplete,
      handleProfilePhotoSelection, setFormData, formData, onPhotoClick,
    });
  }, [
    sections, formData, enhancedFormData, wrappedHandleChange, wrappedHandleSelectChange,
    disabled, contactType,
    handleFileChange, unifiedPhotosChange, handleMultiplePhotoUploadComplete,
    handleProfilePhotoSelection, handleLogoChange, handleUploadedLogoURL,
    handleUploadedPhotoURL, setFormData, relationshipsMode, onPhotoClick,
    canonicalUploadContext, onActiveTabChange,
    companyDisplayName, user?.companyId,
  ]);

  return (
    <div className="unified-contact-section -mt-px">
      <RendererComponent {...rendererProps} />
    </div>
  );
}

export default UnifiedContactTabbedSection;

// 🏷️ EXPORT ALIASES για backward compatibility
export { UnifiedContactTabbedSection as CompanyContactTabbedSection };
export { UnifiedContactTabbedSection as ServiceContactTabbedSection };
export { UnifiedContactTabbedSection as IndividualContactTabbedSection };
export { UnifiedContactTabbedSection as CompanyContactSection };
export { UnifiedContactTabbedSection as ServiceContactSection };
export { UnifiedContactTabbedSection as IndividualContactSection };
export { UnifiedContactTabbedSection as CommonContactSection };
