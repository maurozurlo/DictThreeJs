# Story 4-2: Configure Performance Budgets in technical-preferences.md

## Header
- **Story ID**: 4-2
- **Sprint**: 4
- **Status**: Complete
- **Type**: Config/Data
- **Layer**: Foundation
- **TR-ID**: N/A
- **Governing ADR**: ADR-0001
- **Manifest Version**: 2026-06-13
- **Estimate**: 0.25 days
- **Last Updated**: 2026-06-13

## Summary

`.claude/docs/technical-preferences.md` was entirely unconfigured (all `[TO BE CONFIGURED]` placeholders). This story populates it with real values for the React/TypeScript/Zustand stack: engine, language, input, naming conventions, performance budgets, testing framework, forbidden patterns, allowed libraries, and engine specialist routing.

The Performance Budgets section specifically:
- Target framerate: 60 fps
- Frame budget: 16.7 ms
- JS round-resolution budget: ≤ 5 ms
- Draw calls: < 100 per frame
- JS heap ceiling: 150 MB
- Initial bundle size: < 500 KB gzipped

## Acceptance Criteria

- [x] `Performance Budgets` section in `.claude/docs/technical-preferences.md` has numeric values (not placeholders)
- [x] Target framerate defined
- [x] Frame budget in ms defined
- [x] JS heap ceiling in MB defined
- [x] Engine & Language, Input & Platform, Naming Conventions, Testing, Forbidden Patterns, Engine Specialists sections all populated

## Completion Notes
- Completed: 2026-06-13
- Full file populated — engine (React/R3F/Vite), language (TypeScript strict), platform (Web browser), input (Mouse+Keyboard), all naming conventions, performance budgets (60fps / 16.7ms / 150MB heap / <100 draw calls / <500KB bundle), testing (Vitest + RTL), forbidden patterns from ADRs 0001–0006, allowed libraries, ADR log, specialist routing table.
