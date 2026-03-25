'use client';
import React from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink } from 'lucide-react';
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import { EscoSkillPicker } from '@/components/shared/EscoSkillPicker';
import type { EscoPickerValue, EscoSkillValue } from '@/types/contacts/esco-types';
import { EmployerPicker } from '@/components/shared/EmployerPicker';
import type { EmployerPickerValue } from '@/components/shared/EmployerPicker';
import { MinistryPicker } from '@/components/shared/MinistryPicker';
import { PublicServicePicker } from '@/components/contacts/pickers/PublicServicePicker';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { ContactAddressMapPreview, type DragResolvedAddress } from '@/components/contacts/details/ContactAddressMapPreview';
import type { RendererContext, CustomRendererField } from './contactRenderersCore';

type RendererFn = (
  field: CustomRendererField,
  fieldFormData: Record<string, unknown>,
  fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  fieldOnSelectChange: (name: string, value: string) => void,
  fieldDisabled: boolean,
) => React.ReactNode;

// ── Shared Address Layout ──────────────────────────────────────
function AddressWithMap({
  formData, setFormData, disabled,
}: Pick<RendererContext, 'formData' | 'setFormData' | 'disabled'>) {
  const handleAddressChange = (addr: AddressWithHierarchyValue) => {
    if (!setFormData) return;
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
  };

  const handleDragResolve = !disabled && setFormData
    ? (resolved: DragResolvedAddress) => {
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
    }
    : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        onChange={handleAddressChange}
        disabled={disabled}
      />
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
          onDragResolve={handleDragResolve ? (addr: DragResolvedAddress, _index: number) => handleDragResolve(addr) : undefined}
        />
      </aside>
    </div>
  );
}

/**
 * Build individual-specific renderers (profession, employer, skills, clientSince, address).
 */
export function buildIndividualRenderers(ctx: RendererContext): Record<string, RendererFn | (() => React.ReactNode)> {
  if (ctx.contactType !== 'individual') return {};

  const { formData, setFormData, disabled, t } = ctx;

  return {
    profession: (
      _field: CustomRendererField, _fd: Record<string, unknown>,
      _onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
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

    employer: (
      _field: CustomRendererField, _fd: Record<string, unknown>,
      _onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
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

    skills: (
      _field: CustomRendererField, _fd: Record<string, unknown>,
      _onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
      <EscoSkillPicker
        value={formData.escoSkills ?? []}
        disabled={fieldDisabled}
        onChange={(skills: EscoSkillValue[]) => {
          if (setFormData) setFormData({ ...formData, escoSkills: skills });
        }}
      />
    ),

    clientSince: () => {
      const rawValue = (formData as unknown as Record<string, unknown>).clientSince as string | null;
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
          <Link href="/sales/available-apartments" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('persona.links.viewClientPurchases', 'Προβολή αγορών πελάτη')}
          </Link>
        </section>
      );
    },

    address: () => <AddressWithMap formData={formData} setFormData={setFormData} disabled={disabled} />,
  };
}

/**
 * Build service-specific renderers (name/PublicServicePicker, ministry, address).
 */
export function buildServiceRenderers(ctx: RendererContext): Record<string, RendererFn | (() => React.ReactNode)> {
  if (ctx.contactType !== 'service') return {};

  const { formData, setFormData, disabled } = ctx;

  return {
    name: (
      _field: CustomRendererField, _fd: Record<string, unknown>,
      _onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
      <PublicServicePicker
        value={(formData.name as string) ?? ''}
        disabled={fieldDisabled}
        onNameChange={(name: string) => { if (setFormData) setFormData({ ...formData, name }); }}
        onEntitySelected={(entity) => {
          if (setFormData) setFormData({ ...formData, name: entity.name, supervisionMinistry: entity.supervisingMinistry });
        }}
      />
    ),

    supervisionMinistry: (
      _field: CustomRendererField, _fd: Record<string, unknown>,
      _onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
      _onSelect: (n: string, v: string) => void, fieldDisabled: boolean,
    ) => (
      <MinistryPicker
        value={formData.supervisionMinistry ?? ''}
        disabled={fieldDisabled}
        onChange={(name: string) => { if (setFormData) setFormData({ ...formData, supervisionMinistry: name }); }}
      />
    ),

    address: () => <AddressWithMap formData={formData} setFormData={setFormData} disabled={disabled} />,
  };
}

/**
 * Build section footer renderers.
 */
export function buildSectionFooterRenderers(ctx: RendererContext): Record<string, () => React.ReactNode> {
  const { formData } = ctx;
  return {
    contact: () => (
      <ContactAddressMapPreview
        contactId={formData.id}
        street={formData.street}
        streetNumber={formData.streetNumber}
        city={formData.city}
        postalCode={formData.postalCode}
      />
    ),
  };
}
