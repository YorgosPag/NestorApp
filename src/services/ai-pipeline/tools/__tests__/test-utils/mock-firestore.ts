/**
 * IN-MEMORY FIRESTORE MOCK — Google-level deterministic testing
 *
 * Replaces getAdminFirestore() with a fully in-memory data store.
 * Supports: collection().doc().get/set/update, where().limit().get(), count().get()
 *
 * @module __tests__/test-utils/mock-firestore
 */

type DocData = Record<string, unknown>;
type Store = Map<string, Map<string, DocData>>;

// ============================================================================
// QUERY BUILDER (chainable)
// ============================================================================

interface WhereClause {
  field: string;
  op: string;
  value: unknown;
}

class MockQuery {
  private clauses: WhereClause[] = [];
  private _limit = 100;
  private _orderByField: string | null = null;

  constructor(
    private store: Store,
    private collectionName: string,
  ) {}

  where(field: string, op: string, value: unknown): MockQuery {
    const q = this.clone();
    q.clauses.push({ field, op, value });
    return q;
  }

  orderBy(field: string): MockQuery {
    const q = this.clone();
    q._orderByField = field;
    return q;
  }

  limit(n: number): MockQuery {
    const q = this.clone();
    q._limit = n;
    return q;
  }

  async get(): Promise<{ docs: MockDocSnap[]; empty: boolean; size: number }> {
    const col = this.store.get(this.collectionName) ?? new Map<string, DocData>();
    let entries = [...col.entries()];

    // Apply filters
    for (const clause of this.clauses) {
      entries = entries.filter(([id, data]) => {
        const fieldValue = clause.field === 'id' ? id : data[clause.field];
        switch (clause.op) {
          case '==': return fieldValue === clause.value;
          case '!=': return fieldValue !== clause.value;
          case '<': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue < clause.value;
          case '<=': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue <= clause.value;
          case '>': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue > clause.value;
          case '>=': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue >= clause.value;
          case 'in': return Array.isArray(clause.value) && clause.value.includes(fieldValue);
          case 'array-contains': return Array.isArray(fieldValue) && fieldValue.includes(clause.value);
          default: return true;
        }
      });
    }

    // Limit
    entries = entries.slice(0, this._limit);

    const docs = entries.map(([id, data]) => new MockDocSnap(id, data, true));
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  count(): { get: () => Promise<{ data: () => { count: number } }> } {
    return {
      get: async () => {
        const result = await this.get();
        return { data: () => ({ count: result.size }) };
      },
    };
  }

  private clone(): MockQuery {
    const q = new MockQuery(this.store, this.collectionName);
    q.clauses = [...this.clauses];
    q._limit = this._limit;
    q._orderByField = this._orderByField;
    return q;
  }
}

// ============================================================================
// DOCUMENT SNAPSHOT
// ============================================================================

class MockDocSnap {
  constructor(
    public readonly id: string,
    private _data: DocData | null,
    public readonly exists: boolean,
  ) {}

  data(): DocData | undefined {
    return this._data ?? undefined;
  }
}

// ============================================================================
// DOCUMENT REFERENCE
// ============================================================================

class MockDocRef {
  constructor(
    private store: Store,
    private collectionName: string,
    private docId: string,
  ) {}

  async get(): Promise<MockDocSnap> {
    const col = this.store.get(this.collectionName);
    const data = col?.get(this.docId) ?? null;
    return new MockDocSnap(this.docId, data, data !== null);
  }

  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    if (!this.store.has(this.collectionName)) {
      this.store.set(this.collectionName, new Map());
    }
    const col = this.store.get(this.collectionName)!;
    if (options?.merge) {
      const existing = col.get(this.docId) ?? {};
      col.set(this.docId, { ...existing, ...data });
    } else {
      col.set(this.docId, { ...data });
    }
  }

  async update(data: DocData): Promise<void> {
    const col = this.store.get(this.collectionName);
    const existing = col?.get(this.docId);
    if (!existing) {
      throw new Error(`Document ${this.collectionName}/${this.docId} not found`);
    }
    col!.set(this.docId, { ...existing, ...data });
  }
}

// ============================================================================
// COLLECTION REFERENCE (extends MockQuery for chainable where/limit)
// ============================================================================

class MockCollectionRef extends MockQuery {
  constructor(
    private _store: Store,
    private _collectionName: string,
  ) {
    super(_store, _collectionName);
  }

  doc(id: string): MockDocRef {
    return new MockDocRef(this._store, this._collectionName, id);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export interface MockFirestoreInstance {
  collection(name: string): MockCollectionRef;
}

export interface MockFirestoreKit {
  instance: MockFirestoreInstance;
  seedCollection(name: string, docs: Record<string, DocData>): void;
  getData(collection: string, docId: string): DocData | undefined;
  getAllDocs(collection: string): Record<string, DocData>;
}

export function createMockFirestore(): MockFirestoreKit {
  const store: Store = new Map();

  const instance: MockFirestoreInstance = {
    collection(name: string): MockCollectionRef {
      return new MockCollectionRef(store, name);
    },
  };

  return {
    instance,

    seedCollection(name: string, docs: Record<string, DocData>): void {
      const col = new Map<string, DocData>();
      for (const [id, data] of Object.entries(docs)) {
        col.set(id, { ...data });
      }
      store.set(name, col);
    },

    getData(collection: string, docId: string): DocData | undefined {
      return store.get(collection)?.get(docId);
    },

    getAllDocs(collection: string): Record<string, DocData> {
      const col = store.get(collection);
      if (!col) return {};
      const result: Record<string, DocData> = {};
      for (const [id, data] of col) result[id] = data;
      return result;
    },
  };
}
