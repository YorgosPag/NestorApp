'use client';
/**
 * ADR-651 Φάση Η — hook του διαλόγου «Αναθεωρήσεις» (Απόφαση #9).
 *
 * Ενορχηστρώνει τρία βήματα, με **αυτή τη σειρά**:
 *  1. **Ιστορία** — φορτώνει τον πίνακα αναθεωρήσεων του έργου (υπάρχον client cache).
 *  2. **«Τι άλλαξε;»** — χτίζει το αποτύπωμα του **τρέχοντος** σετ φύλλων (καθαρή συνάρτηση,
 *     ίδιες πηγές με το `buildSheetSet` της Φάσης Ζ) και το στέλνει στον server, που το
 *     συγκρίνει με την προηγούμενη έκδοση και ζητά από το AI **πρόταση** περιγραφής.
 *  3. **Καταχώρηση** — μόνο μετά την **έγκριση/διόρθωση** του χρήστη (ποτέ αυτόματα).
 *
 * Graceful: αποτυχία AI ⇒ ο ντετερμινιστικός diff παραμένει ορατός και ο χρήστης γράφει μόνος
 * του την περιγραφή — η αναθεώρηση **ποτέ** δεν μπλοκάρεται.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../../systems/levels';
import { sheetTitleForLevel } from '../../../text-engine/title-block/sheet-set';
import { toTitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';
import {
  createProjectRevision,
  loadProjectRevisions,
  requestRevisionChangelog,
} from '../../../text-engine/title-block/revisions/revision-client';
import { nextRevisionNumber } from '../../../text-engine/title-block/revisions/revision-numbering';
import {
  buildRevisionSnapshot,
  type RevisionSheetSource,
} from '../../../text-engine/title-block/revisions/revision-snapshot';
import type {
  DrawingRevisionSummary,
  RevisionDiff,
} from '../../../text-engine/title-block/revisions/revision.types';

export interface UseRevisionsResult {
  readonly revisions: readonly DrawingRevisionSummary[];
  /** Ο επόμενος αριθμός, όπως θα καταχωρηθεί (ντετερμινιστικά — προεπισκόπηση, όχι δέσμευση). */
  readonly nextNumber: number;
  readonly sheetCount: number;
  readonly diff: RevisionDiff | null;
  readonly highlights: readonly string[];
  readonly description: string;
  readonly analyzing: boolean;
  readonly submitting: boolean;
  /** i18n key suffix κάτω από `revisions.errors`, ή `null`. */
  readonly errorKey: string | null;
  setDescription(value: string): void;
  analyze(): Promise<void>;
  submit(): Promise<void>;
}

export function useRevisions(projectId?: string): UseRevisionsResult {
  const { i18n } = useTranslation('dxf-viewer-shell');
  const locale = toTitleBlockLocale(i18n.language);
  const { levels, getLevelScene } = useLevels();

  const [revisions, setRevisions] = useState<readonly DrawingRevisionSummary[]>([]);
  const [diff, setDiff] = useState<RevisionDiff | null>(null);
  const [highlights, setHighlights] = useState<readonly string[]>([]);
  const [description, setDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadProjectRevisions(projectId).then((history) => {
      if (alive) setRevisions(history);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  /** Οι πηγές του αποτυπώματος = τα φύλλα του σετ (ίδιο μοτίβο με το PrintHost/ExportHost). */
  const sheetSources = useMemo<RevisionSheetSource[]>(() => {
    return [...levels]
      .sort((a, b) => a.order - b.order)
      .map((level) => ({ level, scene: getLevelScene(level.id) }))
      .filter((entry) => entry.scene !== null)
      .map((entry) => ({
        levelId: entry.level.id,
        title: sheetTitleForLevel(entry.level),
        entities: entry.scene?.entities ?? [],
      }));
  }, [levels, getLevelScene]);

  const analyze = useCallback(async () => {
    if (!projectId) {
      setErrorKey('noProject');
      return;
    }
    setErrorKey(null);
    setAnalyzing(true);
    try {
      const result = await requestRevisionChangelog(
        projectId,
        buildRevisionSnapshot(sheetSources),
        locale,
      );
      if (!result) {
        setErrorKey('analyzeFailed');
        return;
      }
      setDiff(result.diff);
      setHighlights(result.suggestion?.highlights ?? []);
      if (result.suggestion) setDescription(result.suggestion.description);
      else setErrorKey('aiUnavailable');
    } finally {
      setAnalyzing(false);
    }
  }, [projectId, sheetSources, locale]);

  const submit = useCallback(async () => {
    if (!projectId || !description.trim()) return;
    setErrorKey(null);
    setSubmitting(true);
    try {
      const created = await createProjectRevision(
        projectId,
        description.trim(),
        buildRevisionSnapshot(sheetSources),
      );
      if (!created) {
        setErrorKey('submitFailed');
        return;
      }
      setRevisions(await loadProjectRevisions(projectId));
      setDiff(null);
      setHighlights([]);
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  }, [projectId, description, sheetSources]);

  return {
    revisions,
    nextNumber: nextRevisionNumber(revisions), // ίδια ντετερμινιστική συνάρτηση με τον server
    sheetCount: sheetSources.length,
    diff,
    highlights,
    description,
    analyzing,
    submitting,
    errorKey,
    setDescription,
    analyze,
    submit,
  };
}
