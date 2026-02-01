# ADR-159: Measurement Text Colors Separation (ANGLE vs DISTANCE)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Drawing System |
| **Canonical Location** | `UI_COLORS.ANGLE_MEASUREMENT_TEXT` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `UI_COLORS.ANGLE_MEASUREMENT_TEXT` & `UI_COLORS.DISTANCE_MEASUREMENT_TEXT` from `config/color-config.ts`
- **Decision**: Separate measurement text colors for autonomy - angles (fuchsia) vs distances (white)
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Single `DIMENSION_TEXT` color used for both angles and distances, no autonomy
- **Solution**: Two distinct centralized constants:
  ```typescript
  // 🏢 ADR-159: Measurement Text Colors - Separate for autonomy
  ANGLE_MEASUREMENT_TEXT: 'fuchsia',    // Φούξια για μέτρηση γωνιών (μοίρες, radians)
  DISTANCE_MEASUREMENT_TEXT: '#FFFFFF', // Λευκό για μέτρηση μηκών ευθύγραμμων τμημάτων
  DIMENSION_TEXT: 'fuchsia',            // @deprecated - backward compatibility alias
  ```
- **New Methods in BaseEntityRenderer**:
  - `applyAngleMeasurementTextStyle()` - Φούξια χρώμα για γωνίες
  - `applyDistanceMeasurementTextStyle()` - Λευκό χρώμα για μήκη
  - `applyDimensionTextStyle()` - @deprecated, delegates to applyAngleMeasurementTextStyle()
- **Benefits**:
  - Αυτονομία χρωμάτων: Γωνίες και αποστάσεις ανεξάρτητα
  - Κεντρικοποίηση: Single Source of Truth για κάθε τύπο
  - Backward compatibility: Παλιές κλήσεις συνεχίζουν να λειτουργούν
- **Companion**: ADR-048 (Rendering System), ADR-140 (Angle Measurement)
