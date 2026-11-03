/**
 * Το λεξιλόγιο του ETIM xChange (ADR-923 §5.5 · Φάση 7). Τα μοτίβα είναι αυτά του επίσημου σχήματος 2.0, αντιγραμμένα
 * αυτούσια: κωδικός που περνά εδώ περνά και τον validator του ETIM. Άγκυρα: `interop/etim/__tests__`.
 * @module subapps/catalog/vocabulary/etim
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { NoValueReason } from '../types/product';

export const ETIM_XCHANGE_SCHEMA_VERSION = '2.0';

export const ETIM_CLASS_CODE_PATTERN = /^EC[0-9]{6}$/;
export const ETIM_FEATURE_CODE_PATTERN = /^EF([0-9]{6}|I[0-9]{5}|[A-Z]{2}[0-9]{4})$/;
export const ETIM_VALUE_CODE_PATTERN = /^EV[0-9]{6}$/;

/** Ο αγγλοσαξονικός δίδυμος ενός μετρικού χαρακτηριστικού: το `EFI06272` λέει σε ίντσες ό,τι το `EF006272` σε mm. */
export const isEtimImperialFeature = (code: string): boolean => code.startsWith('EFI');

/** `Pattern` του `EtimValueNumeric`: έως 12 ακέραια και 4 δεκαδικά, τελεία ως υποδιαστολή, χωρίς ομαδοποίηση. */
export const ETIM_MAX_FRACTION_DIGITS = 4;
export const ETIM_NUMERIC_PATTERN = /^-?[0-9]{1,12}\.?[0-9]{0,4}$/;

/** Το `ReasonNoValue` του ETIM. Το `MV` (missing value) είναι απλώς κενό, γι' αυτό δεν έχει αντίστοιχο στο `NoValueReason`. */
export const ETIM_REASON_OF: Readonly<Record<NoValueReason, 'NA' | 'UN'>> = { notApplicable: 'NA', unknown: 'UN' };

export const ETIM_NO_VALUE_REASON_OF: Readonly<Record<string, NoValueReason | undefined>> = { NA: 'notApplicable', UN: 'unknown' };

/** Η γλώσσα του xChange (`el-GR`), όπως τη ζητά το σχήμα. */
export const ETIM_LANGUAGE_TAG: Readonly<Record<HumanLanguage, string>> = { el: 'el-GR', en: 'en-GB' };

/** UNECE Rec 20 «τεμάχιο». Η μόνη μονάδα παραγγελίας και τιμής που γράφουμε χωρίς να τη γνωρίζει ο τιμοκατάλογος. */
export const ETIM_PIECE_UNIT = 'C62';

/** Μέγιστο μήκος `SupplierItemNumber` / `ManufacturerProductNumber` στο σχήμα 2.0. Μακρύτερος κωδικός δεν κόβεται ποτέ: θα ήταν άλλο SKU. */
export const ETIM_ITEM_NUMBER_MAX = 35;

/**
 * Οι μονάδες που δέχονται το `PriceUnit` **και** το `OrderUnit` του σχήματος 2.0, αυτούσιες (οι δύο λίστες είναι ίδιες). Η άγκυρα
 * `etim-xchange-roundtrip.test.ts` τις συγκρίνει με το επίσημο σχήμα, ώστε νέα έκδοσή του να μη μείνει αθέατη.
 */
export const ETIM_XCHANGE_UNITS = [
  'ANN', 'BE', 'BG', 'BO', 'BX', 'C62', 'CA', 'CI', 'CL', 'CMK', 'CMQ', 'CMT', 'CQ', 'CR', 'CS', 'CT', 'D99', 'DAY', 'DR', 'DZN', 'FOT',
  'FTQ', 'GRM', 'HLT', 'HUR', 'INH', 'INQ', 'KG', 'KGM', 'KTM', 'LBR', 'LTN', 'LTR', 'MGM', 'MIN', 'MLT', 'MMK', 'MMQ', 'MMT', 'MTK',
  'MTQ', 'MTR', 'ONZ', 'PA', 'PF', 'PK', 'PL', 'PR', 'PU', 'RG', 'RL', 'RO', 'SA', 'SEC', 'SET', 'SMI', 'ST', 'TN', 'TNE', 'TU', 'WEE',
  'YRD', 'Z2', 'Z3',
] as const;

export type EtimXChangeUnit = (typeof ETIM_XCHANGE_UNITS)[number];

/**
 * Κωδικοί UNECE του μητρώου μονάδων μας που το xChange γράφει αλλιώς. Το ETIM λέει «τεμάχιο» με `C62` («one»), εμείς με `H87`
 * («piece»). Οι συσκευασίες του Rec 21 (`X` + κωδικός) είναι στο σχήμα με τον παλιό κωδικό του Rec 20, χωρίς το `X`. Κάθε άλλη
 * απόκλιση **δεν** μαντεύεται: η τιμή γίνεται «ζητήστε προσφορά» και μετριέται (Ζ5).
 */
export const ETIM_UNECE_EQUIVALENTS: Readonly<Record<string, EtimXChangeUnit>> = { H87: 'C62', XBG: 'BG', XBX: 'BX', XRO: 'RO', XPK: 'PK' };

/**
 * Γιατί ένα ορατό SKU βγήκε με `PriceOnRequest` (ADR-923 §5.14 Ζ9): ορατό χωρίς τιμή για το κοινό · οι αιτίες της μηχανής τιμής ·
 * μονάδα τιμής χωρίς κωδικό του σχήματος. Η σειρά είναι η σειρά της αναφοράς.
 */
export const XCHANGE_ON_REQUEST_REASONS = [
  'visibleNoPrice',
  'noPriceList',
  'ambiguousPriceList',
  'noVersion',
  'noLine',
  'ambiguousDiscount',
  'invalidQuantity',
  'unitUnmapped',
] as const;

export type XChangeOnRequestReason = (typeof XCHANGE_ON_REQUEST_REASONS)[number];

/**
 * Γιατί μια εξαγωγή xChange **δεν θα είχε κανένα προϊόν** (ADR-923 §5.14.1 · απόφαση Ε3). Το σχήμα 2.0 ζητά `Product` με
 * `minItems: 1`: κενό αρχείο είναι **άκυρο** έγγραφο, άρα ποτέ δεν γράφεται. Η σειρά είναι η σειρά της διάγνωσης: ο κατάλογος
 * χωρίς προϊόντα · κανένας κανόνας ορατότητας (Δ3: χωρίς κανόνα ⇒ κρυφό) · όλα κρυφά για **αυτό** το κοινό · τα ορατά χωρίς
 * κωδικό που χωρά στο σχήμα.
 */
export const XCHANGE_EMPTY_CAUSES = ['catalogEmpty', 'noVisibilityRules', 'hiddenForAudience', 'noUsableIdentifier'] as const;

export type XChangeEmptyCause = (typeof XCHANGE_EMPTY_CAUSES)[number];
