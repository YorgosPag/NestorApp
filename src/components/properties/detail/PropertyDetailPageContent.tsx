'use client';

/**
 * @fileoverview **Η ΚΑΡΤΕΛΑ ΕΝΟΣ ΑΚΙΝΗΤΟΥ** — ο προορισμός που ο σύνδεσμος δεν είχε.
 * @related ADR-777 §8.30 · §12.6 · features/property-detail-surface · lib/routes/entityRoutes
 * @module components/properties/detail/PropertyDetailPageContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Ο ΣΥΝΔΕΣΜΟΣ ΥΠΗΡΧΕ ΚΑΙ ΔΕΝ ΟΔΗΓΟΥΣΕ ΠΟΥΘΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι το §8.30 το `/properties/[id]` ήταν **σκέτη ανακατεύθυνση** προς
 * `/properties?propertyId=…` — μια σελίδα που **αγνοεί** την παράμετρο (διάβαζε
 * μόνο `?view`). Δηλαδή το ιστορικό αλλαγών και η ειδοποίηση καθυστέρησης
 * έστελναν τον άνθρωπο σε **λίστα**, όχι στο ακίνητο για το οποίο μιλούσαν.
 *
 * Δεν ήταν παράλειψη υλοποίησης: η σελίδα που **τιμούσε** την παράμετρο υπήρχε
 * και δούλευε, μία διαδρομή δίπλα (`/spaces/properties`). **Δύο συμβάσεις που δεν
 * συναντήθηκαν ποτέ** — το σχήμα του ADR-749.
 *
 * 🔑 **ΤΡΕΙΣ ΠΟΡΤΕΣ, ΚΑΙ ΑΥΤΗ ΕΙΝΑΙ Η ΕΣΩΤΕΡΙΚΗ.** Ο ανώνυμος επισκέπτης έχει το
 * `/listing/[id]` (δημόσια αγγελία, route group `(light)`)· ο συγκεκριμένος
 * πελάτης έχει το `/shared/<token>`. Εδώ ζει το **γραφείο**: έγγραφα, ιστορικό,
 * ποιος ψάχνει. Πίσω από τη σύνδεση, εξ ορισμού — γι' αυτό η σελίδα ανήκει στο
 * `(app)` και **όχι** στο `(light)` (CHECK 3.52).
 *
 * 🔑 **ΤΟ ΠΑΝΕΛ ΖΗΤΗΣΗΣ ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΚΟΙΝΟ ΠΟΥ ΕΛΕΙΠΕ.** Ο διακομιστής
 * (`lookupOwnedPlace`) ήξερε **ήδη** και τις δύο πλευρές — ιδιώτη *και* εταιρείας
 * — αλλά μόνο η οθόνη του ιδιώτη το ρωτούσε. Το §12.6 έφτανε στους μισούς
 * ιδιοκτήτες και **φαινόταν** να δουλεύει.
 *
 * ⚠️ **Στέκεται ΠΑΝΩ από τις καρτέλες, όπως και στην πλευρά ιδιώτη**: είναι ο
 * *λόγος* να ανοίξει κάποιος τις φωτογραφίες ή να διορθώσει την τιμή, όχι επίμετρο.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';

import { PlaceInterestPanel } from '@/components/demand/PlaceInterestPanel';
import { usePlaceInterest } from '@/hooks/demand/usePlaceInterest';
import { PropertyDetailSurface } from '@/features/property-detail-surface/PropertyDetailSurface';
import { usePropertiesViewerState } from '@/hooks/usePropertiesViewerState';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENTITY_ROUTES } from '@/lib/routes';
import { StaticPageLoading } from '@/core/states';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

import { PropertyIdentityHeader } from './PropertyIdentityHeader';
import { derivePropertyPageState } from './property-page-state';

const NS = 'properties-detail';

export function PropertyDetailPageContent({
  propertyId,
}: {
  readonly propertyId: string;
}): React.ReactElement {
  /**
   * `?tab=` — **στον πελάτη**, όπως ακριβώς το διαβάζει η δεξιά στήλη (`urlTab`
   * στο `UnitsPageContent`). Ανάγνωσή του στη σελίδα-διακομιστή κάνει τη διαδρομή
   * δυναμική και στέλνει **ωμά κλειδιά** στο HTML (δες την κεφαλίδα του
   * `page.tsx`, μετρημένο ζωντανά).
   */
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') ?? undefined;

  const { t } = useTranslation(['properties', NS, 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();
  const [isEditMode, setIsEditMode] = React.useState(false);

  // 🔑 Ο **ίδιος** φορτωτής με τη λίστα, με την ταυτότητα να έρχεται από τη
  // διαδρομή αντί για το ερώτημα. Τα δεδομένα είναι ήδη στη μνήμη — το
  // `SharedPropertiesProvider` ζει στο `(app)/layout.tsx` — άρα η καρτέλα δεν
  // πληρώνει δεύτερη ανάγνωση, ούτε γεννά δεύτερη μετάφραση.
  const viewer = usePropertiesViewerState(propertyId);
  const interest = usePlaceInterest(propertyId);

  // 🔑 Η απόφαση ζει σε **καθαρή συνάρτηση** και όχι εδώ, γιατί η πρώτη της
  // γραφή ήταν σιωπηλά λάθος και το βρήκε **ζωντανή μέτρηση**, όχι test. Δες
  // `property-page-state.ts`.
  const state = derivePropertyPageState({
    loading: viewer.loading,
    hasAnswered: viewer.hasAnswered,
    property: viewer.selectedProperty,
  });

  /**
   * ⚠️ **Απομνημονεύεται επίτηδες.** Στη δεξιά στήλη το `viewerProps` έρχεται ως
   * **prop** από τον γονέα, άρα είναι σταθερό· εδώ θα γεννιόταν σε κάθε απόδοση
   * και θα ακύρωνε αλυσιδωτά το `useMemo` του `usePropertiesSidebar` → τα
   * `additionalData` → **όλες** τις καρτέλες, σε κάθε πάτημα πλήκτρου μέσα σε
   * φόρμα επεξεργασίας. Η ίδια επιφάνεια, άλλο σημείο προσάρτησης, **άλλη**
   * υποχρέωση σταθερότητας.
   */
  const viewerProps = React.useMemo(
    () => ({
      properties: viewer.properties,
      selectedFloorId: viewer.selectedFloorId,
      onSelectFloor: viewer.onSelectFloor,
      selectedPropertyIds: viewer.selectedPropertyIds,
      hoveredPropertyId: viewer.hoveredPropertyId,
      handleUpdateProperty: viewer.handleUpdateProperty,
    }),
    [
      viewer.properties,
      viewer.selectedFloorId,
      viewer.onSelectFloor,
      viewer.selectedPropertyIds,
      viewer.hoveredPropertyId,
      viewer.handleUpdateProperty,
    ],
  );

  return (
    {/* ADR-797: το εξωτερικό κενό ανηκει στο κελυφος — το p-4 εφυγε (CHECK 3.63). */}
    <main className="flex min-h-0 flex-1 flex-col gap-4">
      {/*
        🔴 **ΟΣΟ ΔΕΝ ΞΕΡΟΥΜΕ, Η ΣΕΛΙΔΑ ΔΕΝ ΛΕΕΙ ΤΙΠΟΤΑ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ.**

        Το `/properties/[id]` έχει **δυναμικό τμήμα**, άρα δεν προαποδίδεται και
        το όριο αναστολής **δεν** πέφτει στο `fallback`: ο διακομιστής αποδίδει
        αυτό εδώ. Τα `properties`/`properties-detail` όμως υπάρχουν στο i18n shell
        slice **κομμένα** (το `properties-detail` με **μηδέν** κλειδιά, ADR-744),
        άρα κάθε `t()` που τρέχει σε αυτό το καρέ φεύγει **ωμό** στο HTML.

        Μετρημένο στο σερβιρισμένο HTML: `detailPage.back` · `page.loading`.

        🔑 **Το `/listing/[id]` είναι ΕΠΙΣΗΣ δυναμικό και ΕΙΝΑΙ καθαρό** — επειδή
        το `search-results` είναι **ΟΛΟΚΛΗΡΟ** στο slice. Η ίδια θεραπεία εδώ
        (`properties` + `properties-detail` ολόκληρα) μετρήθηκε: **+75.482 bytes,
        +33%** στο slice **κάθε** διαδρομής — ακριβώς αντίθετη από τον λόγο ύπαρξης
        του ADR-744 (−37%). Απορρίφθηκε με αριθμό, όχι με γούστο.

        Άρα το πρώτο καρέ δείχνει το **ίδιο** `StaticPageLoading` που μόλις έδειχνε
        το όριο αναστολής: μηδέν `t()`, μηδέν ωμά κλειδιά, και **καμία οπτική
        μετάβαση** — ο άνθρωπος δεν βλέπει καν ότι άλλαξε component. Ο σύνδεσμος
        επιστροφής εμφανίζεται **μαζί** με το περιεχόμενο, γιατί πριν από αυτό δεν
        υπάρχει τίποτα από το οποίο να επιστρέψεις.
      */}
      {state.kind === 'loading' && <StaticPageLoading />}

      {state.kind !== 'loading' && (
        <nav>
          <Link
            href={ENTITY_ROUTES.properties.list}
            className={`inline-flex items-center gap-1 text-sm font-medium ${colors.text.muted} hover:text-foreground`}
          >
            {t(`${NS}:detailPage.back`)}
          </Link>
        </nav>
      )}

      {state.kind === 'absent' && (
        <section className={`rounded-xl border ${colors.border.muted} p-6`}>
          <h1 className="text-lg font-semibold text-foreground">
            {t(`${NS}:detailPage.absent`)}
          </h1>
          <p className={`mt-1 text-sm ${colors.text.muted}`}>
            {t(`${NS}:detailPage.absentHint`)}
          </p>
          <Link
            href={ENTITY_ROUTES.properties.list}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground underline"
          >
            {t(`${NS}:detailPage.backToList`)}
          </Link>
        </section>
      )}

      {state.kind === 'found' && (
        <>
          <PropertyIdentityHeader property={state.property} />

          {/*
            🎯 **ΤΟ ΔΟΛΩΜΑ ΤΟΥ §12.6 ΓΙΑ ΤΗΝ ΠΛΕΥΡΑ ΕΤΑΙΡΕΙΑΣ.** Το ίδιο πάνελ, ο
            ίδιος διακομιστής, ο ίδιος κριτής με την πλευρά ιδιώτη — αλλιώς οι δύο
            οθόνες θα μπορούσαν να δείξουν **διαφορετικό αριθμό για το ίδιο
            ακίνητο**, και καμία δεν θα φαινόταν λάθος.
          */}
          <PlaceInterestPanel interest={interest} />

          <section className="flex min-h-0 flex-1 flex-col">
            <PropertyDetailSurface
              property={state.property}
              units={viewer.properties}
              viewerProps={viewerProps}
              floors={viewer.floors}
              setShowHistoryPanel={viewer.setShowHistoryPanel}
              isEditMode={isEditMode}
              onToggleEditMode={() => setIsEditMode((previous) => !previous)}
              onExitEditMode={() => setIsEditMode(false)}
              defaultTab={initialTab}
            />
          </section>
        </>
      )}
    </main>
  );
}
