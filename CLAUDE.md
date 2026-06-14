# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Technology Stack

- **Platform**: Web (browser) — React 19 + TypeScript (strict)
- **Rendering**: Three.js via `@react-three/fiber` + `@react-three/drei`
- **State**: Zustand (Handler pattern — see ADR-0002)
- **Build**: Vite
- **Tests**: Vitest + React Testing Library
- **Version Control**: Git with trunk-based development
- **i18n**: i18next multi-namespace (EN + ES)

> **This is a web app, not a game-engine project.** Do not apply Godot/Unity/Unreal
> patterns. See `.claude/docs/technical-preferences.md` for naming conventions,
> forbidden patterns, and file-extension routing.

## Project Structure

@.claude/docs/directory-structure.md

## Engine Version Reference

@docs/engine-reference/godot/VERSION.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md
