/**
 * RIBBON PANEL BUILDERS — SSoT for the two structural shapes that every
 * contextual tab repeats verbatim:
 *
 *   1. a panel holding exactly ONE non-flyout row  →  `singleRowPanel()`
 *   2. a small "simple" action button (close / delete / run-command)
 *      whose `commandKey` and `action` are the same key  →  `actionButton()`
 *
 * Both are pure scaffolding: the surrounding `{ rows: [{ isInFlyout: false,
 * buttons: [...] }] }` and `{ type: 'simple', size: 'small', command: {...} }`
 * envelopes carry no per-tab meaning, yet they were hand-written once per panel
 * and once per button across the contextual-tab files — enough repeated tokens
 * to trip CHECK 3.28 / jscpd (ADR-583) between sibling tab factories.
 *
 * These builders remove the envelope, NOT the content: ids, label keys, icons
 * and command keys stay explicit at each call site, so a reader still sees what
 * the panel actually offers.
 *
 * @see ./mep-outlet-contextual-tab-factory.ts
 * @see ./mep-manifold-contextual-tab-factory.ts
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';

type RibbonPanel = RibbonTab['panels'][number];

/** A panel whose entire content is a single, non-flyout row of buttons. */
export function singleRowPanel(
  id: string,
  labelKey: string,
  buttons: readonly RibbonButton[],
  options?: { readonly visibilityKey?: string; readonly badgeKey?: string },
): RibbonPanel {
  return {
    id,
    labelKey,
    ...(options?.visibilityKey ? { visibilityKey: options.visibilityKey } : {}),
    ...(options?.badgeKey ? { badgeKey: options.badgeKey } : {}),
    rows: [{ isInFlyout: false, buttons: [...buttons] }],
  };
}

/**
 * A small `simple` button that both binds to and dispatches the same command
 * key — the shape used by every close / delete / run-now ribbon action.
 */
export function actionButton(
  id: string,
  labelKey: string,
  icon: string,
  commandKey: string,
  options?: { readonly tooltipKey?: string },
): RibbonButton {
  return {
    type: 'simple',
    size: 'small',
    command: {
      id,
      labelKey,
      ...(options?.tooltipKey ? { tooltipKey: options.tooltipKey } : {}),
      icon,
      commandKey,
      action: commandKey,
    },
  };
}
