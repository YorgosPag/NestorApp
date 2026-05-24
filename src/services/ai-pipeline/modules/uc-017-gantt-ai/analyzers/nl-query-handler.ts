/**
 * @fileoverview FAST-tier natural language query handler for UC-017 (ADR-034 §12)
 * Keyword pattern matching — no AI call needed. Maps Greek construction phrases
 * to structured data queries.
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { NLQueryResult, NLQueryType } from '../gantt-ai-types';

// ─── Pattern Registry ─────────────────────────────────────────────────────────

type PatternEntry = { patterns: string[]; queryType: NLQueryType };

const QUERY_PATTERNS: PatternEntry[] = [
  {
    queryType: 'delayed_tasks',
    patterns: ['καθυστερ', 'delay', 'πίσω', 'αργεί', 'αργούν', 'εκπρόθεσμ'],
  },
  {
    queryType: 'blocked_tasks',
    patterns: ['μπλοκ', 'blocked', 'μπλοκαρ', 'σταματ', 'ανασταλτ'],
  },
  {
    queryType: 'upcoming_tasks',
    patterns: ['σήμερα', 'αυτή την εβδομ', 'επόμεν', 'ξεκινά', 'αρχίζ', 'upcoming'],
  },
  {
    queryType: 'phase_status',
    patterns: ['κατάσταση', 'πρόοδος', 'status', 'progress', 'φάση', 'πόσο'],
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve a natural language construction query to structured results.
 */
export function handleNLQuery(
  query: string,
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): NLQueryResult {
  const queryType = detectQueryType(query);

  switch (queryType) {
    case 'delayed_tasks':    return buildDelayedResult(phases, tasks);
    case 'blocked_tasks':    return buildBlockedResult(phases, tasks);
    case 'upcoming_tasks':   return buildUpcomingResult(phases, tasks);
    case 'phase_status':     return buildStatusResult(phases, tasks);
    default:                 return buildGeneralResult(phases, tasks);
  }
}

// ─── Query Type Detection ────────────────────────────────────────────────────

function detectQueryType(query: string): NLQueryType {
  const normalized = query.toLowerCase();
  for (const entry of QUERY_PATTERNS) {
    if (entry.patterns.some(p => normalized.includes(p))) return entry.queryType;
  }
  return 'general';
}

// ─── Result Builders ─────────────────────────────────────────────────────────

function buildDelayedResult(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): NLQueryResult {
  const delayedPhases = phases.filter(p => p.status === 'delayed');
  const delayedTasks = tasks.filter(t => t.status === 'delayed');

  const matchedItems = [
    ...delayedPhases.map(p => ({ id: p.id, name: p.name, status: 'delayed' })),
    ...delayedTasks.map(t => ({ id: t.id, name: t.name, status: 'delayed' })),
  ];

  const answer = matchedItems.length === 0
    ? 'Δεν υπάρχουν καθυστερημένες φάσεις ή εργασίες.'
    : `Βρέθηκαν ${matchedItems.length} καθυστερημένα στοιχεία: ${
        matchedItems.slice(0, 5).map(i => i.name).join(', ')
      }${matchedItems.length > 5 ? ` και ${matchedItems.length - 5} ακόμα` : ''}.`;

  return { queryType: 'delayed_tasks', answer, matchedItems };
}

function buildBlockedResult(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): NLQueryResult {
  const blockedPhases = phases.filter(p => p.status === 'blocked');
  const blockedTasks = tasks.filter(t => t.status === 'blocked');

  const matchedItems = [
    ...blockedPhases.map(p => ({ id: p.id, name: p.name, status: 'blocked' })),
    ...blockedTasks.map(t => ({ id: t.id, name: t.name, status: 'blocked' })),
  ];

  const answer = matchedItems.length === 0
    ? 'Δεν υπάρχουν μπλοκαρισμένες φάσεις ή εργασίες.'
    : `${matchedItems.length} μπλοκαρισμένα στοιχεία: ${
        matchedItems.slice(0, 5).map(i => i.name).join(', ')
      }.`;

  return { queryType: 'blocked_tasks', answer, matchedItems };
}

function buildUpcomingResult(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): NLQueryResult {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcoming = [
    ...phases
      .filter(p => {
        const start = safeParse(p.plannedStartDate);
        return start && start >= now && start <= in7Days && p.status !== 'completed';
      })
      .map(p => ({ id: p.id, name: p.name, status: p.status })),
    ...tasks
      .filter(t => {
        const start = safeParse(t.plannedStartDate);
        return start && start >= now && start <= in7Days && t.status !== 'completed';
      })
      .map(t => ({ id: t.id, name: t.name, status: t.status })),
  ];

  const answer = upcoming.length === 0
    ? 'Δεν υπάρχουν επερχόμενες εργασίες στις επόμενες 7 ημέρες.'
    : `${upcoming.length} εργασίες ξεκινούν μέσα στις επόμενες 7 ημέρες: ${
        upcoming.slice(0, 5).map(i => i.name).join(', ')
      }.`;

  return { queryType: 'upcoming_tasks', answer, matchedItems: upcoming };
}

function buildStatusResult(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): NLQueryResult {
  const counts = countByStatus(phases, tasks);
  const totalProgress = phases.length > 0
    ? Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length)
    : 0;

  const answer = `Γενική κατάσταση — Φάσεις: ${phases.length} σύνολο ` +
    `(✅ ${counts.completed} ολοκλ., 🔄 ${counts.inProgress} σε εξέλιξη, ` +
    `⚠️ ${counts.delayed} καθυστ., 🚫 ${counts.blocked} μπλοκ.). ` +
    `Μέση πρόοδος: ${totalProgress}%.`;

  const matchedItems = phases.map(p => ({ id: p.id, name: p.name, status: p.status }));
  return { queryType: 'phase_status', answer, matchedItems };
}

function buildGeneralResult(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): NLQueryResult {
  const counts = countByStatus(phases, tasks);
  const answer = `Σύνοψη: ${phases.length} φάσεις, ${tasks.length} εργασίες. ` +
    `Καθυστερημένα: ${counts.delayed}, Μπλοκαρισμένα: ${counts.blocked}.`;

  return {
    queryType: 'general',
    answer,
    matchedItems: phases.map(p => ({ id: p.id, name: p.name, status: p.status })),
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function countByStatus(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): Record<string, number> {
  const all = [
    ...phases.map(p => p.status),
    ...tasks.map(t => t.status),
  ];
  return all.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, { completed: 0, inProgress: 0, delayed: 0, blocked: 0, planning: 0, notStarted: 0 });
}

function safeParse(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
