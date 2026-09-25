'use client';

/**
 * **Προς ποια πλευρά συνεχίζει μια λωρίδα οριζόντιας κύλισης;** (ADR-777 §8.79 · 2026-09-25)
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: στα 390 px οι τέσσερις καρτέλες του ήρωα έγιναν λωρίδα κύλισης (Material 3:
 * «scrollable tabs» όταν δεν χωρούν). Η τελευταία κοβόταν **απότομα** — «Επαγ|» — και ο άνθρωπος το
 * διάβασε ως **σφάλμα**, όχι ως «σύρε για περισσότερα» (στιγμιότυπο Giorgio, 19:58). Μια κομμένη
 * λέξη χωρίς σήμα είναι αμφίσημη· ένα **σβήσιμο** στην άκρη λέει «συνεχίζει» σε κάθε γλώσσα.
 *
 * 🔑 **ΑΠΑΝΤΑ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΑΛΗΘΕΙΑ**: σβήνει την άκρη **μόνο** όταν πίσω της υπάρχει περιεχόμενο.
 * Μάσκα άνευ όρων θα έσβηνε και την **τελευταία** καρτέλα όταν ο άνθρωπος έχει φτάσει στο τέλος —
 * δηλαδή θα έλεγε «συνεχίζει» εκεί που **δεν** συνεχίζει. Όταν όλα χωρούν (desktop): `none`.
 *
 * ⚡ Παθητικός `scroll` + `ResizeObserver` — κανένα polling, καμία ανάγνωση διάταξης ανά frame.
 * Η τιμή είναι **μία** συμβολοσειρά (`none|start|end|both`), όχι δύο booleans: οι δύο μάσκες δεν
 * συντίθενται στο CSS (η δεύτερη `mask-image` **αντικαθιστά** την πρώτη), άρα το «και τα δύο»
 * είναι δική του κατάσταση με δικό του κανόνα.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type ScrollEdges = 'none' | 'start' | 'end' | 'both';

/** Μισό pixel ανοχής: υποπίξελ κύλιση (zoom, DPR) δεν είναι «υπάρχει κι άλλο». */
const EPSILON = 1;

/** Καθαρή κρίση — εξάγεται για τα tests· ο browser δίνει τους αριθμούς, όχι το jsdom. */
export function scrollEdgesOf(scrollLeft: number, clientWidth: number, scrollWidth: number): ScrollEdges {
  // RTL: το `scrollLeft` είναι ≤ 0 — η απόσταση από την αρχή είναι η απόλυτη τιμή του.
  const fromStart = Math.abs(scrollLeft);
  const hasBefore = fromStart > EPSILON;
  const hasAfter = fromStart + clientWidth < scrollWidth - EPSILON;
  if (hasBefore && hasAfter) return 'both';
  if (hasBefore) return 'start';
  if (hasAfter) return 'end';
  return 'none';
}

/**
 * @returns `ref` για το στοιχείο που κυλά, και `edges` για το `data-scroll-edges` του.
 */
export function useScrollEdges<T extends HTMLElement>(): {
  readonly ref: (node: T | null) => void;
  readonly edges: ScrollEdges;
} {
  const [node, setNode] = useState<T | null>(null);
  const [edges, setEdges] = useState<ScrollEdges>('none');
  const frame = useRef(0);

  useEffect(() => {
    if (node === null) return undefined;
    const measure = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() =>
        setEdges(scrollEdgesOf(node.scrollLeft, node.clientWidth, node.scrollWidth)),
      );
    };
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    // Περιβάλλοντα χωρίς διάταξη (jsdom) δεν έχουν ResizeObserver — εκεί μένει μόνο η κύλιση.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    // Και τα παιδιά: αλλαγή γλώσσας αλλάζει το ΠΛΑΤΟΣ των ετικετών χωρίς να αλλάξει το δοχείο.
    for (const child of Array.from(node.children)) observer?.observe(child);
    return () => {
      cancelAnimationFrame(frame.current);
      node.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [node]);

  const ref = useCallback((next: T | null) => setNode(next), []);
  return { ref, edges };
}
