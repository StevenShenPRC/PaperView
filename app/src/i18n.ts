import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            'zh-CN': {
                translation: zhCN
            },
            'zh': {
                translation: zhCN
            },
            'en': {
                translation: enUS
            },
            'en-US': {
                translation: enUS
            }
        },
        lng: 'zh-CN', // Default language
        fallbackLng: 'zh-CN',
        interpolation: {
            escapeValue: false // React already safes from xss
        }
    });

export default i18n;
