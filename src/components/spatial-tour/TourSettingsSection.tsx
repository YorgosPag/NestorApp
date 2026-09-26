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
import { isSpatialTourVisibility, SPATIAL_TOUR_VISIBILITIES } from '@/constants/spatial-tour-vocabulary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourSubject } from '@/types/spatial-tour';

import { TOUR_FAILURE_KEYS, TOUR_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { LIFECYCLE_KEY, VIEWING_KEYS, VISIBILITY_HINT_KEY, VISIBILITY_KEY } from './spatial-tour-viewing-labels';
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
  return (
    <section className="space-y-3" aria-labelledby="tour-settings-heading">
      <h3 id="tour-settings-heading" className="text-base font-semibold">{t(VIEWING_KEYS.settingsTitle)}</h3>
      <section className="grid gap-3 sm:grid-cols-2">
        <section className="space-y-1">
          <Label htmlFor="tour-visibility">{t(VIEWING_KEYS.visibility)}</Label>
          <Select value={settings.visibility} onValueChange={(value) => {
            if (isSpatialTourVisibility(value)) void update({ ...settings, visibility: value });
          }}>
            <SelectTrigger id="tour-visibility"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPATIAL_TOUR_VISIBILITIES.map((visibility) => (
                <SelectItem key={visibility} value={visibility}>{t(VISIBILITY_KEY[visibility])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t(VISIBILITY_HINT_KEY[settings.visibility])}</p>
        </section>
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
              <Button type="button" size="sm"
                onClick={() => void update({ ...settings, lifecycle: 'published' })}>
                {t(VIEWING_KEYS.publish)}
              </Button>
            )}
          </p>
        </section>
      </section>
      <p className="text-xs text-muted-foreground">{t(VIEWING_KEYS.explicitGrantsNote)}</p>
      <SettingsNotice notice={notice} />
      {companyId !== null && <PersonalLinks tourId={state.tourId} companyId={companyId} />}
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
function PersonalLinks({ tourId, companyId }: { readonly tourId: string; readonly companyId: string }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-2" aria-labelledby="tour-links-heading">
      <h4 id="tour-links-heading" className="text-sm font-medium">{t(VIEWING_KEYS.linksTitle)}</h4>
      <p className="text-sm text-muted-foreground">{t(VIEWING_KEYS.linksDescription)}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>{t(VIEWING_KEYS.linksManage)}</Button>
      {open && (
        <UnifiedShareDialog open={open} onOpenChange={setOpen} entityType="spatial_tour" entityId={tourId}
          entityTitle={t(VIEWING_KEYS.linksTitle)} companyId={companyId} />
      )}
    </section>
  );
}
