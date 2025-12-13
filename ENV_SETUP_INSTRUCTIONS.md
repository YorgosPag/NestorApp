# 🔧 Firebase Admin SDK Setup Instructions

## ΒΗΜΑ 1: Δημιουργία Service Account Key

1. **Πήγαινε στο Firebase Console**: https://console.firebase.google.com
2. **Project Settings** → **Service accounts** tab
3. **Scroll κάτω** → **"Generate new private key"** → **Download JSON file**

## ΒΗΜΑ 2: Προσθήκη στο .env.local

Δημιούργησε αρχείο `.env.local` στο root του project (δίπλα στο package.json):

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"YOUR_PROJECT_ID","private_key_id":"YOUR_PRIVATE_KEY_ID","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxx@YOUR_PROJECT_ID.iam.gserviceaccount.com","client_id":"YOUR_CLIENT_ID","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxx%40YOUR_PROJECT_ID.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

**ΣΗΜΑΝΤΙΚΟ:**
- Αντικατέστησε `YOUR_PROJECT_ID` με το πραγματικό project ID
- Στο `private_key` κράτα τα `\n` ακριβώς όπως είναι
- **ΜΗΝ** ανεβάσεις αυτό το αρχείο στο GitHub!

## ΒΗΜΑ 3: Restart & Test

```bash
# Restart server
npm run dev

# Test στο browser
http://localhost:3000/admin/link-units
```

## ΒΗΜΑ 4: Επιβεβαίωση

Όταν πατήσεις "Εκτέλεση Σύνδεσης", θα δεις στο terminal:

```
✅ Firebase Admin SDK initialized successfully
🔥 ADMIN SDK: Ξεκινάω πραγματικά updates...
Βρέθηκαν X units για σύνδεση
✅ REAL UPDATE: Unit "Στούντιο B1" → Contact "Γιώργος Παπαδόπουλος"
🎉 ADMIN SDK COMPLETE: Successfully linked X units!
```

Μετά πήγαινε στο project tab "Πελάτες" → **ΘΑ ΕΜΦΑΝΙΣΤΟΥΝ ΠΕΛΑΤΕΣ!** 🚀