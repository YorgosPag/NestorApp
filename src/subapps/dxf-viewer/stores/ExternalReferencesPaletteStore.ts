/**
 * ADR-736 Φ4 — Ορατότητα της παλέτας «Εξωτερικές Αναφορές». Singleton, μηδέν React.
 *
 * **Παλέτα, όχι modal** — και αυτό είναι το ίδιο συμπέρασμα που κατέγραψε το ADR-723 για τον
 * Διαχειριστή Στρώσεων, εδώ με ακόμη ισχυρότερο λόγο: ο κλάδος έχει απαντήσει ομόφωνα ότι το
 * μητρώο συνδέσμων είναι **μόνιμο εργαλείο**, όχι βήμα εισαγωγής —
 *   • AutoCAD `XREF` → *External References* palette, modeless, ανοίγει οποτεδήποτε·
 *   • Revit → *Manage Links*, με «Reload From…» πάνω σε ανοιχτό μοντέλο·
 *   • ArchiCAD → *Hotlink Manager*, ίδιο μοντέλο.
 *
 * Ο λόγος είναι δομικός, όχι στιλιστικός: **ένας σύνδεσμος σπάει και ΜΕΤΑ την εισαγωγή**
 * (μετακινήθηκε φάκελος, διαγράφηκε asset, άνοιξε παλιό αρχείο). Ένα βήμα wizard απαντά μόνο τη
 * στιγμή της εισαγωγής και **ποτέ ξανά** — και δεν υπάρχει καθόλου για σκηνή που ήρθε από τη
 * δεύτερη πόρτα (server wizard, `/api/floorplans/process`), η οποία δεν τρέχει ποτέ επίλυση.
 * Η παλέτα απαντά και στις τρεις περιπτώσεις με έναν μηχανισμό.
 *
 * @see ./LayerManagerPaletteStore — ο αδελφός (ADR-723), ίδιο ακριβώς σχήμα
 * @see ../ui/components/ExternalReferencesPalette — ο μοναδικός αναγνώστης της ορατότητας
 */

import { createToggleStore } from './createToggleStore';

export const ExternalReferencesPaletteStore = createToggleStore();

export type { ToggleStoreState as ExternalReferencesPaletteState } from './createToggleStore';
