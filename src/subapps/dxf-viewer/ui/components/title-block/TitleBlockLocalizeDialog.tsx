'use client';

/**
 * ADR-651 Φάση Κ (§8 #7) — διάλογος **μεταγλώττισης πινακίδας** EL↔EN.
 *
 * Ο χρήστης βλέπει **ακριβώς τι θα γραφτεί** πριν γραφτεί: κάθε ετικέτα με τη μετάφρασή της,
 * την **προέλευσή** της (λεξικό / AI / δική του) και ζωντανή προεπισκόπηση της πινακίδας. Τα
 * `{{πεδία}}` μένουν ορατά και άθικτα — είναι δεδομένα, όχι κείμενο.
 *
 * Δύο ρόλοι, ένας διάλογος:
 *  - **δημιουργία**: γεννά την αγγλική παραλλαγή (απόσπαση με μεταφρασμένο περιεχόμενο),
 *  - **ενημέρωση**: ο ελληνικός γονιός άλλαξε ⇒ ξανα-μεταφράζει και τραβά τις αλλαγές του
 *    **στα αγγλικά** (αλλιώς το pull θα έγραφε ελληνικά πάνω στη μετάφραση).
 *
 * N.11: μηδέν σταθερή συμβολοσειρά — όλα από `titleBlockLocalize.*`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TemplateVariantOverrides } from '../../../text-engine/templates/template-inheritance';
import type { TextTemplate } from '../../../text-engine/templates/template.types';
import type { TitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';
import {
  sourceLocaleOf,
  useTitleBlockLocalize,
  type TitleBlockTermOrigin,
} from './useTitleBlockLocalize';
import type { TitleBlockLibraryRow, useTitleBlockLibrary } from './useTitleBlockLibrary';

/** Τι θα κάνει η έγκριση: νέα παραλλαγή, ή ξανα-μετάφραση υπάρχουσας από τον γονιό της. */
export type TitleBlockLocalizeMode = 'create' | 'update';

export interface TitleBlockLocalizeRequest {
  readonly mode: TitleBlockLocalizeMode;
  /** Το πρότυπο που **διαβάζεται** (ο γονιός: η πηγή των λέξεων). */
  readonly source: TextTemplate;
  /** Η γλώσσα-στόχος της παραλλαγής. */
  readonly target: TitleBlockLocale;
  /** Η **υπάρχουσα** παραλλαγή που ενημερώνεται — μόνο σε `mode: 'update'`. */
  readonly row?: TitleBlockLibraryRow;
}

export interface TitleBlockLocalizeDialogProps {
  readonly request: TitleBlockLocalizeRequest | null;
  readonly onClose: () => void;
  /** Η **έγκριση**: ό,τι ενέκρινε ο χρήστης (μεταφρασμένο περιεχόμενο + σφραγίδα) πάει προς τα πάνω. */
  readonly onConfirm: (
    request: TitleBlockLocalizeRequest,
    name: string,
    overrides: TemplateVariantOverrides,
  ) => Promise<void>;
  readonly library: ReturnType<typeof useTitleBlockLibrary>;
}

const ORIGIN_VARIANT: Readonly<
  Record<TitleBlockTermOrigin, 'default' | 'secondary' | 'destructive' | 'outline'>
> = {
  glossary: 'secondary',
  ai: 'default',
  manual: 'outline',
  unknown: 'destructive',
};

/** Μία ετικέτα: πηγή αριστερά, μετάφραση (επεξεργάσιμη) δεξιά, προέλευση ως κονκάρδα. */
function TermRow({
  term,
  translation,
  origin,
  disabled,
  onChange,
}: {
  readonly term: string;
  readonly translation: string;
  readonly origin: TitleBlockTermOrigin;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const inputId = `title-block-term-${term}`;

  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-border py-2">
      <span className="min-w-[10rem] flex-1 text-sm [overflow-wrap:anywhere]">{term}</span>
      <Badge variant={ORIGIN_VARIANT[origin]}>{t(`titleBlockLocalize.origin.${origin}`)}</Badge>
      <Label htmlFor={inputId} className="sr-only">
        {t('titleBlockLocalize.translationOf', { term })}
      </Label>
      <Input
        id={inputId}
        className="min-w-[12rem] flex-1"
        value={translation}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('titleBlockLocalize.pendingPlaceholder')}
        disabled={disabled}
      />
    </li>
  );
}

export function TitleBlockLocalizeDialog({
  request,
  onClose,
  onConfirm,
  library,
}: TitleBlockLocalizeDialogProps): React.JSX.Element | null {
  if (!request) return null;
  return (
    <LocalizeDialogBody
      request={request}
      onClose={onClose}
      onConfirm={onConfirm}
      library={library}
    />
  );
}

/** Ξεχωριστό σώμα ώστε τα hooks να τρέχουν **μόνο** με ενεργό αίτημα (καθαρό state κάθε φορά). */
function LocalizeDialogBody({
  request,
  onClose,
  onConfirm,
  library,
}: TitleBlockLocalizeDialogProps & {
  readonly request: TitleBlockLocalizeRequest;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { source, target, mode } = request;
  const from = sourceLocaleOf(source, target);
  const localize = useTitleBlockLocalize(source, from, target);

  const [name, setName] = React.useState(() =>
    t('titleBlockLocalize.variantName', {
      name: source.name,
      locale: target.toUpperCase(),
    }),
  );

  const busy = library.busy || localize.translating;

  const confirm = async (): Promise<void> => {
    await onConfirm(request, name, localize.buildOverrides());
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`titleBlockLocalize.title.${mode}`)}</DialogTitle>
          <DialogDescription>
            {t(`titleBlockLocalize.description.${mode}`, {
              name: source.name,
              language: t(`titleBlockLocalize.language.${target}`),
            })}
          </DialogDescription>
        </DialogHeader>

        {mode === 'create' && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="title-block-variant-name">{t('titleBlockLocalize.name')}</Label>
            <Input
              id="title-block-variant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </div>
        )}

        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t('titleBlockLocalize.terms')}
          </h3>
          <ul className="flex max-h-64 flex-col overflow-y-auto">
            {localize.rows.map((row) => (
              <TermRow
                key={row.term}
                term={row.term}
                translation={row.translation}
                origin={row.origin}
                disabled={busy}
                onChange={(value) => localize.setTranslation(row.term, value)}
              />
            ))}
          </ul>
          {localize.translating && (
            <p className="text-xs text-muted-foreground">{t('titleBlockLocalize.translating')}</p>
          )}
          {!localize.translating && localize.pendingCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('titleBlockLocalize.pending', { count: localize.pendingCount })}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t('titleBlockLocalize.preview')}
          </h3>
          <pre className="max-h-40 overflow-auto rounded border border-border bg-muted p-2 text-xs [overflow-wrap:anywhere] whitespace-pre-wrap">
            {localize.preview.join('\n')}
          </pre>
        </section>

        {library.error && (
          <p role="alert" className="text-sm text-destructive">
            {library.error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={library.busy}>
            {t('titleBlockLocalize.cancel')}
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || !name.trim()}>
            {t(`titleBlockLocalize.confirm.${mode}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
