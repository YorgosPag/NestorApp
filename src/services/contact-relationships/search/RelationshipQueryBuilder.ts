// ============================================================================
// RELATIONSHIP QUERY BUILDER
// ============================================================================
//
// 🔧 Dynamic query construction για Firestore relationship queries
// Enterprise-grade query builder με fluent API και optimization
//
// Architectural Pattern: Builder Pattern + Fluent Interface
// Responsibility: Dynamic query construction και optimization
//
// ============================================================================

import {
  RelationshipType,
  RelationshipStatus
} from '@/types/contacts/relationships';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  Query,
  DocumentSnapshot,
  WhereFilterOp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ENTITY_STATUS } from '@/constants/entity-status-values';
import { createModuleLogger } from '@/lib/telemetry';

import type { QueryFilter, QuerySort, QueryPagination, QueryFilterValue, CompiledQuery } from './relationship-query-types';

// Re-export types for backward compatibility
export type { QueryFilterValue, QueryFilter, QuerySort, QueryPagination, CompiledQuery } from './relationship-query-types';

const logger = createModuleLogger('RelationshipQueryBuilder');

// ============================================================================
// QUERY BUILDER CLASS
// ============================================================================

/**
 * 🔧 Relationship Query Builder
 *
 * Enterprise-grade query builder για dynamic Firestore query construction.
 * Provides fluent API για building complex relationship queries.
 *
 * Features:
 * - Fluent API για easy query building
 * - Automatic query optimization
 * - Firestore index detection
 * - Query cost estimation
 * - Pagination support
 * - Complex filtering με AND/OR logic
 */
export class RelationshipQueryBuilder {
  private filters: QueryFilter[] = [];
  private sorts: QuerySort[] = [];
  private pagination: QueryPagination = {};
  private collectionName = COLLECTIONS.CONTACT_RELATIONSHIPS;

  // ========================================================================
  // FACTORY METHODS
  // ========================================================================

  static create(): RelationshipQueryBuilder {
    return new RelationshipQueryBuilder();
  }

  /** @see relationship-query-factories.ts for convenience factories */
  static forContact(contactId: string): RelationshipQueryBuilder {
    return new RelationshipQueryBuilder()
      .where('sourceContactId', '==', contactId)
      .orWhere('targetContactId', '==', contactId)
      .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE);
  }

  static forOrganization(organizationId: string): RelationshipQueryBuilder {
    return new RelationshipQueryBuilder()
      .where('targetContactId', '==', organizationId)
      .whereIn('relationshipType', [
        'employee', 'manager', 'director', 'executive',
        'civil_servant', 'department_head', 'ministry_official'
      ])
      .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE);
  }

  static forDepartment(department: string): RelationshipQueryBuilder {
    return new RelationshipQueryBuilder()
      .where('department', '==', department)
      .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE)
      .orderBy('position', 'asc');
  }

  // ========================================================================
  // FILTER METHODS (Fluent API)
  // ========================================================================

  where(field: string, operator: WhereFilterOp, value: QueryFilterValue): RelationshipQueryBuilder {
    this.filters.push({ field, operator, value });
    return this;
  }

  orWhere(field: string, operator: WhereFilterOp, value: QueryFilterValue): RelationshipQueryBuilder {
    logger.warn('OR queries require special handling with multiple Firestore queries');
    return this.where(field, operator, value);
  }

  whereEqual(field: string, value: QueryFilterValue): RelationshipQueryBuilder {
    return this.where(field, '==', value);
  }

  whereIn(field: string, values: QueryFilterValue[]): RelationshipQueryBuilder {
    if (values.length === 0) return this;
    if (values.length === 1) return this.where(field, '==', values[0]);
    return this.where(field, 'in', values as QueryFilterValue);
  }

  whereNotEqual(field: string, value: QueryFilterValue): RelationshipQueryBuilder {
    return this.where(field, '!=', value);
  }

  whereGreaterThan(field: string, value: QueryFilterValue): RelationshipQueryBuilder {
    return this.where(field, '>', value);
  }

  whereLessThan(field: string, value: QueryFilterValue): RelationshipQueryBuilder {
    return this.where(field, '<', value);
  }

  whereArrayContains(field: string, value: QueryFilterValue): RelationshipQueryBuilder {
    return this.where(field, 'array-contains', value);
  }

  // ========================================================================
  // SPECIALIZED FILTER METHODS
  // ========================================================================

  fromContact(contactId: string): RelationshipQueryBuilder { return this.whereEqual('sourceContactId', contactId); }
  toContact(contactId: string): RelationshipQueryBuilder { return this.whereEqual('targetContactId', contactId); }
  ofType(relationshipType: RelationshipType): RelationshipQueryBuilder { return this.whereEqual('relationshipType', relationshipType); }
  ofTypes(relationshipTypes: RelationshipType[]): RelationshipQueryBuilder { return this.whereIn('relationshipType', relationshipTypes); }
  withStatus(status: RelationshipStatus): RelationshipQueryBuilder { return this.whereEqual('status', status); }
  activeOnly(): RelationshipQueryBuilder { return this.withStatus('active'); }
  inDepartment(department: string): RelationshipQueryBuilder { return this.whereEqual('department', department); }
  inDepartments(departments: string[]): RelationshipQueryBuilder { return this.whereIn('department', departments); }
  withPosition(position: string): RelationshipQueryBuilder { return this.whereEqual('position', position); }

  createdBetween(startDate: Date, endDate: Date): RelationshipQueryBuilder {
    return this.whereGreaterThan('createdAt', startDate).whereLessThan('createdAt', endDate);
  }

  startedBetween(startDate: string, endDate: string): RelationshipQueryBuilder {
    return this.whereGreaterThan('startDate', startDate).whereLessThan('startDate', endDate);
  }

  textSearch(searchTerm: string): RelationshipQueryBuilder {
    logger.warn('Text search requires external search service (Algolia, Elasticsearch)');
    const term = searchTerm.toLowerCase();
    return this.whereGreaterThan('position', term).whereLessThan('position', term + '\uf8ff');
  }

  // ========================================================================
  // SORTING METHODS
  // ========================================================================

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): RelationshipQueryBuilder {
    this.sorts.push({ field, direction });
    return this;
  }

  newest(): RelationshipQueryBuilder { return this.orderBy(FIELDS.CREATED_AT, 'desc'); }
  oldest(): RelationshipQueryBuilder { return this.orderBy(FIELDS.CREATED_AT, 'asc'); }
  byPosition(): RelationshipQueryBuilder { return this.orderBy('position', 'asc'); }
  byDepartment(): RelationshipQueryBuilder { return this.orderBy('department', 'asc'); }

  // ========================================================================
  // PAGINATION METHODS
  // ========================================================================

  limit(limitCount: number): RelationshipQueryBuilder {
    this.pagination.limit = limitCount;
    return this;
  }

  startAfter(doc: DocumentSnapshot): RelationshipQueryBuilder {
    this.pagination.startAfter = doc;
    return this;
  }

  endBefore(doc: DocumentSnapshot): RelationshipQueryBuilder {
    this.pagination.endBefore = doc;
    return this;
  }

  offset(offsetCount: number): RelationshipQueryBuilder {
    logger.warn('Offset requires special pagination handling with Firestore');
    return this;
  }

  // ========================================================================
  // QUERY COMPILATION & EXECUTION
  // ========================================================================

  /**
   * 🔧 Compile Query
   */
  compile(): CompiledQuery {
    const collectionRef = collection(db, this.collectionName);
    let firestoreQuery: Query = collectionRef;

    // Add filters
    this.filters.forEach(filter => {
      firestoreQuery = query(firestoreQuery, where(filter.field, filter.operator, filter.value));
    });

    // Add sorts
    this.sorts.forEach(sort => {
      firestoreQuery = query(firestoreQuery, orderBy(sort.field, sort.direction));
    });

    // Add pagination
    if (this.pagination.limit) {
      firestoreQuery = query(firestoreQuery, limit(this.pagination.limit));
    }

    if (this.pagination.startAfter) {
      firestoreQuery = query(firestoreQuery, startAfter(this.pagination.startAfter));
    }

    if (this.pagination.endBefore) {
      firestoreQuery = query(firestoreQuery, endBefore(this.pagination.endBefore));
    }

    return {
      firestoreQuery,
      filters: [...this.filters],
      sorts: [...this.sorts],
      pagination: { ...this.pagination },
      estimatedCost: this.calculateQueryCost()
    };
  }

  /**
   * 🎯 Get Query Debug Info
   */
  getDebugInfo(): {
    filters: QueryFilter[];
    sorts: QuerySort[];
    pagination: QueryPagination;
    estimatedCost: number;
    indexRequirements: string[];
  } {
    return {
      filters: [...this.filters],
      sorts: [...this.sorts],
      pagination: { ...this.pagination },
      estimatedCost: this.calculateQueryCost(),
      indexRequirements: this.getIndexRequirements()
    };
  }

  /**
   * 🔄 Reset Builder
   */
  reset(): RelationshipQueryBuilder {
    this.filters = [];
    this.sorts = [];
    this.pagination = {};
    return this;
  }

  /**
   * 🔄 Clone Builder
   */
  clone(): RelationshipQueryBuilder {
    const newBuilder = new RelationshipQueryBuilder();
    newBuilder.filters = [...this.filters];
    newBuilder.sorts = [...this.sorts];
    newBuilder.pagination = { ...this.pagination };
    return newBuilder;
  }

  // ========================================================================
  // OPTIMIZATION METHODS
  // ========================================================================

  /**
   * 💰 Calculate Query Cost
   */
  private calculateQueryCost(): number {
    let cost = 1; // Base cost

    // Each filter adds cost
    cost += this.filters.length * 0.1;

    // Sorting adds cost
    cost += this.sorts.length * 0.2;

    // Complex filters add more cost
    this.filters.forEach(filter => {
      if (filter.operator === 'in' && Array.isArray(filter.value)) {
        cost += filter.value.length * 0.05;
      }
      if (filter.operator === '!=' || filter.operator === 'not-in') {
        cost += 0.3; // Inequality filters are expensive
      }
    });

    return Math.round(cost * 100) / 100;
  }

  /**
   * 📋 Get Index Requirements
   */
  private getIndexRequirements(): string[] {
    const requirements: string[] = [];

    // If we have multiple filters, we need composite index
    if (this.filters.length > 1) {
      const filterFields = this.filters.map(f => f.field);
      const sortFields = this.sorts.map(s => s.field);
      const allFields = [...filterFields, ...sortFields];

      if (allFields.length > 1) {
        requirements.push(`Composite index required: (${allFields.join(', ')})`);
      }
    }

    // Specific index requirements
    const inequalityFilters = this.filters.filter(f =>
      ['>', '<', '>=', '<=', '!=', 'not-in'].includes(f.operator)
    );

    if (inequalityFilters.length > 0 && this.sorts.length > 0) {
      requirements.push('Index required για inequality filters με sorting');
    }

    return requirements;
  }

  /**
   * ⚡ Optimize Query
   */
  optimize(): RelationshipQueryBuilder {
    // Remove duplicate filters
    const uniqueFilters = this.filters.filter((filter, index, array) =>
      array.findIndex(f =>
        f.field === filter.field &&
        f.operator === filter.operator &&
        JSON.stringify(f.value) === JSON.stringify(filter.value)
      ) === index
    );

    this.filters = uniqueFilters;

    // Optimize sort order για better index usage
    if (this.sorts.length > 1) {
      // Put inequality filters first για better index performance
      const inequalityFields = this.filters
        .filter(f => ['>', '<', '>=', '<='].includes(f.operator))
        .map(f => f.field);

      this.sorts.sort((a, b) => {
        const aIsInequality = inequalityFields.includes(a.field);
        const bIsInequality = inequalityFields.includes(b.field);

        if (aIsInequality && !bIsInequality) return -1;
        if (!aIsInequality && bIsInequality) return 1;
        return 0;
      });
    }

    return this;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default RelationshipQueryBuilder;