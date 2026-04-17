/**
 * =============================================================================
 * FIRESTORE DOCUMENT SERIALIZER — ADR-313
 * =============================================================================
 *
 * Converts Firestore-native types (Timestamp, GeoPoint, DocumentReference,
 * Buffer/Bytes) to JSON-safe representations and back.
 *
 * Why: Firestore documents contain types that cannot be serialized to JSON
 * directly. The serializer produces a _fieldTypes map alongside the data
 * so the deserializer can reconstruct the original Firestore types.
 *
 * @module services/backup/backup-serializer
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

import { Timestamp } from 'firebase-admin/firestore';
import { GeoPoint } from 'firebase-admin/firestore';

import type { DocumentData } from 'firebase-admin/firestore';
import type { FirestoreFieldType, SerializedDocument } from './backup-manifest.types';

// ---------------------------------------------------------------------------
// Serialized value representations
// ---------------------------------------------------------------------------

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface SerializedGeoPoint {
  _latitude: number;
  _longitude: number;
}

interface SerializedReference {
  _path: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

function isGeoPoint(value: unknown): value is GeoPoint {
  return value instanceof GeoPoint;
}

function isDocumentReference(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    'firestore' in (value as Record<string, unknown>) &&
    'path' in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).path === 'string'
  );
}

function isBytes(value: unknown): value is Buffer {
  return Buffer.isBuffer(value);
}

// ---------------------------------------------------------------------------
// Serialize a single value
// ---------------------------------------------------------------------------

type SerializeResult = {
  value: unknown;
  fieldType: FirestoreFieldType | null;
};

function serializeValue(value: unknown, path: string, fieldTypes: Record<string, FirestoreFieldType>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (isTimestamp(value)) {
    fieldTypes[path] = 'timestamp';
    return {
      _seconds: value.seconds,
      _nanoseconds: value.nanoseconds,
    } satisfies SerializedTimestamp;
  }

  if (isGeoPoint(value)) {
    fieldTypes[path] = 'geopoint';
    return {
      _latitude: value.latitude,
      _longitude: value.longitude,
    } satisfies SerializedGeoPoint;
  }

  if (isDocumentReference(value)) {
    fieldTypes[path] = 'reference';
    return {
      _path: (value as { path: string }).path,
    } satisfies SerializedReference;
  }

  if (isBytes(value)) {
    fieldTypes[path] = 'bytes';
    return value.toString('base64');
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      serializeValue(item, `${path}[${index}]`, fieldTypes)
    );
  }

  if (typeof value === 'object') {
    return serializeObject(value as Record<string, unknown>, path, fieldTypes);
  }

  return value;
}

// ---------------------------------------------------------------------------
// Serialize an object (recursive)
// ---------------------------------------------------------------------------

function serializeObject(
  obj: Record<string, unknown>,
  basePath: string,
  fieldTypes: Record<string, FirestoreFieldType>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = basePath ? `${basePath}.${key}` : key;
    result[key] = serializeValue(value, fieldPath, fieldTypes);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public: Serialize a Firestore document
// ---------------------------------------------------------------------------

/**
 * Serialize a Firestore document to a JSON-safe representation.
 *
 * @param docId - Document ID
 * @param docPath - Full document path (e.g. 'contacts/cont_abc123')
 * @param data - Raw Firestore document data
 * @returns SerializedDocument ready for NDJSON output
 */
export function serializeDocument(
  docId: string,
  docPath: string,
  data: DocumentData,
): SerializedDocument {
  const fieldTypes: Record<string, FirestoreFieldType> = {};
  const serializedData = serializeObject(data, '', fieldTypes);

  return {
    _id: docId,
    _path: docPath,
    _data: serializedData,
    _fieldTypes: fieldTypes,
  };
}

// ---------------------------------------------------------------------------
// Deserialize a single value
// ---------------------------------------------------------------------------

function deserializeValue(
  value: unknown,
  path: string,
  fieldTypes: Record<string, FirestoreFieldType>,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const fieldType = fieldTypes[path];

  if (fieldType === 'timestamp' && typeof value === 'object' && value !== null) {
    const ts = value as SerializedTimestamp;
    return new Timestamp(ts._seconds, ts._nanoseconds);
  }

  if (fieldType === 'geopoint' && typeof value === 'object' && value !== null) {
    const gp = value as SerializedGeoPoint;
    return new GeoPoint(gp._latitude, gp._longitude);
  }

  if (fieldType === 'reference') {
    // DocumentReference requires Firestore instance — return path string
    // The restore service resolves paths to references with the target Firestore
    return value;
  }

  if (fieldType === 'bytes' && typeof value === 'string') {
    return Buffer.from(value, 'base64');
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      deserializeValue(item, `${path}[${index}]`, fieldTypes)
    );
  }

  if (typeof value === 'object') {
    return deserializeObject(value as Record<string, unknown>, path, fieldTypes);
  }

  return value;
}

// ---------------------------------------------------------------------------
// Deserialize an object (recursive)
// ---------------------------------------------------------------------------

function deserializeObject(
  obj: Record<string, unknown>,
  basePath: string,
  fieldTypes: Record<string, FirestoreFieldType>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = basePath ? `${basePath}.${key}` : key;
    result[key] = deserializeValue(value, fieldPath, fieldTypes);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public: Deserialize a SerializedDocument back to Firestore data
// ---------------------------------------------------------------------------

/**
 * Deserialize a SerializedDocument back to Firestore-compatible data.
 *
 * Note: DocumentReference fields are returned as path strings.
 * The RestoreService must resolve them to actual references.
 *
 * @param doc - SerializedDocument from NDJSON
 * @returns Firestore-compatible document data
 */
export function deserializeDocument(
  doc: SerializedDocument,
): { id: string; path: string; data: Record<string, unknown> } {
  const data = deserializeObject(doc._data, '', doc._fieldTypes);

  return {
    id: doc._id,
    path: doc._path,
    data,
  };
}

// ---------------------------------------------------------------------------
// Public: Collect field inventory from document data
// ---------------------------------------------------------------------------

/**
 * Extract all field names (including nested paths) from document data.
 * Used to build the field inventory in the manifest.
 *
 * @param data - Raw Firestore document data
 * @param prefix - Path prefix for nested fields
 * @returns Set of field paths
 */
export function collectFieldInventory(
  data: DocumentData,
  prefix = '',
): Set<string> {
  const fields = new Set<string>();

  for (const [key, value] of Object.entries(data)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    fields.add(fieldPath);

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !isTimestamp(value) &&
      !isGeoPoint(value) &&
      !isDocumentReference(value) &&
      !isBytes(value)
    ) {
      const nested = collectFieldInventory(value as DocumentData, fieldPath);
      nested.forEach(f => fields.add(f));
    }
  }

  return fields;
}
