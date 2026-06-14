# Web Stack — Version Reference

> **Note**: This project uses React + Vite + Three.js — NOT Godot.
> This file path (`engine-reference/godot/VERSION.md`) is a leftover from
> the project template and has been repurposed. Do not apply any Godot API
> suggestions. The actual stack is in `.claude/docs/technical-preferences.md`.

| Field | Value |
|-------|-------|
| **Framework** | React 19 |
| **Language** | TypeScript (strict) |
| **Renderer** | Three.js via `@react-three/fiber` + `@react-three/drei` |
| **State** | Zustand |
| **Build tool** | Vite |
| **Test runner** | Vitest + React Testing Library |
| **Pinned** | 2026-06-14 |

## Knowledge Notes

- React 19 (stable, 2024): concurrent features, new `use()` hook, Actions API.
  LLM training data covers this fully — no post-cutoff risk.
- `@react-three/fiber` v8+: standard R3F patterns in use. No post-cutoff API risk.
- Three.js r168+: standard material/geometry APIs. No known gaps.
- Zustand v5: `create()` API in use. No post-cutoff risk.

## Authoritative References

- Stack ADRs: `docs/architecture/adr-0001-tech-stack-choice.md`
- Naming conventions / patterns: `.claude/docs/technical-preferences.md`
- Architecture overview: `docs/architecture/architecture-review-2026-06-10.md`
