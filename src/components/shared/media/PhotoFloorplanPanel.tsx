'use client';

/**
 * @fileoverview 📍 **ΤΟ ΠΑΝΕΛ «ΠΟΥ ΤΡΑΒΗΧΤΗΚΕ»** — δίπλα στη φωτογραφία, όλες οι κατόψεις με σημεία (ADR-897 Φ4 · πρότυπο Zillow).
 * @related PhotoLightbox.tsx (ο κάτοχος) · FloorplanSpotsFigure.tsx (κάθε κάτοψη) · lib/media/photo-floorplan-spots
 * @module components/shared/media/PhotoFloorplanPanel
 *
 * 🔑 **Ουδέτερο ως προς την πηγή** (ADR-899 §8): δημόσια αγγελία **και** ιδιωτικό ακίνητο δίνουν το ίδιο
 *   `FloorplanSpotsEntry` μέσω δικού τους προσαρμογέα — ένα πάνελ, όχι δύο.
 *
 * 🔑 **Όλοι οι όροφοι μαζί, όχι καρτέλες** — όπως η Zillow («Floor 1» · «Basement»): ο επισκέπτης βλέπει **όλα** τα
 *   σημεία με μια ματιά και πηδά σε όποιον όροφο θέλει χωρίς να ψάξει σε ποια καρτέλα είναι.
 * 🏆 **Πάνω από τη Zillow**: όταν η τρέχουσα φωτογραφία **δεν** έχει θέση, το λέμε (αντί να μένει ο κώνος της
 *   προηγούμενης ή να μην αλλάζει τίποτα σιωπηλά).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { floorplanEntryOf, type FloorplanSpotsEntry } from '@/lib/media/photo-floorplan-spots';

import { FloorplanSpotsFigure } from './FloorplanSpotsFigure';

export interface PhotoFloorplanPanelProps {
  readonly floorplans: readonly FloorplanSpotsEntry[];
  readonly total: number;
  readonly currentIndex: number;
  readonly onGo: (imageIndex: number) => void;
}

export function PhotoFloorplanPanel({ floorplans, total, currentIndex, onGo }: PhotoFloorplanPanelProps) {
  const { t } = useTranslation(['listing-detail']);
  const placed = floorplanEntryOf(floorplans, currentIndex) !== null;

  return (
    <aside aria-labelledby="photo-floorplan-panel-title"
      className="flex max-h-[40vh] min-h-0 flex-col gap-3 overflow-auto border-t border-border bg-background p-4 lg:max-h-none lg:border-l lg:border-t-0">
      <header className="flex flex-col gap-1">
        <h2 id="photo-floorplan-panel-title" className="m-0 text-base font-semibold">
          {t('listing-detail:media.capture.panelTitle')}
        </h2>
        <p className="m-0 text-xs text-muted-foreground">{t('listing-detail:media.capture.panelHint')}</p>
        {!placed && (
          <p role="status" className="m-0 text-xs text-muted-foreground">{t('listing-detail:media.capture.notPlaced')}</p>
        )}
      </header>
      <ul aria-label={t('listing-detail:media.capture.floorplansLabel')} className="m-0 flex list-none flex-col gap-3 p-0">
        {floorplans.map((entry) => (
          <li key={entry.key}>
            <FloorplanSpotsFigure entry={entry} total={total} currentImageIndex={currentIndex}
              onActivate={onGo} sizes="(min-width: 1024px) 22rem, 90vw" />
          </li>
        ))}
      </ul>
    </aside>
  );
}
