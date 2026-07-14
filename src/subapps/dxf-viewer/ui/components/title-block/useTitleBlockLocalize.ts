'use client';

/**
 * ADR-651 Φάση Κ (§8 #7) — το state της **μεταγλώττισης** μιας πινακίδας.
 *
 * Τρία στρώματα, με αυτή τη σειρά (§5.10):
 *
 *  1. **λεξικό** — ντετερμινιστικό, παραγμένο από τα δίγλωσσα presets· καλύπτει τους όρους ΤΕΕ,
 *  2. **AI** — μόνο για ό,τι δεν ήξερε το λεξικό, σημασμένο ρητά ως AI στο UI,
 *  3. **ο χρήστης** — διορθώνει ό,τι θέλει· η τελευταία λέξη είναι πάντα δική του.
 *
 * Τίποτα δεν γράφεται πριν πατηθεί «Δημιουργία»: ο διάλογος είναι **προεπισκόπηση + έγκριση**
 * (ίδιο μοτίβο με το AI changelog της Φάσης Η). Μια πινακίδα κατατίθεται σε πολεοδομία —
 * σιωπηλή μηχανική μετάφραση δεν μπαίνει ποτέ σε σχέδιο.
 */

import * as React from 'react';
import { requestTermTranslations } from '../../../text-engine/title-block/ai/ai-title-block-client';
import {
  applyTitleBlockTranslation,
  collectTitleBlockTerms,
} from '../../../text-engine/title-block/localization/localize-title-block';
import { lookupTitleBlockTerm } from '../../../text-engine/title-block/localization/title-block-glossary';
import { titleBlockTemplateLocale } from '../../../text-engine/title-block/localization/title-block-variant';
import type { TemplateVariantOverrides } from '../../../text-engine/templates/template-inheritance';
import type { TextTemplate } from '../../../text-engine/templates/template.types';
import type { TitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';

/** Από πού ήρθε η μετάφραση — ο χρήστης πρέπει να **βλέπει** τι μάντεψε η μηχανή. */
export type TitleBlockTermOrigin = 'glossary' | 'ai' | 'manual' | 'unknown';

export interface TitleBlockTermRow {
  readonly term: string;
  readonly translation: string;
  readonly origin: TitleBlockTermOrigin;
}

export interface UseTitleBlockLocalizeResult {
  readonly rows: readonly TitleBlockTermRow[];
  /** Το AI τρέχει για τους άγνωστους όρους. */
  readonly translating: boolean;
  /** Όροι που κανείς (ούτε λεξικό, ούτε AI, ούτε ο χρήστης) δεν έχει μεταφράσει ακόμη. */
  readonly pendingCount: number;
  readonly setTranslation: (term: string, value: string) => void;
  /** Οι γραμμές της πινακίδας όπως θα τυπωθούν — ζωντανή προεπισκόπηση. */
  readonly preview: readonly string[];
  /** Ό,τι θα γραφτεί: μεταφρασμένο περιεχόμενο + μεταφρασμένο κελί σφραγίδας. */
  readonly buildOverrides: () => TemplateVariantOverrides;
}

/** Η γλώσσα-πηγή: αυτή που δηλώνει το πρότυπο· αν δεν δηλώνει, η αντίθετη του στόχου. */
export function sourceLocaleOf(template: TextTemplate, target: TitleBlockLocale): TitleBlockLocale {
  return titleBlockTemplateLocale(template) ?? (target === 'en' ? 'el' : 'en');
}

/** Οι όροι της πινακίδας: οι ετικέτες του περιεχομένου **και** το κείμενο του κελιού σφραγίδας. */
function templateTerms(template: TextTemplate): readonly string[] {
  const terms = collectTitleBlockTerms(template.content);
  const stampLabel = template.titleBlock?.stampLabel?.trim();
  if (!stampLabel || terms.includes(stampLabel)) return terms;
  return [...terms, stampLabel];
}

/** Πρώτο πέρασμα — ό,τι ξέρει το λεξικό, ακαριαία και δωρεάν. */
function seedFromGlossary(
  terms: readonly string[],
  from: TitleBlockLocale,
  to: TitleBlockLocale,
): readonly TitleBlockTermRow[] {
  return terms.map((term) => {
    const translation = lookupTitleBlockTerm(term, from, to);
    return translation !== null
      ? { term, translation, origin: 'glossary' as const }
      : { term, translation: '', origin: 'unknown' as const };
  });
}

export function useTitleBlockLocalize(
  template: TextTemplate,
  from: TitleBlockLocale,
  to: TitleBlockLocale,
): UseTitleBlockLocalizeResult {
  const terms = React.useMemo(() => templateTerms(template), [template]);
  const [rows, setRows] = React.useState<readonly TitleBlockTermRow[]>(() =>
    seedFromGlossary(terms, from, to),
  );
  const [translating, setTranslating] = React.useState(false);

  // Νέο πρότυπο/κατεύθυνση ⇒ νέο πρώτο πέρασμα (ο διάλογος ξαναγεννιέται καθαρός).
  React.useEffect(() => {
    setRows(seedFromGlossary(terms, from, to));
  }, [terms, from, to]);

  // Δεύτερο πέρασμα: ΜΟΝΟ οι άγνωστοι όροι φεύγουν για AI. Αποτυχία ⇒ μένουν κενοί και τους
  // γράφει ο χρήστης — η μεταγλώττιση δεν εξαρτάται ΠΟΤΕ από το AI (N.7.2 #4).
  React.useEffect(() => {
    const unknown = seedFromGlossary(terms, from, to)
      .filter((row) => row.origin === 'unknown')
      .map((row) => row.term);
    if (unknown.length === 0) return;

    let cancelled = false;
    setTranslating(true);
    void requestTermTranslations(unknown, from, to)
      .then((translations) => {
        if (cancelled) return;
        setRows((current) =>
          current.map((row) => {
            const suggestion = translations[row.term];
            return row.origin === 'unknown' && suggestion
              ? { ...row, translation: suggestion, origin: 'ai' as const }
              : row;
          }),
        );
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [terms, from, to]);

  const setTranslation = React.useCallback((term: string, value: string): void => {
    setRows((current) =>
      current.map((row) =>
        row.term === term ? { ...row, translation: value, origin: 'manual' } : row,
      ),
    );
  }, []);

  const translations = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.translation.trim()) map.set(row.term, row.translation.trim());
    }
    return map;
  }, [rows]);

  const preview = React.useMemo(() => {
    const content = applyTitleBlockTranslation(template.content, translations);
    return content.paragraphs.map((paragraph) =>
      paragraph.runs.map((run) => run.text).join(''),
    );
  }, [template.content, translations]);

  const buildOverrides = React.useCallback((): TemplateVariantOverrides => {
    const meta = template.titleBlock;
    const stampLabel = meta?.stampLabel?.trim();
    return {
      content: applyTitleBlockTranslation(template.content, translations),
      locale: to,
      ...(meta
        ? {
            titleBlock: {
              withStampBox: meta.withStampBox,
              stampLabel: (stampLabel && translations.get(stampLabel)) || meta.stampLabel,
            },
          }
        : {}),
    };
  }, [template, translations, to]);

  return {
    rows,
    translating,
    pendingCount: rows.filter((row) => !row.translation.trim()).length,
    setTranslation,
    preview,
    buildOverrides,
  };
}
