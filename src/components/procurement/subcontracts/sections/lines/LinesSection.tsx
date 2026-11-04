'use client';

/**
 * **Γραμμές (schedule of values)** — γενική ενότητα (ADR-928 §5.4 · Φ3γ-2 αποφάσεις 1 και 5): ίδια για συμφωνητικό
 * (`path="lines"`) και πρότυπο (Φ3γ-0b).
 *
 * 🔑 Αναδιάταξη με το ΕΝΑ `SortableList` (ποντίκι, αφή, πληκτρολόγιο, ανακοινώσεις). Η νέα σειρά επιστρέφει από τα
 *    δεδομένα (`reorderByMove`). Το id μένει ίδιο, γιατί σε αυτό δένουν αναθεωρήσεις και πιστοποιήσεις.
 * 🔑 Νέα γραμμή και διπλασιασμός παίρνουν id από το `enterprise-id.service` (N.6).
 * 🔑 Αφαίρεση γραμμής που δείχνει κάποιος όρος (ελάχιστη απόδοση) ζητά επιβεβαίωση. Ο όρος **δεν** σβήνεται σιωπηλά: μένει
 *    και ο κριτής τον λέει ορφανό, στη θέση του.
 * 🔑 Ειλικρινές σύνολο (`estimatedAgreementValue`): γραμμές χωρίς ποσότητα δεν μετρούν ως μηδέν. Λέγεται «τουλάχιστον».
 */

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { removeAt, replaceAt } from '@/lib/array-utils';
import { generateSubcontractAgreementLineId } from '@/services/enterprise-id-convenience';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { estimatedAgreementValue } from '@/subapps/procurement/subcontracts/lines/line-amount';
import { duplicateLine, newAgreementLine } from '@/subapps/procurement/subcontracts/lines/line-edits';
import type { AgreementLine } from '@/subapps/procurement/subcontracts/types/agreement-line';
import { FieldIssues } from '../../editor/FieldIssues';
import type { SectionProps } from '../section-types';
import { LineCard } from './LineCard';

export interface LinesSectionProps extends SectionProps<readonly AgreementLine[]> {
  /** Γραμμές που δείχνει κάποιος όρος (π.χ. ελάχιστη απόδοση) — η αφαίρεσή τους ζητά επιβεβαίωση. */
  readonly referencedLineIds: ReadonlySet<string>;
}

function LinesTotal({ lines, language }: { readonly lines: readonly AgreementLine[]; readonly language: LinesSectionProps['language'] }) {
  const { t } = useTranslation('procurement');
  if (lines.length === 0) return null;
  const { amount, unpricedLines } = estimatedAgreementValue(lines);
  const money = documentLocaleOf(language).money(amount);
  return (
    <p className="text-sm font-medium">
      {unpricedLines > 0
        ? t('subcontracts.sections.lines.totalLowerBound', { amount: money, count: unpricedLines })
        : t('subcontracts.sections.lines.total', { amount: money })}
    </p>
  );
}

function useLineRemoval({ value, onChange, referencedLineIds }: LinesSectionProps) {
  const { t } = useTranslation('procurement');
  const { confirm, dialogProps } = useConfirmDialog();
  const remove = async (index: number) => {
    const line = value[index];
    if (referencedLineIds.has(line.id)) {
      const position = index + 1;
      const ok = await confirm({ title: t('subcontracts.sections.lines.removeReferencedTitle', { position }), description: t('subcontracts.sections.lines.removeReferenced'), confirmText: t('subcontracts.sections.lines.remove', { position }), variant: 'destructive' });
      if (!ok) return;
    }
    onChange(removeAt(value, index));
  };
  return { remove, dialogProps };
}

export function LinesSection(props: LinesSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, path, issues, language } = props;
  const { remove, dialogProps } = useLineRemoval(props);
  const indexOf = new Map(value.map((line, index) => [line.id, index]));
  const add = () => onChange([...value, newAgreementLine(generateSubcontractAgreementLineId(), value.at(-1)?.unit ?? PROCUREMENT_UNIT_OPTIONS[0])]);
  return (
    <section aria-labelledby="editor-lines" className="space-y-3">
      <h3 id="editor-lines" className="text-base font-semibold">{t('subcontracts.sections.lines.title')}</h3>
      {value.length === 0 && <p className="text-sm text-muted-foreground">{t('subcontracts.sections.lines.empty')}</p>}
      <SortableList
        items={value} getId={(line) => line.id} ariaLabel={t('subcontracts.sections.lines.title')}
        getLabel={(line) => localizedIn(line.description, language) || t('subcontracts.sections.lines.position', { position: (indexOf.get(line.id) ?? 0) + 1 })}
        onMove={(move) => onChange(reorderByMove(value, (line) => line.id, move))}
        className="space-y-3"
        renderItem={(line, handle) => {
          const index = indexOf.get(line.id) ?? 0;
          return (
            <LineCard {...props} value={line} index={index} path={joinPath(path, index)} handle={handle}
              onChange={(next) => onChange(replaceAt(value, index, next))}
              onDuplicate={() => onChange([...value.slice(0, index + 1), duplicateLine(line, generateSubcontractAgreementLineId()), ...value.slice(index + 1)])}
              onRemove={() => void remove(index)} />
          );
        }}
      />
      <FieldIssues issues={issuesAt(issues, path)} />
      <LinesTotal lines={value} language={language} />
      <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.sections.lines.add')}</Button>
      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
