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
import { isDrawingMetaField, resolveDrawingMetaProposal } from './resolve-drawing-meta';
import { resolveLandownerProposal } from './resolve-landowner';
import { resolveLocationProposals } from './resolve-location';
import { type ContactSnapshotEntry, resolvePersonProposal } from './resolve-people';

export interface TitleBlockResolveContext {
  /** Απόν όταν το σχέδιο δεν είναι δεμένο σε έργο — τα πεδία έργου τότε **δηλώνονται** κλειστά. */
  readonly projectId?: string;
  readonly levelId: string;
  readonly contacts: readonly ContactSnapshotEntry[];
}

/** Πεδίο που ο Λ1 διαβάζει σωστά αλλά **καμία** οντότητα δεν το ζητά (π.χ. `ΕΡΓΟ`, `ΜΕΛΕΤΗ`). */
function unsupported(field: TitleBlockField, titleBlockIndex: number): BindingProposal {
  return {
    fieldKey: field.key,
    titleBlockIndex,
    sourceHandle: field.sourceHandle,
    labelHandle: field.labelHandle,
    at: field.at,
    snapshotValue: field.rawValue,
    candidates: [],
    blockedBy: 'unsupported-field',
  };
}

/** Πεδίο έργου σε σχέδιο χωρίς έργο — ορατά κλειστό, ποτέ κρυμμένο. */
function needsProject(field: TitleBlockField, titleBlockIndex: number): BindingProposal {
  return { ...unsupported(field, titleBlockIndex), blockedBy: 'no-project' };
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
    return [resolveDrawingMetaProposal(field, { levelId: context.levelId, titleBlockIndex })];
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
    return resolveLocationProposals(field, { projectId: context.projectId, titleBlockIndex });
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
