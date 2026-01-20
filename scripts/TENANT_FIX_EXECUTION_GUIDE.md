# 🔧 TENANT FIX EXECUTION GUIDE

**ChatGPT Analysis - Sections 1 & 2 Implementation**
**Date:** 2026-01-17
**Target:** Fix tenant mismatch (companyId claim → Firestore data)

---

## 📋 **OVERVIEW**

This guide executes **Section 1** (Tenant Model Fix) and **Section 2** (Data Migration) from the ChatGPT analysis.

**Problem:**
- User claim: `companyId: "pagonis-company"` (string slug)
- Firestore data: `companyId: "pzNUy8ksddGCtcQMqumR"` (doc ID)
- → Backend tenant isolation returns 0 results

**Solution:**
1. Fix companyId claim to match Firestore doc ID
2. Ensure canonical company doc exists
3. Backfill buildings with companyId field

---

## 🚀 **EXECUTION STEPS**

### **STEP 1: Verify Company Doc Exists**

Before setting claims, verify the company document exists in Firestore.

**Manual Check:**
1. Go to Firebase Console → Firestore
2. Navigate to `contacts` collection
3. Verify document `pzNUy8ksddGCtcQMqumR` exists with `type='company'`

If the company doc doesn't exist, create it manually in Firestore before proceeding.

---

### **STEP 2: Fix User companyId Claim**

This updates your Firebase Auth token claim using the **canonical script**.

**Run in terminal:**

```bash
# Set the companyId claim (Firestore doc ID - NOT slug!)
COMPANY_ID=pzNUy8ksddGCtcQMqumR USER_UID=<YOUR_USER_UID> node scripts/claims.setCompanyId.js

# Optional: Also set GLOBAL_ROLE if needed
COMPANY_ID=pzNUy8ksddGCtcQMqumR USER_UID=<YOUR_USER_UID> GLOBAL_ROLE=company_admin node scripts/claims.setCompanyId.js
```

**Expected Output:**
```
✅ [claims.setCompanyId.js] Firebase Admin initialized

═══════════════════════════════════════════════════════════════
🔧 SET USER COMPANY CLAIMS
═══════════════════════════════════════════════════════════════

📋 Step 1: Verifying user and getting existing claims...
   ✅ User found: pagonis.oe@gmail.com
   📍 Existing claims: { ... }

📋 Step 2: Preparing merged claims...
📋 Step 3: Setting custom claims...
   ✅ Claims set successfully!

📋 Step 4: Verifying claims...
   ✅ Claims verified!

⚠️  IMPORTANT: User must refresh their token to get new claims.
```

**After running the script:**
1. In the app, call `await refreshToken()` via useAuth hook
2. Or logout/login to refresh the token
3. Verify at `/debug/token-info`: `companyId: "pzNUy8ksddGCtcQMqumR"`

---

### **STEP 3: Backfill Buildings companyId (DRY RUN)**

This shows what would be changed WITHOUT making changes.

**IMPORTANT:** Uses the **canonical migration script** with enterprise patterns.

```bash
# DRY RUN (default - preview only, no changes)
COMPANY_ID=pzNUy8ksddGCtcQMqumR COLLECTION_BUILDINGS=buildings node scripts/migrations.buildings.backfillCompanyId.js
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════════
🔧 BUILDINGS COMPANYID BACKFILL MIGRATION
═══════════════════════════════════════════════════════════════

🎯 Target Company: pzNUy8ksddGCtcQMqumR
🔧 Mode: DRY-RUN (preview only)
📁 Collection: buildings

📋 Step 1: Scanning buildings collection...
   Looking for: companyId == null/undefined ONLY (safe mode)
   ⚠️  Will NOT touch buildings with other companyIds (multi-tenant safe)

   📄 Page 1: Fetching 100 documents...
      Scanned: 10, Need update: 10, Already OK: 0
      🔍 DRY-RUN - Would update:
         - Building A (docId1): (none) → pzNUy8ksddGCtcQMqumR [missing]
         - Building B (docId2): (none) → pzNUy8ksddGCtcQMqumR [missing]
         ...

ℹ️  DRY-RUN: No changes were made to the database
```

**Review the output.** If it looks correct, proceed to Step 4.

---

### **STEP 4: Backfill Buildings companyId (APPLY)**

This ACTUALLY updates Firestore.

```bash
# EXECUTE MIGRATION (writes to database)
COMPANY_ID=pzNUy8ksddGCtcQMqumR COLLECTION_BUILDINGS=buildings DRY_RUN=false node scripts/migrations.buildings.backfillCompanyId.js
```

**Expected Output:**
```
🔧 Mode: EXECUTE (will write to DB)

📋 Step 1: Scanning buildings collection...
      ✅ Batch 1: Updated 10 documents

═══════════════════════════════════════════════════════════════
📊 REPORT
═══════════════════════════════════════════════════════════════

🔍 Scanned: 10 buildings
🎯 Needed update: 10 buildings
✅ Updated: 10 buildings
❌ Errors: 0 buildings

✅ Script completed successfully
```

---

## ✅ **VERIFICATION CHECKLIST**

After running all steps, verify:

### 1. **Token Info**
- URL: https://nestor-app.vercel.app/debug/token-info
- Should show: `companyId: "pzNUy8ksddGCtcQMqumR"`

### 2. **Bootstrap API**
- Open DevTools → Network tab
- Reload page
- Find `/api/audit/bootstrap` request
- Should see: **200 OK** (not 401)
- Should NOT see error: "User's company … not found"

### 3. **Buildings API**
- Network tab: `/api/buildings` request
- Should see: **200 OK** (not 401)
- Response should have `buildings.length > 0`

### 4. **Projects List**
- Network tab: `/api/projects/list` request
- Should see: **200 OK** (not 401)
- Should return projects with `companyId: "pzNUy8ksddGCtcQMqumR"`

---

## 🚨 **TROUBLESHOOTING**

### **Script Error: "Firebase Admin failed"**

**Cause:** `.env.local` not found or invalid service account key

**Fix:**
- Verify `.env.local` exists in project root
- Check `FIREBASE_SERVICE_ACCOUNT_KEY` is valid JSON

---

### **Browser Script Error: "User not authenticated"**

**Cause:** Not logged in

**Fix:**
- Log in to https://nestor-app.vercel.app first
- Then run the script

---

### **Buildings still show 0 after backfill**

**Cause:** May not have any buildings in Firestore

**Check:**
- Go to Firebase Console → Firestore
- Look at `buildings` collection
- Verify documents exist and have `companyId` field

---

## 📊 **CANONICAL SCRIPT FILES**

| Script | Purpose | Runs In |
|--------|---------|---------|
| `claims.setCompanyId.js` | Updates user companyId claim | Node.js |
| `migrations.buildings.backfillCompanyId.js` | Adds companyId to buildings | Node.js |
| `_shared/loadEnvLocal.js` | Loads .env.local for scripts | Node.js |
| `_shared/validateInputs.js` | Validates script inputs | Node.js |

**Note:** All scripts use COMPANY_ID (Firestore doc ID) - NOT slugs!

---

## 📌 **NEXT STEPS (After Completion)**

Once all steps are complete:

1. **Section 3:** Migrate remaining endpoints (projects/notifications) to apiClient
2. **Section 4:** Polish server middleware (401 vs 403 distinction)
3. **Testing:** Full integration test of all endpoints

---

## 📝 **NOTES**

- **Dry run first:** Always run migration scripts with default (dry-run) mode first
- **Backup:** Firebase automatic backups should be enabled
- **Idempotent:** All scripts are safe to run multiple times
- **No destructive operations:** Scripts only ADD/UPDATE data, never DELETE

---

## ✅ **SUCCESS CRITERIA (Definition of Done)**

All 4 verifications must pass:

1. ✅ `/debug/token-info` shows `companyId: "pzNUy8ksddGCtcQMqumR"`
2. ✅ `/api/audit/bootstrap` returns **200 OK** (no "company not found")
3. ✅ `/api/projects/list` returns **200 OK** with projects
4. ✅ `/api/buildings` returns **200 OK** with buildings (if buildings exist)

---

**Last Updated:** 2026-01-17
**Status:** Updated with canonical scripts
**Scripts:** `claims.setCompanyId.js`, `migrations.buildings.backfillCompanyId.js`
