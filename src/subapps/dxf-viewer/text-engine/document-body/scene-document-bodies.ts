/**
 * @fileoverview Ζωντανή σκηνή → είσοδος του Λ1β (ADR-759 §4.6, Άξονας Α).
 *
 * **Το subapp αποκωδικοποιεί, το `src/lib` καταλαβαίνει.** Το ξεγύμνωμα των κωδικών MTEXT
 * απαιτεί τον tokenizer, που ζει εδώ· ο αναγνώστης ζει στο `src/lib/document-body` ώστε να τον
 * βλέπει ο έλεγχος τύπων (το `src/subapps/dxf-viewer/**` **εξαιρείται** από το root
 * `tsconfig.json`) και να τον φτάνει ο Λ2 χωρίς να σύρει το subapp.
 *
 * 🔑 **Καμία δεύτερη μηχανή**: χρησιμοποιείται ο ίδιος `sceneCellFromTextEntity` και ο ίδιος
 * `mtextToSegments` με την πινακίδα. Ό,τι διορθώνεται εκεί ωφελεί αυτόματα και εδώ — και το
 * ξεγύμνωμα είναι ακριβώς το σημείο όπου το πραγματικό αρχείο σπάει το «1.364,05» σε **τρία**
 * κομμάτια μορφοποίησης (ADR-745 §2.3 Παγίδα Α).
 *
 * @module subapps/dxf-viewer/text-engine/document-body/scene-document-bodies
 */

import type { DocumentTextSource } from '@/types/document-body-reading';
import type { TitleBlockSourceCell } from '@/types/title-block-reading';
import type { Entity } from '../../types/entities';
import { isTextEntity } from '../../types/entities';
import type { SceneLayer } from '../../types/scene-types';
import { mtextToSegments } from '../title-block/reading/mtext-segments';
import { sceneCellFromTextEntity } from '../title-block/reading/scene-title-block-cells';

/**
 * Ένα αποκωδικοποιημένο κελί → είσοδος του Λ1β.
 *
 * ⚠️ Το ύψος της οντότητας **περνά**: τα `\H` του MTEXT έρχονται και σε **απόλυτη** μορφή, και
 * χωρίς τη μονάδα τους οι γραμμές θα έπαιρναν λάθος συντελεστή. Ο Λ1β δεν χρησιμοποιεί σήμερα
 * τους συντελεστές, αλλά μια αποκωδικοποίηση που είναι λάθος «μόνο σε πεδίο που δεν κοιτάμε»
 * είναι λάθος που περιμένει.
 */
export function documentSourceFromCell(
  cell: TitleBlockSourceCell,
  layerName: string,
): DocumentTextSource {
  return {
    handle: cell.handle,
    at: { x: cell.x, y: cell.y },
    layerName,
    lines: mtextToSegments(cell.raw, cell.height).map((segment) => segment.text),
  };
}

/**
 * Όλα τα κείμενα της σκηνής, αποκωδικοποιημένα.
 *
 * 🔴 **Δεν φιλτράρει layers — και αυτό είναι απόφαση, όχι παράλειψη.** Ποιο κείμενο είναι
 * έγγραφο το αποφασίζει ο **τίτλος** του (`readDocumentBodies`), γιατί μετρήθηκε ότι το layer
 * δεν το λέει: στο `G753_ergasia F.dxf` το `ΠΕΡΙΓΡΑΦΗ` έχει 79 κείμενα και **2** έγγραφα, ενώ
 * ένα από τα τέσσερα έγγραφα ζει σε **άλλο** layer (`Περίγραμμα`). Λίστα layers θα έχανε το ένα
 * και θα έμπαζε 77 θορύβου.
 *
 * Το κόστος είναι μια αποκωδικοποίηση ανά κείμενο (574 στο δείγμα), δηλαδή ό,τι κάνει ήδη ο
 * σαρωτής πινακίδας ανά layer.
 */
export function collectDocumentSources(
  entities: readonly Entity[],
  layersById: Readonly<Record<string, SceneLayer>>,
): DocumentTextSource[] {
  const sources: DocumentTextSource[] = [];

  for (const entity of entities) {
    if (!isTextEntity(entity)) continue;
    const cell = sceneCellFromTextEntity(entity);
    if (!cell) continue;
    sources.push(documentSourceFromCell(cell, layersById[entity.layerId]?.name ?? ''));
  }

  return sources;
}
