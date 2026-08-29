# Project Context

## 1. Project Identity

This project is a professional retail management application for an electronics store operating primarily in Cameroon.

The store sells:

- Smartphones
- Mobile phones
- Accessories
- Gadgets
- Electronic equipment
- Related consumer electronics

This is an internal business management application.

It is NOT an e-commerce marketplace.

It is NOT a public online shopping storefront.

The application is intended to manage the complete operational lifecycle of a physical electronics retail business.

---

## 2. Target Market

Primary country:

- Cameroon

Primary currency:

- XAF / FCFA

Primary language:

- French

The application must use French for all user-facing business terminology unless explicitly specified otherwise.

Technical identifiers may remain in English.

Examples:

- `customer` internally
- `Client` in the UI

- `sale` internally
- `Vente` in the UI

---

## 3. Product Vision

The objective is to provide a reliable, professional and easy-to-use system allowing a retail electronics business to manage:

- Products
- Product variants
- Brands
- Categories
- IMEI
- Serial numbers
- Inventory
- Stock movements
- Suppliers
- Purchases
- Goods receiving
- Customers
- Customer credit
- Installments
- Sales
- Payments
- Discounts
- Returns
- Refunds
- Warranties
- Receipts
- Dashboard and reporting
- Users
- Roles
- Permissions
- Audit logs
- Offline POS operation
- Synchronization
- Backups

---

## 4. MVP Philosophy

The target is a complete and professionally usable MVP.

The MVP should be operationally realistic.

The MVP should NOT attempt to implement every possible enterprise or SaaS capability.

Explicitly out of scope for the initial MVP:

- Multi-tenant SaaS architecture
- Multiple independent organizations
- Subscription billing
- Advanced BI platform
- Complex promotion engine
- Advanced barcode scanning
- Multiple warehouses
- Multi-store inventory transfers
- Advanced predictive analytics

These may be considered in future versions.

---

## 5. User Roles

The MVP supports four primary roles.

### SUPER_ADMINISTRATOR

Full system access.

Typical capabilities:

- Manage users
- Manage roles and permissions
- Manage products
- Manage inventory
- Manage purchases
- Manage customers
- Manage sales
- Manage refunds
- Manage settings
- View reports
- View audit logs

---

### MANAGER

Operational and financial management access.

Typical capabilities:

- View dashboard
- Manage sales
- Manage products
- Manage inventory
- Manage customers
- Manage suppliers
- Manage purchases
- Manage refunds
- Manage discounts within configured limits
- View reports
- View relevant audit information

---

### SALES_PERSON / CASHIER

Sales-focused access.

Typical capabilities:

- Use POS
- Search products
- Create sales
- Manage customers
- Register customer payments
- Apply permitted discounts
- View relevant customer information
- Print receipts

Restricted operations include:

- Unauthorized refunds
- Inventory adjustments
- User administration
- Permission management
- Sensitive financial configuration

---

### INVENTORY_MANAGER

Inventory and procurement-focused access.

Typical capabilities:

- View inventory
- Manage stock movements
- Receive purchases
- Manage suppliers
- Manage purchase operations
- Register serialized devices
- Perform authorized inventory adjustments

Restricted operations include:

- Creating products, brands, or categories
- Changing selling prices or reactivating products
- Unauthorized refunds
- User administration
- Permission management
- Sensitive financial configuration

---

## 6. Product Model

Products may be serialized or non-serialized.

### Serialized products

Examples:

- Smartphones
- Some tablets
- Certain electronic devices

Serialized products may have:

- IMEI 1
- IMEI 2
- Serial number

Each physical device must be individually traceable.

---

### Non-serialized products

Examples:

- Phone cases
- Chargers
- Cables
- Screen protectors
- Generic accessories

These are quantity-based.

---

## 7. Payments

The MVP supports exactly these payment methods:

- CASH
- ORANGE_MONEY
- MTN_MOBILE_MONEY
- INSTALLMENT

Do not introduce payment providers such as:

- Stripe
- PayPal
- Credit cards
- Apple Pay
- Google Pay

unless explicitly requested later.

---

## 8. Customer Credit

The system supports installment sales.

An installment sale may contain:

- Total amount
- Initial payment
- Remaining balance
- Installment schedule
- Due dates
- Customer payments
- Payment history

Credit statuses include:

- PAID
- PARTIALLY_PAID
- PENDING
- OVERDUE

---

## 9. Inventory

Inventory is movement-based.

The system must maintain a complete stock movement history.

Stock movements may include:

- PURCHASE_RECEIPT
- SALE
- CUSTOMER_RETURN
- SUPPLIER_RETURN
- ADJUSTMENT
- RESERVATION
- RESERVATION_RELEASE

Never silently change stock.

---

## 10. Point of Sale

The POS is a critical module.

It supports:

- Product search
- SKU search
- IMEI search
- Serial number search
- Cart
- Customer selection
- Discounts
- Payments
- Installment sales
- Receipt generation
- Offline operation

The MVP does NOT require barcode scanning.

Manual search is sufficient.

---

## 11. Offline POS

The POS must continue to operate during temporary network interruptions.

Offline capabilities should primarily cover:

- Product lookup
- Customer lookup
- Creating sales
- Serialized product selection
- Installment sales
- Local transaction persistence
- Synchronization

The backend remains the source of truth.

Offline transactions must use unique identifiers and idempotent synchronization.

---

## 12. Discounts

Discounts are supported.

Discounts must be permission-controlled.

Different roles may have different maximum discount limits.

Discount validation must happen on the backend.

Frontend-only validation is never sufficient.

---

## 13. Returns and Warranty

The application supports:

- Customer returns
- Refunds
- Exchanges
- Warranty lookup
- Warranty status

Serialized devices must remain traceable throughout:

PURCHASE
→ INVENTORY
→ SALE
→ CUSTOMER
→ WARRANTY
→ RETURN

---

## 14. Receipts

The MVP supports:

- Printable receipts
- PDF receipts

Receipts must contain relevant sale information.

For serialized products, receipts should include:

- IMEI
- Serial number
- Warranty information

---

## 15. Dashboard

The dashboard should provide:

- Today's revenue
- Monthly revenue
- Number of sales
- Estimated gross margin
- Average basket
- Top-selling products
- Low-stock products
- Payment method distribution
- Outstanding customer credit
- Recent sales
- Salesperson performance where authorized

---

## 16. Security

Security is a first-class concern.

The application must implement:

- Authentication
- Authorization
- RBAC
- Backend permission enforcement
- Secure password handling
- Secure sessions
- Input validation
- Audit logging
- Rate limiting where appropriate

Sensitive operations must be auditable.

---

## 17. Architecture Principles

The application must prioritize:

- Maintainability
- Security
- Reliability
- Data integrity
- Testability
- Simplicity
- Clear domain boundaries

Avoid unnecessary complexity.

Avoid premature abstractions.

Avoid implementing future SaaS requirements before they are needed.

---

## 18. Important Development Principle

Never implement the entire application in a single step.

Development must be incremental.

Each feature should be:

1. Understood
2. Planned
3. Implemented
4. Tested
5. Reviewed
6. Corrected
7. Documented where necessary

Existing functionality must not be broken unnecessarily.

---

## 19. Source of Truth

For business-critical data:

Backend + PostgreSQL are the authoritative source of truth.

The frontend must not become the authoritative source for:

- Inventory
- Financial transactions
- Permissions
- Discounts
- Refunds
- Customer balances
- Sales

Offline local data is a temporary operational cache/queue.

---

## 20. Naming

Internal code should generally use English identifiers.

Examples:

- `Product`
- `Sale`
- `Customer`
- `Supplier`
- `StockMovement`
- `Payment`

User-facing text should be French.

Examples:

- Produit
- Vente
- Client
- Fournisseur
- Mouvement de stock
- Paiement
