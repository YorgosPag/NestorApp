/**
 * Global stiffness assembly — pure SSoT (ADR-481, T3 / S4).
 *
 * Συναρμολογεί το ολικό μητρώο δυσκαμψίας K του φορέα: scatter κάθε στοιχειακού
 * k_global στους DOF του μέλους → penalty διαφράγματος → στηρίξεις (BC). Το K είναι
 * **κοινό σε όλους τους συνδυασμούς** (γραμμική ανάλυση) — συναρμολογείται μία φορά,
 * επιλύεται με διαφορετικό F ανά συνδυασμό.
 *
 * Κρατά cache στοιχειακών μητρώων (k_local + transform + dofs) ώστε το post-process
 * (εντατικά μεγέθη μέλους) να μην τα ξαναϋπολογίσει. Pure — zero React/DOM/Firestore.
 *
 * @see ./frame-element-stiffness.ts
 * @see ./member-section-properties.ts — ο τύπος του provider
 * @see ./frame-solver.ts — ο orchestrator
 */

import { scatterAdd, zeroMatrix, type Matrix } from './dense-matrix';
import { buildElementStiffness, type ElementStiffness } from './frame-element-stiffness';
import { applyDiaphragmPenalty } from './diaphragm-constraints';
import { buildDofMap, elementDofs, restrainMatrix, restrainedDofs, type DofMap } from './dof-map';
import type { MemberSectionProperties } from './member-section-properties';
import type { AnalyticalMember, AnalyticalModel, AnalyticalNode } from '../analytical-model-types';

/** Πάροχος ιδιοτήτων διατομής (injected → jest-clean, χωρίς entity store). */
export type SectionPropertyProvider = (member: AnalyticalMember) => MemberSectionProperties | null;

/** Συναρμολογημένο στοιχείο (cache για post-process). */
export interface AssembledElement {
  readonly member: AnalyticalMember;
  readonly stiffness: ElementStiffness;
  readonly dofs: readonly number[];
}

/** Αποτέλεσμα συναρμολόγησης: K (με BC) + χάρτες + cache + παραλειφθέντα μέλη. */
export interface AssembledStiffness {
  readonly k: Matrix;
  readonly dofMap: DofMap;
  readonly restrained: ReadonlySet<number>;
  readonly elements: readonly AssembledElement[];
  /** Μέλη χωρίς έγκυρη διατομή/γεωμετρία — παραλείφθηκαν (diagnostic). */
  readonly skippedMemberIds: readonly string[];
}

/** Scatter ενός μέλους στο K· επιστρέφει το cache element ή null (skip). */
function assembleMember(
  k: number[][], member: AnalyticalMember, nodeById: ReadonlyMap<string, AnalyticalNode>,
  map: DofMap, provider: SectionPropertyProvider,
): AssembledElement | null {
  const pi = nodeById.get(member.iNodeId)?.position;
  const pj = nodeById.get(member.jNodeId)?.position;
  const props = provider(member);
  if (!pi || !pj || !props) return null;
  const stiffness = buildElementStiffness(pi, pj, props);
  if (!stiffness) return null;
  const dofs = elementDofs(member, map);
  scatterAdd(k, stiffness.kGlobal, dofs);
  return { member, stiffness, dofs };
}

/**
 * Συναρμολόγησε το ολικό K με BC. Μέλη χωρίς διατομή/μηδενικού μήκους παραλείπονται
 * (καταγράφονται για diagnostics — δεν ρίχνουν τον solver).
 */
export function assembleGlobalStiffness(
  model: AnalyticalModel,
  provider: SectionPropertyProvider,
): AssembledStiffness {
  const dofMap = buildDofMap(model.nodes);
  const k = zeroMatrix(dofMap.dofCount);
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
  const elements: AssembledElement[] = [];
  const skippedMemberIds: string[] = [];
  for (const member of model.members) {
    const el = assembleMember(k, member, nodeById, dofMap, provider);
    if (el) elements.push(el);
    else skippedMemberIds.push(member.id);
  }
  applyDiaphragmPenalty(k, model.diaphragms, model.nodes, dofMap);
  const restrained = restrainedDofs(model.nodes, dofMap);
  restrainMatrix(k, restrained);
  return { k, dofMap, restrained, elements, skippedMemberIds };
}
