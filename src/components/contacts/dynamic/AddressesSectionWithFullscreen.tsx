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
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
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

// ============================================================================
// TYPES
// ============================================================================

interface AddressesSectionWithFullscreenProps {
  formData: ContactFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ContactFormData>>;
  disabled: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatHqStreetLine(formData: ContactFormData): string {
  const parts = [
    formData.street,
    formData.streetNumber,
    formData.city,
    formData.postalCode,
  ].filter(Boolean);
  return parts.join(', ');
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddressesSectionWithFullscreen({
  formData,
  setFormData,
  disabled,
}: AddressesSectionWithFullscreenProps) {
  const { t: tContacts } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const { t: tCommon } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const { t: tAddr } = useTranslation('addresses');
  const fullscreen = useFullscreen();
  const { clearHq } = useClearCompanyHqAddress(formData, setFormData);

  const [isEditingHQ, setIsEditingHQ] = useState(false);
  const branchRef = useRef<CompanyAddressesSectionHandle>(null);

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

  // 📍 ADR-277: Pending drag resolve state (map drag may clear hierarchy)
  const [pendingDrag, setPendingDrag] = useState<{ addr: DragResolvedAddress; index: number } | null>(null);

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

  /** Apply drag-resolved address to form state (clears hierarchy fields) */
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
    const hq = updatedAddresses.find(a => a.type === 'headquarters') ?? updatedAddresses[0];
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
  }, [formData, setFormData]);

  const currentAddresses: CompanyAddress[] = formData.companyAddresses ?? [];
  const effectiveAddresses: CompanyAddress[] = currentAddresses.length > 0
    ? currentAddresses
    : formData.street
      ? [{ type: 'headquarters' as const, street: formData.street as string, number: (formData.streetNumber as string) ?? '', postalCode: (formData.postalCode as string) ?? '', city: (formData.city as string) ?? '' }]
      : [{ type: 'headquarters' as const, street: '', number: '', postalCode: '', city: '' }];

  const hqTypeLabel = tContacts('contacts-form:addressesSection.headquarters');

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

        {/* HQ — card view OR inline edit form */}
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{hqTypeLabel}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingHQ(false)}>
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
              onChange={(addr: AddressWithHierarchyValue) => {
                if (setFormData) {
                  const updatedAddresses = [...effectiveAddresses];
                  const hqIdx = updatedAddresses.findIndex(a => a.type === 'headquarters');
                  if (hqIdx >= 0) {
                    updatedAddresses[hqIdx] = {
                      ...updatedAddresses[hqIdx],
                      street: addr.street,
                      number: addr.number,
                      city: addr.settlementName || addr.municipalityName,
                      postalCode: addr.postalCode,
                      settlementId: addr.settlementId,
                      communityName: addr.communityName,
                      municipalUnitName: addr.municipalUnitName,
                      municipalityName: addr.municipalityName,
                      municipalityId: addr.municipalityId,
                      regionalUnitName: addr.regionalUnitName,
                      regionName: addr.regionName,
                      region: addr.regionName,
                      decentAdminName: addr.decentAdminName,
                      majorGeoName: addr.majorGeoName,
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
          onChange={(newAddresses) => {
            if (!setFormData) return;
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

        {/* ADR-318: Derived work addresses from professional relationships (read-only) */}
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
          onDragResolve={isEditing && setFormData ? (addr: DragResolvedAddress, addressIndex: number) => {
            // 📍 ADR-277: Check if HQ has hierarchy that would be cleared.
            // Individuals keep hierarchy on flat formData fields (no companyAddresses entry),
            // so also look at formData.settlementId when the target pin is the HQ.
            const targetAddr = effectiveAddresses[addressIndex];
            const isHQ = addressIndex === 0 || targetAddr?.type === 'headquarters';
            const hasHierarchy = isHQ && (targetAddr?.settlementId || formData.settlementId);

            if (hasHierarchy) {
              setPendingDrag({ addr, index: addressIndex });
              return;
            }
            applyDragResolve(addr, addressIndex);
          } : undefined}
        />
      </aside>

      {/* 📍 ADR-277: Map drag hierarchy warning */}
      <AlertDialog open={pendingDrag !== null} onOpenChange={(open) => { if (!open) setPendingDrag(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('contacts.addressImpact.mapDragWarning.title')}</AlertDialogTitle>
            <AlertDialogDescription>{tCommon('contacts.addressImpact.mapDragWarning.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('contacts.addressImpact.mapDragWarning.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingDrag) {
                applyDragResolve(pendingDrag.addr, pendingDrag.index);
                setPendingDrag(null);
              }
            }}>
              {tCommon('contacts.addressImpact.mapDragWarning.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FullscreenOverlay>
  );
}
