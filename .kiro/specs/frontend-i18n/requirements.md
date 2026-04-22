# Requirements Document

## Introduction

This feature adds multi-language support (internationalization) to the AASTU Laptop Gate Management System's React frontend. The system currently displays all UI text in English only. This feature will enable users to switch between English and Amharic (አማርኛ) at runtime, with the selected language persisted across sessions. All UI text in existing components — including auth pages, dashboards, and the navbar — must be sourced from translation files rather than hardcoded strings.

## Glossary

- **i18n**: Internationalization — the process of designing software so it can be adapted to different languages without code changes.
- **i18next**: A JavaScript internationalization framework used to manage translations and language switching.
- **react-i18next**: The React binding for i18next, providing hooks and components for using translations in React.
- **i18next-browser-languagedetector**: An i18next plugin that detects the user's preferred language from the browser or localStorage.
- **Translation Key**: A string identifier (e.g., `"login"`) mapped to a locale-specific string (e.g., `"Login"` or `"ግባ"`).
- **Translation File**: A JSON file (e.g., `en.json`, `am.json`) containing key-value pairs of translation keys and their locale-specific strings.
- **Language Switcher**: A UI control (two buttons) that allows the user to change the active language.
- **Locale**: A language/region identifier — `"en"` for English, `"am"` for Amharic.
- **Fallback Language**: The locale used when a translation key is missing in the active locale.
- **Namespace**: An i18next concept for grouping translations; this feature uses a single default namespace (`translation`).
- **useTranslation**: A react-i18next hook that returns the `t` function and the `i18n` instance for use inside React components.
- **System**: The AASTU Laptop Gate Management System React frontend.
- **User**: Any person interacting with the frontend (student, guard, or admin).

---

## Requirements

### Requirement 1

**User Story:** As a user, I want to switch the UI language between English and Amharic, so that I can use the system in my preferred language.

#### Acceptance Criteria

1. WHEN the application loads, THE System SHALL display the UI in the language previously saved to localStorage, or default to English if no saved language exists.
2. WHEN a user clicks the "English" language button, THE System SHALL update all visible UI text to English immediately without a page reload.
3. WHEN a user clicks the "አማርኛ" language button, THE System SHALL update all visible UI text to Amharic immediately without a page reload.
4. WHEN a user selects a language, THE System SHALL persist the selected locale to localStorage under the key `"i18nextLng"`.
5. WHILE a language is active, THE System SHALL render every UI text string from the corresponding translation file rather than from hardcoded values in component source code.

---

### Requirement 2

**User Story:** As a developer, I want a centralized i18n configuration, so that translations are globally available and easy to extend.

#### Acceptance Criteria

1. THE System SHALL initialize i18next with `react-i18next` and `i18next-browser-languagedetector` in a dedicated configuration file at `frontend/src/i18n/i18n.js`.
2. THE System SHALL load translation resources from `frontend/src/i18n/en.json` (English) and `frontend/src/i18n/am.json` (Amharic) at initialization time.
3. THE System SHALL set English (`"en"`) as both the default language and the fallback language.
4. WHEN a translation key is missing in the active locale, THE System SHALL display the English fallback string for that key.
5. THE System SHALL import the i18n configuration module in `frontend/src/main.jsx` before the React application renders, so translations are available to all components.

---

### Requirement 3

**User Story:** As a developer, I want complete translation files for English and Amharic, so that all UI strings are covered and the system is easy to extend.

#### Acceptance Criteria

1. THE System SHALL provide an `en.json` translation file containing, at minimum, the following keys: `login`, `register`, `email`, `password`, `dashboard`, `logout`, `welcome`, `studentPortal`, `guardDashboard`, `adminDashboard`, `serialNumber`, `brand`, `model`, `registerLaptop`, `myLaptops`, `search`, `scanQR`, `allowEntry`, `allowExit`, `verifyLaptop`, `blockLaptop`, `recentActivity`, `registerGuest`, `fullName`, `phone`, `purpose`, `forgotPassword`, `resetPassword`, `verifyEmail`, `verificationCode`, `resendCode`, `loading`, `error`, `success`, `cancel`, `save`, `edit`, `remove`, `noResults`, `onCampus`, `offCampus`, `pending`, `verified`, `blocked`.
2. THE System SHALL provide an `am.json` translation file containing the same set of keys as `en.json`, with each value translated into Amharic.
3. WHEN a new translation key is added to `en.json`, THE System SHALL require the same key to be present in `am.json` to maintain consistency.

---

### Requirement 4

**User Story:** As a user, I want language switch buttons visible in the navigation area, so that I can change the language from any page.

#### Acceptance Criteria

1. THE System SHALL render two language switch buttons — one labelled `"English"` and one labelled `"አማርኛ"` — in the `AASTUHeader` component so they are accessible from every authenticated page.
2. WHEN the active language is English, THE System SHALL visually distinguish the "English" button (e.g., with a highlighted or active style) to indicate the current selection.
3. WHEN the active language is Amharic, THE System SHALL visually distinguish the "አማርኛ" button to indicate the current selection.
4. WHEN a language button is clicked, THE System SHALL call `i18n.changeLanguage` with the corresponding locale code (`"en"` or `"am"`).

---

### Requirement 5

**User Story:** As a developer, I want all existing React components to use translation keys, so that no hardcoded UI text remains in the codebase.

#### Acceptance Criteria

1. THE System SHALL update the `Login` page to replace all hardcoded UI strings with calls to the `t()` function from `useTranslation`.
2. THE System SHALL update the `Register` page to replace all hardcoded UI strings with calls to the `t()` function.
3. THE System SHALL update the `ForgotPassword` page to replace all hardcoded UI strings with calls to the `t()` function.
4. THE System SHALL update the `VerifyEmail` page to replace all hardcoded UI strings with calls to the `t()` function.
5. THE System SHALL update the `StudentDashboard` page to replace all hardcoded UI strings with calls to the `t()` function.
6. THE System SHALL update the `GuardDashboard` page to replace all hardcoded UI strings with calls to the `t()` function.
7. THE System SHALL update the `AdminDashboard` page to replace all hardcoded UI strings with calls to the `t()` function.
