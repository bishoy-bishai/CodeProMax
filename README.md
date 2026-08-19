# Code Pro Max — Schema Layer

> **Phase 0.1 — Core Data Schemas**
> Production-grade TypeScript + Zod schemas for the engineering improvement discovery skill.

---

## Overview

The schema layer is the single source of truth for all data structures in Code Pro Max.
Every entity is defined three times:

| Layer | File | Purpose |
|---|---|---|
| Static types | `src/schemas/types.ts` | TypeScript interfaces + branded types |
| Runtime validators | `src/schemas/schemas.ts` | Zod schemas + cross-field refinements |
| Utilities | `src/schemas/validators.ts` | Type guards, parsers, serializers, deserializers |
| Lifecycle engine | `src/schemas/state-machine.ts` | State transitions + guard checks |

---

## Quick Start

```bash
npm install
npm test          # run all 41 tests
npm run typecheck # zero TypeScript errors
```

---

## Core Entities

### Initiative

The top-level unit of engineering improvement work.

```typescript
import { parseInitiative, serializeInitiative } from './src/schemas/validators.ts';

// Parse unknown input (throws ValidationError on failure)
const initiative = parseInitiative(rawJson);

// Serialize to plain JSON-safe object
const json = serializeInitiative(initiative);
```

**ID format:** `INIT-001`, `INIT-042`, etc. (regex: `/^INIT-\d{3,}$/`)

**Slug format:** lowercase kebab-case outcome statement — e.g. `eliminate-n-plus-1-queries`

**Status lifecycle:**
```
Proposed → Selected → Planned → In Progress → Released → Validated → Completed
```
Rollback transitions (`In Progress → Planned`, `Released → In Progress`) are also defined with explicit conditions.

---

### Finding

A discrete, evidence-backed observation about the codebase.

```typescript
import { parseFinding, isFinding } from './src/schemas/validators.ts';

// Type guard (never throws)
if (isFinding(value)) {
  // value is Finding here
}

// Validated parse (throws ValidationError)
const finding = parseFinding(rawJson);
```

**ID format:** `FIND-001`

**Classification:** `FACT | INFERENCE | HYPOTHESIS | UNKNOWN`

**Confidence:** integer `1–5` (1 = speculation, 5 = multiple corroborating sources)

**Evidence:** non-empty array required — a finding with zero evidence is speculation, not a finding.

---

### Evidence Record

An atomic piece of supporting data.

```typescript
import type { EvidenceRecord } from './src/schemas/types.ts';

const evidence: EvidenceRecord = {
  source: 'src/api/products.ts',
  type: 'code',
  location: { file: 'src/api/products.ts', line: 42, functionName: 'getProducts', symbol: null },
  content: 'SELECT * executed inside a loop — N+1 pattern detected',
  timestamp: new Date().toISOString(),
  validated: true,
  validatedAt: new Date().toISOString(), // required when validated=true
};
```

**Evidence types:** `code | test | git | config | runtime | dependency | documentation`

**Validation invariant:** If `validated: true`, then `validatedAt` must be a non-null ISO-8601 timestamp.

---

### Scoring Result

```typescript
import type { ScoringResult } from './src/schemas/types.ts';

// Formula:
// finalScore = round((impact + confidence + urgency + leverage + (6-cost) + (6-risk)) / 30 * 100)
```

**Axes (each 1–5):**

| Axis | High score means |
|---|---|
| `impact` | Large business/user impact if solved |
| `confidence` | Strong evidence the problem is real |
| `urgency` | High cost of delay |
| `leverage` | Fixing this unlocks other wins |
| `cost` | Low implementation cost (inverted) |
| `risk` | Low execution risk (inverted) |

**Cross-field validation:** The Zod schema recomputes `finalScore` from the breakdown at parse time and rejects any value that diverges by more than ±1 (rounding tolerance). You cannot submit a misleading score.

---

### Initiative Register

```typescript
import { parseInitiativeRegister, filterInitiatives, recomputeStats } from './src/schemas/validators.ts';

const register = parseInitiativeRegister(rawJson);

// Filter and sort
const proposed = filterInitiatives(register, { status: 'Proposed' }, 'finalScore', 'desc');

// Recompute stats after mutation
const newStats = recomputeStats(updatedInitiatives);
```

**Invariants enforced at parse time:**
- `stats.total === initiatives.length`
- Sum of all `byStatus` values equals `stats.total`

---

## State Machine

### Valid Transitions

| From | To | Key conditions |
|---|---|---|
| Proposed | Selected | Evidence non-empty, scoring complete, owner set |
| Selected | Planned | Success criteria defined, non-scope defined, no open blockers |
| Planned | In Progress | Owner assigned, no open blockers |
| In Progress | Released | All blockers closed/mitigated |
| Released | Validated | All success criteria have measured outcomes |
| Validated | Completed | All open questions answered, retrospective linked |
| In Progress | Planned | Rollback — reason documented |
| Released | In Progress | Rollback — critical issue discovered |

### Performing a transition

```typescript
import { transition } from './src/schemas/state-machine.ts';
import { ValidationError } from './src/schemas/types.ts';

try {
  const updated = transition(initiative, 'Selected');
  // updated is a new Initiative object with status='Selected' and fresh updatedAt
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(err.details); // structured: field, expected, received, suggestion
  }
}
```

`transition()` is **pure** — it returns a new `Initiative` and never mutates the input.

### Checking reachable states

```typescript
import { getReachableStatuses, isTerminalStatus } from './src/schemas/state-machine.ts';

getReachableStatuses('Proposed');   // ['Selected']
getReachableStatuses('Completed');  // []
isTerminalStatus('Completed');      // true
```

---

## Error Handling

All parse functions throw `ValidationError` (never a raw Zod error).

```typescript
import { ValidationError } from './src/schemas/types.ts';

try {
  parseInitiative(bad);
} catch (err) {
  if (err instanceof ValidationError) {
    for (const detail of err.details) {
      console.log(detail.field);      // e.g. "scoring.finalScore"
      console.log(detail.expected);   // e.g. "integer 0-100"
      console.log(detail.received);   // actual value
      console.log(detail.suggestion); // corrective hint or null
    }
  }
}
```

---

## Type Safety

### Zero `any`

Every value is typed. `unknown` is used for genuinely opaque inputs (e.g. `JSON.parse` output).

### Exhaustiveness checking

```typescript
import { assertNever } from './src/schemas/types.ts';

function describeStatus(s: InitiativeStatus): string {
  switch (s) {
    case 'Proposed':    return 'Awaiting evaluation';
    case 'Selected':    return 'Chosen for planning';
    case 'Planned':     return 'Ready for development';
    case 'In Progress': return 'Active work';
    case 'Released':    return 'Shipped, validating';
    case 'Validated':   return 'Outcomes confirmed';
    case 'Completed':   return 'Done';
    default:            return assertNever(s); // TypeScript error if a case is missing
  }
}
```

### Explicit nullability

All optional fields use `field: T | null` (explicit null) rather than `field?: T` (implicit undefined).
`tsconfig.json` has `exactOptionalPropertyTypes: true` to enforce this.

---

## Test Suite

```bash
npm test
# ✓ src/schemas/__tests__/schemas.test.ts (41 tests) 10ms
# Test Files  1 passed (1)
# Tests       41 passed (41)
```

| Suite | Count |
|---|---|
| EvidenceRecord | 7 |
| ScoringResult | 5 |
| Finding | 6 |
| Initiative | 6 |
| InitiativeRegister | 3 |
| StateMachine | 7 |
| filterInitiatives | 3 |
| recomputeStats | 2 |
| **Total** | **41** |

---

## Phase 0.1 — Definition of Done ✅

| Criterion | Status |
|---|---|
| Zero TypeScript errors | ✅ |
| Zero `any` types | ✅ |
| All interfaces exported | ✅ |
| All Zod schemas compile | ✅ |
| Type guards work bidirectionally | ✅ |
| State machine transitions validated | ✅ |
| All validation tests pass (41 test cases) | ✅ |
| Serialization round-trip works | ✅ |
| Error messages include field + expected + actual + suggestion | ✅ |
| JSDoc documentation on every public symbol | ✅ |
| README.md | ✅ |

---

## Next: Phase 0.2

Ready for the next phase prompt.
