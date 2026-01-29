# Firestore Rules Testing

## Overview

This directory contains tests for Firestore security rules.
Tests use `@firebase/rules-unit-testing` with Firebase Emulator Suite.

## Prerequisites

1. Install Firebase Tools:
   ```bash
   npm install -g firebase-tools
   ```

2. Install test dependencies:
   ```bash
   pnpm add -D @firebase/rules-unit-testing firebase-admin
   ```

3. Start Firebase Emulator:
   ```bash
   firebase emulators:start --only firestore
   ```

## Running Tests

```bash
# Run all Firestore rules tests
pnpm test:firestore-rules

# Run specific PR tests
pnpm test:firestore-rules -- --grep "PR-1A"
```

## Test Structure

```
tests/firestore-rules/
├── README.md                    # This file
├── setup.ts                     # Test setup and helpers
├── pr-1a-buildings.test.ts      # PR-1A: Buildings tenant isolation
├── pr-1b-crm.test.ts            # PR-1B: CRM + Messaging
├── pr-1c-dxf.test.ts            # PR-1C: DXF/Floorplans
└── pr-1d-infra.test.ts          # PR-1D: Obligations + Infra
```

## Test Patterns

Each test file verifies:

1. **Cross-tenant DENY**: Tenant A cannot read/write Tenant B data
2. **Same-tenant ALLOW**: Tenant A can read/write Tenant A data
3. **Legacy fallback**: Documents without companyId follow transitional rules
4. **Super admin bypass**: super_admin can access all data
5. **Anonymous DENY**: Unauthenticated users cannot access data

## Adding New Tests

1. Copy pattern from existing test file
2. Use helper functions from `setup.ts`
3. Follow naming convention: `pr-{number}-{collection}.test.ts`
4. Document test cases with descriptive names

## CI Integration

Tests run in GitHub Actions on PR:
- Firebase Emulator starts automatically
- Tests execute against emulator
- Results reported in PR checks
