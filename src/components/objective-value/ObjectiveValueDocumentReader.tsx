'use client';

/**
 * **«Διαβάστε το από το έγγραφο»** (ADR-949 Α-2) — ο άνθρωπος διαλέγει το PDF, η **συσκευή** το διαβάζει
 * (`readDocumentOnDevice`), και οι τιμές προτείνονται ανά πεδίο (`ObjectiveValueReadingReview`).
 *
 * 🔒 **Η δήλωση ιδιωτικότητας είναι ΑΛΗΘΙΝΗ, όχι υπόσχεση**: κανένα αίτημα δικτύου με το αρχείο — το pdf.js τρέχει στον
 *    browser, και ό,τι μένει στη μνήμη είναι οι γραμμές του αναγνώστη (χωρίς ΑΦΜ/ονόματα).
 * 🔑 **Ζωντανή μόνο η τελευταία ανάγνωση**: νέο αρχείο ενώ διαβάζεται το προηγούμενο ⇒ το παλιό αποτέλεσμα αγνοείται.
 * 🔑 **Ειλικρινείς εκβάσεις**: σαρωμένο, σπασμένη γραμματοσειρά, άλλο έγγραφο, πολύ μεγάλο — καθεμία με τη δική της
 *    πρόταση και πάντα με διέξοδο: «συμπληρώστε το πεδίο».
 */

import React, { useCallback, useId, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import type { ObjectiveValueReadingApplication } from '@/lib/objective-value/objective-value-declared-reading';

import { EVIDENCE_DOCUMENT_LABEL_KEYS } from './objective-value-document-labels';
import { ObjectiveValueReadingReview } from './ObjectiveValueReadingReview';
import { readDocumentOnDevice, type DeviceReadingOutcome } from './read-pdf-on-device';

const NS = 'objective-value';
const R = `${NS}:evidence.reader`;

type ReadingState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'reading' }
  | { readonly phase: 'failed' }
  | { readonly phase: 'done'; readonly outcome: DeviceReadingOutcome };

/** Η ανάγνωση με φρουρό «μόνο η τελευταία μετρά» — ο αριθμός αιτήματος, όχι σημαία, ώστε να μη χάνεται αλλαγή αρχείου. */
function useDeviceReading(document: ObjectiveValueEvidenceDocument) {
  const [state, setState] = useState<ReadingState>({ phase: 'idle' });
  const latest = useRef(0);
  const read = useCallback(
    async (file: File) => {
      const request = ++latest.current;
      setState({ phase: 'reading' });
      try {
        const outcome = await readDocumentOnDevice(document, file);
        if (request === latest.current) setState({ phase: 'done', outcome });
      } catch {
        if (request === latest.current) setState({ phase: 'failed' });
      }
    },
    [document],
  );
  const reset = useCallback(() => {
    latest.current += 1;
    setState({ phase: 'idle' });
  }, []);
  return { state, read, reset };
}

function OutcomeMessage({ outcome }: { readonly outcome: Exclude<DeviceReadingOutcome, { kind: 'read' }> }) {
  const { t } = useTranslation([NS]);
  return <p className="m-0 text-sm text-foreground" role="alert">{t(`${R}.outcome.${outcome.kind}`)}</p>;
}

interface ReadingBodyProps {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly state: ReadingState;
  readonly draft: ObjectiveValueDraft;
  readonly onApply: (application: ObjectiveValueReadingApplication) => void;
}

function ReadingBody({ document, state, draft, onApply }: ReadingBodyProps) {
  const { t } = useTranslation([NS]);
  switch (state.phase) {
    case 'idle':
      return null;
    case 'reading':
      return <p className="m-0 text-sm text-muted-foreground" role="status">{t(`${R}.reading`)}</p>;
    case 'failed':
      return <p className="m-0 text-sm text-foreground" role="alert">{t(`${R}.outcome.failed`)}</p>;
    case 'done':
      return state.outcome.kind === 'read'
        ? <ObjectiveValueReadingReview document={document} rows={state.outcome.rows} draft={draft} onApply={onApply} />
        : <OutcomeMessage outcome={state.outcome} />;
  }
}

interface ObjectiveValueDocumentReaderProps {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly draft: ObjectiveValueDraft;
  readonly onApply: (application: ObjectiveValueReadingApplication) => void;
}

export function ObjectiveValueDocumentReader({ document, draft, onApply }: ObjectiveValueDocumentReaderProps) {
  const { t } = useTranslation([NS]);
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const { state, read, reset } = useDeviceReading(document);
  const documentLabel = t(EVIDENCE_DOCUMENT_LABEL_KEYS[document]);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };
  const apply = (application: ObjectiveValueReadingApplication) => {
    onApply(application);
    changeOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="self-start">
          <FileText className="mr-1 h-4 w-4" aria-hidden />
          {t(`${R}.open`)}
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${R}.title`, { document: documentLabel })}</DialogTitle>
          <DialogDescription>{t(`${R}.privacy`)}</DialogDescription>
        </DialogHeader>
        <p className="m-0 flex flex-col gap-1">
          <Label htmlFor={inputId}>{t(`${R}.fileLabel`)}</Label>
          <Input id={inputId} type="file" accept="application/pdf,.pdf" disabled={state.phase === 'reading'}
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void read(file); }} />
        </p>
        <ReadingBody document={document} state={state} draft={draft} onApply={apply} />
      </DialogContent>
    </Dialog>
  );
}
