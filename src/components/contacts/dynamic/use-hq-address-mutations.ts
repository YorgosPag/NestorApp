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
import {
  overwriteAdminHierarchy,
  projectAddressVocabulary,
  resolveCityFromHierarchy,
} from '@/utils/address/administrative-hierarchy';
import { provedHierarchyValue } from '@/components/shared/addresses/address-hierarchy-field-ops';
import { toStoredCountryCode } from '@/utils/address/country-codes';
import { pickStoredAddressPosition } from '@/utils/address/stored-address-position';
import { applyContactAddressPosition } from '@/utils/contacts/contact-address-position-view';
// ⚠️ Το `DRAG_RESOLVED_HIERARCHY_RESET` **δεν εισάγεται πλέον**: ο μηδενισμός δεν είναι
//    χειρόγραφη λίστα αλλά **προβολή του πίνακα** (δες `flatHierarchyPatch`). Ο πίνακας μένει
//    εξαγόμενος για τον «Καθαρισμό» της έδρας — **άλλη πράξη, άλλος λόγος**.
import {
  applyDraggedToContactAddress,
  contactAddressList,
  withContactAddressAt,
  withHumanPoint,
} from './contact-address-drag';

export interface HqAddressMutationsDeps {
  formData: ContactFormData;
  setFormData?: React.Dispatch<React.SetStateAction<ContactFormData>>;
  /** Η λίστα που βλέπει η οθόνη — περιλαμβάνει τη **συνθετική** κενή έδρα (ADR-332 D20). */
  effectiveAddresses: CompanyAddress[];
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
 * Η εγγραφή μετά το σύρσιμο, και τα επίπεδα πεδία της έδρας **μόνο** αν σύρθηκε η έδρα.
 * Καθαρή συνάρτηση — βλ. `contact-address-drag` για το σφάλμα που διορθώνει.
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
  const next = applyDraggedToContactAddress(current, dragged, point);
  const written = withContactAddressAt(formData, index, next);
  if (index !== 0) return written;
  return {
    ...written,
    ...flatHierarchyPatch(dragged),
    // ⚠️ **Μετά τον πίνακα, επίτηδες**: το `settlement` είναι το όνομα του οικισμού **και**
    //    το ελεύθερο κείμενο «Οικισμός / Πόλη» σε αυτό το λεξιλόγιο. Το `next.city` κουβαλά
    //    ήδη τη σωστή απόφαση — όνομα **μητρώου** αν αποδείχθηκε, αλλιώς της μηχανής.
    settlement: next.city,
    neighborhood: dragged.neighborhood,
  };
}

/**
 * Η ιεραρχία στα **επίπεδα πεδία** της έδρας — ο **ίδιος** κανόνας με την εγγραφή της λίστας.
 *
 * 🔴 **Ζ4γ**: εδώ εφαρμοζόταν το `DRAG_RESOLVED_HIERARCHY_RESET` **άνευ όρων**. Πλέον
 * γράφεται ό,τι αποδείχθηκε και καθαρίζεται ό,τι όχι — με την προβολή στο λεξιλόγιο
 * `contactFlat` να γίνεται από **τον πίνακα** (ADR-772), που ξέρει ότι εδώ κρατιούνται
 * **δύο** ταυτότητες και τα υπόλοιπα έξι επίπεδα είναι μόνο ονόματα.
 *
 * ⚠️ **Το `?? []` είναι η ίδια απόφαση με το `contactHierarchyPatch`** — και για τον ίδιο
 * λόγο: αυτή η διαδρομή τρέχει **μόνο** όταν το κείμενο αντικαθίσταται, οπότε καμία απόδειξη
 * σημαίνει **καθάρισμα**, όχι κληρονομιά *(ADR-277)*.
 *
 * ✅ **Και το αποτέλεσμα είναι ΤΑΥΤΟΣΗΜΟ με το `DRAG_RESOLVED_HIERARCHY_RESET`** όταν δεν
 * αποδεικνύεται τίποτα: το ίδιο σύνολο πεδίων, καθαρισμένο από **τον πίνακα** αντί από
 * χειρόγραφη λίστα. Ο παλιός πίνακας μένει για τον «Καθαρισμό» της έδρας, που είναι **άλλη
 * πράξη με άλλον λόγο** *(ρητή πρόθεση ανθρώπου)*.
 */
function flatHierarchyPatch(dragged: DragResolvedAddress): Partial<ContactFormData> {
  return overwriteAdminHierarchy(
    provedHierarchyValue(dragged.admin ?? []),
    'form',
    'contactFlat',
  ) as Partial<ContactFormData>;
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
        // Ο έλεγχος `!== undefined` ξεχωρίζει «ο editor εφάρμοσε το πεδίο» από «δεν το άγγιξε»·
        // μέσα σε αυτόν, το κενό σημαίνει «ο άνθρωπος το καθάρισε» ⇒ `undefined` (ADR-332 Ζ4α).
        ...(addr.country !== undefined ? { hqAddressCountry: toStoredCountryCode(addr.country) } : {}),
        ...(updatedAddresses.length > 0 ? { companyAddresses: updatedAddresses } : {}),
      };
    });
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
      hqAddressCountry: toStoredCountryCode(addr.country),
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
    applyConfirmedDrag,
    handleHqDragApplied,
    hqPlacement: hq.placement,
    resetHqPlacement: hq.reset,
    hqHierarchyValue,
    handleHqHierarchyChange,
    handlePrimaryTypeChange,
  };
}
