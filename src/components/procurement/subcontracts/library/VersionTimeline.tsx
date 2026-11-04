'use client';

/**
 * **Το χρονολόγιο μιας ρήτρας** — κάθε έκδοση με κατάσταση, ποιος πρότεινε, ποιος αποφάσισε, πότε και γιατί — και
 * **σύγκριση οποιωνδήποτε δύο** εκδόσεων (ADR-928 Φ3γ-0 · SAP Ariba: ιστορικό εκδόσεων).
 *
 * 🔑 Οι εκδόσεις είναι **αμετάβλητες** (§5.6): ό,τι φαίνεται εδώ είναι ό,τι ίσχυε. Η σύγκριση είναι ο **ίδιος**
 *    `ClauseVersionDiffView` με την ουρά ελέγχου, άρα η ίδια αλλαγή λέγεται με την ίδια λέξη και στα δύο σημεία.
 * 🔑 Προεπιλογή σύγκρισης: η νεότερη με την αμέσως προηγούμενη — η ερώτηση «τι άλλαξε τελευταία».
 */

import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate, formatDate } from '@/lib/intl-utils';
import type { SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import { ClauseVersionDiffView } from './ClauseVersionDiffView';
import { LEGAL_REVIEW_VARIANT, VERSION_STATE_VARIANT } from './library-labels';
import { usePersonLabels } from './usePersonLabels';

function TimelineRow({ version, person }: { readonly version: SubcontractClauseVersion; readonly person: (uid: string | null) => string }) {
  const { t } = useTranslation('procurement');
  const decided = version.decidedBy !== null;
  return (
    <li className="space-y-1 border-l-2 py-1 pl-3">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
        <strong className="font-semibold">{t('subcontracts.library.version.label', { version: version.version })}</strong>
        <Badge variant={VERSION_STATE_VARIANT[version.state]}>{t(`subcontracts.library.version.state.${version.state}`)}</Badge>
        {version.state !== 'proposed' && <Badge variant={LEGAL_REVIEW_VARIANT[version.professionalReview]}>{t(`subcontracts.library.legal.${version.professionalReview}`)}</Badge>}
        {version.effectiveFrom && <span className="text-xs text-muted-foreground">{t('subcontracts.library.version.effectiveFrom', { date: formatCalendarDate(version.effectiveFrom) })}</span>}
      </p>
      <p className="m-0 text-xs text-muted-foreground">
        {t('subcontracts.library.history.proposed', { name: person(version.proposedBy), date: formatDate(version.createdAt) })}
        {decided && ` · ${t('subcontracts.library.history.decided', { name: person(version.decidedBy), date: formatDate(version.decidedAt ?? '') })}`}
        {version.reviewedBy && ` · ${t('subcontracts.library.history.reviewed', { name: person(version.reviewedBy) })}`}
      </p>
      {version.proposalReason && <p className="m-0 text-sm">{version.proposalReason}</p>}
      {version.decisionReason && <p className="m-0 text-sm text-muted-foreground">{version.decisionReason}</p>}
    </li>
  );
}

function VersionPicker({ label, value, versions, onChange }: { readonly label: string; readonly value: number; readonly versions: readonly SubcontractClauseVersion[]; readonly onChange: (value: number) => void }) {
  const { t } = useTranslation('procurement');
  const id = useId();
  return (
    <span className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger id={id} className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {versions.map((version) => <SelectItem key={version.version} value={String(version.version)}>{t('subcontracts.library.version.label', { version: version.version })}</SelectItem>)}
        </SelectContent>
      </Select>
    </span>
  );
}

function VersionCompare({ versions }: { readonly versions: readonly SubcontractClauseVersion[] }) {
  const { t } = useTranslation('procurement');
  const [after, setAfter] = useState(versions[0].version);
  const [before, setBefore] = useState(versions[1].version);
  const find = (number: number) => versions.find((version) => version.version === number) ?? null;
  const afterVersion = find(after) ?? versions[0];
  return (
    <section aria-label={t('subcontracts.library.history.compare')} className="space-y-3">
      <span className="flex flex-wrap items-end gap-3">
        <VersionPicker label={t('subcontracts.library.history.compareFrom')} value={before} versions={versions} onChange={setBefore} />
        <VersionPicker label={t('subcontracts.library.history.compareTo')} value={after} versions={versions} onChange={setAfter} />
      </span>
      <ClauseVersionDiffView before={find(before)} after={afterVersion} />
    </section>
  );
}

export function VersionTimeline({ versions }: { readonly versions: readonly SubcontractClauseVersion[] }) {
  const { t } = useTranslation('procurement');
  const person = usePersonLabels(versions.flatMap((version) => [version.proposedBy, version.decidedBy, version.reviewedBy]));
  if (versions.length === 0) return <p className="text-sm text-muted-foreground">{t('subcontracts.library.history.none')}</p>;
  return (
    <section className="space-y-4">
      <ol className="m-0 list-none space-y-2 p-0">{versions.map((version) => <TimelineRow key={version.id} version={version} person={person} />)}</ol>
      {versions.length > 1 && <VersionCompare versions={versions} />}
    </section>
  );
}
