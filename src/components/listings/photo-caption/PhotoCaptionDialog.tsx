'use client';

/**
 * **Ο διάλογος λεζάντας** — είδος από κλειστό λεξιλόγιο, προαιρετικό κείμενο, ζωντανή προεπισκόπηση.
 *
 * @related lib/listings/photo-caption · shared/media/photo-caption-labels (οι ΙΔΙΕΣ ετικέτες με το κοινό)
 *
 * 🔑 **ΤΡΙΑ ΚΟΥΜΠΙΑ, ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ** (ίδιο σχήμα με το σημείο εστίασης): «Χωρίς λεζάντα» ⇒ `null` (η γραμμή φεύγει)·
 * «Εφαρμογή» ⇒ ό,τι έμεινε μετά την κανονικοποίηση (`photoCaptionOf` — άδεια ⇒ πάλι `null`)· «Ακύρωση» ⇒ τίποτα.
 *
 * 🔑 **Η προεπισκόπηση είναι η γραμμή του κοινού**: ο άνθρωπος βλέπει τη λεζάντα με το **ίδιο** component
 * (`usePhotoCaptionText`) που θα τη δείξει η αγγελία — ποτέ δεύτερη σύνθεση που θα μπορούσε να αποκλίνει.
 *
 * ⚠️ Ο καλών τον αποδίδει **μόνο όταν είναι ανοιχτός**, άρα το πρόχειρο δεν επιβιώνει μιας ακύρωσης.
 */

import React, { useId, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePhotoCaptionText, usePhotoSubjectLabels } from '@/components/shared/media/photo-caption-labels';
import type { PhotoCaptionDialogProps } from '@/components/shared/media/photo-caption-surface-props';
import {
  PHOTO_CAPTION_TEXT_MAX,
  PHOTO_SUBJECT_GROUPS,
  PHOTO_SUBJECTS,
  photoCaptionOf,
  type PhotoCaption,
  type PhotoSubject,
  type PhotoSubjectGroup,
} from '@/lib/listings/photo-caption';

const NS = 'property-market';
const K = `${NS}:photoCaption`;

/** Η τιμή «χωρίς είδος» στον επιλογέα — το Radix **δεσμεύει** το `''` (CHECK 3.48), άρα ρητή φρουρός. */
const NO_SUBJECT = 'none';

const GROUP_ORDER = ['site', 'interior', 'documents'] as const satisfies readonly PhotoSubjectGroup[];

const isPhotoSubject = (value: string): value is PhotoSubject =>
  (PHOTO_SUBJECTS as readonly string[]).includes(value);

interface SubjectSelectProps {
  readonly id: string;
  readonly value: PhotoSubject | null;
  readonly onChange: (next: PhotoSubject | null) => void;
}

function SubjectSelect({ id, value, onChange }: SubjectSelectProps) {
  const { t } = useTranslation([NS]);
  const labels = usePhotoSubjectLabels();
  // 🔴 Κυριολεκτικά κλειδιά — η ομάδα διαλέγεται ως **δεδομένο**, ποτέ με σύνθεση κλειδιού (ADR-744).
  const groupLabels: Readonly<Record<PhotoSubjectGroup, string>> = {
    site: t(`${K}.groupSite`),
    interior: t(`${K}.groupInterior`),
    documents: t(`${K}.groupDocuments`),
  };

  return (
    <Select
      value={value ?? NO_SUBJECT}
      onValueChange={(next) => onChange(isPhotoSubject(next) ? next : null)}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_SUBJECT}>{t(`${K}.subjectNone`)}</SelectItem>
        {GROUP_ORDER.map((group) => (
          <SelectGroup key={group}>
            <SelectLabel>{groupLabels[group]}</SelectLabel>
            {PHOTO_SUBJECT_GROUPS[group].map((subject) => (
              <SelectItem key={subject} value={subject}>{labels[subject]}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

interface CaptionFieldsProps {
  readonly subject: PhotoSubject | null;
  readonly text: string;
  readonly onSubject: (next: PhotoSubject | null) => void;
  readonly onText: (next: string) => void;
}

function CaptionFields({ subject, text, onSubject, onText }: CaptionFieldsProps) {
  const { t } = useTranslation([NS]);
  const subjectId = useId();
  const textId = useId();
  const hintId = useId();

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <Label htmlFor={subjectId}>{t(`${K}.subjectLabel`)}</Label>
      <SubjectSelect id={subjectId} value={subject} onChange={onSubject} />
      <Label htmlFor={textId}>{t(`${K}.textLabel`)}</Label>
      <Input
        id={textId}
        value={text}
        maxLength={PHOTO_CAPTION_TEXT_MAX}
        placeholder={t(`${K}.textPlaceholder`)}
        aria-describedby={hintId}
        onChange={(event) => onText(event.target.value)}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        {t(`${K}.textHint`, { used: text.length, max: PHOTO_CAPTION_TEXT_MAX })}
      </p>
    </fieldset>
  );
}

type EditorProps = Omit<PhotoCaptionDialogProps, 'open' | 'source'> & { readonly src: string };

function CaptionEditor({ src, name, declared, onApply, onOpenChange }: EditorProps) {
  const { t } = useTranslation([NS, 'common']);
  const [subject, setSubject] = useState<PhotoSubject | null>(declared?.subject ?? null);
  const [text, setText] = useState(declared?.text ?? '');
  const draft = photoCaptionOf(subject, text);
  const preview = usePhotoCaptionText()(draft);

  const close = (next: PhotoCaption | null | undefined): void => {
    if (next !== undefined) onApply(next);
    onOpenChange(false);
  };

  return (
    <>
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <figure aria-label={t(`${K}.previewLabel`)} className="m-0 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/proxy του ιδιωτικού αρχείου, εκτός optimizer */}
          <img src={src} alt={name} className="max-h-[50vh] w-full rounded-lg border border-border object-contain" />
          <figcaption aria-live="polite" className="mt-1 text-xs text-muted-foreground">
            {preview ?? t(`${K}.previewEmpty`)}
          </figcaption>
        </figure>
        <CaptionFields subject={subject} text={text} onSubject={setSubject} onText={setText} />
      </section>
      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="outline" onClick={() => close(null)}>{t(`${K}.remove`)}</Button>
        <span className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => close(undefined)}>{t('common:buttons.cancel')}</Button>
          <Button type="button" onClick={() => close(draft)}>{t(`${K}.apply`)}</Button>
        </span>
      </DialogFooter>
    </>
  );
}

export default function PhotoCaptionDialog(props: PhotoCaptionDialogProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { open, onOpenChange, source, ...editor } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t(`${K}.title`)}</DialogTitle>
          <DialogDescription>{t(`${K}.description`)}</DialogDescription>
        </DialogHeader>
        {source.kind === 'ready' ? (
          <CaptionEditor {...editor} onOpenChange={onOpenChange} src={source.src} />
        ) : (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t(source.kind === 'failed' ? `${K}.imageLoadFailed` : `${K}.imageLoading`)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
