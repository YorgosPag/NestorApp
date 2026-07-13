'use client';

/**
 * ADR-651 Φάση Δ — διάλογος «AI Πινακίδα Σχεδίου».
 *
 * Δύο ροές (tabs): **Από εικόνα** (upload στιγμιότυπου/φωτό) και **Από περιγραφή** (φυσική
 * γλώσσα). Το AI παράγει reconciled `TextTemplate` (Απόφαση #5: vector, όχι raster)· ο διάλογος
 * δείχνει **live preview** (ο ίδιος resolver με την οθόνη/PDF, με τα πραγματικά στοιχεία έργου)
 * + **AI έλεγχο συμμόρφωσης** (προειδοποίηση, όχι φραγή). Ο χρήστης το **αποθηκεύει** ως πρότυπο
 * (υπάρχον CRUD) ή το **εισάγει** στη σκηνή (οπλίζει το εργαλείο «Πινακίδα»).
 *
 * Controlled Radix Dialog, ίδιο μοτίβο με το `EngineerStampDialog`. Καμία hardcoded string
 * (N.11): όλα από `aiTitleBlock.*`. ADR-040: μηδέν canvas subscriptions.
 *
 * @see ./useAiTitleBlock.ts — το state του generate/validate/insert/save
 * @see ../../../app/AiTitleBlockHost.tsx — ο lifecycle owner (EventBus gate)
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getActiveScaleName } from '../../../systems/viewport/ViewportStore';
import { getPlaceholderScopeSources } from '../../../text-engine/templates/resolver/placeholder-scope-client';
import { resolveTitleBlockContent } from '../../../text-engine/title-block/title-block-rows';
import { toTitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';
import { useAiTitleBlock, type AiTitleBlockMode } from './useAiTitleBlock';
import type { AiTitleBlockResult } from '../../../text-engine/title-block/ai/ai-title-block-reconcile';

export interface AiTitleBlockDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly projectId?: string;
}

const ACCEPT = 'image/png,image/jpeg,image/webp';

/** Live preview: ο ΙΔΙΟΣ resolver με την οθόνη/PDF, με τα πραγματικά στοιχεία του έργου. */
function TitleBlockPreview({ result }: { readonly result: AiTitleBlockResult }): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const content = React.useMemo(() => {
    const locale = toTitleBlockLocale(result.template.locale);
    const scale = getActiveScaleName();
    return resolveTitleBlockContent(result.template, {
      ...getPlaceholderScopeSources(),
      drawing: scale ? { scale } : {},
      formatting: { locale },
    });
  }, [result]);

  return (
    <figure className="flex flex-col gap-2 rounded border border-border bg-card p-3">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {t('aiTitleBlock.preview.title')}
      </figcaption>
      {content.heading && <p className="text-sm font-semibold">{content.heading}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {content.rows.map((row, index) => (
          <React.Fragment key={`${row.label}-${index}`}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd>{row.value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <footer className="flex flex-wrap items-center gap-2 pt-1">
        <Badge variant="secondary">{t('aiTitleBlock.preview.fields', { count: content.rows.length })}</Badge>
        {result.withStampBox && <Badge variant="secondary">{t('aiTitleBlock.preview.stampBox')}</Badge>}
        {result.droppedPaths.length > 0 && (
          <Badge variant="outline">
            {t('aiTitleBlock.preview.dropped', { count: result.droppedPaths.length })}
          </Badge>
        )}
      </footer>
      {result.notes && <p className="text-xs text-muted-foreground">{result.notes}</p>}
    </figure>
  );
}

/** AI compliance ευρήματα (προειδοποίηση, όχι φραγή). */
function CompliancePanel({
  warnings,
  validating,
}: {
  readonly warnings: ReturnType<typeof useAiTitleBlock>['warnings'];
  readonly validating: boolean;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{t('aiTitleBlock.compliance.title')}</h3>
      {validating ? (
        <p className="text-sm text-muted-foreground">{t('aiTitleBlock.compliance.checking')}</p>
      ) : warnings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aiTitleBlock.compliance.ok')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {warnings.map((warning, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Badge variant={warning.severity === 'warning' ? 'destructive' : 'secondary'}>
                {warning.severity}
              </Badge>
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AiTitleBlockDialog({
  open,
  onOpenChange,
  projectId,
}: AiTitleBlockDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const ai = useAiTitleBlock(projectId);
  const busy = ai.generating || ai.saving;

  const handleFile = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) ai.pickImage(file);
    },
    [ai],
  );

  const handleInsert = React.useCallback(() => {
    ai.insert();
    onOpenChange(false);
  }, [ai, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('aiTitleBlock.title')}</DialogTitle>
          <DialogDescription>{t('aiTitleBlock.description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={ai.mode} onValueChange={(value) => ai.setMode(value as AiTitleBlockMode)}>
          <TabsList>
            <TabsTrigger value="image">{t('aiTitleBlock.tab.image')}</TabsTrigger>
            <TabsTrigger value="text">{t('aiTitleBlock.tab.text')}</TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="flex flex-col gap-2 pt-2">
            <Label>{t('aiTitleBlock.image.label')}</Label>
            <p className="text-xs text-muted-foreground">{t('aiTitleBlock.image.hint')}</p>
            <Button asChild variant="outline" disabled={busy}>
              <label>
                {ai.imageName ? t('aiTitleBlock.image.replace') : t('aiTitleBlock.image.pick')}
                <input type="file" accept={ACCEPT} className="hidden" onChange={handleFile} disabled={busy} />
              </label>
            </Button>
            {ai.imageName && (
              <p className="text-xs text-muted-foreground">
                {t('aiTitleBlock.image.selected')}: {ai.imageName}
              </p>
            )}
            <Button onClick={() => void ai.generate()} disabled={busy || !ai.imageName}>
              {ai.generating ? t('aiTitleBlock.image.analyzing') : t('aiTitleBlock.image.analyze')}
            </Button>
          </TabsContent>

          <TabsContent value="text" className="flex flex-col gap-2 pt-2">
            <Label htmlFor="ai-title-block-prompt">{t('aiTitleBlock.text.label')}</Label>
            <Textarea
              id="ai-title-block-prompt"
              value={ai.prompt}
              onChange={(event) => ai.setPrompt(event.target.value)}
              placeholder={t('aiTitleBlock.text.placeholder')}
              rows={3}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">{t('aiTitleBlock.text.hint')}</p>
            <Button onClick={() => void ai.generate()} disabled={busy || !ai.prompt.trim()}>
              {ai.generating ? t('aiTitleBlock.text.generating') : t('aiTitleBlock.text.generate')}
            </Button>
          </TabsContent>
        </Tabs>

        {ai.errorKey && (
          <p role="alert" className="text-sm text-destructive">
            {t(`aiTitleBlock.errors.${ai.errorKey}`)}
          </p>
        )}

        {ai.result ? (
          <div className="flex flex-col gap-3">
            <TitleBlockPreview result={ai.result} />
            <CompliancePanel warnings={ai.warnings} validating={ai.validating} />
            <div className="flex flex-col gap-1">
              <Label htmlFor="ai-title-block-name">{t('aiTitleBlock.name.label')}</Label>
              <Input
                id="ai-title-block-name"
                value={ai.templateName}
                onChange={(event) => ai.setTemplateName(event.target.value)}
                placeholder={t('aiTitleBlock.name.placeholder')}
                disabled={ai.saving}
              />
              {ai.saved && <p className="text-sm text-muted-foreground">{t('aiTitleBlock.saved')}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('aiTitleBlock.preview.empty')}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => void ai.save()}
            disabled={!ai.result || ai.saving || !ai.templateName.trim()}
          >
            {ai.saving ? t('aiTitleBlock.saving') : t('aiTitleBlock.save')}
          </Button>
          <Button onClick={handleInsert} disabled={!ai.result}>
            {t('aiTitleBlock.insert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
