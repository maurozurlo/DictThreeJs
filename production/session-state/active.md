# Session State

## Session Extract — /architecture-review 2026-06-10
- Verdict: CONCERNS
- Requirements: 20 total — 13 covered, 4 partial, 3 gaps
- New TR-IDs registered: 20 (platform, save, state, budget, relations, charisma, meet, rng, events, timer, scene)
- GDD revision flags: None
- Top ADR gaps: RNG & Determinism Strategy, Event Scheduling System, Round Timer & Game Loop
- Report: docs/architecture/architecture-review-2026-06-10.md

## Session Extract — /test-setup 2026-06-10
- Stack: web (Vitest already configured) — NOT Godot despite template config
- Existing: 5 colocated *.test.ts suites in src/ (85 tests, all passing)
- Fixed: removed coverage.enabled:true from vite.config.ts (was breaking full `vitest run` → "No test suite found")
- Created: .github/workflows/tests.yml (Vitest CI on push/PR to master)
- Verified: `npx vitest run --coverage` → 5 passed, 85 tests, 72.8% coverage
- Note: test convention is colocated src/*.test.ts, not tests/unit|integration (src/CLAUDE.md doc is stale)
