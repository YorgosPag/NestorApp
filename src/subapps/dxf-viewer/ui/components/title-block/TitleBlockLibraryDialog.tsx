'use client';

/**
 * ADR-651 Φάση Θ — διάλογος **«Βιβλιοθήκη Προτύπων Πινακίδας»** (must-have #5 + #1).
 *
 * Το μοντέλο που βλέπει ο χρήστης είναι το μοντέλο των ηγετών (ArchiCAD *Master Layout*,
 * Revit *office content*):
 *
 *  - Αποθηκεύει την πινακίδα που έχει **αυτή τη στιγμή** ως πρότυπο **γραφείου** ⇒ ταξιδεύει
 *    σε κάθε έργο του.
 *  - Τα έργα **δείχνουν** στο πρότυπο του γραφείου. Το διορθώνει μία φορά ⇒ ενημερώνονται όλα
 *    (η ζωντανή συνδρομή του `TitleBlockLibraryHost` το φέρνει χωρίς refresh).
 *  - Αν ένα έργο χρειάζεται παραλλαγή, την **αποσπά** ρητά — και **ποτέ** δεν του αλλάζει
 *    κάτι πισώπλατα. Όταν το γραφείο αλλάξει το master, εμφανίζεται κονκάρδα «διαθέσιμη
 *    ενημέρωση» και ο χρήστης **επιλέγει** να την τραβήξει.
 *
 * N.11: μηδέν σταθερή συμβολοσειρά — όλα από `titleBlockLibrary.*`. ADR-040: μηδέν canvas
 * subscriptions (ο store της βιβλιοθήκης είναι low-frequency).
 *
 * @see ./useTitleBlockLibrary.ts — το state + οι τέσσερις ενέργειες
 * @see ../../../text-engine/templates/template-inheritance.ts — γιατί απόσπαση και όχι overrides
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TemplateVariantOverrides } from '../../../text-engine/templates/template-inheritance';
import {
  WRITABLE_TEXT_TEMPLATE_SCOPES,
  type TextTemplate,
  type WritableTextTemplateScope,
} from '../../../text-engine/templates/template.types';
import {
  hasTitleBlockVariant,
  titleBlockTemplateLocale,
} from '../../../text-engine/title-block/localization/title-block-variant';
import {
  toTitleBlockLocale,
  type TitleBlockLocale,
} from '../../../text-engine/title-block/title-block-presets';
import {
  TitleBlockLocalizeDialog,
  type TitleBlockLocalizeRequest,
} from './TitleBlockLocalizeDialog';
import { sourceLocaleOf } from './useTitleBlockLocalize';
import { useTitleBlockLibrary, type TitleBlockLibraryRow } from './useTitleBlockLibrary';

export interface TitleBlockLibraryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly projectId?: string;
}

interface RowProps {
  readonly row: TitleBlockLibraryRow;
  readonly library: ReturnType<typeof useTitleBlockLibrary>;
  readonly onLocalize: (request: TitleBlockLocalizeRequest) => void;
}

/**
 * ADR-651 Φάση Κ — η γλώσσα-στόχος μιας παραλλαγής: **η αντίθετη** από τη γλώσσα του προτύπου.
 * Πρότυπο χωρίς δηλωμένη γλώσσα (γραμμένο πριν τη Φάση Κ) θεωρείται στη γλώσσα του χρήστη.
 */
function useVariantTarget(template: TextTemplate): TitleBlockLocale {
  const { i18n } = useTranslation('dxf-viewer-shell');
  const source = titleBlockTemplateLocale(template) ?? toTitleBlockLocale(i18n.language);
  return source === 'el' ? 'en' : 'el';
}

/** Μία γραμμή προτύπου: ταυτότητα (εμβέλεια/προέλευση) αριστερά, ενέργειες δεξιά. */
function TemplateRow({ row, library, onLocalize }: RowProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { template, parent, updateAvailable, isActive } = row;

  const target = useVariantTarget(template);
  const templates = React.useMemo(
    () => library.rows.map((candidate) => candidate.template),
    [library.rows],
  );
  const hasVariant = hasTitleBlockVariant(templates, template, target);

  /**
   * Η **γλωσσική** παραλλαγή δεν τραβά τον γονιό αυτούσιο: θα έγραφε ελληνικά πάνω στα αγγλικά.
   * Περνά από τον ίδιο διάλογο — ξανα-μετάφραση, προεπισκόπηση, έγκριση.
   */
  const isLanguageVariant =
    parent !== null &&
    titleBlockTemplateLocale(template) !== null &&
    titleBlockTemplateLocale(template) !== titleBlockTemplateLocale(parent);

  const pull = (): void => {
    const childLocale = titleBlockTemplateLocale(template);
    if (isLanguageVariant && parent && childLocale) {
      onLocalize({ mode: 'update', source: parent, target: childLocale, row });
      return;
    }
    void library.pull(row);
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium [overflow-wrap:anywhere]">{template.name}</span>
          <Badge variant="secondary">
            {t(`titleBlockLibrary.scope.${template.scope ?? 'company'}`)}
          </Badge>
          {isActive && <Badge>{t('titleBlockLibrary.active')}</Badge>}
          {updateAvailable && (
            <Badge variant="destructive">{t('titleBlockLibrary.updateAvailable')}</Badge>
          )}
        </div>
        {parent && (
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {t('titleBlockLibrary.detachedFrom', { name: parent.name })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {updateAvailable && (
          <Button size="sm" onClick={pull} disabled={library.busy}>
            {t('titleBlockLibrary.actions.pull')}
          </Button>
        )}
        {!isActive && (
          <Button size="sm" variant="outline" onClick={() => library.activate(template)}>
            {t('titleBlockLibrary.actions.use')}
          </Button>
        )}
        {!hasVariant && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onLocalize({ mode: 'create', source: template, target })}
            disabled={library.busy || !library.canWrite}
          >
            {t(`titleBlockLibrary.actions.localize.${target}`)}
          </Button>
        )}
        {template.scope !== 'company' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void library.publishToCompany(template)}
            disabled={library.busy}
          >
            {t('titleBlockLibrary.actions.publish')}
          </Button>
        )}
        {library.hasProject && template.scope !== 'project' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void library.detachToProject(
                template,
                t('titleBlockLibrary.detachedName', { name: template.name }),
              )
            }
            disabled={library.busy}
          >
            {t('titleBlockLibrary.actions.detach')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void library.remove(template)}
          disabled={library.busy}
        >
          {t('titleBlockLibrary.actions.delete')}
        </Button>
      </div>
    </li>
  );
}

/** «Αποθήκευση της πινακίδας που βλέπω τώρα» — όνομα + πού θα ζήσει. */
function SaveActiveForm({
  library,
}: {
  readonly library: ReturnType<typeof useTitleBlockLibrary>;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const [name, setName] = React.useState('');
  const [scope, setScope] = React.useState<WritableTextTemplateScope>('company');

  const scopes = library.hasProject
    ? WRITABLE_TEXT_TEMPLATE_SCOPES
    : WRITABLE_TEXT_TEMPLATE_SCOPES.filter((candidate) => candidate !== 'project');

  const submit = async (): Promise<void> => {
    await library.saveActive(name, scope);
    setName('');
  };

  return (
    <section className="flex flex-col gap-2 rounded border border-border bg-card p-3">
      <h3 className="text-xs font-medium text-muted-foreground">
        {t('titleBlockLibrary.save.title')}
      </h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="title-block-library-name">{t('titleBlockLibrary.save.name')}</Label>
          <Input
            id="title-block-library-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('titleBlockLibrary.save.placeholder')}
            disabled={library.busy || !library.canWrite}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="title-block-library-scope">{t('titleBlockLibrary.save.scope')}</Label>
          <Select
            value={scope}
            onValueChange={(next) => setScope(next as WritableTextTemplateScope)}
          >
            <SelectTrigger id="title-block-library-scope" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {t(`titleBlockLibrary.scope.${candidate}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => void submit()}
          disabled={library.busy || !library.canWrite || !name.trim()}
        >
          {t('titleBlockLibrary.save.action')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('titleBlockLibrary.save.hint')}</p>
    </section>
  );
}

export function TitleBlockLibraryDialog({
  open,
  onOpenChange,
  projectId,
}: TitleBlockLibraryDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const library = useTitleBlockLibrary(projectId);
  const [localizeRequest, setLocalizeRequest] = React.useState<TitleBlockLocalizeRequest | null>(
    null,
  );

  /**
   * Η έγκριση της μεταγλώττισης — **μία** διαδρομή εγγραφής, δύο ρόλοι: νέα παραλλαγή
   * (απόσπαση με μεταφρασμένο περιεχόμενο) ή ενημέρωση υπάρχουσας από τον γονιό της
   * (pull με ξανα-μεταφρασμένο περιεχόμενο). Μηδέν νέο data path (N.18).
   */
  const confirmLocalize = React.useCallback(
    async (
      request: TitleBlockLocalizeRequest,
      name: string,
      overrides: TemplateVariantOverrides,
    ): Promise<void> => {
      if (request.mode === 'update' && request.row) {
        await library.pull(request.row, overrides);
        return;
      }
      await library.createVariant(
        request.source,
        name,
        sourceLocaleOf(request.source, request.target),
        overrides,
      );
    },
    [library],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('titleBlockLibrary.title')}</DialogTitle>
          <DialogDescription>{t('titleBlockLibrary.description')}</DialogDescription>
        </DialogHeader>

        <SaveActiveForm library={library} />

        {library.error && (
          <p role="alert" className="text-sm text-destructive">
            {library.error}
          </p>
        )}

        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t('titleBlockLibrary.list.title')}
          </h3>
          {library.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('titleBlockLibrary.list.empty')}</p>
          ) : (
            <ul className="flex flex-col">
              {library.rows.map((row) => (
                <TemplateRow
                  key={row.template.id}
                  row={row}
                  library={library}
                  onLocalize={setLocalizeRequest}
                />
              ))}
            </ul>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={library.busy}>
            {t('titleBlockLibrary.close')}
          </Button>
        </DialogFooter>

        <TitleBlockLocalizeDialog
          request={localizeRequest}
          onClose={() => setLocalizeRequest(null)}
          onConfirm={confirmLocalize}
          library={library}
        />
      </DialogContent>
    </Dialog>
  );
}
