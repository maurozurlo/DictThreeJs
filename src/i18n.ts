import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        debug: false,
        ns: ['menu'],
        defaultNS: 'menu',
        backend: {
            // served from public folder
            loadPath: '/locales/{{lng}}/{{ns}}.json'
        },
        interpolation: { escapeValue: false },
        react: { useSuspense: true }
    });

export default i18n;