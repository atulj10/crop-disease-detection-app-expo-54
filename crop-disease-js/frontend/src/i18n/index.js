import { I18n } from 'i18n-js';
import en from './translations/en';
import es from './translations/es';
import fr from './translations/fr';
import zh from './translations/zh';
import ja from './translations/ja';
import ko from './translations/ko';
import hi from './translations/hi';

const i18n = new I18n({
  en,
  es,
  fr,
  zh,
  ja,
  ko,
  hi,
});

i18n.defaultLocale = 'en';
i18n.locale = 'en';
i18n.enableFallback = true;

export default i18n;
