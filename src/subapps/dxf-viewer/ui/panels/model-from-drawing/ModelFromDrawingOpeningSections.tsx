'use client';

/**
 * ADR-911 Φ4-3β — τα τμήματα **ανοιγμάτων** του πάνελ «Μοντέλο από το σχέδιο». Καθαρή
 * παρουσίαση: δεν διαβάζουν store, δεν γράφουν σκηνή· ό,τι απαντά ο άνθρωπος φεύγει προς τα πάνω.
 *
 * Η λίστα «προς απόφαση» είναι ουρά διαλογής που δουλεύεται με το πληκτρολόγιο:
 *   ↑ / ↓      επόμενο / προηγούμενο στοιχείο — και η όψη το ακολουθεί (Solibri: βέλη + zoom)·
 *   1 · 2 · 3  πόρτα · παράθυρο · τίποτα (ένα πλήκτρο ανά απάντηση)·
 *   0          αναποφάσιστο ξανά·
 *   Shift + ψηφίο  η ίδια απάντηση σε ΟΛΑ τα όμοια.
 * Τα πλήκτρα διαβάζονται από το `event.code` (θέση πλήκτρου), όχι από τον χαρακτήρα: δουλεύουν
 * ίδια σε ελληνική και αγγλική διάταξη, και με Shift πατημένο. Ισχύουν ΜΟΝΟ όσο η εστίαση είναι
 * μέσα στη λίστα — κανένα καθολικό πλήκτρο.
 *
 * ⚠️ ADR-711 — η λίστα είναι `role="listbox"` και κάθε γραμμή `role="option"` ΓΙΑ ΛΟΓΟ: αυτοί οι
 * ρόλοι είναι που κάνουν τους καθολικούς accelerators του viewer να υποχωρούν
 * (`shouldGlobalShortcutYield`). Χωρίς αυτούς, το «1» θα απαντούσε ΚΑΙ θα έτρεχε ό,τι είναι δεμένο
 * στο «1» στον καμβά, και τα βέλη θα μετακινούσαν την επιλογή. Η εστίαση μένει ΠΑΝΤΑ στη γραμμή
 * (τα κουμπιά είναι εκτός Tab και την επιστρέφουν μετά το κλικ): αυτή είναι ο ιδιοκτήτης των πλήκτρων.
 *
 * @see ./ModelFromDrawingPanel.tsx (η σύνθεση)
 * @see ../../../bim/model-from-drawing/opening-review.ts (η λογική της αναθεώρησης)
 */

import * as React from 'react';
import { CircleAlert, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import {
  countOpeningsByStatus,
  type OpeningProposal,
  type OpeningProposalItem,
} from '../../../bim/model-from-drawing/opening-proposal';
import type { OpeningPreview } from '../../../bim/model-from-drawing/opening-preview';
import {
  OPENING_REVIEW_CHOICES,
  canChooseOpening,
  countOpeningReview,
  reviewableOpenings,
  similarOpeningKeys,
  suggestedOpeningChoice,
  type OpeningReviewChoice,
  type OpeningReviewChoices,
} from '../../../bim/model-from-drawing/opening-review';
import {
  OPENING_STATUS_ORDER,
  OPENING_STATUS_TONE,
} from '../../../systems/model-from-drawing/assistant-status-tone';
import {
  OPENING_CHOICE_LABEL_KEY,
  OPENING_REASON_LABEL_KEY,
  OPENING_REFUSAL_LABEL_KEY,
  OPENING_STATUS_LABEL_KEY,
} from '../../../systems/model-from-drawing/opening-label-keys';
import { ColorChip, MUTED, SECTION_TITLE, ToneSwatch, type Translate } from './ModelFromDrawingSections';

export interface OpeningReviewActions {
  /** Οπλίζει το δείγμα «κούφωμα» (πρώτη φορά ή «άλλο δείγμα»). */
  readonly onStartOpenings: () => void;
  /** Η απάντηση για ένα ή περισσότερα στοιχεία· `null` = αναποφάσιστο ξανά. */
  readonly onChooseOpening: (keys: readonly string[], choice: OpeningReviewChoice | null) => void;
  readonly onFocus: (key: string) => void;
  readonly onApproveOpenings: () => void;
}

/** `event.code` → απάντηση. `null` = αναποφάσιστο ξανά. */
const CHOICE_BY_CODE: Readonly<Record<string, OpeningReviewChoice | null>> = {
  Digit1: 'door', Numpad1: 'door',
  Digit2: 'window', Numpad2: 'window',
  Digit3: 'none', Numpad3: 'none',
  Digit0: null, Numpad0: null,
};

/** Το βήμα «κουφώματα» πριν από το δείγμα: ένα κουμπί και τι πρόκειται να συμβεί. */
export function OpeningsStart({ onStart, t }: { readonly onStart: () => void; readonly t: Translate }): React.ReactElement {
  return (
    <section className="flex flex-col gap-1" data-testid="mfd-openings-start">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.openings.title')}</h4>
      <p className={MUTED}>{t('modelFromDrawing.openings.startHint')}</p>
      <Button type="button" variant="outline" size="xs" onClick={onStart} data-testid="mfd-openings-arm">
        {t('modelFromDrawing.openings.start')}
      </Button>
    </section>
  );
}

/** Υπόμνημα + πλήθη ανοιγμάτων, με το ίδιο μοτίβο γραμμής που έχουν στον καμβά. */
function OpeningLegend({ proposal, t }: { readonly proposal: OpeningProposal; readonly t: Translate }): React.ReactElement {
  const counts = countOpeningsByStatus(proposal);
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="mfd-openings-legend">
      {OPENING_STATUS_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-2 text-xs text-foreground" data-status={status}>
          <ToneSwatch tone={OPENING_STATUS_TONE[status]} />
          <span className="flex-1">{t(OPENING_STATUS_LABEL_KEY[status])}</span>
          <span className="font-mono">{counts[status]}</span>
        </li>
      ))}
    </ul>
  );
}

interface ChoiceButtonsProps {
  readonly item: OpeningProposalItem;
  readonly index: number;
  readonly current: OpeningReviewChoice | undefined;
  readonly similarCount: number;
  readonly onChoose: (choice: OpeningReviewChoice | null, includeSimilar: boolean) => void;
  readonly t: Translate;
}

/** Οι τρεις απαντήσεις ενός στοιχείου. Δεύτερο κλικ στην ίδια = αναποφάσιστο ξανά. */
function ChoiceButtons({ item, index, current, similarCount, onChoose, t }: ChoiceButtonsProps): React.ReactElement {
  const suggested = suggestedOpeningChoice(item);
  return (
    <p
      className="m-0 flex flex-wrap items-center gap-1" role="group"
      aria-label={t('modelFromDrawing.openings.review.choiceFor', { index })}
    >
      {OPENING_REVIEW_CHOICES.map((choice) => (
        <ToggleButton
          key={choice} type="button" size="xs" tabIndex={-1}
          pressed={current === choice}
          data-choice={choice} data-suggested={suggested === choice}
          onClick={() => onChoose(current === choice ? null : choice, false)}
        >
          {t(OPENING_CHOICE_LABEL_KEY[choice])}
          {suggested === choice ? <small className="ml-1 opacity-70">{t('modelFromDrawing.openings.review.suggested')}</small> : null}
        </ToggleButton>
      ))}
      {current !== undefined && similarCount > 0 ? (
        <Button type="button" variant="ghost" size="xs" tabIndex={-1} data-testid="mfd-opening-similar" onClick={() => onChoose(current, true)}>
          {t('modelFromDrawing.openings.review.similar', { count: similarCount })}
        </Button>
      ) : null}
    </p>
  );
}

interface ReviewRowProps {
  readonly item: OpeningProposalItem;
  readonly index: number;
  readonly current: OpeningReviewChoice | undefined;
  readonly similarCount: number;
  readonly focused: boolean;
  readonly tabbable: boolean;
  readonly rowRef: (node: HTMLLIElement | null) => void;
  readonly onFocus: () => void;
  readonly onChoose: (choice: OpeningReviewChoice | null, includeSimilar: boolean) => void;
  readonly t: Translate;
}

/** Ένα στοιχείο της ουράς: ΓΙΑΤΙ ρωτιέται, πόσο πλατύ είναι, τι είναι ζωγραφισμένο μέσα του. */
function ReviewRow(props: ReviewRowProps): React.ReactElement {
  const { item, focused, t } = props;
  const choosable = canChooseOpening(item);
  const occupants = item.occupantIds?.length ?? 0;
  const width = item.widthMm !== undefined
    ? t('modelFromDrawing.openings.review.width', { widthMm: Math.round(item.widthMm) })
    : t('modelFromDrawing.openings.review.noWidth');
  return (
    <li
      ref={props.rowRef} tabIndex={props.tabbable ? 0 : -1} onFocus={props.onFocus}
      className="flex flex-col gap-1 rounded px-1 py-1.5 outline-none focus-visible:ring-1 focus-visible:ring-ring data-[focused=true]:bg-accent/60"
      data-testid="mfd-opening-item" data-key={item.key} data-focused={focused} data-choosable={choosable}
      role="option" aria-selected={focused} aria-keyshortcuts={choosable ? '1 2 3 0' : undefined}
    >
      <p className="m-0 flex items-center gap-1.5 text-xs text-foreground">
        <Crosshair className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{item.reason ? t(OPENING_REASON_LABEL_KEY[item.reason]) : ''}</span>
        <span className="font-mono text-[11px]">{width}</span>
      </p>
      {occupants > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" data-testid="mfd-opening-occupied">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {t('modelFromDrawing.openings.review.occupied', { count: occupants })}
        </p>
      ) : null}
      {choosable
        ? <ChoiceButtons item={item} index={props.index} current={props.current} similarCount={props.similarCount} onChoose={props.onChoose} t={t} />
        : <p className={MUTED}>{t('modelFromDrawing.openings.review.notWritable')}</p>}
    </li>
  );
}

interface ReviewListProps {
  readonly proposal: OpeningProposal;
  readonly choices: OpeningReviewChoices;
  readonly focusedKey: string | null;
  readonly actions: Pick<OpeningReviewActions, 'onChooseOpening' | 'onFocus'>;
  readonly t: Translate;
}

/** Τα κλειδιά που αφορά μια απάντηση: το στοιχείο μόνο του, ή μαζί με τα όμοιά του. */
function targetKeys(proposal: OpeningProposal, key: string, includeSimilar: boolean): readonly string[] {
  return includeSimilar ? similarOpeningKeys(proposal, key) : [key];
}

type ReviewKey =
  | { readonly kind: 'step'; readonly delta: 1 | -1 }
  | { readonly kind: 'choose'; readonly choice: OpeningReviewChoice | null; readonly similar: boolean };

/** Τι σημαίνει ένα πλήκτρο μέσα στην ουρά. `null` = δεν είναι δικό της (π.χ. Ctrl+1 του browser). */
function decodeReviewKey(event: React.KeyboardEvent): ReviewKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.code === 'ArrowDown') return { kind: 'step', delta: 1 };
  if (event.code === 'ArrowUp') return { kind: 'step', delta: -1 };
  if (!(event.code in CHOICE_BY_CODE)) return null;
  return { kind: 'choose', choice: CHOICE_BY_CODE[event.code], similar: event.shiftKey };
}

/** Η ουρά διαλογής — βλ. την κεφαλίδα του αρχείου για τα πλήκτρα. */
function ReviewList({ proposal, choices, focusedKey, actions, t }: ReviewListProps): React.ReactElement | null {
  const items = reviewableOpenings(proposal);
  const rows = React.useRef(new Map<string, HTMLLIElement>());
  if (items.length === 0) return null;
  const activeIndex = Math.max(0, items.findIndex((item) => item.key === focusedKey));

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>): void => {
    const key = decodeReviewKey(event);
    if (!key) return;
    event.preventDefault();
    if (key.kind === 'step') {
      // Η εστίαση του DOM μετακινείται· το `onFocus` της γραμμής κάνει τα υπόλοιπα (έμφαση + όψη).
      const next = items[Math.min(items.length - 1, Math.max(0, activeIndex + key.delta))];
      rows.current.get(next.key)?.focus();
      return;
    }
    actions.onChooseOpening(targetKeys(proposal, items[activeIndex].key, key.similar), key.choice);
  };

  return (
    <ul
      className="m-0 list-none divide-y divide-border p-0" onKeyDown={onKeyDown} role="listbox"
      aria-label={t('modelFromDrawing.openings.review.list')} data-testid="mfd-openings-review"
    >
      {items.map((item, i) => (
        <ReviewRow
          key={item.key} item={item} index={i + 1} current={choices.get(item.key)}
          similarCount={Math.max(0, similarOpeningKeys(proposal, item.key).length - 1)}
          focused={item.key === focusedKey} tabbable={i === activeIndex}
          rowRef={(node) => { if (node) rows.current.set(item.key, node); else rows.current.delete(item.key); }}
          onFocus={() => { if (item.key !== focusedKey) actions.onFocus(item.key); }}
          onChoose={(choice, includeSimilar) => {
            // Το κλικ εστιάζει το κουμπί· η εστίαση γυρίζει στη ΓΡΑΜΜΗ, που είναι ο ιδιοκτήτης των πλήκτρων.
            rows.current.get(item.key)?.focus();
            actions.onChooseOpening(targetKeys(proposal, item.key, includeSimilar), choice);
          }}
          t={t}
        />
      ))}
    </ul>
  );
}

export interface OpeningsSectionProps {
  readonly proposal: OpeningProposal;
  readonly preview: OpeningPreview | null;
  readonly choices: OpeningReviewChoices;
  readonly colorHex: string | null;
  readonly focusedKey: string | null;
  readonly actions: OpeningReviewActions;
  readonly t: Translate;
}

/** Η ΜΙΑ έγκριση: γράφει τον αριθμό, και λέει τι ΜΕΝΕΙ ΕΞΩ. Τα αναποφάσιστα δεν την κλειδώνουν. */
function OpeningApproval(props: Pick<OpeningsSectionProps, 'proposal' | 'preview' | 'choices' | 'actions' | 't'>): React.ReactElement {
  const { proposal, preview, choices, actions, t } = props;
  const counts = countOpeningReview(proposal, choices);
  const refusal = preview?.refusal;
  return (
    <>
      {refusal ? (
        <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" role="status" data-testid="mfd-openings-plan-refusal">
          <ToneSwatch tone="reject" />
          {t(OPENING_REFUSAL_LABEL_KEY[refusal])}
        </p>
      ) : null}
      {counts.undecided > 0 ? (
        <p className={MUTED} data-testid="mfd-openings-left-out">
          {t('modelFromDrawing.openings.leftOut', { count: counts.undecided })}
        </p>
      ) : null}
      <Button
        type="button" size="sm" disabled={counts.writable === 0 || refusal !== undefined}
        onClick={actions.onApproveOpenings} data-testid="mfd-openings-approve"
      >
        {t('modelFromDrawing.openings.approve', { count: counts.writable })}
      </Button>
    </>
  );
}

/** Το δεύτερο βήμα του βοηθού: δείγμα · πλήθη · ουρά «προς απόφαση» · ανεξήγητες · μία έγκριση. */
export function OpeningsSection(props: OpeningsSectionProps): React.ReactElement {
  const { proposal, choices, colorHex, actions, t } = props;
  const counts = countOpeningReview(proposal, choices);
  const hasReview = reviewableOpenings(proposal).length > 0;
  return (
    <section className="flex flex-col gap-2" data-testid="mfd-openings">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.openings.title')}</h4>
      <p className="m-0 flex items-center gap-1.5 text-xs text-foreground">
        {colorHex ? <ColorChip hex={colorHex} /> : null}
        <span className="flex-1">{t('modelFromDrawing.openings.sample.label')}</span>
        <Button type="button" variant="ghost" size="xs" onClick={actions.onStartOpenings}>
          {t('modelFromDrawing.openings.sample.change')}
        </Button>
      </p>
      <OpeningLegend proposal={proposal} t={t} />
      {hasReview ? (
        <>
          <h5 className={SECTION_TITLE}>{t('modelFromDrawing.openings.review.title')}</h5>
          <p className={MUTED} data-testid="mfd-openings-progress">
            {t('modelFromDrawing.openings.review.progress', {
              undecided: counts.undecided, dismissed: counts.dismissed, blocked: counts.blocked,
            })}
          </p>
          <ReviewList proposal={proposal} choices={choices} focusedKey={props.focusedKey} actions={actions} t={t} />
          <p className={MUTED}>{t('modelFromDrawing.openings.review.keys')}</p>
        </>
      ) : null}
      {proposal.unexplainedIds.length > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" role="status" data-testid="mfd-openings-unexplained">
          <ToneSwatch tone="reject" />
          {t('modelFromDrawing.openings.unexplained', { count: proposal.unexplainedIds.length })}
        </p>
      ) : null}
      <OpeningApproval proposal={proposal} preview={props.preview} choices={choices} actions={actions} t={t} />
    </section>
  );
}
