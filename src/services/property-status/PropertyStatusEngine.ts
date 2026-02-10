/**
 * 🏢 ENTERPRISE PROPERTY STATUS ENGINE
 *
 * Enterprise-class business logic engine για διαχείριση καταστάσεων ακινήτων
 * Implements advanced business rules, validation, και intelligent automation
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Production-ready status management engine
 */

import {
  EnhancedPropertyStatus,
  PropertyIntent,
  MarketAvailability,
  PropertyPriority,
  getStatusCategory,
  isPropertyAvailable,
  isPropertyCommitted,
  hasPropertyIssues
} from '@/constants/property-statuses-enterprise';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * 🏘️ Property με Enhanced Status Support
 */
export interface EnhancedProperty {
  id: string;
  status: EnhancedPropertyStatus;
  intent?: PropertyIntent;
  availability?: MarketAvailability;
  priority?: PropertyPriority;
  type?: string;
  price?: number;
  area?: number;
  lastStatusChange?: Date;
  statusChangeReason?: string;
  assignedAgent?: string;
}

/**
 * ⚡ Status Transition Rules
 */
export interface StatusTransitionRule {
  from: EnhancedPropertyStatus;
  to: EnhancedPropertyStatus;
  allowed: boolean;
  requiresApproval?: boolean;
  minimumRole?: 'agent' | 'manager' | 'admin';
  validationRules?: ValidationRule[];
  reason?: string;
}

/**
 * ✅ Validation Rule
 */
export interface ValidationRule {
  field: keyof EnhancedProperty;
  condition: 'required' | 'positive' | 'within-range' | 'custom';
  /** Validation value: number for positive, [min, max] for within-range */
  value?: number | [number, number] | string | boolean;
  customValidator?: (property: EnhancedProperty) => boolean;
  errorMessage: string;
}

/**
 * 📊 Status Analytics Result
 */
export interface StatusAnalytics {
  totalProperties: number;
  byStatus: Record<EnhancedPropertyStatus, number>;
  byCategory: Record<string, number>;
  byIntent: Record<PropertyIntent, number>;
  byAvailability: Record<MarketAvailability, number>;
  totalValue: number;
  averagePrice: number;
  trends: {
    recentSales: number;
    pendingTransactions: number;
    newListings: number;
  };
}

/**
 * 🎯 Status Recommendation
 */
export interface StatusRecommendation {
  currentStatus: EnhancedPropertyStatus;
  recommendedStatus: EnhancedPropertyStatus;
  confidence: number; // 0-1
  reasoning: string;
  actions: string[];
  urgency: 'low' | 'medium' | 'high';
}

// ============================================================================
// BUSINESS RULES ENGINE
// ============================================================================

/**
 * 🚀 Enterprise Property Status Engine
 *
 * Κεντρικό σύστημα διαχείρισης καταστάσεων ακινήτων με προηγμένη επιχειρηματική λογική
 */
export class PropertyStatusEngine {
  private transitionRules: StatusTransitionRule[] = [];
  private validationRules: ValidationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  // ========================================================================
  // STATUS VALIDATION & TRANSITIONS
  // ========================================================================

  /**
   * ✅ Validate if status transition is allowed
   */
  canTransition(
    from: EnhancedPropertyStatus,
    to: EnhancedPropertyStatus,
    userRole: 'agent' | 'manager' | 'admin' = 'agent'
  ): boolean {
    const rule = this.transitionRules.find(r => r.from === from && r.to === to);

    if (!rule) {
      // If no explicit rule exists, allow basic transitions
      return this.isBasicTransitionAllowed(from, to);
    }

    if (!rule.allowed) return false;
    if (rule.minimumRole && !this.hasRequiredRole(userRole, rule.minimumRole)) return false;

    return true;
  }

  /**
   * 🔍 Get allowed transitions for a status
   */
  getAllowedTransitions(
    status: EnhancedPropertyStatus,
    userRole: 'agent' | 'manager' | 'admin' = 'agent'
  ): EnhancedPropertyStatus[] {
    return this.transitionRules
      .filter(rule => rule.from === status && this.canTransition(status, rule.to, userRole))
      .map(rule => rule.to);
  }

  /**
   * ✅ Validate property data
   */
  validateProperty(property: EnhancedProperty): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Get applicable validation rules for current status
    const applicableRules = this.getValidationRulesForStatus(property.status);

    for (const rule of applicableRules) {
      const isValid = this.validateRule(property, rule);
      if (!isValid) {
        errors.push(rule.errorMessage);
      }
    }

    // Business logic validations
    if (property.status === 'for-sale' && (!property.price || property.price <= 0)) {
      errors.push('Για πώληση: Απαιτείται τιμή μεγαλύτερη από 0');
    }

    if (property.status === 'sold' && !property.price) {
      errors.push('Πωλημένο: Απαιτείται τιμή πώλησης');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ========================================================================
  // INTELLIGENT STATUS SUGGESTIONS
  // ========================================================================

  /**
   * 🎯 Suggest optimal status based on property characteristics
   */
  suggestStatus(property: Partial<EnhancedProperty>): StatusRecommendation[] {
    const recommendations: StatusRecommendation[] = [];

    // Business intelligence για status suggestions
    if (property.intent === 'sale' && property.price && property.price > 0) {
      recommendations.push({
        currentStatus: property.status || 'for-sale',
        recommendedStatus: 'for-sale',
        confidence: 0.95,
        reasoning: 'Ακίνητο με πρόθεση πώλησης και καθορισμένη τιμή',
        actions: ['Ενεργοποίηση marketing', 'Ενημέρωση αντιπροσώπων'],
        urgency: 'medium'
      });
    }

    if (property.intent === 'rental') {
      recommendations.push({
        currentStatus: property.status || 'for-rent',
        recommendedStatus: 'rental-only',
        confidence: 0.9,
        reasoning: 'Ακίνητο προορίζεται αποκλειστικά για ενοικίαση',
        actions: ['Καθορισμός μηνιαίου μισθώματος', 'Προετοιμασία συμβολαίου μίσθωσης'],
        urgency: 'medium'
      });
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 📊 Intelligent status categorization
   */
  categorizeProperty(property: EnhancedProperty): {
    category: string;
    marketStatus: 'active' | 'inactive' | 'pending';
    priority: PropertyPriority;
    recommendations: string[];
  } {
    const category = getStatusCategory(property.status);
    let marketStatus: 'active' | 'inactive' | 'pending' = 'inactive';
    let priority: PropertyPriority = property.priority || 'medium';
    const recommendations: string[] = [];

    // Determine market status
    if (isPropertyAvailable(property.status)) {
      marketStatus = 'active';
    } else if (isPropertyCommitted(property.status)) {
      marketStatus = 'pending';
    }

    // Generate intelligent recommendations
    if (property.status === 'for-sale' && !property.assignedAgent) {
      recommendations.push('Ανάθεση σε αντιπρόσωπο πωλήσεων');
    }

    if (hasPropertyIssues(property.status)) {
      recommendations.push('Επίλυση λειτουργικών ζητημάτων πριν την ενεργοποίηση');
    }

    return {
      category,
      marketStatus,
      priority,
      recommendations
    };
  }

  // ========================================================================
  // ANALYTICS & REPORTING
  // ========================================================================

  /**
   * 📊 Generate comprehensive status analytics
   */
  generateAnalytics(properties: EnhancedProperty[]): StatusAnalytics {
    const byStatus: Partial<Record<EnhancedPropertyStatus, number>> = {};
    const byCategory: Record<string, number> = {};
    const byIntent: Partial<Record<PropertyIntent, number>> = {};
    const byAvailability: Partial<Record<MarketAvailability, number>> = {};

    let totalValue = 0;
    let priceSum = 0;
    let priceCount = 0;

    for (const property of properties) {
      // Count by status
      byStatus[property.status] = (byStatus[property.status] || 0) + 1;

      // Count by category
      const category = getStatusCategory(property.status);
      byCategory[category] = (byCategory[category] || 0) + 1;

      // Count by intent
      if (property.intent) {
        byIntent[property.intent] = (byIntent[property.intent] || 0) + 1;
      }

      // Count by availability
      if (property.availability) {
        byAvailability[property.availability] = (byAvailability[property.availability] || 0) + 1;
      }

      // Calculate values
      if (property.price) {
        totalValue += property.price;
        priceSum += property.price;
        priceCount++;
      }
    }

    return {
      totalProperties: properties.length,
      byStatus: byStatus as Record<EnhancedPropertyStatus, number>,
      byCategory,
      byIntent: byIntent as Record<PropertyIntent, number>,
      byAvailability: byAvailability as Record<MarketAvailability, number>,
      totalValue,
      averagePrice: priceCount > 0 ? priceSum / priceCount : 0,
      trends: {
        recentSales: properties.filter(p => p.status === 'sold').length,
        pendingTransactions: properties.filter(p => isPropertyCommitted(p.status)).length,
        newListings: properties.filter(p => isPropertyAvailable(p.status)).length,
      }
    };
  }

  // ========================================================================
  // BATCH OPERATIONS
  // ========================================================================

  /**
   * 🔄 Bulk status update με validation
   */
  bulkUpdateStatus(
    properties: EnhancedProperty[],
    newStatus: EnhancedPropertyStatus,
    reason: string,
    userRole: 'agent' | 'manager' | 'admin' = 'agent'
  ): {
    successful: string[];
    failed: Array<{ id: string; reason: string }>;
  } {
    const successful: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const property of properties) {
      if (!this.canTransition(property.status, newStatus, userRole)) {
        failed.push({
          id: property.id,
          reason: `Μη επιτρεπτή μετάβαση από ${property.status} σε ${newStatus}`
        });
        continue;
      }

      const testProperty = { ...property, status: newStatus };
      const validation = this.validateProperty(testProperty);

      if (!validation.isValid) {
        failed.push({
          id: property.id,
          reason: validation.errors.join(', ')
        });
        continue;
      }

      successful.push(property.id);
    }

    return { successful, failed };
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  private initializeDefaultRules(): void {
    // Default transition rules
    this.transitionRules = [
      // Sales flow
      { from: 'for-sale', to: 'reserved', allowed: true },
      { from: 'for-sale', to: 'sold', allowed: true },
      { from: 'for-sale', to: 'off-market', allowed: true },
      { from: 'reserved', to: 'sold', allowed: true },
      { from: 'reserved', to: 'for-sale', allowed: true },

      // Rental flow
      { from: 'for-rent', to: 'rented', allowed: true },
      { from: 'for-rent', to: 'rental-only', allowed: true },
      { from: 'rented', to: 'for-rent', allowed: true },

      // Restricted transitions (require approval)
      { from: 'sold', to: 'for-sale', allowed: false, reason: 'Πωλημένο ακίνητο δεν μπορεί να επιστρέψει σε πώληση' },
      { from: 'company-owned', to: 'for-sale', allowed: true, requiresApproval: true, minimumRole: 'manager' },

      // Maintenance transitions
      { from: 'under-renovation', to: 'for-sale', allowed: true },
      { from: 'under-renovation', to: 'for-rent', allowed: true },
    ];
  }

  private isBasicTransitionAllowed(from: EnhancedPropertyStatus, to: EnhancedPropertyStatus): boolean {
    // Basic business logic για transitions που δεν έχουν ρητά rules
    if (from === to) return true;
    if (from === 'sold' || from === 'rented') return false; // Committed properties can't change
    return true;
  }

  private hasRequiredRole(userRole: string, requiredRole: string): boolean {
    const hierarchy = ['agent', 'manager', 'admin'];
    return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole);
  }

  private getValidationRulesForStatus(status: EnhancedPropertyStatus): ValidationRule[] {
    // Return applicable validation rules based on status
    return this.validationRules.filter(rule => {
      // Add logic to determine which rules apply to which statuses
      return true;
    });
  }

  private validateRule(property: EnhancedProperty, rule: ValidationRule): boolean {
    const value = property[rule.field];

    switch (rule.condition) {
      case 'required':
        return value !== null && value !== undefined && value !== '';
      case 'positive':
        return typeof value === 'number' && value > 0;
      case 'custom':
        return rule.customValidator ? rule.customValidator(property) : true;
      default:
        return true;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * 🚀 Global Enterprise Status Engine Instance
 *
 * Singleton instance για χρήση σε όλη την εφαρμογή
 */
export const propertyStatusEngine = new PropertyStatusEngine();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * ⚡ Quick validation function
 */
export function validatePropertyStatus(property: EnhancedProperty): boolean {
  return propertyStatusEngine.validateProperty(property).isValid;
}

/**
 * ✅ Quick transition check
 */
export function canChangeStatus(
  from: EnhancedPropertyStatus,
  to: EnhancedPropertyStatus,
  userRole?: 'agent' | 'manager' | 'admin'
): boolean {
  return propertyStatusEngine.canTransition(from, to, userRole);
}

/**
 * 🎯 Quick status suggestion
 */
export function getStatusSuggestions(property: Partial<EnhancedProperty>): StatusRecommendation[] {
  return propertyStatusEngine.suggestStatus(property);
}

/**
 * 📊 Quick analytics
 */
export function getPropertyAnalytics(properties: EnhancedProperty[]): StatusAnalytics {
  return propertyStatusEngine.generateAnalytics(properties);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  PropertyStatusEngine,
  propertyStatusEngine,
  validatePropertyStatus,
  canChangeStatus,
  getStatusSuggestions,
  getPropertyAnalytics,
};