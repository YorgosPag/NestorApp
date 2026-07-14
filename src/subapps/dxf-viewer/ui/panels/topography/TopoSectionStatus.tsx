/**
 * ADR-656 — shared status line for the topography panel sections.
 *
 * Every bake/generate section (contours, grid, point labels) ends with the same
 * conditional status paragraph: neutral text, or error-styled when the action failed.
 * The markup + the error-class toggle live here once, so a styling change lands in
 * one place instead of drifting across sibling sections.
 */

import * as React from 'react';
import styles from './TopographyPanel.module.css';

/** Outcome of a section action — what the user is told after a bake/generate run. */
export interface TopoSectionStatusState {
  readonly text: string;
  readonly error: boolean;
}

interface TopoSectionStatusProps {
  /** `null` while the section is idle — nothing is rendered. */
  readonly status: TopoSectionStatusState | null;
}

export function TopoSectionStatus({ status }: TopoSectionStatusProps): React.ReactElement | null {
  if (!status) return null;
  return (
    <p className={`${styles.status} ${status.error ? styles.statusError : ''}`}>{status.text}</p>
  );
}
