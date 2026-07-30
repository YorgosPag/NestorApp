/**
 * =============================================================================
 * AGENTIC TOOL CATALOG — ό,τι βλέπει το μοντέλο, σε ένα σημείο (ADR-734 Φ3)
 * =============================================================================
 *
 * Ο κατάλογος εργαλείων του πράκτορα προέρχεται πλέον από **δύο** πηγές:
 *
 *   1. `AGENTIC_TOOL_DEFINITIONS` — 40 **χειρόγραφοι** ορισμοί (επαφές, ESCO,
 *      προμήθειες, μηνύματα, αρχεία, χρηματοοικονομικά). Ιστορικοί, ανέγγιχτοι.
 *   2. `BOQ_CAPABILITY_TOOL_DEFINITIONS` — **παραγόμενοι** από το Capability
 *      Registry (ADR-734 §5.2). Επτά σήμερα· κάθε νέος τομέας προστίθεται εδώ.
 *
 * ⚠️ Χωρίς αυτό το αρχείο, το «τι βλέπει το μοντέλο» θα οριζόταν με ένα
 * `[...a, ...b]` σε κάθε σημείο κλήσης. Δύο σημεία κλήσης = δύο διαφορετικοί
 * κατάλογοι εργαλείων = ο πράκτορας απαντά διαφορετικά ανάλογα με το κανάλι
 * από το οποίο τον ρώτησες, χωρίς κανένα σφάλμα να το προδίδει.
 *
 * ⚠️ `server-only`: οι παραγόμενοι ορισμοί έλκουν το admin-SDK μονοπάτι
 * ανάγνωσης. Ο κατάλογος **δεν** επιτρέπεται να φτάσει σε bundle browser.
 *
 * @module services/ai-pipeline/tools/agentic-tool-catalog
 * @see ADR-734 §5.2, §8.3 · ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { type AgenticToolDefinition, AGENTIC_TOOL_DEFINITIONS } from './agentic-tool-definitions';
import { BOQ_CAPABILITY_TOOL_DEFINITIONS } from './handlers/boq-capability-handler';

/**
 * Όλα τα εργαλεία που ανακοινώνονται στο μοντέλο.
 *
 * Οι παραγόμενοι μπαίνουν **μετά** τους χειρόγραφους ώστε το πρόθεμα του prompt
 * να μένει σταθερό για τους υπάρχοντες: σταθερό prefix ⇒ το prompt caching του
 * παρόχου συνεχίζει να πιάνει αντί να ακυρώνεται από την προσθήκη.
 */
export const ALL_AGENTIC_TOOL_DEFINITIONS: readonly AgenticToolDefinition[] = [
  ...AGENTIC_TOOL_DEFINITIONS,
  ...BOQ_CAPABILITY_TOOL_DEFINITIONS,
];
