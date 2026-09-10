/**
 * =============================================================================
 * useLocationFlows — οι ροές ΠΡΟΣΘΗΚΗΣ και ΕΠΕΞΕΡΓΑΣΙΑΣ διεύθυνσης έργου
 * =============================================================================
 *
 * Εξήχθησαν από το `useProjectLocations` (477 γρ., N.7.1) — ADR-332 D27 Βήμα Β.
 *
 * 🔴 **Τι διορθώνουν** (μετρημένο 2026-09-10, ADR-332 D27 «Βήμα Β — σύγκριση»):
 * - **Προσθήκη (Β1β)**: η θέση γραφόταν **πριν** τον διάλογο ⇒ το «Άκυρο» την **αποθήκευε**.
 * - **Επεξεργασία (Β1/Β2)**: η θέση του χεριού **δεν αποθηκευόταν ποτέ** — ο διακομιστής
 *   ξαναρωτούσε τη μηχανή για το κείμενο, ακυρώνοντας τη διόρθωση του ανθρώπου.
 *
 * 🔑 Κάθε ροή έχει **δική της** ανθρώπινη θέση (`useFormPlacedPoint`) — δύο ονόματα, όχι ένα
 * κοινό που «τυχαίνει» να είναι κενό στη μία ροή (το σκεπτικό του D25 για την αφετηρία).
 *
 * @module components/projects/tabs/locations/useLocationFlows
 */

import { useCallback, useState } from 'react';
import type { ProjectAddress } from '@/types/project/addresses';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { createProjectAddress } from '@/types/project/address-helpers';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useFormPlacedPoint, type FormPlacedPoint } from '@/components/shared/addresses/useFormPlacedPoint';
import { EMPTY_HIERARCHY, fromHierarchyValue } from './location-converters';
import { ADDRESS_TYPE_KEYS, isUniqueAddressType } from './address-constants';
import {
  optionalClassification,
  useLocationFormState,
  type LocationFormState,
} from './useLocationFormState';

export type AddressOp = 'added' | 'updated' | 'deleted' | 'cleared' | 'primaryUpdated';

export interface LocationFlowDeps {
  readonly localAddresses: readonly ProjectAddress[];
  readonly persistAddresses: (next: ProjectAddress[], op: AddressOp) => Promise<boolean>;
  readonly setIsSaving: (saving: boolean) => void;
  readonly notify: {
    readonly cityRequired: () => void;
    readonly soleAddressMustBePrimary: () => void;
  };
}

// =============================================================================
// ΚΑΘΑΡΟΙ ΒΟΗΘΟΙ
// =============================================================================

/** Πού μπαίνει η **μαντεμένη** πινέζα της προσθήκης — οπτικό βοήθημα, ΠΟΤΕ δήλωση (D25). */
function guessPendingPin(addresses: readonly ProjectAddress[]): GeoPoint {
  const points = addresses.flatMap((a) => (a.coordinates?.lat && a.coordinates?.lng ? [a.coordinates] : []));
  if (points.length === 0) {
    return { lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE, lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE };
  }
  // ~150 m βόρεια της μοναδικής πινέζας, ώστε να μην πέσει πάνω της.
  if (points.length === 1) return { lat: points[0].lat + 0.00135, lng: points[0].lng };
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

/** Ο πρώτος αχρησιμοποίητος μοναδικός τύπος· τα «φαντάσματα» (κενή οδός + πόλη) δεν δεσμεύουν. */
function suggestNextAddressType(addresses: readonly ProjectAddress[]): ProjectAddress['type'] {
  const used = new Set(
    addresses
      .filter((a) => !((a.street ?? '') === '' && (a.city ?? '') === ''))
      .map((a) => a.type)
      .filter(isUniqueAddressType),
  );
  return ADDRESS_TYPE_KEYS.find((t) => !isUniqueAddressType(t) || !used.has(t)) ?? 'other';
}

/** Τα πεδία κειμένου της φόρμας — `null` όταν λείπει η πόλη (υποχρεωτική). */
function readFormAddress(form: LocationFormState): (Partial<ProjectAddress> & { city: string }) | null {
  const fields = fromHierarchyValue({ ...EMPTY_HIERARCHY, ...form.hierarchy } as AddressWithHierarchyValue);
  return fields.city ? { ...fields, city: fields.city } : null;
}

/** Η επεξεργασμένη διεύθυνση: κείμενο από τη φόρμα, θέση από τον άνθρωπο — **αν** την έβαλε. */
function buildEditedAddress(
  addr: ProjectAddress,
  fields: Partial<ProjectAddress> & { city: string },
  form: LocationFormState,
  placed: FormPlacedPoint,
): ProjectAddress {
  const { blockSide: _bs, label: _lb, ...rest } = addr;
  return {
    ...rest,
    ...fields,
    type: form.type,
    isPrimary: form.isPrimary,
    // 🔴 Β2: ως τις 2026-09-10 εδώ δεν έφτανε ΠΟΤΕ η συρμένη θέση.
    ...placed.addressPatch,
    ...optionalClassification(form),
  };
}

/** Αν ο άνθρωπος ξε-σημάνει τη μόνη κύρια, προάγεται η πρώτη **άλλη** διεύθυνση. */
function ensureOnePrimary(addresses: ProjectAddress[], editedIndex: number): ProjectAddress[] {
  if (addresses.some((a) => a.isPrimary) || addresses.length === 0) return addresses;
  const other = addresses.findIndex((_, i) => i !== editedIndex);
  const target = other >= 0 ? other : 0;
  return addresses.map((a, i) => (i === target ? { ...a, isPrimary: true } : a));
}

// =============================================================================
// ΠΡΟΣΘΗΚΗ
// =============================================================================

export function useLocationAddFlow(deps: LocationFlowDeps) {
  const form = useLocationFormState();
  const placed = useFormPlacedPoint();
  const [isOpen, setIsOpen] = useState(false);
  const [guessedPin, setGuessedPin] = useState<GeoPoint | null>(null);
  const { setType, reset: resetForm } = form;
  const { reset: resetPoint } = placed;

  const open = useCallback(() => {
    setType(suggestNextAddressType(deps.localAddresses));
    resetPoint();
    setGuessedPin(guessPendingPin(deps.localAddresses));
    setIsOpen(true);
  }, [deps.localAddresses, setType, resetPoint]);

  const cancel = useCallback(() => {
    setIsOpen(false);
    setGuessedPin(null);
    resetPoint();
    resetForm();
  }, [resetPoint, resetForm]);

  const save = async () => {
    const fields = readFormAddress(form);
    if (!fields) return deps.notify.cityRequired();
    deps.setIsSaving(true);
    try {
      const isNewPrimary = deps.localAddresses.length === 0 || form.isPrimary;
      // 🔑 Θέση ΜΟΝΟ αν την επιβεβαίωσε άνθρωπος· αλλιώς ο διακομιστής λύνει το κείμενο (D25).
      const created = createProjectAddress({
        ...fields, type: form.type, isPrimary: isNewPrimary, ...placed.addressPatch, ...optionalClassification(form),
      });
      const base = isNewPrimary ? deps.localAddresses.map((a) => ({ ...a, isPrimary: false })) : [...deps.localAddresses];
      if (await deps.persistAddresses([...base, created], 'added')) cancel();
    } finally {
      deps.setIsSaving(false);
    }
  };

  /** Η πινέζα που βλέπει ο άνθρωπος: η δική του, αλλιώς η μαντεψιά. */
  const pendingPin = isOpen ? (placed.point ?? guessedPin) : null;

  return { form, placed, isOpen, pendingPin, open, cancel, save };
}

// =============================================================================
// ΕΠΕΞΕΡΓΑΣΙΑ
// =============================================================================

export function useLocationEditFlow(deps: LocationFlowDeps) {
  const form = useLocationFormState();
  const placed = useFormPlacedPoint();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { load, reset: resetForm, setIsPrimary } = form;
  const { reset: resetPoint } = placed;

  const start = useCallback((index: number) => {
    const address = deps.localAddresses[index];
    if (!address) return;
    load(address);
    resetPoint();
    setEditingIndex(index);
  }, [deps.localAddresses, load, resetPoint]);

  const cancel = useCallback(() => {
    setEditingIndex(null);
    resetForm();
    resetPoint();
  }, [resetForm, resetPoint]);

  /** Μπλοκάρει το ξε-σημάδεμα όταν αυτή είναι η μόνη διεύθυνση. */
  const changeIsPrimary = (value: boolean) => {
    if (!value && deps.localAddresses.length <= 1) return deps.notify.soleAddressMustBePrimary();
    setIsPrimary(value);
  };

  const save = async () => {
    if (editingIndex === null) return;
    const fields = readFormAddress(form);
    if (!fields) return deps.notify.cityRequired();
    if (!form.isPrimary && !deps.localAddresses.some((_, i) => i !== editingIndex)) {
      return deps.notify.soleAddressMustBePrimary();
    }
    deps.setIsSaving(true);
    try {
      const next = deps.localAddresses.map((addr, i) => {
        if (i === editingIndex) return buildEditedAddress(addr, fields, form, placed);
        return form.isPrimary ? { ...addr, isPrimary: false } : addr;
      });
      if (await deps.persistAddresses(ensureOnePrimary(next, editingIndex), 'updated')) cancel();
    } finally {
      deps.setIsSaving(false);
    }
  };

  return { form, placed, editingIndex, start, cancel, changeIsPrimary, save };
}
