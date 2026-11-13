// @vitest-environment jsdom
//
// Street inspector sidebar: renders the right card for the street selection, with the
// real `street` copy, and mounts without the Zustand object-selector render loop.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18n from 'i18next'
import enStreet from '../../../src/../public/locales/en/street.json'
import { useGameStore } from '../../../src/Stores/GameState'
import StreetInspector from '../../../src/components/Tabs/StreetInspector'
import { variantIndex } from '../../../src/Utils/StreetInspect'
import { resetStore } from '../../helpers/renderComponent'

const streetI18n = i18n.createInstance()
streetI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['menu', 'street'],
    defaultNS: 'menu',
    resources: { en: { street: enStreet } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
})

const renderInspector = () => render(<I18nextProvider i18n={streetI18n}><StreetInspector /></I18nextProvider>)

afterEach(() => {
    cleanup()
    resetStore()
})

describe('StreetInspector', () => {
    it('test_no_selection_shows_the_hint', () => {
        renderInspector()
        expect(screen.getByText(enStreet.inspector.idle)).toBeTruthy()
    })

    it('test_rich_bench_shows_its_instance_title_rows_and_infrastructure_line', () => {
        const instanceId = 19
        useGameStore.setState((s) => ({
            budget: { ...s.budget, expenditures: { ...s.budget.expenditures, infrastructure: 9 } },
            scene: { ...s.scene, selection: { kind: 'prop', instanceId, modelName: 'env_parkbench_rich' } },
        }))
        expect(() => renderInspector()).not.toThrow()

        const card = enStreet.props.bench.rich
        expect(screen.getByText(card.titles[variantIndex(instanceId, card.titles.length)])).toBeTruthy()
        for (const label of enStreet.props.bench.labels) expect(screen.getByText(label)).toBeTruthy()
        for (const value of card.values) expect(screen.getByText(value)).toBeTruthy()
        expect(screen.getByText(/^Infrastructure 9\/10\./)).toBeTruthy()
    })

    it('test_statue_shows_its_plaque_legend', () => {
        useGameStore.setState((s) => ({
            scene: { ...s.scene, selection: { kind: 'prop', instanceId: 125, modelName: 'env_statue_gold' } },
        }))
        renderInspector()
        expect(screen.getByText(enStreet.props.statue.gold.legend)).toBeTruthy()
        expect(screen.getByText(enStreet.inspector.legend)).toBeTruthy()
    })

    it('test_unknown_model_renders_nothing', () => {
        useGameStore.setState((s) => ({
            scene: { ...s.scene, selection: { kind: 'prop', instanceId: 8, modelName: 'env_roads' } },
        }))
        const { container } = renderInspector()
        expect(container.querySelector('[data-testid="prop-inspector"]')).toBeNull()
    })
})
