// ============================================================================
// RELATIONSHIP HELPER UTILITIES - ENTERPRISE MODULE
// ============================================================================
//
// ⚡ Utility functions for relationship processing and calculations
// Enterprise-grade helper functions for relationship management
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

// Import related types
import type { ContactRelationship } from '../interfaces/relationship';
import { RELATIONSHIP_TYPE_PRIORITY_SCORES } from '../core/relationship-types';

/**
 * ⭐ Get relationship priority score for sorting
 */
export function getRelationshipPriorityScore(relationship: ContactRelationship): number {
  let score = RELATIONSHIP_TYPE_PRIORITY_SCORES[relationship.relationshipType] || 0;

  // Boost score based on priority
  if (relationship.priority === 'critical') score += 20;
  else if (relationship.priority === 'high') score += 10;
  else if (relationship.priority === 'medium') score += 5;

  // Boost score based on relationship strength
  if (relationship.relationshipStrength === 'very_strong') score += 15;
  else if (relationship.relationshipStrength === 'strong') score += 10;
  else if (relationship.relationshipStrength === 'moderate') score += 5;

  return score;
}

/**
 * 🏷️ Generate relationship display label
 */
export function getRelationshipDisplayLabel(relationship: ContactRelationship): string {
  const baseLabels = {
    'employee': 'Εργαζόμενος',
    'manager': 'Προϊστάμενος',
    'director': 'Διευθυντής',
    'executive': 'Ανώτερο Στέλεχος',
    'intern': 'Εσωτερικός Εργαζόμενος',
    'contractor': 'Εξωτερικός Συνεργάτης',
    'consultant': 'Σύμβουλος',
    'shareholder': 'Μέτοχος',
    'board_member': 'Μέλος ΔΣ',
    'chairman': 'Πρόεδρος ΔΣ',
    'ceo': 'Γενικός Διευθυντής',
    'representative': 'Εκπρόσωπος',
    'partner': 'Συνεργάτης/Εταίρος',
    'vendor': 'Προμηθευτής',
    'client': 'Πελάτης',
    'civil_servant': 'Δημόσιος Υπάλληλος',
    'elected_official': 'Εκλεγμένο Πρόσωπο',
    'appointed_official': 'Διορισμένο Πρόσωπο',
    'department_head': 'Προϊστάμενος Τμήματος',
    'ministry_official': 'Στέλεχος Υπουργείου',
    'mayor': 'Δήμαρχος',
    'deputy_mayor': 'Αντιδήμαρχος',
    'regional_governor': 'Περιφερειάρχης',
    'advisor': 'Σύμβουλος',
    'mentor': 'Μέντορας',
    'protege': 'Προστατευόμενος',
    'colleague': 'Συνάδελφος',
    'supplier': 'Προμηθευτής',
    'customer': 'Πελάτης',
    'competitor': 'Ανταγωνιστής',
    'other': 'Άλλο'
  };

  return baseLabels[relationship.relationshipType] || relationship.relationshipType;
}

/**
 * ✅ ENTERPRISE: DEPRECATED - Use useSemanticColors().getRelationshipBadgeClass() instead
 *
 * Migration path:
 * ```typescript
 * // OLD (DEPRECATED):
 * className={getRelationshipBadgeColor(relationship)}
 *
 * // NEW (CENTRALIZED):
 * import { useSemanticColors } from '@/hooks/useSemanticColors';
 * const colors = useSemanticColors();
 * className={colors.getRelationshipBadgeClass(relationship.relationshipType)}
 * ```
 *
 * @deprecated Use colors.getRelationshipBadgeClass(relationshipType) from useSemanticColors hook
 */
export function getRelationshipBadgeColor(relationship: ContactRelationship): string {
  // Fallback implementation that now uses hardcoded values (for backward compatibility)
  const colorMap = {
    'employee': 'bg-blue-100 text-blue-800',
    'manager': 'bg-purple-100 text-purple-800',
    'director': 'bg-purple-100 text-purple-800',
    'executive': 'bg-purple-100 text-purple-800',
    'ceo': 'bg-purple-100 text-purple-800',
    'shareholder': 'bg-green-100 text-green-800',
    'board_member': 'bg-orange-100 text-orange-800',
    'chairman': 'bg-red-100 text-red-800',
    'civil_servant': 'bg-indigo-100 text-indigo-800',
    'department_head': 'bg-red-100 text-red-800',
    'consultant': 'bg-teal-100 text-teal-800',
    'contractor': 'bg-yellow-100 text-yellow-800',
    'vendor': 'bg-slate-100 text-slate-800',
    'client': 'bg-emerald-100 text-emerald-800',
    'partner': 'bg-pink-100 text-pink-800'
  };

  return colorMap[relationship.relationshipType] || 'bg-slate-100 text-slate-800';
}

/**
 * 📅 Calculate relationship duration in days
 */
export function getRelationshipDurationDays(relationship: ContactRelationship): number | null {
  if (!relationship.startDate) return null;

  const startDate = new Date(relationship.startDate);
  const endDate = relationship.endDate ? new Date(relationship.endDate) : new Date();

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * 📊 Get relationship status display info
 */
export function getRelationshipStatusInfo(relationship: ContactRelationship) {
  const statusMap = {
    'active': { label: 'Ενεργή', color: 'bg-green-100 text-green-800' },
    'inactive': { label: 'Αδρανής', color: 'bg-yellow-100 text-yellow-800' },
    'pending': { label: 'Εκκρεμής', color: 'bg-blue-100 text-blue-800' },
    'terminated': { label: 'Τερματισμένη', color: 'bg-red-100 text-red-800' },
    'suspended': { label: 'Αναστολή', color: 'bg-orange-100 text-orange-800' }
  };

  return statusMap[relationship.status] || { label: relationship.status, color: 'bg-slate-100 text-slate-800' };
}

/**
 * 🔍 Search relationships by text
 */
export function searchRelationships(
  relationships: ContactRelationship[],
  searchTerm: string
): ContactRelationship[] {
  if (!searchTerm.trim()) return relationships;

  const term = searchTerm.toLowerCase();

  return relationships.filter(rel =>
    rel.position?.toLowerCase().includes(term) ||
    rel.department?.toLowerCase().includes(term) ||
    rel.relationshipNotes?.toLowerCase().includes(term) ||
    rel.tags?.some(tag => tag.toLowerCase().includes(term)) ||
    getRelationshipDisplayLabel(rel).toLowerCase().includes(term)
  );
}

/**
 * 📈 Sort relationships by priority and importance
 */
export function sortRelationshipsByPriority(relationships: ContactRelationship[]): ContactRelationship[] {
  return relationships.sort((a, b) => {
    const scoreA = getRelationshipPriorityScore(a);
    const scoreB = getRelationshipPriorityScore(b);
    return scoreB - scoreA; // Descending order (highest score first)
  });
}