'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import { Button } from '@/components/ui/button';
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
import '@/lib/design-system';

type RendererFn = (
  field: CustomRendererField,
  fieldFormData: Record<string, unknown>,
  fieldOnChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  fieldOnSelectChange: (name: string, value: string) => void,
  fieldDisabled: boolean,
) => React.ReactNode;

// ── Individual Address Layout (SSoT pattern — mirrors company HQ) ─────────────
function AddressWithMap({
  formData, setFormData, disabled,
}: Pick<RendererContext, 'formData' | 'setFormData' | 'disabled'>) {
  const { t: tAddr } = useTranslation('addresses');
  const { t: tForm } = useTranslation('contacts-form');
  const fullscreen = useFullscreen();
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  useEffect(() => {
    if (disabled) setIsEditingAddress(false);
  }, [disabled]);

  const hasValue = !!(
    formData.street || formData.streetNumber || formData.city ||
    formData.postalCode || formData.settlementId
  );

  const clearAddress = () => {
    if (!setFormData) return;
    setFormData({
      ...formData,
      street: '', streetNumber: '', postalCode: '', city: '',
      settlement: '', settlementId: null, community: '', municipalUnit: '',
      municipality: '', municipalityId: null, regionalUnit: '', region: '',
      decentAdmin: '', majorGeo: '',
    });
  };

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

  const streetLine = [formData.street, formData.streetNumber, formData.city, formData.postalCode]
    .filter(Boolean).join(', ');
  const typeLabel = tAddr('types.home');

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel={tAddr('list.title')}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      fullscreenClassName="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-auto"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
        </div>

        <h3 className="text-lg font-semibold text-foreground">{tAddr('list.title')}</h3>

        {!isEditingAddress ? (
          <SharedAddressActionCard
            id="individual-address"
            streetLine={streetLine}
            typeLabel={typeLabel}
            isEditing={!disabled}
            onEdit={() => setIsEditingAddress(true)}
            onClear={hasValue ? clearAddress : undefined}
            editLabel={tForm('addressesSection.editAddress')}
            clearLabel={tForm('addressesSection.clearAddress')}
          />
        ) : (
          <div className="border-2 border-primary rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{typeLabel}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingAddress(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
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
            <div className="flex justify-end border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setIsEditingAddress(false)}>
                {tAddr('deleteDialog.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>

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
    </FullscreenOverlay>
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
          <Link href="/sales/available-properties" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
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
