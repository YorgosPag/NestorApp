'use client';

/**
 * KpiCard — Το ΕΝΑ κέλυφος των καρτών της επισκόπησης προμηθειών έργου (ADR-330 §5.1 S3.1).
 *
 * Οι τέσσερις κάρτες έγραφαν το ίδιο `Card → HeaderBar → CardTitle + εικονίδιο` με το χέρι.
 * Εδώ ζει μία φορά, μαζί με τη συμπεριφορά drill-down:
 *
 *   - `href` παρόν ⇒ η κάρτα ΕΙΝΑΙ σύνδεσμος (`<a>`): πληκτρολόγιο, Ctrl+κλικ σε νέα καρτέλα,
 *     μεσαίο κλικ, αναγνώστης οθόνης — όλα δωρεάν, γιατί είναι πραγματικός σύνδεσμος, όχι `onClick`.
 *   - `href` απόν ⇒ στατική κάρτα. Ο καλών το αφήνει απόν όταν ο δείκτης είναι 0: σύνδεσμος προς
 *     άδεια λίστα είναι αδιέξοδο (Stripe/Linear δεν κάνουν drill σε μηδενικό μετρητή).
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, type WorkspaceHref } from '@/lib/workspace/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderBar } from '@/components/ui/header-bar';
import { COMPLEX_HOVER_EFFECTS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';

interface KpiCardProps<T extends string> {
  label: string;
  icon: LucideIcon;
  /** Προορισμός drill-down· απόν ⇒ η κάρτα δεν είναι διαδραστική. */
  href?: WorkspaceHref<T>;
  children: ReactNode;
}

export function KpiCard<T extends string>({ label, icon: Icon, href, children }: KpiCardProps<T>) {
  const card = (
    <Card className={cn('h-full', href && cn('cursor-pointer', COMPLEX_HOVER_EFFECTS.FEATURE_CARD))}>
      <CardHeader className="pb-2">
        <HeaderBar wrap={false} actions={<Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}>
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </HeaderBar>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {card}
    </Link>
  );
}
