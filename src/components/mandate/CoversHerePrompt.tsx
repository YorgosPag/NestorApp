'use client';

/**
 * @fileoverview **«ΠΟΙΟΣ ΚΑΛΥΠΤΕΙ ΕΔΩ;»** — η κάρτα σημείου μετά από κλικ σε κενό του χάρτη του καταλόγου (ADR-896 §7.1).
 * @related hooks/useContainingArea.ts (η μέτρηση) · AgencyDirectoryMap · AgencyMapPopup (το ίδιο κέλυφος)
 * @module components/mandate/CoversHerePrompt
 *
 * 🔑 **ΟΠΩΣ ΤΟ GOOGLE MAPS**: το κλικ σε κενό σημείο ανοίγει **κάρτα του σημείου**, δεν εκτελεί πράξη. Η πράξη (φίλτρο)
 * είναι **ένα** κουμπί μέσα της — έτσι το «κλικ έξω για αποεπιλογή» δεν γίνεται ποτέ κατά λάθος αλλαγή φίλτρου.
 *
 * 🏆 **ΠΕΡΑ ΑΠΟ ΤΟ GOOGLE**: η κάρτα **ονομάζει** την περιοχή (κοινότητα/δήμος Καλλικράτη, μετρημένη πάνω στα **ίδια**
 * αποτυπώματα που κρίνουν την κάλυψη) **πριν** τη ζητήσεις — ό,τι ονομάζεται είναι ακριβώς ό,τι θα φιλτράρει, και ο
 * χάρτης ζωγραφίζει το όριό της. Διοικητικό φίλτρο ⇒ **μόνο φίλτρο, καμία σειρά** (ADR-843) και **καμία συντεταγμένη**
 * στη διεύθυνση.
 *
 * ⚠️ Δεν αποδίδεται περιοχή (θάλασσα, δεδομένα που δεν φόρτωσαν) ⇒ το λέει, **χωρίς** κουμπί — ποτέ φίλτρο «πουθενά».
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useContainingArea } from '@/hooks/useContainingArea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { GeoPoint } from '@/types/geo/coordinates';
import { ListingMapPopupFrame } from '@/components/search-results/ListingMapPopupFrame';

import { AGENCY_PUBLIC_NS, DIRECTORY_MAP_KEYS } from './agency-directory-labels';

interface CoversHerePromptProps {
  readonly point: GeoPoint;
  readonly onPick: (adminId: string) => void;
  readonly onClose: () => void;
}

export function CoversHerePrompt({ point, onPick, onClose }: CoversHerePromptProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const area = useContainingArea(point);

  return (
    <ListingMapPopupFrame point={point} onClose={onClose}>
      <section aria-label={t(DIRECTORY_MAP_KEYS.coversHereLabel)} className="flex w-52 flex-col items-start gap-2">
        {/* `popover-foreground`: το ζεύγος της αιωρούμενης επιφάνειας (ADR-770 · CHECK 3.39). */}
        <h3 className="m-0 text-sm font-medium text-popover-foreground">
          {area?.name ?? t(DIRECTORY_MAP_KEYS.coversHereOutside)}
        </h3>
        {area !== null && (
          <Button type="button" size="sm" onClick={() => onPick(area.adminId)}>
            {t(DIRECTORY_MAP_KEYS.coversHereAction)}
          </Button>
        )}
      </section>
    </ListingMapPopupFrame>
  );
}
