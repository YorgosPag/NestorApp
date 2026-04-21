'use client';

/**
 * AddressesSectionWithFullscreen — Standalone wrapper for company addresses tab
 *
 * Extracted from UnifiedContactTabbedSection inline renderer so that
 * useFullscreen hook has proper React lifecycle (not inside useMemo).
 *
 * @enterprise ADR-241 (Fullscreen centralization)
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser } from 'lucide-react';
import '@/lib/design-system';
import { useFullscreen } from '@/hooks/useFullscreen';
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
import { Button } from '@/components/ui/button';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { CompanyAddressesSection } from '@/components/contacts/dynamic/CompanyAddressesSection';
import { ContactAddressMapPreview, type DragResolvedAddress } from '@/components/contacts/details/ContactAddressMapPreview';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { useClearCompanyHqAddress } from '@/components/contacts/dynamic/useClearCompanyHqAddress';

// ============================================================================
// TYPES
// ============================================================================

interface AddressesSectionWithFullscreenProps {
  formData: ContactFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ContactFormData>>;
  disabled: boolean;
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
  const fullscreen = useFullscreen();
  const { clearHq } = useClearCompanyHqAddress(formData, setFormData);

  // 📍 ADR-277: Pending drag resolve state (map drag may clear hierarchy)
  const [pendingDrag, setPendingDrag] = useState<{ addr: DragResolvedAddress; index: number } | null>(null);

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
    if (e.ctrlKey && e.key === 'Backspace' && !disabled && hqHasValue) {
      e.preventDefault();
      clearHq();
    }
  }, [clearHq, disabled, hqHasValue]);

  /** Apply drag-resolved address to form state (clears hierarchy fields) */
  const applyDragResolve = useCallback((addr: DragResolvedAddress, addressIndex: number) => {
    if (!setFormData) return;
    const updatedAddresses = [...(formData.companyAddresses ?? [])];
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

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel="Διευθύνσεις & Υποκαταστήματα"
      className="grid grid-cols-1 lg:grid-cols-2 gap-2"
      fullscreenClassName="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-auto"
    >
      {/* LEFT: AddressWithHierarchy for HQ + Branches */}
      <div className="space-y-2">
        {/* HQ address with hierarchy + clear + fullscreen toggle */}
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{tContacts('contacts-form:addressesSection.headquarters')}</h3>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearHq}
              disabled={disabled || !hqHasValue}
              aria-label={tContacts('contacts-form:addressesSection.clearAddress')}
              title={tContacts('contacts-form:addressesSection.clearAddress')}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          </div>
        </header>

        <div onKeyDown={handleHqKeyDown}>
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
        </div>

        {/* Branches section */}
        <CompanyAddressesSection
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
          draggable={!disabled}
          onDragResolve={!disabled && setFormData ? (addr: DragResolvedAddress, addressIndex: number) => {
            // 📍 ADR-277: Check if HQ has hierarchy that would be cleared
            const targetAddr = effectiveAddresses[addressIndex];
            const isHQ = addressIndex === 0 || targetAddr?.type === 'headquarters';
            const hasHierarchy = isHQ && targetAddr?.settlementId;

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
