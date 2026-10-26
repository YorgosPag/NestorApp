'use client';

/**
 * @fileoverview **Τα πεδία μιας δήλωσης δικαιωμάτων μέσου** (IPTC: δημιουργός · σημείωμα πνευματικών δικαιωμάτων · άδεια)
 *   — ένα στοιχείο για κάθε πλαίσιο αδειών (ADR-884 Φ0.14 · ADR-923 §5.10.4).
 * @related lib/media-rights/media-rights-draft.ts (πρόχειρο ⇄ `MediaRights`) · constants/media-rights-vocabulary.ts
 * @module components/shared/media-rights/MediaRightsFields
 *
 * 🔑 **Το πλαίσιο ορίζει τις επιλογές** (`MEDIA_LICENSE_CONTEXTS`): ο κατάλογος δεν προσφέρει ποτέ «προώθηση αγγελίας»,
 *    η αγγελία ποτέ «μεταπώληση από αντιπρόσωπο». Οι **λέξεις** έρχονται από τον καλούντα (κάθε τομέας έχει το namespace
 *    του, N.11)· ο χάρτης σκοπών του είναι `Record<MediaLicensePurposeIn<C>, string>`, άρα νέος σκοπός σπάει τη μεταγλώττιση.
 * ⚠️ Καμία επιλογή `value=""` (CHECK 3.48) — οι διάρκειες είναι κλειστό σύνολο.
 */

import { DatePickerField } from '@/components/ui/date-picker-field';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MediaLicenseContext, MediaLicensePurposeIn } from '@/constants/media-rights-vocabulary';
import {
  draftTermKindsIn,
  mediaLicensePurposesIn,
  type DraftTermKind,
  type MediaRightsDraft,
  type MediaRightsDraftIssue,
} from '@/lib/media-rights/media-rights-draft';

/** Οι λέξεις της φόρμας, ήδη μεταφρασμένες από τον καλούντα. */
export interface MediaRightsWords<C extends MediaLicenseContext> {
  readonly legend: string;
  readonly creator: string;
  readonly copyrightNotice: string;
  readonly copyrightNoticeHint: string;
  readonly purpose: string;
  readonly term: string;
  readonly termUntil: string;
  readonly termUntilPlaceholder: string;
  readonly purposes: Readonly<Record<MediaLicensePurposeIn<C>, string>>;
  readonly termKinds: Readonly<Record<DraftTermKind, string>>;
  readonly issues: Readonly<Record<MediaRightsDraftIssue, string>>;
}

export interface MediaRightsFieldsProps<C extends MediaLicenseContext> {
  readonly context: C;
  /** Πρόθεμα των `id` — δύο φόρμες στην ίδια σελίδα δεν συγκρούονται. */
  readonly idPrefix: string;
  readonly draft: MediaRightsDraft<C>;
  readonly onChange: (next: MediaRightsDraft<C>) => void;
  readonly words: MediaRightsWords<C>;
  /** Δείχνονται μόνο όταν ο καλών το αποφασίσει (ανέγγιχτη φόρμα δεν «κοκκινίζει»). */
  readonly issues?: readonly MediaRightsDraftIssue[];
  readonly disabled?: boolean;
}

function FieldIssue({ id, text }: { readonly id: string; readonly text: string | null }) {
  if (text === null) return null;
  return <p id={id} role="alert" className="m-0 text-xs text-destructive">{text}</p>;
}

export function MediaRightsFields<C extends MediaLicenseContext>({
  context, idPrefix, draft, onChange, words, issues = [], disabled = false,
}: MediaRightsFieldsProps<C>) {
  const patch = (next: Partial<MediaRightsDraft<C>>) => onChange({ ...draft, ...next });
  const issueText = (issue: MediaRightsDraftIssue) => (issues.includes(issue) ? words.issues[issue] : null);
  const id = (field: string) => `${idPrefix}-${field}`;
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{words.legend}</legend>
      <section className="space-y-1">
        <Label htmlFor={id('creator')}>{words.creator}</Label>
        <Input id={id('creator')} value={draft.creatorName} aria-invalid={issueText('creatorRequired') !== null}
          aria-describedby={id('creator-issue')} onChange={(e) => patch({ creatorName: e.target.value })} />
        <FieldIssue id={id('creator-issue')} text={issueText('creatorRequired')} />
      </section>
      <section className="space-y-1">
        <Label htmlFor={id('notice')}>{words.copyrightNotice}</Label>
        <Input id={id('notice')} value={draft.copyrightNotice} placeholder={words.copyrightNoticeHint}
          onChange={(e) => patch({ copyrightNotice: e.target.value })} />
      </section>
      <section className="space-y-1">
        <Label htmlFor={id('purpose')}>{words.purpose}</Label>
        <EnumSelect id={id('purpose')} value={draft.purpose} values={mediaLicensePurposesIn(context)} disabled={disabled}
          getLabel={(purpose) => words.purposes[purpose]} onValueChange={(purpose) => patch({ purpose })} />
      </section>
      <section className="space-y-1">
        <Label htmlFor={id('term')}>{words.term}</Label>
        <EnumSelect id={id('term')} value={draft.termKind} values={draftTermKindsIn(context)} disabled={disabled}
          getLabel={(kind) => words.termKinds[kind]} onValueChange={(termKind) => patch({ termKind })} />
      </section>
      {draft.termKind === 'date' ? (
        <section className="space-y-1 sm:col-span-2">
          <Label htmlFor={id('until')}>{words.termUntil}</Label>
          <DatePickerField id={id('until')} value={draft.termUntil} placeholder={words.termUntilPlaceholder} disabled={disabled}
            disabledDates={{ before: new Date() }} onSelect={(termUntil) => patch({ termUntil })} />
          <FieldIssue id={id('until-issue')} text={issueText('termDateRequired')} />
        </section>
      ) : null}
    </fieldset>
  );
}
