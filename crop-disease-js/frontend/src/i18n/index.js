import { I18n } from 'i18n-js';
import en from './translations/en';
import hi from './translations/hi';
import mr from './translations/mr';
import te from './translations/te';

const i18n = new I18n({
  en,
  hi,
  mr,
  te,
});

i18n.defaultLocale = 'en';
i18n.locale = 'en';
i18n.enableFallback = true;

export default i18n;
