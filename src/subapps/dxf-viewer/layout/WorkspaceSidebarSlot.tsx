/**
 * ADR-724 Φ3 — Ο **μεταφραστής** ανάμεσα στη μορφή που ζητά ο χώρος εργασίας και στο
 * component που την υλοποιεί. Μηδέν λογική διάταξης, μηδέν state: μια απλή αντιστοίχιση
 * `SidebarVariant → δοχείο`.
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΕΝΘΕΤΟ ΒΕΛΟΣ ΣΤΟΝ ORCHESTRATOR ──
 *
 * Το `WorkspaceSplitLayout` δέχεται render prop (`sidebar: (variant) => ReactNode`, §6.3).
 * Γραμμένο ενσωματωμένα μέσα στο `DxfViewerContent`, το σώμα του βελους έφερνε **δύο**
 * δέντρα JSX μέσα στον κορυφαίο orchestrator του viewer — αρχείο που ήδη ακουμπά το όριο
 * των 500 γραμμών (N.7.1) και του οποίου κάθε ανάγνωση κοστίζει.
 *
 * ── 🔴 Η ΔΙΠΛΗ ΠΗΓΗ ΑΛΗΘΕΙΑΣ ΠΟΥ ΕΦΥΓΕ ΜΑΖΙ ──
 *
 * Το ένθετο βέλος ρωτούσε **ξανά** `layoutMode === 'desktop' ? … : <MobileSidebarDrawer/>`.
 * Ήταν περιττό **και** εύθραυστο: το `variant` που φτάνει εδώ **είναι ήδη η απάντηση** —
 * το `WorkspaceSplitLayout` παράγει `'drawer'` ακριβώς όταν `split === false`, δηλαδή όταν
 * `layoutMode !== 'desktop'`. Δύο ανεξάρτητοι έλεγχοι για το ίδιο ερώτημα σημαίνει ότι μια
 * μελλοντική αλλαγή στο ένα σημείο αφήνει σιωπηλά το άλλο πίσω: π.χ. ένα `split` που
 * κάποτε θα εξαρτηθεί και από κάτι άλλο πέρα από το breakpoint θα έδινε `variant='drawer'`
 * ενώ εδώ θα αποδιδόταν ακόμη η inline παλέτα. Τώρα η ερώτηση γίνεται **μία φορά**.
 *
 * @see ./WorkspaceSplitLayout — ο παραγωγός του `variant`
 * @see ./SidebarSection — το ένδυμα ανά variant
 */

'use client';

import React from 'react';
import { SidebarSection, type SidebarVariant, type SidebarSectionProps } from './SidebarSection';
import { MobileSidebarDrawer } from './MobileSidebarDrawer';

/**
 * ⚠️ **Επέκταση, όχι αντιγραφή** (N.18): τα πεδία δεδομένων της παλέτας ορίζονται **μόνο** στο
 * {@link SidebarSectionProps}. Η πρώτη γραφή αυτού του αρχείου τα ξανα-δήλωνε αυτούσια και το
 * CHECK 3.28 (jscpd) το έπιασε ως δίδυμο — σωστά: ένα νέο prop θα έμπαινε στο ένα από τα δύο.
 *
 * Το `variant` γίνεται **υποχρεωτικό** εδώ (στο `SidebarSection` έχει προεπιλογή): αυτός ο
 * κόμβος υπάρχει ακριβώς επειδή κάποιος του λέει τη μορφή — προεπιλογή θα σήμαινε «μάντεψε».
 */
interface WorkspaceSidebarSlotProps extends Omit<SidebarSectionProps, 'variant'> {
  /** Η μορφή που ζητά ο χώρος εργασίας — **η μοναδική** πηγή για την επιλογή δοχείου. */
  variant: SidebarVariant;
  /** Κατάσταση του συρταριού — έχει νόημα **μόνο** στο `'drawer'`, το κατέχει το `ui` store. */
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
}

export const WorkspaceSidebarSlot = React.memo<WorkspaceSidebarSlotProps>(({
  variant,
  floatingRef,
  currentScene,
  activeTool,
  onSceneImported,
  projectId,
  floorplanId,
  drawerOpen,
  onDrawerOpenChange,
}) => {
  /*
    Το συρτάρι δεν είναι «άλλο ένδυμα της ίδιας παλέτας» — είναι **άλλο δοχείο** (Sheet, με
    δικό του overlay, εστίαση και ζωή/θάνατο). Γι' αυτό διακλαδώνει εδώ και όχι μέσα στο
    `SidebarSection`: εκείνο ντύνει, αυτό επιλέγει ποιος κρατά την παλέτα.
    ⓘ Τα `projectId` / `floorplanId` δεν περνούν στο συρτάρι επειδή το ADR-358 Φ8 dock είναι
    desktop-only — η καρτέλα Ιδιότητες δεν έχει εμβέλεια να δείξει σε κινητό.
  */
  if (variant === 'drawer') {
    return (
      <MobileSidebarDrawer
        open={drawerOpen}
        onOpenChange={onDrawerOpenChange}
        floatingRef={floatingRef}
        currentScene={currentScene}
        activeTool={activeTool}
        onSceneImported={onSceneImported}
      />
    );
  }

  return (
    <SidebarSection
      variant={variant}
      floatingRef={floatingRef}
      currentScene={currentScene}
      activeTool={activeTool}
      onSceneImported={onSceneImported}
      projectId={projectId}
      floorplanId={floorplanId}
    />
  );
});

WorkspaceSidebarSlot.displayName = 'WorkspaceSidebarSlot';
