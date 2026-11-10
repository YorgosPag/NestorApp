'use client';

/**
 * @fileoverview **Τα λόγια της αναθεώρησης, από ΕΝΑ σημείο** (ADR-923 §5.5.2 Β8 βήμα Β): η αιτία ενός στόχου, το όνομά του, και
 *   η ετικέτα + το εικονίδιο κάθε ενέργειας λύσης. Τα διαβάζουν το `aria-label` του πλαισίου, το popover **και** η λίστα — ό,τι
 *   ακούει ο αναγνώστης οθόνης, βλέπει ο άνθρωπος, λέξη προς λέξη.
 * @module components/catalog/imports/review-reason-text
 *
 * 🔑 Ως το βήμα Β το κείμενο της αιτίας ήταν τοπικό στο `ImportReviewOverlay` (`useReasonText`) και η λίστα έγραφε μόνη της
 *    `t(LINE_REFUSAL_KEYS[…])` — δύο δρόμοι για την ίδια πρόταση.
 * 🔑 Ετικέτες ενεργειών = τα **υπάρχοντα** κλειδιά της λίστας (`review.lines.*` · `review.priceLine.action` · `review.keepValue` ·
 *    `review.editValue`)· νέο μόνο το «Διάλεξε τιμοκατάλογο».
 */

import { useCallback } from 'react';
import { Euro, EyeOff, Link2, Pencil, Plus, type LucideIcon } from 'lucide-react';

import { useImportIssueMessage } from './import-issue-messages';
import { LINE_REFUSAL_KEYS, useImportText } from './import-text';
import { useTargetLabeler } from './import-target-label';
import type { ReviewBoxTarget } from './review-overlay-model';
import type { LineTool, RemedyAction, RemedyWhy } from './review-remedy';

/** Η αιτία ως πρόταση — `null` όταν δεν υπάρχει. `needIssues`: φόρτωσε τον πίνακα μηνυμάτων ευρημάτων (ADR-744 §34). */
export function useReviewReasonFormatter(needIssues: boolean): (why: RemedyWhy | null) => string | null {
  const { t } = useImportText();
  const issueMessage = useImportIssueMessage(needIssues);
  return useCallback((why: RemedyWhy | null) => {
    if (why === null) return null;
    switch (why.kind) {
      case 'issue': return issueMessage(why.issue);
      case 'unread': return t('review.overlay.reasonUnread');
      case 'unverified': return t('review.overlay.reasonUnverified');
      case 'refused': return t(LINE_REFUSAL_KEYS[why.refusal]);
      case 'unmapped': return t('review.remedy.unmappedWhy');
    }
  }, [issueMessage, t]);
}

/** Η αιτία ενός στόχου. */
export function useReviewReasonText(why: RemedyWhy | null): string | null {
  return useReviewReasonFormatter(why?.kind === 'issue')(why);
}

/** Το όνομα ενός στόχου: η ετικέτα του πεδίου (από τη βιβλιοθήκη ιδιοτήτων) ή η ετικέτα της γραμμής, όπως τυπώθηκε. */
export function useReviewTargetName(): (entry: ReviewBoxTarget) => string {
  const labelOf = useTargetLabeler();
  return useCallback((entry: ReviewBoxTarget) => (entry.subject.kind === 'field' ? labelOf(entry.subject.field) : entry.subject.label), [labelOf]);
}

/**
 * §5.5.2 Β8 (β): **ποιο** κελί του πεδίου είναι το πλαίσιο — `null` για το κελί της τιμής. Το όνομα μένει το όνομα του πεδίου (το
 * ζητά και η «Διόρθωση της τιμής «…»»)· η σχέση είναι χωριστή πρόταση, ίδια στο `aria-label` και στο popover.
 * ⚠️ Κυριολεκτικές κλήσεις `t('…')` (CHECK 3.34, όπως το `useRemedyActionLabel`).
 */
export function useReviewRelationText(): (entry: ReviewBoxTarget) => string | null {
  const { t } = useImportText();
  return useCallback((entry: ReviewBoxTarget) => {
    if (entry.subject.kind !== 'field' || entry.relation === 'value') return null;
    const value = entry.subject.field.sourceText;
    return entry.relation === 'alternative' ? t('review.overlay.relationAlternative', { value }) : t('review.overlay.relationCorroboration', { value });
  }, [t]);
}

export interface RemedyActionLook {
  readonly icon: LucideIcon | null;
  /** Η αγνόηση είναι η «ήπια» ενέργεια — όπως στη λίστα. */
  readonly variant: 'outline' | 'ghost';
}

const LINE_TOOL_ICONS: Readonly<Record<LineTool, LucideIcon>> = { map: Link2, new: Plus, price: Euro };

/** Εικονίδιο και ύφος κουμπιού ανά ενέργεια — ένα σημείο για λίστα και popover. */
export function remedyActionLook(action: RemedyAction): RemedyActionLook {
  switch (action.kind) {
    case 'keepValue': return { icon: null, variant: 'outline' };
    case 'editField': return { icon: Pencil, variant: 'outline' };
    case 'lineTool': return { icon: LINE_TOOL_ICONS[action.mode], variant: 'outline' };
    case 'ignoreLine': return { icon: EyeOff, variant: 'ghost' };
    // Η ίδια θέση με την «Τιμή» (βήμα Γ), άρα το ίδιο εικονίδιο: είναι η τιμή, με μια προϋπόθεση ακόμη.
    case 'pickPriceTarget': return { icon: Euro, variant: 'outline' };
  }
}

/**
 * Η ετικέτα μιας ενέργειας. `field` = το όνομα του πεδίου, για τη «Διόρθωση της τιμής «…»».
 * ⚠️ Κυριολεκτικές κλήσεις `t('…')`, όχι πίνακας κλειδιών: ο περιπατητής του CHECK 3.34 βλέπει μόνο κυριολεκτικά, και με πίνακα τα
 *    κλειδιά της λίστας έπεφταν από τη φέτα κελύφους (μετρημένο 2026-11-10: −4 κλειδιά).
 */
export function useRemedyActionLabel(): (action: RemedyAction, field: string) => string {
  const { t } = useImportText();
  return useCallback((action: RemedyAction, field: string) => {
    switch (action.kind) {
      case 'keepValue': return t('review.keepValue', { value: action.text });
      case 'editField': return t('review.editValue', { field });
      case 'lineTool':
        if (action.mode === 'map') return t('review.lines.map');
        return action.mode === 'new' ? t('review.lines.newAttribute') : t('review.priceLine.action');
      case 'ignoreLine': return t('review.lines.ignore');
      case 'pickPriceTarget': return t('review.remedy.pickPriceTarget');
    }
  }, [t]);
}
