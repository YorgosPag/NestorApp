'use client';
/**
 * ADR-650 M5α · ADR-920 Β3.5 — the ONE row of a topographic finding: severity stripe + dot + the flag's own message,
 * as a full-width button (click = Zoom To). The QA report and the breakline list's «Συγκρούσεις» both render the
 * SAME `TopoQaFlag` (same message, same severity colour) — only what a click does differs, so that is the prop.
 *
 * i18n via `t()` (N.11) · shared CSS module (N.3) · semantic `button` (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import type { TopoQaFlag, TopoQaSeverity } from '../../../systems/topography/qa/topo-qa-types';
import styles from './TopographyPanel.module.css';

export const TOPO_SEVERITY_CLASS: Readonly<Record<TopoQaSeverity, string>> = {
  high: styles.qaHigh!,
  medium: styles.qaMedium!,
  low: styles.qaLow!,
};

interface TopoQaFlagRowProps {
  readonly flag: TopoQaFlag;
  readonly selected: boolean;
  readonly onFocus: (flag: TopoQaFlag) => void;
  /** Accessible name of the click (`dxf-viewer-panels` key). */
  readonly focusHintKey: string;
  /**
   * ADR-920 Β3.6 — a finding an engineer's rule decided: neutral stripe instead of the severity colour (a red stripe on a
   * settled decision would read as an open problem). The message itself says «resolved».
   */
  readonly resolved?: boolean;
}

export function TopoQaFlagRow({ flag, selected, onFocus, focusHintKey, resolved = false }: TopoQaFlagRowProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const tone = resolved ? styles.qaResolved : TOPO_SEVERITY_CLASS[flag.severity];
  return (
    <button
      type="button"
      className={`${styles.qaItem} ${tone} ${selected ? styles.qaItemSelected : ''}`}
      onClick={() => onFocus(flag)}
      aria-label={t(focusHintKey)}
      aria-current={selected ? 'true' : undefined}
    >
      <span className={styles.qaDot} aria-hidden="true" />
      <span className={styles.qaMessage}>{t(flag.messageKey, flag.messageParams)}</span>
    </button>
  );
}
