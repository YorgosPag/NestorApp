'use client';

/**
 * ADR-782 §18 (Φάση 2β) — οι ρυθμίσεις του υποβάθρου χάρτη.
 *
 * Το store είχε setters για **αδιαφάνεια** και **πάροχο** από τη Φάση 1, χωρίς καμία διεπαφή
 * (§13 #4). Δηλαδή η προεπιλογή 0,55 ήταν η **μόνη** διαθέσιμη τιμή: ρυθμιζόμενη στα χαρτιά,
 * σταθερή στην πράξη.
 *
 * ## Πού κάθεται — και γιατί δίπλα στον διακόπτη
 * **Split control**: ο διακόπτης «Χάρτης» ανάβει/σβήνει, ένα δεύτερο, διπλανό κουμπί ανοίγει τις
 * ρυθμίσεις. Είναι η σύγκλιση των μεγάλων (AutoCAD `GEOMAP` split button στην κορδέλα · Google
 * Maps κουμπί επιπέδων · ArcGIS Pro basemap gallery): οι ρυθμίσεις ζουν **εκεί που ζει ο
 * διακόπτης**, όχι σε μακρινό πάνελ προτιμήσεων.
 *
 * ⚠️ **ΔΥΟ αδελφά κουμπιά, όχι ένθετο**: κουμπί μέσα σε κουμπί είναι άκυρο HTML και ο αναγνώστης
 * οθόνης δεν μπορεί να τα ξεχωρίσει. Το `role="group"` που τα δένει ως **ένα** χειριστήριο ζει
 * στο σημείο προσάρτησης (`FloorTabBar`), γιατί εκεί ζουν **και τα δύο** — ίδιο σκεπτικό με το
 * `aria-pressed` vs `role="tab"` του §10: δύο διαφορετικές πράξεις, ένα χειριστήριο.
 *
 * ## 🔑 Ο πάροχος ΔΕΝ είναι λίστα επιλογής σήμερα — και αυτό είναι απόφαση
 * Ο πίνακας `BASEMAP_SOURCES` έχει **έναν** πάροχο (§13 #1). Ένα `<Select>` με μία επιλογή είναι
 * χειριστήριο **που δεν μπορεί να κάνει τίποτα** — ακριβώς το σχήμα «φρουρός που δεν μπορεί να
 * πυροδοτήσει» (ADR-749 §5) μεταφρασμένο σε διεπαφή. Άρα η μορφή **παράγεται από τον πίνακα**:
 * ένας πάροχος ⇒ γραμμή ανάγνωσης· δύο ⇒ λίστα. Ο επόμενος πάροχος (π.χ. αεροφωτογραφία) γίνεται
 * **γραμμή στον πίνακα** και η διεπαφή αλλάζει μόνη της, χωρίς να αγγιχτεί αυτό το αρχείο.
 *
 * Μηδέν inline styles (N.3), σημασιολογικό `<section>`/`<dl>` (N.4), όλα τα κείμενα από i18n
 * (N.11). Χαμηλή συχνότητα ⇒ `useSyncExternalStore` επιτρέπεται (το βέτο του ADR-040 αφορά
 * canvas orchestrators).
 */

import React, { useSyncExternalStore } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { SliderInput } from '../../ui/components/shared/SliderInput';
import {
  getBasemapState,
  setBasemapOpacity,
  setBasemapSource,
  subscribeBasemap,
} from '../../systems/basemap/basemap-store';
import {
  getApproximateAnchor,
  getBasemapAvailability,
  subscribeBasemapAvailability,
} from '../../systems/basemap/basemap-availability';
import { ANCHOR_ORIGIN_LABEL_KEY } from '../../systems/basemap/basemap-anchor-labels';
import { BASEMAP_SOURCES, type BasemapSourceId } from '../../systems/basemap/basemap-source';

/** Η αδιαφάνεια ζει στο [0,1]· ο χρήστης σκέφτεται σε ποσοστά. */
const OPACITY_PERCENT = { min: 0, max: 100, step: 5 } as const;

/** Οι πάροχοι ως πίνακας, μία φορά — η μορφή της διεπαφής προκύπτει από το πλήθος τους. */
const SOURCE_IDS = Object.keys(BASEMAP_SOURCES) as BasemapSourceId[];

interface ProviderFieldProps {
  readonly sourceId: BasemapSourceId;
  readonly label: string;
  readonly singleHint: string;
}

/**
 * Ο πάροχος: λίστα όταν υπάρχει πραγματική επιλογή, γραμμή ανάγνωσης όταν δεν υπάρχει.
 *
 * Το όνομα του παρόχου έρχεται από το `labelKey` του **πίνακα**, ποτέ γραμμένο εδώ: ένας νέος
 * πάροχος φέρνει το δικό του κλειδί μαζί του.
 */
const ProviderField: React.FC<ProviderFieldProps> = ({ sourceId, label, singleHint }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const single = SOURCE_IDS.length < 2;

  return (
    <section className={`flex flex-col ${PANEL_LAYOUT.GAP.XS}`}>
      <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{label}</h4>
      {single ? (
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
          {`${t(BASEMAP_SOURCES[sourceId].labelKey)} — ${singleHint}`}
        </p>
      ) : (
        <Select value={sourceId} onValueChange={(next) => setBasemapSource(next as BasemapSourceId)}>
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {t(BASEMAP_SOURCES[id].labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </section>
  );
};

/**
 * Το κουμπί ρυθμίσεων και το περιεχόμενό του.
 *
 * ⚠️ Απενεργοποιείται με **τον ίδιο** όρο που απενεργοποιεί τον διακόπτη (`availability ===
 * 'unknown'`), και ο όρος διαβάζεται από το **ίδιο** store — όχι από prop. Δύο χειριστήρια της
 * ίδιας λειτουργίας που διαφωνούν για το αν είναι διαθέσιμη είναι χειρότερα από ένα.
 */
export const BasemapSettingsPopover: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { opacity, sourceId } = useSyncExternalStore(subscribeBasemap, getBasemapState, getBasemapState);
  const availability = useSyncExternalStore(
    subscribeBasemapAvailability,
    getBasemapAvailability,
    getBasemapAvailability,
  );

  const anchor = useSyncExternalStore(
    subscribeBasemapAvailability,
    getApproximateAnchor,
    getApproximateAnchor,
  );

  const unavailable = availability === 'unknown';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={unavailable ? t('basemap.settings.unavailable') : t('basemap.settings.openAria')}
          disabled={unavailable}
          className={`${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.ROUNDED.TOP} ${colors.text.muted} ` +
            `${PANEL_LAYOUT.INTERACTIVE.HOVER} ${PANEL_LAYOUT.INTERACTIVE.TRANSITION} ` +
            'disabled:cursor-not-allowed disabled:opacity-40'}
        >
          <Settings2 size={13} aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className={`flex flex-col ${PANEL_LAYOUT.GAP.SM}`}>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
          {t('basemap.settings.title')}
        </h3>

        <SliderInput
          label={t('basemap.settings.opacity')}
          value={Math.round(opacity * 100)}
          min={OPACITY_PERCENT.min}
          max={OPACITY_PERCENT.max}
          step={OPACITY_PERCENT.step}
          showValue
          formatValue={(v) => `${v}%`}
          onChange={(percent) => setBasemapOpacity(percent / 100)}
        />
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
          {t('basemap.settings.opacityHint')}
        </p>

        <ProviderField
          sourceId={sourceId}
          label={t('basemap.settings.provider')}
          singleHint={t('basemap.settings.providerSingleHint')}
        />

        {/*
          ADR-782 §21 — η **προέλευση** της θέσης, μόνο όταν είναι κατά προσέγγιση. Σε
          γεωαναφερμένο έργο δεν υπάρχει τίποτα να δηλωθεί: η θέση ΕΙΝΑΙ η μετρημένη.
          Εδώ ξεπερνάμε Revit/ArchiCAD, που δηλώνουν «κατά προσέγγιση» χωρίς να λένε ποτέ
          από πού την πήραν — δες την επικεφαλίδα του `project-anchor-resolution`.
        */}
        {availability === 'approximate' && anchor && (
          <section className={`flex flex-col ${PANEL_LAYOUT.GAP.XS}`}>
            <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {t('basemap.settings.anchorOrigin')}
            </h4>
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {t(ANCHOR_ORIGIN_LABEL_KEY[anchor.originKey])}
            </p>
          </section>
        )}
      </PopoverContent>
    </Popover>
  );
};
