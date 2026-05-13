# Requirements Document

## Introduction

The AASTU Laptop Gate Pass system currently uses a minimal login page as its landing experience. Users arrive at a plain card with a logo and form, with no context about what the system is or why they are here. This feature improves the landing page (the `/login` route) to provide a polished, informative, and accessible first impression that communicates the system's purpose, guides users to the correct action, and aligns with AASTU's brand identity (blue and gold).

The landing page must work well on both desktop (split-panel layout) and mobile (stacked layout), and must not break any existing authentication flows.

## Glossary

- **Landing Page**: The `/login` route — the first page unauthenticated users see.
- **Hero Panel**: The left/top decorative panel that communicates the system's purpose and brand.
- **Auth Card**: The right/bottom panel containing the login form.
- **AASTU**: Addis Ababa Science and Technology University.
- **Gate Pass System**: The campus laptop tracking and access control system.
- **AuthPageLayout**: The shared layout component wrapping all auth routes (login, activate, forgot-password).
- **Theme**: The design token file at `frontend/src/styles/theme.js` defining AASTU brand colors.
- **i18n**: Internationalization system supporting English and Amharic.

## Requirements

### Requirement 1

**User Story:** As a first-time visitor, I want to understand what the system is before I log in, so that I know I am in the right place.

#### Acceptance Criteria

1. WHEN a user visits the landing page, THE Landing Page SHALL display a hero panel containing the AASTU logo, the system name "Laptop Gate Pass", and a brief description of the system's purpose.
2. WHEN the hero panel is rendered, THE Landing Page SHALL display at least two feature highlights (e.g., "Secure Verification", "Campus Access Control") as visual callout items.
3. WHEN the viewport width is 768px or wider, THE Landing Page SHALL display the hero panel and the auth card side by side in a two-column layout.
4. WHEN the viewport width is below 768px, THE Landing Page SHALL stack the hero panel above the auth card in a single-column layout, with the hero panel collapsed to a compact banner.

---

### Requirement 2

**User Story:** As a returning user, I want a clean, fast login form, so that I can authenticate without friction.

#### Acceptance Criteria

1. WHEN the login form is displayed, THE Auth Card SHALL show a username input, a password input, a submit button, a "Forgot password?" link, and an "Activate your account" link.
2. WHEN the user submits the form with valid credentials, THE Auth Card SHALL navigate the user to the appropriate dashboard based on their role (STUDENT → /student, GUARD → /guard, ADMIN → /admin).
3. WHEN the user submits the form with invalid credentials, THE Auth Card SHALL display an inline error message without reloading the page.
4. WHEN the form is in a loading state, THE Auth Card SHALL disable the submit button and display a loading indicator.

---

### Requirement 3

**User Story:** As a user, I want the landing page to match AASTU's brand identity, so that the system feels official and trustworthy.

#### Acceptance Criteria

1. WHEN the landing page is rendered, THE Landing Page SHALL use the AASTU blue (`#0033A0`) and gold (`#D4A017`) color palette defined in the theme.
2. WHEN the hero panel is rendered, THE Landing Page SHALL display the official AASTU logo image (with a text fallback if the image fails to load).
3. WHEN the top navigation bar is rendered, THE AuthPageLayout SHALL display the AASTU horizontal logo and a language switcher (EN / አማ).
4. WHEN the footer is rendered, THE AASTUFooter SHALL display the university name, location, and copyright year.

---

### Requirement 4

**User Story:** As a user with accessibility needs, I want the landing page to be keyboard-navigable and screen-reader friendly, so that I can use the system without barriers.

#### Acceptance Criteria

1. WHEN the landing page is rendered, THE Landing Page SHALL provide descriptive `aria-label` attributes on all interactive elements (buttons, links, inputs).
2. WHEN a user navigates the page using only a keyboard, THE Landing Page SHALL maintain a logical tab order from the top bar through the form to the footer.
3. WHEN an error message is displayed, THE Auth Card SHALL associate the error with the form using `role="alert"` so screen readers announce it.
4. WHEN focus is placed on any input or button, THE Landing Page SHALL display a visible focus ring using the AASTU gold color.
