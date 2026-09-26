'use client';

/**
 * @fileoverview **Η ΦΟΡΜΑ ΑΝΕΒΑΣΜΑΤΟΣ ΠΑΝΟΡΑΜΑΤΟΣ 360°** — ίδια για υπεύθυνο και φωτογράφο (μία πόρτα, Φ0.8).
 * @related ADR-884 Φ0.8 · Φ0.14 (δικαιώματα IPTC) · §4.5 (Κ3α) · `useTourCaptureUpload.ts`
 * @module components/spatial-tour/TourCaptureUploadForm
 *
 * 🔑 **Τα δικαιώματα δηλώνονται ΜΑΖΙ με το αρχείο** (Φ0.14): λήψη χωρίς αναγνώσιμα δικαιώματα δεν γράφεται ποτέ.
 * Ο δημιουργός δένεται στον λογαριασμό **μόνο** όσο ο άνθρωπος δηλώνει τον εαυτό του — αν γράψει άλλο όνομα
 * (εξωτερικός φωτογράφος), δηλώνεται με όνομα και `userId: null` (ο διακομιστής αρνείται απόδοση σε **ξένο** λογαριασμό).
 * ⚠️ Καμία επιλογή `value=""` στα Select (το Radix το δεσμεύει — CHECK 3.48): «καμία φάση» = `none`.
 */

import { useState, type FormEvent } from 'react';

import { useAuthOptional } from '@/auth';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MEDIA_LICENSE_PURPOSES, type MediaLicensePurpose } from '@/constants/media-rights-vocabulary';
import {
  TOUR_CAPTURE_AUDIENCES,
  TOUR_MILESTONES,
  type TourCaptureAudience,
  type TourMilestone,
} from '@/constants/spatial-tour-vocabulary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PANORAMA_CONTENT_TYPE } from '@/lib/spatial-tour/panorama-policy';
import type { TourSubject } from '@/types/spatial-tour';

import {
  AUDIENCE_KEY,
  LICENSE_PURPOSE_KEY,
  LICENSE_TERM_KEY,
  MILESTONE_KEY,
  TOUR_FAILURE_KEYS,
  TOUR_REFUSAL_KEY,
  UPLOAD_KEYS,
  UPLOAD_SOURCE_KEY,
} from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { useTourCaptureUpload, type TourUploadPhase } from './useTourCaptureUpload';

const UPLOAD_SOURCES = ['camera-360', 'phone'] as const satisfies readonly (keyof typeof UPLOAD_SOURCE_KEY)[];
type UploadSource = (typeof UPLOAD_SOURCES)[number];
const LICENSE_TERM_KINDS = ['perpetual', 'date'] as const satisfies readonly (keyof typeof LICENSE_TERM_KEY)[];
type LicenseTermKind = (typeof LICENSE_TERM_KINDS)[number];
const NO_MILESTONE = 'none';

interface DeclarationDraft {
  source: UploadSource;
  audience: TourCaptureAudience;
  milestone: TourMilestone | typeof NO_MILESTONE;
  creatorName: string;
  purpose: MediaLicensePurpose;
  termKind: LicenseTermKind;
  termUntil: Date | undefined;
}

/** Η δήλωση όπως τη ζητά ο διακομιστής (`readCaptureDeclaration` + `readMediaRights`). */
function declarationOf(draft: DeclarationDraft, file: File, self: { readonly uid: string | null; readonly name: string }) {
  const name = draft.creatorName.trim();
  const isSelf = self.uid !== null && name === self.name.trim();
  const term = draft.termKind === 'date' && draft.termUntil
    ? { kind: 'date', until: draft.termUntil.toISOString() }
    : { kind: 'perpetual' };
  return {
    source: draft.source,
    audience: draft.audience,
    milestone: draft.milestone === NO_MILESTONE ? null : draft.milestone,
    originalFilename: file.name,
    rights: {
      creator: { name, userId: isSelf ? self.uid : null, url: null },
      licensors: [],
      copyrightNotice: `© ${new Date().getFullYear()} ${name}`,
      webStatementOfRights: null,
      license: { purpose: draft.purpose, term },
    },
  };
}

export function TourCaptureUploadForm({ subject, onUploaded }: { readonly subject: TourSubject; readonly onUploaded: () => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const auth = useAuthOptional();
  const self = { uid: auth?.user?.uid ?? null, name: auth?.user?.displayName ?? '' };
  const upload = useTourCaptureUpload(subject);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DeclarationDraft>({
    source: 'camera-360', audience: 'public-listing', milestone: NO_MILESTONE, creatorName: self.name,
    purpose: 'listing-marketing', termKind: 'perpetual', termUntil: undefined,
  });
  const patch = (next: Partial<DeclarationDraft>) => setDraft((prev) => ({ ...prev, ...next }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (file === null || draft.creatorName.trim().length === 0) return;
    await upload.upload(file, declarationOf(draft, file, self));
    onUploaded();
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-busy={upload.busy}>
      <fieldset className="space-y-2" disabled={upload.busy}>
        <legend className="text-sm font-medium">{t(UPLOAD_KEYS.title)}</legend>
        <Label htmlFor="tour-upload-file">{t(UPLOAD_KEYS.chooseFile)}</Label>
        <Input id="tour-upload-file" type="file" accept={PANORAMA_CONTENT_TYPE} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="text-xs text-muted-foreground">{t(UPLOAD_KEYS.fileHint)}</p>
        <DeclarationFields draft={draft} patch={patch} />
      </fieldset>
      <UploadStatus phase={upload.phase} onCancel={upload.cancel} />
      <Button type="submit" disabled={upload.busy || file === null || draft.creatorName.trim().length === 0}>
        {t(UPLOAD_KEYS.submit)}
      </Button>
    </form>
  );
}

function DeclarationFields({ draft, patch }: { readonly draft: DeclarationDraft; readonly patch: (next: Partial<DeclarationDraft>) => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section className="grid gap-2 sm:grid-cols-2">
      <LabeledSelect id="tour-upload-source" label={t(UPLOAD_KEYS.source)} value={draft.source}
        options={UPLOAD_SOURCES.map((value) => ({ value, label: t(UPLOAD_SOURCE_KEY[value]) }))}
        onChange={(source) => patch({ source })} />
      <LabeledSelect id="tour-upload-audience" label={t(UPLOAD_KEYS.audience)} value={draft.audience}
        options={TOUR_CAPTURE_AUDIENCES.map((value) => ({ value, label: t(AUDIENCE_KEY[value]) }))}
        onChange={(audience) => patch({ audience })} />
      <LabeledSelect id="tour-upload-milestone" label={t(UPLOAD_KEYS.milestone)} value={draft.milestone}
        options={[
          { value: NO_MILESTONE, label: t(UPLOAD_KEYS.milestoneNone) },
          ...TOUR_MILESTONES.map((value) => ({ value, label: t(MILESTONE_KEY[value]) })),
        ]}
        onChange={(milestone) => patch({ milestone })} />
      <section className="space-y-1">
        <Label htmlFor="tour-upload-creator">{t(UPLOAD_KEYS.creator)}</Label>
        <Input id="tour-upload-creator" value={draft.creatorName} onChange={(e) => patch({ creatorName: e.target.value })} required />
      </section>
      <LabeledSelect id="tour-upload-purpose" label={t(UPLOAD_KEYS.licensePurpose)} value={draft.purpose}
        options={MEDIA_LICENSE_PURPOSES.map((value) => ({ value, label: t(LICENSE_PURPOSE_KEY[value]) }))}
        onChange={(purpose) => patch({ purpose })} />
      <LabeledSelect id="tour-upload-term" label={t(UPLOAD_KEYS.licenseTerm)} value={draft.termKind}
        options={LICENSE_TERM_KINDS.map((value) => ({ value, label: t(LICENSE_TERM_KEY[value]) }))}
        onChange={(termKind) => patch({ termKind })} />
      {draft.termKind === 'date' && (
        <section className="space-y-1">
          <Label htmlFor="tour-upload-until">{t(UPLOAD_KEYS.licenseUntil)}</Label>
          <DatePickerField id="tour-upload-until" value={draft.termUntil} onSelect={(d) => patch({ termUntil: d })}
            placeholder={t(UPLOAD_KEYS.licenseUntil)} disabledDates={{ before: new Date() }} />
        </section>
      )}
    </section>
  );
}

interface SelectOption<T extends string> { readonly value: T; readonly label: string }

/** 🔑 Γενικό στο `T`: η τιμή που επιστρέφει είναι **μία από τις δοσμένες** — ποτέ ανεπαλήθευτο string (κανένα `as`). */
function LabeledSelect<T extends string>(props: {
  readonly id: string; readonly label: string; readonly value: T;
  readonly options: readonly SelectOption<T>[]; readonly onChange: (value: T) => void;
}) {
  const choose = (raw: string) => {
    const option = props.options.find((candidate) => candidate.value === raw);
    if (option) props.onChange(option.value);
  };
  return (
    <section className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select value={props.value} onValueChange={choose}>
        <SelectTrigger id={props.id}><SelectValue /></SelectTrigger>
        <SelectContent>
          {props.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </section>
  );
}

/** Η φάση με λέξεις — κάθε άρνηση λέει **τι να κάνει** ο άνθρωπος. `role="status"`: την ακούει και ο αναγνώστης οθόνης. */
function UploadStatus({ phase, onCancel }: { readonly phase: TourUploadPhase; readonly onCancel: () => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  switch (phase.kind) {
    case 'idle':
      return null;
    case 'uploading':
      return (
        <section className="space-y-1" role="status">
          <Progress value={phase.percent} />
          <p className="text-sm">{t(phase.interrupted ? UPLOAD_KEYS.paused : UPLOAD_KEYS.progress, { percent: phase.percent })}</p>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>{t(UPLOAD_KEYS.cancel)}</Button>
        </section>
      );
    case 'verifying':
      return <p className="text-sm" role="status">{t(UPLOAD_KEYS.verifying)}</p>;
    case 'done':
      return <p className="text-sm" role="status">{t(phase.replayed ? UPLOAD_KEYS.replayed : UPLOAD_KEYS.done)}</p>;
    case 'refused':
      return <p className="text-sm text-destructive" role="alert">{t(TOUR_REFUSAL_KEY[phase.reason])}</p>;
    case 'failed':
      return <p className="text-sm text-destructive" role="alert">{t(TOUR_FAILURE_KEYS.unavailable)}</p>;
  }
}
