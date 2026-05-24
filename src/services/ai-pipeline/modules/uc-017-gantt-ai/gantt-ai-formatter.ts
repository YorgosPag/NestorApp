/**
 * @fileoverview Telegram reply formatter for UC-017 Gantt AI (ADR-034 §12)
 * Formats analyzer results into concise Greek Telegram messages.
 */

import type { GanttAILookupData, GanttAIFeature } from './gantt-ai-types';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Format UC-017 analysis results into a Telegram-ready text reply.
 */
export function formatGanttAIReply(data: GanttAILookupData): string {
  if (data.analyzerError) {
    return `⚠️ Δεν ήταν δυνατή η ανάλυση: ${data.analyzerError}`;
  }

  const header = buildHeader(data.feature, data.buildingId);

  switch (data.feature) {
    case 'delay_prediction':    return header + formatDelayReply(data);
    case 'risk_assessment':     return header + formatRiskReply(data);
    case 'auto_scheduling':     return header + formatScheduleReply(data);
    case 'resource_optimization': return header + formatResourceReply(data);
    case 'natural_language':    return header + formatNLReply(data);
    case 'photo_progress':      return header + formatPhotoReply(data);
    default:                    return header + 'Δεν βρέθηκαν αποτελέσματα.';
  }
}

/**
 * Build a short Telegram summary for the proposal step.
 */
export function buildGanttAISummary(data: GanttAILookupData): string {
  switch (data.feature) {
    case 'delay_prediction':
      return `Πρόβλεψη καθυστερήσεων: ${data.delayPredictions.length} φάσεις επηρεάζονται`;
    case 'risk_assessment':
      return `Αξιολόγηση κινδύνων: ${data.risks.length} κίνδυνοι εντοπίστηκαν`;
    case 'auto_scheduling':
      return `Αυτόματη χρονοδρομολόγηση: ${data.scheduleSuggestions.length} προτάσεις`;
    case 'resource_optimization':
      return `Βελτιστοποίηση πόρων: ${data.resourceConflicts.length} συγκρούσεις εντοπίστηκαν`;
    case 'natural_language':
      return data.nlResult?.answer ?? 'Ερώτημα φυσικής γλώσσας επεξεργάστηκε';
    case 'photo_progress':
      return `Πρόοδος από φωτογραφία: ${data.photoResult?.estimatedProgress ?? 0}%`;
    default:
      return 'AI ανάλυση Gantt ολοκληρώθηκε';
  }
}

// ─── Feature Formatters ──────────────────────────────────────────────────────

function buildHeader(feature: GanttAIFeature, buildingId: string | null): string {
  const featureLabel: Record<GanttAIFeature, string> = {
    delay_prediction: '📉 Πρόβλεψη Καθυστερήσεων',
    risk_assessment: '⚠️ Αξιολόγηση Κινδύνων',
    auto_scheduling: '📅 Αυτόματη Χρονοδρομολόγηση',
    resource_optimization: '👷 Βελτιστοποίηση Πόρων',
    natural_language: '💬 Ερώτημα Gantt',
    photo_progress: '📸 Πρόοδος από Φωτογραφία',
  };

  const label = featureLabel[feature] ?? 'Gantt AI';
  const scope = buildingId ? ` | Κτίριο: ${buildingId.slice(0, 8)}` : '';
  return `*${label}*${scope}\n\n`;
}

function formatDelayReply(data: GanttAILookupData): string {
  if (data.delayPredictions.length === 0) {
    return '✅ Δεν εντοπίστηκαν καθυστερήσεις στο πρόγραμμα.';
  }

  const lines = data.delayPredictions.slice(0, 5).map(p => {
    const icon = severityIcon(p.severity);
    return `${icon} *${p.phaseName}*: ${p.delayDays} ημέρες πίσω (${p.confidence}% εμπιστοσύνη)\n   ${p.reason}`;
  });

  const extra = data.delayPredictions.length > 5
    ? `\n...και ${data.delayPredictions.length - 5} ακόμα φάσεις.`
    : '';

  return lines.join('\n\n') + extra;
}

function formatRiskReply(data: GanttAILookupData): string {
  if (data.risks.length === 0) {
    return '✅ Δεν εντοπίστηκαν σημαντικοί κίνδυνοι χρονοδιαγράμματος.';
  }

  const lines = data.risks.slice(0, 5).map(r => {
    const icon = severityIcon(r.severity);
    return `${icon} *${r.description}*\n   💡 ${r.recommendation}`;
  });

  return lines.join('\n\n');
}

function formatScheduleReply(data: GanttAILookupData): string {
  if (data.scheduleSuggestions.length === 0) {
    return '✅ Το τρέχον χρονοδιάγραμμα είναι βέλτιστο.';
  }

  const lines = data.scheduleSuggestions.slice(0, 5).map((s, i) =>
    `${i + 1}. *${s.taskName}*\n   📅 ${s.suggestedStartDate} → ${s.suggestedEndDate}\n   ${s.rationale}`
  );

  return lines.join('\n\n');
}

function formatResourceReply(data: GanttAILookupData): string {
  if (data.resourceConflicts.length === 0) {
    return '✅ Δεν εντοπίστηκαν συγκρούσεις πόρων.';
  }

  const lines = data.resourceConflicts.slice(0, 5).map(c =>
    `⚡ *${c.resourceName}*: ${c.overlappingPeriod}\n   💡 ${c.suggestion}`
  );

  return lines.join('\n\n');
}

function formatNLReply(data: GanttAILookupData): string {
  return data.nlResult?.answer ?? 'Δεν βρέθηκαν αποτελέσματα για το ερώτημά σας.';
}

function formatPhotoReply(data: GanttAILookupData): string {
  const r = data.photoResult;
  if (!r || r.confidence === 0) {
    return '❌ Δεν ήταν δυνατή η ανάλυση της φωτογραφίας.';
  }

  const obs = r.observations.slice(0, 3).map(o => `• ${o}`).join('\n');
  const elements = r.detectedElements.length > 0
    ? `\n🔍 Εντοπίστηκαν: ${r.detectedElements.slice(0, 4).join(', ')}`
    : '';

  return `📊 Εκτιμώμενη πρόοδος: *${r.estimatedProgress}%* (${r.confidence}% εμπιστοσύνη)\n\n${obs}${elements}`;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high':     return '🟠';
    case 'medium':   return '🟡';
    default:         return '🟢';
  }
}
