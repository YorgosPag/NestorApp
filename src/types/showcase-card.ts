/**
 * @fileoverview **Η ΨΗΦΙΑΚΗ ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΚΑΡΤΑ** — έδρα, υποκαταστήματα, ωράριο, κανάλια (ADR-841 §7 Α21.16).
 * @related types/agency-profile.ts (`PublicShowcase.locations`) · services/mandate/showcase-card-custody.ts
 * @module types/showcase-card
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΜΙΣΑ, ΔΥΟ ΣΥΛΛΟΓΕΣ — ΚΑΙ Η ΤΟΜΗ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ, ΟΧΙ ΑΙΣΘΗΤΙΚΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `agency_profiles` είναι `read: if true` **και** ο κατάλογος κατεβάζει **ολόκληρη**
 * τη συλλογή σε κάθε ανώνυμο επισκέπτη (`usePublicAgencies`). Ένα τηλέφωνο εκεί θα ήταν
 * **μαζική συγκομιδή με μία κλήση του SDK** — καμία απόκρυψη στο HTML δεν θα το έσωζε,
 * γιατί η διαρροή θα ήταν **η βάση**, όχι η σελίδα.
 *
 * | Μισό | Πού ζει | Ποιος το διαβάζει |
 * |---|---|---|
 * | {@link ShowcaseLocation} — πού, πότε, **ποια** κανάλια υπάρχουν | `agency_profiles.locations` | όλοι |
 * | {@link ShowcaseLocationChannels} — **οι ίδιοι** οι αριθμοί/διευθύνσεις | `showcase_card_channels` (`deny_all`) | μόνο ο διακομιστής, ένα κατάστημα τη φορά, με όριο ρυθμού |
 *
 * ⚠️ Το ίδιο πρότυπο με το `showcase_mark_sources` (Α21.12): **ξεχωριστή ρίζα**, όχι
 * υποσυλλογή — η ασφάλεια δεν στηρίζεται στην **απουσία** ενός wildcard.
 */

import type { WeeklyHours } from '@/lib/calendar/weekly-hours';
import type { ContactAddressType } from '@/types/contacts/address-types';
import type { PostalAddressFields } from '@/types/ContactFormTypes';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlaceRef } from '@/types/geo/public-place';

/**
 * **Ο ρόλος του καταστήματος** — το **υπάρχον** λεξιλόγιο διευθύνσεων εταιρείας
 * (ADR-319 `ContactAddressType`), στενεμένο σε ό,τι έχει νόημα σε δημόσια κάρτα.
 */
export type ShowcaseLocationRole = Extract<ContactAddressType, 'headquarters' | 'branch'>;

export const SHOWCASE_LOCATION_ROLES: readonly ShowcaseLocationRole[] = ['headquarters', 'branch'];

/** Κανάλι του οποίου η **ύπαρξη** δημοσιεύεται — ποτέ η τιμή. */
export type ShowcaseChannelKind = 'phone' | 'email';

/**
 * 🔴 **ΤΟ ΤΑΒΑΝΙ ΤΩΝ ΚΑΤΑΣΤΗΜΑΤΩΝ** — ίδιο δόγμα με το `MAX_PRESENCE_AREAS`: ο κατάλογος
 * κατεβάζει κάθε βιτρίνα σε **κάθε** ανώνυμο επισκέπτη, οπότε κάθε byte πολλαπλασιάζεται.
 */
export const MAX_SHOWCASE_LOCATIONS = 10;
export const MAX_PHONES_PER_LOCATION = 3;
export const MAX_EMAILS_PER_LOCATION = 3;

/**
 * **Η οδός, ΜΟΝΟ αν τη δημοσίευσε ρητά.**
 *
 * 🏆 `null` = **λειτουργία «μόνο περιοχή»** — η πρακτική *service-area business* της
 * Google, που **υποχρεώνει** να κρυφτεί η διεύθυνση όποιου δεν δέχεται πελάτες εκεί. Ο
 * υδραυλικός που δουλεύει από το σπίτι του δεν δημοσιεύει την **κατοικία** του (§9.9 β).
 */
export type ShowcaseStreetLine = Pick<PostalAddressFields, 'street' | 'number' | 'postalCode'>;

/** **Ένα κατάστημα, όπως το βλέπει ο κόσμος.** */
export interface ShowcaseLocation {
  /** Enterprise ID `sloc_*` — σταθερό στις επεξεργασίες, ώστε το reveal να δείχνει στο σωστό. */
  readonly id: string;
  readonly role: ShowcaseLocationRole;
  /** Προαιρετική ονομασία («Υποκατάστημα Καλαμαριάς»). */
  readonly label: string | null;
  /** 🔑 **Επαληθευμένος** δεσμός με τη γη — ίδιο δόγμα με το `PublicShowcase.place`. */
  readonly place: PlaceRef;
  /** Παράγεται **από τον διακομιστή** από τη γη· ποτέ από το σύρμα. */
  readonly position: GeoPoint | null;
  readonly street: ShowcaseStreetLine | null;
  /** `null` = δεν δήλωσε ωράριο — **ποτέ** «κλειστά». */
  readonly hours: WeeklyHours | null;
  /**
   * **Ποια κανάλια υπάρχουν** — ώστε η σελίδα να ξέρει ποιο κουμπί «Εμφάνιση» να δείξει.
   *
   * ⚠️ Γράφεται στην **ίδια** συναλλαγή με το {@link ShowcaseCardChannels}, από τον **έναν**
   * γραφέα — άρα δεν μπορεί να διαφωνήσει με το περιεχόμενο (ADR-749).
   */
  readonly channelKinds: readonly ShowcaseChannelKind[];
}

/** Ένα τηλέφωνο, **κανονικοποιημένο σε E.164** από τον διακομιστή. */
export interface ShowcasePhone {
  readonly e164: string;
  readonly extension: string | null;
}

/** **Τα κανάλια ενός καταστήματος** — ιδιωτικά. */
export interface ShowcaseLocationChannels {
  readonly phones: readonly ShowcasePhone[];
  /** Κανονικοποιημένα με το `normaliseChannelEmail`. */
  readonly emails: readonly string[];
}

/** Το έγγραφο `showcase_card_channels/{companyId}`. */
export interface ShowcaseCardChannels {
  readonly locations: Readonly<Record<string, ShowcaseLocationChannels>>;
}

/** **Ένα τηλέφωνο όπως το βλέπει ο επισκέπτης ΜΕΤΑ το κλικ** — έτοιμο, χωρίς βιβλιοθήκη στη σελίδα. */
export interface RevealedPhone {
  readonly href: string;
  readonly display: string;
}

/** Η απάντηση του reveal — **μόνο** για ένα κατάστημα. */
export interface RevealedChannels {
  readonly phones: readonly RevealedPhone[];
  readonly emails: readonly string[];
}

// =============================================================================
// ΤΟ ΣΥΡΜΑ — ό,τι στέλνει η οθόνη ρυθμίσεων, και ό,τι της επιστρέφεται
// =============================================================================

/** **Ένα κατάστημα, όπως το δηλώνει ο επαγγελματίας.** Κανένα `position`, κανένα `channelKinds`. */
export interface ShowcaseLocationWire {
  /** `null` = νέο κατάστημα· ο διακομιστής γεννά ταυτότητα. */
  readonly id: string | null;
  readonly role: ShowcaseLocationRole;
  readonly label: string | null;
  readonly place: PlaceRef;
  readonly street: ShowcaseStreetLine | null;
  readonly hours: WeeklyHours | null;
  /** Όπως πληκτρολογήθηκαν — ο διακομιστής κανονικοποιεί και **ονομάζει** ό,τι δεν περνά. */
  readonly phones: readonly { readonly number: string; readonly extension: string | null }[];
  readonly emails: readonly string[];
}

/** **Ολόκληρη η κάρτα** — `PUT` αντικαθιστά, όπως η δήλωση της βιτρίνας. */
export interface ShowcaseCardWire {
  readonly locations: readonly ShowcaseLocationWire[];
}

/** Ό,τι διαβάζει πίσω **ο ιδιοκτήτης** — δημόσιο + ιδιωτικό, για να επεξεργαστεί. */
export interface OwnedShowcaseLocation extends ShowcaseLocation {
  readonly channels: ShowcaseLocationChannels;
}
