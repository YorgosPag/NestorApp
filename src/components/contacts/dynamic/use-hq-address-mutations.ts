'use client';
/**
 * `useHqAddressMutations` — ο **ΕΝΑΣ ιδιοκτήτης** της εγγραφής της έδρας μιας επαφής.
 *
 * Εξήχθη από το `AddressesSectionWithFullscreen.tsx` (N.7.1: 524 → κάτω από το όριο)
 * με **εξαγωγή, όχι κόψιμο**: μετακινείται ολόκληρη μια ευθύνη, δεν πετιέται κώδικας.
 *
 * 🔑 Η ευθύνη είναι μία και συγκεκριμένη: **η έδρα ζει σε δύο δοχεία ταυτόχρονα** —
 * τα επίπεδα πεδία του `ContactFormData` **και** η θέση 0 της `companyAddresses`
 * (θετική αναλλοίωτη ADR-319). Κάθε γραφή πρέπει να ενημερώσει **και τα δύο**, αλλιώς
 * η οθόνη δείχνει τη μία τιμή και η βάση κρατά την άλλη. Όσο αυτές οι γραφές ήταν
 * σκορπισμένες μέσα στο JSX, η αναλλοίωτη ήταν **συνήθεια**· εδώ είναι **δομή**.
 *
 * ⚠️ **ADR-772** — καμία χειρόγραφη αντιστοίχιση διεύθυνσης ↔ διοικητικής ιεραρχίας
 * σε αυτό το αρχείο. Ό,τι διασχίζει λεξιλόγια περνά από το `projectAddressVocabulary`.
 * Ένα χειρόγραφο αντίστροφο εδώ θα ήταν το **πέμπτο** ιδιωτικό ζεύγος και θα έχανε
 * σιωπηλά όσα επίπεδα ξεχνούσε — ακριβώς το σφάλμα που έκλεισε το ADR-772.
 *
 * @enterprise ADR-772 · ADR-319 (θέση 0 = έδρα) · ADR-332 D20 · ADR-277 (drag reset)
 */
import React, { useCallback, useMemo } from 'react';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import type { ResolvedAddressFields } from '@/components/shared/addresses/editor';
import type { DragResolvedAddress } from '@/components/contacts/details/ContactAddressMapPreview';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import type { ContactAddressType } from '@/types/contacts/address-types';
import {
  projectAddressVocabulary,
  resolveCityFromHierarchy,
} from '@/utils/address/administrative-hierarchy';
import { DRAG_RESOLVED_HIERARCHY_RESET } from './addresses-section-form-mapping';

export interface HqAddressMutationsDeps {
  formData: ContactFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ContactFormData>>;
  /** Η λίστα που βλέπει η οθόνη — περιλαμβάνει τη **συνθετική** κενή έδρα (ADR-332 D20). */
  effectiveAddresses: CompanyAddress[];
  /**
   * Καλείται όταν το reverse-geocoding δεν επέστρεψε αριθμό. Ζει **έξω** από το hook
   * επειδή είναι παρουσίαση (άνοιγμα φόρμας + ειδοποίηση), όχι εγγραφή.
   */
  onDragMissingNumber: (addr: DragResolvedAddress) => void;
}

export interface HqAddressMutations {
  handleHqChange: (addr: ResolvedAddressFields) => void;
  applyDragResolve: (addr: DragResolvedAddress, addressIndex: number) => void;
  handleHqDragApplied: (addr: ResolvedAddressFields) => void;
  hqHierarchyValue: Partial<AddressWithHierarchyValue>;
  handleHqHierarchyChange: (addr: AddressWithHierarchyValue) => void;
  handlePrimaryTypeChange: (next: { type: ContactAddressType; customLabel?: string }) => void;
}

/**
 * Επαφή **χωρίς** λίστα υποκαταστημάτων: η έδρα ζει μόνο στα επίπεδα πεδία.
 *
 * ⚠️ Χωρίς αυτόν τον κλάδο η διαδρομή πολλαπλών διευθύνσεων θα μηδένιζε
 * `street`/`city` (το `updatedAddresses[0]` είναι `undefined`) και η πινέζα του
 * χάρτη θα εξαφανιζόταν μετά το σύρσιμο.
 */
function applyDragToFlatFields(
  formData: ContactFormData,
  addr: DragResolvedAddress,
): ContactFormData {
  return {
    ...formData,
    street: addr.street,
    streetNumber: addr.number,
    postalCode: addr.postalCode,
    city: addr.city,
    settlement: addr.city,
    neighborhood: addr.neighborhood,
    ...DRAG_RESOLVED_HIERARCHY_RESET,
  };
}

/**
 * Σύρσιμο πάνω σε συγκεκριμένη γραμμή της λίστας — και **ανα-συγχρονισμός** των
 * επίπεδων πεδίων από τη θέση 0 (ADR-319: η έδρα είναι πάντα το index 0).
 */
function applyDragToBranch(
  formData: ContactFormData,
  addr: DragResolvedAddress,
  addressIndex: number,
): ContactFormData {
  const existing = formData.companyAddresses ?? [];
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
  const hq = updatedAddresses[0];
  return {
    ...formData,
    companyAddresses: updatedAddresses,
    street: hq?.street ?? '',
    streetNumber: hq?.number ?? '',
    postalCode: hq?.postalCode ?? '',
    city: hq?.city ?? '',
    settlement: hq?.city ?? '',
    neighborhood: addr.neighborhood,
    ...DRAG_RESOLVED_HIERARCHY_RESET,
  };
}

/** Ενημέρωση της θέσης 0 από την ιεραρχία — το ένα από τα δύο δοχεία της έδρας. */
function hierarchyToHqBranch(
  current: CompanyAddress,
  addr: AddressWithHierarchyValue,
  city: string,
): CompanyAddress {
  return {
    ...current,
    ...(projectAddressVocabulary(addr, 'form', 'companyAddress', {
      includePostal: true,
      clearedIdsAsNull: true,
    }) as Partial<CompanyAddress>),
    street: addr.street,
    number: addr.number,
    postalCode: addr.postalCode,
    city,
    region: addr.regionName,
    country: addr.country || undefined,
  };
}

export function useHqAddressMutations({
  formData,
  setFormData,
  effectiveAddresses,
  onDragMissingNumber,
}: HqAddressMutationsDeps): HqAddressMutations {
  /**
   * Το `AddressEditor` διόρθωσε βασικά πεδία (συμφιλίωση / πρόταση) — η ιεραρχία **μένει**.
   *
   * ⚠️ Η «Πόλη» του editor αντιστοιχεί στο ορατό πεδίο «Οικισμός / Πόλη», που διαβάζει
   * `settlement || city`. Αν γράψουμε μόνο το `city`, η διόρθωση καταλήγει σε σκιώδες
   * πεδίο και η οθόνη μένει με την παλιά τιμή.
   */
  const handleHqChange = useCallback((addr: ResolvedAddressFields) => {
    if (!setFormData) return;
    setFormData(prev => {
      const existing = (prev.companyAddresses ?? []) as CompanyAddress[];
      const updatedAddresses = existing.length > 0
        ? [{ ...existing[0], street: addr.street ?? existing[0].street, number: addr.number ?? existing[0].number, postalCode: addr.postalCode ?? existing[0].postalCode, city: addr.city ?? existing[0].city }, ...existing.slice(1)]
        : existing;

      const cityApplied = addr.city !== undefined;
      const settlementRenamed = cityApplied && addr.city !== ((prev.settlement as string) ?? '');

      return {
        ...prev,
        street: addr.street ?? (prev.street as string) ?? '',
        streetNumber: addr.number ?? (prev.streetNumber as string) ?? '',
        postalCode: addr.postalCode ?? (prev.postalCode as string) ?? '',
        city: addr.city ?? (prev.city as string) ?? '',
        neighborhood: addr.neighborhood ?? (prev.neighborhood as string) ?? '',
        region: addr.region ?? (prev.region as string) ?? '',
        ...(cityApplied ? { settlement: addr.city } : {}),
        // Το όνομα άλλαξε από πηγή εκτός ιεραρχίας → το προηγούμενο `settlementId`
        // δεν αντιστοιχεί πλέον στο εμφανιζόμενο όνομα. Ταυτότητα και ετικέτα
        // δεν επιτρέπεται να αποκλίνουν.
        ...(settlementRenamed ? { settlementId: null } : {}),
        ...(addr.country !== undefined ? { hqAddressCountry: addr.country } : {}),
        ...(updatedAddresses.length > 0 ? { companyAddresses: updatedAddresses } : {}),
      };
    });
  }, [setFormData]);

  const applyDragResolve = useCallback((addr: DragResolvedAddress, addressIndex: number) => {
    if (!setFormData) return;
    const hasBranchList = (formData.companyAddresses ?? []).length > 0;
    setFormData(hasBranchList
      ? applyDragToBranch(formData, addr, addressIndex)
      : applyDragToFlatFields(formData, addr));
    onDragMissingNumber(addr);
  }, [formData, setFormData, onDragMissingNumber]);

  /** Επιβεβαίωση συρσίματος στην έδρα — καθαρίζει την ιεραρχία (ADR-277). */
  const handleHqDragApplied = useCallback((addr: ResolvedAddressFields) => {
    applyDragResolve({
      street: addr.street ?? '',
      number: addr.number ?? '',
      postalCode: addr.postalCode ?? '',
      city: addr.city ?? '',
      // Το reverse-geocoding ΕΠΙΣΤΡΕΦΕΙ συνοικία· παλαιότερα σβηνόταν εδώ με
      // σκέτο '' και η τιμή χανόταν σιωπηλά πριν καν φτάσει στο `formData`.
      neighborhood: addr.neighborhood ?? '',
      region: addr.region ?? '',
      country: addr.country ?? '',
    }, 0);
  }, [applyDragResolve]);

  /**
   * Η **ανάγνωση** της αντιστοίχισης — ήταν 15 γραμμές inline μέσα στο JSX, δηλαδή
   * ένας μετατροπέας χωρίς όνομα, αόρατος σε κάθε αναζήτηση (ADR-772).
   *
   * ⚠️ Η χώρα της έδρας δεν ζει στα επίπεδα πεδία — γι' αυτό γράφεται ρητά από πάνω.
   */
  const hqHierarchyValue = useMemo<Partial<AddressWithHierarchyValue>>(
    () => ({
      country: formData.hqAddressCountry || '',
      ...(projectAddressVocabulary(
        formData as Readonly<Record<string, unknown>>,
        'contactFlat',
        'form',
        { includePostal: true, clearedIdsAsNull: true },
      ) as Partial<AddressWithHierarchyValue>),
    }),
    [formData],
  );

  /**
   * 🔴 **ADR-772** — ήταν το **τέταρτο** ιδιωτικό ζεύγος μετατροπέα, γραμμένο inline και
   * απόν από κάθε χάρτη: γράφει σε **δύο** δοχεία ταυτόχρονα, με την αντιστοίχιση
   * αντιγραμμένη δύο φορές μέσα στην ίδια συνάρτηση. Πλέον: μία κλήση ανά δοχείο,
   * **ίδιος πίνακας**.
   */
  const handleHqHierarchyChange = useCallback((addr: AddressWithHierarchyValue) => {
    if (!setFormData) return;
    const city = resolveCityFromHierarchy(addr);
    const updatedAddresses = [...effectiveAddresses];
    if (updatedAddresses.length > 0) {
      updatedAddresses[0] = hierarchyToHqBranch(updatedAddresses[0], addr, city);
    }
    setFormData({
      ...formData,
      ...projectAddressVocabulary(addr, 'form', 'contactFlat', {
        includePostal: true,
        clearedIdsAsNull: true,
      }),
      street: addr.street,
      streetNumber: addr.number,
      postalCode: addr.postalCode,
      city,
      // Η χώρα της έδρας ζει σε δικό της πεδίο, εκτός του λεξιλογίου επίπεδων πεδίων.
      hqAddressCountry: addr.country || undefined,
      companyAddresses: updatedAddresses,
    });
  }, [formData, setFormData, effectiveAddresses]);

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

  return {
    handleHqChange,
    applyDragResolve,
    handleHqDragApplied,
    hqHierarchyValue,
    handleHqHierarchyChange,
    handlePrimaryTypeChange,
  };
}
