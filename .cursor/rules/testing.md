# Testing Rules

## 1. Testing Philosophy

A feature is not complete merely because it works manually.

Critical business logic must be tested automatically.

---

# 2. Unit Tests

Use unit tests for:

- calculations
- business rules
- discount logic
- credit calculations
- payment calculations
- permission checks
- status transitions

---

# 3. Integration Tests

Use integration tests for:

- database operations
- repositories
- application services
- transactions
- APIs
- inventory operations
- financial operations

---

# 4. End-to-End Tests

Critical user journeys must have E2E coverage.

---

# 5. Critical E2E Scenarios

At minimum:

1. Login
2. Create product
3. Receive inventory
4. Sell product
5. Sell serialized device
6. Apply permitted discount
7. Reject unauthorized discount
8. Create installment sale
9. Register credit payment
10. Process return
11. Process refund
12. Generate receipt
13. Work offline
14. Synchronize sale
15. Retry synchronization
16. Prevent duplicate synchronization

---

# 6. Inventory Invariants

Test that:

Stock
=
valid stock movement balance

where applicable.

Test that:

- a device cannot be sold twice
- stock cannot be silently changed
- duplicate movement cannot occur

---

# 7. Financial Invariants

Test:

- payment totals
- remaining credit balance
- refund limits
- sale totals
- discount calculations

---

# 8. Authorization Tests

Every important permission boundary should have tests.

Test both:

- authorized user
- unauthorized user

---

# 9. Offline Tests

Test:

- offline sale
- browser refresh
- reconnection
- retry
- duplicate request
- failed synchronization
- conflict

---

# 10. Regression

Existing tests must remain green after feature changes.

---

# 11. Test Data

Do not use real customer information.

Use deterministic fake data.

---

# 12. Definition of Done

A feature is complete only when appropriate:

- implementation
- validation
- authorization
- tests
- error handling
- loading states
- empty states
- documentation

are complete.

---

# 13. Production Gate

Before production:

- lint passes
- type checking passes
- unit tests pass
- integration tests pass
- E2E tests pass
- production build succeeds
