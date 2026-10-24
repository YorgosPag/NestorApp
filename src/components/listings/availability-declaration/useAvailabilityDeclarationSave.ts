'use client';

/**
 * **Η αποθήκευση της δήλωσης διαθεσιμότητας** — αισιόδοξη, με επαναφορά, χωρίς αγώνα δρόμου (ADR-919 §11).
 *
 * 🔑 **Αισιόδοξα, με την ΙΔΙΑ συνάρτηση με τον διακομιστή**: η οθόνη δείχνει αμέσως «Δημοσιευμένη τώρα» με το γεγονός
 * που θα γράψει ο διακομιστής (`availabilityDeclarationFromIntent`). Αποτυχία ⇒ επιστροφή στην προηγούμενη τιμή.
 *
 * 🔑 **Μόνο η τελευταία πράξη μετρά**: κάθε αποθήκευση παίρνει αύξοντα αριθμό· απάντηση παλαιότερης πράξης που φτάνει
 * αργότερα αγνοείται (Δημοσίευση → Ανάκληση με γρήγορα κλικ δεν αφήνει τη Δημοσίευση να «κερδίσει»).
 *
 * 🔑 **Η αλήθεια του εγγράφου νικά**: όταν φτάσει νέα τιμή από τον γονέα (realtime/επαναφόρτωση) και δεν εκκρεμεί
 * πράξη, την υιοθετούμε. Η σύγκριση είναι κατά **περιεχόμενο**, όχι κατά ταυτότητα αντικειμένου.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { nowISO } from '@/lib/date-local';
import {
  availabilityDeclarationFromIntent,
  type AvailabilityDeclarationIntent,
} from '@/lib/listings/availability-declaration-write';
import { readAvailabilityDeclaration } from '@/lib/listings/listing-availability';
import type { SourcedAttribute } from '@/lib/property/attribute-provenance';
import type { AvailabilityDeclaration } from '@/types/listing-availability';

export type DeclarationSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export type StoredDeclaration = SourcedAttribute<AvailabilityDeclaration> | null;

export interface AvailabilityDeclarationSave {
  /** Η δήλωση όπως είναι (ή θα είναι, αισιόδοξα) στο έγγραφο. */
  readonly stored: StoredDeclaration;
  readonly status: DeclarationSaveStatus;
  readonly commit: (intent: AvailabilityDeclarationIntent) => Promise<void>;
}

export function useAvailabilityDeclarationSave(
  raw: unknown,
  persist: (intent: AvailabilityDeclarationIntent) => Promise<boolean>,
): AvailabilityDeclarationSave {
  const incoming = readAvailabilityDeclaration(raw);
  const incomingKey = JSON.stringify(incoming);
  const [stored, setStored] = useState<StoredDeclaration>(incoming);
  const [status, setStatus] = useState<DeclarationSaveStatus>('idle');
  const sequence = useRef(0);
  const pending = useRef(false);
  /** Η τελευταία τιμή που **ξέρουμε** ότι είναι στο έγγραφο — εκεί γυρίζει η αποτυχία, ποτέ σε αισιόδοξη. */
  const confirmed = useRef<StoredDeclaration>(incoming);

  useEffect(() => {
    if (pending.current) return;
    const truth = readAvailabilityDeclaration(JSON.parse(incomingKey));
    confirmed.current = truth;
    setStored(truth);
  }, [incomingKey]);

  const commit = useCallback(async (intent: AvailabilityDeclarationIntent) => {
    const ticket = ++sequence.current;
    const optimistic = availabilityDeclarationFromIntent(intent, nowISO());
    pending.current = true;
    setStored(optimistic);
    setStatus('saving');
    const ok = await persist(intent).catch(() => false);
    // Παλιά πράξη που απάντησε αργότερα: ούτε οθόνη ούτε «επιβεβαιωμένη» — την αλήθεια τη φέρνει το έγγραφο.
    if (ticket !== sequence.current) return;
    if (ok) confirmed.current = optimistic;
    pending.current = false;
    setStored(confirmed.current);
    setStatus(ok ? 'saved' : 'failed');
  }, [persist]);

  return { stored, status, commit };
}
