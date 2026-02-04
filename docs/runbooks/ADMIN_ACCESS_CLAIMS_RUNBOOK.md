# Admin Access Claims Runbook

**Purpose**: Ensure admin users reliably receive `admin_access` via Firebase custom claims (server-side).

**Scope**: AI Inbox visibility and admin navigation gating.

## Preconditions
- You have a user with `users:users:manage` permission (company_admin or super_admin).
- Admin API is reachable (local or deployed).
- Firebase Admin SDK is configured on the server.

## Standard Flow (UI)
1) Go to `Admin → Users → Claims Repair`.
2) Provide:
   - User UID
   - Email
   - Company ID
   - Global Role (`company_admin` or `super_admin`)
3) Submit.
4) The affected user must logout/login to refresh claims.

Expected result:
- Token contains `permissions` array with `admin_access`.
- AI Inbox appears in Settings navigation.

## Batch Flow (Script)
Use the batch script to apply claims for multiple users.

### Required env
Set the following before running:
- `API_URL` (e.g. `http://localhost:3000`)
- `SET_USER_CLAIMS_PATH` (e.g. `/api/admin/set-user-claims`)
- `ADMIN_ID_TOKEN` (Firebase ID token for an admin)
- `CLAIMS_INPUT_PATH` (path to JSON file)

### Input format
```json
[
  {
    "uid": "firebase-uid",
    "email": "user@example.com",
    "companyId": "company-uuid",
    "globalRole": "company_admin",
    "permissions": ["admin_access"]
  }
]
```

### Run
```bash
pnpm run claims:batch
```

### Output
- JSONL report in `migration-reports/` with updates/skips/errors.

## Verification
1) User logs out and logs in again.
2) Open Settings navigation → AI Inbox should be visible.
3) Optional: Use `/admin/debug/token-info` to confirm `permissions` includes `admin_access`.

## Troubleshooting
- If AI Inbox disappears:
  - Check if `permissions` claim exists on the user token.
  - Verify the user refreshed their token after claim update.
  - Confirm `companyId` and `globalRole` are set and valid.

## Security Notes
- Claims updates are audited server-side via `/api/admin/set-user-claims`.
- No client-side fallback permissions are used.
