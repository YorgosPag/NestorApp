'use client';

/**
 * @fileoverview Αντιλογισμός εγγραφής Βιβλίου Ε-Ε — διάλογος (ADR-ACC-010 §2.1.1 Φ8)
 * @description Δείχνει ΤΙ θα αλλάξει ΠΡΙΝ την επιβεβαίωση (ποιο σύνολο μειώνεται, κατά πόσο, σε ποια ημερομηνία) και
 *   ζητά λόγο (SAP FB08 reason code). Δύο πράξεις: «Αντιλογισμός» και «Αντιλογισμός και διόρθωση» — η δεύτερη ανοίγει
 *   αμέσως τη φόρμα με τα στοιχεία της αρχικής (στο SAP / DATEV είναι δύο χωριστές χειροκίνητες πράξεις).
 *   Καμία απόφαση εδώ: επιτρέπεται / ημερομηνία τα κρίνει ο διακομιστής μέσα στη συναλλαγή.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TranslatorFn } from '@/lib/policy/policy-error-translator';
import type { JournalEntry } from '@/subapps/accounting/types';
import {
  JOURNAL_REVERSAL_REASON_CODES,
  JOURNAL_REVERSAL_REASON_REQUIRING_NOTES,
  type JournalReversalReasonCode,
} from '../../types/journal-reversal';
import {
  isReversalReasonComplete,
  journalReversalRefusalOfErrorCode,
} from '../../services/journal/journal-reversal-policy';
import { isEfkaContribution } from '../../services/journal/journal-ledger';
import { useJournalReversal, type JournalReversalFailure, type JournalReversalResult } from '../../hooks/useJournalReversal';
import { postingPeriodDenialMessage, type PostingDenialBody } from '../../utils/posting-period-denial';
import { formatAccountingCurrency, formatAccountingDate } from '../../utils/format';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/** Τι έγινε — ο καλών ανανεώνει τη λίστα και, με `correct`, ανοίγει τη φόρμα διόρθωσης. */
export interface JournalReversalDone {
  readonly entry: JournalEntry;
  readonly result: JournalReversalResult;
  readonly correct: boolean;
}

interface ReverseJournalEntryDialogProps {
  /** `null` = κλειστός */
  readonly entry: JournalEntry | null;
  readonly onClose: () => void;
  readonly onReversed: (done: JournalReversalDone) => void;
}

/** Ποιο σύνολο μειώνεται — με το ΙΔΙΟ κριτήριο ΕΦΚΑ που χρησιμοποιεί ο φόρος (`isEfkaContribution`). */
function effectKeyOf(entry: JournalEntry): 'income' | 'expense' | 'efka' {
  if (entry.type === 'income') return 'income';
  return isEfkaContribution(entry) ? 'efka' : 'expense';
}

/** Το μήνυμα μιας αποτυχίας: άρνηση περιόδου → άρνηση πολιτικής → γενικό. */
function failureMessage(failure: JournalReversalFailure, t: TranslatorFn): string {
  const period = postingPeriodDenialMessage(failure.body as PostingDenialBody | null, t);
  if (period !== null) return period;
  const refusal = journalReversalRefusalOfErrorCode(failure.errorCode);
  return refusal !== null ? t(`accounting:journal.reversal.refusals.${refusal}`) : t('accounting:journal.reversal.errorGeneric');
}

function EntrySummary({ entry }: { readonly entry: JournalEntry }) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  return (
    <section aria-label={t('journal.reversal.summaryTitle')} className="rounded-md border border-border p-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className={colors.text.muted}>{t('journal.date')}</dt>
        <dd>{formatAccountingDate(entry.date)}</dd>
        <dt className={colors.text.muted}>{t('journal.description_label')}</dt>
        <dd className="break-words">{entry.description}</dd>
        <dt className={colors.text.muted}>{t('journal.category')}</dt>
        <dd>{entry.category}</dd>
        <dt className={colors.text.muted}>{t('journal.netAmount')}</dt>
        <dd className="font-medium">{formatAccountingCurrency(entry.netAmount)}</dd>
        <dt className={colors.text.muted}>{t('journal.grossAmount')}</dt>
        <dd>{formatAccountingCurrency(entry.grossAmount)}</dd>
      </dl>
    </section>
  );
}

function ReversalEffect({ entry }: { readonly entry: JournalEntry }) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  return (
    <section aria-label={t('journal.reversal.effectTitle')} className="space-y-1 text-sm">
      <p className="font-medium">
        {t(`journal.reversal.effect.${effectKeyOf(entry)}`, { amount: formatAccountingCurrency(entry.netAmount) })}
      </p>
      <p className={colors.text.muted}>{t('journal.reversal.dateRule', { date: formatAccountingDate(entry.date) })}</p>
      <p className={colors.text.muted}>{t('journal.reversal.originalStays')}</p>
    </section>
  );
}

interface ReasonFieldsProps {
  readonly reason: JournalReversalReasonCode | null;
  readonly notes: string;
  readonly onReason: (reason: JournalReversalReasonCode) => void;
  readonly onNotes: (notes: string) => void;
}

function ReasonFields({ reason, notes, onReason, onNotes }: ReasonFieldsProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const notesRequired = reason === JOURNAL_REVERSAL_REASON_REQUIRING_NOTES;
  return (
    <fieldset className="space-y-3">
      <Label htmlFor="journal-reversal-reason">{t('journal.reversal.reason')}</Label>
      <Select value={reason ?? undefined} onValueChange={(value) => onReason(value as JournalReversalReasonCode)}>
        <SelectTrigger id="journal-reversal-reason">
          <SelectValue placeholder={t('journal.reversal.reasonPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {JOURNAL_REVERSAL_REASON_CODES.map((code) => (
            <SelectItem key={code} value={code}>{t(`journal.reversal.reasons.${code}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="journal-reversal-notes">
        {notesRequired ? t('journal.reversal.notesRequired') : t('journal.reversal.notes')}
      </Label>
      <Textarea id="journal-reversal-notes" value={notes} maxLength={2000}
        placeholder={t('journal.reversal.notesPlaceholder')} onChange={(event) => onNotes(event.target.value)} />
    </fieldset>
  );
}

export function ReverseJournalEntryDialog({ entry, onClose, onReversed }: ReverseJournalEntryDialogProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const [reason, setReason] = useState<JournalReversalReasonCode | null>(null);
  const [notes, setNotes] = useState('');
  const { running, failure, reverse, reset } = useJournalReversal();

  // Νέα εγγραφή ⇒ καθαρή φόρμα (ποτέ ο λόγος της προηγούμενης πάνω σε άλλη εγγραφή).
  useEffect(() => { setReason(null); setNotes(''); reset(); }, [entry?.entryId, reset]);

  const complete = reason !== null && isReversalReasonComplete(reason, notes);
  const submit = async (correct: boolean) => {
    if (entry === null || reason === null || !complete) return;
    const result = await reverse(entry.entryId, reason, notes);
    if (result !== null) onReversed({ entry, result, correct });
  };

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => { if (!open && !running) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('journal.reversal.title')}</DialogTitle>
          <DialogDescription>{t('journal.reversal.description')}</DialogDescription>
        </DialogHeader>
        {entry !== null && <EntrySummary entry={entry} />}
        {entry !== null && <ReversalEffect entry={entry} />}
        <ReasonFields reason={reason} notes={notes} onReason={setReason} onNotes={setNotes} />
        {failure !== null && <p role="alert" className={`text-sm ${colors.text.error}`}>{failureMessage(failure, t)}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={onClose}>{t('journal.reversal.cancel')}</Button>
          <Button variant="outline" disabled={!complete || running} onClick={() => void submit(true)}>
            {t('journal.reversal.confirmAndCorrect')}
          </Button>
          <Button variant="destructive" disabled={!complete || running} onClick={() => void submit(false)}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('journal.reversal.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
