import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import koKR from './locales/ko-KR.json';
import frFR from './locales/fr-FR.json';
import deDE from './locales/de-DE.json';
import esES from './locales/es-ES.json';
import ruRU from './locales/ru-RU.json';
import itIT from './locales/it-IT.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            'zh-CN': { translation: zhCN },
            'zh': { translation: zhCN },
            'en': { translation: enUS },
            'en-US': { translation: enUS },
            'ja-JP': { translation: jaJP },
            'ja': { translation: jaJP },
            'ko-KR': { translation: koKR },
            'ko': { translation: koKR },
            'fr-FR': { translation: frFR },
            'fr': { translation: frFR },
            'de-DE': { translation: deDE },
            'de': { translation: deDE },
            'es-ES': { translation: esES },
            'es': { translation: esES },
            'ru-RU': { translation: ruRU },
            'ru': { translation: ruRU },
            'it-IT': { translation: itIT },
            'it': { translation: itIT }
        },
        lng: 'zh-CN', // Default language
        fallbackLng: 'zh-CN',
        interpolation: {
            escapeValue: false // React already safes from xss
        }
    });

export default i18n;
