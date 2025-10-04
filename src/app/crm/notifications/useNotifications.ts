export const useNotifications = () => {
  return [
    {
      id: 1,
      type: 'new_lead',
      title: 'Νέο Lead από Website',
      description: 'Ο Γιάννης Ιωάννου έδειξε ενδιαφέρον για το έργο "Κέντρο".',
      time: '2 λεπτά πριν',
      read: false,
    },
    {
      id: 2,
      type: 'task_due',
      title: 'Επίκειται εργασία',
      description: 'Follow-up με TechCorp για την πρόταση.',
      time: '1 ώρα πριν',
      read: false,
    },
    {
      id: 3,
      type: 'meeting_reminder',
      title: 'Υπενθύμιση Ραντεβού',
      description: 'Ξενάγηση με Μαρία Παπαδάκη στο διαμέρισμα Α3, αύριο στις 10:00.',
      time: '3 ώρες πριν',
      read: true,
    },
    {
      id: 4,
      type: 'contract_signed',
      title: 'Επιτυχής Πώληση!',
      description: 'Το διαμέρισμα Β2 πωλήθηκε στον Κώστα Βασιλείου.',
      time: '1 μέρα πριν',
      read: true,
    },
  ];
};
