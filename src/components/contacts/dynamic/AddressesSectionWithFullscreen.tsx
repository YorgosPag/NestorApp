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
import type { AddressEditorHandle } from '@/components/shared/addresses/editor';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
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
import { pruneBlankContactAddresses } from '@/utils/contacts/contact-address-blankness';
import { useNotifications } from '@/providers/NotificationProvider';

interface AddressesSectionWithFullscreenProps {
  formData: ContactFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ContactFormData>>;
  disabled: boolean;
}

// Καθαρές συναρτήσεις χαρτογράφησης — εξήχθησαν (N.7.1)
import {
  formatHqStreetLine,
  formDataToResolvedFields,
} from './addresses-section-form-mapping';
import { formatContactAddressLine } from '@/utils/address/address-line';
// Ο ΕΝΑΣ ιδιοκτήτης της εγγραφής της έδρας — εξήχθη (N.7.1, ADR-772).
import { useHqAddressMutations } from './use-hq-address-mutations';

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
    [formData.street, formData.streetNumber, formData.postalCode, formData.city,
     formData.settlement, formData.neighborhood, formData.region],
  );

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
   * Αν το OSM δεν επέστρεψε αριθμό, ανοίγουμε τη φόρμα της έδρας και δείχνουμε
   * ειδοποίηση ώστε ο χρήστης να τον γράψει με το χέρι — UX fallback για το κενό
   * κάλυψης του OSM. **Παρουσίαση**, γι' αυτό μένει εδώ και δεν μπήκε στο hook.
   */
  const maybeWarnMissingNumber = useCallback((addr: DragResolvedAddress) => {
    if (addr.number?.trim()) return;
    setIsEditingHQ(true);
    notify(tContacts('contacts-form:addressesSection.dragMissingNumber'), {
      type: 'info',
      duration: 6000,
    });
  }, [notify, tContacts]);

  // ADR-319: semantic type for the primary (flat-field) address — resolved from
  // formData or derived from the contact type (`home` for individuals,
  // `headquarters` for companies/services).
  const primaryType: ContactAddressType = formData.primaryAddressType ?? getPrimaryAddressType(formData.type);
  const primaryCustomLabel = formData.primaryAddressCustomLabel;

  const currentAddresses: CompanyAddress[] = formData.companyAddresses ?? [];
  /**
   * ADR-332 D20 — η τελευταία γραμμή είναι **συνθετική**: υπάρχει μόνο για να έχει
   * η οθόνη μια θέση έδρας όταν η επαφή δεν έχει καμία διεύθυνση ακόμη.
   *
   * ΔΕΝ είναι δεδομένο. Παλιότερα έρρεε αυτούσια στο `onChange` και γραφόταν στη
   * βάση — αυτή είναι η αιτία της κενής έδρας που βρέθηκε στη δοκιμαστική «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.».
   * Κάθε σημείο που γράφει `companyAddresses` περνά πλέον από το
   * `pruneBlankContactAddresses` (θετική αναλλοίωτη ADR-319: η θέση 0 μένει όσο
   * υπάρχει έστω ένα υποκατάστημα).
   */
  const effectiveAddresses: CompanyAddress[] = currentAddresses.length > 0
    ? currentAddresses
    : formData.street
      ? [{ type: primaryType, customLabel: primaryCustomLabel, street: formData.street as string, number: (formData.streetNumber as string) ?? '', postalCode: (formData.postalCode as string) ?? '', city: (formData.city as string) ?? '' }]
      : [{ type: primaryType, customLabel: primaryCustomLabel, street: '', number: '', postalCode: '', city: '' }];

  /**
   * Όλες οι γραφές της έδρας — **ένας** ιδιοκτήτης (N.7.1 / ADR-772).
   * Η έδρα ζει σε δύο δοχεία (επίπεδα πεδία **και** θέση 0 της λίστας)· το hook
   * κρατά την αναλλοίωτη ως δομή, όχι ως συνήθεια των σημείων κλήσης.
   */
  const {
    handleHqChange,
    applyDragResolve,
    handleHqDragApplied,
    hqHierarchyValue,
    handleHqHierarchyChange,
    handlePrimaryTypeChange,
  } = useHqAddressMutations({
    formData,
    setFormData,
    effectiveAddresses,
    onDragMissingNumber: maybeWarnMissingNumber,
  });

  const tAddrFn = useCallback((key: string) => tAddr(key) as string, [tAddr]);
  const hqTypeLabel = resolveContactAddressLabel(primaryType, primaryCustomLabel, tAddrFn);

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel={tContacts('contacts-form:addressesSection.fullscreenAriaLabel')}
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
                value={hqHierarchyValue}
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
            // ADR-332 D20: η συνθετική κενή έδρα δεν επιτρέπεται να γίνει δεδομένο.
            const persistable = pruneBlankContactAddresses(newAddresses);
            // ADR-319: HQ lives at index 0 (positional invariant) — `home` is
            // primary for individuals, `headquarters` for companies/services,
            // so find-by-type cannot match across both scopes.
            const hq = persistable[0];
            setFormData({
              ...formData,
              companyAddresses: persistable,
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
                  streetLine={formatContactAddressLine(addr)}
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
