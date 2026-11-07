'use client';

/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-2) — **Η στρώση κειμένου** του `PdfCanvasViewer`: επιλογή, αντιγραφή, αναγνώστης οθόνης.
 * @module components/file-manager/PdfTextLayer
 *
 * Πάνω στο `TextLayer` της **ίδιας** βιβλιοθήκης (pdfjs-dist 4.5.136), όπως ο Chrome PDF viewer και ο Firefox:
 * διάφανα spans στη θέση κάθε γλύφου, πάνω από το canvas.
 *
 * 🔑 Χτίζεται **μία φορά ανά (σελίδα, στροφή)**. Το ζουμ ΔΕΝ το ξαναχτίζει: θέσεις (`%`) και μέγεθος γραμμάτων
 *    (`var(--scale-factor)`) κλιμακώνονται με CSS **σύγχρονα**, μαζί με το canvas· η ακριβής μέτρηση πλάτους
 *    (`update`) τρέχει όταν το ζουμ ηρεμήσει — όπως το bitmap (`PDF_RENDER_SETTLE_MS`).
 * 🔑 Το `--scale-factor` γράφεται **προστακτικά** (`style.setProperty`) — όπως ο `usePdfViewport` γράφει το πλάτος του
 *    canvas· κανένα inline style σε JSX (N.3).
 * 🔑 `data-pdf-text-layer`: το σύρσιμο-χέρι (`useMouseDragPan`) δεν ξεκινά πάνω σε κείμενο — εκεί το σύρσιμο είναι επιλογή.
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { TextLayer } from 'pdfjs-dist';

import { createModuleLogger } from '@/lib/telemetry';

import { loadPdfJs, PDF_RENDER_SETTLE_MS, type PdfPageProxy } from './pdf-canvas-config';
import styles from './pdf-text-layer.module.css';

const logger = createModuleLogger('PdfTextLayer');

export interface PdfTextLayerProps {
  /** Η σελίδα που φαίνεται — `null` ⇒ καμία στρώση. */
  readonly page: PdfPageProxy | null;
  readonly scale: number;
  readonly rotation: number;
}

function writeScaleFactor(container: HTMLElement, scale: number): void {
  container.style.setProperty('--scale-factor', String(scale));
}

/** Χτίζει τη στρώση της σελίδας· επιστρέφει την ακύρωση. Η ακύρωση αδειάζει το στοιχείο — ποτέ κείμενο άλλης σελίδας. */
function buildTextLayer(
  container: HTMLDivElement,
  page: PdfPageProxy,
  viewport: ReturnType<PdfPageProxy['getViewport']>,
  onReady: (layer: TextLayer | null) => void,
): () => void {
  let cancelled = false;
  let layer: TextLayer | null = null;
  container.replaceChildren();
  writeScaleFactor(container, viewport.scale);
  loadPdfJs().then((lib) => {
    if (cancelled) return undefined;
    layer = new lib.TextLayer({ textContentSource: page.streamTextContent({ includeMarkedContent: true }), container, viewport });
    onReady(layer);
    return layer.render();
  }).catch((error: unknown) => {
    if (cancelled) return;
    // Χωρίς κείμενο η σελίδα μένει ορατή και πλοηγήσιμη — αποτυχία στρώσης δεν είναι αποτυχία εγγράφου.
    logger.warn('PDF text layer failed', { error: error instanceof Error ? error.message : String(error) });
  });
  return () => {
    cancelled = true;
    layer?.cancel();
    onReady(null);
    container.replaceChildren();
  };
}

export function PdfTextLayer({ page, scale, rotation }: PdfTextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<TextLayer | null>(null);
  const scaleRef = useRef(scale);
  useLayoutEffect(() => { scaleRef.current = scale; });

  // Νέα σελίδα / στροφή ⇒ νέα στρώση, στο ζουμ εκείνης της στιγμής (getter, όχι εξάρτηση — ADR-040).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !page) return;
    const viewport = page.getViewport({ scale: scaleRef.current, rotation });
    return buildTextLayer(container, page, viewport, (layer) => { layerRef.current = layer; });
  }, [page, rotation]);

  // Ζουμ ⇒ CSS αμέσως (μαζί με το canvas, πριν ζωγραφίσει ο browser)· μέτρηση πλάτους όταν ηρεμήσει.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !page) return;
    writeScaleFactor(container, scale);
    const settle = window.setTimeout(() => {
      layerRef.current?.update({ viewport: page.getViewport({ scale, rotation }) });
    }, PDF_RENDER_SETTLE_MS);
    return () => window.clearTimeout(settle);
  }, [page, scale, rotation]);

  if (!page) return null;
  return <div ref={containerRef} className={styles.layer} data-pdf-text-layer="" />;
}
