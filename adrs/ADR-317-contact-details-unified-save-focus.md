# ADR-317 — Contact Details Unified Save Focus (SSoT adaptive header)

**Status:** Implemented
**Data:** 2026-04-22
**Autori:** YorgosPag + Claude Code
**Correlati:** ADR-121 (Persona System), ADR-178 (Relationship Auto-Save UX), ADR-282 (Persona Architecture Refactoring)

---

## 1. Contesto

La pagina di dettaglio di una contatto (persona fisica o giuridica) mostra in alto un header globale con azioni (`Nuova contatto`, `Modifica`, `Salva`, `Annulla`, `Elimina`). All'interno della pagina, alcune tab gestiscono sub-collezioni con il proprio ciclo di vita CRUD (per esempio la tab **Τραπεζικά** con `BankAccount` o la tab **Σχέσεις**/Relationships): aprendo il form inline di "Aggiungi / Modifica", comparivano **due** bottoni "Αποθήκευση":

1. Uno **dentro** il form della sub-collezione (quello corretto, che salva effettivamente il nuovo record).
2. Uno **sopra** nell'header del contatto (che salvava solo i dati del contatto principale — inutile in quel contesto).

### 1.1 Incidente UX

L'utente aprendo il form di nuovo conto bancario cliccava il bottone `Αποθήκευση` in alto per istinto, ma quel bottone non aveva alcuna relazione con il form aperto: salvava (o non salvava) il contatto stesso. Risultato:

- Forte ambiguità visiva (due bottoni con stessa label, stesso ruolo apparente).
- Perdita di dati reale: il form bancario restava pieno ma non veniva mai inviato.
- Rottura dell'invariante "un bottone = una azione prevedibile".

### 1.2 Root cause tecnico

- Nessuna fonte unica di verità ("single source of truth") sullo stato **"what is currently being edited"**.
- Due sistemi di salvataggio paralleli scollegati:
  - `useContactDetailsController.handleSaveEdit` (contatto principale).
  - `ContactBankingTab.handleFormSubmit` (singolo `BankAccount`).
- Il registro `SUBCOLLECTION_TABS` in `contact-details-helpers.ts` conteneva solo `['relationships']`, quindi per le tab `banking` e `files` l'header continuava a mostrare Save/Cancel globali quando l'utente era in modalità `isEditing`.

---

## 2. Decisione

Introdurre **una SSoT per il "focus di editing corrente"** nel sottoalbero della contact-details-page e rendere l'header **adattivo**: quando un form inline è attivo, header Save/Cancel diventano **delegatori** che operano sul form attivo, e le azioni globali potenzialmente distruttive (New / Edit / Delete) vengono nascoste.

Questo è il pattern Google Contacts / Gmail compose: **un solo bottone "Salva" visibile, contestuale, sempre corretto**.

### 2.1 Principi

- **SSoT:** esiste un'unica `React.Context` (`ContactEditFocusContext`) che contiene al più un `EditFocusTarget`.
- **Registrazione autonoma:** ogni sub-form si registra via hook `useRegisterEditFocus` quando viene aperto, si de-registra al cancel/unmount.
- **Delegazione:** l'header legge il focus e, se presente, instrada il click di Save verso `focus.submit()` (e Cancel verso `focus.cancel()`).
- **Trigger nativo HTML:** `focus.submit()` chiama `HTMLFormElement.requestSubmit()` sul form identificato da un `formId` (`useId()`). Nessun `useImperativeHandle`, nessun passaggio di ref artificiali — si sfrutta l'API browser nativa.
- **Progressive disclosure:** quando il focus è attivo, `Edit`, `New`, `Delete` globali vengono nascosti per evitare perdita di dati non salvati nel form focalizzato.
- **Zero duplicazione:** il bottone interno del form viene nascosto via `hideActions` quando esiste un header esterno che possiede la submit.

---

## 3. Struttura dati — `EditFocusTarget`

**File:** `src/components/contacts/details/contact-details/ContactEditFocusContext.tsx`

```typescript
interface EditFocusTarget {
  id: string;                          // unico (es. `banking-form-${contactId}`)
  label: string;                       // i18n'd (es. "Νέος Λογαριασμός")
  submit: () => void | Promise<void>;  // delegato: invoca requestSubmit sul form
  cancel: () => void;                  // delegato: chiude form, resetta state
  loading?: boolean;                   // stato di submit in corso
}
```

---

## 4. API pubblica

### 4.1 Provider

```tsx
// src/components/contacts/details/ContactDetails.tsx
<ContactEditFocusProvider>
  <DetailsContainer header={<ContactDetailsHeader .../>}>
    ...
  </DetailsContainer>
</ContactEditFocusProvider>
```

### 4.2 Hook di registrazione (sub-form owner)

```tsx
// Pattern: passa null per de-registrare
useRegisterEditFocus(
  isFormOpen
    ? {
        id: `banking-form-${contactId}`,
        label: editingAccount
          ? t('bankingTab.editAccount.title')
          : t('bankingTab.newAccount.title'),
        submit: () => {
          const el = document.getElementById(bankingFormId);
          if (el instanceof HTMLFormElement) el.requestSubmit();
        },
        cancel: handleFormCancel,
        loading: actionLoading,
      }
    : null,
);
```

### 4.3 Hook di consumo (header)

```tsx
// ContactDetailsHeader / ContactDetailsMobileActions
const { focus } = useContactEditFocus();
if (focus) {
  // render adaptive Save + Cancel che delegano a focus.submit() / focus.cancel()
}
```

---

## 5. File toccati

### 5.1 Nuovi

| File | Ruolo |
|------|-------|
| `src/components/contacts/details/contact-details/ContactEditFocusContext.tsx` | SSoT: Context + Provider + `useContactEditFocus` + `useRegisterEditFocus` |
| `src/components/contacts/tabs/contact-banking-descriptions.tsx` | Extract dei 3 description builders (separazione per rientrare sotto 500 loc) |

### 5.2 Modificati

| File | Modifica |
|------|----------|
| `src/components/contacts/details/ContactDetails.tsx` | Wrap dell'albero con `ContactEditFocusProvider`; `hideEditControls={isSubcollectionTab}` passato al mobile |
| `src/components/contacts/details/ContactDetailsHeader.tsx` | Actions adattive: se `focus` attivo → solo Save+Cancel delegati; altrimenti comportamento precedente. Edit globale nascosto anche quando `hideEditControls` |
| `src/components/contacts/details/contact-details/ContactDetailsMobileActions.tsx` | Stessa logica adattiva del desktop; nasconde il blocco intero se `hideEditControls` |
| `src/components/contacts/details/contact-details/contact-details-helpers.ts` | `SUBCOLLECTION_TABS` esteso a `['relationships', 'banking', 'files']` |
| `src/components/banking/BankAccountForm.tsx` | Nuovi prop `formId` (DOM id) + `hideActions` (non rendere il bottone interno Save/Cancel) |
| `src/components/banking/bank-account-form-types.ts` | Tipizzazione dei 2 nuovi prop |
| `src/components/contacts/tabs/ContactBankingTab.tsx` | Genera `bankingFormId = useId()`, passa `formId` e `hideActions` a `BankAccountForm`, registra il focus con `useRegisterEditFocus` mentre il form è aperto |

---

## 6. Checklist Google-level (N.7.2)

| # | Domanda | Risposta |
|---|---------|----------|
| 1 | Proactive o reactive? | **Proactive** — il focus è registrato al mount del form, non come side effect |
| 2 | Race condition possibile? | **No** — transizioni di state sincrone; `setFocus((prev) => prev?.id === id ? null : prev)` protegge dal double-unmount |
| 3 | Idempotente? | **Sì** — stesso `id` = stessa registrazione; nessun duplicato |
| 4 | Belt-and-suspenders? | **Sì** — il form conserva `onSubmit` nativo; `requestSubmit()` usa l'handler canonico |
| 5 | SSoT? | **Sì** — un solo `Context` possiede `focus`; nessun altro stato parallelo |
| 6 | Fire-and-forget o await? | **Trigger sync** (`requestSubmit`) — il form gestisce autonomamente l'async; l'utente vede lo spinner del form che continua a ciclare fino al termine |
| 7 | Lifecycle owner esplicito? | **Sì** — il sub-form owner (es. `ContactBankingTab`) è responsabile di register/unregister |

✅ **Google-level: YES** — SSoT unica, delegazione esplicita, zero duplicazione di button, nessuno stato scollegato.

---

## 7. Estensibilità

Ogni nuova tab con form inline (es. Files upload, Addresses, ecc.) può adottare lo stesso pattern con **una sola chiamata** a `useRegisterEditFocus`. Nessuna modifica all'header richiesta: l'header è già adattivo.

### 7.1 Migration pattern (ricetta per altre tab)

1. Aggiungere `useId()` per generare `formId`.
2. Passare `formId` + `hideActions` al form inline.
3. Chiamare `useRegisterEditFocus({ id, label, submit, cancel, loading })` quando `isFormOpen`, passare `null` altrimenti.
4. Se è una sub-collezione, aggiungere il tab id a `SUBCOLLECTION_TABS` in `contact-details-helpers.ts`.

---

## 8. Test manuali

### 8.1 Happy path Banking

1. Apri contatto legale → tab Τραπεζικά.
2. Click "Προσθήκη" → form si apre.
3. L'header globale mostra **solo** Save + Cancel (New / Edit / Delete scompaiono).
4. Click Save in header → `requestSubmit()` sul form bancario → validation + save Firestore.
5. Al successo il form si chiude, focus si de-registra, header ripristina New / Edit / Delete.
6. Click Cancel in header → chiude form senza salvare, header ripristina.

### 8.2 Edge case: isEditing + Banking tab

1. Modalità Edit contatto attivata sulla tab BasicInfo.
2. Switch alla tab Τραπεζικά (`isSubcollectionTab=true`).
3. Header non mostra Save/Cancel globali (perché `hideEditControls=true`).
4. Click "Προσθήκη" → form apre, focus registrato, header mostra Save/Cancel delegati.
5. Submit → salva conto bancario, non tocca lo state `editedData` del contatto.
6. De-register focus, ritorna a tab senza azioni globali (perché sempre subcollection tab).

### 8.3 Edge case: switch tab con form aperto

1. Form bancario aperto (focus attivo).
2. Utente fa switch alla tab BasicInfo.
3. `ContactBankingTab` rimonta → `isFormOpen=false` → focus de-registrato.
4. Header ripristina actions normali della tab BasicInfo.

---

## 9. Nota collaterale — rumore nel Next.js error overlay

Durante il test del nuovo flow l'utente ha riscontrato il Next.js dev error overlay su validazioni attese (es. `"This IBAN already exists for this contact"`). Sono stati declassati da `logger.error` a `logger.warn` i punti che intercettano errori di validazione utente-correggibili, lasciando `logger.error` solo per errori sistemici (rete, 5xx):

- `src/services/banking/BankAccountsService.ts` — `addAccount` distingue ora 4xx (warn) da 5xx/network (error).
- `src/components/contacts/tabs/ContactBankingTab.tsx` — catch in `handleFormSubmit` → `warn`.
- `src/components/banking/BankAccountForm.tsx` — catch in `handleSubmit` → `warn`.

Il messaggio raggiunge sempre l'utente via `errors.submit` nel form, quindi nessuna perdita di informazione utile; si elimina solo il rumore del red overlay di Next.js.

---

## 10. Changelog

- **2026-04-22** — Versione iniziale. Implementazione completa su tab Banking. Downgrade validation logging a warn.
- **2026-04-22** — Fix visibilità conti inattivi: `BankAccountsService.subscribeToAccounts` non filtra più `isActive=true` (il server controlla l'unicità IBAN su **tutti** i conti, compresi quelli soft-deleted). `BankAccountCard` già applica `opacity-60` + badge "inactive"; ora l'utente vede *perché* un IBAN soft-deleted blocca la ricreazione.
- **2026-04-22** — Fix secondario: `ContactBankingTab.loadAccounts()` chiamava `BankAccountsService.getAccounts(contactId)` con `includeInactive=false` di default, sovrascrivendo la subscription e rimuovendo i conti soft-deleted dallo stato locale. Passato `true` per coerenza con la subscription. Root cause del 400 "IBAN already exists" con conto invisibile segnalato su contatto `cont_ea1b5053` (IBAN `GR2802602820000110201315630`, doc `bacc_9604dba5` con `isActive: false`).
