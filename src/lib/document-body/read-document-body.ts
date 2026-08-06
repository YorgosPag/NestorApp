/**
 * @fileoverview Λ1β — κείμενα σχεδίου ⇒ `DocumentBodyReading[]`. Καθαρή συνάρτηση, **μηδέν I/O**.
 *
 * ```
 *   κείμενα ─▶ ποια είναι έγγραφα ─▶ ενότητες ─▶ κανόνες ανά ενότητα ─▶ Reading
 * ```
 *
 * 🔴 **Η επιλογή γίνεται από τον ΤΙΤΛΟ, όχι από το layer** — και είναι μετρημένη απόφαση. Στο
 * `G753_ergasia F.dxf` το layer `ΠΕΡΙΓΡΑΦΗ` έχει **79** κείμενα από τα οποία **2** είναι
 * έγγραφα· τα υπόλοιπα είναι διαστάσεις («5.00»), λεζάντες («κράσπεδο») και ονόματα οδών. Μια
 * λίστα layers — που ήταν το αρχικό σχέδιο — θα παρήγαγε **77 γραμμές θορύβου**, και ο θόρυβος
 * εκπαιδεύει τον μηχανικό να πατά «Έγκριση» χωρίς να διαβάζει (ADR-759 §5 κανόνας 8).
 *
 * Ίδιο δόγμα με το `scanTitleBlockLayers`: *«δεν μαντεύουμε από το όνομα — ρωτάμε ποιο κείμενο
 * παράγει έγγραφο όταν το διαβάσεις»*. Και ταξιδεύει: άλλο γραφείο βάζει τα ίδια έγγραφα σε
 * layer με άλλο όνομα, και διαβάζονται **χωρίς αλλαγή κώδικα**.
 *
 * @see ADR-759 §4.6 — Άξονας Α
 * @module lib/document-body/read-document-body
 */

import {
  GREEK_SURVEYOR_BODY_PROFILES,
  type DocumentBodyProfile,
} from '@/config/document-body-vocabulary';
import type {
  DocumentBodyField,
  DocumentBodyReading,
  DocumentTextSource,
} from '@/types/document-body-reading';
import { matchesWordSequenceAt, splitIntoWords } from '@/utils/greek-text';
import { cutOne, findAtSegmentStart, findSites, phraseOf } from './document-body-sites';
import { takeRest } from './document-body-values';
import { readListRows } from './read-document-body-lists';

/**
 * Πόσες γραμμές από την αρχή ψάχνουμε για τίτλο.
 *
 * Τρεις, όχι όλες: τίτλος που δεν είναι στην αρχή **δεν είναι τίτλος**. Χωρίς το όριο, η φράση
 * «ΔΗΛΩΣΗ ΙΔΙΟΚΤΗΤΗ» μέσα σε μια παράγραφο θα βάφτιζε ολόκληρο άλλο έγγραφο. Οι δηλώσεις του
 * δείγματος έχουν κενή πρώτη γραμμή, οπότε το 1 δεν φτάνει.
 */
const HEADING_SEARCH_LINES = 3;

/** Η ενότητα στην οποία ανήκουν οι κανόνες εγγράφων **χωρίς** ενότητες. */
const WHOLE_DOCUMENT = '';

// ── Ενότητες ──────────────────────────────────────────────────────────────────

interface DocumentSectionContent {
  readonly id: string;
  /** Οι γραμμές της ενότητας· η πρώτη είναι το **υπόλοιπο της γραμμής επικεφαλίδας**. */
  readonly lines: readonly string[];
}

/**
 * Ταιριάζει η φράση στην **αρχή** της γραμμής; Επιστρέφει πού τελειώνει, ή `null`.
 *
 * Στην αρχή και όχι οπουδήποτε: η επικεφαλίδα «Ζ. ΠΡΟΣΔΙΟΡΙΣΜΟΣ ΑΦΕΤΕΡΙΑΣ ΥΨΟΥΣ» ανοίγει
 * ενότητα· η ίδια φράση μέσα σε πρόταση δεν ανοίγει τίποτα.
 */
function headingEndsAt(line: string, headings: readonly string[]): number | null {
  const words = splitIntoWords(line);
  if (words.length === 0) return null;

  for (const heading of headings) {
    const phrase = phraseOf(heading);
    if (phrase.length > 0 && matchesWordSequenceAt(words, 0, phrase)) {
      return words[phrase.length - 1].end;
    }
  }
  return null;
}

/**
 * Σπάει το έγγραφο σε ενότητες.
 *
 * 🔑 **Το υπόλοιπο της γραμμής επικεφαλίδας ΕΙΝΑΙ περιεχόμενο** — δεν είναι λεπτομέρεια: το
 * εμβαδόν του οικοπέδου γράφεται *πάνω στην ίδια γραμμή* με την επικεφαλίδα της («ΣΤ. ΕΜΒΑΔΟΝ
 * ΟΙΚΟΠΕΔΟΥ Ε = 1.364,05 τ.μ.»). Αγνοώντας το, η ενότητα ΣΤ φαίνεται **κενή** ενώ φέρει τη
 * σημαντικότερη τιμή του σχεδίου.
 */
function splitIntoSections(
  lines: readonly string[],
  profile: DocumentBodyProfile,
): DocumentSectionContent[] {
  if (profile.sections.length === 0) {
    return [{ id: WHOLE_DOCUMENT, lines }];
  }

  const sections: { id: string; lines: string[] }[] = [];
  let current: { id: string; lines: string[] } | null = null;

  for (const line of lines) {
    const opened = profile.sections.find((s) => headingEndsAt(line, s.headings) !== null);
    if (opened) {
      const end = headingEndsAt(line, opened.headings) ?? 0;
      current = { id: opened.id, lines: [line.slice(end)] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  return sections;
}

// ── Ανάγνωση ενός εγγράφου ────────────────────────────────────────────────────

/** Ενότητες που η φόρμα **τυπώνει** και που το σχέδιο άφησε κενές — ορατή απουσία, όχι σιωπή. */
function collectEmpty(
  sections: readonly DocumentSectionContent[],
  profile: DocumentBodyProfile,
): string[] {
  const empty: string[] = [];

  for (const section of sections) {
    if (section.lines.every((line) => splitIntoWords(line).length === 0)) empty.push(section.id);
  }

  const allLines = sections.flatMap((s) => s.lines);
  for (const label of profile.emptyLabels) {
    const sites = findAtSegmentStart(allLines, [label]);
    // Τυπωμένη **και** αναπάντητη: αν έστω μία εμφάνιση έχει τιμή, δεν είναι κενή.
    if (sites.length > 0 && sites.every((site) => takeRest(site.text, site.labelEnd) === null)) {
      empty.push(label);
    }
  }

  return empty;
}

function readOneDocument(
  source: DocumentTextSource,
  profile: DocumentBodyProfile,
): DocumentBodyReading {
  const sections = splitIntoSections(source.lines, profile);
  const linesOf = (id: string): readonly string[] =>
    sections.filter((s) => s.id === id).flatMap((s) => s.lines);

  const fields: DocumentBodyField[] = [];
  for (const rule of profile.rules) {
    for (const site of findSites(rule.match, linesOf(rule.section ?? WHOLE_DOCUMENT))) {
      const rawValue = cutOne(site, rule.take);
      // Ετικέτα που βρέθηκε χωρίς τιμή **δεν** είναι πεδίο: θα ενθάρρυνε τον Λ2 να γράψει κενό.
      // Το ότι ρωτήθηκε και έμεινε κενό το λέει το `emptySections` (ADR-762 §5).
      if (rawValue === null) continue;
      fields.push({ key: rule.key, rawValue, line: site.line });
      break;
    }
  }

  return {
    kind: profile.kind,
    handle: source.handle,
    at: source.at,
    layerName: source.layerName,
    fields,
    rows: readListRows(linesOf, profile),
    emptySections: collectEmpty(sections, profile),
  };
}

// ── Ανάγνωση όλου του σχεδίου ─────────────────────────────────────────────────

/** Ποιο προφίλ **δηλώνει** αυτό το κείμενο, από τις πρώτες του γραμμές. */
function profileFor(
  source: DocumentTextSource,
  profiles: readonly DocumentBodyProfile[],
): DocumentBodyProfile | null {
  const opening = source.lines.slice(0, HEADING_SEARCH_LINES);
  return profiles.find((p) => opening.some((line) => headingEndsAt(line, p.headings) !== null)) ?? null;
}

/**
 * Όλα τα έγγραφα που φέρει ένα σχέδιο.
 *
 * Ταξινομημένα **ντετερμινιστικά** (σειρά προφίλ, μετά θέση): δύο ανοίγματα του ίδιου σχεδίου
 * πρέπει να δίνουν την ίδια σειρά προτάσεων, αλλιώς ο άνθρωπος βλέπει άλλη οθόνη κάθε φορά —
 * ίδιος κανόνας με το `scanTitleBlockLayers`.
 */
export function readDocumentBodies(
  sources: readonly DocumentTextSource[],
  profiles: readonly DocumentBodyProfile[] = GREEK_SURVEYOR_BODY_PROFILES,
): DocumentBodyReading[] {
  const readings: { readonly order: number; readonly reading: DocumentBodyReading }[] = [];

  for (const source of sources) {
    const profile = profileFor(source, profiles);
    if (!profile) continue;
    readings.push({ order: profiles.indexOf(profile), reading: readOneDocument(source, profile) });
  }

  return readings
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      if (a.reading.at.y !== b.reading.at.y) return b.reading.at.y - a.reading.at.y;
      if (a.reading.at.x !== b.reading.at.x) return a.reading.at.x - b.reading.at.x;
      return a.reading.handle.localeCompare(b.reading.handle);
    })
    .map((entry) => entry.reading);
}
