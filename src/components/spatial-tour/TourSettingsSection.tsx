'use client';

/**
 * @fileoverview **ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΗΝ ΠΕΡΙΗΓΗΣΗ** — ορατότητα · δημοσίευση · προσωπικοί σύνδεσμοι (ADR-884 Κ3β · §12 Δ3).
 * @related `useTourViewing.ts` · `components/sharing/UnifiedShareDialog.tsx` (ο ΕΝΑΣ διάλογος συνδέσμων της πλατφόρμας)
 * @module components/spatial-tour/TourSettingsSection
 *
 * 🔑 **Κάθε επιλογή λέει τι σημαίνει** (Matterport/Figma δείχνουν μία φράση ανά επιλογή ορατότητας) — ο υπεύθυνος
 * διαλέγει κοινό, όχι «ρύθμιση».
 * 🔑 **Οι σύνδεσμοι ανά παραλήπτη περνούν από τον ΙΔΙΟ διάλογο κοινοποίησης** με όλη την πλατφόρμα (ADR-315): όνομα
 * παραλήπτη, λήξη, αποστολή μέσω καναλιών, λίστα ενεργών με ανοίγματα και ανάκληση. Η πολιτική του είδους κρύβει τον
 * κωδικό και απαιτεί «για ποιον» (`SHARE_KIND_LINK_POLICY`). Μόνο για αγγελίες **γραφείου** (εμβέλεια μισθωτή).
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { isSpatialTourVisibility, SPATIAL_TOUR_VISIBILITIES, type SpatialTourVisibility } from '@/constants/spatial-tour-vocabulary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourSettings } from '@/server/spatial-tour/tour-settings';
import type { TourSubject } from '@/types/spatial-tour';

import { TOUR_FAILURE_KEYS, TOUR_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { TourPanelSection } from './TourPanelSection';
import {
  LIFECYCLE_KEY,
  SPACE_AREA_SETTING_KEYS,
  VIEWING_KEYS,
  VISIBILITY_HINT_KEY,
  VISIBILITY_KEY,
} from './spatial-tour-viewing-labels';
import { useTourSettings, type TourViewingNotice } from './useTourViewing';

// ⚠️ ΟΡΙΟ `next/dynamic` (ADR-744 Κ2): ο διάλογος κοινοποίησης φέρνει `files` · `files-media` · `properties-detail` —
//    στατικά θα φούσκωνε το slice κάθε σελίδας με το πάνελ (μετρημένο: `/offers/[offerId]/tour` 7940 → 14767 bytes),
//    ενώ ανοίγει μόνο με κλικ και μόνο στην πλευρά γραφείου.
const UnifiedShareDialog = dynamic(
  () => import('@/components/sharing/UnifiedShareDialog').then((module) => ({ default: module.UnifiedShareDialog })),
  { ssr: false },
);

export function TourSettingsSection({ subject, companyId }: { readonly subject: TourSubject; readonly companyId: string | null }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { state, update, notice } = useTourSettings(subject);
  if (state === null) return null;
  const { settings } = state;
  const published = settings.lifecycle === 'published';
  // ADR-884 §4.7 Α8 — ο ΙΔΙΟΣ κριτής με τον θεατή και τον διακομιστή: ό,τι θα αρνιόταν, φαίνεται κλειστό πριν πατηθεί.
  const showsSomething = state.viewerStopCount > 0;
  return (
    <TourPanelSection headingId="tour-settings-heading" title={t(VIEWING_KEYS.settingsTitle)}>
      <section className="grid gap-3 sm:grid-cols-2">
        <VisibilityField settings={settings} supported={state.supportedVisibilities}
          onChange={(visibility) => void update({ ...settings, visibility })} />
        <section className="space-y-1">
          <Label>{t(VIEWING_KEYS.lifecycle)}</Label>
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant={published ? 'default' : 'outline'}>{t(LIFECYCLE_KEY[settings.lifecycle])}</Badge>
            {/* Δύο ΔΙΑΦΟΡΕΤΙΚΕΣ πράξεις, όχι διακόπτης (ADR-770 §19): γι' αυτό δύο κουμπιά. */}
            {published ? (
              <Button type="button" size="sm" variant="outline"
                onClick={() => void update({ ...settings, lifecycle: 'withdrawn' })}>
                {t(VIEWING_KEYS.withdraw)}
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={!showsSomething}
                onClick={() => void update({ ...settings, lifecycle: 'published' })}>
                {t(VIEWING_KEYS.publish)}
              </Button>
            )}
          </p>
        </section>
      </section>
      <SpaceAreasField shown={settings.spaceAreaDisplay === 'shown'}
        onChange={(shown) => void update({ ...settings, spaceAreaDisplay: shown ? 'shown' : 'hidden' })} />
      <p className="text-xs text-muted-foreground">{t(VIEWING_KEYS.explicitGrantsNote)}</p>
      {!showsSomething && <p className="text-sm text-muted-foreground" role="note">{t(VIEWING_KEYS.needsStop)}</p>}
      <SettingsNotice notice={notice} />
      {companyId !== null && <PersonalLinks tourId={state.tourId} companyId={companyId} ready={showsSomething} />}
    </TourPanelSection>
  );
}

/** Η ορατότητα — ό,τι θα απέρριπτε ο διακομιστής φαίνεται απενεργό **πριν** πατηθεί (ίδιος κριτής, `supportedVisibilities`). */
function VisibilityField({ settings, supported, onChange }: {
  readonly settings: TourSettings;
  readonly supported: readonly SpatialTourVisibility[];
  readonly onChange: (visibility: SpatialTourVisibility) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section className="space-y-1">
      <Label htmlFor="tour-visibility">{t(VIEWING_KEYS.visibility)}</Label>
      <Select value={settings.visibility} onValueChange={(value) => {
        if (isSpatialTourVisibility(value)) onChange(value);
      }}>
        <SelectTrigger id="tour-visibility"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SPATIAL_TOUR_VISIBILITIES.map((visibility) => (
            <SelectItem key={visibility} value={visibility} disabled={!supported.includes(visibility)}>
              {t(VISIBILITY_KEY[visibility])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t(VISIBILITY_HINT_KEY[settings.visibility])}</p>
      {supported.length < SPATIAL_TOUR_VISIBILITIES.length && (
        <p className="text-xs text-muted-foreground">{t(TOUR_REFUSAL_KEY['visibility-unsupported'])}</p>
      )}
    </section>
  );
}

/**
 * **Εμβαδά χώρων στη δημόσια σελίδα** (ADR-884 Δ8.4 · Γ3γ-1) — ένας διακόπτης ανά περιήγηση, αισιόδοξα (`useTourSettings`).
 * Διακόπτης και όχι δύο κουμπιά: είναι **κατάσταση** εμφάνισης που αναστρέφεται ελεύθερα, όχι πράξη με συνέπειες (ADR-770 §19).
 */
function SpaceAreasField({ shown, onChange }: { readonly shown: boolean; readonly onChange: (shown: boolean) => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section className="flex items-start justify-between gap-3">
      <section className="space-y-1">
        <Label htmlFor="tour-space-areas">{t(SPACE_AREA_SETTING_KEYS.label)}</Label>
        <p id="tour-space-areas-hint" className="text-xs text-muted-foreground">{t(SPACE_AREA_SETTING_KEYS.hint)}</p>
      </section>
      <Switch id="tour-space-areas" checked={shown} onCheckedChange={onChange} aria-describedby="tour-space-areas-hint" />
    </section>
  );
}

function SettingsNotice({ notice }: { readonly notice: TourViewingNotice | null }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  if (notice === null || notice.kind === 'decided') return null;
  if (notice.kind === 'saved') return <p className="text-sm" role="status">{t(VIEWING_KEYS.saved)}</p>;
  return (
    <p className="text-sm text-destructive" role="alert">
      {notice.kind === 'refused' ? t(TOUR_REFUSAL_KEY[notice.result.reason]) : t(TOUR_FAILURE_KEYS.unavailable)}
    </p>
  );
}

/** Προσωπικοί σύνδεσμοι — ο διάλογος κοινοποίησης της πλατφόρμας, για το είδος `spatial_tour`. */
function PersonalLinks({ tourId, companyId, ready }: {
  readonly tourId: string;
  readonly companyId: string;
  /** `false` ⇒ κανένας σύνδεσμος: ο παραλήπτης θα έβλεπε «ετοιμάζεται» (πρότυπο Matterport — §4.7 Α8). */
  readonly ready: boolean;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-2" aria-labelledby="tour-links-heading">
      <h4 id="tour-links-heading" className="text-sm font-medium">{t(VIEWING_KEYS.linksTitle)}</h4>
      <p className="text-sm text-muted-foreground">{t(VIEWING_KEYS.linksDescription)}</p>
      <Button type="button" size="sm" variant="outline" disabled={!ready} onClick={() => setOpen(true)}>
        {t(VIEWING_KEYS.linksManage)}
      </Button>
      {open && (
        <UnifiedShareDialog open={open} onOpenChange={setOpen} entityType="spatial_tour" entityId={tourId}
          entityTitle={t(VIEWING_KEYS.linksTitle)} companyId={companyId} />
      )}
    </section>
  );
}
