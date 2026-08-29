# Development Workflow

## 1. Core Principle

Never attempt to build the entire application in one operation.

Work incrementally.

---

# 2. Before Coding

Before implementing a feature:

1. Read relevant project rules.
2. Inspect the existing code.
3. Identify dependencies.
4. Identify affected domains.
5. Identify business rules.
6. Identify database impact.
7. Identify security implications.
8. Identify tests required.

---

# 3. Planning

For non-trivial work, create a concise implementation plan before coding.

The plan should identify:

- files to create
- files to modify
- dependencies
- database changes
- API changes
- UI changes
- tests

---

# 4. Implementation

Implement the smallest coherent increment.

Do not modify unrelated modules.

---

# 5. Verification

After implementation:

1. Run type checking.
2. Run lint.
3. Run relevant tests.
4. Run broader tests when appropriate.
5. Inspect the resulting changes.

---

# 6. Review

Review for:

- business rule violations
- security issues
- data integrity
- duplicated logic
- unnecessary complexity
- missing tests
- UX inconsistencies

---

# 7. Database Changes

Database changes require:

- schema modification
- migration
- migration verification
- relevant tests

Never silently alter the database schema.

---

# 8. Feature Completion

A feature is complete when:

- requirements are satisfied
- business rules are enforced
- authorization is implemented
- UI is complete
- errors are handled
- tests exist
- existing functionality remains intact

---

# 9. Git Discipline

Prefer small logical commits.

Commit messages should describe the actual change.

Avoid mixing unrelated changes.

---

# 10. Dependency Management

Do not add a dependency unless there is a clear reason.

Before adding a dependency:

- check whether the existing stack already solves the problem
- consider maintenance
- consider security
- consider bundle/runtime impact

---

# 11. Refactoring

Do not perform large unrelated refactors while implementing a feature.

If a refactor is necessary:

1. explain why
2. isolate it
3. test it

---

# 12. Unknown Requirements

Never invent important business rules.

If a requirement is ambiguous:

- inspect existing project decisions
- infer only when safe
- otherwise document the ambiguity before implementing

Do not silently change established business decisions.

---

# 13. Cursor Behavior

When asked to implement a feature:

1. Inspect first.
2. Explain relevant assumptions.
3. Plan.
4. Implement.
5. Test.
6. Report changes.

Do not claim something works without verification.

---

# 14. No Fake Completion

Never say:

"Implemented"

if the feature is only partially implemented.

Clearly distinguish:

- implemented
- partially implemented
- blocked
- not tested

---

# 15. Production Mindset

Treat:

- money
- inventory
- IMEI
- customer credit
- refunds
- permissions

as high-integrity data.

These areas require extra caution.
