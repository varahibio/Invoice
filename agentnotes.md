# Varahi Bio Invoice Portal - Project Documentation

## 1. Project Overview
A mobile-first, serverless web application for generating, printing, and archiving invoices for Varahi Biologicals. The application is built using Vanilla JavaScript, HTML, and CSS, and relies on Firebase for backend services (Authentication and Firestore). It is hosted on GitHub Pages.

## 2. Core Features
*   **Restricted Access:** Google Sign-In authentication secured by a strict Firestore-based whitelist.
*   **Session Management:** Local session persistence using `browserLocalPersistence` with an automatic 5-minute inactivity logout timer.
*   **Dynamic Cart System:** Users can select products, specify batches/manufacturing dates, calculate line-item totals, and apply percentage-based subtotal discounts.
*   **Auto-sequencing:** Automatically increments the invoice number (e.g., `INV0005` to `INV0006`) upon generation.
*   **Cloud Archiving:** An optional "Save Invoice to Cloud" checkbox writes the entire structured invoice object to Firestore.
*   **Invoice Lookup:** A search module at the bottom of the UI allows users to query saved invoices by ID and view itemized details natively within the app.
*   **Cross-Platform Print-to-PDF:** Generates A4-optimized physical/PDF invoices, specifically engineered to bypass iOS Safari's strict popup and print-rendering blockers.

## 3. Architecture & Tech Stack
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules).
*   **Backend / BaaS:** Firebase v10.8.1 (Auth, Firestore).
*   **Hosting:** GitHub Pages (`varahibio.github.io`).
*   **Authentication Flow:** `signInWithPopup` (Google Provider).

---

## 4. Firestore Database Schema
The application relies on four primary collections in Firestore. 

### A. `authorized_users`
Acts as the whitelist for the login system. The Document ID must be the exact Google email address in lowercase.
*   **Document ID:** `[user-email]@gmail.com`
*   **Field:** `active` (boolean) = `true`

### B. `products`
The product catalog loaded dynamically into the UI dropdown.
*   **Document ID:** Auto-ID (or custom slug)
*   **Field:** `name` (string)
*   **Field:** `rate` (number)
*   **Field:** `category` (string) - *Optional*

### C. `config`
Stores global application state.
*   **Document ID:** `invoiceCounter`
*   **Field:** `lastNumber` (number) - *Tracks the integer value of the last generated invoice.*

### D. `invoices`
Stores saved invoices when the cloud archiving feature is used.
*   **Document ID:** `INV[XXXX]` (Matches the exact invoice number string)
*   **Fields:** 
    *   `clientName` (string)
    *   `clientAddress` (string)
    *   `date` (string)
    *   `discountAmount` (number)
    *   `discountPct` (number)
    *   `invoiceNumber` (string)
    *   `items` (array of objects containing: `qty`, `rate`, `name`, `batch`, `mfg`)
    *   `savedBy` (string)
    *   `subtotal` (number)
    *   `total` (number)
    *   `createdAt` (string - ISO Date)

---

## 5. Security & API Configuration (CRITICAL)
To ensure Google Sign-In (`signInWithPopup`) works flawlessly on mobile devices (specifically iOS Safari and privacy browsers like Brave), the Google Cloud API Key is configured with specific parameters to bypass Intelligent Tracking Prevention (ITP) stripped headers.

### Google Cloud API Key Restrictions
1.  **Application Restrictions:** Set to **None**.
    *   *Reasoning:* iOS Safari strips the HTTP `Referer` header during cross-site OAuth flows. If restricted by website URL, Google blocks iPhone users from logging in because the header arrives blank.
2.  **API Restrictions:** Restricted to exactly three APIs:
    *   **Cloud Firestore API**
    *   **Identity Toolkit API**
    *   **Token Service API**
    *   *Reasoning:* Since Application Restrictions are set to None, explicitly restricting the key to only these three APIs ensures the key cannot be abused for other Google Cloud services (like ML Kit or Compute Engine).

### Firebase Authorized Domains
Authentication is secured via Firebase's authorized domains list. Only the following domains are permitted to initiate the OAuth handshake:
*   `localhost`
*   `127.0.0.1`
*   `varahibio.github.io`
*   `varahi-invoices.firebaseapp.com`

---

## 6. Specific Bug Fixes & iOS Quirks Implemented

### A. iOS Print Dialog Silently Dropped / Deferred to Next Tap
*   **The Symptom:** Tapping "Generate Invoice" on iOS did nothing — no print sheet, no error — even across multiple repeated taps. The print sheet (or, after one attempted fix, a "This website has been blocked from automatically printing" system prompt) would then suddenly appear on the *next* unrelated tap (e.g. the Logout button).
*   **Root Cause (confirmed via screen recording):** iOS Safari requires `window.print()` to execute inside the direct, unbroken call stack of the user's tap — no `await`, no `requestAnimationFrame`, no `setTimeout`, not even a delay of zero. If that chain is broken, iOS doesn't error — it silently *banks* the print request and only flushes it on the next trusted user-gesture event, whatever that gesture was for. An earlier attempted fix wrapped `window.print()` in a double `requestAnimationFrame` (to let a freshly-rebuilt DOM finish painting first); this made the timing gap *visible* — iOS's auto-print guard started blocking it outright with a system permission prompt — but did not fix the underlying issue, since the prompt still only surfaced on the next tap (Logout).
*   **The Fix (current, in `app.js` / `index.html`):**
    1.  `window.print()` is called **perfectly synchronously** — the very next statement after `document.title` is set, nothing async in between.
    2.  The print logo now points at the bundled local file (`img/Logo.svg`, real `width`/`height` attributes baked in) instead of an external fetch, so there's no network round-trip to wait on at print time.
    3.  That image is preloaded via `new Image()` as soon as the app boots, so it's already decoded and cached long before "Generate Invoice" is ever tapped — this is what makes it safe to call `window.print()` immediately with no artificial delay.
*   **Status:** Implemented and consistent with the confirmed root cause. **Still pending a real iOS re-test** from the user — do not close this out until confirmed clean across several consecutive taps.
*   **Lesson learned (important for future edits to this flow):** Never add `requestAnimationFrame`/`setTimeout`/`await` between a click handler firing and the `window.print()` call in it, even to fix an apparently unrelated rendering issue. If the print logo (or anything else in `#print-area`) ever needs to change again, keep the fix on the "make it ready before the tap" side (preload/decode ahead of time), never on the "delay the print call" side.

### B. SVG Logo Sizing (iOS-only, huge logo)
*   **The Symptom:** Logo rendered at roughly full-page width on iOS prints only; correct size on Android and desktop/PC.
*   **Root Cause:** Same as 6.A above — the cross-origin SVG hadn't finished loading/decoding when print rendering occurred, so WebKit laid it out at an uncontrolled intrinsic size before the CSS width constraints could apply.
*   **The Fix:** Switching to the local, pre-decoded `img/Logo.svg` (see 6.A) should resolve this at the source. The existing `!important` 120px width/max-width rules on `.print-logo-container` / `.print-logo-container img` under `@media print` are kept in place as a belt-and-suspenders fallback.

### C. Authentication Flow Reversion
*   **The Problem:** Attempting to use `signInWithRedirect` for mobile users failed because modern browsers block third-party cookies upon redirecting back to the host domain, resulting in instant session loss.
*   **The Fix:** The app uses `signInWithPopup`. Combined with the Google Cloud Application Restrictions being set to "None", this allows the popup flow to succeed on all mobile browsers without `Referer` header rejections.

### D. Extra Blank Page on Print (Android Chrome)
*   **The Symptom:** Android Chrome printed the invoice correctly but always appended a second, near-empty page.
*   **Root Cause:** `body` uses `display:flex; min-height:100vh` on-screen to vertically center the login/app card. Nothing reset that for `@media print`, so the printed document was forced to be at least one full viewport tall *in addition to* the actual invoice content, pushing the tail end of the layout onto a second page.
*   **The Fix:** Added an `html, body { display:block !important; min-height:0 !important; height:auto !important; }` override inside the `@media print` block in `style.css`.
*   **Status:** Implemented, not yet re-tested by the user on Android since this fix landed.

---

## 7. Local Development Guidelines
*   **Local Server:** Use a tool like VS Code Live Server to run the app on `http://127.0.0.1:5501`.
*   **Testing iOS/Safari behavior:** The user tests exclusively by deploying to GitHub Pages and verifying on a real iPhone. Playwright/WebKit emulation on desktop was tried and rejected as unreliable for these bugs (print dialogs, popup/print blockers, and PWA install behavior are all real-device-only quirks that don't reproduce faithfully in emulation). **Do not suggest Playwright/WebKit emulation as a verification method for iOS-specific bugs — always point to a real-device test via the deployed GitHub Pages URL instead.**

---

## 8. Changelog / Agent Log
*Newest entries at top. Each entry: what changed, why, and current verification status.*

### 2026-09-10 (Synchronous Native Print Attempt & Failure)
*   **What was attempted:** Completely removed third-party PDF generation libraries (`html2pdf.js`) and popup/blob tab-opening tricks. Reverted strictly to a single "Generate Invoice" button executing a synchronous `window.print()` call with document-title hijacking (`Varahi_Invoice_INVXXXX`) to let the native OS handle printing and saving.
*   **Results / Real-Device Failures:**
    *   **iOS:** Failed as usual; produced a blank screen/page behavior due to mobile Safari's aggressive print-pipeline restrictions.
    *   **Android:** Broke the flow completely, resulting in blank PDF/print outputs.
    *   **PC (Desktop):** Remained functional (desktop browsers natively support synchronous title-hijacked printing).
*   **Status:** Disapproved by user due to persistent mobile breakage. The native single-tap print pipeline is unviable for cross-platform consistency on mobile web/PWA viewports without robust background rendering.

### 2026-09-10 (later same day)
User confirmed via screen recording that the previous fix's double-`requestAnimationFrame` was the actual problem — see Section 6.A for the corrected root-cause writeup. Also delivered a broader round of requested improvements:
*   **Print bug (real fix this time):** Removed the `requestAnimationFrame` delay entirely; `window.print()` is now called truly synchronously in the click handler. See 6.A.
*   **Loading feedback added throughout:**
    *   New global full-screen loading overlay (`#global-loader` in `index.html`, styles in `style.css`, logic in `app.js`) with a hand-built CSS recreation of the native iOS `UIActivityIndicator` (12 fading blades) — shows during Google/email sign-in ("Signing in…" → "Checking your access…" → "Loading your workspace…") and logout ("Signing out…"). Previously there was zero feedback during this gap, which is what was causing user anxiety on slow connections.
    *   New reusable `setButtonLoading(btn, loading, loadingText)` helper in `app.js`. Wired into Generate Invoice ("Preparing…") and Search Saved Invoice ("Searching…"). Shows a small spinning ring + disables the button + swaps its label; styles in `style.css` under `.is-loading`.
*   **Visual redesign pass toward native iOS look:** Introduced CSS custom-property design tokens (`:root` in `style.css`) mirroring iOS system colors (`systemGroupedBackground`, `label`, `secondaryLabel`, `separator`, `systemBlue`, `systemGreen`, `systemGray`), standardized corner radii, added safe-area-aware padding (`env(safe-area-inset-*)`) for notch/home-indicator clearance, added press/scale micro-interactions on buttons, and generally tightened spacing/typography. The brand font (`Haffer VF`) is kept as the primary typeface for continuity; `-apple-system`/`SF Pro Text` sit in the fallback stack.
*   **PWA / "Add to Home Screen" installability:**
    *   Added `manifest.json` (standalone display mode, theme/background colors, icon set).
    *   Generated a fresh app icon set (`img/icons/`: `apple-touch-icon.png` 180×180, `icon-192.png`, `icon-512.png`, favicons) — a red brand-colored "V" monogram, since the source `Logo.svg` couldn't be rasterized in the build environment (no `rsvg-convert`/`cairosvg` available, no network to install one). **If a closer match to the real boar-head logo mark is wanted for the app icon, that still needs to be produced from the actual artwork** (e.g. exported directly from whatever design tool the original SVG came from) and dropped into `img/icons/` under the same filenames.
    *   Added the required `<meta name="apple-mobile-web-app-*">` tags and icon `<link>` tags in `index.html`.
    *   Added a minimal `sw.js` service worker (network-first, same-origin-only, versioned via `CACHE_VERSION`) purely to satisfy installability and give faster repeat loads — deliberately does **not** touch Firebase SDK/Firestore/Google-auth network requests, to avoid any risk of breaking sign-in or data freshness. **Bump `CACHE_VERSION` in `sw.js` any time `index.html`/`style.css`/`app.js` change, or returning users may briefly see a stale cached copy.**
*   **Status:** All implemented, none of it yet verified on a real iPhone (user is testing via GitHub Pages deploy + real device, not emulation — see Section 7). Awaiting user's next test round for: (a) print dialog fires cleanly on first tap every time, (b) loading overlay looks/feels right, (c) "Add to Home Screen" produces a working standalone app icon and launch experience.

### 2026-09-10
*   Rewrote the print pipeline to fix three linked iOS/Android bugs: (1) print dialog not appearing on "Generate Invoice" and only firing on the next unrelated tap, (2) logo rendering oversized on iOS prints only, (3) extra blank page on Android prints. Root causes and fixes documented in Section 6 (A, B, D).
*   Changed print logo `<img>` source from an external GitHub raw URL to the bundled `img/Logo.svg`.
*   Added logo preload on app boot (`app.js`).
*   Changed `window.print()` call in the Generate Invoice handler to fire inside a double `requestAnimationFrame`.
*   Added `@media print` reset for `html, body` flex/viewport-height styling to fix the Android blank-page issue.
*   **Status: awaiting real iOS device testing** — user does not yet have iPhone access to verify. Do not assume 6.A/6.B are resolved until confirmed.


