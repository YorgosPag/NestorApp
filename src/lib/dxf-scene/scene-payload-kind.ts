/**
 * =============================================================================
 * ΤΙ ΕΙΝΑΙ ΑΥΤΑ ΤΑ BYTES; — η μορφή μιας σκηνής αποφασίζεται από το ΠΕΡΙΕΧΟΜΕΝΟ
 * =============================================================================
 *
 * **Το ερώτημα**: *«Κατέβασα bytes για να δείξω ένα σχέδιο — είναι έτοιμη σκηνή (JSON) ή πρωτότυπο DXF;»*
 *
 * 🔴 **ΓΙΑΤΙ ΧΡΕΙΑΣΤΗΚΕ — ΜΕΤΡΗΜΕΝΟ 2026-10-05 (ADR-899 §9 θέμα 8)**: ο φορτωτής αποφάσιζε τη μορφή από το `ext`
 * της εγγραφής και το URL από το `downloadUrl` — **δύο πηγές που στις εγγραφές CAD διαφωνούν** (`ext: 'dxf'`,
 * `downloadUrl → ….scene.json`, 10 στις 10 στην παραγωγή). Το JSON της σκηνής περνούσε από τον αναλυτή DXF, που
 * δεν έχει έλεγχο «είναι αυτό DXF;» και επέστρεφε **επιτυχία με 0 οντότητες** ⇒ σιωπηλός λευκός καμβάς.
 *
 * 🏆 **Πρακτική** (libmagic / browsers «content sniffing» / AutoCAD-ODA που διαβάζουν τη σφραγίδα του αρχείου, ποτέ
 * την κατάληξη): η μορφή είναι ιδιότητα των bytes. Το όνομα και το πεδίο της βάσης είναι **ισχυρισμοί**.
 *
 * ⚠️ **Καθαρό module** — καμία ανάγνωση αρχείου, κανένα I/O· δέχεται την **κεφαλή** ως κείμενο.
 *
 * @module lib/dxf-scene/scene-payload-kind
 */

/** **Κλειστό σύνολο.** `unknown` = ούτε σκηνή ούτε DXF — ποτέ δεν μαντεύεται. */
export type ScenePayloadKind = 'scene-json' | 'dxf' | 'unknown';

/** Πόσα bytes κεφαλής αρκούν: η πρώτη γραμμή ενός DXF είναι κωδικός ομάδας, το JSON ανοίγει με `{`. */
export const SCENE_PAYLOAD_HEAD_BYTES = 512;

/** Η σφραγίδα του δυαδικού DXF (AutoCAD DXF Reference — «Binary DXF Files»). */
const BINARY_DXF_SENTINEL = 'AutoCAD Binary DXF';

/** ASCII DXF: η πρώτη μη κενή γραμμή είναι **ακέραιος κωδικός ομάδας** (`0`, `999`, …) μόνος του. */
const DXF_FIRST_GROUP_CODE = /^\s*\d{1,4}[ \t]*\r?\n/;

/**
 * **Τι μορφή έχουν αυτά τα bytes;** — από την κεφαλή τους.
 *
 * Τα NUL αφαιρούνται ώστε μια κεφαλή UTF-16 (κάθε δεύτερο byte `\0`) να διαβάζεται όπως η UTF-8· το BOM επίσης.
 */
export function classifyScenePayloadHead(head: string): ScenePayloadKind {
  const text = head.replace(/\u0000/g, '').replace(/^[﻿�ÿþ]+/, '');
  if (text.startsWith(BINARY_DXF_SENTINEL)) return 'dxf';
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) return 'scene-json';
  if (DXF_FIRST_GROUP_CODE.test(text)) return 'dxf';
  return 'unknown';
}
