'use client';

/**
 * @fileoverview **Το εξηγήσιμο πλαίσιο του PDF** (ADR-923 §5.5.2 Β8 βήμα Β): σε hover **και** σε εστίαση, κάθε πλαίσιο λέει
 *   **γιατί** θέλει τον άνθρωπο, **τι** κάνει, και δίνει το **κουμπί** που το κάνει — χωρίς να ψάξει την ενέργεια στη λίστα.
 * @module components/catalog/imports/ReviewBoxPopover
 *
 * 🔑 **Μη-modal διάλογος, όχι tooltip** (WAI-ARIA APG): περιεχόμενο με κουμπιά δεν είναι `role="tooltip"`. Η εστίαση **μένει** στο
 *    πλαίσιο όταν ανοίγει (`onOpenAutoFocus` αποτρέπεται)· Tab ⇒ στο πρώτο κουμπί · Shift+Tab από το πρώτο ⇒ πίσω στο πλαίσιο ·
 *    Tab από το τελευταίο ⇒ πίσω στο πλαίσιο, κλειστό · Esc ⇒ κλείνει και η εστίαση γυρίζει στο πλαίσιο (WCAG 1.4.13).
 * 🔑 **ΕΝΑ popover για όλη τη σελίδα**, δεμένο με `virtualRef` στο πλαίσιο που δείχνεται — όχι 113. Τι δείχνεται ζει στο
 *    `review-box-preview`: μια κίνηση του ποντικιού δεν ξαναζωγραφίζει τα πλαίσια.
 * 🔑 Τα λόγια είναι τα **ίδια** με τη λίστα και το `aria-label` του πλαισίου (`review-reason-text`)· οι ενέργειες από τον **ίδιο**
 *    κανόνα (`remedyOf`) και περνούν από τον **ένα** κάτοχο (`onRemedy`) — καμία δεύτερη υλοποίηση ενέργειας.
 * 🔑 Πλαίσιο πολλών στόχων ⇒ ο **χειρότερος** (αυτός που το έβαψε) + «και N ακόμη».
 * 🔑 §5.5.2 Β8 βήμα Γ: hover/εστίαση σε «Κράτα «…»» ⇒ φάντασμα στο κελί **εκείνης** της τιμής (`review-ghost-store`).
 */

import React, { useCallback, useId, useMemo, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { REVIEW_TONE_KEYS, useImportText } from './import-text';
import { ReviewMarkBadge } from './ImportReviewOverlay';
import { REVIEW_BOX_ATTRIBUTE, useBoxPreview, type BoxPreviewController } from './review-box-preview';
import { useReviewGhostHandlers } from './review-ghost-store';
import type { ReviewBox, ReviewBoxTarget, ReviewTarget } from './review-overlay-model';
import { remedyActionLook, useRemedyActionLabel, useReviewReasonText, useReviewRelationText, useReviewTargetName } from './review-reason-text';
import { remedyOf, type RemedyAction, type RemedyContext } from './review-remedy';

/** Μέγεθος του σήματος τόνου στην κεφαλίδα (ίδιο με τη γωνία του πλαισίου). */
const BADGE_PX = 14;

const isReviewBox = (target: EventTarget | null): boolean => target instanceof Element && target.closest(`[${REVIEW_BOX_ATTRIBUTE}]`) !== null;

export interface ReviewRemedyHandlers {
  /** Η κρίση «επιτρέπεται;» για έναν στόχο — πρόταση ανοιχτή · δικαιώματα · τιμοκατάλογος. */
  readonly contextOf: (target: ReviewTarget) => RemedyContext;
  /** Η ενέργεια περνά από τον ΕΝΑ κάτοχο (`ImportBatchWorkspace`). */
  readonly onRemedy: (target: ReviewTarget, action: RemedyAction) => void;
}

interface ReviewBoxPopoverProps extends ReviewRemedyHandlers {
  readonly controller: BoxPreviewController;
  readonly boxes: readonly ReviewBox[];
}

/** Ο τόνος με σύμβολο **και** λέξη (CHECK 3.41: «ξέρω ποιο είναι ποιο χωρίς χρώμα»). */
function ToneTag({ box }: { readonly box: ReviewBox }) {
  const { t } = useImportText();
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <svg width={BADGE_PX} height={BADGE_PX} aria-hidden="true"><ReviewMarkBadge tone={box.tone} /></svg>
      {t(REVIEW_TONE_KEYS[box.tone])}
    </span>
  );
}

function Heading({ box, first, id }: { readonly box: ReviewBox; readonly first: ReviewBoxTarget; readonly id: string }) {
  const nameOf = useReviewTargetName();
  // §5.5.2 Β8 (β): η ίδια πρόταση σχέσης με το `aria-label` του πλαισίου.
  const relation = useReviewRelationText()(first);
  return (
    <header className="flex flex-col gap-1">
      <h3 id={id} className="m-0 text-sm font-semibold">{nameOf(first)}</h3>
      {first.printed ? <p className="m-0 break-words text-xs text-muted-foreground">{first.printed}</p> : null}
      {relation ? <p className="m-0 text-xs text-muted-foreground">{relation}</p> : null}
      <ToneTag box={box} />
    </header>
  );
}

const actionKey = (action: RemedyAction): string => {
  if (action.kind === 'lineTool') return `${action.kind}:${action.mode}`;
  return action.kind === 'keepValue' ? `${action.kind}:${action.text}` : action.kind;
};

/** Ένα κουμπί λύσης· το «Κράτα» δείχνει και από πού έρχεται η τιμή του (φάντασμα). */
function RemedyButton({ action, label, onRun }: { readonly action: RemedyAction; readonly label: string; readonly onRun: (action: RemedyAction) => void }) {
  const ghost = useReviewGhostHandlers(action.kind === 'keepValue' ? action.anchor : null);
  const { icon: Icon, variant } = remedyActionLook(action);
  return (
    <Button type="button" size="sm" variant={variant} onClick={() => onRun(action)} {...ghost}>
      {Icon ? <Icon className="mr-1 h-3 w-3" aria-hidden /> : null}{label}
    </Button>
  );
}

function RemedyActions({ actions, field, onRun }: { readonly actions: readonly RemedyAction[]; readonly field: string; readonly onRun: (action: RemedyAction) => void }) {
  const { t } = useImportText();
  const labelOf = useRemedyActionLabel();
  if (actions.length === 0) return null;
  return (
    <section className="flex flex-col gap-1" aria-label={t('review.remedy.title')}>
      <h4 className="m-0 text-xs font-medium text-muted-foreground">{t('review.remedy.title')}</h4>
      <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
        {actions.map((action) => <li key={actionKey(action)}><RemedyButton action={action} label={labelOf(action, field)} onRun={onRun} /></li>)}
      </ul>
    </section>
  );
}

/** Tab / Shift+Tab στα άκρα του popover ⇒ πίσω στο πλαίσιο (το popover ζει σε portal, έξω από τη σειρά του Tab της σελίδας). */
function useEdgeTab(controller: BoxPreviewController, element: SVGGraphicsElement) {
  return useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const edge = event.shiftKey ? buttons[0] : buttons[buttons.length - 1];
    if (edge === undefined || document.activeElement !== edge) return;
    event.preventDefault();
    if (!event.shiftKey) controller.close();
    element.focus();
  }, [controller, element]);
}

interface ContentProps extends ReviewRemedyHandlers {
  readonly controller: BoxPreviewController;
  readonly box: ReviewBox;
  readonly element: SVGGraphicsElement;
}

function BoxPopoverContent({ controller, box, element, contextOf, onRemedy }: ContentProps) {
  const { t } = useImportText();
  const headingId = useId();
  const nameOf = useReviewTargetName();
  const [first] = box.targets;
  const remedy = remedyOf(first, contextOf(first.target));
  const why = useReviewReasonText(remedy.why);
  const onEdgeTab = useEdgeTab(controller, element);
  const run = (action: RemedyAction) => {
    onRemedy(first.target, action);
    controller.close();
    // Ενέργεια που έγινε επιτόπου ⇒ η εστίαση γυρίζει στο πλαίσιο· εργαλείο που ανοίγει ⇒ την παίρνει εκείνο.
    if (action.kind === 'keepValue' || action.kind === 'ignoreLine') element.focus();
  };
  return (
    <PopoverContent ref={controller.attachContent} aria-labelledby={headingId} side="right" align="start" className="flex w-80 flex-col gap-2"
      onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}
      onEscapeKeyDown={() => { controller.close(); element.focus(); }}
      onInteractOutside={(event) => { if (isReviewBox(event.target)) event.preventDefault(); }}
      onFocusOutside={(event) => event.preventDefault()}
      onPointerEnter={controller.holdPointer} onPointerLeave={controller.pointerLeave}
      onFocus={controller.holdFocus} onBlur={(event) => { if (!controller.contains(event.relatedTarget) && event.relatedTarget !== element) controller.blur(); }}
      onKeyDown={onEdgeTab}>
      <Heading box={box} first={first} id={headingId} />
      {why ? <p className="m-0 text-sm">{why}</p> : null}
      <RemedyActions actions={remedy.actions} field={nameOf(first)} onRun={run} />
      {box.targets.length > 1 ? <p className="m-0 text-xs text-muted-foreground">{t('review.overlay.boxMore', { count: box.targets.length - 1 })}</p> : null}
    </PopoverContent>
  );
}

export function ReviewBoxPopover({ controller, boxes, contextOf, onRemedy }: ReviewBoxPopoverProps) {
  const shown = useBoxPreview(controller);
  const box = shown === null ? undefined : boxes.find((candidate) => candidate.id === shown.boxId);
  // Η άγκυρα είναι το ίδιο το πλαίσιο: το Radix τη μετρά (getBoundingClientRect) και την ακολουθεί σε κύλιση και ζουμ.
  const anchor = useMemo<React.RefObject<SVGGraphicsElement>>(() => ({ current: shown?.element ?? null }), [shown]);
  // Πλαίσιο που χάθηκε (ξαναχτισμένος πίνακας · άλλη σελίδα) ⇒ κλειστό, ποτέ popover δεμένο στο κενό.
  const live = shown !== null && box !== undefined && box.targets.length > 0 && shown.element.isConnected ? { box, element: shown.element } : null;
  return (
    <Popover open={live !== null} onOpenChange={(next) => { if (!next) controller.close(); }}>
      <PopoverAnchor virtualRef={anchor} />
      {live ? <BoxPopoverContent controller={controller} box={live.box} element={live.element} contextOf={contextOf} onRemedy={onRemedy} /> : null}
    </Popover>
  );
}
