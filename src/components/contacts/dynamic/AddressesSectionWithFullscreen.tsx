'use client';
/**
 * AddressesSectionWithFullscreen — Standalone wrapper for company addresses tab
 *
 * Extracted from UnifiedContactTabbedSection inline renderer so that
 * useFullscreen hook has proper React lifecycle (not inside useMemo).
 *
 * @enterprise ADR-241 (Fullscreen centralization)
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AddressEditor, AddressSourceLabel } from '@/components/shared/addresses/editor';
import type { AddressEditorHandle, ResolvedAddressFields } from '@/components/shared/addresses/editor';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import { CompanyAddressesSection, type CompanyAddressesSectionHandle } from '@/components/contacts/dynamic/CompanyAddressesSection';
import { ContactAddressMapPreview, type DragResolvedAddress } from '@/components/contacts/details/ContactAddressMapPreview';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ProjectAddress } from '@/types/project/addresses';
import { createProjectAddress } from '@/types/project/address-helpers';
import { useClearCompanyHqAddress } from '@/components/contacts/dynamic/useClearCompanyHqAddress';
import { useDerivedWorkAddresses } from '@/components/contacts/relationships/hooks/useDerivedWorkAddresses';
import { AddressTypeSelector } from '@/components/contacts/addresses/AddressTypeSelector';
import { resolveContactAddressLabel } from '@/components/contacts/addresses/contactAddressLabel';
import { getPrimaryAddressType, type ContactAddressType } from '@/types/contacts/address-types';
import { useNotifications } from '@/providers/NotificationProvider';

interface AddressesSectionWithFullscreenProps {
  formData: ContactFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ContactFormData>>;
  disabled: boolean;
}

function formatHqStreetLine(formData: ContactFormData): string {
  const parts = [
    formData.street,
    formData.streetNumber,
    formData.city,
    formData.postalCode,
  ].filter(Boolean);
  return parts.join(', ');
}

function formDataToResolvedFields(fd: ContactFormData): ResolvedAddressFields {
  return {
    street: (fd.street as string) || undefined,
    number: (fd.streetNumber as string) || undefined,
    postalCode: (fd.postalCode as string) || undefined,
    city: (fd.city as string) || (fd.settlement as string) || undefined,
    region: (fd.region as string) || undefined,
  };
}

export function AddressesSectionWithFullscreen({
  formData,
  setFormData,
  disabled,
}: AddressesSectionWithFullscreenProps) {
  const { t: tContacts } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const { t: tAddr } = useTranslation('addresses');
  const fullscreen = useFullscreen();
  const { clearHq } = useClearCompanyHqAddress(formData, setFormData);
  const { notify } = useNotifications();

  const [isEditingHQ, setIsEditingHQ] = useState(false);
  const [undoRedoCount, setUndoRedoCount] = useState(0);
  const branchRef = useRef<CompanyAddressesSectionHandle>(null);
  const hqEditorRef = useRef<AddressEditorHandle>(null);

  const handleUndoRedo = useCallback(() => {
    setUndoRedoCount(n => n + 1);
  }, []);

  // ADR-318: live-derived work addresses from professional relationships.
  // Returns [] for company/service contacts (semantic filter inside hook).
  const { derived: derivedWorkAddresses } = useDerivedWorkAddresses(formData.id);

  // ADR-318: map derived work addresses into ProjectAddress pins for the map
  // preview. They render as read-only markers (never draggable) since the
  // source of truth is the company address itself.
  const workTypeLabel = tAddr('types.work');
  const derivedPinAddresses = useMemo<ProjectAddress[]>(
    () => derivedWorkAddresses
      .filter(addr => addr.city?.trim() || (addr.street?.trim() && addr.postalCode?.trim()))
      .map((addr, idx) => createProjectAddress({
        id: `derived-work-${addr.companyId || 'unknown'}-${idx}`,
        street: addr.street?.trim() || '',
        number: addr.number?.trim() || undefined,
        postalCode: addr.postalCode?.trim() || '',
        city: addr.city?.trim() || '',
        region: addr.region?.trim() || undefined,
        type: 'other',
        label: `${workTypeLabel} — ${addr.companyName}`,
        isPrimary: false,
      })),
    [derivedWorkAddresses, workTypeLabel]
  );

  // Close inline form when global edit mode ends
  React.useEffect(() => {
    if (disabled) setIsEditingHQ(false);
  }, [disabled]);

  // Stable resolved fields for the HQ AddressEditor (recomputed only when basic fields change).
  const hqResolvedFields = useMemo(
    () => formDataToResolvedFields(formData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData.street, formData.streetNumber, formData.postalCode, formData.city, formData.region],
  );

  // Called by AddressEditor when reconciliation/suggestion changes basic fields — keeps hierarchy.
  const handleHqChange = useCallback((addr: ResolvedAddressFields) => {
    if (!setFormData) return;
    setFormData(prev => {
      const existing = (prev.companyAddresses ?? []) as CompanyAddress[];
      const updatedAddresses = existing.length > 0
        ? [{ ...existing[0], street: addr.street ?? existing[0].street, number: addr.number ?? existing[0].number, postalCode: addr.postalCode ?? existing[0].postalCode, city: addr.city ?? existing[0].city }, ...existing.slice(1)]
        : existing;
      return {
        ...prev,
        street: addr.street ?? (prev.street as string) ?? '',
        streetNumber: addr.number ?? (prev.streetNumber as string) ?? '',
        postalCode: addr.postalCode ?? (prev.postalCode as string) ?? '',
        city: addr.city ?? (prev.city as string) ?? '',
        region: addr.region ?? (prev.region as string) ?? '',
        ...(addr.country !== undefined ? { hqAddressCountry: addr.country } : {}),
        ...(updatedAddresses.length > 0 ? { companyAddresses: updatedAddresses } : {}),
      };
    });
  }, [setFormData]);

  const isEditing = !disabled;

  /** Has any HQ field been filled? Drives disabled state of Clear button. */
  const hqHasValue =
    !!formData.street ||
    !!formData.streetNumber ||
    !!formData.postalCode ||
    !!formData.city ||
    !!formData.settlement ||
    !!formData.settlementId ||
    !!formData.community ||
    !!formData.municipalUnit ||
    !!formData.municipality ||
    !!formData.municipalityId ||
    !!formData.regionalUnit ||
    !!formData.region ||
    !!formData.decentAdmin ||
    !!formData.majorGeo;

  /** Keyboard affordance: Ctrl+Backspace on HQ form triggers clear. */
  const handleHqKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && e.key === 'Backspace' && isEditing && hqHasValue) {
      e.preventDefault();
      clearHq();
    }
  }, [clearHq, isEditing, hqHasValue]);

  /**
   * Apply drag-resolved address to form state (clears hierarchy fields).
   * If OSM did not return a house number (addr.number is empty), we open the
   * HQ inline editor and raise a toast so the user knows to type it manually
   * — Modo 4 UX fallback for the OSM coverage gap.
   */
  const maybeWarnMissingNumber = useCallback((addr: DragResolvedAddress) => {
    if (addr.number?.trim()) return;
    setIsEditingHQ(true);
    notify(tContacts('contacts-form:addressesSection.dragMissingNumber'), {
      type: 'info',
      duration: 6000,
    });
  }, [notify, tContacts]);

  const applyDragResolve = useCallback((addr: DragResolvedAddress, addressIndex: number) => {
    if (!setFormData) return;
    const existing = formData.companyAddresses ?? [];

    // Individual contact: no companyAddresses array — update HQ flat fields directly.
    // Without this branch, the multi-address path would zero out street/city because
    // `updatedAddresses[0]` is undefined, making the map pin disappear after drag.
    if (existing.length === 0) {
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
      maybeWarnMissingNumber(addr);
      return;
    }

    const updatedAddresses = [...existing];
    if (addressIndex >= 0 && addressIndex < updatedAddresses.length) {
      updatedAddresses[addressIndex] = {
        ...updatedAddresses[addressIndex],
        street: addr.street,
        number: addr.number,
        postalCode: addr.postalCode,
        city: addr.city,
      };
    }
    // ADR-319: HQ is always index 0 (positional invariant across contact types).
    const hq = updatedAddresses[0];
    setFormData({
      ...formData,
      companyAddresses: updatedAddresses,
      street: hq?.street ?? '',
      streetNumber: hq?.number ?? '',
      postalCode: hq?.postalCode ?? '',
      city: hq?.city ?? '',
      settlement: hq?.city ?? '',
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
    maybeWarnMissingNumber(addr);
  }, [formData, setFormData, maybeWarnMissingNumber]);

  // Called by AddressEditor specifically on drag confirm — clears hierarchy (ADR-277).
  const handleHqDragApplied = useCallback((addr: ResolvedAddressFields) => {
    applyDragResolve({
      street: addr.street ?? '',
      number: addr.number ?? '',
      postalCode: addr.postalCode ?? '',
      city: addr.city ?? '',
      neighborhood: '',
      region: addr.region ?? '',
    }, 0);
  }, [applyDragResolve]);

  // ADR-319: semantic type for the primary (flat-field) address — resolved from
  // formData or derived from the contact type (`home` for individuals,
  // `headquarters` for companies/services).
  const primaryType: ContactAddressType = formData.primaryAddressType ?? getPrimaryAddressType(formData.type);
  const primaryCustomLabel = formData.primaryAddressCustomLabel;

  const currentAddresses: CompanyAddress[] = formData.companyAddresses ?? [];
  const effectiveAddresses: CompanyAddress[] = currentAddresses.length > 0
    ? currentAddresses
    : formData.street
      ? [{ type: primaryType, customLabel: primaryCustomLabel, street: formData.street as string, number: (formData.streetNumber as string) ?? '', postalCode: (formData.postalCode as string) ?? '', city: (formData.city as string) ?? '' }]
      : [{ type: primaryType, customLabel: primaryCustomLabel, street: '', number: '', postalCode: '', city: '' }];

  // Extracted from JSX to keep AddressEditor children concise (ADR-332 Phase 6).
  const handleHqHierarchyChange = useCallback((addr: AddressWithHierarchyValue) => {
    if (!setFormData) return;
    const updatedAddresses = [...effectiveAddresses];
    if (updatedAddresses.length > 0) {
      updatedAddresses[0] = { ...updatedAddresses[0], street: addr.street, number: addr.number,
        city: addr.settlementName || addr.municipalityName, postalCode: addr.postalCode,
        country: addr.country || undefined, settlementId: addr.settlementId,
        communityName: addr.communityName, municipalUnitName: addr.municipalUnitName,
        municipalityName: addr.municipalityName, municipalityId: addr.municipalityId,
        regionalUnitName: addr.regionalUnitName, regionName: addr.regionName,
        region: addr.regionName, decentAdminName: addr.decentAdminName, majorGeoName: addr.majorGeoName };
    }
    setFormData({ ...formData, street: addr.street, streetNumber: addr.number,
      postalCode: addr.postalCode, hqAddressCountry: addr.country || undefined,
      city: addr.settlementName || addr.municipalityName, settlement: addr.settlementName,
      settlementId: addr.settlementId, community: addr.communityName, municipalUnit: addr.municipalUnitName,
      municipality: addr.municipalityName, municipalityId: addr.municipalityId,
      regionalUnit: addr.regionalUnitName, region: addr.regionName,
      decentAdmin: addr.decentAdminName, majorGeo: addr.majorGeoName, companyAddresses: updatedAddresses });
  }, [formData, setFormData, effectiveAddresses]);

  const tAddrFn = useCallback((key: string) => tAddr(key) as string, [tAddr]);
  const hqTypeLabel = resolveContactAddressLabel(primaryType, primaryCustomLabel, tAddrFn);

  const handlePrimaryTypeChange = useCallback((next: { type: ContactAddressType; customLabel?: string }) => {
    if (!setFormData) return;
    const existing = formData.companyAddresses ?? [];
    const updated = existing.length > 0
      ? [{ ...existing[0], type: next.type, customLabel: next.customLabel }, ...existing.slice(1)]
      : existing;
    setFormData({
      ...formData,
      primaryAddressType: next.type,
      primaryAddressCustomLabel: next.customLabel,
      ...(existing.length > 0 ? { companyAddresses: updated } : {}),
    });
  }, [formData, setFormData]);

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel="Διευθύνσεις & Υποκαταστήματα"
      className="grid grid-cols-1 lg:grid-cols-2 gap-2"
      fullscreenClassName="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-auto"
    >
      {/* LEFT: HQ address + Branches */}
      <div className="space-y-2">

        {/* Toolbar: Fullscreen toggle (left) + Add address button (right) */}
        <div className="flex items-center justify-between">
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          {isEditing && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => branchRef.current?.addBranch()}
            >
              <Plus className="mr-1 h-4 w-4" />
              {tAddr('locations.newAddress')}
            </Button>
          )}
        </div>

        {/* Section title — individuals show "Διευθύνσεις", companies/services show "Υποκαταστήματα / Επιπλέον Διευθύνσεις" */}
        <h3 className="text-lg font-semibold text-foreground">
          {formData.type === 'individual'
            ? tContacts('contacts-form:addressesSection.individualTitle')
            : tContacts('contacts-form:addressesSection.branchesTitle')}
          {' '}({effectiveAddresses.length + derivedWorkAddresses.length})
        </h3>

        {/* HQ — card view OR inline edit form with AddressEditor (ADR-332 Phase 6) */}
        {!isEditingHQ ? (
          <SharedAddressActionCard
            id="hq"
            streetLine={formatHqStreetLine(formData)}
            typeLabel={hqTypeLabel}
            isEditing={isEditing}
            onEdit={() => setIsEditingHQ(true)}
            onClear={clearHq}
            editLabel={tContacts('contacts-form:addressesSection.editAddress')}
            clearLabel={tContacts('contacts-form:addressesSection.clearAddress')}
          />
        ) : (
          <div className="border-2 border-primary rounded-lg p-3 space-y-3" onKeyDown={handleHqKeyDown}>
            <div className="flex items-center">
              <AddressTypeSelector
                contactType={formData.type}
                value={primaryType}
                customLabel={primaryCustomLabel}
                disabled={disabled}
                onChange={handlePrimaryTypeChange}
              />
            </div>
            <AddressEditor
              ref={hqEditorRef}
              value={hqResolvedFields}
              onChange={handleHqChange}
              onDragApplied={handleHqDragApplied}
              onUndoRedo={handleUndoRedo}
              mode="edit"
              domain="contact"
              formOptions={{ hideGrid: true, showNeighborhoodRegion: true }}
              telemetry={{ enabled: true, contextEntityType: 'contact', contextEntityId: formData.id ?? '' }}
            >
              <AddressWithHierarchy
                value={{
                  street: (formData.street as string) || '',
                  number: (formData.streetNumber as string) || '',
                  postalCode: (formData.postalCode as string) || '',
                  country: formData.hqAddressCountry || '',
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
                onChange={handleHqHierarchyChange}
                disabled={disabled}
              />
            </AddressEditor>
            <div className="flex justify-end border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setIsEditingHQ(false)}>
                {tAddr('deleteDialog.cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Branches section */}
        <CompanyAddressesSection
          ref={branchRef}
          hideAddButton
          hideSectionTitle
          addresses={effectiveAddresses}
          disabled={disabled}
          contactType={formData.type}
          onChange={(newAddresses) => {
            if (!setFormData) return;
            // ADR-319: HQ lives at index 0 (positional invariant) — `home` is
            // primary for individuals, `headquarters` for companies/services,
            // so find-by-type cannot match across both scopes.
            const hq = newAddresses[0];
            setFormData({
              ...formData,
              companyAddresses: newAddresses,
              street: hq?.street ?? '',
              streetNumber: hq?.number ?? '',
              postalCode: hq?.postalCode ?? '',
              city: hq?.city ?? '',
              ...(hq ? { primaryAddressType: hq.type, primaryAddressCustomLabel: hq.customLabel } : {}),
            });
          }}
        />

        {/* ADR-318: Derived work addresses (read-only) — source label shows "derived" */}
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
                <div className="mt-1 pl-1">
                  <AddressSourceLabel source="derived" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RIGHT: Map preview — draggable pin in edit mode */}
      <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-7rem)]">
        <ContactAddressMapPreview
          className="!min-h-0 h-full rounded-lg"
          contactId={formData.id}
          street={formData.street}
          streetNumber={formData.streetNumber}
          city={formData.city}
          postalCode={formData.postalCode}
          companyAddresses={formData.companyAddresses}
          readOnlyExtraAddresses={derivedPinAddresses}
          draggable={isEditing}
          dragResetKey={undoRedoCount}
          onDragResolve={isEditing && setFormData ? (addr: DragResolvedAddress, addressIndex: number) => {
            // ADR-319: HQ is always index 0.
            // HQ drag → AddressEditor confirm dialog (ADR-332 Phase 6, replaces ADR-277 AlertDialog).
            // Branch drag → apply directly (no hierarchy to clear for branches).
            if (addressIndex === 0) {
              // Ensure AddressEditor is mounted before calling setPendingDrag.
              // If isEditingHQ is false, the editor ref is null — open it synchronously.
              if (!hqEditorRef.current) {
                flushSync(() => setIsEditingHQ(true));
              }
              hqEditorRef.current?.setPendingDrag({
                street: addr.street,
                number: addr.number,
                postalCode: addr.postalCode,
                city: addr.city,
                neighborhood: addr.neighborhood,
                region: addr.region,
                country: addr.country,
              });
            } else {
              applyDragResolve(addr, addressIndex);
            }
          } : undefined}
        />
      </aside>
    </FullscreenOverlay>
  );
}
