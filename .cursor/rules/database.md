i# Database Rules

## 1. General Principles

The database is the authoritative source of truth for business-critical data.

Use PostgreSQL.

Data integrity must be enforced at the database level whenever practical.

---

# 2. Primary Entities

Expected core entities include:

- User
- Role
- Permission
- Product
- ProductVariant
- Category
- Brand
- ProductSerial
- Supplier
- PurchaseOrder
- PurchaseOrderItem
- GoodsReceipt
- GoodsReceiptItem
- StockMovement
- Customer
- CustomerCredit
- Installment
- CustomerPayment
- Sale
- SaleItem
- Payment
- Return
- ReturnItem
- Refund
- Warranty
- AuditLog
- SyncTransaction

The exact schema may evolve after architecture review.

---

# 3. IDs

Use stable unique identifiers.

Do not rely on user-visible sequential references as primary keys.

Human-readable references may exist separately.

Example:

Technical ID:
`uuid`

Business reference:
`V-2026-000124`

---

# 4. Timestamps

Business entities should generally track:

- createdAt
- updatedAt

Relevant entities may also track:

- completedAt
- cancelledAt
- receivedAt
- refundedAt

---

# 5. Monetary Values

Never use floating point for financial amounts.

Use an appropriate exact representation.

Recommended:

- integer minor units where appropriate
- or PostgreSQL `NUMERIC`

The representation must be consistent across the application.

Currency:

XAF / FCFA.

---

# 6. Inventory

Do not rely exclusively on a mutable `stock` field as the authoritative inventory record.

Stock movements are authoritative.

A cached quantity may exist for performance, but it must remain consistent with movements.

---

# 7. Serialized Products

IMEI and serial numbers require database uniqueness constraints.

The database must prevent duplicate physical identifiers.

---

# 8. Foreign Keys

Use foreign keys for important relationships.

Do not rely solely on application code for referential integrity.

---

# 9. Indexes

Add indexes based on real query patterns.

Important candidates include:

- SKU
- IMEI
- serial number
- customer phone
- sale reference
- purchase reference
- timestamps
- stock movement product ID
- payment status
- credit status

Avoid indiscriminate indexing.

---

# 10. Financial Records

Completed financial records should generally be append-oriented.

Do not casually overwrite historical financial information.

Corrections should use explicit corrective records where appropriate.

---

# 11. Audit Logs

Audit logs should preserve historical information.

Do not use ordinary CRUD semantics to casually rewrite audit history.

---

# 12. Transactions

Use database transactions whenever multiple records must remain consistent.

Example:

Sale
+ Sale Items
+ Payment
+ Stock Movement
+ Serialized Device Update

must succeed or fail together.

---

# 13. Migrations

All schema changes must use migrations.

Never manually modify production schema without a corresponding migration.

---

# 14. Seed Data

Development seed data should be deterministic.

Seed data must never contain real customer information.

---

# 15. Soft Delete

Use soft deletion only where appropriate.

Do not soft-delete records whose historical existence is required for:

- financial audit
- inventory traceability
- regulatory history
- audit logs

---

# 16. Data Integrity

The database must enforce:

- uniqueness
- foreign key relationships
- valid status values
- appropriate non-null constraints
- financial consistency where practical
