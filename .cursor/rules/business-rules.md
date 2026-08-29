# Business Rules

This file contains the authoritative business rules of the application.

Business rules must not be duplicated inconsistently across frontend and backend.

The backend is ultimately responsible for enforcing business rules.

---

# 1. Product Rules

## BR-PRODUCT-001 — SKU uniqueness

Every active product SKU must be unique.

The backend must reject duplicate SKUs.

---

## BR-PRODUCT-002 — Serialized products

A serialized product represents an individually identifiable physical device.

Serialized products may contain:

- IMEI 1
- IMEI 2
- Serial number

---

## BR-PRODUCT-003 — IMEI uniqueness

An IMEI must never belong to two different physical devices.

The database must enforce uniqueness.

---

## BR-PRODUCT-004 — Serial number uniqueness

Serial numbers must be unique when the product requires serialized tracking.

---

## BR-PRODUCT-005 — Product price

Selling prices are stored as TTC.

The MVP does not implement complex tax calculation.

---

# 2. Inventory Rules

## BR-INVENTORY-001 — Movement-based inventory

Inventory must be derived from valid stock movements.

Direct silent stock mutation is forbidden.

---

## BR-INVENTORY-002 — Every stock change must be traceable

Every stock-affecting operation must create a stock movement.

---

## BR-INVENTORY-003 — Sale reduces stock

A completed sale reduces available inventory.

The reduction must happen exactly once.

---

## BR-INVENTORY-004 — Customer return

An accepted customer return may increase inventory depending on the return outcome.

The resulting stock movement must be recorded.

---

## BR-INVENTORY-005 — Supplier return

A supplier return decreases inventory.

The operation must be recorded.

---

## BR-INVENTORY-006 — Inventory adjustment

Manual inventory adjustments require:

- authorized permission
- quantity change
- reason
- user
- timestamp
- audit event

---

## BR-INVENTORY-007 — Serialized device availability

A serialized device cannot be sold if it is already:

- sold
- unavailable
- returned to supplier
- otherwise not available for sale

---

# 3. Purchase Rules

## BR-PURCHASE-001 — Purchase lifecycle

Purchases follow:

DRAFT
→ ORDERED
→ PARTIALLY_RECEIVED
→ RECEIVED

A purchase may also be CANCELLED where allowed.

---

## BR-PURCHASE-002 — Receiving

Received quantity must be validated against ordered quantity.

Over-receiving is forbidden unless explicitly supported by a future business rule.

---

## BR-PURCHASE-003 — Serialized receiving

When receiving serialized products, the system must validate:

- IMEI uniqueness
- serial number uniqueness
- quantity consistency

---

# 4. Sales Rules

## BR-SALE-001 — Sale validation

A sale may only be completed when:

- the user has permission
- products exist
- products are available
- quantities are valid
- serialized devices are available
- discounts are authorized
- payment information is valid

---

## BR-SALE-002 — Atomic sale

The following operations must be treated atomically:

- Sale
- Sale items
- Payment
- Stock movement
- Serialized device status
- Customer credit where applicable
- Audit event

---

## BR-SALE-003 — Duplicate sale prevention

A sale must have a unique transaction identifier.

Retrying the same transaction must not create a duplicate sale.

---

## BR-SALE-004 — Serialized sale

When selling a serialized device, the exact physical device must be associated with the sale.

---

# 5. Payment Rules

## BR-PAYMENT-001 — Supported payment methods

Only the configured payment methods are allowed:

- CASH
- ORANGE_MONEY
- MTN_MOBILE_MONEY
- INSTALLMENT

---

## BR-PAYMENT-002 — Payment amount

Payment amounts must be positive unless explicitly representing a valid refund operation.

---

## BR-PAYMENT-003 — Installment payment

An installment sale must record:

- total amount
- initial payment
- remaining balance
- installment schedule

---

## BR-PAYMENT-004 — Overpayment

Customer payments must not exceed the outstanding balance unless an explicit overpayment policy is introduced.

---

# 6. Credit Rules

## BR-CREDIT-001

A credit balance is:

Total credit sales
minus
valid customer payments.

---

## BR-CREDIT-002

A credit becomes PAID when its remaining balance reaches zero.

---

## BR-CREDIT-003

A credit is PARTIALLY_PAID when:

remaining balance > 0

and

amount paid > 0.

---

## BR-CREDIT-004

Overdue status is determined from unpaid amounts past their due date.

---

# 7. Discount Rules

## BR-DISCOUNT-001

Discounts require appropriate permission.

---

## BR-DISCOUNT-002

Maximum discount limits must be configurable by role.

---

## BR-DISCOUNT-003

Discount validation must occur on the backend.

---

## BR-DISCOUNT-004

Sensitive discounts must be auditable.

---

# 8. Return Rules

## BR-RETURN-001

A return must reference an original sale.

---

## BR-RETURN-002

Refunds cannot exceed the refundable amount.

---

## BR-RETURN-003

Refund operations require appropriate permission.

---

## BR-RETURN-004

Returning a serialized product must identify the exact serialized device.

---

# 9. Warranty Rules

## BR-WARRANTY-001

Warranty information must be associated with the relevant product or serialized device.

---

## BR-WARRANTY-002

Warranty status must be derived from relevant dates and conditions.

---

## BR-WARRANTY-003

Warranty lookup must support IMEI or serial number for serialized devices.

---

# 10. Audit Rules

## BR-AUDIT-001

Sensitive operations must create audit records.

Examples:

- refunds
- discounts
- inventory adjustments
- price changes
- user changes
- permission changes
- sale cancellation
- credit adjustments

---

## BR-AUDIT-002

Audit records must not be casually modified or deleted.

---

# 11. Offline Rules

## BR-OFFLINE-001

Offline transactions require unique client-generated identifiers.

---

## BR-OFFLINE-002

Synchronization must be idempotent.

---

## BR-OFFLINE-003

A retry must never create a duplicate financial transaction.

---

## BR-OFFLINE-004

Failed synchronization must remain visible to authorized users.

---

# 12. Financial Integrity

Financial records must not be silently overwritten.

Corrections should use explicit corrective transactions where appropriate.

Never use destructive mutation merely to hide historical mistakes.
