● Update(src\components\contacts\ContactsPageContent.tsx)
  ⎿  Updated src\components\contacts\ContactsPageContent.tsx with 1 addition
        7    import { ContactsDashboard } from './page/ContactsDashboard';
        8    import { ContactsList } from './list/ContactsList';
        9    import { ContactDetails } from './details/ContactDetails';
       10 +  import { AddNewContactDialog } from './dialogs/AddNewContactDialog';
       11    
       12    const contactsData: Contact[] = [
       13      {

● Update(src\components\contacts\ContactsPageContent.tsx)
  ⎿  Updated src\components\contacts\ContactsPageContent.tsx with 2 additions and 1 removal
       76      const [selectedContact, setSelectedContact] = useState<Contact | null>(contactsData[1]);
       77      const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
       78      const [showDashboard, setShowDashboard] = useState(true);
       79 -    
       79 +    const [showNewContactDialog, setShowNewContactDialog] = useState(false);
       80 +  
       81      // Add missing search/filter state
       82      const [searchTerm, setSearchTerm] = useState('');
       83      const [filterType, setFilterType] = useState<'all' | 'individual' | 'company' | 'service'>('all');

● Τώρα θα προσθέσω τη function handleNewContact και handleContactAdded:

● Update(src\components\contacts\ContactsPageContent.tsx)
  ⎿  Updated src\components\contacts\ContactsPageContent.tsx with 10 additions
        85      const [unitsCountFilter, setUnitsCountFilter] = useState<'all' | '1-2' | '3-5' | '6+'>('all');
        86      const [areaFilter, setAreaFilter] = useState<'all' | '0-100' | '101-300' | '301+'>('all');    
        87    
        88 +    const handleNewContact = () => {
        89 +      setShowNewContactDialog(true);
        90 +    };
        91 +  
        92 +    const handleContactAdded = () => {
        93 +      // TODO: Refresh contacts data από το service
        94 +      // Προς το παρόν μένει στο στατικό contactsData
        95 +      setShowNewContactDialog(false);
        96 +    };
        97 +  
        98      const stats = {
        99        totalContacts: contactsData.length,
       100        individuals: contactsData.filter(c => c.type === 'individual').length,

● Τώρα θα προσθέσω το ContactsList με τη νέα onNewContact prop και το dialog στο τέλος:

● Update(src\components\contacts\ContactsPageContent.tsx)
  ⎿  Updated src\components\contacts\ContactsPageContent.tsx with 2 additions
       133                    contacts={contactsData}
       134                    selectedContact={selectedContact}
       135                    onSelectContact={setSelectedContact}
       136 +                  isLoading={false}
       137 +                  onNewContact={handleNewContact}
       138                  />
       139                  <ContactDetails contact={selectedContact} />     
       140                </>

● Update(src\components\contacts\ContactsPageContent.tsx)
  ⎿  Updated src\components\contacts\ContactsPageContent.tsx with 7 additions
       144                </div>
       145              )}
       146            </div>
       147 +  
       148 +          {/* Dialog για νέα επαφή */}
       149 +          <AddNewContactDialog
       150 +            open={showNewContactDialog}
       151 +            onOpenChange={setShowNewContactDialog}
       152 +            onContactAdded={handleContactAdded}
       153 +          />
       154          </div>
       155        </TooltipProvider>
       156      );

● Τώρα πρέπει να ενημερώσω το ContactsList.tsx να δεχτεί το onNewContact prop και να το περάσει στο ContactsToolbar:

● Update(src\components\contacts\list\ContactsList.tsx)
  ⎿  Updated src\components\contacts\list\ContactsList.tsx with 1 addition
       15      selectedContact: Contact | null;
       16      onSelectContact?: (contact: Contact) => void;
       17      isLoading: boolean;
       18 +    onNewContact?: () => void;
       19    }
       20    
       21    export function ContactsList({

● Update(src\components\contacts\list\ContactsList.tsx)
  ⎿  Updated src\components\contacts\list\ContactsList.tsx with 1 addition 
       23      selectedContact,
       24      onSelectContact,
       25      isLoading,
       26 +    onNewContact,
       27    }: ContactsListProps) {
       28      const [favorites, setFavorites] = useState<string[]>(['1']);
       29      const [sortBy, setSortBy] = useState<string>('name');       

● Update(src\components\contacts\list\ContactsList.tsx)
  ⎿  Updated src\components\contacts\list\ContactsList.tsx with 1 addition and 1 removal
       51          <ContactsListHeader
       52            contactCount={contacts.length}
       53          />
       54 -        <ContactsToolbar />
       54 +        <ContactsToolbar onNewContact={onNewContact} />
       55          <ScrollArea className="flex-1">
       56            <div className="p-2 space-y-2">
       57              {isLoading ? null : (

● Τώρα ας κάνουμε TypeScript compilation check: