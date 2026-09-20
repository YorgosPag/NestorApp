/**
 * ΑΓΚΥΡΑ ADR-869 §12 — ο ΕΝΑΣ ιδιοκτήτης της ερώτησης «πότε είναι αυτό το ραντεβού;».
 *
 * Τρία πράγματα πρέπει να μένουν αληθινά, αλλιώς το ημερολόγιο και το ερώτημα του
 * διακομιστή αρχίζουν να λένε διαφορετικά πράγματα:
 *   Α. Η **σειρά προτίμησης** (επιβεβαιωμένο ⇒ αιτούμενο ⇒ παλαιό επίπεδο πεδίο).
 *   Β. Η **κανονική μορφή** `YYYY-MM-DD` — αλλιώς η λεξικογραφική σύγκριση του Firestore
 *      παύει να είναι χρονολογική και τα εύρη γυρίζουν **σιωπηλά λάθος** αποτελέσματα.
 *   Γ. Ότι ο **γραφέας** παράγει το πεδίο και ο **αναγνώστης** δεν καταρρέει χωρίς αυτό.
 */

import {
  APPOINTMENT_DEFAULT_TIME,
  APPOINTMENT_SCHEDULE_PATHS,
  appointmentConfirmationPatch,
  appointmentStartAt,
  normalizeClockTime,
  resolveAppointmentSchedule,
  withAppointmentSchedule,
} from '../appointment-schedule';

const DESCRIPTION = 'Επίσκεψη ακινήτου';

describe('Α. Η σειρά προτίμησης — μία, γραμμένη μία φορά', () => {
  it('το ΕΠΙΒΕΒΑΙΩΜΕΝΟ υπερισχύει του αιτούμενου — το ραντεβού ζει στη νέα του μέρα', () => {
    const schedule = resolveAppointmentSchedule({
      appointment: {
        requestedDate: '2026-01-15',
        requestedTime: '10:00',
        confirmedDate: '2026-03-10',
        confirmedTime: '17:30',
        description: DESCRIPTION,
      },
    });

    expect(schedule).toEqual({ date: '2026-03-10', time: '17:30' });
  });

  it('χωρίς επιβεβαίωση ισχύει το αιτούμενο', () => {
    const schedule = resolveAppointmentSchedule({
      appointment: { requestedDate: '2026-03-20', requestedTime: '08:15', description: DESCRIPTION },
    });

    expect(schedule).toEqual({ date: '2026-03-20', time: '08:15' });
  });

  it('παλαιό έγγραφο με επίπεδα `date`/`time` στη ρίζα εξακολουθεί να διαβάζεται', () => {
    const schedule = resolveAppointmentSchedule({ date: '12/03/2026', time: '11:45' });

    expect(schedule).toEqual({ date: '2026-03-12', time: '11:45' });
  });

  it('χωρίς καμία ημέρα δεν υπάρχει πρόγραμμα — `null`, όχι σημερινή ημερομηνία', () => {
    expect(resolveAppointmentSchedule({ appointment: { description: DESCRIPTION } })).toBeNull();
    expect(appointmentStartAt({})).toBeNull();
  });

  it('ώρα που λείπει ⇒ η ΜΙΑ προεπιλογή, όχι δύο αντίγραφα του «09:00»', () => {
    const schedule = resolveAppointmentSchedule({
      appointment: { requestedDate: '2026-03-20', description: DESCRIPTION },
    });

    expect(schedule?.time).toBe(APPOINTMENT_DEFAULT_TIME);
  });
});

describe('Β. Η κανονική μορφή — γιατί τα εύρη του Firestore δουλεύουν', () => {
  it('το `DD/MM/YYYY` γίνεται `YYYY-MM-DD` πριν αποθηκευτεί', () => {
    const details = withAppointmentSchedule({ requestedDate: '05/03/2026', description: DESCRIPTION });

    expect(details.effectiveDate).toBe('2026-03-05');
  });

  it('🔴 η ταξινόμηση των αποθηκευμένων τιμών ΕΙΝΑΙ η χρονολογική', () => {
    const days = ['31/01/2026', '12/03/2026', '05/12/2026', '2026-02-28'].map(
      (raw) => withAppointmentSchedule({ requestedDate: raw, description: DESCRIPTION }).effectiveDate,
    );

    // Λεξικογραφικά — ακριβώς η σύγκριση που κάνει το ερώτημα εύρους του Firestore.
    expect([...days].sort()).toEqual(['2026-01-31', '2026-02-28', '2026-03-12', '2026-12-05']);
  });

  it('ανύπαρκτη μέρα ΔΕΝ γίνεται κανονική τιμή — θα ταξινομούνταν σαν αληθινή', () => {
    expect(withAppointmentSchedule({ requestedDate: '31/02/2026', description: DESCRIPTION }).effectiveDate).toBeNull();
    expect(withAppointmentSchedule({ requestedDate: '2026-13-45', description: DESCRIPTION }).effectiveDate).toBeNull();
  });

  it('ώρα εκτός ρολογιού απορρίπτεται — δεν γίνεται σιωπηλά αποδεκτή', () => {
    expect(normalizeClockTime('25:00')).toBeNull();
    expect(normalizeClockTime('10:75')).toBeNull();
    expect(normalizeClockTime('09:30')).toBe('09:30');
  });
});

describe('Γ. Ο γραφέας παράγει· ο αναγνώστης δεν καταρρέει χωρίς το πεδίο', () => {
  it('η γέννηση φέρνει ΠΑΝΤΑ τα κανονικά πεδία μαζί με τα ιστορικά', () => {
    const details = withAppointmentSchedule({
      requestedDate: '2026-04-02',
      requestedTime: '13:00',
      description: DESCRIPTION,
    });

    expect(details).toMatchObject({
      requestedDate: '2026-04-02',
      effectiveDate: '2026-04-02',
      effectiveTime: '13:00',
    });
  });

  it('🔑 η έγκριση μετακινεί ΜΑΖΙ το επιβεβαιωμένο και το ερωτήσιμο — μία εγγραφή', () => {
    const patch = appointmentConfirmationPatch('2026-05-09', '16:00');

    expect(patch).toEqual({
      [APPOINTMENT_SCHEDULE_PATHS.CONFIRMED_DATE]: '2026-05-09',
      [APPOINTMENT_SCHEDULE_PATHS.CONFIRMED_TIME]: '16:00',
      [APPOINTMENT_SCHEDULE_PATHS.EFFECTIVE_DATE]: '2026-05-09',
      [APPOINTMENT_SCHEDULE_PATHS.EFFECTIVE_TIME]: '16:00',
    });
  });

  it('ο αναγνώστης ΠΡΟΤΙΜΑ το αποθηκευμένο — ίδια απάντηση με το ερώτημα του διακομιστή', () => {
    const schedule = resolveAppointmentSchedule({
      appointment: {
        // Ασύμφωνα επίτηδες: αν ο αναγνώστης ξαναπαρήγαγε, θα έδινε 2026-03-10.
        requestedDate: '2026-01-15',
        confirmedDate: '2026-03-10',
        effectiveDate: '2026-07-01',
        effectiveTime: '20:00',
        description: DESCRIPTION,
      },
    });

    expect(schedule).toEqual({ date: '2026-07-01', time: '20:00' });
  });

  it('έγγραφο ΧΩΡΙΣ το πεδίο (γραμμένο πριν υπάρξει) παραμένει ορατό — παράγεται', () => {
    const schedule = resolveAppointmentSchedule({
      appointment: { requestedDate: '2026-06-11', requestedTime: '09:45', description: DESCRIPTION },
    });

    expect(schedule).toEqual({ date: '2026-06-11', time: '09:45' });
  });

  it('η στιγμή έναρξης συνθέτει ημέρα + ώρα', () => {
    const start = appointmentStartAt({
      appointment: { effectiveDate: '2026-06-11', effectiveTime: '09:45', description: DESCRIPTION },
    });

    expect(start).toEqual(new Date('2026-06-11T09:45:00'));
  });
});
