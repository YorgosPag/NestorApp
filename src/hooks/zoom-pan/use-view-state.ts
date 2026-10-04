/**
 * @fileoverview **Η όψη ως κατάσταση** — state για το render, ref για τις αναγνώσεις τη στιγμή του γεγονότος, και ο
 *   ΕΝΑΣ `commit` που περνά κάθε νέα όψη από τον περιορισμό (ADR-899 §9 θέμα 3).
 * @module hooks/zoom-pan/use-view-state
 */

'use client';

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { viewTransformOf } from '@/lib/geometry/zoom-pan-math';

import { settleView, ZERO_PAN, type ViewCommit, type ViewGetter, type ZoomPanView } from './zoom-pan-view';

export interface ViewState {
  readonly view: ZoomPanView;
  readonly getView: ViewGetter;
  readonly commit: ViewCommit;
  readonly container: HTMLElement | null;
  readonly content: HTMLElement | null;
  /** Το κουτί ως `RefObject` — για όποιον το μετρά (π.χ. `useElementSize` / `useZoomResolution`). */
  readonly containerBox: RefObject<HTMLElement | null>;
  readonly containerRef: (node: HTMLElement | null) => void;
  readonly contentRef: (node: HTMLElement | null) => void;
}

export function useViewState(defaultZoom: number, confine: boolean): ViewState {
  const [view, setView] = useState<ZoomPanView>({ zoom: defaultZoom, pan: ZERO_PAN, rotation: 0 });
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const viewRef = useRef(view);
  const frameRef = useRef({ container, content });
  const containerBox = useRef<HTMLElement | null>(null);
  frameRef.current = { container, content };

  const getView = useCallback(() => viewRef.current, []);
  const commit = useCallback((next: ZoomPanView) => {
    const settled = settleView(next, frameRef.current, confine);
    viewRef.current = settled;
    setView(settled);
  }, [confine]);

  const containerRef = useCallback((node: HTMLElement | null) => {
    containerBox.current = node;
    setContainer(node);
  }, []);

  return { view, getView, commit, container, content, containerBox, containerRef, contentRef: setContent };
}

/**
 * **Εφαρμογή του μετασχηματισμού στο περιεχόμενο — imperative** (κανένα `style=` στο JSX, N.3). Η μετάβαση σβήνει όσο
 * κρατιέται η σύρση (άμεση απόκριση), αλλιώς ομαλή.
 */
export function useApplyViewTransform(content: HTMLElement | null, view: ZoomPanView, isPanning: boolean): void {
  useLayoutEffect(() => {
    if (!content) return;
    content.style.transform = viewTransformOf({ pan: view.pan, scale: view.zoom, rotation: view.rotation });
    content.style.transformOrigin = 'center center';
    content.style.transition = isPanning ? 'none' : 'transform 0.15s ease-out';
  }, [content, view, isPanning]);
}
