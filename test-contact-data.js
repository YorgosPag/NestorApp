// Test script to check contact data structure
console.log('🔍 Checking contact data structure...');

fetch('/api/contacts')
  .then(response => response.json())
  .then(data => {
    console.log('📋 Contacts API Response:', data);

    if (data.success && data.contacts) {
      console.log(`📊 Found ${data.contacts.length} contacts`);

      // Find one of our new contacts by checking for tags
      const contactWithTags = data.contacts.find(contact =>
        contact.tags && Array.isArray(contact.tags) && contact.tags.length > 0
      );

      if (contactWithTags) {
        console.log('✅ Found contact with tags:', contactWithTags);
        console.log('🏷️ Tags:', contactWithTags.tags);
        console.log('🎯 Role:', contactWithTags.role);
      } else {
        console.log('❌ No contacts found with tags');

        // Show structure of first contact
        if (data.contacts.length > 0) {
          console.log('📝 Sample contact structure:', data.contacts[0]);
        }
      }
    } else {
      console.log('❌ API error or no contacts found:', data);
    }
  })
  .catch(error => {
    console.error('❌ Error fetching contacts:', error);
  });