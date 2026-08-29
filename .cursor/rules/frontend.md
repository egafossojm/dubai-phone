 # Frontend Rules

## 1. General

The frontend must be:

- TypeScript-first
- responsive
- accessible
- maintainable
- consistent
- performant

---

# 2. UI Language

User-facing UI is French.

Technical code may use English identifiers.

---

# 3. Design System

Use the established design system.

Prefer reusable components.

Do not create arbitrary visual styles for individual pages.

---

# 4. Components

Separate:

- presentation
- state
- data access
- business logic

Complex business rules do not belong inside React components.

---

# 5. Forms

Use:

- schema validation
- clear error messages
- accessible labels
- predictable submission states

---

# 6. Loading States

Important operations must display appropriate loading states.

Do not leave users wondering whether an operation is running.

---

# 7. Error States

Errors must be understandable and actionable.

Do not expose technical stack traces.

---

# 8. Empty States

Every major list should have a useful empty state.

Examples:

- Aucun produit
- Aucun client
- Aucune vente
- Aucun mouvement de stock

---

# 9. Offline States

The POS must visibly communicate:

- En ligne
- Hors ligne
- Synchronisation
- Synchronisé
- Échec de synchronisation

Never hide synchronization failures.

---

# 10. Permissions

The frontend may hide unavailable actions for UX.

However, frontend permission checks are never the security boundary.

---

# 11. Performance

Avoid unnecessary rendering.

Use pagination for large datasets.

Use server-side querying where appropriate.

---

# 12. Tables

Tables should support:

- sorting where useful
- filtering where useful
- pagination
- clear status indicators
- responsive behavior

---

# 13. POS

The POS should prioritize:

- speed
- keyboard usability
- minimal clicks
- clear totals
- immediate feedback

---

# 14. Accessibility

Use:

- semantic HTML
- labels
- keyboard navigation
- visible focus
- appropriate contrast
- accessible dialogs

---

# 15. Responsive Design

Administrative interfaces:

Desktop-first.

POS:

Desktop and tablet optimized.

Mobile:

Supported where practical, but not at the expense of POS usability.

---

# 16. Business Calculations

The frontend may display calculated values.

Critical financial calculations must ultimately be validated by the backend.
