/**
 * @fileoverview **Τα κλειδιά i18n του ενεργειακού πιστοποιητικού** (ADR-777 §8.94) — πλήρη, με namespace.
 * @related `./energy-certificate.ts` · `constants/energy-classes.ts` (η κλίμακα) ·
 *   `i18n/locales/{el,en}/properties-enums.json` (`energyClass.*` · `energyCertificate.absence.*`)
 * @module lib/energy-certificate/energy-certificate-keys
 *
 * 🔑 **Πίνακας, όχι template** (ίδιο ιδίωμα με το `COMMON_CHARGE_INCLUSION_KEY`): ένα `t(\`…${x}\`)` θα ήταν δυναμικό
 * κλειδί που ο γεννήτορας του slice δεν λύνει. `Record` πάνω σε κλειστό σύνολο ⇒ νέα τιμή δεν μεταγλωττίζεται χωρίς λέξη.
 *
 * 🔑 **Γιατί η κλάση χρειάζεται λέξη, ενώ είναι «ένα γράμμα»**: η αποθηκευμένη τιμή είναι η ευρωπαϊκή (`C` · `F` · `G`)·
 * το ελληνικό ΠΕΑ γράφει **Γ · Ζ · Η**. Αγγελία που λέει «G» σε αναγνώστη που κρατά χαρτί με «Η» λέει άλλη κλάση — και
 * το ελληνικό Η μοιάζει με το λατινικό H, που δεν υπάρχει καν στην κλίμακα. Η τιμή δεν αλλάζει· αλλάζει η ετικέτα.
 *
 * 📦 Ζουν στο `properties-enums` για τον ίδιο μετρημένο λόγο με τα κοινόχρηστα (ADR-777 §8.93.6): δικό τους namespace
 * θα πρόσθετε αναμονές λήψης και θα κοκκίνιζε τον χάρτη των τεμπέλικων διαδρομών (ADR-744 §27).
 */

import type { EnergyClass } from '@/constants/energy-classes';

import type { EnergyCertificateAbsence } from './energy-certificate';

export const ENERGY_CLASS_LABEL_KEY: Readonly<Record<EnergyClass, string>> = {
  'A+': 'properties-enums:energyClass.aPlus',
  A: 'properties-enums:energyClass.a',
  'B+': 'properties-enums:energyClass.bPlus',
  B: 'properties-enums:energyClass.b',
  C: 'properties-enums:energyClass.c',
  D: 'properties-enums:energyClass.d',
  E: 'properties-enums:energyClass.e',
  F: 'properties-enums:energyClass.f',
  G: 'properties-enums:energyClass.g',
};

export const ENERGY_CERTIFICATE_ABSENCE_KEY: Readonly<Record<EnergyCertificateAbsence, string>> = {
  pending: 'properties-enums:energyCertificate.absence.pending',
  exempt: 'properties-enums:energyCertificate.absence.exempt',
};
