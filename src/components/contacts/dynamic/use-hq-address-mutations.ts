'use client';
/**
 * `useHqAddressMutations` — ο **ΕΝΑΣ ιδιοκτήτης** της εγγραφής της έδρας μιας επαφής.
 *
 * Εξήχθη από το `AddressesSectionWithFullscreen.tsx` (N.7.1: 524 → κάτω από το όριο)
 * με **εξαγωγή, όχι κόψιμο**: μετακινείται ολόκληρη μια ευθύνη, δεν πετιέται κώδικας.
 *
 * 🔑 **ADR-332 §D30 Φάση 2 — η έδρα ζει σε ΕΝΑ δοχείο**: τη θέση 0 της `companyAddresses`
 * (ADR-319). Ως τη Φάση 2 ζούσε και σε επίπεδα πεδία του `ContactFormData`, και κάθε πράξη εδώ
 * συγχρόνιζε με το χέρι διαφορετικό υποσύνολο. Τώρα κάθε πράξη είναι μετασχηματισμός
 * `CompanyAddress → CompanyAddress` μέσα από τον **έναν** γραφέα (`commitHq`).
 *
 * 📍 **ADR-332 D27 Β-ΙΙ — η θέση.** Εδώ ζει και το `placement` του editor της έδρας («Μόνο η
 * θέση», αναίρεση πινέζας) και η εφαρμογή **κάθε** επιβεβαιωμένου συρσίματος (έδρα **και**
 * υποκαταστήματα). ⚠️ Κείμενο και θέση γράφονται σε **ΜΙΑ** κλήση `setFormData`: ο γονιός
 * εφαρμόζει ακόμη και τις functional ενημερώσεις πάνω στο **κλειστό** `formData`, οπότε δύο
 * διαδοχικές κλήσεις στον ίδιο κύκλο αλληλοσβήνονται — η δεύτερη οφείλει να κουβαλά και τα δύο.
 *
 * ⚠️ **ADR-772** — καμία χειρόγραφη αντιστοίχιση διεύθυνσης ↔ διοικητικής ιεραρχίας
 * σε αυτό το αρχείο. Ό,τι διασχίζει λεξιλόγια περνά από το `projectAddressVocabulary`.
 *
 * @enterprise ADR-772 · ADR-319 (θέση 0 = έδρα) · ADR-332 D20 · D27 Β-ΙΙ · ADR-277 (drag reset)
 */
import React, { useCallback, useMemo, useRef } from 'react';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import type { ResolvedAddressFields } from '@/components/shared/addresses/editor';
import type { AddressEditorPlacementOptions } from '@/components/shared/addresses/editor/AddressEditor.types';
import type { DragResolvedAddress } from '@/components/contacts/details/contact-pin-drop';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { StoredAddressPosition } from '@/types/address-position';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import type { ContactAddressType } from '@/types/contacts/address-types';
import { projectAddressVocabulary, resolveCityFromHierarchy } from '@/utils/address/administrative-hierarchy';
import { toStoredCountryCode } from '@/utils/address/country-codes';
import { pickStoredAddressPosition } from '@/utils/address/stored-address-position';
import { applyContactAddressPosition } from '@/utils/contacts/contact-address-position-view';
import { applyDraggedToContactAddress, withHumanPoint } from './contact-address-drag';
import { commitHq, contactAddressList, selectContactHq, withContactAddressAt } from './contact-hq-state';
import { applyHqEditorChange } from './addresses-section-form-mapping';

export interface HqAddressMutationsDeps {
  formData: ContactFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ContactFormData>>;
  /**
   * Καλείται όταν το reverse-geocoding δεν επέστρεψε αριθμό **για την έδρα**. Ζει **έξω**
   * από το hook επειδή είναι παρουσίαση (άνοιγμα φόρμας + ειδοποίηση), όχι εγγραφή.
   */
  onDragMissingNumber: (addr: DragResolvedAddress) => void;
}

export interface HqAddressMutations {
  handleHqChange: (addr: ResolvedAddressFields) => void;
  /** Επιβεβαιωμένο σύρσιμο στη θέση `addressIndex`: κείμενο (`dragged`) και/ή σημείο — **μία** εγγραφή. */
  applyConfirmedDrag: (dragged: DragResolvedAddress | null, addressIndex: number, point: GeoPoint | null) => void;
  handleHqDragApplied: (addr: ResolvedAddressFields) => void;
  /** Δίνεται αυτούσιο στον editor της έδρας — ενεργοποιεί «Μόνο η θέση» και αναίρεση πινέζας. */
  hqPlacement: AddressEditorPlacementOptions;
  /** Κλείσιμο του editor της έδρας — ξεχνά σημείο και αφετηρία της συνεδρίας. */
  resetHqPlacement: () => void;
  hqHierarchyValue: Partial<AddressWithHierarchyValue>;
  handleHqHierarchyChange: (addr: AddressWithHierarchyValue) => void;
  handlePrimaryTypeChange: (next: { type: ContactAddressType; customLabel?: string }) => void;
}

/** Η έδρα μετά από επιλογή στην ιεραρχία — ολόκληρη η εγγραφή, από τον πίνακα (ADR-772). */
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
    // 🔴 **ΕΔΩ ΕΓΡΑΦΕ `region: addr.regionName` — ΔΕΥΤΕΡΟΣ ΔΙΕΚΔΙΚΗΤΗΣ ΤΟΥ ΙΔΙΟΥ ΠΕΔΙΟΥ.**
    //    Η αλυσίδα ανάγνωσης του `companyAddress` είναι `['regionName','region']` (ADR-772):
    //    το `regionName` κρατά **αποδεδειγμένο** όνομα, το `region` **ελεύθερο ταχυδρομικό**
    //    κείμενο. Γράφοντας το πρώτο **μέσα** στο δεύτερο, κανένας αναγνώστης δεν μπορούσε
    //    πια να ξεχωρίσει «όνομα από ιεραρχία» από «ετικέτα μηχανής» — και το `region` ήταν
    //    **αθάνατο**: ο πίνακας γράφει **μόνο** το κανονικό πεδίο (`write` → `slot[0]`), άρα
    //    τίποτα δεν μπορούσε να το καθαρίσει. Το `regionName` το θέτει **ήδη** η προβολή
    //    παραπάνω. Είναι ο κανόνας «κανένα πεδίο με δύο διεκδικητές» που το ίδιο το λεξιλόγιο
    //    επιβάλλει για το `neighborhood` — και που το `region` παραβίαζε **έξω** από τον πίνακα.
    country: toStoredCountryCode(addr.country),
  };
}

/** Το κείμενο του editor → το λεξιλόγιο του συρσίματος επαφής. */
function resolvedToDragged(addr: ResolvedAddressFields): DragResolvedAddress {
  return {
    street: addr.street ?? '',
    number: addr.number ?? '',
    postalCode: addr.postalCode ?? '',
    city: addr.city ?? '',
    // Το reverse-geocoding ΕΠΙΣΤΡΕΦΕΙ συνοικία· παλαιότερα σβηνόταν εδώ με
    // σκέτο '' και η τιμή χανόταν σιωπηλά πριν καν φτάσει στο `formData`.
    neighborhood: addr.neighborhood ?? '',
    region: addr.region ?? '',
    country: addr.country ?? '',
    // ⚠️ **Ο δρόμος επιστροφής**: ό,τι απέδειξε ο διακομιστής ταξίδεψε μέσα από τον editor
    //    και πρέπει να φτάσει στον γραφέα — αλλιώς η έδρα μηδενίζει ιεραρχία που **ξέρουμε**.
    ...(addr.admin !== undefined ? { admin: addr.admin } : {}),
  };
}

/**
 * Η λίστα μετά το σύρσιμο της εγγραφής `index` (έδρα **ή** υποκατάστημα) — μία εγγραφή, κανένα
 * δεύτερο δοχείο. Καθαρή συνάρτηση — βλ. `contact-address-drag` για το σφάλμα που διορθώνει.
 */
function confirmedDragState(
  formData: ContactFormData,
  dragged: DragResolvedAddress | null,
  index: number,
  point: GeoPoint | null,
): ContactFormData | null {
  const current = contactAddressList(formData)[index];
  if (!current) return null;
  if (!dragged) return point ? withContactAddressAt(formData, index, withHumanPoint(current, point)) : null;
  return withContactAddressAt(formData, index, applyDraggedToContactAddress(current, dragged, point));
}

/** Το `placement` του editor της έδρας: σημείο, αναίρεση, και η αφετηρία της συνεδρίας. */
function useHqPlacement(
  formData: ContactFormData,
  setFormData: HqAddressMutationsDeps['setFormData'],
  applyConfirmedDrag: HqAddressMutations['applyConfirmedDrag'],
) {
  const pointRef = useRef<GeoPoint | null>(null);
  /** Η θέση της έδρας **πριν** την πρώτη τοποθέτηση — `null` = δεν καταγράφηκε ακόμη. */
  const originRef = useRef<StoredAddressPosition | null>(null);

  const onPlace = useCallback((point: GeoPoint) => {
    if (originRef.current === null) {
      originRef.current = pickStoredAddressPosition(contactAddressList(formData)[0]);
    }
    pointRef.current = point;
    applyConfirmedDrag(null, 0, point);
  }, [formData, applyConfirmedDrag]);

  const onRestore = useCallback((point: GeoPoint | null) => {
    if (point) {
      onPlace(point);
      return;
    }
    pointRef.current = null;
    const origin = originRef.current;
    if (!origin || !setFormData) return;
    const hq = contactAddressList(formData)[0];
    setFormData(withContactAddressAt(formData, 0, applyContactAddressPosition(hq, origin)));
  }, [formData, setFormData, onPlace]);

  const reset = useCallback(() => {
    pointRef.current = null;
    originRef.current = null;
  }, []);

  const placement = useMemo<AddressEditorPlacementOptions>(() => ({ onPlace, onRestore }), [onPlace, onRestore]);
  return { placement, pointRef, reset };
}

export function useHqAddressMutations({
  formData,
  setFormData,
  onDragMissingNumber,
}: HqAddressMutationsDeps): HqAddressMutations {
  /**
   * Το `AddressEditor` διόρθωσε βασικά πεδία (συμφιλίωση / πρόταση) — η ιεραρχία **μένει**.
   * Η μετάβαση ζει στο καθαρό `applyHqEditorChange` (ADR-332 §D30), πάνω στον έναν γραφέα.
   */
  const handleHqChange = useCallback((addr: ResolvedAddressFields) => {
    if (!setFormData) return;
    setFormData(prev => applyHqEditorChange(prev, addr));
  }, [setFormData]);

  const applyConfirmedDrag = useCallback((
    dragged: DragResolvedAddress | null,
    addressIndex: number,
    point: GeoPoint | null,
  ) => {
    if (!setFormData) return;
    const next = confirmedDragState(formData, dragged, addressIndex, point);
    if (!next) return;
    setFormData(next);
    if (dragged && addressIndex === 0) onDragMissingNumber(dragged);
  }, [formData, setFormData, onDragMissingNumber]);

  const hq = useHqPlacement(formData, setFormData, applyConfirmedDrag);

  /**
   * «Ναι, ενημέρωσε» στον editor της έδρας. Το `placement.onPlace` έχει ήδη τρέξει (σειρά του
   * `commitDrag`), οπότε το σημείο είναι γνωστό — και ταξιδεύει μαζί με το κείμενο (ADR-277).
   */
  const handleHqDragApplied = useCallback((addr: ResolvedAddressFields) => {
    applyConfirmedDrag(resolvedToDragged(addr), 0, hq.pointRef.current);
  }, [applyConfirmedDrag, hq.pointRef]);

  /**
   * Η έδρα όπως τη ζητά η φόρμα ιεραρχίας — **ανάγνωση** της εγγραφής μέσα από τον πίνακα (ADR-772).
   * Η χώρα μπαίνει πρώτη ώστε η κενή να γίνεται `''` (η φόρμα δεν δέχεται `undefined`).
   */
  const hqHierarchyValue = useMemo<Partial<AddressWithHierarchyValue>>(() => {
    const hq = selectContactHq(formData);
    return {
      country: hq.country || '',
      ...(projectAddressVocabulary(hq as Readonly<Record<string, unknown>>, 'companyAddress', 'form', {
        includePostal: true,
        clearedIdsAsNull: true,
      }) as Partial<AddressWithHierarchyValue>),
    };
  }, [formData]);

  /** Επιλογή στην ιεραρχία της έδρας — ένας μετασχηματισμός, ένας γραφέας. */
  const handleHqHierarchyChange = useCallback((addr: AddressWithHierarchyValue) => {
    if (!setFormData) return;
    setFormData(prev => commitHq(prev, (hq) => hierarchyToHqBranch(hq, addr, resolveCityFromHierarchy(addr))));
  }, [setFormData]);

  /** Τύπος / ελεύθερη ετικέτα της έδρας (ADR-319) — ζουν στην ίδια την εγγραφή. */
  const handlePrimaryTypeChange = useCallback((next: { type: ContactAddressType; customLabel?: string }) => {
    if (!setFormData) return;
    setFormData(prev => commitHq(prev, (hq) => ({ ...hq, type: next.type, customLabel: next.customLabel })));
  }, [setFormData]);

  return {
    handleHqChange,
    applyConfirmedDrag,
    handleHqDragApplied,
    hqPlacement: hq.placement,
    resetHqPlacement: hq.reset,
    hqHierarchyValue,
    handleHqHierarchyChange,
    handlePrimaryTypeChange,
  };
}
