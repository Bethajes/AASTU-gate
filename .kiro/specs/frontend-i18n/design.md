# Design Document — Frontend Internationalization (i18n)

## Overview

This design adds bilingual support (English / Amharic) to the AASTU Laptop Gate Management System React frontend using the industry-standard `i18next` + `react-i18next` stack. The approach is purely additive: no existing component logic changes, only UI strings are replaced with `t()` calls, and a small language-switcher UI is added to the shared header.

---

## Architecture

```
frontend/src/
├── i18n/
│   ├── i18n.js        ← i18next initialisation (new)
│   ├── en.json        ← English translation keys (new)
│   └── am.json        ← Amharic translation keys (new)
├── main.jsx           ← imports i18n.js before React renders (modified)
├── components/
│   └── AASTUHeader.jsx ← adds LanguageSwitcher (modified)
└── pages/
    ├── Login.jsx           ← uses t() (modified)
    ├── Register.jsx        ← uses t() (modified)
    ├── ForgotPassword.jsx  ← uses t() (modified)
    ├── VerifyEmail.jsx     ← uses t() (modified)
    ├── StudentDashboard.jsx ← uses t() (modified)
    ├── GuardDashboard.jsx  ← uses t() (modified)
    └── AdminDashboard.jsx  ← uses t() (modified)
```

**Data flow:**

```
localStorage ("i18nextLng")
        │
        ▼
  i18next init (i18n.js)
        │
        ▼
  I18nextProvider (via react-i18next)
        │
        ▼
  useTranslation() hook in every component
        │
        ▼
  t("key") → locale string rendered in DOM
```

Language changes propagate reactively: calling `i18n.changeLanguage("am")` triggers a re-render of every component that uses `useTranslation`, updating all strings instantly.

---

## Components and Interfaces

### i18n.js (new)

Initialises i18next once at app startup.

```js
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './en.json'
import am from './am.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, am: { translation: am } },
    fallbackLng: 'en',
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    interpolation: { escapeValue: false },
  })

export default i18n
```

### LanguageSwitcher (inline in AASTUHeader)

A small inline component that reads `i18n.language` and renders two styled buttons. Clicking a button calls `i18n.changeLanguage(locale)`.

```jsx
const { i18n } = useTranslation()
// active locale: i18n.language
// switch: i18n.changeLanguage('en') / i18n.changeLanguage('am')
```

### Component translation pattern

Every component that renders UI text adds:

```jsx
const { t } = useTranslation()
// then replaces "Login" with t('login'), etc.
```

---

## Data Models

### Translation file schema

Both `en.json` and `am.json` are flat JSON objects with string keys and string values:

```ts
type TranslationFile = Record<string, string>
```

Example:
```json
{
  "login": "Login",
  "email": "Email"
}
```

The key set must be identical in both files. Missing keys fall back to English via i18next's `fallbackLng` setting.

### localStorage persistence

i18next-browser-languagedetector writes the selected locale to `localStorage["i18nextLng"]` automatically when `i18n.changeLanguage()` is called. No manual localStorage code is needed.

---


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

Property 1: Language persistence on load
*For any* locale string stored in `localStorage["i18nextLng"]`, when the i18n module initialises, the resolved language must equal that stored locale.
**Validates: Requirements 1.1**

---

Property 2: Language button changes active locale
*For any* locale button rendered in the LanguageSwitcher (English → `"en"`, አማርኛ → `"am"`), clicking that button must result in `i18n.language` equalling the corresponding locale code.
**Validates: Requirements 1.2, 1.3**

---

Property 3: Language selection persists to localStorage
*For any* locale code passed to `i18n.changeLanguage`, the value stored at `localStorage["i18nextLng"]` must equal that locale code after the call completes.
**Validates: Requirements 1.4**

---

Property 4: t(key) returns the correct translation for the active locale
*For any* translation key present in the active locale's translation file, calling `t(key)` must return the exact string value defined for that key in the corresponding JSON file.
**Validates: Requirements 1.5**

---

Property 5: Fallback to English for missing keys
*For any* key that exists in `en.json` but is absent from `am.json`, calling `t(key)` while the active locale is Amharic must return the English string for that key.
**Validates: Requirements 2.4**

---

Property 6: Translation files have identical key sets
*For any* key present in `en.json`, that same key must also be present in `am.json`, and vice versa — the two files must have exactly the same set of keys.
**Validates: Requirements 3.2, 3.3**

---

Property 7: Active-language button has active style
*For any* active locale (`"en"` or `"am"`), the language button corresponding to that locale must have the active visual style applied, and the other button must not.
**Validates: Requirements 4.2, 4.3**

---

Property 8: Clicking a language button calls changeLanguage with the correct locale
*For any* language button in the LanguageSwitcher, clicking it must invoke `i18n.changeLanguage` with the locale code that corresponds to that button (`"en"` or `"am"`).
**Validates: Requirements 4.4**

---

## Error Handling

- **Missing translation key**: i18next returns the key string itself as a last resort. The `fallbackLng: 'en'` setting ensures the English value is shown before falling back to the raw key.
- **Corrupt localStorage value**: If `localStorage["i18nextLng"]` contains an unrecognised locale, i18next falls back to `"en"` automatically.
- **i18n not yet initialised**: `i18next.init()` is synchronous when resources are bundled inline (no HTTP fetch), so the app will never render before translations are ready.

---

## Testing Strategy

### Property-Based Testing Library

**fast-check** (`npm install --save-dev fast-check`) is used for property-based testing. It integrates cleanly with Vitest (already configured in the project) and supports arbitrary generators for strings, objects, and arrays.

Each property-based test runs a minimum of **100 iterations**.

Every property-based test is annotated with a comment in the format:
`// Feature: frontend-i18n, Property N: <property text>`

### Unit Tests

Unit tests cover:
- Rendering the LanguageSwitcher and asserting both buttons are present (Requirement 4.1).
- Asserting `en.json` contains the required minimum key set (Requirement 3.1).
- Asserting i18n initialises with `"en"` as the default and fallback language (Requirements 2.2, 2.3).

### Property-Based Tests

| Property | Test description |
|---|---|
| P1 | For any locale stored in localStorage, i18n resolves to that locale on init |
| P2 | For any locale button, clicking it sets i18n.language to the correct code |
| P3 | For any locale, changeLanguage persists it to localStorage |
| P4 | For any key in the active locale's JSON, t(key) returns the exact JSON value |
| P5 | For any key missing from am.json, t(key) in Amharic returns the English value |
| P6 | en.json and am.json have identical key sets |
| P7 | The button matching the active locale has the active style; the other does not |
| P8 | Clicking any language button calls changeLanguage with the matching locale |

### Test file locations

```
frontend/src/i18n/i18n.test.js          ← P1, P3, P4, P5, P6 + unit tests for 2.2/2.3/3.1
frontend/src/components/LanguageSwitcher.test.jsx  ← P2, P7, P8 + unit test for 4.1
```
