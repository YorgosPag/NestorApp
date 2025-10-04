
import type { StorageType } from '@/types/storage';

export const storageFormConfig = (formType: StorageType) => {
    const availableFloors = [
        'Υπόγειο 2', 'Υπόγειο 1', 'Υπόγειο', 'Ισόγειο', '1ος Όροφος', '2ος Όροφος',
        '3ος Όροφος', '4ος Όροφος', '5ος Όροφος', '6ος Όροφος', '7ος Όροφος'
    ];

    const commonFeaturesForType = ({
        storage: [
            'Ηλεκτρικό ρεύμα', 'Φυσικός φωτισμός', 'Τεχνητός φωτισμός', 'Αεροθαλάμος',
            'Ασφάλεια', 'Πρόσβαση ανελκυστήρα', 'Υδραυλικές εγκαταστάσεις'
        ],
        parking: [
            'Πρίζα φόρτισης EV', 'Κλειστό', 'Φωτισμός', 'Ασφάλεια', 'Εύκολη πρόσβαση'
        ]
    })[formType] || [];

    return { availableFloors, commonFeaturesForType };
};
