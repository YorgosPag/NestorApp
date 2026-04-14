/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import { useMemo, useState, useEffect } from 'react';
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
import { getIndividualSortedSections } from '@/config/individual-config';
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
  validationErrors?: Record<string, string>;
  onFieldBlur?: (fieldName: string) => void;
}

export function UnifiedContactTabbedSection({
  contactType, formData, handleChange, handleSelectChange,
  handleFileChange, handleLogoChange,
  onPhotosChange, handleMultiplePhotosChange,
  handleMultiplePhotoUploadComplete, handleProfilePhotoSelection,
  handleUploadedLogoURL, handleUploadedPhotoURL,
  setFormData, disabled = false, relationshipsMode = 'full',
  onPhotoClick, canonicalUploadContext,
  onActiveTabChange, initialTab,
  validationErrors, onFieldBlur,
}: UnifiedContactTabbedSectionProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
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

  // ── Sections (ADR-282: persona sections render inside Professional tab) ──
  const sections = useMemo(() => {
    if (contactType === 'individual') return getIndividualSortedSections();
    return getContactFormSections(contactType);
  }, [contactType]);

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
      t: (key: string, optionsOrFallback?: string | Record<string, unknown>) => {
        if (typeof optionsOrFallback === 'string') return t(key, optionsOrFallback);
        if (typeof optionsOrFallback === 'object') return t(key, { defaultValue: '', ...optionsOrFallback });
        return t(key, '');
      },
      relationshipsMode,
      canonicalUploadContext,
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
      formData,
      onChange: handleChange,
      onSelectChange: handleSelectChange,
      disabled,
      onActiveTabChange,
      initialTab,
      customRenderers,
      sectionFooterRenderers: buildSectionFooterRenderers(ctx),
      fieldErrors: validationErrors,
      onFieldBlur,
    };

    return buildRendererPropsForContactType(contactType, baseProps, {
      handleLogoChange, handleFileChange,
      handleUploadedLogoURL, handleUploadedPhotoURL,
      unifiedPhotosChange, handleMultiplePhotoUploadComplete,
      handleProfilePhotoSelection, setFormData, formData, onPhotoClick,
    });
  }, [
    sections, formData, handleChange, handleSelectChange,
    disabled, contactType,
    handleFileChange, unifiedPhotosChange, handleMultiplePhotoUploadComplete,
    handleProfilePhotoSelection, handleLogoChange, handleUploadedLogoURL,
    handleUploadedPhotoURL, setFormData, relationshipsMode, onPhotoClick,
    canonicalUploadContext, onActiveTabChange,
    companyDisplayName, user?.companyId,
    validationErrors, onFieldBlur,
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
