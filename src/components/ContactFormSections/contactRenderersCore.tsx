/* eslint-disable design-system/prefer-design-system-imports */
'use client';
import React from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ContactType } from '@/types/contacts';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import { ContactRelationshipManager } from '@/components/contacts/relationships/ContactRelationshipManager';
import { RelationshipsSummary } from '@/components/contacts/relationships/RelationshipsSummary';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { DynamicContactArrays } from '@/components/contacts/dynamic/DynamicContactArrays';
import { EntityFilesManager } from '@/components/shared/files';
import { ContactBankingTab } from '@/components/contacts/tabs/ContactBankingTab';
import { ContactHistoryTab } from '@/components/contacts/tabs/ContactHistoryTab';
import { ProjectParticipationSection } from '@/components/contacts/details/ProjectParticipationSection';
import { DoyPicker } from '@/components/ui/doy-picker';
import { VatNumberField } from '@/components/contacts/fields/VatNumberField';
import { ContactKadSection } from '@/components/contacts/dynamic/ContactKadSection';
import type { KadActivity } from '@/types/ContactFormTypes';
import { AddressesSectionWithFullscreen } from '@/components/contacts/dynamic/AddressesSectionWithFullscreen';
import { getPhotoUploadHandlers, type CanonicalUploadContext } from './utils/PhotoUploadConfiguration';
import { createModuleLogger } from '@/lib/telemetry';
import { ENTITY_TYPES } from '@/config/domain-constants';

const logger = createModuleLogger('ContactRenderers');

/** Custom renderer field interface */
export interface CustomRendererField {
  name: string;
  type?: string;
  label?: string;
  [key: string]: unknown;
}

/** Context needed to build renderers */
export interface RendererContext {
  formData: ContactFormData;
  setFormData?: (data: ContactFormData) => void;
  disabled: boolean;
  contactType: ContactType;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  userId?: string;
  resolvedCompanyId?: string;
  companyDisplayName?: string;
  t: (key: string, optionsOrFallback?: string | Record<string, unknown>) => string;
  relationshipsMode: 'summary' | 'full';
  canonicalUploadContext?: CanonicalUploadContext;
  handleLogoChange?: (file: File | null) => void;
  handleFileChange?: (file: File | null) => void;
  handleUploadedLogoURL?: (url: string) => void;
  handleUploadedPhotoURL?: (url: string) => void;
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
  handleProfilePhotoSelection?: (index: number) => void;
}

type RendererFn = (
  field: CustomRendererField,
  fieldFormData: Record<string, unknown>,
  fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  fieldOnSelectChange: (name: string, value: string) => void,
  fieldDisabled: boolean,
) => React.ReactNode;

/**
 * Build core custom renderers shared across all contact types.
 * Returns a Record to be spread into customRenderers.
 */
export function buildCoreRenderers(ctx: RendererContext): Record<string, RendererFn | (() => React.ReactNode)> {
  const { formData, setFormData, disabled, contactType, handleChange, handleSelectChange, t } = ctx;

  return {
    // ── Communication ──────────────────────────────────────────
    communication: (
      _field: CustomRendererField, _fd: Record<string, unknown>,
      _onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
      <div className="w-full max-w-none min-w-full col-span-full">
        <DynamicContactArrays
          phones={formData.phones || []}
          emails={formData.emails || []}
          websites={Array.isArray(formData.websites) ? formData.websites : []}
          socialMedia={formData.socialMediaArray || []}
          disabled={fieldDisabled ?? disabled}
          contactType={contactType}
          onPhonesChange={(phones) => setFormData ? setFormData({ ...formData, phones }) : handleChange({ target: { name: 'phones', value: JSON.stringify(phones) } } as React.ChangeEvent<HTMLInputElement>)}
          onEmailsChange={(emails) => setFormData ? setFormData({ ...formData, emails }) : handleChange({ target: { name: 'emails', value: JSON.stringify(emails) } } as React.ChangeEvent<HTMLInputElement>)}
          onWebsitesChange={(websites) => setFormData ? setFormData({ ...formData, websites }) : handleChange({ target: { name: 'websites', value: JSON.stringify(websites) } } as React.ChangeEvent<HTMLInputElement>)}
          onSocialMediaChange={(socialMedia) => setFormData ? setFormData({ ...formData, socialMediaArray: socialMedia }) : handleChange({ target: { name: 'socialMediaArray', value: JSON.stringify(socialMedia) } } as React.ChangeEvent<HTMLInputElement>)}
        />
      </div>
    ),

    // ── VAT Number ─────────────────────────────────────────────
    vatNumber: (
      field: CustomRendererField, fieldFormData: Record<string, unknown>,
      fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
      <VatNumberField
        field={field as unknown as import('@/config/individual-config').IndividualFieldConfig}
        value={String(fieldFormData[field.name ?? 'vatNumber'] ?? fieldFormData['vatNumber'] ?? '')}
        onChange={fieldOnChange}
        disabled={fieldDisabled ?? disabled}
        excludeContactId={formData.id}
      />
    ),

    // ── Tax Office (DOY) ───────────────────────────────────────
    taxOffice: (
      _field: CustomRendererField, _fd: Record<string, unknown>,
      _onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
      <DoyPicker
        value={formData.taxOffice ?? ''}
        onValueChange={(value) => handleSelectChange('taxOffice', value)}
        disabled={fieldDisabled ?? disabled}
      />
    ),

    // ── Relationships ──────────────────────────────────────────
    relationships: () => {
      const contactId = formData.id || 'new-contact';
      return (
        <RelationshipProvider
          contactId={contactId}
          contactType={contactType}
          onRelationshipsChange={(rels) => logger.info('Relationships updated:', { count: rels.length })}
        >
          {ctx.relationshipsMode === 'summary' ? (
            <RelationshipsSummary contactId={contactId} contactType={contactType} readonly={disabled} className="mt-4" onManageRelationships={undefined} />
          ) : (
            <ContactRelationshipManager contactId={contactId} contactType={contactType} readonly={disabled} className="mt-4" onRelationshipsChange={(rels) => logger.info('Relationships updated:', { count: rels.length })} />
          )}
        </RelationshipProvider>
      );
    },

    // ── Files ──────────────────────────────────────────────────
    files: () => {
      const contactId = formData.id;
      if (!contactId || !ctx.userId || !ctx.resolvedCompanyId) {
        return <div className="p-8 text-center text-muted-foreground"><p>{t('individual.sections.files.description')}</p></div>;
      }
      let entityLabel = '';
      if (contactType === 'individual') entityLabel = `${(formData.firstName as string) || ''} ${(formData.lastName as string) || ''}`.trim();
      else if (contactType === 'company') entityLabel = (formData.companyName as string) || (formData.tradeName as string) || '';
      else if (contactType === 'service') entityLabel = (formData.serviceName as string) || (formData.name as string) || '';
      return <EntityFilesManager entityType={ENTITY_TYPES.CONTACT} entityId={contactId} companyId={ctx.resolvedCompanyId} domain="admin" category="documents" currentUserId={ctx.userId} entityLabel={entityLabel} companyName={ctx.companyDisplayName} contactType={contactType} activePersonas={formData.activePersonas} />;
    },

    // ── Project Participation (ADR-282: read-only derived section) ──
    projectParticipation: () => (
      <ProjectParticipationSection contactId={formData.id} />
    ),

    // ── Banking ────────────────────────────────────────────────
    banking: () => (
      <ContactBankingTab
        data={{ id: formData.id || '', type: contactType, ...(formData as unknown as Record<string, unknown>) } as Parameters<typeof ContactBankingTab>[0]['data']}
        additionalData={{ disabled: false }}
      />
    ),

    // ── History (Unified: Audit Trail + Photo Share in one timeline) ──
    history: () => {
      const contactId = formData.id;
      if (!contactId) return <div className="p-8 text-center text-muted-foreground"><p>{t('individual.sections.history.description')}</p></div>;
      return <ContactHistoryTab contactId={contactId} />;
    },
  };
}

/**
 * Build company-specific renderers.
 */
export function buildCompanyRenderers(ctx: RendererContext): Record<string, RendererFn | (() => React.ReactNode)> {
  if (ctx.contactType !== 'company') return {};

  const { formData, setFormData, disabled } = ctx;

  return {
    companyPhotos: () => (
      <UnifiedPhotoManager
        contactType="company"
        formData={formData}
        handlers={{ handleLogoChange: ctx.handleLogoChange, handleFileChange: ctx.handleFileChange, handleUploadedLogoURL: ctx.handleUploadedLogoURL, handleUploadedPhotoURL: ctx.handleUploadedPhotoURL }}
        uploadHandlers={getPhotoUploadHandlers(formData, ctx.canonicalUploadContext)}
        disabled={disabled}
        className="mt-4"
      />
    ),

    activities: () => {
      const currentActivities: KadActivity[] = formData.activities ?? [];
      const effectiveActivities: KadActivity[] = currentActivities.length > 0
        ? currentActivities
        : formData.activityCodeKAD ? [{ code: formData.activityCodeKAD, description: formData.activityDescription ?? '', type: 'primary' as const }] : [];
      return (
        <ContactKadSection
          activities={effectiveActivities} chamber={formData.chamber ?? ''} disabled={disabled}
          onChange={({ activities: newActs, chamber }) => {
            if (!setFormData) return;
            const primary = newActs.find(a => a.type === 'primary');
            setFormData({ ...formData, activities: newActs, chamber, activityCodeKAD: primary?.code ?? '', activityDescription: primary?.description ?? '', activityType: 'main' });
          }}
        />
      );
    },

    addresses: () => (
      <AddressesSectionWithFullscreen
        formData={formData}
        setFormData={setFormData ? (value) => {
          const newData = typeof value === 'function' ? value(formData) : value;
          setFormData(newData);
        } : undefined}
        disabled={disabled}
      />
    ),
  };
}
