'use client';

/**
 * **Ο διάλογος σημείου εστίασης** — ένα κλικ, ζωντανή προεπισκόπηση, «Αυτόματο» ως ρητή επιλογή (ADR-880).
 *
 * @related ADR-880 · lib/listings/photo-focal-point · components/search-results/listing-photo-position-class
 *
 * 🔑 **ΤΡΙΑ ΚΟΥΜΠΙΑ, ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ**: «Αυτόματο» ⇒ `null` (η μηχανή μιλά — και θα μιλά καλύτερα όταν
 * βελτιωθεί)· «Εφαρμογή» ⇒ το σημείο του ανθρώπου **μόνο αν το άγγιξε** (αλλιώς πάλι `null`)· «Ακύρωση» ⇒
 * τίποτα. Το σημείο δεν «παγώνει» ποτέ κατά λάθος — πρότυπο Cloudinary: ο άνθρωπος **παρακάμπτει**, δεν αντιγράφει.
 *
 * ⚠️ **Το περιεχόμενο γεννιέται σε κάθε άνοιγμα** (Radix αποσυνδέει το `DialogContent` όταν κλείνει): το
 * πρόχειρο σημείο δεν επιβιώνει μιας ακύρωσης.
 */

import React, { useEffect, useState } from 'react';

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
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import { FocalPointPreviews } from './FocalPointPreviews';
import { FocalPointSurface, type ImageSize } from './FocalPointSurface';
import { useFocalPointPicker } from './use-focal-point-picker';
import type { FocalPointSuggestionState } from './use-focal-point-suggestion';
import type { PhotoSource } from './use-photo-source';

const NS = 'property-market';
const K = `${NS}:photoFocalPoint`;

interface PhotoFocalPointDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Το URL του πρωτοτύπου — φορτώνει · έτοιμο · απέτυχε (ποτέ ατέρμονο «φορτώνει»). */
  readonly source: PhotoSource;
  readonly name: string;
  /** Η **δήλωση** του ανθρώπου — `null` ⇒ αυτόματο. */
  readonly declared: PhotoFocalPoint | null;
  readonly suggestion: FocalPointSuggestionState;
  /** `null` ⇒ «άφησε το αυτόματο». */
  readonly onApply: (next: PhotoFocalPoint | null) => void;
}

const suggestedPoint = (suggestion: FocalPointSuggestionState): PhotoFocalPoint | null =>
  suggestion.kind === 'ready' ? suggestion.point : null;

type EditorProps = Omit<PhotoFocalPointDialogProps, 'open' | 'source'> & { readonly src: string };

interface FooterProps {
  /** `undefined` ⇒ ακύρωση· `null` ⇒ αυτόματο· σημείο ⇒ δήλωση. */
  readonly onClose: (next: PhotoFocalPoint | null | undefined) => void;
  /** Τι επιστρέφει η «Εφαρμογή» — αποφασισμένο από τον επεξεργαστή (άγγιγμα ή υπάρχουσα δήλωση). */
  readonly applied: PhotoFocalPoint | null;
}

function FocalPointFooter({ onClose, applied }: FooterProps) {
  const { t } = useTranslation([NS, 'common']);
  return (
    <DialogFooter className="gap-2 sm:justify-between">
      <Button type="button" variant="outline" onClick={() => onClose(null)}>{t(`${K}.useAuto`)}</Button>
      <span className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => onClose(undefined)}>{t('common:buttons.cancel')}</Button>
        <Button type="button" onClick={() => onClose(applied)}>{t(`${K}.apply`)}</Button>
      </span>
    </DialogFooter>
  );
}

function FocalPointEditor({ src, name, declared, suggestion, onApply, onOpenChange }: EditorProps) {
  const { t } = useTranslation([NS]);
  const picker = useFocalPointPicker(declared ?? suggestedPoint(suggestion));
  const [size, setSize] = useState<ImageSize | null>(null);
  const [failed, setFailed] = useState(false);
  const auto = suggestedPoint(suggestion);
  const { touched, suggest } = picker;

  // Η πρόταση που έφτασε **μετά** το άνοιγμα γίνεται αφετηρία — μόνο αν ο άνθρωπος δεν έχει μιλήσει ακόμη.
  useEffect(() => {
    if (declared === null && !touched && auto !== null) suggest(auto);
  }, [auto, declared, touched, suggest]);

  const close = (next: PhotoFocalPoint | null | undefined): void => {
    if (next !== undefined) onApply(next);
    onOpenChange(false);
  };
  const valueText = t(`${K}.valueText`, { x: Math.round(picker.point.x * 100), y: Math.round(picker.point.y * 100) });

  return (
    <>
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        {failed ? (
          <p className="text-sm text-foreground">{t(`${K}.imageLoadFailed`)}</p>
        ) : (
          <FocalPointSurface
            src={src} alt={name} point={picker.point} suggestion={auto} size={size}
            surfaceLabel={t(`${K}.surfaceAria`)} valueText={valueText} handlers={picker.surfaceHandlers}
            onSize={setSize} onError={() => setFailed(true)}
          />
        )}
        <FocalPointPreviews src={src} size={size} point={picker.point} suggestion={suggestion} onAxis={picker.setAxis} />
      </section>
      <FocalPointFooter onClose={close} applied={touched || declared !== null ? picker.point : null} />
    </>
  );
}

export function PhotoFocalPointDialog(props: PhotoFocalPointDialogProps): React.ReactElement {
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
          <FocalPointEditor {...editor} onOpenChange={onOpenChange} src={source.src} />
        ) : (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t(source.kind === 'failed' ? `${K}.imageLoadFailed` : `${K}.imageLoading`)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
