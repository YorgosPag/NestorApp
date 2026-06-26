/**
 * useColumnBeamPromote — ADR-529 (beam promotes one-directional corner column Ι → Γ boundary element).
 *
 * Thin, decoupled bridge (αδελφός του `useStructuralAutoAttach`): ακούει `drawing:entity-created` και, όταν
 * το νέο entity είναι **δοκάρι** που πλαισιώνεται στη **μη-αναπτυσσόμενη (στενή) παρειά** μιας γωνιακής
 * κολόνας μίας κατεύθυνσης (EC8 ανεπαρκής κόμβος), προτείνει — με **confirm dialog** (Revit δεν αλλάζει
 * σιωπηλά γεωμετρία) — την προαγωγή της σε **Γ/L** ώστε να αποκτήσει σκέλος προς το δοκάρι (boundary
 * element). Στο «Ναι» εκτελεί ΕΝΑ undoable `UpdateColumnParamsCommand` ανά κολόνα + emit
 * `bim:column-params-updated`· το weld το αναλαμβάνει ο `useStructuralAutoAttach` (μηδέν νέος κώδικας
 * ένωσης). **ADR-529 §reframe (2026-06-27):** αμέσως μετά, ξανα-πλαισιώνει το δοκάρι στη ΝΕΑ παρειά του
 * σκέλους (`reframeBeamEndpointsToColumns` SSoT + `UpdateBeamParamsCommand`) — command-time, ΟΧΙ reactive
 * (ADR-492 §4)· χωρίς αυτό το beam endpoint έμενε stale στην παλιά παρειά (λαβές ≠ ορατό cut άκρο).
 *
 * **Detection + γεωμετρία ζουν στα SSoT modules** (`column-beam-promote-junction` + `column-beam-align`)·
 * εδώ μόνο event → confirm → command. **Re-detect στο execute-time** (μετά το confirm): το σύγχρονο weld/
 * attach (ίδιο event) μπορεί να έχει αλλάξει params της κολόνας — η επαναϋπολόγιση χτίζει το νέο L πάνω στα
 * **τρέχοντα** params (prev = τρέχοντα) ώστε να μην πατηθεί το attach.
 *
 * @see ../bim/columns/column-beam-promote-junction.ts — detectColumnPromotionsForBeam (detector SSoT)
 * @see ../bim/columns/column-promote-confirm-store.ts — confirm handshake
 * @see ./useStructuralAutoAttach.ts — ο δίδυμος (weld) + το ίδιο createLevelSceneManagerAdapter pattern
 * @see docs/centralized-systems/reference/adrs/ADR-529-beam-promotes-corner-column-to-boundary-element.md
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { UpdateColumnParamsCommand } from '../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateBeamParamsCommand } from '../core/commands/entity-commands/UpdateBeamParamsCommand';
import { detectColumnPromotionsForBeam, resyncPromotedBoundaryArmsForBeam } from '../bim/columns/column-beam-promote-junction';
import { reframeBeamEndpointsToColumns } from '../bim/beams/beam-column-reframe';
import { requestColumnPromoteConfirm } from '../bim/columns/column-promote-confirm-store';
import { isBeamEntity, isColumnEntity } from '../types/entities';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

export function useColumnBeamPromote(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const unsub = EventBus.on('drawing:entity-created', ({ entity }) => {
      const created = entity as unknown as Entity;
      if (!isBeamEntity(created)) return;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;

      const entities = scene.entities as unknown as readonly Entity[];
      const promotions = detectColumnPromotionsForBeam(created, entities);
      if (promotions.length === 0) return;

      void (async () => {
        const action = await requestColumnPromoteConfirm({ columnCount: promotions.length });
        if (action !== 'promote') return;

        // Re-detect στο execute-time (το weld/attach του ίδιου event μπορεί να άλλαξε params).
        const freshLevelId = levelManager.currentLevelId;
        if (!freshLevelId) return;
        const freshScene = levelManager.getLevelScene(freshLevelId);
        if (!freshScene) return;
        const freshEntities = freshScene.entities as unknown as readonly Entity[];
        const beamNow = freshEntities.find((e) => e.id === created.id);
        if (!beamNow || !isBeamEntity(beamNow)) return;
        const fresh = detectColumnPromotionsForBeam(beamNow, freshEntities);
        if (fresh.length === 0) return;

        const sm = createLevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          freshLevelId,
        );
        for (const p of fresh) {
          execute(new UpdateColumnParamsCommand(p.columnId, p.nextParams, p.previousParams, sm, false));
          EventBus.emit('bim:column-params-updated', { columnId: p.columnId });
        }

        // ADR-529 §reframe — μετά την προαγωγή το footprint της Γ μεγάλωσε (πόδι/σκέλος προς το
        // δοκάρι) → η στηρίζουσα παρειά μετακινήθηκε. Το `BeamParams.endPoint` πρέπει να ξανα-κοπεί
        // στη ΝΕΑ παρειά· αλλιώς μένει stale στην παλιά (= λαβές + αναλυτικό μήκος μέλους λάθος, μόνο
        // ο ADR-458 cutback το κρύβει οπτικά → λαβές «σημείο 1» ≠ ορατό άκρο «σημείο 2», Giorgio
        // 2026-06-27). Ο reframe cascade (ADR-492) τρέχει ΜΟΝΟ command-time μέσα στα transform commands,
        // ΟΧΙ reactive στο `bim:column-params-updated` (ADR-492 §4: reactive reframe σε analysis cycle →
        // freeze). Εδώ καλούμε τον ΙΔΙΟ pure SSoT (`reframeBeamEndpointsToColumns`) command-time μέσα στο
        // promote handler (μετά τα promotion commands) → undoable `UpdateBeamParamsCommand`, μηδέν reactive
        // loop. Idempotent (από τη θέση της κολόνας) → αμετάβλητο δοκάρι = null = μηδέν persist churn.
        const afterScene = levelManager.getLevelScene(freshLevelId);
        if (!afterScene) return;
        const afterEntities = afterScene.entities as unknown as readonly Entity[];
        const beamAfter = afterEntities.find((e) => e.id === created.id);
        if (!beamAfter || !isBeamEntity(beamAfter)) return;
        const reframed = reframeBeamEndpointsToColumns(beamAfter, afterEntities.filter(isColumnEntity));
        if (reframed) {
          const nextParams = { ...beamAfter.params, startPoint: reframed.startPoint, endPoint: reframed.endPoint };
          execute(new UpdateBeamParamsCommand(created.id, nextParams, beamAfter.params, sm, false));
          EventBus.emit('bim:beam-params-updated', { beamId: created.id });
        }
      })();
    });

    // ADR-529 Φ5 — **associative re-sync** (ο «ενιαίος οργανισμός», Giorgio 2026-06-25): όταν ο auto-sizer
    // ξανα-διαστασιολογεί το δοκάρι (`bim:beam-params-updated`), το foot κάθε προαχθείσας Γ-κολόνας
    // ξανα-ακολουθεί το **τρέχον** πλάτος δοκαριού (EC2/EC8: έδραση ≥ δοκάρι) — αλλιώς το foot έμενε stale
    // snapshot → στενότερο από το μεγαλωμένο δοκάρι = παραβίαση. Αυτόματο (ΧΩΡΙΣ confirm — δεν αλλάζει τύπο,
    // μόνο διατηρεί συμμόρφωση). Convergence guard στο pure helper (armLength≠width) → μηδέν κύκλος.
    const unsubResync = EventBus.on('bim:beam-params-updated', ({ beamId }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const entities = scene.entities as unknown as readonly Entity[];
      const beam = entities.find((e) => e.id === beamId);
      if (!beam || !isBeamEntity(beam)) return;
      const resyncs = resyncPromotedBoundaryArmsForBeam(beam, entities);
      if (resyncs.length === 0) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      for (const p of resyncs) {
        execute(new UpdateColumnParamsCommand(p.columnId, p.nextParams, p.previousParams, sm, false));
        EventBus.emit('bim:column-params-updated', { columnId: p.columnId });
      }
    });

    return () => {
      unsub();
      unsubResync();
    };
  }, [levelManager, execute]);
}
