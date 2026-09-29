'use client';

/**
 * **Τα σημεία εισόδου του χάρτη τιμών** (ADR-890 §14) — ό,τι εισάγει στατικά η σελίδα αποτελεσμάτων. Όλα τα υπόλοιπα
 * (διακόπτης, πάνελ, στρώση) είναι **δυναμικά**: ο επισκέπτης που δεν ανοίγει τη στρώση δεν κατεβάζει ούτε κώδικα,
 * ούτε κλειδιά (`price-map`), ούτε γεωμετρία — και κανένα κλειδί τους δεν μετρά στο route slice (CHECK 3.34).
 */

import dynamic from 'next/dynamic';
import React from 'react';

import { usePriceMapModel } from './PriceMapProvider';

/** Ο διακόπτης (+ πάνελ) — υποδοχή `layerControl` του `MapAreaControl`. */
export const LazyPriceMapControl = dynamic(() => import('./PriceMapControl'), { ssr: false });

const LazyPriceMapLayer = dynamic(() => import('./PriceMapLayer'), { ssr: false });

/** Παιδί του `ResultsMap`: η στρώση υπάρχει **μόνο** όσο είναι ανοιχτή. */
export function PriceMapMapLayer() {
  const { visible } = usePriceMapModel();
  return visible ? <LazyPriceMapLayer /> : null;
}
