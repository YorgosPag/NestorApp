'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-344 Φ-3D — TextEditorAnchorLayer: το ΚΟΙΝΟ imperative-positioning κέλυφος του
 * in-place text editor, για 2D **και** 3D.
 *
 * Είναι το ακριβές αδελφάκι του {@link ClashMarkerLayer} (ADR-435 Slice 1b) — ίδια αρχή,
 * άλλο περιεχόμενο: το παιδί αποδίδεται ΜΙΑ φορά από τον React, και μετά μετακινείται
 * **επιτακτικά** (ref + CSS `translate`) κάθε φορά που πυροδοτεί το `subscribe` του
 * καλούντος. Ποτέ re-render σε pan / zoom / orbit — ο ίδιος λόγος για τον οποίο οι
 * καμβάδες παρακάμπτουν τον React στα υψίσυχνα transforms (ADR-040).
 *
 * Αυτό που διαφέρει ανά προβολή είναι ΜΟΝΟ η προβολή, και εγχέεται:
 *   - 2D → world → screen μέσω του άμεσου 2D transform
 *   - 3D → world → screen μέσω της κάμερας (προβολή τύπου CSS2D)
 *
 * ### Γιατί ΔΕΝ κάνουμε CSS3DRenderer (ADR-344 Φ-3D, τεκμηριωμένη απόρριψη)
 * Ένα `contenteditable` πάνω σε `matrix3d` δείχνει εντυπωσιακό και είναι **λάθος**: σε
 * πλάγια γωνία το κείμενο γίνεται δυσανάγνωστο ακριβώς τη στιγμή που το διορθώνεις, και
 * τα caret / selection hit-boxes του browser σπάνε κάτω από προοπτικό transform. Η ίδια
 * η AutoCAD, στο ίδιο ακριβώς domain, το έχει ήδη απαντήσει: `MTEXTFIXED = 2` (η
 * **προεπιλογή** της) εμφανίζει κείμενο που θα ήταν δυσανάγνωστο — «πολύ μικρό, πολύ
 * μεγάλο, ή **περιστραμμένο**» — **οριζόντια και σε ευανάγνωστο μέγεθος». Άρα:
 * **θέση** από την προβολή, **μέγεθος + προσανατολισμός** σταθερά σε screen-space.
 *
 * ### Το clamping (πού ξεπερνάμε τους μεγάλους)
 * Το AutoCAD αγκυρώνει και ξεχνάει· ο Blender αφήνει την πλοήγηση ελεύθερη αλλά δεν έχει
 * DOM να χάσει. Εδώ ο editor **περιορίζεται μέσα στο viewport**: όσο κι αν κάνεις orbit,
 * ή ακόμη κι αν το κείμενο περάσει ΠΙΣΩ από την κάμερα (`project()` → `null`), το κουτί
 * που πληκτρολογείς δεν φεύγει ποτέ εκτός οθόνης. Χάνεις την αγκύρωση, δεν χάνεις τη
 * δουλειά σου.
 *
 * @see ../../components/dxf-layout/clash-markers/ClashMarkerLayer.tsx — το πρότυπο
 * @see ./TextEditorOverlay.tsx — το παιδί (TipTap)
 */

import React, { useEffect, useRef } from 'react';
import { useVisualViewport } from './responsive';

/** Πόσα px του editor μένουν υποχρεωτικά ορατά όταν το άγκυρο φεύγει εκτός οθόνης. */
const MIN_VISIBLE_PX = 48;

/**
 * Η αγκύρωση ενός in-place editor — ΤΟ συμβόλαιο που υλοποιούν χωριστά η 2D και η 3D
 * προβολή, και το μοναδικό σημείο όπου οι δύο διαστάσεις επιτρέπεται να διαφέρουν.
 *
 * @see ./text-editor-anchor-2d.ts — ο 2D resolver (άμεσο affine transform)
 * @see ../../bim-3d/text/text-edit-anchor-3d.ts — ο 3D resolver (προβολή κάμερας)
 */
export interface TextEditorAnchor {
  /** Άνω-αριστερή γωνία του editor σε client px, ή `null` όταν το άγκυρο δεν προβάλλεται. */
  readonly project: () => { x: number; y: number } | null;
  /** Δήλωσε callback επαναπροβολής (pan/zoom/orbit driver)· επίστρεψε τη συνάρτηση αποδέσμευσης. */
  readonly subscribe: (reproject: () => void) => () => void;
  /** Ελάχιστες διαστάσεις του κουτιού (px) — για το clamping και το αρχικό layout. */
  readonly size: { readonly width: number; readonly height: number };
}

export interface TextEditorAnchorLayerProps extends TextEditorAnchor {
  readonly children: React.ReactNode;
}

/**
 * Περιόρισε την άνω-αριστερή γωνία ώστε τουλάχιστον {@link MIN_VISIBLE_PX} του editor να
 * μένουν μέσα στο παράθυρο. `keyboardInset` (κινητό soft keyboard) κόβει από το κάτω όριο.
 */
function clampToViewport(
  p: { x: number; y: number },
  size: { width: number; height: number },
  keyboardInset: number,
): { x: number; y: number } {
  const maxX = window.innerWidth - MIN_VISIBLE_PX;
  const usableHeight = window.innerHeight - keyboardInset;
  const maxY = Math.max(0, usableHeight - Math.min(size.height, MIN_VISIBLE_PX));
  return {
    x: Math.min(Math.max(p.x, MIN_VISIBLE_PX - size.width), maxX),
    y: Math.min(Math.max(p.y, 0), maxY),
  };
}

export function TextEditorAnchorLayer(props: TextEditorAnchorLayerProps): React.ReactElement {
  const { project, subscribe, size, children } = props;
  const { keyboardInset } = useVisualViewport();
  const ref = useRef<HTMLDivElement | null>(null);
  // ADR-040 — το `keyboardInset` διαβάζεται ΜΕΣΑ στο tick μέσω ref, όχι ως dependency του
  // effect: αλλιώς κάθε αλλαγή visual-viewport θα ξανάδενε τη συνδρομή του scheduler.
  const insetRef = useRef(keyboardInset);
  insetRef.current = keyboardInset;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    const reproject = (): void => {
      const el = ref.current;
      if (!el) return;
      // Το άγκυρο εκτός προβολής (πίσω από την κάμερα) ΔΕΝ κρύβει τον editor — θα έσβηνε
      // το κουτί κάτω από τα δάχτυλα του χρήστη μεσοπληκτρολόγησης. Κρατιέται στην
      // τελευταία έγκυρη θέση, περιορισμένο στο viewport.
      const p = project();
      if (!p) return;
      const c = clampToViewport(p, sizeRef.current, insetRef.current);
      el.style.transform = `translate(${c.x}px, ${c.y}px)`;
    };
    reproject();
    return subscribe(reproject);
  }, [project, subscribe]);

  return (
    <div
      ref={ref}
      className="fixed left-0 top-0 z-40 will-change-transform"
      style={{ minWidth: size.width, minHeight: size.height }}
    >
      {children}
    </div>
  );
}
