// @vitest-environment jsdom
//
// ADR-0012 hinge UI: the dwell-stage advance lives in the Navbar advance slot,
// not in a banner over the scene (it blocked the Street view). DayEnded only
// owns the blocking reveal modal; both read the App-owned `revealAcked` flag.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useGameStore } from '../../../src/Stores/GameState'
import Navbar from '../../../src/components/Navbar/Navbar'
import DayEnded from '../../../src/components/DayEnded/DayEnded'
import { Tabs } from '../../../src/types/Tabs'
import { renderWithProviders, resetStore } from '../../helpers/renderComponent'

const DWELL_ADVANCE = '>>>'

afterEach(() => {
    cleanup()
    resetStore()
})

/** Put the store on the Street tab in the given hinge state, with spied advance actions. */
function arrangeHinge(opts: { dwelling: boolean; dayEnded: boolean }) {
    const nextRound = vi.fn()
    const beginFirstWorkDay = vi.fn()
    useGameStore.setState((s) => ({
        tabs: { ...s.tabs, activeTab: Tabs.Street },
        gameManagement: {
            ...s.gameManagement,
            phase: 'start',
            round: 2,
            dwelling: opts.dwelling,
            dayEnded: opts.dayEnded,
            nextRound,
            beginFirstWorkDay,
        },
    }))
    return { nextRound, beginFirstWorkDay }
}

function renderNavbar(revealAcked: boolean) {
    return renderWithProviders(<Navbar transitionTo={() => {}} revealAcked={revealAcked} />)
}

describe('Navbar advance slot — dwell stage', () => {
    it('test_navbar_round_end_dwell_after_reveal_advance_calls_next_round', () => {
        // Arrange
        const { nextRound, beginFirstWorkDay } = arrangeHinge({ dwelling: true, dayEnded: true })
        renderNavbar(true)

        // Act
        fireEvent.click(screen.getByRole('button', { name: DWELL_ADVANCE }))

        // Assert
        expect(nextRound).toHaveBeenCalledTimes(1)
        expect(beginFirstWorkDay).not.toHaveBeenCalled()
        expect(screen.getByText('actionPanel.continue_month')).toBeTruthy()
    })

    it('test_navbar_intro_dwell_after_reveal_advance_begins_first_work_day', () => {
        // Arrange
        const { nextRound, beginFirstWorkDay } = arrangeHinge({ dwelling: true, dayEnded: false })
        renderNavbar(true)

        // Act
        fireEvent.click(screen.getByRole('button', { name: DWELL_ADVANCE }))

        // Assert
        expect(beginFirstWorkDay).toHaveBeenCalledTimes(1)
        expect(nextRound).not.toHaveBeenCalled()
        // The work-day "end round" control must not double up in the slot.
        expect(screen.queryByRole('button', { name: '>' })).toBeNull()
        expect(screen.queryByRole('button', { name: '>>' })).toBeNull()
    })

    it('test_navbar_dwell_during_reveal_no_advance_shown', () => {
        // Arrange
        arrangeHinge({ dwelling: true, dayEnded: true })

        // Act
        renderNavbar(false)

        // Assert
        expect(screen.queryByRole('button', { name: DWELL_ADVANCE })).toBeNull()
    })

    it('test_navbar_work_day_shows_round_end_request_not_dwell_advance', () => {
        // Arrange
        arrangeHinge({ dwelling: false, dayEnded: false })

        // Act
        renderNavbar(false)

        // Assert
        expect(screen.queryByRole('button', { name: DWELL_ADVANCE })).toBeNull()
        expect(screen.getByRole('button', { name: '>' })).toBeTruthy()
    })
})

describe('DayEnded — reveal stage only', () => {
    it('test_day_ended_after_reveal_renders_nothing_over_scene', () => {
        // Arrange
        arrangeHinge({ dwelling: true, dayEnded: true })

        // Act
        const { container } = renderWithProviders(<DayEnded revealAcked={true} />)

        // Assert
        expect(container.innerHTML).toBe('')
    })

    it('test_day_ended_during_reveal_renders_modal', () => {
        // Arrange
        arrangeHinge({ dwelling: true, dayEnded: true })

        // Act
        renderWithProviders(<DayEnded revealAcked={false} />)

        // Assert
        expect(screen.getByText('actionPanel.month_ended')).toBeTruthy()
    })
})
