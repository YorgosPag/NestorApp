'use client';

/**
 * @fileoverview Σύνδεσμος «πήγαινε να το συμπληρώσεις» από μια εξήγηση φόρου στη Ρύθμιση Επιχείρησης.
 * @description Οι σημειώσεις του φόρου (προκαταβολή · κάλυψη διανομής) λένε **γιατί** ένα ποσό είναι αυτό
 *   ή γιατί λείπει — και όταν λείπει στοιχείο, δείχνουν **πού** συμπληρώνεται. Ένας σύνδεσμος, ένα στυλ.
 * @see ADR-ACC-009
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import type { ReactNode } from 'react';
import { Link } from '@/lib/workspace/navigation';

interface SetupLinkProps {
  /** Ήδη μεταφρασμένο κείμενο — το `t()` μένει στον καλούντα με κυριολεκτικό κλειδί (CHECK 3.8). */
  readonly children: ReactNode;
}

export function SetupLink({ children }: SetupLinkProps) {
  return (
    <>
      {' '}
      <Link href="/accounting/setup" className="underline underline-offset-2">
        {children}
      </Link>
    </>
  );
}
