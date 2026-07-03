/**
 * ADR-569 — «Δοκάρι ανάμεσα σε μέλη» React FSM orchestrator.
 *
 * Δύο ροές (Giorgio 2026-07-03):
 *   • **Αλυσίδα (forward):** ενεργοποιείς την εντολή → `awaitingFirst`. Κλικ σε κολόνα/τοιχίο →
 *     `awaitingNext`. Κάθε επόμενο κλικ σε μέλος δημιουργεί ΑΜΕΣΩΣ δοκάρι ανάμεσα στο προηγούμενο
 *     και στο τρέχον μέλος, και το τρέχον γίνεται η αρχή του επόμενου (συνεχής αλυσίδα).
 *   • **Αντίστροφη (selection-first):** αν κατά την ενεργοποίηση υπάρχουν ≥2 επιλεγμένα μέλη, φτιάχνει
 *     αμέσως δοκάρι ανά **διαδοχικό ζεύγος** και μένει armed με anchor το τελευταίο (η αλυσίδα συνεχίζει).
 *     Mirror του «Flow B» του `useWallMergeTool`/`useWallAttachTool`.
 *
 * Γεωμετρία + κατασκευή: `bim/beams/beam-between-members.ts` (pick + connector παρειά→παρειά +
 * `completeBeamFromTwoClicks` SSoT). Commit: το injected `onBeamCreated` (→ `appendEntityToScene`,
 * ΙΔΙΟ path με το freehand δοκάρι — undo + Firestore autosave + ADR-567 overlap guard). Το anchor
 * δημοσιεύεται στο `BeamBetweenMembersStore` για το live ghost (ADR-040 store-driven leaf).
 *
 * ⚠️ Stability: όλα τα option callbacks διαβάζονται μέσα από **refs** (mirror του `useBeamTool`), ώστε
 * τα `activate`/`onCanvasClick` να μένουν referentially STABLE. Αλλιώς το `useToolLifecycle` (deps
 * περιλαμβάνουν `activate`) θα ξανα-έτρεχε το `activate()` σε κάθε render → η αντίστροφη ροή θα
 * δημιουργούσε ξανά-και-ξανά δοκάρια.
 *
 * @see bim/beams/beam-between-members.ts — pick + connector + build (SSoT)
 * @see systems/beam-between-members/BeamBetweenMembersStore.ts — anchor store (ghost)
 * @see docs/centralized-systems/reference/adrs/ADR-569-beam-between-members.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { isColumnEntity, isWallEntity, type Entity } from '../../types/entities';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SceneUnits } from '../../utils/scene-units';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import {
  pickStructuralMemberAt,
  getStructuralMemberFootprint2D,
  buildBeamBetweenMembers,
  type PickedStructuralMember,
} from '../../bim/beams/beam-between-members';
import { BeamBetweenMembersStore } from '../../systems/beam-between-members/BeamBetweenMembersStore';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';

type BeamBetweenPhase = 'idle' | 'awaitingFirst' | 'awaitingNext';

export interface UseBeamBetweenMembersToolOptions {
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
  readonly getSceneEntities?: () => readonly Entity[];
  /** Callback μετά από επιτυχή build — commit-άρει το δοκάρι (append + autosave + undo). */
  readonly onBeamCreated?: (entity: BeamEntity) => void;
}

export interface UseBeamBetweenMembersToolResult {
  readonly isActive: boolean;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Δέχεται RAW worldPoint (hit-test υπαρχόντων μελών). Επιστρέφει `true` αν το κλικ καταναλώθηκε. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
}

/** Resolve ένα επιλεγμένο id → μέλος (κολόνα/τοίχος) + footprint, ή `null`. Pure. */
function resolveMember(id: string, entities: readonly Entity[]): PickedStructuralMember | null {
  const e = entities.find((x) => x.id === id);
  if (!e || (!isColumnEntity(e) && !isWallEntity(e))) return null;
  const footprint = getStructuralMemberFootprint2D(e);
  return footprint ? { entity: e, footprint } : null;
}

function publishAnchor(member: PickedStructuralMember): void {
  BeamBetweenMembersStore.setAnchor({ id: member.entity.id, footprint: member.footprint });
}

export function useBeamBetweenMembersTool(
  options: UseBeamBetweenMembersToolOptions = {},
): UseBeamBetweenMembersToolResult {
  const { currentLevelId = '0', getSceneUnits, getSceneEntities, onBeamCreated } = options;

  const [phase, setPhase] = useState<BeamBetweenPhase>('idle');
  const phaseRef = useRef<BeamBetweenPhase>(phase);
  phaseRef.current = phase;
  const firstRef = useRef<PickedStructuralMember | null>(null);

  // Stable getter refs — the options are inline arrows (new identity every render); reading them
  // through refs keeps activate/onCanvasClick STABLE (see header note + useBeamTool pattern).
  const levelIdRef = useRef(currentLevelId);
  levelIdRef.current = currentLevelId;
  const getUnitsRef = useRef(getSceneUnits);
  getUnitsRef.current = getSceneUnits;
  const getEntitiesRef = useRef(getSceneEntities);
  getEntitiesRef.current = getSceneEntities;
  const onCreatedRef = useRef(onBeamCreated);
  onCreatedRef.current = onBeamCreated;

  // Reset store on unmount (tool panel teardown).
  useEffect(() => () => BeamBetweenMembersStore.reset(), []);

  const commitBetween = useCallback((a: PickedStructuralMember, b: PickedStructuralMember): boolean => {
    const units = getUnitsRef.current?.() ?? 'mm';
    const result = buildBeamBetweenMembers(a, b, levelIdRef.current, {}, units);
    if (result.ok) onCreatedRef.current?.(result.entity);
    return result.ok;
  }, []);

  const activate = useCallback(() => {
    const entities = getEntitiesRef.current?.() ?? [];
    const ids = SelectedEntitiesStore.getSelectedEntityIds();
    const members = ids
      .map((id) => resolveMember(id, entities))
      .filter((m): m is PickedStructuralMember => m !== null);
    // Αντίστροφη ροή — ≥2 επιλεγμένα μέλη: δοκάρι ανά διαδοχικό ζεύγος, μένει armed στο τελευταίο.
    if (members.length >= 2) {
      for (let i = 0; i < members.length - 1; i++) commitBetween(members[i], members[i + 1]);
      const last = members[members.length - 1];
      firstRef.current = last;
      publishAnchor(last);
      setPhase('awaitingNext');
      return;
    }
    firstRef.current = null;
    BeamBetweenMembersStore.reset();
    setPhase('awaitingFirst');
  }, [commitBetween]);

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      if (phaseRef.current === 'idle') return false;
      const entities = getEntitiesRef.current?.() ?? [];
      const picked = pickStructuralMemberAt(point, entities, TOLERANCE_CONFIG.HIT_TEST_FALLBACK);
      if (!picked) return false; // κλικ στο κενό → κρατά την αναμονή (δεν καταναλώνεται)

      const first = firstRef.current;
      if (phaseRef.current === 'awaitingFirst' || !first) {
        firstRef.current = picked;
        publishAnchor(picked);
        setPhase('awaitingNext');
        return true;
      }
      if (picked.entity.id === first.id) return false; // ίδιο μέλος → αγνόησε
      commitBetween(first, picked);
      firstRef.current = picked; // αλυσίδα: το 2ο μέλος γίνεται 1ο του επόμενου δοκαριού
      publishAnchor(picked);
      return true;
    },
    [commitBetween],
  );

  const deactivate = useCallback(() => {
    firstRef.current = null;
    BeamBetweenMembersStore.reset();
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    firstRef.current = null;
    BeamBetweenMembersStore.reset();
    setPhase((prev) => (prev === 'idle' ? 'idle' : 'awaitingFirst'));
  }, []);

  const getStatusText = useCallback((): string => {
    switch (phaseRef.current) {
      case 'awaitingFirst':
        return 'tools.beamBetween.statusFirst';
      case 'awaitingNext':
        return 'tools.beamBetween.statusNext';
      default:
        return '';
    }
  }, []);

  return {
    isActive: phase !== 'idle',
    activate,
    deactivate,
    reset,
    onCanvasClick,
    getStatusText,
  };
}
