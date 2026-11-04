'use client';

/**
 * HubSectionCard — Το ΕΝΑ κέλυφος των καρτών-ενοτήτων του hub προμηθειών (ADR-330 §5.1 S3.4).
 *
 * Οι έξι κάρτες έγραφαν το ίδιο `Card` με `onClick` + `role="button"` + `onKeyDown` με το χέρι. Ένα `div` που
 * παριστάνει κουμπί δεν ανοίγει σε νέα καρτέλα (Ctrl/μεσαίο κλικ), δεν δείχνει διεύθυνση στο hover και δεν
 * πατιέται με Space. Εδώ η κάρτα **είναι** σύνδεσμος (`<a>`), όπως το `KpiCard` της επισκόπησης έργου.
 *
 * 🔑 **Η κάρτα-ενότητα είναι πάντα είσοδος** στην ενότητά της· ο καλών δίνει `href` ήδη φιλτραρισμένο σε ό,τι
 * μετρά ο αριθμός όταν είναι > 0, και καθαρό όταν είναι 0 (φίλτρο σε άδεια λίστα = αδιέξοδο).
 *
 * @module components/procurement/hub/cards/HubSectionCard
 */

import type { LucideIcon } from 'lucide-react';
import { Link, type WorkspaceHref } from '@/lib/workspace/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HubSectionCardProps<T extends string> {
  readonly icon: LucideIcon;
  /** Χρώμα εικονιδίου (θεματικό token). */
  readonly iconClassName: string;
  readonly title: string;
  readonly description: string;
  readonly href: WorkspaceHref<T>;
  /** Ο αριθμός της κάρτας, ήδη μεταφρασμένος· απών ⇒ κάρτα χωρίς μετρητή. */
  readonly metric?: string;
  /** Δευτερεύουσα γραμμή (π.χ. «Χωρίς ενεργά αιτήματα»). */
  readonly hint?: string;
}

export function HubSectionCard<T extends string>({
  icon: Icon, iconClassName, title, description, href, metric, hint,
}: HubSectionCardProps<T>) {
  return (
    <Link
      href={href}
      className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50">
        <CardHeader className="pb-2">
          <Icon className={cn('h-8 w-8', iconClassName)} aria-hidden />
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {metric !== undefined && <p className="text-2xl font-bold text-foreground">{metric}</p>}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}
