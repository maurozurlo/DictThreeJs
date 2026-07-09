import type { ReactElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18n from 'i18next'
import { useGameStore } from '../../src/Stores/GameState'

/**
 * Test-only i18n instance. No HTTP backend and no Suspense, so components that
 * call `useTranslation()` render synchronously and offline. Resources are empty
 * by design — `t('some.key')` returns the key, which is enough for render/
 * reactivity tests that assert structure rather than translated copy.
 */
const testI18n = i18n.createInstance()
testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['menu', 'laws', 'deals', 'meet', 'daily_events', 'shop', 'endscreen', 'periodic_events', 'mini_challenges', 'secret', 'help', 'tutorial', 'advisor'],
    defaultNS: 'menu',
    resources: {},
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
})

/** The pristine store state captured once, before any test mutates it. */
const INITIAL_STORE_STATE = useGameStore.getState()

/**
 * Restore the Zustand store to its initial state. The store is a module
 * singleton shared across tests, so call this in `afterEach` to keep render
 * tests isolated. Safe because every store mutation produces new nested
 * objects (ADR-0002), leaving the captured initial slices untouched.
 */
export function resetStore(): void {
    useGameStore.setState(INITIAL_STORE_STATE, true)
}

/** Render a component tree wrapped in the offline test i18n provider. */
export function renderWithProviders(ui: ReactElement): RenderResult {
    return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>)
}

