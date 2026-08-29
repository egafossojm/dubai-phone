# Backend Rules

## 1. General

Backend code must prioritize:

- correctness
- security
- data integrity
- testability
- maintainability

---

# 2. Request Lifecycle

Preferred flow:

Request
→ Authentication
→ Validation
→ Authorization
→ Application Service
→ Business Rules
→ Repository/Data Access
→ Database

---

# 3. Validation

Validate all external input.

Never assume frontend validation is sufficient.

---

# 4. Authorization

Every protected operation must perform backend authorization.

---

# 5. Business Logic

Business logic must not be duplicated across endpoints.

Centralize reusable business operations.

---

# 6. Transactions

Use database transactions for operations involving multiple dependent records.

---

# 7. Idempotency

Use idempotency for operations vulnerable to retries.

Especially:

- sales
- payments
- refunds
- offline synchronization

---

# 8. Inventory

Never directly modify inventory without recording a stock movement.

---

# 9. Financial Operations

Financial operations must be:

- transactional
- auditable
- validated
- idempotent where applicable

---

# 10. Error Handling

Use predictable domain errors.

Do not leak infrastructure details.

---

# 11. Logging

Logs should be useful for diagnosing operational problems.

Never log sensitive secrets.

---

# 12. Database Access

Keep database access organized.

Do not scatter raw queries throughout unrelated business code.

---

# 13. API Responses

Return consistent response structures.

Do not expose unnecessary internal fields.

---

# 14. Concurrency

Consider race conditions for:

- stock
- serialized devices
- payments
- discounts
- refunds

Use database constraints and transactions as appropriate.

---

# 15. Offline Synchronization

Synchronization must:

- authenticate
- validate
- authorize
- enforce idempotency
- preserve transaction integrity
- report failures

---

# 16. Performance

Avoid N+1 queries.

Paginate large datasets.

Use indexes appropriately.

Do not prematurely optimize without evidence.
