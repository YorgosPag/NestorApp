'use client';

/**
 * **Πρόταση μετάφρασης μιας έκδοσης** (ADR-928 §5.2.2 · Φ3γ-0): ο άνθρωπος γράφει **μόνο κείμενο**· κάθε παράμετρος
 * μένει **κλειδωμένη** στη θέση του ελληνικού. Το «ίδιο σύνολο παραμέτρων» που κρίνει ο γραφέας τηρείται με κατασκευή,
 * όχι με έλεγχο μετά.
 *
 * 🔑 Αφετηρία: η υπάρχουσα μετάφραση αν έχει το ίδιο σχήμα (μπαγιάτικη μετά από αλλαγή διατύπωσης — η δουλειά δεν
 *    χάνεται), αλλιώς το ελληνικό (`translationSeedOf`). Δίπλα σε κάθε μπλοκ το ελληνικό όπως τυπώνεται.
 * 🔑 Η μετάφραση εγκρίνεται από **άλλον** (`translationApprovalBlock`), όχι από όποιον την πρότεινε.
 */

import { useId, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { translationSeedOf, withInlineText, type InlinePosition } from '@/subapps/procurement/subcontracts/library/translation-status';
import type { ClauseBody, ClauseInline, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import type { LibraryActions } from './useLibraryActions';

interface TranslationEditorDialogProps {
  readonly version: SubcontractClauseVersion;
  readonly language: string;
  readonly languageName: string;
  readonly actions: LibraryActions;
  readonly onClose: () => void;
}

interface RunEditorProps {
  readonly run: readonly ClauseInline[];
  readonly at: Omit<InlinePosition, 'inline'>;
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly language: string;
  readonly onText: (position: InlinePosition, text: string) => void;
}

function RunEditor({ run, at, parameters, language, onText }: RunEditorProps) {
  const { t } = useTranslation('procurement');
  return (
    <span className="flex flex-wrap items-start gap-1">
      {run.map((inline, index) => {
        if (inline.kind === 'text') {
          return <Textarea key={index} value={inline.text} rows={2} className="min-w-[12rem] flex-1" aria-label={t('subcontracts.library.translations.segment')} onChange={(event) => onText({ ...at, inline: index }, event.target.value)} />;
        }
        const label = parameters.find((parameter) => parameter.key === inline.key)?.label;
        return (
          <span key={index} className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs">
            <Lock className="h-3 w-3" aria-hidden />
            <span className="sr-only">{t('subcontracts.library.translations.locked')}</span>
            {label ? localizedIn(label, language) : inline.key}
          </span>
        );
      })}
    </span>
  );
}

function BodyEditor({ body, original, version, language, onChange }: { readonly body: ClauseBody; readonly original: ClauseBody; readonly version: SubcontractClauseVersion; readonly language: string; readonly onChange: (body: ClauseBody) => void }) {
  const onText = (position: InlinePosition, text: string) => onChange(withInlineText(body, position, text));
  const greekOf = (run: readonly ClauseInline[]) => run.map((inline) => (inline.kind === 'text' ? inline.text : `[${inline.key}]`)).join('');
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {body.blocks.map((block, blockIndex) => {
        const greek = original.blocks[blockIndex];
        const runs = block.kind === 'paragraph' ? [{ run: block.inlines, item: null }] : block.items.map((run, item) => ({ run, item }));
        const greekRuns = greek.kind === 'paragraph' ? [greek.inlines] : greek.items;
        return (
          <li key={blockIndex} className="space-y-2 rounded-md border p-2">
            {runs.map(({ run, item }, runIndex) => (
              <span key={runIndex} className="flex flex-col gap-1">
                <span lang="el" className="text-xs text-muted-foreground">{greekOf(greekRuns[runIndex] ?? [])}</span>
                <RunEditor run={run} at={{ block: blockIndex, item }} parameters={version.parameters} language={language} onText={onText} />
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}

export default function TranslationEditorDialog({ version, language, languageName, actions, onClose }: TranslationEditorDialogProps) {
  const { t } = useTranslation('procurement');
  const headingId = useId();
  const [body, setBody] = useState<ClauseBody>(() => translationSeedOf(version.body, version.translations[language]?.body ?? null));
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    if (await actions.proposeTranslation(version, language, body)) onClose();
    else setSending(false);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('subcontracts.library.translations.editorTitle', { language: languageName, version: version.version })}</DialogTitle>
          <DialogDescription>{t('subcontracts.library.translations.editorDescription')}</DialogDescription>
        </DialogHeader>
        <span className="flex flex-col gap-1.5">
          <Label htmlFor={headingId}>{t('subcontracts.library.translations.heading')}</Label>
          <span lang="el" className="text-xs text-muted-foreground">{version.body.heading}</span>
          <Input id={headingId} value={body.heading} onChange={(event) => setBody({ ...body, heading: event.target.value })} />
        </span>
        <BodyEditor body={body} original={version.body} version={version} language={language} onChange={setBody} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={onClose}>{t('subcontracts.editor.deviations.dialog.cancel')}</Button>
          <Button type="button" disabled={sending} onClick={() => void send()}>{t('subcontracts.library.translations.send')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
