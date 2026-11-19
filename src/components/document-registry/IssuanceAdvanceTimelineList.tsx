'use client';

/**
 * @fileoverview ADR-943 Φ5δ — **το χρονολόγιο των χρημάτων** ως λίστα: ώρα + τι έγινε. Ένα συστατικό για τις τρεις όψεις
 *   (γραφείο · μηχανικός · ιδιοκτήτης)· κάθε όψη δίνει **τις δικές της λέξεις** (`textOf`), με κυριολεκτικά κλειδιά στο δικό
 *   της namespace (CHECK 3.34) — καμία όψη δεν φορτώνει λεξιλόγιο άλλης.
 * @related lib/document-validity/issuance-advance.ts (`advanceTimelineOf` — η μία πηγή) · issuance-advance-labels.ts
 *   (`advanceTimelineText`) · app/(auth)/document-request/DocumentRequestAdvanceTimeline.tsx
 * @module components/document-registry/IssuanceAdvanceTimelineList
 *
 * 🔑 ADR-945 §7.6 — **γενικό** πάνω σε κάθε χρονολόγιο `{kind, at}`: το ίδιο συστατικό δείχνει και τα στάδια μιας
 *    προσφοράς (`bidTimelineOf`) — ποτέ δεύτερη λίστα χρόνου.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatOperatorDateTime } from '@/lib/operator-time-format';

/** Ό,τι χρειάζεται μια γραμμή χρονολογίου — το `kind` + `at` είναι και η ταυτότητά της. */
export interface TimelineEntryBase {
  readonly kind: string;
  readonly at: string;
}

interface TimelineListProps<E extends TimelineEntryBase> {
  readonly timeline: readonly E[];
  readonly textOf: (entry: E) => string;
}

export function IssuanceAdvanceTimelineList<E extends TimelineEntryBase>({ timeline, textOf }: TimelineListProps<E>): React.ReactElement | null {
  const { i18n } = useTranslation();
  if (timeline.length === 0) return null;
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0">
      {timeline.map((entry) => (
        <li key={`${entry.kind}:${entry.at}`} className="flex flex-col text-sm text-card-foreground">
          <time dateTime={entry.at} className="text-xs text-muted-foreground">{formatOperatorDateTime(entry.at, i18n.language)}</time>
          <span>{textOf(entry)}</span>
        </li>
      ))}
    </ol>
  );
}
