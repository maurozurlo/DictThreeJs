// @vitest-environment jsdom
//
// Render-time regression guard for the Zustand selector footgun.
//
// A `useGameStore` selector that returns a FRESH OBJECT LITERAL on every call
// (e.g. `useGameStore(s => ({ military: ..., business: ... }))`) breaks React's
// useSyncExternalStore: the new reference never passes the Object.is snapshot
// check, so React re-renders forever and throws "Maximum update depth exceeded".
//
// This bug lives entirely in the React reactivity layer — pure-function/handler
// unit tests cannot reach it. These tests MOUNT the store-connected screens so
// the infinite loop surfaces as a thrown error and fails the suite.
//
// If you reintroduce an object-returning selector in any component below, the
// corresponding "mounts without an infinite render loop" test will fail.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useGameStore } from '../../../src/Stores/GameState'
import DayEnded from '../../../src/components/DayEnded/DayEnded'
import EndScreen from '../../../src/components/EndScreen/EndScreen'
import { renderWithProviders, resetStore } from '../../helpers/renderComponent'

afterEach(() => {
    cleanup()
    resetStore()
})

describe('DayEnded — store selector reactivity', () => {
    it('mounts without an infinite render loop when the month-ended modal is shown', () => {
        // dayEnded + phase 'start' make the modal render its full subtree, so the
        // relation selectors at the top of the component actually execute.
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, dayEnded: true, phase: 'start' },
        }))

        expect(() => renderWithProviders(<DayEnded />)).not.toThrow()
    })

    it('renders the modal content (a Continue button) once shown', () => {
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, dayEnded: true, phase: 'start' },
        }))

        const { container } = renderWithProviders(<DayEnded />)
        // The Continue/Finish button is the modal's primary control.
        expect(container.querySelectorAll('button').length).toBeGreaterThan(0)
    })
})

describe('EndScreen — store selector reactivity', () => {
    it('mounts without an infinite render loop on a lose result', () => {
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, phase: 'lose', endCause: 'military' },
        }))

        expect(() => renderWithProviders(<EndScreen />)).not.toThrow()
    })

    it('mounts without an infinite render loop on a victory result', () => {
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, phase: 'victory' },
        }))

        expect(() => renderWithProviders(<EndScreen />)).not.toThrow()
    })
})
