'use client';

/**
 * ADR-650 M5α.2 / M8β/Γ — the shell every topography REVIEW surface gets, in one place.
 *
 * ### Why a review surface must not be a modal dialog
 * A review panel is a **companion to the canvas, not a detour from it**. Its whole job is to talk
 * about the drawing behind it: the QA list zooms the view to each finding, the auto-breakline list
 * highlights the green line it is describing, the cut/fill panel asks the engineer to pick the site
 * boundary BY CLICKING ON THE PLAN. A Radix dialog is the wrong primitive for all of that on three
 * counts — it dims the canvas, it traps the keyboard, and (even with `modal={false}`) it closes on
 * the first outside click, i.e. the moment you touch the very drawing it is talking about. For the
 * boundary pick it is worse than awkward: the interaction the panel just armed is unreachable.
 *
 * So every one of them uses the same `FloatingPanel` SSoT the clash report uses: draggable, no
 * backdrop, no outside-click dismissal — closed only by its own ✕.
 *
 * ### Why this component exists rather than four copies of the same JSX
 * The QA panel shipped first and the other three were about to repeat its ~18 lines of
 * `FloatingPanel` + position + header wiring verbatim. `jscpd --diff` flags exactly that shape
 * (N.18), and it is the kind of twin that rots: the day the default position must dodge a new
 * top-right widget, three of the four learn about it.
 *
 * @see ../../../components/dxf-layout/clash-markers — the sibling report surface (ADR-435)
 */

import * as React from 'react';
import { FloatingPanel, type FloatingPanelDimensions, type FloatingPanelId } from '@/components/ui/floating';

/** Panel footprint — width drives the bounds clamp, height caps the scrolling list. */
const PANEL_DIMENSIONS = { width: 320, height: 460 };

/**
 * Cascade step (px) between simultaneously open review panels — the MDI convention every desktop
 * CAD uses. Without it a second panel opens exactly on top of the first and reads as «the previous
 * one closed». Small enough that both headers (the drag handles) stay grabbable.
 */
const CASCADE_PX = 28;

/**
 * Default spot: right edge, BELOW the ViewCube / 3D toggle (both top-right) and clear of the left
 * layers panel — the same reasoning as `ClashReportPanel`'s default. Draggable from there.
 */
function panelPosition(stackIndex: number, width: number): { x: number; y: number } {
  const margin = 16;
  return {
    x: window.innerWidth - width - margin - stackIndex * CASCADE_PX,
    y: 200 + stackIndex * CASCADE_PX,
  };
}

/**
 * ADR-929 §6.25 — προαιρετική **παλέτα εργασίας** αντί για λίστα αναθεώρησης: αλλάζει μέγεθος (8 λαβές), θυμάται
 * θέση/μέγεθος ανά χρήστη (ADR-723 — Revit/AutoCAD: layout παλετών στο προφίλ, ποτέ στο αρχείο) και κρατά την
 * κύρια ενέργεια σε καρφωμένο υποσέλιδο. Χωρίς αυτό, η παλέτα συμπεριφέρεται ΑΚΡΙΒΩΣ όπως πριν.
 */
export interface TopoReviewPanelWorkspace {
  /** Προεπιλεγμένο μέγεθος· το viewport το περιορίζει πάντα (`clampPanelGeometry`). */
  readonly size: FloatingPanelDimensions;
  readonly minSize: FloatingPanelDimensions;
  /** Σταθερή ταυτότητα `<subapp>.<panel>` για τη μόνιμη γεωμετρία. */
  readonly persistenceKey: FloatingPanelId;
}

export interface TopoReviewPanelProps {
  readonly title: string;
  /** Header glyph — the SAME icon the ribbon button that opened it carries. */
  readonly icon: React.ReactNode;
  readonly onClose: () => void;
  /** Cascade slot, so two panels open at once never land on the same pixel. */
  readonly stackIndex: number;
  readonly testId: string;
  readonly children: React.ReactNode;
  /** ADR-929 §6.25 — βλ. {@link TopoReviewPanelWorkspace}. */
  readonly workspace?: TopoReviewPanelWorkspace;
  /** ADR-929 §6.25 — περιεχόμενο κάτω από την κύλιση (κύρια ενέργεια). */
  readonly footer?: React.ReactNode;
}

export function TopoReviewPanel(props: TopoReviewPanelProps): React.JSX.Element {
  const { title, icon, onClose, stackIndex, testId, children, workspace, footer } = props;
  const size = workspace?.size ?? PANEL_DIMENSIONS;
  // `getClientPosition` re-runs on viewport resize, so it must resolve the SAME slot — hence the
  // stable callback over `stackIndex` rather than a captured one-off position.
  const getClientPosition = React.useCallback(() => panelPosition(stackIndex, size.width), [stackIndex, size.width]);

  return (
    <FloatingPanel
      defaultPosition={getClientPosition()}
      dimensions={size}
      onClose={onClose}
      draggableOptions={{ getClientPosition }}
      resizable={workspace !== undefined}
      minSize={workspace?.minSize}
      persistenceKey={workspace?.persistenceKey}
      className={workspace ? 'z-[var(--z-index-viewer-menu)]' : 'z-[var(--z-index-viewer-menu)] w-80'}
      data-testid={testId}
    >
      <FloatingPanel.Header showClose icon={icon}>
        <h3 className="m-0 flex-1 text-sm font-semibold text-foreground">{title}</h3>
      </FloatingPanel.Header>
      <FloatingPanel.Content className={workspace ? 'flex flex-col' : 'flex max-h-[60vh] flex-col overflow-y-auto'}>
        {children}
      </FloatingPanel.Content>
      {footer ? <FloatingPanel.Footer>{footer}</FloatingPanel.Footer> : null}
    </FloatingPanel>
  );
}
