/**
 * @fileoverview **Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΣΤΗ ΒΙΤΡΙΝΑ** — ό,τι βλέπει ο επισκέπτης για το ποιος είναι ο
 * επαγγελματίας στον νόμο (ADR-841 §7 Α23, Δ5–Δ8).
 * @module types/showcase-legal-identity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΟΝΟΜΑ ΕΙΝΑΙ **ΕΠΙΛΟΓΗ**, ΟΧΙ ΚΕΙΜΕΝΟ (Δ5)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πελάτης στέλνει **ποιο** όνομα θέλει (`legal-name` ή `distinctive-title`)· το **κείμενο** το
 * λύνει ο διακομιστής από το προφίλ (ADR-439) και την απάντηση του ΓΕΜΗ. Ελεύθερο κείμενο θα ήταν
 * *«Δοκιμαστικό Γραφείο Ο1-Ο9»* δίπλα σε σήμα «επαληθευμένο από ΓΕΜΗ» — μετρημένο 2026-09-14.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΑΠΟΘΗΚΕΥΜΕΝΟ ΑΝΤΙΓΡΑΦΟ — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΟΙ ΚΑΝΟΝΕΣ ΑΝΑΓΝΩΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στη διαχείριση το «επαληθευμένο» **παράγεται** στην ανάγνωση (`judgeRegistryIdentity`). Ο
 * **ανώνυμος** επισκέπτης όμως δεν διαβάζει ούτε το προφίλ ούτε το `company_registry_records`
 * (`deny_all`), άρα η βιτρίνα κρατά **στιγμιότυπο**. Δεν μπαγιατεύει σιωπηλά: **κάθε** πράξη που
 * αλλάζει είσοδο της κρίσης (αποθήκευση προφίλ, επαλήθευση ΓΕΜΗ, κάρτα) την **ξανατρέχει** —
 * `refreshShowcaseLegalIdentity` (Α1.6: η πράξη κατέχει τη συνέπεια).
 *
 * ⛔ **Ποτέ** `legalRepresentativeName`, **ποτέ** `persons` του ΓΕΜΗ (ADR-827 §9.9β, GDPR 5(1)(γ)).
 */

import type { CompanyRegistryDeclaration, RegistryIssuer } from '@/types/company-registry';

// =============================================================================
// Η ΕΔΡΑ — πόσο δημοσιεύεται (Δ7)
// =============================================================================

/**
 * **Πόση έδρα δημοσιεύεται.**
 *
 * | Τιμή | Τι φαίνεται | Πηγή |
 * |---|---|---|
 * | `full` | οδός · Τ.Κ. · πόλη της **καταστατικής** έδρας | προφίλ (ADR-439) |
 * | `business-address` | οδός · Τ.Κ. της **έδρας της κάρτας** + δήμος | κάρτα (Α21.16) |
 * | `municipality` | **μόνο** δήμος | ΓΕΜΗ (verified) ή πόλη προφίλ |
 *
 * 🔴 **Ατομική και ΟΕ: ΚΑΜΙΑ προεπιλογή** (GDPR άρθ. 25(2), απόφαση Giorgio 2026-09-14): ο φορέας
 * είναι φυσικό πρόσωπο και η έδρα συχνά η **κατοικία** του. Δημοσίευση «by default» χωρίς ενέργεια
 * του προσώπου απαγορεύεται — ο γραφέας αρνείται ονομαστικά (`agency-profile-seat-disclosure-missing`).
 */
export const SEAT_DISCLOSURES = ['full', 'business-address', 'municipality'] as const;
export type SeatDisclosure = (typeof SEAT_DISCLOSURES)[number];

export function isSeatDisclosure(value: unknown): value is SeatDisclosure {
  return SEAT_DISCLOSURES.some((disclosure) => disclosure === value);
}

/** Η έδρα **όπως δημοσιεύεται** — ήδη κομμένη στην επιλογή· ό,τι δεν επιλέχθηκε **δεν γράφεται**. */
export interface ShowcaseSeat {
  readonly disclosure: SeatDisclosure;
  /** `null` στο `municipality`. */
  readonly streetLine: string | null;
  readonly postalCode: string | null;
  readonly locality: string;
}

// =============================================================================
// ΤΟ ΟΝΟΜΑ — ποιο δημοσιεύεται (Δ5)
// =============================================================================

export const PUBLIC_NAME_KINDS = ['legal-name', 'distinctive-title'] as const;
export type PublicNameKind = (typeof PUBLIC_NAME_KINDS)[number];

/** Ό,τι **επιλέγει** ο άνθρωπος. Ο τίτλος ταξιδεύει μόνο για να ξέρουμε **ποιον** από τους πολλούς. */
export type PublicNameChoice =
  | { readonly kind: 'legal-name' }
  | { readonly kind: 'distinctive-title'; readonly title: string };

// =============================================================================
// Η ΑΠΟΔΕΙΞΗ — ADR-798 §7, καμία τέταρτη κατάσταση (Δ6)
// =============================================================================

/**
 * `declared` = ό,τι γράφει το προφίλ, κανείς δεν το έλεγξε **ή** δεν ταίριαξε· `verified` = το ΓΕΜΗ
 * απάντησε για **αυτόν** τον αριθμό, ενεργή, **ίδια** επωνυμία — με **ημερομηνία** ελέγχου πάντα.
 */
export type LegalIdentityAttestation =
  | { readonly state: 'declared' }
  | { readonly state: 'verified'; readonly issuer: RegistryIssuer; readonly checkedAt: string };

/**
 * Η **καταστατική** έδρα όπως τη γράφει το προφίλ (ADR-439) — διεύθυνση, πόλη, Τ.Κ., τίποτα άλλο.
 * Ζει εδώ ώστε ο καθαρός κριτής **και** ο αναγνώστης του προφίλ να μιλούν για τον **ίδιο** τύπο.
 */
export interface CompanySeatDeclaration {
  readonly address: string | null;
  readonly city: string | null;
  readonly postalCode: string | null;
}

/** Οι νομικές μορφές που ξέρει το προφίλ — **παράγωγο** της ρίζας, ποτέ δεύτερη λίστα. */
export type ShowcaseLegalForm = NonNullable<CompanyRegistryDeclaration['entityType']>;

/** **Η νομική ταυτότητα της βιτρίνας** (ν. 4919/2022 άρθ. 22 §4 · Π.Δ. 131/2003 άρθ. 4). */
export interface ShowcaseLegalIdentity {
  /** Η **επιλογή** — ώστε η ανανέωση μετά από μετονομασία να ξέρει τι να ξαναλύσει. */
  readonly publicName: PublicNameKind;
  /** Η επωνυμία — του ΓΕΜΗ όταν `verified` (η ορθογραφία της αρχής), του προφίλ όταν `declared`. */
  readonly legalName: string;
  /** `null` = τιμή προφίλ που δεν αναγνωρίζεται — **ποτέ** μαντεψιά. */
  readonly legalForm: ShowcaseLegalForm | null;
  /** Κανονική μορφή · `null` = ο οργανισμός δεν έχει (ελεύθερος επαγγελματίας). */
  readonly gemiNumber: string | null;
  readonly seat: ShowcaseSeat;
  readonly attestation: LegalIdentityAttestation;
}

/** **Ό,τι στέλνει η οθόνη** για τη νομική ταυτότητα — επιλογές, ποτέ κείμενο. */
export interface ShowcaseLegalDeclaration {
  readonly publicName: PublicNameChoice;
  /** `null` = δεν επέλεξε — δεκτό **μόνο** όπου υπάρχει προεπιλογή (ΑΕ · ΕΠΕ). */
  readonly seatDisclosure: SeatDisclosure | null;
}
