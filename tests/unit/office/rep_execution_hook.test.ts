// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRepExecutions } from '../../../src/Hooks/useRepExecutions';
import type { RepStatuses } from '../../../src/Utils/RepExecution';

const ALL_ACTIVE: RepStatuses = { people: 'active', business: 'active', military: 'active' };
const NOW = 5000;

afterEach(() => vi.restoreAllMocks());

function setup(roomVisible = true) {
    vi.spyOn(performance, 'now').mockReturnValue(NOW);
    return renderHook(
        ({ statuses, visible }) => useRepExecutions(statuses, visible),
        { initialProps: { statuses: ALL_ACTIVE, visible: roomVisible } },
    );
}

describe('useRepExecutions', () => {
    it('test_rep_execution_hook_no_runs_on_mount', () => {
        const { result } = setup();
        expect(result.current.runs).toEqual({});
    });

    it('test_rep_execution_hook_elimination_in_room_starts_run_in_same_render', () => {
        const { result, rerender } = setup();
        rerender({ statuses: { ...ALL_ACTIVE, people: 'eliminated' }, visible: true });
        expect(result.current.runs).toEqual({ people: NOW });
    });

    it('test_rep_execution_hook_finish_execution_ends_run', () => {
        const { result, rerender } = setup();
        rerender({ statuses: { ...ALL_ACTIVE, people: 'eliminated' }, visible: true });
        act(() => result.current.finishExecution('people'));
        expect(result.current.runs).toEqual({});
    });

    it('test_rep_execution_hook_leaving_room_abandons_runs', () => {
        const { result, rerender } = setup();
        const eliminated: RepStatuses = { ...ALL_ACTIVE, military: 'eliminated' };
        rerender({ statuses: eliminated, visible: true });
        rerender({ statuses: eliminated, visible: false });
        expect(result.current.runs).toEqual({});
        rerender({ statuses: eliminated, visible: true });
        expect(result.current.runs).toEqual({});
    });

    it('test_rep_execution_hook_elimination_off_screen_is_not_replayed', () => {
        const { result, rerender } = setup(false);
        rerender({ statuses: { ...ALL_ACTIVE, business: 'eliminated' }, visible: false });
        rerender({ statuses: { ...ALL_ACTIVE, business: 'eliminated' }, visible: true });
        expect(result.current.runs).toEqual({});
    });
});
