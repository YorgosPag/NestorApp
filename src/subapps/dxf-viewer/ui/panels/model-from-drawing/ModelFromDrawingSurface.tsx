'use client';

/**
 * ADR-929 §6.25 — **η επιφάνεια** του βοηθού «Μοντέλο από το σχέδιο», ανάλογα με την οθόνη. Ίδιο περιεχόμενο
 * (ράγα · σώμα · υποσέλιδο), δύο φλοιοί:
 *
 * - **Φαρδιά οθόνη** — αιωρούμενη παλέτα εργασίας (`TopoReviewPanel` + `workspace`): αλλάζει μέγεθος, θυμάται θέση και
 *   μέγεθος ανά χρήστη (ADR-723 · Revit/AutoCAD: layout παλετών στο προφίλ), καρφωμένο υποσέλιδο, ράγα κολλημένη πάνω.
 * - **Στενή οθόνη** — φύλλο πυθμένα με στάσεις (`SnapBottomSheet`, ADR-912): Apple HIG «inspector ⇒ sheet σε compact
 *   width», Material 3 *standard bottom sheet* χωρίς σκοτεινό στρώμα — το σχέδιο μένει ζωντανό από πάνω, γιατί ό,τι
 *   λέει το πάνελ αφορά το σχέδιο. Ανοίγει στο μισό· η ματιά κρατά ράγα + κύρια ενέργεια.
 * - **«Μετράω ακόμη»** — τίποτα: ποτέ λάθος φλοιός στο πρώτο καρέ (`useViewportClass`).
 *
 * ⚠️ Μετρημένο: ο DXF editor δεν έχει ακόμη διάταξη κινητού (κορδέλα, καμβάς, αφή). Το φύλλο κάνει ΑΥΤΟ το πάνελ σωστό
 *   σε στενή οθόνη· δεν κάνει τον editor χρηστικό στο κινητό — αυτό είναι χωριστή δουλειά.
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingPanelFooter } from '@/components/ui/floating/FloatingPanelFooter';
import { SnapBottomSheet } from '@/components/ui/snap-bottom-sheet/SnapBottomSheet';
import { useSheetSnap } from '@/hooks/media/useSheetSnap';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import { TopoReviewPanel, type TopoReviewPanelWorkspace } from '../topography/TopoReviewPanel';
import type { Translate } from './ModelFromDrawingSections';
import styles from './model-from-drawing-sheet.module.css';

const TEST_ID = 'model-from-drawing-panel';
const SHEET_HISTORY_KEY = '__modelFromDrawingSheet';

/**
 * Παλέτα ΕΡΓΑΣΙΑΣ, όχι λίστα: 400 πλάτος (οι γραμμές «Τι διάβασα» και οι ομάδες πάχους χωρούν χωρίς αναδίπλωση)·
 * το ύψος το περιορίζει πάντα το viewport (`clampPanelGeometry`). Κάτω όριο: ράγα + ένα στοιχείο + υποσέλιδο.
 */
const WORKSPACE: TopoReviewPanelWorkspace = {
  size: { width: 400, height: 640 },
  minSize: { width: 320, height: 360 },
  persistenceKey: 'dxf.model-from-drawing',
};

interface ModelFromDrawingSurfaceProps {
  readonly viewport: ViewportClass;
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly onClose: () => void;
  /**
   * Ετικέτα του ✕ του φύλλου — τη δίνει ο γονέας, όπως και το `t`. Δικό του `useTranslation` εδώ θα έδενε το CHECK 3.8
   * ΟΛΑ τα `t(...)` του αρχείου στα common namespaces (και τα κλειδιά `modelFromDrawing.sheet.*` ζουν στο shell).
   */
  readonly closeLabel: string;
  readonly rail: React.ReactNode;
  readonly body: React.ReactNode;
  readonly footer: React.ReactNode;
  readonly t: Translate;
}

function WideSurface({ title, icon, onClose, rail, body, footer }: ModelFromDrawingSurfaceProps): React.ReactElement {
  return (
    <TopoReviewPanel title={title} icon={icon} onClose={onClose} stackIndex={0} testId={TEST_ID} workspace={WORKSPACE} footer={footer}>
      {/* Η ράγα μένει ορατή όσο κυλά το σώμα: «πού είμαι» δεν κυλά μακριά. `-top-2` = το padding του σώματος. */}
      <header className="sticky -top-2 z-10 -mx-2 -mt-2 border-b border-border bg-card px-2 py-1.5">{rail}</header>
      <section className="flex flex-col gap-2.5" data-testid="mfd-step-body">{body}</section>
    </TopoReviewPanel>
  );
}

function NarrowSurface({ viewport, title, onClose, closeLabel, rail, body, footer, t }: ModelFromDrawingSurfaceProps): React.ReactElement {
  const controller = useSheetSnap(true);
  const { snapTo } = controller;
  // Ανοίγει στο «μισό» (Apple medium detent): η απόφαση ΚΑΙ το σχέδιο. Μία φορά, στην προσάρτηση.
  React.useEffect(() => snapTo('half'), [snapTo]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[var(--z-index-viewer-menu)]" data-testid={TEST_ID}>
      <SnapBottomSheet
        controller={controller} viewport={viewport} historyKey={SHEET_HISTORY_KEY} geometryClassName={styles.geometry}
        title={title}
        labels={{ sheet: title, less: t('modelFromDrawing.sheet.less'), more: t('modelFromDrawing.sheet.more') }}
      >
        <header className="flex shrink-0 items-center gap-1 border-b border-border px-2 pb-1.5">
          <span className="min-w-0 flex-1">{rail}</span>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel}>
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>
        <section data-list-scroll className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2" data-testid="mfd-step-body">
          {body}
        </section>
        {footer ? <FloatingPanelFooter>{footer}</FloatingPanelFooter> : null}
      </SnapBottomSheet>
    </div>
  );
}

export function ModelFromDrawingSurface(props: ModelFromDrawingSurfaceProps): React.ReactElement | null {
  if (props.viewport === 'measuring') return null;
  return props.viewport === 'narrow' ? <NarrowSurface {...props} /> : <WideSurface {...props} />;
}
