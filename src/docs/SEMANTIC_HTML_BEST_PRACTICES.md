# 🏆 SEMANTIC HTML BEST PRACTICES

## 📋 TEAM DEVELOPMENT GUIDE

Αυτό το έγγραφο παρέχει **practical best practices** για developers στο team, βασισμένο στην επιτυχημένη **DIV-SOUP elimination** που ολοκληρώσαμε.

---

## 🚀 **QUICK START GUIDE**

### **✅ DAILY DEVELOPMENT CHECKLIST**

**Πριν commit κάθε component:**
- [ ] Χρησιμοποίησα semantic element αντί για root `<div>`?
- [ ] Έχω ARIA attributes για accessibility?
- [ ] Contact information είναι σε `<address>` element?
- [ ] Navigation groups είναι `<nav>` elements?
- [ ] Lists είναι `<ul>` με `<li>` αντί για divs?

### **🔧 DEVELOPMENT WORKFLOW**

1. **💡 Design Phase:** Σκέψου τη semantic structure πριν τον κώδικα
2. **🏗️ Implementation:** Ξεκίνα με semantic elements
3. **🎨 Styling:** Adapt CSS για semantic elements (όχι το αντίθετο)
4. **🧪 Testing:** Test με screen readers και accessibility tools
5. **📝 Review:** Code review με focus σε semantic patterns

---

## 🎯 **COMPONENT DEVELOPMENT PATTERNS**

### **📦 CARD COMPONENTS**

```tsx
// 🎯 PATTERN: Contact/Lead/User Cards
export function ContactCard({ contact }: { contact: Contact }) {
  return (
    <article
      className="card"
      itemScope
      itemType="https://schema.org/Person"
    >
      <header className="card-header">
        <h3 itemProp="name">{contact.name}</h3>
        <CommonBadge variant="status">{contact.status}</CommonBadge>
      </header>

      <address className="contact-info not-italic">
        <span itemProp="email">{contact.email}</span>
        <span itemProp="telephone">{contact.phone}</span>
      </address>

      <nav className="card-actions" aria-label="Contact actions">
        <Button onClick={onEdit}>Edit</Button>
        <Button onClick={onDelete}>Delete</Button>
      </nav>
    </article>
  );
}
```

**✅ Success Metrics:**
- SEO: Schema.org structured data
- Accessibility: Screen reader friendly
- Maintainability: Clear semantic roles

### **📊 DASHBOARD WIDGETS**

```tsx
// 🎯 PATTERN: Dashboard Sections
export function QuickActionsWidget() {
  return (
    <section
      className="dashboard-widget"
      aria-labelledby="quick-actions-title"
    >
      <header className="widget-header">
        <h2 id="quick-actions-title">Quick Actions</h2>
      </header>

      <nav
        className="actions-grid"
        aria-label="Dashboard quick actions"
      >
        {actions.map(action => (
          <button key={action.id} onClick={action.handler}>
            <action.icon />
            {action.label}
          </button>
        ))}
      </nav>
    </section>
  );
}
```

### **📋 LIST COMPONENTS**

```tsx
// 🎯 PATTERN: Activity/History Lists
export function RecentActivities() {
  return (
    <section aria-labelledby="recent-activities-title">
      <h2 id="recent-activities-title">Recent Activities</h2>

      <ul role="list" className="activities-list">
        {activities.map(activity => (
          <li key={activity.id} className="activity-item">
            <div className="activity-icon">
              <activity.icon />
            </div>
            <div className="activity-content">
              <p className="activity-title">{activity.title}</p>
              <time dateTime={activity.timestamp}>
                {formatDate(activity.timestamp)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### **🏠 PAGE LAYOUTS**

```tsx
// 🎯 PATTERN: Application Pages
export function CRMLeadPage() {
  return (
    <main className="crm-page">
      <header className="page-header">
        <nav aria-label="Breadcrumb">
          <Link href="/crm">CRM</Link> /
          <Link href="/crm/leads">Leads</Link> /
          <span aria-current="page">{lead.name}</span>
        </nav>
      </header>

      <section className="page-content">
        <aside aria-label="Lead information and actions">
          <ContactCard lead={lead} />
          <QuickActions lead={lead} />
        </aside>

        <section aria-label="Lead activities and history">
          <UpcomingTasks tasks={tasks} />
          <CommunicationsHistory leadId={lead.id} />
        </section>
      </section>
    </main>
  );
}
```

---

## 🎨 **CSS ADAPTATION STRATEGIES**

### **🔧 SEMANTIC ELEMENT STYLING**

```css
/* ✅ Target semantic elements directly */
article.contact-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
}

nav.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

address.contact-info {
  font-style: normal; /* Reset default italic */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ✅ Use semantic selectors for better specificity */
main.dashboard nav.sidebar {
  /* More specific and meaningful than div.dashboard div.sidebar */
}
```

### **🏗️ LAYOUT UTILITIES**

```css
/* ✅ Semantic-friendly utility classes */
.semantic-grid {
  display: grid;
  gap: var(--spacing-md);
}

.semantic-flex {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* ✅ Keep layout divs when necessary */
.layout-container {
  /* Layout-only divs are OK when they don't represent content */
  display: grid;
  grid-template-areas: "sidebar main";
}
```

### **📱 RESPONSIVE SEMANTIC DESIGN**

```css
/* ✅ Responsive semantic patterns */
@media (max-width: 768px) {
  main.crm-page {
    display: block; /* Stack on mobile */
  }

  aside.sidebar {
    order: 2; /* Move sidebar after main content */
  }

  nav.quick-actions {
    grid-template-columns: 1fr; /* Single column on mobile */
  }
}
```

---

## ⚡ **PERFORMANCE OPTIMIZATIONS**

### **🎯 EFFICIENT SELECTORS**

```tsx
// ✅ FAST: Semantic selectors
const cards = document.querySelectorAll('article[itemtype*="Person"]');
const navElements = document.querySelectorAll('nav[aria-label*="actions"]');

// ❌ SLOW: Class-based selectors
const cards = document.querySelectorAll('.contact-card');
const navElements = document.querySelectorAll('.actions-container');
```

### **📦 BUNDLE SIZE OPTIMIZATION**

```css
/* ✅ Semantic CSS is more cacheable and compressible */
article, section, nav, aside, main { /* 35 bytes */
  /* Common styles for semantic elements */
}

/* ❌ Class-based CSS is less predictable */
.card, .widget, .container, .wrapper { /* 42 bytes + class names */
  /* Same styles but less semantic */
}
```

---

## 🧪 **TESTING STRATEGIES**

### **♿ ACCESSIBILITY TESTING**

```tsx
// ✅ Test semantic structure
import { render, screen } from '@testing-library/react';

test('ContactCard has proper semantic structure', () => {
  render(<ContactCard contact={mockContact} />);

  // Test semantic elements
  expect(screen.getByRole('article')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /actions/i })).toBeInTheDocument();

  // Test schema.org data
  const article = screen.getByRole('article');
  expect(article).toHaveAttribute('itemtype', 'https://schema.org/Person');
  expect(screen.getByItemProp('name')).toHaveTextContent(mockContact.name);
});

// ✅ Test ARIA relationships
test('Dashboard widgets have proper ARIA labeling', () => {
  render(<DashboardPage />);

  const quickActions = screen.getByRole('navigation', { name: /quick actions/i });
  expect(quickActions).toBeInTheDocument();

  const section = screen.getByLabelText('Quick actions dashboard section');
  expect(section).toBeInTheDocument();
});
```

### **🔍 E2E SEMANTIC TESTING**

```tsx
// ✅ Test semantic navigation
test('User can navigate semantically', async () => {
  const user = userEvent.setup();
  render(<CRMApp />);

  // Navigate through landmarks
  await user.tab(); // Should focus on main navigation
  expect(screen.getByRole('navigation', { name: /main/i })).toHaveFocus();

  // Test semantic content structure
  const main = screen.getByRole('main');
  const articles = within(main).getAllByRole('article');
  expect(articles).toHaveLength(expectedContactCount);
});
```

---

## 🚨 **COMMON MISTAKES & FIXES**

### **❌ MISTAKE 1: Semantic Overthinking**

```tsx
// ❌ DON'T: Force semantics where they don't belong
<article className="button-wrapper">
  <button>Click me</button>
</article>

// ✅ DO: Use div for pure layout
<div className="button-wrapper">
  <button>Click me</button>
</div>
```

### **❌ MISTAKE 2: Missing ARIA for Dynamic Content**

```tsx
// ❌ DON'T: Semantic elements without proper accessibility
<section>
  <h2>Loading...</h2>
  {/* Dynamic content loads here */}
</section>

// ✅ DO: Proper ARIA for dynamic content
<section
  aria-labelledby="contacts-title"
  aria-live="polite"
  aria-busy={loading}
>
  <h2 id="contacts-title">
    Contacts {loading ? '(Loading...)' : `(${contacts.length})`}
  </h2>
  {/* Dynamic content loads here */}
</section>
```

### **❌ MISTAKE 3: Incorrect Schema.org Usage**

```tsx
// ❌ DON'T: Wrong schema type
<article itemScope itemType="https://schema.org/Organization">
  <span itemProp="name">{person.name}</span> {/* Person name in Organization schema */}
</article>

// ✅ DO: Correct schema matching
<article itemScope itemType="https://schema.org/Person">
  <span itemProp="name">{person.name}</span>
  <span itemProp="email">{person.email}</span>
  <span itemProp="worksFor" itemScope itemType="https://schema.org/Organization">
    <span itemProp="name">{person.company}</span>
  </span>
</article>
```

---

## 🎭 **MIGRATION STRATEGIES**

### **🔄 GRADUAL MIGRATION APPROACH**

1. **📍 Start with New Components:**
   - Όλα τα νέα components ακολουθούν semantic patterns
   - Use as reference για existing components

2. **🎯 Target High-Impact Pages:**
   - Main dashboard, lead pages, contact pages
   - Pages με υψηλή user traffic

3. **📊 Data-Driven Prioritization:**
   ```bash
   # Use automated detection
   node scripts/div-soup-detector.js src/components/crm

   # Focus on high-severity files first
   ```

4. **✅ Component-by-Component:**
   - One component per PR
   - Test thoroughly before moving to next
   - Document changes για team learning

### **🧪 TESTING MIGRATION**

```tsx
// ✅ Test backward compatibility during migration
describe('LeadCard Migration', () => {
  test('maintains same functionality after semantic migration', () => {
    const { rerender } = render(<LeadCardOld lead={mockLead} />);
    const oldSnapshot = screen.getByTestId('lead-card');

    rerender(<LeadCardNew lead={mockLead} />);
    const newElement = screen.getByRole('article');

    // Test functional equivalence
    expect(newElement).toHaveTextContent(mockLead.name);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
```

---

## 🏅 **TEAM STANDARDS**

### **📝 CODE REVIEW CHECKLIST**

**Reviewer responsibilities:**

- [ ] **Semantic Structure:** Component uses appropriate semantic elements
- [ ] **ARIA Support:** Accessibility attributes present και correct
- [ ] **Schema.org:** Contact/Person data has microdata markup
- [ ] **Navigation:** Interactive elements grouped in `<nav>`
- [ ] **Lists:** Array data rendered as proper lists (`<ul>`, `<ol>`)
- [ ] **Performance:** CSS selectors leverage semantic structure
- [ ] **Testing:** Tests verify semantic structure και accessibility

### **🎯 DEFINITION OF DONE**

Για κάθε component:

1. **✅ Semantic HTML:** Root element είναι semantic (όχι `<div>`)
2. **♿ Accessibility:** WCAG 2.1 AA compliance
3. **🔍 SEO Ready:** Schema.org data όπου applicable
4. **🧪 Tested:** Unit tests για semantic structure
5. **📝 Documented:** Component documented με semantic patterns
6. **⚡ Performant:** CSS selectors optimized για semantic elements

### **🏆 TEAM METRICS**

**Monthly Review:**

- **Semantic Adoption Rate:** % components using semantic elements
- **Accessibility Score:** Average a11y score across pages
- **SEO Structure:** Schema.org coverage για content types
- **Performance Impact:** CSS selector efficiency measurements

---

## 🚀 **ADVANCED PATTERNS**

### **🏗️ COMPOUND SEMANTIC COMPONENTS**

```tsx
// ✅ Advanced semantic composition
export const ContactProfile = {
  Root: ({ children, contact }: { children: ReactNode, contact: Contact }) => (
    <article
      className="contact-profile"
      itemScope
      itemType="https://schema.org/Person"
    >
      {children}
    </article>
  ),

  Header: ({ children }: { children: ReactNode }) => (
    <header className="profile-header">{children}</header>
  ),

  ContactInfo: ({ contact }: { contact: Contact }) => (
    <address className="contact-info not-italic">
      <span itemProp="name">{contact.name}</span>
      <span itemProp="email">{contact.email}</span>
      <span itemProp="telephone">{contact.phone}</span>
    </address>
  ),

  Actions: ({ children }: { children: ReactNode }) => (
    <nav aria-label="Profile actions" className="profile-actions">
      {children}
    </nav>
  )
};

// Usage:
<ContactProfile.Root contact={contact}>
  <ContactProfile.Header>
    <h1>{contact.name}</h1>
    <Badge>{contact.status}</Badge>
  </ContactProfile.Header>

  <ContactProfile.ContactInfo contact={contact} />

  <ContactProfile.Actions>
    <Button>Edit</Button>
    <Button>Delete</Button>
  </ContactProfile.Actions>
</ContactProfile.Root>
```

### **🎭 SEMANTIC HOOKS**

```tsx
// ✅ Custom hooks για semantic patterns
export function useSemanticNavigation(items: NavItem[]) {
  const navigationRef = useRef<HTMLElement>(null);

  const semanticProps = useMemo(() => ({
    'role': 'navigation',
    'aria-label': 'Primary navigation',
    'ref': navigationRef
  }), []);

  return {
    navigationProps: semanticProps,
    items: items.map(item => ({
      ...item,
      'aria-current': item.isActive ? 'page' : undefined
    }))
  };
}

// Usage:
function MainNavigation() {
  const { navigationProps, items } = useSemanticNavigation(navItems);

  return (
    <nav {...navigationProps}>
      {items.map(item => (
        <Link key={item.id} href={item.href} aria-current={item['aria-current']}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

---

## 📚 **LEARNING RESOURCES**

### **🎓 TEAM TRAINING MATERIALS**

1. **📖 Required Reading:**
   - `src/docs/SEMANTIC_HTML_STYLE_GUIDE.md`
   - WCAG 2.1 Quick Reference
   - Schema.org Documentation

2. **🧪 Hands-On Practice:**
   - Refactor ένα legacy component
   - Write semantic tests για existing component
   - Code review semantic pull request

3. **🏆 Advanced Topics:**
   - ARIA Authoring Practices Guide
   - Accessibility tree debugging
   - SEO schema testing tools

### **🔗 EXTERNAL RESOURCES**

- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **Schema.org Reference:** https://schema.org/
- **ARIA Guide:** https://www.w3.org/WAI/ARIA/apg/
- **Semantic HTML MDN:** https://developer.mozilla.org/en-US/docs/Web/HTML/Element

---

**🎯 REMEMBER:** Semantic HTML isn't just about compliance - it's about creating **better user experiences**, **improved accessibility**, και **future-proof code architecture**!