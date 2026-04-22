# Implementation Plan

- [ ] 1. Install i18n dependencies and create translation files
  - Run `npm install i18next react-i18next i18next-browser-languagedetector` in the `frontend` directory
  - Create `frontend/src/i18n/en.json` with all required English translation keys (Requirements 3.1)
  - Create `frontend/src/i18n/am.json` with the same key set translated into Amharic (Requirements 3.2)
  - _Requirements: 2.2, 3.1, 3.2_

- [ ] 2. Create i18n configuration and wire into the app
  - Create `frontend/src/i18n/i18n.js` initialising i18next with LanguageDetector, both translation resources, `fallbackLng: 'en'`, and localStorage detection (Requirements 2.1, 2.3)
  - Import `./i18n/i18n.js` at the top of `frontend/src/main.jsx` before the React render call (Requirements 2.5)
  - _Requirements: 2.1, 2.3, 2.5_

- [ ] 2.1 Write property test — P6: Translation files have identical key sets
  - **Property 6: en.json and am.json have identical key sets**
  - **Validates: Requirements 3.2, 3.3**

- [ ] 2.2 Write property test — P4: t(key) returns the correct translation for the active locale
  - **Property 4: For any key in the active locale's JSON, t(key) returns the exact JSON value**
  - **Validates: Requirements 1.5**

- [ ] 2.3 Write property test — P5: Fallback to English for missing keys
  - **Property 5: For any key missing from am.json, t(key) in Amharic returns the English value**
  - **Validates: Requirements 2.4**

- [ ] 2.4 Write unit tests for i18n initialisation
  - Assert both `"en"` and `"am"` resources are loaded after init (Requirements 2.2)
  - Assert `i18n.options.fallbackLng` equals `"en"` (Requirements 2.3)
  - Assert `en.json` contains the required minimum key set (Requirements 3.1)
  - _Requirements: 2.2, 2.3, 3.1_

- [ ] 3. Add LanguageSwitcher to AASTUHeader
  - Read `frontend/src/components/AASTUHeader.jsx` to understand its current structure
  - Add `useTranslation` import and render two buttons ("English" / "አማርኛ") that call `i18n.changeLanguage("en")` and `i18n.changeLanguage("am")` respectively (Requirements 4.1, 4.4)
  - Apply an active/highlighted style to the button matching `i18n.language` (Requirements 4.2, 4.3)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 3.1 Write property test — P2: Language button changes active locale
  - **Property 2: For any locale button, clicking it sets i18n.language to the correct code**
  - **Validates: Requirements 1.2, 1.3**

- [ ] 3.2 Write property test — P7: Active-language button has active style
  - **Property 7: The button matching the active locale has the active style; the other does not**
  - **Validates: Requirements 4.2, 4.3**

- [ ] 3.3 Write property test — P8: Clicking a language button calls changeLanguage with the correct locale
  - **Property 8: Clicking any language button invokes changeLanguage with the matching locale**
  - **Validates: Requirements 4.4**

- [ ] 3.4 Write unit test — LanguageSwitcher renders both buttons
  - Render AASTUHeader and assert both "English" and "አማርኛ" buttons are present in the DOM (Requirements 4.1)
  - _Requirements: 4.1_

- [ ] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Translate auth pages
  - Update `Login.jsx`: add `useTranslation`, replace all hardcoded strings with `t()` calls (Requirements 5.1)
  - Update `Register.jsx`: add `useTranslation`, replace all hardcoded strings with `t()` calls (Requirements 5.2)
  - Update `ForgotPassword.jsx`: add `useTranslation`, replace all hardcoded strings with `t()` calls (Requirements 5.3)
  - Update `VerifyEmail.jsx`: add `useTranslation`, replace all hardcoded strings with `t()` calls (Requirements 5.4)
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Translate dashboard pages
  - Update `StudentDashboard.jsx`: add `useTranslation`, replace all hardcoded UI strings with `t()` calls (Requirements 5.5)
  - Update `GuardDashboard.jsx`: add `useTranslation`, replace all hardcoded UI strings with `t()` calls (Requirements 5.6)
  - Update `AdminDashboard.jsx`: add `useTranslation`, replace all hardcoded UI strings with `t()` calls (Requirements 5.7)
  - _Requirements: 5.5, 5.6, 5.7_

- [ ] 6.1 Write property test — P1: Language persistence on load
  - **Property 1: For any locale stored in localStorage, i18n resolves to that locale on init**
  - **Validates: Requirements 1.1**

- [ ] 6.2 Write property test — P3: Language selection persists to localStorage
  - **Property 3: For any locale, changeLanguage persists it to localStorage["i18nextLng"]**
  - **Validates: Requirements 1.4**

- [ ] 7. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.
