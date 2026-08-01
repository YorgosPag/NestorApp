/**
 * @fileoverview Πρόσωπα από το κελί μελετητών — η **σημασία διαβάζεται από το μέγεθος**.
 *
 * Το κελί `ΜΕΛΕΤΗΤΗΣ` είναι ένα MTEXT με επτά γραμμές μέσα: δύο ονόματα, δύο ειδικότητες
 * και τρεις γραμμές γραφείου. Τίποτα στο κείμενο δεν λέει ποιο είναι ποιο — **το λέει το
 * ύψος**, και το αρχείο το δηλώνει ρητά με τα σωρευτικά `\H` (ADR-745 §2.2β).
 *
 * ## Κατάταξη, όχι σταθερές
 *
 * Ο κανόνας δεν είναι «1,0 ⇒ πρόσωπο, 0,53 ⇒ ειδικότητα»: αυτοί είναι **οι αριθμοί αυτού
 * του γραφείου**. Ο κανόνας είναι **η σειρά κατάταξης** — το ψηλότερο επίπεδο του κελιού
 * είναι τα ονόματα, το αμέσως επόμενο οι ειδικότητες, τα υπόλοιπα το γραφείο. Έτσι το ίδιο
 * βήμα διαβάζει και μια πινακίδα που χρησιμοποιεί 1,0 / 0,7 / 0,4.
 *
 * ## Τι ΔΕΝ αναγνωρίζεται
 *
 * Το `ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ` είναι η επωνυμία δραστηριότητας του γραφείου. Δεν
 * υπάρχει πεδίο γι' αυτήν στο μοντέλο και **δεν εφευρίσκεται** εδώ: πάει στο `unparsed`.
 * Ένα πεδίο που δεν μπορεί να γεμίσει αξιόπιστα είναι χειρότερο από μια ορατή απώλεια.
 *
 * @see ADR-745 §6.1 (TitleBlockPerson) · §8 κανόνας 3 (τίποτα δεν πετιέται σιωπηλά)
 */

import { extractAllUrlsFromText } from '@/lib/validation/email-validation';
import {
  extractAllEmailsFromText,
  extractAllPhonesFromText,
} from '@/lib/validation/phone-validation';
import { isSameHeight, type MtextSegment } from './mtext-segments';
import type { TitleBlockPerson } from './title-block-reading.types';
import {
  normalizeForLabelMatch,
  splitIntoWords,
  type TitleBlockProfile,
} from './title-block-vocabulary';

/** Τα στοιχεία επικοινωνίας που φέρει το κελί — ένα γραφείο, κοινό για τα πρόσωπά του. */
interface OfficeContact {
  phones: string[];
  emails: string[];
  websites: string[];
  seat?: string;
  unparsed: string[];
}

/**
 * Τα διακριτά επίπεδα ύψους του κελιού, από το ψηλότερο προς το χαμηλότερο.
 *
 * Η συγχώνευση γίνεται με την ανοχή του `isSameHeight`: το `0,5334 × 1,875 = 1,000125`
 * είναι το **ίδιο** επίπεδο με το `1,0`, αλλιώς οι δύο μηχανικοί θα κατέληγαν σε δύο
 * διαφορετικές βαθμίδες και ο δεύτερος θα διαβαζόταν ως ειδικότητα του πρώτου.
 */
export function heightLevels(segments: readonly MtextSegment[]): number[] {
  const levels: number[] = [];
  for (const factor of segments.map((s) => s.heightFactor).sort((a, b) => b - a)) {
    if (!levels.some((known) => isSameHeight(known, factor))) levels.push(factor);
  }
  return levels;
}

/** Σε ποια βαθμίδα ανήκει μια γραμμή· `-1` όταν το κελί δεν έχει καμία. */
function levelOf(segment: MtextSegment, levels: readonly number[]): number {
  return levels.findIndex((level) => isSameHeight(level, segment.heightFactor));
}

/**
 * Λέξη-σημαδούρα (`κιν`, `site:`, `e-mail:`) — αναγνωρίζεται **χωρίς** τη στίξη που τη συνοδεύει.
 *
 * Το `normalizeForLabelMatch` από μόνο του δεν αρκεί: ρίχνει τελείες και παύλες αλλά **όχι
 * την άνω τελεία**, οπότε το `site:` δεν ισούται ποτέ με το `site`. Το κόψιμο σε λέξεις
 * είναι που βγάζει τη στίξη — και είναι το ίδιο κόψιμο που χρησιμοποιεί η αναγνώριση
 * ετικετών, άρα οι δύο συγκρίσεις δεν μπορούν να αποκλίνουν.
 */
function isMarker(token: string, markers: readonly string[]): boolean {
  const words = splitIntoWords(token);
  if (words.length !== 1) return false;
  return markers.some((m) => normalizeForLabelMatch(m) === words[0].normalized);
}

/**
 * Διαβάζει μία γραμμή γραφείου, ανά λέξη.
 *
 * Ο διαχωρισμός είναι στα **κενά** και όχι στα όρια λέξης της αναγνώρισης ετικετών: το
 * `info@nikolaou.com.gr` είναι μία οντότητα και κάθε λεπτότερο κόψιμο το διαλύει.
 */
function readOfficeLine(line: string, profile: TitleBlockProfile, into: OfficeContact): void {
  let afterSeatMarker = false;
  const seatWords: string[] = [];
  const residue: string[] = [];

  for (const token of line.split(/\s+/).filter((t) => t.length > 0)) {
    const emails = extractAllEmailsFromText(token);
    const urls = emails.length > 0 ? [] : extractAllUrlsFromText(token);
    const phones = emails.length + urls.length > 0 ? [] : extractAllPhonesFromText(token);
    if (emails.length > 0 || urls.length > 0 || phones.length > 0) {
      into.emails.push(...emails);
      into.websites.push(...urls);
      into.phones.push(...phones);
      continue;
    }
    if (isMarker(token, profile.contactMarkers)) continue;
    if (isMarker(token, profile.officeSeatMarkers)) {
      afterSeatMarker = true;
      continue;
    }
    if (normalizeForLabelMatch(token).length === 0) continue;
    if (afterSeatMarker) seatWords.push(token);
    else residue.push(token);
  }

  if (seatWords.length > 0 && into.seat === undefined) into.seat = seatWords.join(' ');
  if (residue.length > 0) into.unparsed.push(line);
}

/** Το αποτέλεσμα της ανάγνωσης του κελιού μελετητών. */
export interface PeopleReading {
  readonly people: readonly TitleBlockPerson[];
  readonly unparsed: readonly string[];
}

interface PersonDraft {
  displayName: string;
  professionText: string;
}

/**
 * Πρόσωπα + στοιχεία γραφείου από τις γραμμές του κελιού μελετητών.
 *
 * Τα στοιχεία επικοινωνίας ανήκουν στο **γραφείο**, όχι σε έναν από τους μηχανικούς: το
 * αρχείο τα γράφει μία φορά για όλους. Αποδίδονται λοιπόν σε κάθε πρόσωπο του κελιού — ο
 * Λ2 θα αποφασίσει, με άνθρωπο, ποιος τα κρατά στην καρτέλα του.
 */
export function extractPeople(
  segments: readonly MtextSegment[],
  profile: TitleBlockProfile,
): PeopleReading {
  // Ίδια κανονικοποίηση κενών με το `mtextToPlainText`: το αρχείο σπάει το «ΝΙΚΟΛΑΟΥ ΕΥ.
  // ΙΩΑΝΝΗΣ» σε κομμάτια και αφήνει διπλό κενό. Είναι απόσταση, όχι περιεχόμενο.
  const lines = segments
    .map((s) => ({ ...s, text: s.text.replace(/\s+/g, ' ').trim() }))
    .filter((s) => s.text.length > 0);
  const levels = heightLevels(lines);
  const office: OfficeContact = { phones: [], emails: [], websites: [], unparsed: [] };
  const drafts: PersonDraft[] = [];

  for (const line of lines) {
    const level = levelOf(line, levels);
    if (level === 0) drafts.push({ displayName: line.text, professionText: '' });
    else if (level === 1 && drafts.length > 0 && drafts[drafts.length - 1].professionText === '') {
      drafts[drafts.length - 1].professionText = line.text;
    } else if (level === 1) office.unparsed.push(line.text);
    else readOfficeLine(line.text, profile, office);
  }

  const people = drafts.map((draft) => ({
    ...draft,
    phones: office.phones,
    emails: office.emails,
    websites: office.websites,
    ...(office.seat === undefined ? {} : { officeSeat: office.seat }),
  }));
  return { people, unparsed: office.unparsed };
}
