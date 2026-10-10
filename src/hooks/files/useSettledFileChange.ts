'use client';

/**
 * @fileoverview **«ΑΛΛΑΞΕ ΑΡΧΕΙΟ — ΚΑΙ ΗΣΥΧΑΣΕ»** — ένα σήμα μετά το τελευταίο, όχι ένα ανά αρχείο.
 * @related hooks/listings/usePublishedMediaAgreement · hooks/files/useEntityFileRecords (οι δύο καταναλωτές)
 * @module hooks/files/useSettledFileChange
 *
 * Εξήχθη από το `usePublishedMediaAgreement` όταν η δήλωση κάτοψης ορόφου χρειάστηκε την **ίδια** ερώτηση
 * (ADR-907 §11.10, N.18): ό,τι κρίνει αρχεία ξαναρωτά όταν ο άνθρωπος τα αλλάζει στην ίδια οθόνη. Η μαζική πράξη
 * 30 φωτογραφιών μαζεύεται σε **ένα** σήμα, λίγο μετά το τελευταίο.
 */

import { useEffect, useRef } from 'react';

import { RealtimeService } from '@/services/realtime';

/** Τα σήματα που σημαίνουν *«άλλαξε αρχείο»* — όσα ακούει και η λίστα αρχείων της ίδιας οθόνης. */
const FILE_CHANGE_EVENTS = [
  'FILE_CREATED',
  'FILE_UPDATED',
  'FILE_TRASHED',
  'FILE_RESTORED',
  'FILE_SUPERSEDED',
] as const;

/** Πόσο περιμένει μετά το τελευταίο σήμα πριν μιλήσει (ms). */
export const FILE_CHANGE_SETTLE_MS = 600;

/**
 * @param subject — **για ποιον** ακούμε. `null` ⇒ κανένας ακροατής. Αλλαγή του ⇒ ό,τι εκκρεμούσε για τον προηγούμενο
 *   **ακυρώνεται**: αργοπορημένο σήμα άλλου θέματος δεν επιτρέπεται να ξυπνήσει την τρέχουσα οθόνη.
 */
export function useSettledFileChange(subject: string | null, onSettled: () => void): void {
  // Ο ακροατής στήνεται μία φορά ανά θέμα· η συνάρτηση διαβάζεται **τη στιγμή του σήματος**, ποτέ στιγμιότυπο.
  const latest = useRef(onSettled);
  useEffect(() => { latest.current = onSettled; });

  useEffect(() => {
    if (subject === null) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onFileChange = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => latest.current(), FILE_CHANGE_SETTLE_MS);
    };
    const unsubscribers = FILE_CHANGE_EVENTS.map((event) => RealtimeService.subscribe(event, onFileChange));

    return () => {
      if (timer !== null) clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [subject]);
}
