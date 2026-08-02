/**
 * 🔴 ADR-739 §29.12 — **Ο,ΤΙ ΔΕΝ ΦΑΙΝΕΤΑΙ, ΔΕΝ ΠΙΑΝΕΤΑΙ.**
 *
 * Το Δ3 ζήτησε να **μη ζωγραφίζονται** οι λαβές μέσα στη λειτουργία κελιών. Αν σταματούσε
 * εκεί, θα γεννιόταν χειρότερο ελάττωμα από αυτό που διορθώνει: λαβές **αόρατες αλλά
 * πιάσιμες**. Ο πίνακας έχει λαβές πάνω στην ακμή του, και τα κελιά της πρώτης γραμμής
 * ακουμπούν αυτή την ακμή — δηλαδή ένα κλικ σε κελί θα άρπαζε λαβή που ο χρήστης **δεν
 * βλέπει** και θα άλλαζε διαστάσεις τον πίνακα ενώ γράφει μέσα του.
 *
 * Ο κανόνας είναι ήδη γραμμένος στο μητρώο, ως δοκτρίνα των μεγάλων παιχτών (ADR-559
 * §big-player): «*Revit / Figma / Cinema 4D … **visible ≡ editable** is sacred; they never draw
 * a handle you cannot grab*». Εδώ εφαρμόζεται η **αντίστροφη** ανάγνωσή του, που είναι η ίδια
 * πρόταση: ποτέ λαβή που δεν βλέπεις και μπορείς να πιάσεις.
 *
 * ## Γιατί ΕΔΩ και όχι φύλακας στο `mousedown`
 * Το `AllGripsStore` δεν τροφοδοτεί μόνο το πάτημα: τροφοδοτεί το **hover** των λαβών, τον
 * `SelectedGripSnapEngine` (έλξη στις λαβές της επιλογής), το `ArmableGripsStore` και τον
 * φύλακα body-drag. Ένας φύλακας στο πάτημα θα έπρεπε να γραφτεί τέσσερις φορές — ακριβώς το
 * επιχείρημα με το οποίο το §29.9 έβαλε τον φύλακα του λάσου στο **arm** και όχι στη
 * ζωγραφική. Εδώ η δήλωση είναι μία: **δεν υπάρχουν λαβές τώρα.**
 *
 * @see components/dxf-layout/GripRegistryPublisher.tsx — ο ΜΟΝΑΔΙΚΟΣ γραφέας του store
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — η ΜΙΑ αυθεντία του κλειδώματος
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { GripRegistryPublisher } from '../GripRegistryPublisher';
import { AllGripsStore } from '../../../systems/grip/AllGripsStore';
import { ArmableGripsStore } from '../../../systems/grip/ArmableGripsStore';
import {
  __resetTableCanvasLockdownForTests,
  __setCanvasLockedByTableSessionForTests,
} from '../../../ui/table-cell-editor/use-table-canvas-lockdown';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';

/** Μία λαβή πίνακα, όσο απλή χρειάζεται για να απαντηθεί «δημοσιεύτηκε ή όχι;». */
const TABLE_GRIP: UnifiedGripInfo = {
  id: 'dxf_table-1_0',
  source: 'dxf',
  entityId: 'table-1',
  gripIndex: 0,
  position: { x: 0, y: 0 },
  type: 'corner',
};

jest.mock('../../../hooks/grips/grip-registry', () => ({
  useGripRegistry: jest.fn(() => [TABLE_GRIP]),
}));
jest.mock('../../../systems/selection/useSelectedEntities', () => ({
  useSelectedEntityIds: () => ['table-1'],
  useSelectionByType: () => [],
}));
jest.mock('../../../systems/scene/useSceneSelectors', () => ({
  useLevelScene: () => null,
}));
jest.mock('../../../systems/group/useActiveGroup', () => ({
  useActiveGroupId: () => null,
  useActiveGroupStack: () => [],
}));
jest.mock('../../../systems/block/useActiveBlockEdit', () => ({
  useActiveBlockEditId: () => null,
}));

const EMPTY_SCENE = { entities: [] } as unknown as DxfScene;

function renderPublisher(): { readonly unmount: () => void } {
  return render(
    <GripRegistryPublisher
      sceneLevelId={null}
      convertScene={() => EMPTY_SCENE}
      dxfScene={EMPTY_SCENE}
      currentOverlays={[]}
    />,
  );
}

describe('🔴 ADR-739 §29.12 — καμία πιάσιμη λαβή όσο η λειτουργία πίνακα κατέχει τον καμβά', () => {
  afterEach(() => {
    __resetTableCanvasLockdownForTests();
    AllGripsStore.clear();
    ArmableGripsStore.clear();
  });

  it('βάση: χωρίς κλείδωμα, οι λαβές δημοσιεύονται κανονικά', () => {
    // Χωρίς αυτό το test, ένα «δημοσίευε πάντα κενό» θα ήταν πράσινο στα υπόλοιπα.
    const view = renderPublisher();
    expect(AllGripsStore.get()).toHaveLength(1);
    expect(ArmableGripsStore.getSnapshot()).toHaveLength(1);
    view.unmount();
  });

  it('🔴 ΚΛΕΙΔΩΜΕΝΟΣ ΚΑΜΒΑΣ ⇒ κανένα πιάσιμο σημείο — ούτε λαβή, ούτε armable', () => {
    __setCanvasLockedByTableSessionForTests(true);
    const view = renderPublisher();
    expect(AllGripsStore.get()).toEqual([]);
    expect(ArmableGripsStore.getSnapshot()).toEqual([]);
    view.unmount();
  });

  it('🔴 η ΕΞΟΔΟΣ από τη λειτουργία τις επαναφέρει — το κλείδωμα δεν είναι μονόδρομος', () => {
    __setCanvasLockedByTableSessionForTests(true);
    const view = renderPublisher();
    expect(AllGripsStore.get()).toEqual([]);
    act(() => { __setCanvasLockedByTableSessionForTests(false); });
    expect(AllGripsStore.get()).toHaveLength(1);
    view.unmount();
  });
});
