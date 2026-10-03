'use client';

/**
 * @fileoverview **ΔΗΛΩΣΗ ΙΔΙΟΤΗΤΑΣ** — αριθμός μητρώου + σύλλογος/περιφέρεια, πριν την αποδοχή (ADR-901 Ε-4).
 * @related ADR-901 §5.3 βήμα 8 · ADR-798 (λεξιλόγιο μητρώων) · `CaseInviteContent.tsx`
 * @module components/case-invite/CredentialDeclarationForm
 *
 * 🔑 **Δήλωση, όχι επαλήθευση** (v1): τα μέρη βλέπουν «(δηλωμένο)», καμία αναμονή. **Προσυμπληρωμένο** από ό,τι ξέρει
 * ήδη το βιβλίο του οικοδεσπότη — ο άνθρωπος επιβεβαιώνει ή διορθώνει (πρότυπο DocuSign «confirm your details»).
 * Ο **ρόλος** διαλέγει μητρώο: ο άνθρωπος δεν βλέπει λίστα μητρώων να διαλέξει λάθος.
 */

import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { CredentialDeclarationInput } from '@/lib/conveyance/declared-credential';
import type { CredentialHint } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

import { CASE_INVITE_CHAPTER_KEY, CASE_INVITE_KEYS, CASE_INVITE_NS, CASE_INVITE_NUMBER_KEY } from './case-invite-labels';

export interface CredentialDraft {
  readonly number: string;
  readonly chapter: string;
}

/** Το προσχέδιο από την προσυμπλήρωση — κενό όπου δεν ξέρουμε τίποτα. */
export function credentialDraftOf(hint: CredentialHint | null): CredentialDraft {
  return { number: hint?.number ?? '', chapter: hint?.chapter ?? '' };
}

/** Η δήλωση προς αποστολή — `null` όσο λείπει ο αριθμός (το UI δείχνει `showMissing`, ποτέ σιωπηλή αποστολή). */
export function credentialFromDraft(draft: CredentialDraft): CredentialDeclarationInput | null {
  const number = draft.number.trim();
  return number.length === 0 ? null : { number, chapter: draft.chapter.trim() || null };
}

interface CredentialDeclarationFormProps {
  readonly role: LegalProfessionalRole;
  readonly draft: CredentialDraft;
  readonly onChange: (draft: CredentialDraft) => void;
  /** Πατήθηκε «Αποδοχή» χωρίς αριθμό — το λάθος λέγεται **δίπλα** στο πεδίο. */
  readonly showMissing: boolean;
  readonly disabled: boolean;
}

export function CredentialDeclarationForm({ role, draft, onChange, showMissing, disabled }: CredentialDeclarationFormProps) {
  const { t } = useTranslation(CASE_INVITE_NS);
  const colors = useSemanticColors();
  const numberId = useId();
  const chapterId = useId();
  const errorId = useId();
  const missing = showMissing && draft.number.trim().length === 0;
  return (
    <fieldset className="space-y-3 rounded-md border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">{t(CASE_INVITE_KEYS.credentialTitle)}</legend>
      <p className="text-xs text-muted-foreground">{t(CASE_INVITE_KEYS.credentialHint)}</p>
      <section className="space-y-1">
        <Label htmlFor={numberId}>{t(CASE_INVITE_NUMBER_KEY[role])}</Label>
        <Input
          id={numberId}
          value={draft.number}
          maxLength={40}
          autoComplete="off"
          aria-invalid={missing}
          aria-describedby={missing ? errorId : undefined}
          onChange={(event) => onChange({ ...draft, number: event.target.value })}
        />
        {missing && <p id={errorId} role="alert" className={cn('text-xs', colors.text.error)}>{t(CASE_INVITE_KEYS.numberRequired)}</p>}
      </section>
      <section className="space-y-1">
        <Label htmlFor={chapterId}>{t(CASE_INVITE_CHAPTER_KEY[role])}</Label>
        <Input
          id={chapterId}
          value={draft.chapter}
          maxLength={120}
          onChange={(event) => onChange({ ...draft, chapter: event.target.value })}
        />
      </section>
    </fieldset>
  );
}
