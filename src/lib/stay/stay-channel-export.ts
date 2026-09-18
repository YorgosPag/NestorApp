/**
 * @fileoverview **ΤΙ ΔΗΜΟΣΙΕΥΟΥΜΕ ΣΤΑ ΚΑΝΑΛΙΑ** — οι καταλήψεις μας ως `.ics`, ανά
 *   προορισμό.
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · lib/stay/stay-rules.ts
 *   (`stayCalendarOccupancies`) · lib/ical/ical-write.ts · types/stay-calendar.ts
 * @module lib/stay/stay-channel-export
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΓΡΑΜΜΗ: **ΦΥΣΙΚΗ ΚΑΤΑΛΗΨΗ ΝΑΙ, ΠΟΛΙΤΙΚΗ ΚΡΑΤΗΣΗΣ ΟΧΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εξάγονται: κρατήσεις **που καταλαμβάνουν**, blocks του ιδιοκτήτη, blocks άλλων
 * καναλιών, και οι **νύχτες προετοιμασίας** (καθαρισμός). Η Airbnb κάνει το ίδιο:
 * το ημερολόγιό της κλείνει και δημοσιεύει τις νύχτες της προετοιμασίας.
 *
 * **ΔΕΝ** εξάγονται ειδοποίηση, παράθυρο διαθεσιμότητας, CTA/CTD, ελάχ./μέγ. νύχτες,
 * τιμές. Αυτά είναι **πολιτική του δικού μας καναλιού**: δημοσιευμένα, θα έκλειναν στην
 * Airbnb νύχτες που η Airbnb θα έδινε — δηλαδή θα επιβάλλαμε τους όρους μας στο ξένο
 * κανάλι (ακριβώς η γνωστή ενόχληση του «availability window» της Airbnb όταν εισάγεται
 * αλλού). Η προετοιμασία είναι **φυσικό γεγονός**: το σπίτι δεν είναι έτοιμο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΕΞΑΓΩΓΗ ΑΝΑ ΠΡΟΟΡΙΣΜΟ — Ο ΚΥΚΛΟΣ ΓΙΝΕΤΑΙ ΔΟΜΙΚΑ ΑΔΥΝΑΤΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αγορά δεν έχει **κανέναν** τεχνικό μηχανισμό κατά του echo loop — η οδηγία των PMS
 * είναι διαδικαστική («μη σταυρώνεις feeds»). Εδώ κάθε πηγή έχει **δικό της** σύνδεσμο
 * εξαγωγής που **αφαιρεί ό,τι ήρθε από εκείνη** (και την προετοιμασία της): το κανάλι
 * δεν μπορεί να εισαγάγει πίσω τα δικά του γεγονότα, όσο λάθος κι αν τα ρυθμίσει ο
 * άνθρωπος.
 *
 * ⚠️ **ΚΑΝΕΝΑ ΠΡΟΣΩΠΟ**: ο τύπος {@link IcalWriteEvent} δεν έχει καν πεδίο για όνομα,
 * σημείωση ή πλήθος ατόμων. Η διαρροή είναι **μη εκφράσιμη**, όχι «φυλαγμένη».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { PRODUCT_NAME } from '@/constants/product-identity';
import { writeIcalCalendar, type IcalWriteEvent } from '@/lib/ical/ical-write';
import type { StayCalendarEntry } from '@/types/stay-calendar';
import type { StayRules } from '@/types/stay-rules';
import { stayCalendarOccupancies, type StayOccupancySource } from './stay-rules';

/**
 * **Λεξιλόγιο πρωτοκόλλου, ΟΧΙ διεπαφής** (N.11): οι τίτλοι διαβάζονται από **μηχανές
 * ξένων καναλιών** (Airbnb/Booking/Vrbo/Google Calendar), που δεν έχουν γλώσσα χρήστη.
 * Γι' αυτό είναι αγγλικά και **σταθερά** — η αγορά στέλνει «Reserved» / «Not available».
 */
export const STAY_ICAL_SUMMARY = {
  booking: 'Reserved',
  blocked: 'Not available',
  preparation: 'Preparation',
} as const;

/**
 * Το `PRODID` μας — ταυτότητα παραγωγού, όχι κείμενο προς άνθρωπο (RFC 5545 §3.7.3).
 *
 * 🔑 Το όνομα έρχεται από τη **ρίζα** (ADR-857): το PRODID **δεν** είναι αναγνωριστικό
 * μηχανής με συμβόλαιο μορφής — κανένα κανάλι δεν ταυτοποιεί γεγονότα από αυτό (η
 * ταύτιση γίνεται στο `UID`), οπότε μια μετονομασία του προϊόντος **πρέπει** να φαίνεται
 * κι εδώ. Αυτό που **δεν** αλλάζει ποτέ είναι το {@link STAY_ICAL_UID_DOMAIN} από κάτω.
 */
export const STAY_ICAL_PRODID = `-//${PRODUCT_NAME}//Stay Calendar 1.0//EL`;
/** Η ρίζα των `UID` μας. Ασπίδα κατά του echo: γεγονός με αυτήν **αγνοείται** στην εισαγωγή. */
export const STAY_ICAL_UID_DOMAIN = 'stay.nestorconstruct.gr';
/** Υπόδειξη ανανέωσης (RFC 7986 §5.7). Υπόδειξη — Google/Outlook την αγνοούν. */
export const STAY_ICAL_REFRESH_INTERVAL = 'PT1H';

/** Ο προορισμός της εξαγωγής: όλα, ή «όλα εκτός από ό,τι ήρθε από αυτή την πηγή». */
export type StayExportScope = { readonly kind: 'all' } | { readonly kind: 'feed'; readonly feedId: string };

/** Η πηγή μιας εγγραφής: ποιο feed τη γέννησε (`null` = δική μας). */
function feedIdOfEntry(entry: StayCalendarEntry): string | null {
  return entry.kind === 'block' ? entry.block.channel?.feedId ?? null : null;
}

/** Μένει αυτή η εγγραφή στον σύνδεσμο του προορισμού; */
function visibleTo(entry: StayCalendarEntry, scope: StayExportScope): boolean {
  return scope.kind === 'all' || feedIdOfEntry(entry) !== scope.feedId;
}

function entryOf(source: StayOccupancySource): StayCalendarEntry {
  return source.kind === 'entry' ? source.entry : source.of;
}

function summaryOf(source: StayOccupancySource): string {
  if (source.kind === 'preparation') return STAY_ICAL_SUMMARY.preparation;
  return source.entry.kind === 'booking' ? STAY_ICAL_SUMMARY.booking : STAY_ICAL_SUMMARY.blocked;
}

/**
 * 🔑 **`TENTATIVE` για κράτηση που ΔΕΝ είναι ακόμη επιβεβαιωμένη** (τα holds του Σταδίου
 * Δ). Το πρωτόκολλο έχει τη λέξη· τα κανάλια συνήθως την αγνοούν και κλείνουν τη νύχτα
 * — που είναι **η σωστή** συμπεριφορά για κράτηση υπό προθεσμία.
 */
function statusOf(source: StayOccupancySource): IcalWriteEvent['status'] {
  const entry = entryOf(source);
  const tentative = entry.kind === 'booking' && entry.booking.lifecycle !== 'confirmed'
    && entry.booking.lifecycle !== 'completed';
  return tentative ? 'TENTATIVE' : 'CONFIRMED';
}

function updatedAtOf(entry: StayCalendarEntry): string {
  return entry.kind === 'booking' ? entry.booking.updatedAt : entry.block.updatedAt;
}

function uidOf(source: StayOccupancySource, from: string): string {
  const entry = entryOf(source);
  const id = entry.kind === 'booking' ? entry.booking.id : entry.block.id;
  // Η προετοιμασία είναι **δύο** γεγονότα γύρω από μία εγγραφή ⇒ η ημέρα μπαίνει στην ταυτότητα.
  const prefix = source.kind === 'preparation' ? `prep-${from}-` : '';
  return `${prefix}${id}@${STAY_ICAL_UID_DOMAIN}`;
}

/**
 * **Οι εγγραφές ως γεγονότα iCal** — μέσα από τη **ΜΙΑ** σύνθεση καταλήψεων
 * (`stayCalendarOccupancies`), ποτέ δεύτερη λίστα.
 *
 * 🔑 Ό,τι **καταλαμβάνει** εξάγεται, και η απάντηση στο «καταλαμβάνει;» δίνεται από το
 * `STAY_LIFECYCLE_OCCUPIES` — άρα όταν το Στάδιο Δ έκανε το `requested` να καταλαμβάνει
 * όσο ζει η προθεσμία, τα **holds εξάχθηκαν μόνα τους**.
 *
 * ⚠️ **Ο ισχυρισμός «χωρίς αλλαγή εδώ» ήταν ΜΙΣΟΣ — μετρημένα (Στάδιο Δ, §23.2)**: η λογική δεν
 * άλλαξε, αλλά η απάντηση «καταλαμβάνει;» έγινε συνάρτηση του **χρόνου**, οπότε ο εξαγωγέας
 * χρειάστηκε **τη στιγμή** (`instant`). Ληγμένο hold **δεν** εξάγεται — το κανάλι ανοίγει τη νύχτα
 * στην επόμενη δημοσκόπηση, χωρίς να περιμένει το cron.
 */
export function stayExportEvents(
  entries: readonly StayCalendarEntry[],
  rules: StayRules,
  scope: StayExportScope,
  instant: string,
): readonly IcalWriteEvent[] {
  const visible = entries.filter((entry) => visibleTo(entry, scope));
  const events: IcalWriteEvent[] = [];
  for (const occupancy of stayCalendarOccupancies(visible, rules.preparationNights, instant)) {
    const { source, startsAt, expiresAt } = occupancy;
    if (expiresAt === null) continue;
    events.push({
      uid: uidOf(source, startsAt),
      from: startsAt,
      to: expiresAt,
      summary: summaryOf(source),
      status: statusOf(source),
      updatedAt: updatedAtOf(entryOf(source)),
    });
  }
  return [...events].sort((a, b) => (a.from === b.from ? a.uid.localeCompare(b.uid) : a.from < b.from ? -1 : 1));
}

/** **Το ημερολόγιο ενός καταλύματος ως `.ics`.** Το `name` είναι ο τίτλος της αγγελίας. */
export function stayExportCalendar(
  entries: readonly StayCalendarEntry[],
  rules: StayRules,
  scope: StayExportScope,
  name: string,
  instant: string,
): string {
  return writeIcalCalendar({
    prodId: STAY_ICAL_PRODID,
    name,
    refreshInterval: STAY_ICAL_REFRESH_INTERVAL,
    events: stayExportEvents(entries, rules, scope, instant),
  });
}
