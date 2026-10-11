/**
 * ADR-911 Φ3β — **Η προεπισκόπηση του βοηθού**: τι φωτίζεται στον καμβά για μία πρόταση.
 *
 * ΚΑΜΙΑ δική της γεωμετρία. Το σώμα κάθε έτοιμου τοίχου έρχεται από το
 * `computeFillingWallFootprints` — δηλαδή από το `resolveWallPaintedBodies`, το ΙΔΙΟ κόψιμο που
 * τρέχει η απόδοση (ADR-911 Φ3α-4). Αν ο βοηθός υπολόγιζε μόνος του το σώμα, θα ξαναγεννιόταν
 * ακριβώς το σφάλμα που έκλεισε εκείνη η φάση: πράσινο που δεν είναι ό,τι θα ζωγραφιστεί.
 *
 *   · `ready`           — τα ΚΟΜΜΑΤΙΑ του σώματος όπως θα ζωγραφιστούν (κολώνα στη μέση ⇒ δύο).
 *   · οι άλλες τρεις    — το ανιχνευμένο ορθογώνιο όπως είναι: δεν θα γίνει τοίχος, άρα δεν έχει
 *                         σώμα να κοπεί.
 *   · ανεξήγητες γραμμές — ό,τι έχει τον ρόλο «τοίχος» αλλά δεν ανήκει σε κανένα ορθογώνιο:
 *                         ο τοίχος που ΔΕΝ θα χτιστεί (αναφορά κάλυψης).
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./wall-proposal.ts (η πρόταση)
 * @see ../walls/wall-painted-body.ts (το ΕΝΑ SSoT του ζωγραφιζόμενου σώματος)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §Φ3β
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { computeFillingWallFootprints } from '../walls/filling-walls-compute';
import { extractLineSegments } from '../walls/wall-in-region';
import type { WallBodyPieces } from '../walls/wall-painted-body';
import type { WallProposal, WallProposalStatus, WallThicknessGroup } from './wall-proposal';

/** Ένα ανιχνευμένο ορθογώνιο, όπως φωτίζεται. */
export interface AssistantPreviewZone {
  /** Το κλειδί του στοιχείου της πρότασης (`WallProposalItem.key`). */
  readonly key: string;
  readonly status: WallProposalStatus;
  /** Τα πολύγωνα (κόσμος) που ζωγραφίζονται. Κενό ⇒ ο τοίχος καταπίνεται ολόκληρος από κολώνα. */
  readonly pieces: WallBodyPieces;
  /** i18n key του λόγου — ΜΟΝΟ όταν `status === 'rejected'`. */
  readonly reason?: string;
  readonly thicknessMm: number;
}

/** Μία γραμμή με ρόλο «τοίχος» που δεν εξηγήθηκε από κανένα ορθογώνιο. */
export interface UnexplainedSegment {
  readonly start: Point2D;
  readonly end: Point2D;
}

export interface AssistantPreview {
  readonly zones: readonly AssistantPreviewZone[];
  readonly unexplained: readonly UnexplainedSegment[];
}

/**
 * Η προεπισκόπηση μιας πρότασης πάνω σε ΑΥΤΗ τη σκηνή. Η σκηνή πρέπει να είναι εκείνη από την
 * οποία βγήκε η πρόταση: τα σώματα κρίνονται ανάμεσα στους τοίχους και τις κολώνες της.
 */
export function buildAssistantPreview(
  proposal: WallProposal,
  sceneEntities: readonly Entity[],
): AssistantPreview {
  // Σειρά `proposal.walls` = σειρά των `ready` στοιχείων (έτσι τα παράγει ο πυρήνας).
  const bodies = computeFillingWallFootprints(proposal.walls, sceneEntities);
  let nextReady = 0;
  const zones = proposal.items.map((item): AssistantPreviewZone => {
    const base = { key: item.key, status: item.status, thicknessMm: item.thicknessMm };
    if (item.status === 'ready') {
      const pieces = bodies[nextReady] ?? [];
      nextReady += 1;
      return { ...base, pieces };
    }
    const rectRing = item.rect.polygon.map((p) => ({ x: p.x, y: p.y }));
    return item.reason ? { ...base, pieces: [rectRing], reason: item.reason } : { ...base, pieces: [rectRing] };
  });
  const orphanIds = new Set(proposal.coverage.unexplainedIds);
  const unexplained = extractLineSegments(sceneEntities.filter((e) => orphanIds.has(e.id))).map(
    (s): UnexplainedSegment => ({ start: { x: s.start.x, y: s.start.y }, end: { x: s.end.x, y: s.end.y } }),
  );
  return { zones, unexplained };
}

/**
 * Το αποτύπωμα μιας πρότασης: ό,τι είδε ο άνθρωπος όταν ενέκρινε. Δύο προτάσεις με το ίδιο
 * αποτύπωμα γράφουν τους ΙΔΙΟΥΣ τοίχους. Τα ids των τοίχων ΔΕΝ μπαίνουν — γεννιούνται ξανά σε
 * κάθε υπολογισμό και δεν είναι μέρος αυτού που εγκρίθηκε.
 */
export function wallProposalSignature(proposal: WallProposal): string {
  return proposal.items
    .map((item) =>
      [
        item.key,
        item.status,
        item.reason ?? '',
        item.wall ? `${item.wall.typeId ?? ''}#${JSON.stringify(item.wall.params)}` : '',
      ].join('|'),
    )
    .join('\n');
}

/**
 * Δ3 — οι ομάδες πάχους που ΚΛΕΙΔΩΝΟΥΝ την έγκριση: όσες θα γράψουν τουλάχιστον έναν τοίχο και
 * δεν έχουν επιβεβαιωθεί από άνθρωπο. Ομάδα που δεν γράφει τίποτα (όλα υπάρχοντα / απορριφθέντα
 * / προς απόφαση) δεν ζητά απόφαση για λειτουργία που δεν θα εφαρμοστεί πουθενά.
 */
export function groupsAwaitingConfirmation(proposal: WallProposal): readonly WallThicknessGroup[] {
  const readyKeys = new Set(proposal.items.filter((i) => i.status === 'ready').map((i) => i.key));
  return proposal.groups.filter((g) => !g.confirmed && g.keys.some((k) => readyKeys.has(k)));
}

/** Πόσα στοιχεία της πρότασης έχει κάθε κατάσταση (όλες παρούσες, και οι μηδενικές). */
export function countProposalByStatus(proposal: WallProposal): Readonly<Record<WallProposalStatus, number>> {
  const counts: Record<WallProposalStatus, number> = { ready: 0, 'needs-decision': 0, existing: 0, rejected: 0 };
  for (const item of proposal.items) counts[item.status] += 1;
  return counts;
}
