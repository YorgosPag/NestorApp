'use client';

/**
 * 🔍 **ΤΟ ΖΟΥΜ ΣΕΛΙΔΑΣ ΕΓΓΡΑΦΟΥ** — `−` · `[125 % ▾]` · `+` · `↔` (ADR-928 §5.25). Ένα σύνολο για **κάθε** θεατή σελίδας:
 * τον προβολέα PDF (`PdfCanvasViewer`) και το έγγραφο υπεργολαβίας (`DocumentZoomBar`).
 *
 * 🏆 Word · Google Docs · Figma: −/+ πατούν **σκαλί** της σκάλας (`ladderZoom` — 90 → 100 → 110 %, ποτέ ×1,1), το
 *    ποσοστό ανοίγει μενού με έτοιμες τιμές και «Προσαρμογή στο πλάτος», και το `↔` γυρίζει στην προσαρμογή.
 * ♿ Η επιλεγμένη τιμή είναι **radio** στο μενού (ο αναγνώστης οθόνης ακούει ποια ισχύει)· το `↔` δηλώνει `aria-pressed`·
 *    το νέο ποσοστό ανακοινώνεται (`role="status"`) **μόνο** όταν το ζήτησε ο άνθρωπος — όχι σε κάθε pixel συρσίματος
 *    της «Προσαρμογής».
 * 🔑 **Ελεγχόμενο**: δεν ξέρει τίποτα για DOM, canvas ή αποθήκευση — ο φιλοξενών κρατά το ζουμ και τα όριά του.
 *
 * @module components/shared/media/viewer/DocumentZoomControl
 */

import '@/lib/design-system';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { zoomPresetsWithin, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';
import { formatPercentage } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';

import { ViewerToolbarButton } from './ViewerToolbarButton';

export interface DocumentZoomControlProps {
  /** Το ζουμ που **ισχύει** (και στην «Προσαρμογή» — το υπολογισμένο), 1 = 100 %. */
  readonly zoom: number;
  /** «Προσαρμογή στο πλάτος» ενεργή. */
  readonly fitted: boolean;
  /** «Προσαρμογή στη σελίδα» ενεργή — μόνο για θεατή που τη δίνει (`onFitPage`). */
  readonly pageFitted?: boolean;
  readonly limits: ZoomLimits;
  readonly onStep: (direction: 1 | -1) => void;
  readonly onZoomTo: (zoom: number) => void;
  readonly onFit: () => void;
  /**
   * ADR-928 §5.25.2 — θεατής **σελιδοποιημένου** εγγράφου (PDF: Chrome · Acrobat · pdf.js) ⇒ και «Προσαρμογή στη σελίδα»
   * στο μενού. Απούσα ⇒ δεν δείχνεται (το έγγραφο υπεργολαβίας ρέει, δεν έχει «ολόκληρη σελίδα» να χωρέσει).
   */
  readonly onFitPage?: () => void;
  readonly className?: string;
}

const FIT_VALUE = 'fit';
const FIT_PAGE_VALUE = 'fit-page';

function selectedValueOf(zoom: number, fitted: boolean, pageFitted: boolean, presets: readonly number[]): string {
  if (fitted) return FIT_VALUE;
  if (pageFitted) return FIT_PAGE_VALUE;
  return presets.find((preset) => Math.abs(preset - zoom) < 0.005)?.toString() ?? '';
}

function percentOf(zoom: number): string {
  return formatPercentage(zoom * 100, { maximumFractionDigits: 0 });
}

/** Η ανακοίνωση ακολουθεί το ζουμ **μόνο** μετά από ενέργεια του ανθρώπου (σημαία που σηκώνουν οι χειριστές). */
function useUserZoomAnnouncement(zoom: number): { readonly announcement: string; readonly markUserAction: () => void } {
  const pending = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    setAnnouncement(percentOf(zoom));
  }, [zoom]);
  return { announcement, markUserAction: () => { pending.current = true; } };
}

function ZoomLevelMenu({ zoom, fitted, pageFitted = false, limits, onZoomTo, onFit, onFitPage, onUserAction }: Omit<DocumentZoomControlProps, 'onStep' | 'className'> & { readonly onUserAction: () => void }) {
  const { t } = useTranslation('common');
  const level = percentOf(zoom);
  const presets = zoomPresetsWithin(limits);
  const selected = selectedValueOf(zoom, fitted, pageFitted, presets);
  const choose = (value: string) => {
    onUserAction();
    if (value === FIT_VALUE) onFit();
    else if (value === FIT_PAGE_VALUE) onFitPage?.();
    else onZoomTo(Number(value));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-0.5 px-1.5 text-xs tabular-nums" aria-label={t('documentZoom.level', { percent: level })}>
          {level}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[11rem]">
        <DropdownMenuRadioGroup value={selected} onValueChange={choose}>
          <DropdownMenuRadioItem value={FIT_VALUE}>{t('documentZoom.fitWidth')}</DropdownMenuRadioItem>
          {onFitPage && <DropdownMenuRadioItem value={FIT_PAGE_VALUE}>{t('documentZoom.fitPage')}</DropdownMenuRadioItem>}
          <DropdownMenuSeparator />
          {presets.map((preset) => (
            <DropdownMenuRadioItem key={preset} value={preset.toString()} className="tabular-nums">{percentOf(preset)}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocumentZoomControl({ zoom, fitted, pageFitted, limits, onStep, onZoomTo, onFit, onFitPage, className }: DocumentZoomControlProps) {
  const { t } = useTranslation('common');
  const { announcement, markUserAction } = useUserZoomAnnouncement(zoom);
  const step = (direction: 1 | -1) => { markUserAction(); onStep(direction); };
  return (
    <section role="group" aria-label={t('documentZoom.label')} className={cn('flex items-center gap-0.5', className)}>
      <ViewerToolbarButton label={t('documentZoom.zoomOut')} icon={ZoomOut} onClick={() => step(-1)} disabled={zoom <= limits.min + 0.005} />
      <ZoomLevelMenu
        zoom={zoom} fitted={fitted} pageFitted={pageFitted} limits={limits}
        onZoomTo={onZoomTo} onFit={onFit} onFitPage={onFitPage} onUserAction={markUserAction}
      />
      <ViewerToolbarButton label={t('documentZoom.zoomIn')} icon={ZoomIn} onClick={() => step(1)} disabled={zoom >= limits.max - 0.005} />
      <ViewerToolbarButton label={t('documentZoom.fitWidth')} icon={MoveHorizontal} onClick={() => { markUserAction(); onFit(); }} pressed={fitted} />
      <span role="status" className="sr-only">{announcement}</span>
    </section>
  );
}
