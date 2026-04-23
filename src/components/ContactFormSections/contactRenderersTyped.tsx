'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, X, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import { Button } from '@/components/ui/button';
import { IndividualAddressesSection, type IndividualAddressesSectionHandle } from '@/components/contacts/dynamic/IndividualAddressesSection';
import type { IndividualAddress } from '@/types/ContactFormTypes';
import { useDerivedWorkAddresses } from '@/components/contacts/relationships/hooks/useDerivedWorkAddresses';
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

// ── Individual Address Layout (SSoT — mirrors AddressesSectionWithFullscreen) ─
function AddressWithMap({
  formData, setFormData, disabled,
}: Pick<RendererContext, 'formData' | 'setFormData' | 'disabled'>) {
  const { t: tAddr } = useTranslation('addresses');
  const { t: tForm } = useTranslation('contacts-form');
  const fullscreen = useFullscreen();
  const extraRef = useRef<IndividualAddressesSectionHandle>(null);
  const [isEditingHome, setIsEditingHome] = useState(false);
  const { derived: derivedWorkAddresses } = useDerivedWorkAddresses(formData.id as string | undefined);

  useEffect(() => {
    if (disabled) setIsEditingHome(false);
  }, [disabled]);

  // Compute effective addresses: use individualAddresses array or fall back to flat fields
  const homeFromFlat: IndividualAddress = {
    type: 'home',
    street: (formData.street as string) || '',
    number: (formData.streetNumber as string) || '',
    postalCode: (formData.postalCode as string) || '',
    city: (formData.city as string) || '',
    settlementId: (formData.settlementId as string | null) ?? null,
    communityName: (formData.community as string) || '',
    municipalUnitName: (formData.municipalUnit as string) || '',
    municipalityName: (formData.municipality as string) || '',
    municipalityId: (formData.municipalityId as string | null) ?? null,
    regionalUnitName: (formData.regionalUnit as string) || '',
    regionName: (formData.region as string) || '',
    decentAdminName: (formData.decentAdmin as string) || '',
    majorGeoName: (formData.majorGeo as string) || '',
  };

  const effectiveAddresses: IndividualAddress[] =
    (formData.individualAddresses as IndividualAddress[] | undefined)?.length
      ? (formData.individualAddresses as IndividualAddress[])
      : [homeFromFlat];

  const home = effectiveAddresses[0];
  const isEditing = !disabled;
  const totalCount = effectiveAddresses.length;

  const homeStreetLine = [home.street, home.number, home.city, home.postalCode].filter(Boolean).join(', ');
  const homeTypeLabel = tAddr('types.home');

  /** Sync flat fields + individualAddresses from a new home address */
  const applyHome = (updated: IndividualAddress) => {
    if (!setFormData) return;
    const newAll = [updated, ...effectiveAddresses.slice(1)];
    setFormData({
      ...formData,
      street: updated.street,
      streetNumber: updated.number,
      postalCode: updated.postalCode,
      city: updated.city,
      settlement: updated.city,
      settlementId: updated.settlementId ?? null,
      community: updated.communityName ?? '',
      municipalUnit: updated.municipalUnitName ?? '',
      municipality: updated.municipalityName ?? '',
      municipalityId: updated.municipalityId ?? null,
      regionalUnit: updated.regionalUnitName ?? '',
      region: updated.regionName ?? '',
      decentAdmin: updated.decentAdminName ?? '',
      majorGeo: updated.majorGeoName ?? '',
      individualAddresses: newAll,
    });
  };

  const clearHome = () => applyHome({ ...home, street: '', number: '', postalCode: '', city: '',
    settlementId: null, communityName: '', municipalUnitName: '', municipalityName: '',
    municipalityId: null, regionalUnitName: '', regionName: '', decentAdminName: '', majorGeoName: '' });

  const handleHomeChange = (addr: AddressWithHierarchyValue) => applyHome({
    ...home,
    street: addr.street,
    number: addr.number,
    postalCode: addr.postalCode,
    city: addr.settlementName || addr.municipalityName,
    settlementId: addr.settlementId,
    communityName: addr.communityName,
    municipalUnitName: addr.municipalUnitName,
    municipalityName: addr.municipalityName,
    municipalityId: addr.municipalityId,
    regionalUnitName: addr.regionalUnitName,
    regionName: addr.regionName,
    decentAdminName: addr.decentAdminName,
    majorGeoName: addr.majorGeoName,
  });

  const handleExtraChange = (newAll: IndividualAddress[]) => {
    if (!setFormData) return;
    setFormData({ ...formData, individualAddresses: newAll });
  };

  const handleDragResolve = isEditing && setFormData
    ? (resolved: DragResolvedAddress) => applyHome({
      ...home,
      street: resolved.street,
      number: resolved.number,
      postalCode: resolved.postalCode,
      city: resolved.city,
      settlementId: null, communityName: '', municipalUnitName: '',
      municipalityName: '', municipalityId: null, regionalUnitName: '',
      regionName: '', decentAdminName: '', majorGeoName: '',
    })
    : undefined;

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel={tAddr('list.title')}
      className="grid grid-cols-1 lg:grid-cols-2 gap-2"
      fullscreenClassName="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-auto"
    >
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          {isEditing && (
            <Button type="button" variant="default" size="sm" onClick={() => extraRef.current?.addAddress()}>
              <Plus className="mr-1 h-4 w-4" />
              {tAddr('locations.newAddress')}
            </Button>
          )}
        </div>

        {/* Section title with total count */}
        <h3 className="text-lg font-semibold text-foreground">
          {tAddr('list.title')} ({totalCount})
        </h3>

        {/* Home address — card or inline edit */}
        {!isEditingHome ? (
          <SharedAddressActionCard
            id="individual-home"
            streetLine={homeStreetLine}
            typeLabel={homeTypeLabel}
            isEditing={isEditing}
            onEdit={() => setIsEditingHome(true)}
            onClear={clearHome}
            editLabel={tForm('addressesSection.editAddress')}
            clearLabel={tForm('addressesSection.clearAddress')}
          />
        ) : (
          <div className="border-2 border-primary rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{homeTypeLabel}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingHome(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <AddressWithHierarchy
              value={{
                street: home.street,
                number: home.number,
                postalCode: home.postalCode,
                settlementName: (formData.settlement as string) || home.city,
                settlementId: home.settlementId ?? null,
                communityName: home.communityName ?? '',
                municipalUnitName: home.municipalUnitName ?? '',
                municipalityName: home.municipalityName ?? '',
                municipalityId: home.municipalityId ?? null,
                regionalUnitName: home.regionalUnitName ?? '',
                regionName: home.regionName ?? '',
                decentAdminName: home.decentAdminName ?? '',
                majorGeoName: home.majorGeoName ?? '',
              }}
              onChange={handleHomeChange}
              disabled={disabled}
            />
            <div className="flex justify-end border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setIsEditingHome(false)}>
                {tAddr('deleteDialog.cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Extra addresses (work, vacation, other) */}
        <IndividualAddressesSection
          ref={extraRef}
          hideAddButton
          hideSectionTitle
          addresses={effectiveAddresses}
          disabled={disabled}
          onChange={handleExtraChange}
        />

        {/* Derived work addresses from professional relationships (ADR-318, read-only) */}
        {derivedWorkAddresses.length > 0 && (
          <ul className="space-y-4 pt-2">
            {derivedWorkAddresses.map((addr, i) => (
              <li key={`derived-work-${addr.companyId}-${i}`}>
                <SharedAddressActionCard
                  id={`derived-work-${addr.companyId}-${i}`}
                  streetLine={[addr.street, addr.number, addr.city, addr.postalCode].filter(Boolean).join(', ')}
                  typeLabel={`${tAddr('types.work')} — ${addr.companyName}`}
                  isEditing={false}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map — always visible, tracks home address */}
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
          draggable={isEditing}
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
