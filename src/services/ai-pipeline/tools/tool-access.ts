/**
 * Ποια εργαλεία έχει ο θεατής — η πολιτική εργαλείων του πράκτορα (ADR-257 · OWASP LLM06 «complete mediation»)
 *
 * Τρία επίπεδα, από έξω προς τα μέσα:
 *
 *   1. {@link toolsForViewer} — το μοντέλο δεν βλέπει ό,τι δεν δικαιούται ο θεατής, άρα ούτε το ζητά.
 *   2. {@link isToolAllowed} — ο `AgenticToolExecutor` ρωτά σε **κάθε** κλήση. Το (1) διαμορφώνει το μοντέλο και
 *      το μοντέλο δεν είναι σημείο επιβολής: ένα όνομα από prompt injection πρέπει να σταματά εδώ.
 *   3. Οι handlers κρίνουν την **συγκεκριμένη** εγγραφή (`enforceRoleAccess` · `file-cde-reach`).
 *
 * Deny-by-default: ο κατάλογος είναι του ρόλου (`allowedTools`), όχι του εργαλείου, άρα νέο εργαλείο είναι
 * διαχειριστικό μέχρι να το δηλώσει ρητά κάποιος ρόλος.
 *
 * @module services/ai-pipeline/tools/tool-access
 * @see config/ai-role-access-matrix — η αυθεντία ρόλων
 */

import { getAccessConfig, type AgenticContext } from './executor-shared';

/** Μπορεί ο θεατής να καλέσει αυτό το εργαλείο; Μόνο το `isAdmin` παρακάμπτει τον κατάλογο. */
export function isToolAllowed(toolName: string, ctx: AgenticContext): boolean {
  if (ctx.isAdmin) return true;
  const { allowedTools } = getAccessConfig(ctx);
  return allowedTools === 'all' || allowedTools.includes(toolName);
}

/** Ο κατάλογος εργαλείων που ανακοινώνεται στο μοντέλο για αυτόν τον θεατή. */
export function toolsForViewer<T extends { readonly function: { readonly name: string } }>(tools: readonly T[], ctx: AgenticContext): T[] {
  return tools.filter((tool) => isToolAllowed(tool.function.name, ctx));
}
