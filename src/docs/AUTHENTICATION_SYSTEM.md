# Enterprise Authentication System

## Overview

Πλήρες enterprise-grade authentication system με **Firebase Authentication**, Google Sign-In OAuth 2.0, custom domain configuration, και i18n support.

**Backend:** Firebase Authentication
**OAuth Provider:** Google Sign-In
**Custom Domain:** nestorconstruct.gr
**Status:** Production Ready
**Version:** 2.0.0 (Custom Domain + givenName/familyName)
**Date:** 2026-01-12

---

## Architecture

### High-Level Flow

```
User → AuthForm (UI)
         ↓
    AuthContext (React Context)
         ↓
    Firebase Auth SDK
         ↓
    Google OAuth 2.0 (Sign-In)
         ↓
    Firebase Authentication
         ↓
    Firestore (User Profile Data)
```

### Core Components

#### 1. **Types & Schemas** (`src/auth/types/`)
- `auth.types.ts` - TypeScript types για User, SignUpData, κλπ.

#### 2. **Auth Context** (`src/auth/contexts/AuthContext.tsx`)
- `signIn()` - Email/Password authentication
- `signUp()` - Registration με givenName + familyName
- `signInWithGoogle()` - Google OAuth Sign-In
- `signOut()` - Logout
- `completeProfile()` - Profile completion για Google users
- `updateUserProfile()` - Update user profile data

#### 3. **Auth Form** (`src/auth/components/AuthForm.tsx`)
- Unified form για Sign In, Sign Up, Reset Password
- Separate fields: givenName (Όνομα) + familyName (Επώνυμο)
- i18n translations (el, en)

---

## Custom Domain Configuration

### Domain Setup (nestorconstruct.gr)

**Ημερομηνία:** 2026-01-12
**Domain Provider:** Papaki.gr
**Domains:**
- `nestorconstruct.gr` (Primary)
- `nestorconstruct.site` (Secondary)

### Firebase Hosting Configuration

1. **Firebase Console** → Hosting → Custom Domains
2. **Domains Connected:**
   - `pagonis-87766.firebaseapp.com` (Default)
   - `pagonis-87766.web.app` (Default)
   - `nestorconstruct.gr` (Custom - Primary)

### DNS Records (Configured at Papaki)

| Type | Name | Value |
|------|------|-------|
| A | @ | Firebase IP addresses |
| TXT | @ | Firebase verification token |

---

## Google OAuth 2.0 Configuration

### Google Cloud Console Settings

**Project:** pagonis-87766
**Console URL:** https://console.cloud.google.com/apis/credentials

### OAuth 2.0 Client Configuration

#### Authorized JavaScript Origins
```
https://pagonis-87766.firebaseapp.com
https://nestorconstruct.gr
```

#### Authorized Redirect URIs
```
https://pagonis-87766.firebaseapp.com/__/auth/handler
https://nestorconstruct.gr/__/auth/handler
```

### OAuth Consent Screen

**App Name:** Nestor Pagonis
**User Support Email:** Configured
**Logo:** Nestor_Pagonis_Logo.png (Uploaded)
**Privacy Policy:** (Required for Brand Verification)
**Terms of Service:** (Required for Brand Verification)

#### Brand Verification

Για να εμφανίζεται το logo στο Google Sign-In popup:
1. Upload logo στο OAuth consent screen
2. Submit για Brand Verification
3. Αναμονή έγκρισης από Google (μπορεί να πάρει μέρες)

---

## Environment Variables Configuration

### `.env.local` (Primary - Local Development)

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAcqK3o-zPmXodFPr-gG328QJHlcEc6g1k
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nestorconstruct.gr
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pagonis-87766
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=pagonis-87766.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=157616068729
NEXT_PUBLIC_FIREBASE_APP_ID=1:157616068729:web:c7dc1ed6661c895ee19ca8
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-S5JLD49JZQ

# Firebase Server-Side
FIREBASE_API_KEY=AIzaSyAcqK3o-zPmXodFPr-gG328QJHlcEc6g1k
FIREBASE_AUTH_DOMAIN=nestorconstruct.gr
FIREBASE_PROJECT_ID=pagonis-87766
```

### Key Change: authDomain

**Πριν:**
```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pagonis-87766.firebaseapp.com
```

**Μετά:**
```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nestorconstruct.gr
```

**Γιατί:** Το custom domain εμφανίζεται στο Google Sign-In popup αντί για το default Firebase domain.

---

## User Profile Data Model

### Enterprise Pattern: givenName + familyName + displayName

**Βασισμένο σε:** SAP, Salesforce, Oracle HCM enterprise patterns

```typescript
interface SignUpData {
  email: string;
  password: string;
  givenName: string;    // Όνομα (First Name)
  familyName: string;   // Επώνυμο (Last Name)
}

interface ExtendedUser {
  // Firebase fields
  uid: string;
  email: string | null;
  displayName: string | null;  // Computed: `${givenName} ${familyName}`

  // Extended fields (localStorage)
  givenName?: string;
  familyName?: string;
  profileIncomplete?: boolean;  // For Google Sign-In users
}
```

### Data Storage

| Field | Storage Location | Notes |
|-------|-----------------|-------|
| `displayName` | Firebase Auth Profile | `${givenName} ${familyName}` |
| `givenName` | localStorage | Key: `givenName_{uid}` |
| `familyName` | localStorage | Key: `familyName_{uid}` |
| `profileComplete` | localStorage | Key: `profile_complete_{uid}` |

**Γιατί localStorage:** Firebase Authentication δεν υποστηρίζει custom fields στο user profile. Τα givenName/familyName αποθηκεύονται στο localStorage και συγχρονίζονται στο Firestore users collection.

---

## Google Sign-In Profile Completion Flow

### Flow για Google Users

```
1. User clicks "Sign in with Google"
         ↓
2. Google OAuth popup opens (shows nestorconstruct.gr)
         ↓
3. User authenticates with Google
         ↓
4. Firebase receives Google profile
         ↓
5. Check: Has user completed profile?
   - YES → Redirect to app
   - NO → Show profile completion form
         ↓
6. User enters givenName + familyName
         ↓
7. completeProfile() saves data
         ↓
8. Redirect to app
```

### Profile Completion UI

Όταν ένας χρήστης συνδέεται με Google για πρώτη φορά:
- `needsProfileCompletion` = true
- Εμφανίζεται form για συμπλήρωση Όνομα + Επώνυμο
- Μετά τη συμπλήρωση: `profileIncomplete` = false

---

## i18n Translations

### Supported Languages
- **el** (Greek) - Primary
- **en** (English) - Secondary

### Translation Keys (auth.json)

```json
{
  "form": {
    "labels": {
      "givenName": "Όνομα / First Name",
      "familyName": "Επώνυμο / Last Name"
    },
    "placeholders": {
      "givenName": "π.χ. Γιώργος / e.g. John",
      "familyName": "π.χ. Παπαδόπουλος / e.g. Smith"
    }
  },
  "validation": {
    "givenNameRequired": "Το όνομα είναι υποχρεωτικό.",
    "familyNameRequired": "Το επώνυμο είναι υποχρεωτικό."
  }
}
```

---

## Troubleshooting

### Error: redirect_uri_mismatch (400)

**Αιτία:** Το redirect URI δεν είναι registered στο Google Cloud Console.

**Λύση:**
1. Google Cloud Console → APIs & Services → Credentials
2. Επιλογή OAuth 2.0 Client ID
3. Προσθήκη στο "Authorized redirect URIs":
   ```
   https://nestorconstruct.gr/__/auth/handler
   ```

### Translation Keys Showing Instead of Translations

**Αιτία:** Next.js cache ή i18n namespace not loaded.

**Λύση:**
```bash
# Clear Next.js cache
rm -rf .next/cache

# Restart dev server
npm run dev
```

### Google Sign-In Popup Shows Firebase Domain

**Αιτία:** `authDomain` στο .env δεν είναι updated.

**Λύση:**
```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nestorconstruct.gr
```

---

## Security Considerations

### OAuth Security

- HTTPS required για όλα τα redirect URIs
- Firebase handles token validation
- No client-side token storage (Firebase manages)

### Data Privacy

- givenName/familyName αποθηκεύονται τοπικά (localStorage)
- Firebase Auth Profile δεν εκθέτει sensitive data
- GDPR compliant (user can delete account)

---

## Related Documentation

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Firebase Hosting Custom Domains](https://firebase.google.com/docs/hosting/custom-domain)

---

## Changelog

### v2.0.0 (2026-01-12)
- Custom domain: nestorconstruct.gr
- givenName + familyName fields (Enterprise pattern)
- Google OAuth consent screen with logo
- i18n translations (el, en)

### v1.0.0 (Initial)
- Basic Firebase Authentication
- Email/Password + Google Sign-In
- Single displayName field
