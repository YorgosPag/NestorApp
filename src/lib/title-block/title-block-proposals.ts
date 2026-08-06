/**
 * @fileoverview Λ2 — η σύνθεση: `TitleBlockReading[]` → `BindingProposal[]` (ADR-745 Φ3β).
 *
 * **Το μοναδικό σημείο που βλέπει και την πινακίδα και τη βάση** (§5.3). Παραμένει **καθαρή
 * συνάρτηση**: το στιγμιότυπο επαφών δίνεται ως όρισμα, τίποτα δεν διαβάζεται και **τίποτα δεν
 * γράφεται**. Η εγγραφή ζει αποκλειστικά στο `title-block-apply`, μετά από κλικ ανθρώπου.
 *
 * **Κάθε** πεδίο της ανάγνωσης παράγει πρόταση — ακόμη κι αυτά που δεν πάνε πουθενά. Ένα πεδίο
 * που εξαφανίζεται από την οθόνη είναι σιωπηλή απώλεια (§8 κανόνας 3): ο άνθρωπος δεν μπορεί να
 * ξεχωρίσει το «δεν αντιστοιχεί κάπου» από το «δεν διαβάστηκε».
 *
 * @module lib/title-block/title-block-proposals
 */

import type { BindingProposal } from '@/types/title-block-binding';
import type { TitleBlockField, TitleBlockReading } from '@/types/title-block-reading';
import { proposalBase } from './proposal-base';
import { isDrawingMetaField, resolveDrawingMetaProposal } from './resolve-drawing-meta';
import { resolveLandownerProposal } from './resolve-landowner';
import { resolveLocationProposals } from './resolve-location';
import { type ContactSnapshotEntry, resolvePersonProposal } from './resolve-people';
import { buildSurveyProposal, type SurveySnapshot } from './resolve-survey-record';

export interface TitleBlockResolveContext {
  /** Απόν όταν το σχέδιο δεν είναι δεμένο σε έργο — τα πεδία έργου τότε **δηλώνονται** κλειστά. */
  readonly projectId?: string;
  readonly levelId: string;
  readonly contacts: readonly ContactSnapshotEntry[];
  /**
   * Έχει το έργο κύρια διεύθυνση; `undefined` = άγνωστο ⇒ **δεν** μπλοκάρουμε (βλ. `resolve-location`).
   *
   * 🔑 **Η καθαρότητα δεν θυσιάζεται.** Είναι το ίδιο πρότυπο με το `contacts`: στιγμιότυπο της
   * βάσης που δίνεται ως **όρισμα**, ποτέ ανάγνωση από μέσα. Ο Λ2 παραμένει συνάρτηση που ούτε
   * διαβάζει ούτε γράφει — το φυλάει το `title-block-purity.test.ts`.
   */
  readonly hasPrimaryAddress?: boolean;
  /**
   * Τα τοπογραφικά του έργου — ο προορισμός των **δηλώσεων του τοπογράφου** (ADR-759 Φ3γ).
   *
   * Ίδιο πρότυπο με το `contacts`: στιγμιότυπο της βάσης ως **όρισμα**, ποτέ ανάγνωση από
   * μέσα. Απόν ⇒ κανένα τοπογραφικό δεν δόθηκε ⇒ `no-survey-record` (κυριολεκτικά αληθές,
   * όχι εικασία) — δες {@link resolveSurveyDestination}.
   */
  readonly survey?: SurveySnapshot;
}

/** Πεδίο που ο Λ1 διαβάζει σωστά αλλά **καμία** οντότητα δεν το ζητά (π.χ. `ΕΡΓΟ`, `ΜΕΛΕΤΗ`). */
function unsupported(field: TitleBlockField, titleBlockIndex: number): BindingProposal {
  return {
    ...proposalBase(field, titleBlockIndex),
    candidates: [],
    blockedBy: 'unsupported-field',
  };
}

/** Πεδίο έργου σε σχέδιο χωρίς έργο — ορατά κλειστό, ποτέ κρυμμένο. */
function needsProject(field: TitleBlockField, titleBlockIndex: number): BindingProposal {
  return { ...unsupported(field, titleBlockIndex), blockedBy: 'no-project' };
}

/**
 * Το κελί «ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ» λέει **δύο πράγματα ταυτόχρονα**, και τα δύο είναι αληθή.
 *
 * 🔑 **Δεν είναι διπλογραφή — είναι δύο διαφορετικά γεγονότα με την ίδια αφορμή:**
 * - *πότε σχεδιάστηκε **αυτό το φύλλο*** → `DxfLevelDocument.studyDate` (ADR-745 §7: τα
 *   μεταδεδομένα ανήκουν στο φύλλο· ένα έργο έχει δεκάδες σχέδια με διαφορετικές ημερομηνίες)·
 * - *πότε **δήλωσε ο τοπογράφος** όσα δηλώνει* → `SurveyRecord.surveyDate`, που είναι η
 *   ημερομηνία **της βεβαίωσης** και ο λόγος που ένα τοπογραφικό του 2019 δεν επιτρέπεται να
 *   επικαιροποιήσει τους σημερινούς όρους δόμησης (ADR-759 §4.1).
 *
 * Δύο **ξεχωριστές** προτάσεις, όχι δύο υποψήφιοι μιας: ο μηχανικός δέχεται τη μία και
 * απορρίπτει την άλλη. Οι δύο εγκρίσεις συνυπάρχουν, γιατί το `slot` είναι το **πεδίο**
 * (`studyDate` ≠ `surveyDate`) — δες `lib/title-block-binding-id`.
 */
function studyDateAsSurveyDate(
  field: TitleBlockField,
  titleBlockIndex: number,
  context: TitleBlockResolveContext,
  projectId: string,
): BindingProposal {
  return buildSurveyProposal(proposalBase(field, titleBlockIndex), {
    projectId,
    field: 'surveyDate',
    rawText: field.rawValue,
    snapshot: context.survey,
  });
}

/** Το κελί μελετητών: **μία πρόταση ανά πρόσωπο**, όλες από το ίδιο κελί. */
function designerProposals(
  field: TitleBlockField,
  reading: TitleBlockReading,
  titleBlockIndex: number,
  context: TitleBlockResolveContext,
): BindingProposal[] {
  if (!context.projectId) return [needsProject(field, titleBlockIndex)];
  if (reading.people.length === 0) {
    return [{ ...unsupported(field, titleBlockIndex), blockedBy: 'no-match' }];
  }
  return reading.people.map((person) =>
    resolvePersonProposal(person, field, {
      projectId: context.projectId as string,
      titleBlockIndex,
      contacts: context.contacts,
    }),
  );
}

function proposalsForField(
  field: TitleBlockField,
  reading: TitleBlockReading,
  titleBlockIndex: number,
  context: TitleBlockResolveContext,
): BindingProposal[] {
  if (isDrawingMetaField(field.key)) {
    const meta = resolveDrawingMetaProposal(field, {
      levelId: context.levelId,
      titleBlockIndex,
      // ⚠️ Ρητό spread αντί για `projectId: context.projectId`: το `exactOptionalPropertyTypes`
      // ξεχωρίζει «απόν» από «`undefined`», και ο στόχος `drawing-meta` απαιτεί **συμβολοσειρά**.
      ...(context.projectId ? { projectId: context.projectId } : {}),
    });
    return context.projectId && field.key === 'studyDate'
      ? [meta, studyDateAsSurveyDate(field, titleBlockIndex, context, context.projectId)]
      : [meta];
  }
  if (field.key === 'designers') {
    return designerProposals(field, reading, titleBlockIndex, context);
  }
  if (!context.projectId) return [needsProject(field, titleBlockIndex)];

  if (field.key === 'employer') {
    return [
      resolveLandownerProposal(field, {
        projectId: context.projectId,
        titleBlockIndex,
        contacts: context.contacts,
      }),
    ];
  }
  if (field.key === 'location') {
    return resolveLocationProposals(field, {
      projectId: context.projectId,
      titleBlockIndex,
      ...(context.hasPrimaryAddress !== undefined
        ? { hasPrimaryAddress: context.hasPrimaryAddress }
        : {}),
      ...(context.survey ? { survey: context.survey } : {}),
    });
  }
  return [unsupported(field, titleBlockIndex)];
}

/**
 * Όλες οι προτάσεις ενός layer.
 *
 * Ο δείκτης πινακίδας κρατιέται σε **κάθε** πρόταση: ένα layer φέρει μετρημένα **δύο** πινακίδες
 * (§2.3 Παγίδα Δ), και οι δύο μπορούν να δώσουν το ίδιο `fieldKey`. Χωρίς τον δείκτη, οι δύο
 * εγκρίσεις θα κατέληγαν στο ίδιο ντετερμινιστικό κλειδί και η μία θα έσβηνε την άλλη.
 */
export function resolveTitleBlockProposals(
  readings: readonly TitleBlockReading[],
  context: TitleBlockResolveContext,
): BindingProposal[] {
  return readings.flatMap((reading, index) =>
    reading.fields.flatMap((field) => proposalsForField(field, reading, index, context)),
  );
}
