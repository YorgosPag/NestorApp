'use client';

/**
 * 🗂️ **ΤΟ ΕΝΑ ΚΕΛΥΦΟΣ ΤΟΥ ΠΡΟΒΟΛΕΑ ΜΕΣΩΝ** — λωρίδα καρτελών + σκηνή, χωρίς καμία ανάγνωση δεδομένων.
 *
 * Το ίδιο κέλυφος φορούν **δύο** προσαρμογείς: ο εταιρικός (`ReadOnlyMediaViewer` — αρχεία του χώρου, DXF, επικαλύψεις)
 * και ο δημόσιος (η αγγελία — η κλειστή προβολή `PublicListing`). Η **εμφάνιση** έχει μία πηγή· τα **δεδομένα** μένουν
 * δύο, επίτηδες: ο ανώνυμος επισκέπτης δεν έχει χώρο, και το κέλυφος δεν πρέπει να μάθει ποτέ τι είναι `companyId`.
 *
 * ⛔ Κανένα hook δεδομένων, καμία πλοήγηση, κανένα namespace i18n εδώ: οι ετικέτες έρχονται **έτοιμες** από τον
 * προσαρμογέα (η δημόσια διαδρομή φορτώνει δικό της τεμάχιο μεταφράσεων) και η ενεργή καρτέλα είναι **ελεγχόμενη**.
 *
 * @module components/shared/media/viewer/MediaViewerShell
 */

import '@/lib/design-system';
import type { ReactElement, ReactNode } from 'react';
import { AlertCircle, RefreshCw, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface MediaViewerTab {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Πλήθος δίπλα στην ετικέτα — εμφανίζεται μόνο όταν είναι θετικό (ο προσαρμογέας το παραλείπει όσο φορτώνει). */
  readonly count?: number;
  /** Η σκηνή κυλά (πλέγμα φωτογραφιών) αντί να γεμίζει το ύψος (καμβάς κάτοψης). */
  readonly scroll?: boolean;
  readonly panel: ReactNode;
}

/**
 * **Ποιος κατέχει το ύψος της σκηνής.**
 * - `fill` — ο **γονιός**: το κέλυφος γεμίζει ό,τι του δόθηκε και η σκηνή κυλά μέσα του (πίνακας εφαρμογής, καμβάς κάτοψης).
 * - `flow` — το **περιεχόμενο**: το κέλυφος έχει το ύψος της ενεργής σκηνής και κυλά η **σελίδα** (έγγραφο, π.χ. αγγελία).
 *
 * 🔴 Δεν είναι ύφος: ένα `fill` μέσα σε στήλη εγγράφου **τεντώνεται** ως το ύψος της διπλανής στήλης — μετρημένο στον
 * browser 2026-10-07: κάρτα **2.971px** για περιεχόμενο **439px**, με τον χάρτη σπρωγμένο 2,5 οθόνες κάτω (ADR-907 §7).
 */
export type MediaViewerLayout = 'fill' | 'flow';

interface ShellLayoutClasses {
  readonly card: string;
  readonly tabs: string;
  readonly stage: string;
  readonly panel: string;
}

const LAYOUT_CLASSES: Record<MediaViewerLayout, ShellLayoutClasses> = {
  fill: {
    card: 'flex-1 flex flex-col min-h-0 overflow-hidden',
    tabs: 'flex-1 flex flex-col min-h-0',
    stage: 'flex-1 min-h-0 overflow-hidden',
    panel: 'h-full',
  },
  // `flex-none`: το `TabsContent` της βάσης φέρνει δικό του `flex-1` — εδώ αναιρείται ρητά, δεν αφήνεται «αδρανές».
  flow: { card: 'overflow-hidden', tabs: '', stage: '', panel: 'flex-none' },
};

export interface MediaViewerShellProps {
  readonly tabs: readonly MediaViewerTab[];
  readonly activeTab: string;
  readonly onTabChange: (tabId: string) => void;
  /** Προεπιλογή `fill` — η συμπεριφορά του χώρου. Η σελίδα-έγγραφο δηλώνει `flow`. */
  readonly layout?: MediaViewerLayout;
  readonly className?: string;
}

export function MediaViewerShell({ tabs, activeTab, onTabChange, layout = 'fill', className }: MediaViewerShellProps): ReactElement {
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const classes = LAYOUT_CLASSES[layout];

  return (
    <Card data-media-viewer-layout={layout} className={cn(classes.card, className)}>
      <Tabs value={activeTab} onValueChange={onTabChange} className={classes.tabs}>
        <TabsList className={cn('shrink-0 w-full flex-wrap justify-start rounded-none border-b bg-transparent h-auto', spacing.padding.sm)}>
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <TabsTrigger key={id} value={id} className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 px-3 py-1.5">
              <Icon className={iconSizes.sm} aria-hidden="true" />
              <span className="text-xs">{label}</span>
              {count !== undefined && count > 0 && (
                <span className={cn('ml-1 text-xs', colors.text.muted)}>({count})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <section className={classes.stage}>
          {tabs.map(({ id, scroll, panel }) => (
            <TabsContent key={id} value={id} className={cn('m-0 data-[state=inactive]:hidden', classes.panel, scroll && layout === 'fill' && 'overflow-auto')}>
              {panel}
            </TabsContent>
          ))}
        </section>
      </Tabs>
    </Card>
  );
}

export interface MediaViewerEmptyStateProps {
  readonly icon: LucideIcon;
  readonly message: string;
  readonly className?: string;
}

/** Το κέλυφος **χωρίς** αντικείμενο προβολής (π.χ. κανένα επιλεγμένο ακίνητο) — ίδιο πλαίσιο, ώστε η διάταξη να μη χοροπηδά. */
export function MediaViewerEmptyState({ icon: Icon, message, className }: MediaViewerEmptyStateProps): ReactElement {
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <Card className={cn('flex-1 flex flex-col min-h-0', className)}>
      <CardContent className={cn('flex-1 flex items-center justify-center', spacing.padding.md)}>
        <figure className={cn('text-center', colors.text.muted)}>
          <Icon className={cn(iconSizes['2xl'], 'mx-auto mb-3 opacity-50')} aria-hidden="true" />
          <figcaption className="text-sm">{message}</figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}

export interface MediaViewerPanelLabels {
  readonly loading: string;
  readonly error: string;
  readonly retry: string;
}

export interface MediaViewerPanelStateProps {
  readonly loading: boolean;
  readonly error: Error | null;
  readonly onRetry: () => void;
  readonly labels: MediaViewerPanelLabels;
  readonly children: ReactNode;
}

/** Οι καταστάσεις **μίας** σκηνής: φόρτωση, σφάλμα με επανάληψη, αλλιώς το περιεχόμενο. */
export function MediaViewerPanelState({ loading, error, onRetry, labels, children }: MediaViewerPanelStateProps): ReactElement {
  const spacing = useSpacingTokens();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  if (loading) {
    return (
      <div className={cn('h-full flex items-center justify-center', spacing.padding.md)}>
        <figure className={cn('text-center', colors.text.muted)}>
          <Spinner size="large" className="mx-auto mb-3" />
          <figcaption className="text-sm">{labels.loading}</figcaption>
        </figure>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('h-full flex items-center justify-center', spacing.padding.md)}>
        <figure className="text-center">
          <AlertCircle className={cn(iconSizes.xl, 'mx-auto mb-3 text-destructive')} aria-hidden="true" />
          <figcaption className={cn('text-sm mb-4', colors.text.muted)}>{labels.error}</figcaption>
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className={iconSizes.sm} aria-hidden="true" />
            {labels.retry}
          </Button>
        </figure>
      </div>
    );
  }

  return <>{children}</>;
}
