'use client';

/**
 * @fileoverview **ΤΟ ΑΝΑΓΛΥΦΟ ΣΕ ΚΑΤΟΨΗ ΚΑΙ ΣΕ 3Δ** — η ΜΙΑ όψη για τη δημόσια αγγελία (Β6.6) και το «Βελτίωσε» (Β6.7)
 *   (ADR-920 §14.5).
 * @related `TerrainContourMap.tsx` (η κάτοψη) · `3d/Terrain3dCanvas.tsx` (το 3Δ, δυναμικά) ·
 *   `../ListingModelStage.tsx` (το ίδιο σκαλί αποκάλυψης για τα μοντέλα)
 * @module components/listing-detail/terrain/TerrainViewStage
 *
 * 🔑 **Το three ΔΕΝ κατεβαίνει αν δεν ζητηθεί**: η καρτέλα «3Δ» δείχνει πρώτα **κάρτα εισόδου** (αληθινό περιεχόμενο,
 *   ADR-777 Α19 κανόνας 30)· μόνο το πάτημα φέρνει το κομμάτι — μαζί με τα κείμενά του, ως ένα αίτημα
 *   (`terrain-surfaces.tsx`, `defineLazySurfaces`, ADR-920 Β6.6).
 * 🔑 **Ρωτά πριν υποθέσει** (`isWebGLAvailable`): χωρίς WebGL ο επισκέπτης διαβάζει εξήγηση, και η κάτοψη, που δείχνει
 *   το ίδιο ανάγλυφο, μένει μία καρτέλα μακριά. Ποτέ μαύρο κουτί.
 * 🔑 **Η κάτοψη κρατά την κατάστασή της** (`forceMount`): «Κλίσεις» → 3Δ → πίσω ⇒ ξανά «Κλίσεις». Το 3Δ αντίθετα
 *   **αποπροσαρτάται** όταν κρύβεται: η GPU ελευθερώνεται, και η επιστροφή ξαναχτίζει τη σκηνή από το κομμάτι που ήδη
 *   κατέβηκε, χωρίς δεύτερη κάρτα εισόδου.
 */

import { useCallback, useState, type ReactNode } from 'react';

import { ListingStageFailure } from '@/components/listing-detail/ListingStageFailure';
import { MODEL_STAGE_ASPECT_CLASS } from '@/components/listing-detail/listing-model-stage-metrics';
import { Card } from '@/components/ui/card';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isWebGLAvailable } from '@/lib/browser/webgl-support';
import {
  LISTING_TERRAIN_3D_EXAGGERATIONS,
  type ListingTerrain3dExaggeration,
} from '@/lib/terrain/publication/listing-terrain-config';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import type { TerrainMapModel } from '@/lib/terrain/publication/terrain-map-model';

import { TerrainContourMap } from './TerrainContourMap';
import { LazyTerrain3dCanvas, TERRAIN_STAGE_NOTICE_BOX as NOTICE_BOX } from './terrain-surfaces';

const NS = 'listing-detail:terrain.view';

type T = ReturnType<typeof useTranslation>['t'];
type ThreeDState = 'idle' | 'revealed' | 'failed' | 'unsupported';

export interface TerrainViewStageProps {
  readonly model: TerrainMapModel;
  readonly snapshot: ListingTerrainSnapshot;
}

export function TerrainViewStage({ model, snapshot }: TerrainViewStageProps) {
  const { t } = useTranslation(['listing-detail']);
  const [threeD, setThreeD] = useState<ThreeDState>('idle');
  const [exaggeration, setExaggeration] = useState<ListingTerrain3dExaggeration>(1);
  const reveal = useCallback(() => setThreeD(isWebGLAvailable() ? 'revealed' : 'unsupported'), []);
  const fail = useCallback(() => setThreeD('failed'), []);
  return (
    <Tabs defaultValue="plan" className="flex flex-col gap-3" data-terrain-view-stage="">
      <TabsList aria-label={t(`${NS}.tabs.label`)} className="self-start">
        <TabsTrigger value="plan">{t(`${NS}.tabs.plan`)}</TabsTrigger>
        <TabsTrigger value="threeD">{t(`${NS}.tabs.threeD`)}</TabsTrigger>
      </TabsList>
      <TabsContent value="plan" forceMount>
        <TerrainContourMap model={model} />
      </TabsContent>
      <TabsContent value="threeD">
        <ThreeDPanel state={threeD} onReveal={reveal} t={t}>
          <ExaggerationSwitch value={exaggeration} onChange={setExaggeration} t={t} />
          <Card asChild className={`${MODEL_STAGE_ASPECT_CLASS} w-full`}>
            <section>
              <LazyTerrain3dCanvas snapshot={snapshot} exaggeration={exaggeration} onFailed={fail} />
            </section>
          </Card>
        </ThreeDPanel>
      </TabsContent>
    </Tabs>
  );
}

interface ThreeDPanelProps {
  readonly state: ThreeDState;
  readonly onReveal: () => void;
  readonly t: T;
  /** Ο θεατής — αποδίδεται μόνο στο `revealed`. */
  readonly children: ReactNode;
}

function ThreeDPanel({ state, onReveal, t, children }: ThreeDPanelProps) {
  if (state === 'revealed') return <section className="flex flex-col gap-3">{children}</section>;
  if (state === 'failed') {
    return (
      <ListingStageFailure
        boxClassName={NOTICE_BOX}
        message={t(`${NS}.threeD.failed`)}
        retryLabel={t(`${NS}.threeD.retry`)}
        onRetry={onReveal}
      />
    );
  }
  if (state === 'unsupported') {
    return (
      <Card asChild className={NOTICE_BOX}>
        <section role="status" data-terrain-3d-unsupported="">
          <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.threeD.noWebgl`)}</p>
        </section>
      </Card>
    );
  }
  return <StageInvitation onReveal={onReveal} t={t} />;
}

/** Η κάρτα εισόδου — λέει τι υπάρχει και πώς χειρίζεται, πριν κατέβει οτιδήποτε. */
function StageInvitation({ onReveal, t }: { readonly onReveal: () => void; readonly t: T }) {
  return (
    <Card asChild className={`${NOTICE_BOX} hover:bg-accent`}>
      <button type="button" onClick={onReveal} data-terrain-3d-reveal="">
        <span className="text-sm font-medium text-foreground underline underline-offset-4">{t(`${NS}.threeD.reveal`)}</span>
        <span className="text-sm text-muted-foreground">{t(`${NS}.threeD.revealHint`)}</span>
      </button>
    </Card>
  );
}

/** 1× / 2× / 3× — ο κοινός `SegmentedControl`, όπως το «Υψόμετρα | Κλίσεις» της κάτοψης. */
function ExaggerationSwitch({ value, onChange, t }: {
  readonly value: ListingTerrain3dExaggeration;
  readonly onChange: (value: ListingTerrain3dExaggeration) => void;
  readonly t: T;
}) {
  const onValueChange = (next: string): void => {
    const picked = LISTING_TERRAIN_3D_EXAGGERATIONS.find((option) => String(option) === next);
    if (picked !== undefined) onChange(picked);
  };
  return (
    <SegmentedControl value={String(value)} onValueChange={onValueChange} aria-label={t(`${NS}.exaggeration.label`)} className="self-start">
      {LISTING_TERRAIN_3D_EXAGGERATIONS.map((option) => (
        <SegmentedControlItem key={option} value={String(option)}>
          {t(`${NS}.exaggeration.option`, { value: option })}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
