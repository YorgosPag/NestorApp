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

import type { CertificateEnergySource } from '@/constants/certificate-energy-sources';
import type { EnergyClass } from '@/constants/energy-classes';

import type { EnergyCertificateAbsence, EnergyCertificateScope } from './energy-certificate';
import type { PeaImportRefusal } from './pea-import-outcome';
import type { PeaFlag } from './pea-proposal';
import type { PeaField } from './pea-text';

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

/** Οι οκτώ γραμμές του πίνακα τελικής ενέργειας του ΠΕΑ, με τα ονόματα του εντύπου (ADR-777 §8.95). */
export const CERTIFICATE_ENERGY_SOURCE_KEY: Readonly<Record<CertificateEnergySource, string>> = {
  electricity: 'properties-enums:energyCertificate.source.electricity',
  oil: 'properties-enums:energyCertificate.source.oil',
  'natural-gas': 'properties-enums:energyCertificate.source.naturalGas',
  'other-fossil': 'properties-enums:energyCertificate.source.otherFossil',
  solar: 'properties-enums:energyCertificate.source.solar',
  biomass: 'properties-enums:energyCertificate.source.biomass',
  geothermal: 'properties-enums:energyCertificate.source.geothermal',
  'other-renewable': 'properties-enums:energyCertificate.source.otherRenewable',
};

export const ENERGY_CERTIFICATE_ABSENCE_KEY: Readonly<Record<EnergyCertificateAbsence, string>> = {
  pending: 'properties-enums:energyCertificate.absence.pending',
  exempt: 'properties-enums:energyCertificate.absence.exempt',
};

/** Τα πεδία του εντύπου που διαβάζει η εισαγωγή (ADR-777 §8.96) — για το «δεν διαβάστηκαν: …». */
export const PEA_FIELD_KEY: Readonly<Record<PeaField, string>> = {
  protocol: 'properties-enums:energyCertificate.import.field.protocol',
  securityNumber: 'properties-enums:energyCertificate.import.field.securityNumber',
  issuedOn: 'properties-enums:energyCertificate.import.field.issuedOn',
  validUntil: 'properties-enums:energyCertificate.import.field.validUntil',
  unitTitle: 'properties-enums:energyCertificate.import.field.unitTitle',
  buildingUse: 'properties-enums:energyCertificate.import.field.buildingUse',
  totalArea: 'properties-enums:energyCertificate.import.field.totalArea',
  usefulArea: 'properties-enums:energyCertificate.import.field.usefulArea',
  referenceEnergy: 'properties-enums:energyCertificate.import.field.referenceEnergy',
  primaryEnergy: 'properties-enums:energyCertificate.import.field.primaryEnergy',
  co2Emissions: 'properties-enums:energyCertificate.import.field.co2Emissions',
  finalEnergy: 'properties-enums:energyCertificate.import.field.finalEnergy',
};

/** Οι προειδοποιήσεις της προεπισκόπησης — η αμφίσημη/άγνωστη κλάση λέγεται στο ίδιο το πεδίο της κλάσης. */
export const PEA_WARNING_KEY: Readonly<Record<Exclude<PeaFlag, 'class-ambiguous' | 'class-unreadable'>, string>> = {
  'building-suspected': 'properties-enums:energyCertificate.import.flag.buildingSuspected',
  'area-mismatch': 'properties-enums:energyCertificate.import.flag.areaMismatch',
  expired: 'properties-enums:energyCertificate.import.flag.expired',
  'older-than-current': 'properties-enums:energyCertificate.import.flag.olderThanCurrent',
  incomplete: 'properties-enums:energyCertificate.import.flag.incomplete',
};

/** Γιατί δεν έγινε η εισαγωγή — αρνήσεις του server + οι δύο βλάβες της οθόνης. */
export const PEA_IMPORT_FAILURE_KEY: Readonly<Record<PeaImportRefusal | 'UPLOAD_FAILED' | 'UNAVAILABLE', string>> = {
  'file-missing': 'properties-enums:energyCertificate.import.failed.fileMissing',
  'file-not-yours': 'properties-enums:energyCertificate.import.failed.fileNotYours',
  'file-not-ready': 'properties-enums:energyCertificate.import.failed.fileNotReady',
  'file-wrong-type': 'properties-enums:energyCertificate.import.failed.fileWrongType',
  'file-too-large': 'properties-enums:energyCertificate.import.failed.fileTooLarge',
  'not-a-certificate': 'properties-enums:energyCertificate.import.failed.notACertificate',
  UPLOAD_FAILED: 'properties-enums:energyCertificate.import.failed.uploadFailed',
  UNAVAILABLE: 'properties-enums:energyCertificate.import.failed.unavailable',
};

/** Μονάδα ή ολόκληρο κτήριο (ADR-777 §8.96). */
export const ENERGY_CERTIFICATE_SCOPE_KEY: Readonly<Record<EnergyCertificateScope, string>> = {
  unit: 'properties-enums:energyCertificate.scope.unit',
  building: 'properties-enums:energyCertificate.scope.building',
};
