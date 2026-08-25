# R-001: Extract shared persistent-collection abstraction

- **Status:** Open
- **Priority:** Medium
- **Category:** Refactoring
- **Branch:** `refactor/persistent-collection`

## Source

- `src/main/services/download/download-manager.ts:81-115`
- `src/main/services/conversion/conversion-manager.ts:41-76`
- `src/main/services/history/inspection-history-manager.ts:45-88`

## Problem

Three near-identical implementations of `ensureLoaded` + memoized load promise + serialized `persistChain`, with inconsistent error policies (silent swallow vs log vs throw) and rollback logic in only some paths. Any persistence fix (e.g., B-005 atomic writes) must be applied three times.

## Approach

- Introduce a `PersistentCollection<T>` helper owning: lazy load, memoized load promise, serialized writes, and one error policy.
- Migrate the three managers onto it; keep their public APIs unchanged.
- Land after or together with B-005 so atomic writes are built in once.

## Acceptance Criteria

- [ ] Single implementation of load/persist lifecycle used by all three managers.
- [ ] Behavior-preserving; existing manager tests pass unmodified (or with minimal updates).
