/**
 * @fileoverview **ΧΑΡΤΗΣ ΑΝΤΙΣΤΟΙΧΙΣΗΣ ΓΕΜΗ** (crosswalk) — νομικές μορφές και καταστάσεις (ADR-948 §8.3).
 * @module config/company-registry/gemi-legal-forms
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΣΗΜΕΙΟ ΑΛΗΘΕΙΑΣ, ΤΡΕΙΣ ΑΞΟΝΕΣ ΑΝΑ ΚΩΔΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος `/metadata/legalTypes` του ΓΕΜΗ δίνει **μόνο** `id · descr · descrEn ·
 * lastUpdated` — **καμία** σημαία προσώπου. Η κατάταξη είναι λοιπόν **δική μας κρίση** και
 * ζει εδώ, μία φορά, με την **πηγή της** σε κάθε γραμμή:
 *
 * 1. `subject` — **ποιος είναι το υποκείμενο της εγγραφής;** Αυτός είναι ο φράχτης.
 *    Πρότυπο: ISO 17442-1 (LEI) — επιλέξιμη είναι κάθε οντότητα που **δεν είναι φυσικό
 *    πρόσωπο**, ακόμη και χωρίς νομική προσωπικότητα (προσωπικές εταιρείες, συμβατικά
 *    σχήματα, υποκαταστήματα αλλοδαπής — LEI ROC 2016). Ο λόγος του φράχτη είναι ο GDPR
 *    (ADR-948 §4 #9: ο ΑΦΜ της ατομικής είναι **προσωπικός**), όχι η αστική προσωπικότητα.
 * 2. `legalPersonality` — **έχει νομική προσωπικότητα;** Πληροφορία για τον άνθρωπο
 *    (π.χ. η κοινοπραξία **δεν** έχει, ν. 4072/2012 άρθρο 293 §1), **ποτέ** κριτήριο φράχτη.
 *    `unverified` = η διάταξη δεν διαβάστηκε από το ΦΕΚ — ειπωμένο, όχι μαντεμένο.
 * 3. Δύο προβολές: `elf` (ISO 20275, GLEIF v1.6 2026-02-19 — **μόνο** όπου η ελληνική
 *    ονομασία του ELF είναι η ίδια μορφή· κανένας επίσημος χάρτης ΓΕΜΗ→ELF δεν υπάρχει) και
 *    `contactLegalForm` (η **τυποποιημένη** κατηγορία της επαφής, όπως το «Standardised legal
 *    form» δίπλα στο «National legal form» των BvD/Orbis· `null` = δεν συγκρίνεται).
 *
 * ⛔ **Fail-closed**: κωδικός που λείπει από εδώ ⇒ άρνηση. Το `descr` είναι το
 * **στιγμιότυπο** του καταλόγου (ζωντανή μέτρηση 2026-11-22)· αν ο ζωντανός κατάλογος
 * γράψει άλλη περιγραφή για τον ίδιο κωδικό, ο κωδικός **άλλαξε νόημα** και η κρίση
 * αρνείται μέχρι να ξαναδεί άνθρωπος αυτόν τον πίνακα (ADR-948 §8 Βήμα 2).
 *
 * ⚠️ Τα fixtures του repo είναι **συνθετικά** (π.χ. ΑΕ=`'3'`)· αλήθεια είναι **αυτός** ο πίνακας.
 */

import type { VOCAB_GEMI_STATUSES } from '@/config/vocabulary/options/company';
import type { LegalForm } from '@/lib/contact/legal-form-vocabulary';

/** Η τυποποιημένη νομική μορφή της επαφής — **δεμένη** στη ρίζα του λεξιλογίου (`legal-form-vocabulary.ts`). */
export type ContactLegalForm = LegalForm;

/** Η κατάσταση ΓΕΜΗ της επαφής — **δεμένη** στη ρίζα του λεξιλογίου. */
export type ContactGemiStatus = (typeof VOCAB_GEMI_STATUSES)[number]['value'];

/** Η ημέρα της ζωντανής μέτρησης των δύο καταλόγων. */
export const GEMI_CATALOG_SNAPSHOT_DATE = '2026-11-22' as const;

/**
 * Το υποκείμενο της εγγραφής — **ο φράχτης**.
 * - `entity`: οντότητα, όχι φυσικό πρόσωπο ⇒ επιτρέπεται.
 * - `natural-person`: φυσικό πρόσωπο (ατομική) ⇒ άρνηση, τίποτα δεν αποθηκεύεται.
 * - `unclassifiable`: ο κωδικός δεν λέει **τι** είναι ⇒ άρνηση (fail-closed).
 */
export type RegistrySubject = 'entity' | 'natural-person' | 'unclassifiable';

export type LegalPersonality = 'yes' | 'no' | 'unverified';

export interface GemiLegalFormEntry {
  readonly gemiId: string;
  /** Στιγμιότυπο του `descr` — η άγκυρα της ανίχνευσης ολίσθησης. */
  readonly descr: string;
  readonly descrEn: string;
  readonly subject: RegistrySubject;
  readonly legalPersonality: LegalPersonality;
  /** Η πηγή της κρίσης — νόμος, κανονισμός ή πρότυπο. */
  readonly basis: string;
  /** ISO 20275 ELF, ή `null` όταν δεν υπάρχει ELF για **αυτή** τη μορφή. */
  readonly elf: string | null;
  readonly contactLegalForm: ContactLegalForm | null;
}

/* eslint-disable custom/no-hardcoded-strings -- στιγμιότυπο καταλόγου ΓΕΜΗ + νομικές πηγές, όχι UI */
export const GEMI_LEGAL_FORMS: readonly GemiLegalFormEntry[] = [
  { gemiId: '0', descr: 'Inadequate Info', descrEn: 'Inadequate Info', subject: 'unclassifiable', legalPersonality: 'unverified', basis: 'ΓΕΜΗ: ελλιπή στοιχεία — η μορφή είναι άγνωστη', elf: null, contactLegalForm: null },
  { gemiId: '1', descr: 'ΑΕ', descrEn: 'SA', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 4548/2018 άρθρο 1', elf: 'W2NK', contactLegalForm: 'ae' },
  { gemiId: '2', descr: 'ΟΕ', descrEn: 'GP', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 4072/2012 άρθρα 249 επ.', elf: 'TIZ2', contactLegalForm: 'oe' },
  { gemiId: '3', descr: 'ΣυνΠΕ', descrEn: 'LLCo', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 1667/1986 (αστικοί συνεταιρισμοί)', elf: 'J3VJ', contactLegalForm: 'syndicate' },
  { gemiId: '4', descr: 'ΕΕ', descrEn: 'LP', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 4072/2012 άρθρα 271 επ.', elf: '54AL', contactLegalForm: 'ee' },
  { gemiId: '8', descr: 'ΕΠΕ', descrEn: 'LLC', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 3190/1955', elf: 'H6OR', contactLegalForm: 'epe' },
  { gemiId: '9', descr: 'ΚΟΙΝΩΝΙΑ', descrEn: 'SOCIETY', subject: 'unclassifiable', legalPersonality: 'no', basis: 'ΑΚ 785 επ. — κοινωνία δικαιώματος, όχι εταιρικός τύπος· κανένας κωδικός ELF', elf: null, contactLegalForm: null },
  { gemiId: '10', descr: 'Ευρωπαϊκός Όμιλος Οικονομικού Σκοπού', descrEn: 'European Economic Interest Grouping', subject: 'entity', legalPersonality: 'unverified', basis: 'Καν. (ΕΟΚ) 2137/85 άρθρο 1 §3 — την προσωπικότητα την ορίζει το κράτος έδρας (π.δ. 389/1989, ανεπαλήθευτο)', elf: 'QNWW', contactLegalForm: 'other' },
  { gemiId: '11', descr: 'Συνεταιρισμός', descrEn: 'Cooperative', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 1667/1986 (αστικοί συνεταιρισμοί)', elf: 'J3VJ', contactLegalForm: 'syndicate' },
  { gemiId: '12', descr: 'Ευρωπαϊκή Εταιρία (SE)', descrEn: 'European Company (SE)', subject: 'entity', legalPersonality: 'yes', basis: 'Καν. (ΕΚ) 2157/2001 άρθρο 1 §3', elf: 'CQ5X', contactLegalForm: 'other' },
  { gemiId: '13', descr: 'Ευρωπαϊκή Συνεταιριστική Εταιρία (SCE)', descrEn: 'European Cooperative Society (SCE)', subject: 'entity', legalPersonality: 'yes', basis: 'Καν. (ΕΚ) 1435/2003 άρθρα 1 και 18', elf: null, contactLegalForm: 'syndicate' },
  { gemiId: '14', descr: 'Κοινοπραξία', descrEn: 'Consortium', subject: 'entity', legalPersonality: 'no', basis: 'ν. 4072/2012 άρθρο 293 §1 — χωρίς νομική προσωπικότητα· με την καταχώριση αποκτά ικανότητα δικαίου ως ένωση προσώπων', elf: 'MCWR', contactLegalForm: 'joint_venture' },
  { gemiId: '15', descr: 'Υποκατάστημα Αλλοδαπής', descrEn: 'Foreign Branch', subject: 'entity', legalPersonality: 'no', basis: 'υποκατάστημα — το νομικό πρόσωπο είναι η αλλοδαπή μητρική (πρβλ. LEI ROC 2016, international branch)', elf: null, contactLegalForm: null },
  { gemiId: '16', descr: 'ΑΤΟΜΙΚΗ', descrEn: 'SOLE', subject: 'natural-person', legalPersonality: 'no', basis: 'φυσικό πρόσωπο — ο ΑΦΜ είναι προσωπικός (ADR-948 §4 #9)', elf: null, contactLegalForm: 'sole_proprietorship' },
  { gemiId: '17', descr: 'ΕΝΩΣΗ ΠΡΟΣΩΠΩΝ', descrEn: 'ASSOCIATION OF PERSONS', subject: 'unclassifiable', legalPersonality: 'no', basis: 'ένωση προσώπων χωρίς εταιρικό τύπο — κανένας κωδικός ELF', elf: null, contactLegalForm: null },
  { gemiId: '18', descr: 'ΑΣΤΙΚΗ ΕΤΑΙΡΕΙΑ 784 Α.Κ.', descrEn: 'Civil Company 784 S.A.', subject: 'entity', legalPersonality: 'yes', basis: 'ΑΚ 784 · ν. 4919/2022 άρθρο 16 §1 περ. η΄ (στο ΓΕΜΗ μόνο με νομική προσωπικότητα)', elf: 'HKVP', contactLegalForm: 'civil_partnership' },
  { gemiId: '19', descr: 'ΙΚΕ', descrEn: 'PC', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 4072/2012 άρθρο 43', elf: 'QCA0', contactLegalForm: 'ike' },
  { gemiId: '20', descr: 'ΚΟΙ.Σ.Π.Ε', descrEn: 'LLSCo', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 2716/1999 άρθρο 12 · Κοιν.Σ.Επ. Ένταξης (ν. 4430/2016 άρθρο 15 §1)', elf: null, contactLegalForm: 'syndicate' },
  { gemiId: '21', descr: 'Αγροτικός Συνεταιρισμός', descrEn: 'Agricultural Partnership', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 4673/2020 (αγροτικοί συνεταιρισμοί)', elf: 'J3VJ', contactLegalForm: 'syndicate' },
  { gemiId: '64', descr: 'ΛΟΙΠΩΝ ΥΠΟΧΡΕΩΝ', descrEn: 'OTHER LIABLES', subject: 'unclassifiable', legalPersonality: 'unverified', basis: 'ΓΕΜΗ: συλλεκτική κατηγορία — η μορφή είναι άγνωστη', elf: null, contactLegalForm: null },
  { gemiId: '65', descr: 'Ενεργειακή Κοινότητα', descrEn: 'Energy Community', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 4513/2018 άρθρο 1 — αστικός συνεταιρισμός· συμπληρωματικά ν. 1667/1986', elf: null, contactLegalForm: 'syndicate' },
  { gemiId: '66', descr: 'Κοιν.Σ.Επ.', descrEn: 'SoCC', subject: 'entity', legalPersonality: 'yes', basis: 'ν. 4430/2016 άρθρο 15 §1 — νομική προσωπικότητα με την εγγραφή στο Μητρώο', elf: null, contactLegalForm: 'syndicate' },
  { gemiId: '67', descr: 'Συνεταιρισμός Εργαζομένων', descrEn: "Workers' Cooperatives", subject: 'entity', legalPersonality: 'unverified', basis: 'ν. 4430/2016 άρθρα 24-25 (το κείμενο του άρθρου 24 ανεπαλήθευτο)', elf: null, contactLegalForm: 'syndicate' },
  { gemiId: '68', descr: 'ΕΕ κατά μετοχές', descrEn: 'Limited partnership by shares', subject: 'entity', legalPersonality: 'yes', basis: 'ετερόρρυθμη εταιρεία κατά μετοχές — εμπορική εταιρεία (ISO 20275 UCU5)', elf: 'UCU5', contactLegalForm: 'other' },
  { gemiId: '69', descr: 'ΚΟΙΝΟΤΗΤΑ ΑΝΑΝΕΩΣΙΜΗΣ ΕΝΕΡΓΕΙΑΣ', descrEn: 'Renewable energy community', subject: 'entity', legalPersonality: 'unverified', basis: 'ν. 3468/2006 Κεφ. ΒΑ΄ (ν. 5037/2023) — συμπληρωματικά ν. 1667/1986 (άρθρο 6Β §3)', elf: null, contactLegalForm: 'other' },
  { gemiId: '70', descr: 'ΕΝΕΡΓΕΙΑΚΗ ΚΟΙΝΟΤΗΤΑ ΠΟΛΙΤΩΝ', descrEn: 'Citizen energy communities', subject: 'entity', legalPersonality: 'unverified', basis: 'ν. 3468/2006 Κεφ. ΒΑ΄ (ν. 5037/2023)', elf: null, contactLegalForm: 'other' },
];

export interface GemiStatusEntry {
  readonly gemiId: string;
  /** Στιγμιότυπο του `descr` — η άγκυρα της ανίχνευσης ολίσθησης. */
  readonly descr: string;
  readonly descrEn: string;
  /** Στιγμιότυπο του `isActive` του καταλόγου. */
  readonly isActive: boolean;
  /**
   * Οι τιμές της επαφής που **λένε το ίδιο**. Η πρώτη είναι αυτή που γράφει το «Δέξου».
   * Κενό ⇒ το λεξιλόγιο της επαφής δεν έχει λέξη γι' αυτό ⇒ «δεν συγκρίνεται».
   */
  readonly contactStatuses: readonly ContactGemiStatus[];
}

export const GEMI_COMPANY_STATUSES: readonly GemiStatusEntry[] = [
  { gemiId: '0', descr: 'Άλλο', descrEn: 'Other', isActive: false, contactStatuses: [] },
  { gemiId: '2', descr: 'Προεγγραφή', descrEn: 'Pre-registration', isActive: false, contactStatuses: [] },
  { gemiId: '3', descr: 'Ενεργή', descrEn: 'Active', isActive: true, contactStatuses: ['active'] },
  { gemiId: '4', descr: 'Σε Αδράνεια', descrEn: 'Dormant', isActive: false, contactStatuses: ['inactive'] },
  { gemiId: '5', descr: 'Πτώχευση', descrEn: 'Bankruptcy', isActive: false, contactStatuses: ['bankruptcy'] },
  { gemiId: '7', descr: 'Λύση - Εκκαθάριση', descrEn: 'Dissolution - Liquidation', isActive: false, contactStatuses: ['liquidation', 'dissolution'] },
  { gemiId: '15', descr: 'Διαδικασία Συνδιαλλαγής', descrEn: 'Conciliation procedure', isActive: false, contactStatuses: [] },
  { gemiId: '17', descr: 'Διαγραφή', descrEn: 'Deletion', isActive: false, contactStatuses: ['dissolved'] },
  { gemiId: '18', descr: 'Διαγραφή λόγω συγχώνευσης', descrEn: 'Deletion due to merger', isActive: false, contactStatuses: ['dissolved'] },
  { gemiId: '19', descr: 'Αναγκαστική διαχείριση', descrEn: 'Forced Management', isActive: false, contactStatuses: [] },
  { gemiId: '20', descr: 'Διαγραφή λόγω διάσπασης', descrEn: 'Deletion due to division', isActive: false, contactStatuses: ['dissolved'] },
  { gemiId: '21', descr: 'Αναστολή καταχώρησης', descrEn: 'Suspension of registration', isActive: false, contactStatuses: ['suspended'] },
];
/* eslint-enable custom/no-hardcoded-strings */

const LEGAL_FORM_BY_ID: ReadonlyMap<string, GemiLegalFormEntry> = new Map(
  GEMI_LEGAL_FORMS.map((entry) => [entry.gemiId, entry]),
);

const STATUS_BY_ID: ReadonlyMap<string, GemiStatusEntry> = new Map(
  GEMI_COMPANY_STATUSES.map((entry) => [entry.gemiId, entry]),
);

/** Η γραμμή του χάρτη για έναν κωδικό νομικής μορφής — `null` ⇒ άγνωστος κωδικός (fail-closed). */
export function findGemiLegalForm(gemiId: string): GemiLegalFormEntry | null {
  return LEGAL_FORM_BY_ID.get(gemiId) ?? null;
}

/** Η γραμμή του χάρτη για έναν κωδικό κατάστασης — `null` ⇒ άγνωστος κωδικός. */
export function findGemiCompanyStatus(gemiId: string): GemiStatusEntry | null {
  return STATUS_BY_ID.get(gemiId) ?? null;
}
