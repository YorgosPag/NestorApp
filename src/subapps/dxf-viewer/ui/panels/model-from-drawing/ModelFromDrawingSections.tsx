'use client';

/**
 * ADR-911 Φ3β — τα τμήματα του πάνελ «Μοντέλο από το σχέδιο». Καθαρή παρουσίαση: δεν διαβάζουν
 * store, δεν γράφουν σκηνή· ό,τι αποφασίζει ο άνθρωπος φεύγει προς τα πάνω ως callback.
 *
 * @see ./ModelFromDrawingPanel.tsx (η σύνθεση)
 */

import * as React from 'react';
import { Check, CircleAlert, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WallCategory } from '../../../bim/types/wall-types';
import type {
  WallProposal,
  WallProposalItem,
  WallProposalStatus,
  WallThicknessGroup,
} from '../../../bim/model-from-drawing/wall-proposal';
import { countProposalByStatus } from '../../../bim/model-from-drawing/assistant-preview';
import {
  ASSISTANT_STATUS_ORDER,
  ASSISTANT_STATUS_TONE,
} from '../../../systems/model-from-drawing/assistant-status-tone';
import { PREVIEW_ZONE_STYLE, type PreviewZoneTone } from '../../../systems/region-preview/preview-zone-style';

/** Το `t` όπως το χρειάζεται το πάνελ: κλειδί + παράμετροι ICU. Το δίνει ο `useTranslation` του έργου. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

const CATEGORY_VALUES: readonly WallCategory[] = ['exterior', 'interior', 'partition', 'parapet', 'fence'];

const STATUS_LABEL_KEY: Readonly<Record<WallProposalStatus, string>> = {
  ready: 'modelFromDrawing.status.ready',
  'needs-decision': 'modelFromDrawing.status.needs-decision',
  existing: 'modelFromDrawing.status.existing',
  rejected: 'modelFromDrawing.status.rejected',
};

export const SECTION_TITLE = 'm-0 text-xs font-semibold text-foreground';
export const MUTED = 'm-0 text-[11px] text-muted-foreground';

/** Δείγμα γραμμής ενός τόνου — το ΙΔΙΟ χρώμα και μοτίβο με τον καμβά (ένα SSoT, δύο αναγνώστες). */
export function ToneSwatch({ tone }: { readonly tone: PreviewZoneTone }): React.ReactElement {
  const style = PREVIEW_ZONE_STYLE[tone];
  return (
    <svg width="30" height="10" viewBox="0 0 30 10" className="shrink-0" aria-hidden="true">
      <line
        x1="1" y1="5" x2="29" y2="5"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.dash ?? undefined}
      />
    </svg>
  );
}

/** Το χρώμα-ρόλος που έδειξε ο άνθρωπος. SVG, όχι inline style (N.3): το χρώμα είναι δεδομένο. */
export function ColorChip({ hex }: { readonly hex: string }): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="12" height="12" rx="2" fill={hex} stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Υπόμνημα + πλήθη: κάθε κατάσταση με το μοτίβο γραμμής της. */
export function StatusLegend({ proposal, t }: { readonly proposal: WallProposal; readonly t: Translate }): React.ReactElement {
  const counts = countProposalByStatus(proposal);
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="mfd-legend">
      {ASSISTANT_STATUS_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-2 text-xs text-foreground" data-status={status}>
          <ToneSwatch tone={ASSISTANT_STATUS_TONE[status]} />
          <span className="flex-1">{t(STATUS_LABEL_KEY[status])}</span>
          <span className="font-mono">{counts[status]}</span>
        </li>
      ))}
    </ul>
  );
}

interface GroupRowProps {
  readonly group: WallThicknessGroup;
  readonly onConfirm: (thicknessMm: number, category: WallCategory) => void;
  readonly t: Translate;
}

function GroupRow({ group, onConfirm, t }: GroupRowProps): React.ReactElement {
  const { thicknessMm, category, confirmed } = group;
  const label = t('modelFromDrawing.groups.category', { thicknessMm });
  return (
    <li className="flex flex-col gap-1 py-1.5" data-testid="mfd-group" data-confirmed={confirmed}>
      <p className="m-0 flex items-center gap-1.5 text-xs text-foreground">
        {confirmed
          ? <Check className="size-3.5 shrink-0" aria-hidden="true" />
          : <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />}
        <span className="flex-1">{t('modelFromDrawing.groups.row', { thicknessMm, count: group.keys.length })}</span>
        <span className="text-[11px] text-muted-foreground">
          {confirmed ? t('modelFromDrawing.groups.confirmed') : t('modelFromDrawing.groups.pending')}
        </span>
      </p>
      <p className={MUTED}>
        {t('modelFromDrawing.groups.topology', { exterior: group.exteriorCount, interior: group.interiorCount })}
      </p>
      <p className="m-0 flex items-center gap-1.5">
        <Select value={category} onValueChange={(v) => onConfirm(thicknessMm, v as WallCategory)}>
          <SelectTrigger size="sm" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[9rem]">
            {CATEGORY_VALUES.map((c) => (
              <SelectItem key={c} value={c} className="whitespace-nowrap">
                {t(`ribbon.commands.wallEditor.category.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!confirmed && (
          <Button type="button" variant="outline" size="xs" onClick={() => onConfirm(thicknessMm, category)}>
            {t('modelFromDrawing.groups.confirm')}
          </Button>
        )}
      </p>
    </li>
  );
}

/** Δ3 — μία απόφαση ανά ομάδα πάχους. Η πρόταση της τοπολογίας φαίνεται, δεν εφαρμόζεται σιωπηλά. */
export function GroupsSection(props: {
  readonly groups: readonly WallThicknessGroup[];
  readonly onConfirm: (thicknessMm: number, category: WallCategory) => void;
  readonly t: Translate;
}): React.ReactElement | null {
  if (props.groups.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5">
      <h4 className={SECTION_TITLE}>{props.t('modelFromDrawing.groups.title')}</h4>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {props.groups.map((group) => (
          <GroupRow key={group.thicknessMm} group={group} onConfirm={props.onConfirm} t={props.t} />
        ))}
      </ul>
    </section>
  );
}

interface DecisionRowProps {
  readonly item: WallProposalItem;
  readonly accepted: boolean;
  readonly focused: boolean;
  readonly onSetUndecided: (key: string, isWall: boolean) => void;
  readonly onFocus: (key: string) => void;
  readonly t: Translate;
}

function DecisionRow({ item, accepted, focused, onSetUndecided, onFocus, t }: DecisionRowProps): React.ReactElement {
  const dims = t('modelFromDrawing.decisions.item', {
    longMm: item.lengthMm,
    shortMm: item.thicknessMm,
  });
  return (
    <li className="flex items-center gap-1.5 py-1" data-testid="mfd-decision" data-focused={focused}>
      <Button
        type="button" variant={focused ? 'secondary' : 'ghost'} size="icon-sm"
        aria-label={t('modelFromDrawing.decisions.focus')} onClick={() => onFocus(item.key)}
      >
        <Crosshair className="size-3.5" aria-hidden="true" />
      </Button>
      <span className="flex-1 font-mono text-[11px] text-foreground">{dims}</span>
      <Button
        type="button" variant={accepted ? 'default' : 'outline'} size="xs"
        aria-pressed={accepted} onClick={() => onSetUndecided(item.key, !accepted)}
      >
        {t('modelFromDrawing.decisions.isWall')}
      </Button>
    </li>
  );
}

/** Δ7 — ορθογώνια χωρίς προφανή άξονα: γίνονται τοίχοι ΜΟΝΟ αν το πει ο άνθρωπος (και ξεγίνονται). */
export function DecisionsSection(props: {
  readonly proposal: WallProposal;
  readonly acceptedKeys: ReadonlySet<string>;
  readonly focusedKey: string | null;
  readonly onSetUndecided: (key: string, isWall: boolean) => void;
  readonly onFocus: (key: string) => void;
  readonly t: Translate;
}): React.ReactElement | null {
  const { proposal, acceptedKeys, focusedKey, t } = props;
  const items = proposal.items.filter((i) => i.status === 'needs-decision' || acceptedKeys.has(i.key));
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.decisions.title')}</h4>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <DecisionRow
            key={item.key} item={item} accepted={acceptedKeys.has(item.key)} focused={item.key === focusedKey}
            onSetUndecided={props.onSetUndecided} onFocus={props.onFocus} t={t}
          />
        ))}
      </ul>
    </section>
  );
}

/** Όσα κόπηκαν, με τον λόγο τους — και εστίαση, γιατί «κάπου υπάρχει ένα κόκκινο» δεν αρκεί. */
export function RejectedSection(props: {
  readonly proposal: WallProposal;
  readonly focusedKey: string | null;
  readonly onFocus: (key: string) => void;
  readonly t: Translate;
}): React.ReactElement | null {
  const { t } = props;
  const items = props.proposal.items.filter((i) => i.status === 'rejected');
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.rejected.title')}</h4>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5 py-1" data-testid="mfd-rejected">
            <Button
              type="button" variant={item.key === props.focusedKey ? 'secondary' : 'ghost'} size="icon-sm"
              aria-label={t('modelFromDrawing.decisions.focus')} onClick={() => props.onFocus(item.key)}
            >
              <Crosshair className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="flex-1 text-[11px] text-foreground">{item.reason ? t(item.reason) : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Αναφορά κάλυψης (Α-2): τι από το σχέδιο εξηγήθηκε. Ανεξήγητες γραμμές ⇒ ρητή προειδοποίηση. */
export function CoverageSection({ proposal, t }: { readonly proposal: WallProposal; readonly t: Translate }): React.ReactElement {
  const { explainedIds, unexplainedIds, ignoredCount } = proposal.coverage;
  return (
    <section className="flex flex-col gap-0.5" data-testid="mfd-coverage">
      <p className={MUTED}>
        {t('modelFromDrawing.coverage.summary', {
          explained: explainedIds.length,
          unexplained: unexplainedIds.length,
          ignored: ignoredCount,
        })}
      </p>
      {unexplainedIds.length > 0 && (
        <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" role="status">
          <ToneSwatch tone="reject" />
          {t('modelFromDrawing.coverage.unexplainedHint')}
        </p>
      )}
    </section>
  );
}
