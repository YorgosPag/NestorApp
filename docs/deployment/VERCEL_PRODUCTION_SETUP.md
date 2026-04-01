# 🚀 VERCEL PRODUCTION DEPLOYMENT - ENTERPRISE SETUP GUIDE

**Status**: ✅ Production-Ready
**Last Updated**: 2026-01-16
**Applies To**: Nestor Application - Production Environment
**Reference**: ADR-024 (Environment Security Configuration)

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Critical Environment Variables](#critical-environment-variables)
3. [Vercel Configuration Steps](#vercel-configuration-steps)
4. [Firebase Admin SDK Setup](#firebase-admin-sdk-setup)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)

---

## 🎯 PREREQUISITES

Before configuring Vercel production environment, ensure:

- ✅ **Vercel Account** with project deployment access
- ✅ **Firebase Project** with Admin SDK enabled
- ✅ **Service Account Key** from Firebase Console
- ✅ **GitHub Repository** connected to Vercel
- ✅ **Admin Access** to Vercel project settings

---

## 🔐 CRITICAL ENVIRONMENT VARIABLES

### Required Variables for Production

| Variable Name | Type | Required | Description |
|---------------|------|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON | **CRITICAL** | Firebase Admin SDK credentials |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | String | Required | Firebase client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | String | Required | Firebase authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | String | Required | Firebase project identifier |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | String | Required | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | String | Required | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | String | Required | Firebase app identifier |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | String | Optional | Google Analytics measurement ID |
| `NODE_ENV` | String | Auto-set | Runtime environment (`production`) |

### Variable Categories

**🚨 CRITICAL (Application Blockers)**
- `FIREBASE_SERVICE_ACCOUNT_KEY` → Without this, all Admin SDK operations fail

**⚠️ HIGH PRIORITY (Feature Blockers)**
- All `NEXT_PUBLIC_FIREBASE_*` → Without these, authentication/database access fails

**📊 OPTIONAL (Analytics/Monitoring)**
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` → Analytics features disabled if missing

---

## 🔧 VERCEL CONFIGURATION STEPS

### Step 1: Access Vercel Environment Variables

1. **Navigate to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select Your Project**: `nestor-app` (or your project name)
3. **Settings → Environment Variables**

### Step 2: Firebase Admin SDK Configuration

#### 2.1 Generate Service Account Key

1. **Firebase Console**: https://console.firebase.google.com
2. **Select Project** → Project Settings (⚙️ icon)
3. **Service Accounts** tab
4. **Generate New Private Key** button
5. **Download JSON file** (e.g., `nestor-firebase-adminsdk.json`)

**⚠️ SECURITY WARNING:**
- This JSON file contains **sensitive credentials**
- **NEVER** commit to Git
- **NEVER** share publicly
- Store securely in password manager

#### 2.2 Prepare JSON for Vercel

The downloaded JSON file looks like:

```json
{
  "type": "service_account",
  "project_id": "nestor-app-production",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BA...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xyz@nestor-app-production.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/...",
  "universe_domain": "googleapis.com"
}
```

**CRITICAL:** The JSON must be **single-line, escaped** for Vercel environment variables.

**Option A: Manual Escaping** (Not Recommended)
```bash
# Manually remove newlines and escape quotes
# ERROR-PRONE!
```

**Option B: Automated Escaping** (Recommended)
```bash
# Use jq to minify JSON
cat nestor-firebase-adminsdk.json | jq -c . | pbcopy  # macOS
cat nestor-firebase-adminsdk.json | jq -c . | xclip -selection clipboard  # Linux
```

**Option C: Node.js Script** (Enterprise)
```javascript
// minify-json.js
const fs = require('fs');
const json = JSON.parse(fs.readFileSync('nestor-firebase-adminsdk.json', 'utf8'));
console.log(JSON.stringify(json));
```

```bash
node minify-json.js | pbcopy
```

Result (single line):
```
{"type":"service_account","project_id":"nestor-app-production","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BA...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xyz@nestor-app-production.iam.gserviceaccount.com",...}
```

#### 2.3 Add to Vercel Environment Variables

1. **Vercel Dashboard → Project → Settings → Environment Variables**
2. **Add New Variable**:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value**: (Paste minified JSON from clipboard)
   - **Environments**: Select **Production** (and optionally Preview)
3. **Save**

### Step 3: Add Firebase Client Configuration

Add all `NEXT_PUBLIC_FIREBASE_*` variables from your Firebase project:

1. **Firebase Console** → Project Settings → General
2. **Your apps** → Web app → Config object
3. Copy each value to Vercel:

| Vercel Variable | Firebase Config Key |
|----------------|---------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `measurementId` (optional) |

**⚠️ IMPORTANT:** Select **All Environments** (Production, Preview, Development) for client-side variables.

### Step 4: Trigger Redeployment

After adding environment variables:

1. **Vercel Dashboard → Deployments**
2. **Latest Deployment → ⋮ Menu → Redeploy**
3. **Redeploy** button → Wait for build to complete (~2-3 minutes)

**Alternative:** Push new commit to trigger automatic deployment
```bash
git commit --allow-empty -m "chore: trigger Vercel redeploy with env vars"
git push origin main
```

---

## 🔍 FIREBASE ADMIN SDK SETUP

### How It Works

The application uses **Firebase Admin SDK** for server-side operations:

```typescript
// src/lib/firebaseAdmin.ts
import { initializeApp, cert } from 'firebase-admin/app';

// Reads from process.env.FIREBASE_SERVICE_ACCOUNT_KEY
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

initializeApp({
  credential: cert(serviceAccount),
});
```

### Admin SDK vs Client SDK

| Feature | Admin SDK | Client SDK |
|---------|-----------|------------|
| **Environment** | Server-side only | Client-side |
| **Credentials** | Service Account Key | API Key |
| **Permissions** | Full database access | User-scoped |
| **Use Cases** | API routes, background jobs | User authentication, UI |
| **Security** | Never exposed to client | Public API key (safe) |

### Enterprise Error Handling

Our implementation includes **diagnostic logging**:

```typescript
// Enhanced initialization with status checking
export function ensureAdminInitialized(): void {
  const status = getAdminInitializationStatus();

  if (!status.initialized) {
    throw new Error(
      `Firebase Admin SDK not initialized. ` +
      `Environment: ${status.environment}. ` +
      `Error: ${status.error}`
    );
  }
}
```

**Logs you'll see in production:**

✅ **Success:**
```
✅ [Firebase Admin] SDK initialized successfully
📍 [Firebase Admin] Environment: production
🔐 [Firebase Admin] Project ID: nestor-app-production
```

❌ **Failure:**
```
❌ [Firebase Admin] CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found
📍 [Firebase Admin] Environment: production
🔧 [Firebase Admin] Required: Add FIREBASE_SERVICE_ACCOUNT_KEY to Vercel environment variables
```

---

## ✅ VERIFICATION & TESTING

### Step 1: Check Vercel Function Logs

1. **Vercel Dashboard → Project → Logs**
2. **Filter by Function**: Select `/api/projects/bootstrap`
3. **Look for initialization logs**:
   - ✅ `✅ [Firebase Admin] SDK initialized successfully`
   - ❌ `❌ [Firebase Admin] CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY not found`

### Step 2: Test Bootstrap API

Open browser and navigate to:
```
https://nestor-app.vercel.app/api/projects/bootstrap
```

**Expected Response (Success):**
```json
{
  "success": true,
  "data": {
    "companies": [...],
    "projects": [...],
    "loadedAt": "2026-01-16T10:30:00.000Z",
    "source": "firestore"
  },
  "timestamp": "2026-01-16T10:30:00.000Z"
}
```

**Error Response (Missing Admin SDK):**
```json
{
  "success": false,
  "error": "Bootstrap failed: Firebase Admin SDK not initialized...",
  "errorCode": "INTERNAL_SERVER_ERROR",
  "timestamp": "2026-01-16T10:30:00.000Z"
}
```

### Step 3: Test UI Navigation

1. **Navigate to**: https://nestor-app.vercel.app/projects
2. **Check Console** for errors
3. **Verify**: Companies and projects load without HTTP 500 errors

### Step 4: Verify Environment Security

Our centralized `environment-security-config.ts` ensures:

- ✅ Production environment is **allowed**
- ✅ Rate limiting is **enabled** (100 req/min)
- ✅ Enhanced validation is **active**
- ✅ Authentication is **required**

**Check logs for:**
```
✅ [Navigation] Bootstrap complete: 6 companies, 0 projects
```

---

## 🐛 TROUBLESHOOTING

### Issue 1: HTTP 500 - Bootstrap API Failed

**Symptoms:**
- Console error: `❌ [Navigation] Bootstrap failed: Error: Bootstrap failed: 500`
- Vercel logs: `❌ [Firebase Admin] CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY not found`

**Root Cause:** Missing `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

**Solution:**
1. Follow [Step 2: Firebase Admin SDK Configuration](#step-2-firebase-admin-sdk-configuration)
2. Ensure JSON is properly minified (single line, no newlines)
3. Redeploy application

### Issue 2: Invalid JSON Parse Error

**Symptoms:**
- Vercel logs: `❌ [Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON`

**Root Cause:** JSON formatting issue (newlines, escaping)

**Solution:**
```bash
# Re-minify JSON using jq
cat nestor-firebase-adminsdk.json | jq -c .

# Verify output is single line
# Copy output to Vercel environment variable
# Redeploy
```

### Issue 3: Authentication Errors

**Symptoms:**
- Console error: `Authentication failed`
- Cannot log in to application

**Root Cause:** Missing client-side Firebase configuration

**Solution:**
1. Verify ALL `NEXT_PUBLIC_FIREBASE_*` variables are set in Vercel
2. Check **All Environments** are selected (Production, Preview, Development)
3. Redeploy application

### Issue 4: "Operation not allowed in production environment"

**Symptoms:**
- HTTP 403 errors
- Error message: "Operation not allowed in production environment"

**Root Cause:** Using old codebase before ADR-024 implementation

**Solution:**
1. Pull latest code from `main` branch:
   ```bash
   git pull origin main
   ```
2. Verify file exists: `src/config/environment-security-config.ts`
3. Commit reference: `8a4e31a8` (feat: enterprise environment security configuration)
4. Redeploy application

---

## 🔒 SECURITY BEST PRACTICES

### DO ✅

1. **Use Vercel Environment Variables** → Secure, encrypted, not exposed to client
2. **Enable Environment-Specific Variables** → Production-only for service account key
3. **Rotate Service Account Keys Annually** → Security best practice
4. **Monitor Vercel Function Logs** → Detect unauthorized access attempts
5. **Use Rate Limiting** → Our implementation: 100 req/min in production
6. **Enable Audit Logging** → Track Admin SDK operations

### DON'T ❌

1. **❌ NEVER commit `.env.local` to Git** → Contains sensitive credentials
2. **❌ NEVER hardcode service account key in code** → Security vulnerability
3. **❌ NEVER share service account JSON publicly** → Full database access
4. **❌ NEVER use same key for dev/prod** → Separate credentials per environment
5. **❌ NEVER disable environment validation** → Security control
6. **❌ NEVER expose Admin SDK to client** → Server-side only

### Enterprise Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  NEXT_PUBLIC_* variables (Public - Safe)            │   │
│  │  - Firebase Client SDK                               │   │
│  │  - User authentication                               │   │
│  │  - User-scoped database access                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              VERCEL EDGE NETWORK (Secure)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Server-Side Environment Variables (Secret)          │   │
│  │  - FIREBASE_SERVICE_ACCOUNT_KEY                      │   │
│  │  - Full Admin SDK access                             │   │
│  │  - Never exposed to client                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ TLS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   FIREBASE BACKEND                          │
│  - Firestore Database                                       │
│  - Authentication                                            │
│  - Storage                                                   │
└─────────────────────────────────────────────────────────────┘
```

### Graduated Security Policies

Our centralized configuration (`src/config/environment-security-config.ts`):

| Environment | Rate Limit | Auth Required | Enhanced Validation | Admin Email Verification |
|-------------|------------|---------------|---------------------|-------------------------|
| **Production** | 100/min | ✅ Yes | ✅ Yes | ✅ Yes |
| **Staging** | 500/min | ✅ Yes | ✅ Yes | ❌ No |
| **Development** | 10,000/min | ❌ No | ❌ No | ❌ No |

---

## 📚 RELATED DOCUMENTATION

- **Local Development Setup**: [ENV_SETUP_INSTRUCTIONS.md](../../ENV_SETUP_INSTRUCTIONS.md)
- **Environment Security Config**: [src/config/environment-security-config.ts](../../src/config/environment-security-config.ts)
- **Firebase Admin SDK**: [src/lib/firebaseAdmin.ts](../../src/lib/firebaseAdmin.ts)
- **Bootstrap API**: [src/app/api/projects/bootstrap/route.ts](../../src/app/api/projects/bootstrap/route.ts)
- **ADR-024**: Environment Security Configuration System
- **Vercel Documentation**: https://vercel.com/docs/environment-variables

---

## 🎯 QUICK REFERENCE

### Essential Commands

```bash
# Check current deployment status
vercel ls

# View environment variables (requires Vercel CLI)
vercel env ls

# Trigger manual redeployment
vercel --prod

# View production logs
vercel logs --prod

# Test Bootstrap API locally
curl http://localhost:3000/api/projects/bootstrap

# Test Bootstrap API production
curl https://nestor-app.vercel.app/api/projects/bootstrap
```

### Vercel CLI Setup (Optional)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Add environment variable via CLI
vercel env add FIREBASE_SERVICE_ACCOUNT_KEY production
# (Paste JSON when prompted)
```

---

## 📞 SUPPORT & CONTACT

**Internal Support:**
- Technical Lead: Γιώργος Παγώνης
- Documentation: `docs/deployment/`
- ADR Records: `docs/adr/`

**External Resources:**
- **Vercel Support**: https://vercel.com/support
- **Firebase Support**: https://firebase.google.com/support
- **Next.js Documentation**: https://nextjs.org/docs

---

**Document Version**: 1.0.0
**Last Reviewed**: 2026-01-16
**Next Review**: 2026-04-16 (Quarterly)
**Classification**: Internal - Technical Documentation
