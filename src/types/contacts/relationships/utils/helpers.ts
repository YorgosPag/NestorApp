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
import type { RelationshipType } from '../core/relationship-types';
import { RELATIONSHIP_TYPE_PRIORITY_SCORES } from '../core/relationship-types';
import { COLOR_BRIDGE } from '../../../../design-system/color-bridge';

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
  const baseLabels: Record<RelationshipType, string> = {
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
    'friend': 'Φίλος',
    'family': 'Οικογένεια',
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
  const colorMap: Partial<Record<RelationshipType, string>> = {
    // ✅ ENTERPRISE: Semantic color mapping
    'employee': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,           // Blue -> Info semantic
    'manager': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,            // Purple -> Info semantic
    'director': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,           // Purple -> Info semantic
    'executive': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,          // Purple -> Info semantic
    'ceo': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,                // Purple -> Info semantic
    'shareholder': `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success}`,  // Green -> Success semantic
    'board_member': `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}`, // Orange -> Warning semantic
    'chairman': `${COLOR_BRIDGE.bg.error} ${COLOR_BRIDGE.text.error}`,         // Red -> Error semantic
    'civil_servant': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,      // Indigo -> Info semantic
    'department_head': `${COLOR_BRIDGE.bg.error} ${COLOR_BRIDGE.text.error}`,  // Red -> Error semantic
    'consultant': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,         // Teal -> Info semantic
    'contractor': `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}`,   // Yellow -> Warning semantic
    'vendor': `${COLOR_BRIDGE.bg.neutralSubtle} ${COLOR_BRIDGE.text.secondary}`, // ✅ ALREADY MIGRATED
    'client': `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success}`,       // Emerald -> Success semantic
    'partner': `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`             // Pink -> Info semantic
  };

  return colorMap[relationship.relationshipType] || `${COLOR_BRIDGE.bg.neutralSubtle} ${COLOR_BRIDGE.text.secondary}`;
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
    // ✅ ENTERPRISE: Semantic color mapping for relationship statuses
    'active': { label: 'Ενεργή', color: `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success}` },
    'inactive': { label: 'Αδρανής', color: `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}` },
    'pending': { label: 'Εκκρεμής', color: `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}` },
    'terminated': { label: 'Τερματισμένη', color: `${COLOR_BRIDGE.bg.error} ${COLOR_BRIDGE.text.error}` },
    'suspended': { label: 'Αναστολή', color: `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}` }
  };

  return statusMap[relationship.status] || { label: relationship.status, color: `${COLOR_BRIDGE.bg.neutralSubtle} ${COLOR_BRIDGE.text.secondary}` };
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
