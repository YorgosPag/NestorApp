# UC-004: In-App Αιτήματα Πελατών/Συνεργατών (μέσω ιστοσελίδας)

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../../reference/adrs/ADR-169-modular-ai-architecture.md)
> **Pipeline**: [pipeline.md](../pipeline.md)

---

## Trigger

Πελάτης ή συνεργάτης χρησιμοποιεί απευθείας την εφαρμογή/ιστοσελίδα

## Context

Η εφαρμογή θα έχει δημόσιο κομμάτι (ιστοσελίδα) που προβάλλει τα διαθέσιμα ακίνητα προς πώληση & ενοικίαση. Πελάτες και συνεργάτες θα μπαίνουν απευθείας και θα ζητούν:
- Πληροφορίες για ακίνητα
- Ραντεβού
- Επικοινωνία με υπεύθυνο

## Ροή

Ίδια pipeline με [UC-001](./UC-001-appointment.md)/[UC-003](./UC-003-notary-documents.md) αλλά η πηγή (Intake) είναι η ίδια η εφαρμογή αντί για email/Telegram.

## Σημείωση IntakeModule

Αυτό σημαίνει ότι το `IntakeModule` πρέπει να υποστηρίζει πολλαπλές πηγές εισόδου:
1. Email (Mailgun webhook)
2. Telegram (Bot API)
3. In-app (direct form/chat στην ιστοσελίδα)
4. Messenger, SMS (μελλοντικά)

## AI Model Tier

**FAST** (intent detection)
