# Architecture Rules

## 1. General Principles

The application must use a modular architecture.

Priorities:

1. Clear domain boundaries
2. Maintainability
3. Testability
4. Security
5. Simplicity
6. Performance

Avoid unnecessary abstraction.

Avoid premature microservices.

The MVP should be a modular monolith unless a documented technical reason requires otherwise.

---

# 2. Domain Modules

Primary domains:

- Authentication
- Users
- Roles
- Products
- Categories
- Brands
- Inventory
- Suppliers
- Purchases
- Customers
- Credit
- Sales
- Payments
- Returns
- Warranty
- Receipts
- Dashboard
- Audit
- Settings
- Synchronization

---

# 3. Separation of Concerns

UI components must not contain complex business logic.

Business logic belongs in application/domain services.

Database access must not be scattered randomly throughout UI code.

---

# 4. Dependency Direction

Prefer:

Presentation
→ Application
→ Domain
→ Infrastructure

The domain should not depend on UI implementation details.

---

# 5. Business Logic

Business rules must be centralized.

Do not duplicate:

- discount rules
- inventory rules
- credit calculations
- refund rules
- permission rules

across multiple components.

---

# 6. Transactions

Use database transactions for critical operations.

Examples:

- completing a sale
- receiving inventory
- refunding a sale
- recording credit payment
- inventory adjustment
- synchronization of a financial transaction

---

# 7. Idempotency

Operations vulnerable to retries must support idempotency.

Especially:

- POS sale completion
- offline synchronization
- payments
- refunds

---

# 8. Error Handling

Errors should be classified consistently.

Examples:

- ValidationError
- AuthenticationError
- AuthorizationError
- NotFoundError
- ConflictError
- BusinessRuleError
- InfrastructureError

Do not expose internal implementation details to users.

---

# 9. API Boundaries

API handlers should remain thin.

Preferred flow:

Request
→ Validation
→ Authentication
→ Authorization
→ Application Service
→ Domain Logic
→ Repository
→ Database

---

# 10. External Services

External services must be isolated behind appropriate interfaces.

Do not tightly couple business logic to a specific external provider.

---

# 11. Offline Architecture

Offline functionality must remain isolated from normal online business logic.

Use:

- local persistence
- transaction queue
- synchronization service
- idempotency keys
- retry strategy
- synchronization status

---

# 12. Scalability

Do not prematurely introduce:

- microservices
- Kubernetes
- event-driven distributed architecture
- complex message brokers

unless justified.

The initial architecture should be easy to operate and deploy.

---

# 13. Documentation

Major architectural decisions must be documented.

Use ADRs when a decision has meaningful long-term consequences.
