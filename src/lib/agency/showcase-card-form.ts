/**
 * @fileoverview **Ο ΚΡΙΤΗΣ ΤΗΣ ΚΑΡΤΑΣ** — δήλωση → δημόσιο μισό + ιδιωτικό μισό, ή ονομασμένη άρνηση
 *   (ADR-841 §7 Α21.16).
 * @related services/mandate/showcase-card-custody.ts (ο γραφέας) · types/showcase-card.ts
 * @module lib/agency/showcase-card-form
 *
 * 🔑 **ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ, ΜΗΔΕΝ I/O** — ο τόπος έχει ήδη επαληθευτεί από την πόρτα, και η
 * ταυτότητα νέου καταστήματος **εγχέεται** (`newId`). Έτσι κάθε κανόνας εκτελείται σε άγκυρα
 * χωρίς Firestore, και ο γραφέας μένει *«διάβασε · κρίνε · γράψε»*.
 *
 * 🔴 **ΤΑ ΔΥΟ ΜΙΣΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟ ΙΔΙΟ ΠΕΡΑΣΜΑ** — γι' αυτό το `channelKinds` (δημόσιο) δεν
 * μπορεί να διαφωνήσει με τα κανάλια (ιδιωτικό): παράγεται από **την ίδια** λίστα, μία φορά.
 */

import { isValidEmail, normalisePublicWebsite } from '@/lib/validation/email-validation';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { normalisePhone } from '@/lib/contact/channel-phone';
import { normalizeSpecialDays, specialDaysDefect, type SpecialDay } from '@/lib/calendar/special-hours';
import { normalizeWeeklyHours, weeklyHoursDefect, type WeeklyHours } from '@/lib/calendar/weekly-hours';
import { carryConfirmations, latestConfirmedAt } from '@/lib/agency/showcase-email-confirmation-rules';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlaceRef } from '@/types/geo/public-place';
import {
  MAX_EMAILS_PER_LOCATION,
  MAX_PHONES_PER_LOCATION,
  MAX_SHOWCASE_LOCATIONS,
  type ShowcaseCardChannels,
  type ShowcaseCardPremises,
  type ShowcaseEmailConfirmation,
  type ShowcaseLocationArea,
  type ShowcaseLocation,
  type ShowcaseLocationChannels,
  type ShowcaseLocationWire,
  type ShowcasePhone,
  type ShowcaseStreetLine,
} from '@/types/showcase-card';

/**
 * Ένα κατάστημα **με τόπο ήδη επαληθευμένο** από την πόρτα — και, για «μόνο περιοχή», με τον **δήμο** του
 * ήδη αποδοσμένο (ADR-896 §6). Η πόρτα διαλέγει σκέλος με τον **ίδιο** κανόνα ({@link declaresAreaOnly}).
 */
export type VerifiedLocationDeclaration =
  | { readonly wire: ShowcaseLocationWire; readonly position: GeoPoint | null }
  | { readonly wire: ShowcaseLocationWire; readonly area: ShowcaseLocationArea | null };

export interface FormedCard {
  readonly locations: readonly ShowcaseLocation[];
  readonly channels: ShowcaseCardChannels;
  /** Ο ιδιωτικός τόπος **μόνο** των καταστημάτων «μόνο περιοχή» — από το **ίδιο** πέρασμα με το δημόσιο. */
  readonly premises: ShowcaseCardPremises;
}

/** Ονομασμένη άρνηση του κριτή — ό,τι μαθαίνει ο άνθρωπος αντί για «κάτι πήγε στραβά». */
export type CardRejection = { readonly reason: AgencyProfileRejection };

type Rejected = CardRejection;

/** Τηλέφωνα: κενές γραμμές αγνοούνται, άκυρα **ονομάζονται**, διπλότυπα (ίδιο E.164) ενώνονται. */
function formPhones(wire: ShowcaseLocationWire): readonly ShowcasePhone[] | Rejected {
  const phones: ShowcasePhone[] = [];
  for (const { number, extension } of wire.phones) {
    if (number.trim() === '') continue;
    const normalised = normalisePhone(number);
    if (!normalised.ok) return { reason: 'agency-profile-card-phone-invalid' };
    if (phones.some((phone) => phone.e164 === normalised.e164)) continue;
    phones.push({ e164: normalised.e164, extension: extension?.trim() || null });
  }
  return phones;
}

/** Email: ο **ένας** επικυρωτής και ο **ένας** κανονικοποιητής του έργου. */
function formEmails(wire: ShowcaseLocationWire): readonly string[] | Rejected {
  const emails: string[] = [];
  for (const raw of wire.emails) {
    if (raw.trim() === '') continue;
    if (!isValidEmail(raw)) return { reason: 'agency-profile-card-email-invalid' };
    const email = normaliseChannelEmail(raw);
    if (!emails.includes(email)) emails.push(email);
  }
  return emails;
}

/**
 * 🔑 **«ΜΟΝΟ ΠΕΡΙΟΧΗ;» — ΕΝΑΣ ΚΑΝΟΝΑΣ, ΔΥΟ ΚΑΛΟΥΝΤΕΣ** (ADR-896 §6): η **πόρτα** τον ρωτά για να αποφασίσει αν
 * θα αποδώσει δήμο, ο **κριτής** (`formStreet`) για να μη δημοσιεύσει οδό. Αν διαφωνούσαν, ένα κατάστημα με κενά
 * πεδία οδού θα έφτανε στον κριτή χωρίς περιοχή — ή, χειρότερα, με ακριβή τόπο.
 */
export function declaresAreaOnly(wire: Pick<ShowcaseLocationWire, 'street'>): boolean {
  if (wire.street === null) return true;
  return wire.street.street.trim() === '' && wire.street.number.trim() === '' && wire.street.postalCode.trim() === '';
}

/** Η οδός: **ή ολόκληρη, ή καθόλου** — μισή διεύθυνση δεν μαντεύεται. */
function formStreet(wire: ShowcaseLocationWire): ShowcaseStreetLine | null | Rejected {
  if (wire.street === null || declaresAreaOnly(wire)) return null;
  const street = wire.street.street.trim();
  const number = wire.street.number.trim();
  const postalCode = wire.street.postalCode.trim();
  if (street === '' || postalCode === '') return { reason: 'agency-profile-card-street-incomplete' };
  return { street, number, postalCode };
}

function isRejected(value: unknown): value is Rejected {
  return typeof value === 'object' && value !== null && 'reason' in value;
}

/**
 * **Εβδομάδα + ειδικές μέρες** (Α21.21) — ο **ίδιος** κριτής με τη φόρμα. Ειδικές μέρες **χωρίς** εβδομαδιαίο ωράριο
 * πέφτουν: το «Κανονικά» δεν σημαίνει τίποτα χωρίς εβδομάδα, και ο διακόπτης «Δήλωση ωραρίου» τις κρύβει μαζί της.
 * Οι περασμένες κλαδεύονται — ο χρόνος πέρασε, δεν είναι λάθος του ανθρώπου.
 *
 * 🔑 **Εξάγεται** (Α21.21 Φάση Β): η απάντηση του email «θα είστε ανοιχτά;» γράφει ειδική μέρα **χωρίς** τη φόρμα —
 * και κρίνεται από **αυτή** τη συνάρτηση, όχι από δίδυμο που θα μπορούσε να ξεχάσει ταβάνι ή ορίζοντα.
 */
export function formLocationHours(
  hours: WeeklyHours | null,
  specialHours: readonly SpecialDay[],
  todayKey: string,
): Pick<ShowcaseLocation, 'hours' | 'specialHours'> | CardRejection {
  if (hours === null) return { hours: null, specialHours: [] };
  if (weeklyHoursDefect(hours) !== null) return { reason: 'agency-profile-card-hours-invalid' };
  if (specialDaysDefect(specialHours, todayKey) !== null) return { reason: 'agency-profile-card-special-hours-invalid' };
  return { hours: normalizeWeeklyHours(hours), specialHours: normalizeSpecialDays(specialHours, todayKey) };
}

function formLocation(
  declared: VerifiedLocationDeclaration,
  id: string,
  previousConfirmations: readonly ShowcaseEmailConfirmation[],
  todayKey: string,
):
  | { readonly location: ShowcaseLocation; readonly channels: ShowcaseLocationChannels; readonly premises: PlaceRef | null }
  | Rejected {
  const { wire } = declared;
  if (wire.phones.length > MAX_PHONES_PER_LOCATION || wire.emails.length > MAX_EMAILS_PER_LOCATION) {
    return { reason: 'agency-profile-card-too-many-channels' };
  }
  const hours = formLocationHours(wire.hours, wire.specialHours, todayKey);
  const phones = formPhones(wire);
  const emails = formEmails(wire);
  const street = formStreet(wire);
  if (isRejected(hours)) return hours;
  if (isRejected(phones)) return phones;
  if (isRejected(emails)) return emails;
  if (isRejected(street)) return street;

  // 🔴 Α21.18 — αλλαγμένο ή αφαιρεμένο email χάνει την επιβεβαίωσή του **σε αυτό το πέρασμα**, άρα
  //    στην ίδια συναλλαγή με τη νέα κάρτα· δημόσιο και ιδιωτικό μισό από την **ίδια** λίστα.
  const emailConfirmations = carryConfirmations(previousConfirmations, emails);
  const sited = siteLocation(declared, street);
  if (isRejected(sited)) return sited;
  const common = {
    id,
    role: wire.role,
    label: wire.label?.trim() || null,
    hours: hours.hours,
    specialHours: hours.specialHours,
    channelKinds: channelKindsOf(phones, emails),
    emailConfirmedAt: latestConfirmedAt(emailConfirmations),
  };
  const channels = { phones, emails, emailConfirmations };
  const place: PlaceRef = { landId: wire.place.landId, buildingId: wire.place.buildingId };
  // 🔴 ADR-896 §6 — «μόνο περιοχή» ⇒ ο τόπος πηγαίνει **μόνο** στο ιδιωτικό μισό· το δημόσιο δεν έχει καν πεδίο.
  return sited.kind === 'area'
    ? { location: { ...common, street: null, area: sited.area }, channels, premises: place }
    : { location: { ...common, street: sited.street, place, position: sited.position }, channels, premises: null };
}

/** Ποια κανάλια **υπάρχουν** — από την ίδια λίστα με το ιδιωτικό μισό, σε σταθερή σειρά. */
function channelKindsOf(phones: readonly ShowcasePhone[], emails: readonly string[]): ShowcaseLocation['channelKinds'] {
  return [...(phones.length > 0 ? ['phone' as const] : []), ...(emails.length > 0 ? ['email' as const] : [])];
}

/**
 * **Πού στέκεται το κατάστημα** — η δήλωση οδού απέναντι στο σκέλος που διάλεξε η πόρτα.
 *
 * ⚠️ Διαφωνία (οδός με αποδοσμένο δήμο, ή «μόνο περιοχή» με σημείο) σημαίνει ότι πόρτα και κριτής **δεν ρώτησαν
 * τον ίδιο κανόνα** — σφάλμα προγραμματισμού, που **αρνείται** αντί να δημοσιεύσει τόπο κατά λάθος.
 */
function siteLocation(
  declared: VerifiedLocationDeclaration,
  street: ShowcaseStreetLine | null,
):
  | { readonly kind: 'area'; readonly area: ShowcaseLocationArea | null }
  | { readonly kind: 'street'; readonly street: ShowcaseStreetLine; readonly position: GeoPoint | null }
  | Rejected {
  if (street === null) {
    return 'area' in declared ? { kind: 'area', area: declared.area } : { reason: 'agency-profile-card-street-incomplete' };
  }
  return 'position' in declared
    ? { kind: 'street', street, position: declared.position }
    : { reason: 'agency-profile-card-street-incomplete' };
}

/**
 * **Η κάρτα κρίνεται ολόκληρη** — η πρώτη άρνηση σταματά, και **τίποτα** δεν γράφεται.
 *
 * ⚠️ **Ταυτότητα από τον πελάτη γίνεται δεκτή ΜΟΝΟ αν υπάρχει ήδη στη βιτρίνα**: αλλιώς ένα
 * χειρόγραφο `id` θα μπορούσε να «κληρονομήσει» κανάλια άλλου καταστήματος.
 *
 * @param previousConfirmations Οι **αποθηκευμένες** επιβεβαιώσεις ενός καταστήματος (Α21.18) — εγχέεται
 *   όπως το `newId`, ώστε ο κριτής να μένει χωρίς I/O. Νέο κατάστημα δεν ρωτιέται ποτέ: δεν κληρονομεί σήμα.
 * @param todayKey Η σημερινή ημέρα **στην Ελλάδα** (Α21.21) — εγχέεται, ώστε ορίζοντας και κλάδεμα των ειδικών ωρών
 *   να κρίνονται χωρίς ρολόι μέσα στον κριτή.
 */
export function formCard(
  declared: readonly VerifiedLocationDeclaration[],
  existingIds: ReadonlySet<string>,
  newId: () => string,
  previousConfirmations: (locationId: string) => readonly ShowcaseEmailConfirmation[],
  todayKey: string,
): FormedCard | Rejected {
  if (declared.length > MAX_SHOWCASE_LOCATIONS) return { reason: 'agency-profile-card-too-many-locations' };
  if (declared.filter(({ wire }) => wire.role === 'headquarters').length > 1) {
    return { reason: 'agency-profile-card-two-headquarters' };
  }

  const locations: ShowcaseLocation[] = [];
  const channels: Record<string, ShowcaseLocationChannels> = {};
  const premises: Record<string, PlaceRef> = {};
  for (const entry of declared) {
    const reused = entry.wire.id !== null && existingIds.has(entry.wire.id) && !(entry.wire.id in channels);
    const id = reused && entry.wire.id !== null ? entry.wire.id : newId();
    const formed = formLocation(entry, id, reused ? previousConfirmations(id) : [], todayKey);
    if (isRejected(formed)) return formed;
    locations.push(formed.location);
    channels[id] = formed.channels;
    if (formed.premises !== null) premises[id] = formed.premises;
  }
  return { locations, channels: { locations: channels }, premises };
}

/**
 * **Η ιστοσελίδα του οργανισμού** (Α21.17): κενή ⇒ `null`· άκυρη ⇒ **ονομασμένη** άρνηση — ποτέ σιωπηλή
 * απόρριψη, αλλιώς ο άνθρωπος θα έβλεπε τη διεύθυνσή του να εξαφανίζεται μετά το «Αποθήκευση».
 * Ο **ίδιος** κριτής (`normalisePublicWebsite`) φυλά και τον αναγνώστη.
 */
export function formWebsite(raw: string | null): string | null | Rejected {
  if (raw === null || raw.trim() === '') return null;
  return normalisePublicWebsite(raw) ?? { reason: 'agency-profile-card-website-invalid' };
}

export { isRejected as isCardRejection };
