/**
 * Μια ενότητα με επικεφαλίδα μέσα στον έλεγχο / τη λεπτομέρεια ρήτρας (ADR-928 Φ3γ-0) — `section` + `aria-labelledby`.
 * Κοινή για `ClauseReviewPanel` και `ClauseDetail` (N.18: κανένα δίδυμο).
 */

import type { ReactNode } from 'react';

export function LibrarySection({ id, title, children }: { readonly id: string; readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h4 id={id} className="m-0 text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}
