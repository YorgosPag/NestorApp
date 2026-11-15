'use client';

/**
 * @fileoverview ADR-915 §28 · §42 — **ένα γεγονός της σελίδας-συνδέσμου** (`<dt>` + `<dd>`): κοινό για την κάρτα και τα
 *   τεμπέλικα τμήματα της προσφοράς, ώστε το όριο `next/dynamic` να μη διπλασιάζει τη σήμανση.
 * @module app/(auth)/document-request/DocumentRequestFact
 */

import React from 'react';

export function Fact({ term, children }: { readonly term: string; readonly children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="m-0 text-sm text-card-foreground">{children}</dd>
    </>
  );
}
