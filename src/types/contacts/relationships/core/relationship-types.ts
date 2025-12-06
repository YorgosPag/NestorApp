// ============================================================================
// CORE RELATIONSHIP TYPES - ENTERPRISE MODULE
// ============================================================================
//
// 🎯 Core enumeration types for professional relationship management
// Single-purpose module for basic relationship type definitions
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

/**
 * 🔗 Relationship Types - Enterprise Standard Categories
 *
 * Based on industry-standard business relationship classifications
 * Used by Fortune 500 companies for contact management
 */
export type RelationshipType =
  // 👥 Employment Relationships
  | 'employee'                 // Υπάλληλος
  | 'manager'                  // Προϊστάμενος
  | 'director'                 // Διευθυντής
  | 'executive'                // Ανώτερο Στέλεχος
  | 'intern'                   // Εσωτερικός Εργαζόμενος
  | 'contractor'               // Εξωτερικός Συνεργάτης
  | 'consultant'               // Σύμβουλος

  // 🏢 Corporate Relationships
  | 'shareholder'              // Μέτοχος
  | 'board_member'             // Μέλος ΔΣ
  | 'chairman'                 // Πρόεδρος ΔΣ
  | 'ceo'                      // Γενικός Διευθυντής
  | 'representative'           // Εκπρόσωπος
  | 'partner'                  // Συνεργάτης/Εταίρος
  | 'vendor'                   // Προμηθευτής
  | 'client'                   // Πελάτης

  // 🏛️ Government/Service Relationships
  | 'civil_servant'            // Δημόσιος Υπάλληλος
  | 'elected_official'         // Εκλεγμένο Πρόσωπο
  | 'appointed_official'       // Διορισμένο Πρόσωπο
  | 'department_head'          // Προϊστάμενος Τμήματος
  | 'ministry_official'        // Στέλεχος Υπουργείου
  | 'mayor'                    // Δήμαρχος
  | 'deputy_mayor'             // Αντιδήμαρχος
  | 'regional_governor'        // Περιφερειάρχης

  // 🔗 Other Professional Relationships
  | 'advisor'                  // Σύμβουλος
  | 'mentor'                   // Μέντορας
  | 'protege'                  // Προστατευόμενος
  | 'colleague'                // Συνάδελφος
  | 'supplier'                 // Προμηθευτής
  | 'customer'                 // Πελάτης
  | 'competitor'               // Ανταγωνιστής
  | 'other';                   // Άλλο

/**
 * 📊 Relationship Status - Lifecycle Management
 *
 * Professional relationship lifecycle tracking
 * Essential for enterprise contact management
 */
export type RelationshipStatus =
  | 'active'                   // Ενεργή σχέση
  | 'inactive'                 // Αδρανής σχέση
  | 'pending'                  // Εκκρεμής σχέση
  | 'terminated'               // Τερματισμένη σχέση
  | 'suspended';               // Αναστολή σχέσης

/**
 * 💼 Employment Status - Detailed Work Classification
 *
 * Professional employment status for detailed HR tracking
 * Aligned with Greek labor law and EU standards
 */
export type EmploymentStatus =
  | 'full_time'                // Πλήρης απασχόληση
  | 'part_time'                // Μερική απασχόληση
  | 'contract'                 // Σύμβαση έργου
  | 'temporary'                // Προσωρινός
  | 'seasonal'                 // Εποχιακός
  | 'volunteer'                // Εθελοντής
  | 'retired'                  // Συνταξιούχος
  | 'on_leave'                 // Σε άδεια
  | 'terminated';              // Τερματισμένος

// ============================================================================
// TYPE COLLECTIONS FOR VALIDATION
// ============================================================================

/**
 * 👥 Employment-based relationship types
 */
export const EMPLOYMENT_RELATIONSHIP_TYPES: RelationshipType[] = [
  'employee', 'manager', 'director', 'executive', 'intern', 'contractor',
  'civil_servant', 'department_head', 'ministry_official'
];

/**
 * 🏢 Ownership-based relationship types
 */
export const OWNERSHIP_RELATIONSHIP_TYPES: RelationshipType[] = [
  'shareholder', 'board_member', 'chairman', 'ceo', 'partner'
];

/**
 * 🏛️ Government-based relationship types
 */
export const GOVERNMENT_RELATIONSHIP_TYPES: RelationshipType[] = [
  'civil_servant', 'elected_official', 'appointed_official', 'department_head',
  'ministry_official', 'mayor', 'deputy_mayor', 'regional_governor'
];

/**
 * 📊 Relationship priority scores for sorting
 */
export const RELATIONSHIP_TYPE_PRIORITY_SCORES: Record<RelationshipType, number> = {
  'ceo': 100,
  'chairman': 95,
  'director': 90,
  'executive': 85,
  'manager': 80,
  'board_member': 75,
  'elected_official': 75,
  'mayor': 70,
  'regional_governor': 70,
  'department_head': 65,
  'ministry_official': 60,
  'shareholder': 55,
  'representative': 50,
  'employee': 45,
  'civil_servant': 40,
  'contractor': 35,
  'consultant': 35,
  'advisor': 30,
  'partner': 25,
  'vendor': 20,
  'client': 20,
  'colleague': 15,
  'intern': 10,
  'other': 5,
  'appointed_official': 60,
  'deputy_mayor': 65,
  'mentor': 25,
  'protege': 15,
  'supplier': 20,
  'customer': 20,
  'competitor': 5
};