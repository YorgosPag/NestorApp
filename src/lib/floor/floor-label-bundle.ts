/**
 * @fileoverview Η ετικέτα ορόφου **έξω** από το i18next (ADR-903): server, email, ειδοποιήσεις,
 * showcase/PDF, ai-pipeline — και η Ελληνική canonical `longName` που αποθηκεύεται.
 * @module lib/floor/floor-label-bundle
 *
 * 🔑 Ίδια κλειδιά, ίδιος μορφοποιητής (`formatFloorRef`) με την UI — μόνο ο μεταφραστής αλλάζει:
 * `createBundleTranslate` πάνω στα `floors.json`, **στη γλώσσα του παραλήπτη** (όχι στην καθολική του
 * i18next — ένα πέρασμα ειδοποιήσεων μιλά σε πολλούς ανθρώπους, ADR-887).
 */

import elFloors from '@/i18n/locales/el/floors.json';
import enFloors from '@/i18n/locales/en/floors.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import { inferKindFromNumber, type FloorKind } from '@/utils/floor-naming';
import { formatFloorRef } from './floor-label';
import type { FloorRef } from './floor-ref';

const TRANSLATORS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ floors: elFloors }, 'floors', 'el'),
  en: createBundleTranslate({ floors: enFloors }, 'floors', 'en'),
};

/** Η ετικέτα ορόφου στη γλώσσα του παραλήπτη. */
export function floorLabelIn(ref: FloorRef, language: HumanLanguage): string {
  return formatFloorRef(ref, TRANSLATORS[language]);
}

/**
 * Η Ελληνική canonical `Floor.longName` (ADR-369 §9 Q9 — αποθηκεύεται πάντα ελληνικά).
 * Ήταν το `generateAutoLongName` με δικό του ελληνικό κείμενο· πλέον τα **ίδια** κλειδιά με την UI.
 */
export function canonicalFloorLongName(kind: FloorKind, number: number): string {
  return floorLabelIn({ number, kind }, 'el');
}

/** Τα πεδία ενός εγγράφου ορόφου που ορίζουν το όνομά του. */
export interface StoredFloorNaming {
  readonly number: number;
  readonly name?: string | null;
  readonly longName?: string | null;
  readonly kind?: FloorKind | null;
}

/**
 * Το όνομα ενός **αποθηκευμένου** ορόφου, όπως το βλέπει ο άνθρωπος: `longName` → `name` → canonical.
 *
 * 🔑 Ο ΕΝΑΣ κανόνας για κάθε επιφάνεια που δείχνει έγγραφο ορόφου (καρτέλες, οδηγός εισαγωγής,
 * ετικέτα επιπέδου). Ήταν τρεις: οι καρτέλες έδειχναν «Θεμελίωση», ο οδηγός «F» (ADR-914 §8.18).
 * Το `name` είναι ο σύντομος κωδικός (ADR-369)· μόνο του είναι εφεδρεία, ποτέ πρώτη επιλογή.
 */
export function storedFloorLabel(floor: StoredFloorNaming): string {
  if (floor.longName) return floor.longName;
  if (floor.name) return floor.name;
  return canonicalFloorLongName(floor.kind ?? inferKindFromNumber(floor.number), floor.number);
}
