/**
 * @fileoverview Μητρώο λήξεων — το ΣΥΜΒΟΛΑΙΟ της ανάγνωσης διακομιστή (ADR-915 Φ4β): όρια και σχήμα απόκρισης.
 * @module services/document-registry/document-registry.types
 *
 * ⚠️ **ΤΑ ΟΡΙΑ ΛΕΓΟΝΤΑΙ, ΔΕΝ ΚΡΥΒΟΝΤΑΙ** (ιδίωμα `MANDATE_CATALOG_CAP`): ένας σιωπηλός αποκεφαλισμός θα διάβαζε «αυτά
 * είναι όλα» ενώ θα ήταν «όσα χώρεσαν» — και σε μητρώο λήξεων αυτό σημαίνει «τίποτα δεν λήγει» για εταιρεία που έχει.
 * Κάθε πηγή που χτύπησε το όριό της **ονομάζεται** στο `truncatedSources`.
 */

import type { OperationalStatus } from '@/constants/operational-statuses';
import type { PropertyClass } from '@/constants/property-types';
import type { DocumentRegistry } from '@/lib/document-validity/document-registry';
import type { RowIssuance } from '@/lib/document-validity/issuance-rows';
import type { ObligorLead } from '@/lib/document-validity/obligor-lead';
import type { UpkeepItem } from '@/lib/document-validity/property-upkeep';

/**
 * Οι πηγές που διαβάζονται με ερώτημα — άρα έχουν όριο. Φ4δ: `owner-properties` (ακίνητα ιδιωτών υπό θεματοφυλακή του
 * γραφείου, Ε10) · `listings` (οι αγγελίες με το όνομα του γραφείου — βρίσκονται **και** όταν το ακίνητο δεν έχει
 * κανένα έγγραφο, Ε11). §27: `issuance-assignments` (οι αναθέσεις έκδοσης του γραφείου — τρέχουσες **και** «ξανά»).
 * §33: `undeclared-files` (αρχεία **χωρίς στοιχεία** σε θέση που υπόσχεται είδος — «Συμπλήρωση στοιχείων»).
 * §35: `upkeep-declarations` (οι αποφάσεις μόνιμης υποχρέωσης του γραφείου — επιβεβαιώσεις **και** εξαιρέσεις).
 * §36: `company-properties` (**όλα** τα ακίνητα της εταιρείας — η μόνιμη υποχρέωση προτείνεται και σε ακίνητο χωρίς
 * κανένα έγγραφο, που είναι ακριβώς αυτό που πιθανότατα του λείπει).
 */
export const REGISTRY_SOURCES = [
  'files', 'declared', 'cases', 'owner-properties', 'listings', 'issuance-assignments', 'undeclared-files', 'upkeep-declarations',
  'company-properties',
] as const;
export type RegistrySource = (typeof REGISTRY_SOURCES)[number];

/** Βαλβίδα ασφαλείας ανά πηγή, όχι σελιδοποίηση. Η υπόθεση = ίδιο μέγεθος με τη σάρωση λήξεων (`EXPIRY_SWEEP_LIMIT`). */
export const DOCUMENT_REGISTRY_CAPS: Readonly<Record<RegistrySource, number>> = {
  files: 500,
  declared: 500,
  cases: 200,
  'owner-properties': 500,
  listings: 500,
  'issuance-assignments': 500,
  'undeclared-files': 500,
  'upkeep-declarations': 500,
  'company-properties': 500,
};

/** Σε ποιο **είδος** ακινήτου δείχνει το όνομα — αποφασίζει τη διεύθυνση της οθόνης (ακίνητο εταιρείας · εντολή). */
export const REGISTRY_PROPERTY_SCOPES = ['property', 'owner-property'] as const;
export type RegistryPropertyScope = (typeof REGISTRY_PROPERTY_SCOPES)[number];

/** Μέγεθος ομάδας `getAll` — δεν βρέθηκε τεκμηριωμένο όριο· αμυντικό (ADR-915 §11.3). */
export const REGISTRY_GET_ALL_CHUNK = 100;

/**
 * Ό,τι χρειάζεται η οθόνη για να **ονομάσει** κάτι: ακίνητο · αρχείο · και — ADR-915 §25 — τον άνθρωπο που φέρνει το
 * έγγραφο. Μόνο το **όνομα**: ποτέ τηλέφωνο, email ή άλλο πεδίο επαφής (5(1)(γ) — η κάρτα επαφής είναι ένα πάτημα μακριά).
 */
export interface RegistryLabel {
  readonly name: string | null;
}

/**
 * Το όνομα ενός αρχείου **και** το αντικείμενο που είδε η οθόνη (ADR-915 §33): η «Συμπλήρωση στοιχείων» το στέλνει πίσω
 * ως CAS — νέα έκδοση του αρχείου στο μεταξύ ⇒ άρνηση, ποτέ ημερομηνίες του παλιού πάνω στο νέο.
 */
export interface RegistryFileLabel extends RegistryLabel {
  readonly storagePath: string | null;
}

export interface RegistryPropertyLabel extends RegistryLabel {
  readonly scope: RegistryPropertyScope;
  /**
   * Ο **δήμος** του ακινήτου (ταυτότητα ADR-883, `municipality:<κωδ.>`) για το «Βρες επαγγελματία» (ADR-915 §24).
   * Υπολογίζεται **μόνο** για ακίνητα με γραμμή που το δείχνει. `null` = δεν ρωτήθηκε ή δεν αποδεικνύεται — **ποτέ**
   * «πουθενά»: ο κατάλογος ανοίγει τότε χωρίς περιοχή.
   */
  readonly areaId: string | null;
  /**
   * ADR-915 §25 — **ποιος** είναι ο ιδιοκτήτης (επαφές, `registry-owners.ts`): απαντά στο «Το φέρνει» κάθε γραμμής του
   * ακινήτου. `[]` = ρωτήθηκε και **δεν** ορίστηκε — η οθόνη το λέει, ποτέ σιωπηλό κενό. `null` = δεν ρωτήθηκε (καμία
   * τρέχουσα γραμμή το ονομάζει) ή η ανάγνωση απέτυχε — η οθόνη δείχνει **μόνο** τον ρόλο, χωρίς ισχυρισμό.
   */
  readonly ownerContactIds: readonly string[] | null;
  /**
   * ADR-915 §26 — **ο υπεύθυνος** των εγγράφων ακινήτου (`obligorLeadOf`): ρητή επιλογή · μοναδικός · πλειοψηφία
   * μεριδίων (ΑΚ 789) · κύριος μεταβιβάζων — ή **γιατί** δεν ορίζεται. `null` = δεν ρωτήθηκε / κανείς ιδιοκτήτης.
   */
  readonly obligorLead: ObligorLead | null;
  /** §26 — επαφή → μερίδιο %, **μόνο** όταν τα μερίδια είναι γνωστά (αγοραστές)· αλλιώς `{}`. */
  readonly ownerShares: Readonly<Record<string, number>>;
  /**
   * ADR-915 §33 — η κλάση του τύπου ακινήτου (`resolvedPropertyClassOf`): **μόνο** υπόδειξη για την προεπιλογή κατηγορίας
   * στη «Συμπλήρωση στοιχείων» (`classificationHintOf`). `null` = άγνωστος τύπος ⇒ καμία υπόδειξη.
   */
  readonly propertyClass: PropertyClass | null;
  /**
   * ADR-915 §35 — η **φάση** (`operationalStatus`, κανονικοποιημένη): μαζί με την κλάση, η βάση της πρότασης μόνιμης
   * υποχρέωσης (`upkeepProposalOf`). `null` = ακίνητο ιδιώτη (δεν έχει φάση) ή άγνωστη τιμή.
   */
  readonly phase: OperationalStatus | null;
}

export interface DocumentRegistryResponse extends DocumentRegistry {
  /** Η μία «σήμερα» (Ελλάδα) όλων των γραμμών. */
  readonly asOf: string;
  /** ISO — πότε αλλάζει η «σήμερα»: οι καταστάσεις αλλάζουν **μόνες τους** εκεί, και η οθόνη ξαναρωτά (ADR-901 §14.8). */
  readonly freshUntil: string;
  /** `true` όταν **κάποια** πηγή χτύπησε το όριο. **Ποτέ σιωπηλό.** */
  readonly truncated: boolean;
  readonly truncatedSources: readonly RegistrySource[];
  /**
   * Αγγελίες με το όνομα του γραφείου (`agencyId`) που **δεν** αντιστοιχούν σε ακίνητο ή εντολή υπό τη θεματοφυλακή του
   * — δεν ελέγχονται, και **μετριούνται** (Ε11): το όριο έχει αριθμό, όχι γενική φράση.
   */
  readonly unscopedListings: number;
  /** Ονόματα ακινήτων (γραμμή · υπόθεση · αγγελία δένονται όλα σε ακίνητο), με το είδος τους. */
  readonly properties: Readonly<Record<string, RegistryPropertyLabel>>;
  /** Ονόματα αρχείων (`displayName`) + το αντικείμενο που είδε η οθόνη (§33 CAS). */
  readonly files: Readonly<Record<string, RegistryFileLabel>>;
  /**
   * ADR-915 §25 — ονόματα επαφών (`cont_*` → όνομα), διαβασμένα **ζωντανά** με έλεγχο μισθωτή. Μόνο όσες ονομάζει κάποια
   * γραμμή. Επαφή που λείπει από εδώ (ξένη ≡ ανύπαρκτη, ADR-742) **δεν** δείχνεται ως σύνδεσμος.
   */
  readonly people: Readonly<Record<string, RegistryLabel>>;
  /** §27 — ανάθεση ανά γραμμή «Ανάθεσης» (κλειδί `issuanceKeyOf(ακίνητο, είδος)`· μόνο όσες τη δείχνουν). */
  readonly issuance: Readonly<Record<string, RowIssuance>>;
  /**
   * §27 — `false` = ο κατάλογος αναθέσεων **δεν** διαβάστηκε ⇒ η οθόνη κρύβει την «Ανάθεση» αντί να πει «καμία» (ένα
   * ψεύτικο «δεν ανατέθηκε» θα έφερνε δεύτερο ΠΕΑ).
   */
  readonly issuanceKnown: boolean;
  /**
   * ADR-915 §35 — η ενότητα «Μόνιμες υποχρεώσεις»: ανά (ακίνητο, είδος) ό,τι **περιμένει** απόφαση (προτείνεται · η
   * εφαρμογή δεν ξέρει) **και** ό,τι αποφασίστηκε. Χωριστά από τις γραμμές: η πρόταση **δεν** είναι κατάσταση εγγράφου.
   */
  readonly upkeep: readonly UpkeepItem[];
}
