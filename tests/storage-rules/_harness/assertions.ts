/**
 * Storage Rules Test Harness — Matrix-Driven Assertions
 *
 * Every matrix cell from a Storage coverage manifest entry is executed
 * through `assertStorageCell`. The helper dispatches to the correct
 * read/write/delete Storage operation and wraps the call in `assertSucceeds`
 * or `assertFails` based on the declared outcome.
 *
 * See ADR-301 §3.3 (test file contract).
 *
 * @module tests/storage-rules/_harness/assertions
 * @since 2026-04-14 (ADR-301 Phase A)
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';
import type { StorageOperation } from '../_registry/operations';
import type { StorageCoverageCell } from '../_registry/coverage-manifest';

/**
 * Minimal upload payload used for write assertions.
 * 3 bytes → always passes `isValidFileSize()` (< 50 MB).
 */
const WRITE_BYTES = new Uint8Array([0xAA, 0xBB, 0xCC]);

/**
 * Default content type for write assertions.
 * `application/octet-stream` is explicitly whitelisted by `isAllowedContentType()`.
 */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/** Configuration for a single Storage assertion. */
export interface AssertStorageTarget {
  /**
   * Absolute Storage path to the file (no leading slash).
   * For write tests a fresh path suffix is appended to avoid overwrite-vs-create
   * ambiguity when the file was pre-seeded.
   */
  readonly path: string;
  /**
   * Optional content-type override for write operations.
   * Defaults to `application/octet-stream` which passes `isAllowedContentType()`.
   */
  readonly contentType?: string;
}

/**
 * Execute a matrix cell against a Storage context.
 *
 * The function owns the mapping from `StorageOperation` → Firebase Storage
 * client call and from `Outcome` → `assertSucceeds`/`assertFails`.
 * Test files only declare the matrix; the harness owns execution.
 *
 * Write operations append a cell-specific suffix to the path to avoid
 * hitting the UPDATE path when the file was pre-seeded at the base path.
 */
export async function assertStorageCell(
  ctx: RulesTestContext,
  cell: StorageCoverageCell,
  target: AssertStorageTarget,
): Promise<void> {
  const promise = executeStorageOperation(ctx, cell.operation, target);
  if (cell.outcome === 'allow') {
    await assertSucceeds(promise);
  } else {
    await assertFails(promise);
  }
}

function executeStorageOperation(
  ctx: RulesTestContext,
  op: StorageOperation,
  target: AssertStorageTarget,
): Promise<unknown> {
  const storage = ctx.storage();

  switch (op) {
    case 'read': {
      const ref = storage.ref(target.path);
      return ref.getMetadata();
    }
    case 'write': {
      // Use a unique path for write tests so the emulator sees a CREATE
      // operation (no existing file at this exact path). This prevents the
      // emulator from routing the call through an UPDATE path when a seed
      // file exists at the base path.
      const writePath = `${target.path}--write-${Date.now().toString(36)}`;
      const ref = storage.ref(writePath);
      return ref.put(WRITE_BYTES, {
        contentType: target.contentType ?? DEFAULT_CONTENT_TYPE,
      });
    }
    case 'delete': {
      const ref = storage.ref(target.path);
      return ref.delete();
    }
    default: {
      const never: never = op;
      throw new Error(`assertStorageCell: unhandled operation ${String(never)}`);
    }
  }
}

/** Convenience wrapper for direct assertions outside of matrix loops. */
export async function expectStorageAllow(promise: Promise<unknown>): Promise<void> {
  await assertSucceeds(promise);
}

export async function expectStorageDeny(promise: Promise<unknown>): Promise<void> {
  await assertFails(promise);
}
