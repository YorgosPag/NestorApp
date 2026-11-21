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
    rel.relationshipType.toLowerCase().includes(term)
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
