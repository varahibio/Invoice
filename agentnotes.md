# Varahi Invoices — Agent Notes

## 1. Project Overview

Varahi Invoices is a small Vanilla JavaScript Progressive Web App hosted on GitHub Pages.

The application uses:

* Vanilla HTML/CSS/JavaScript
* Firebase Authentication
* Firebase Firestore
* Google Sign-In
* Email/password authentication
* Firestore-backed product catalogue
* Firestore-backed invoice storage
* Client-side invoice generation
* PWA manifest
* Service worker

There is no application backend hosted on GitHub Pages.

---

## 2. Core Application Files

### `index.html`

Contains:

* Login screen
* Google sign-in button
* Email/password login
* Main invoice creation screen
* Product selector
* Cart
* Discount field
* Save-to-cloud checkbox
* Generate Invoice button
* Saved invoice search
* Invoice details screen
* Legacy hidden print-area markup
* pdfmake browser bundles
* Service-worker registration

### `style.css`

Contains:

* Application UI styling
* Login screen
* Invoice form
* Buttons
* Loading states
* Search/details UI
* Responsive/mobile styling
* Legacy print styling

The visible UI is intentionally unchanged by the PDF-generation migration.

### `app.js`

Contains:

* Firebase initialization
* Authentication
* Authorization checks
* Product loading
* Invoice number sequencing
* Cart management
* Discount calculations
* Invoice saving
* Saved invoice search
* Invoice details
* Client-side PDF generation

### `manifest.json`

PWA manifest.

### `sw.js`

Minimal app-shell service worker.

### `img/Logo.svg`

Primary Varahi Biologicals logo.

---

## 3. Firebase Structure

### Authorized users

Collection:

`authorized_users`

Document ID:

lowercase email address

Expected field:

`active: true`

### Products

Collection:

`products`

Expected fields include:

* `name`
* `rate`
* `category`

### Invoice counter

Document:

`config/invoiceCounter`

Field:

`lastNumber`

### Saved invoices

Collection:

`invoices`

Document ID:

invoice number, e.g.

`INV0001`

---

## 4. Authentication Flow

The application uses Firebase Authentication with:

* Google popup sign-in
* Email/password sign-in
* Browser local persistence

After authentication:

1. Firebase returns the authenticated user.
2. The app checks `authorized_users/{lowercase email}`.
3. Access is allowed only when `active === true`.
4. Authorized users see the invoice application.
5. Unauthorized users are signed out and shown the Access Denied screen.

The loading overlay is only displayed when the user actively initiates sign-in or logout.

---

## 5. Invoice Data

Invoice records contain:

* `invoiceNumber`
* `date`
* `clientName`
* `clientAddress`
* `items`
* `subtotal`
* `discountPct`
* `discountAmount`
* `total`
* `savedBy`
* `createdAt`

Each item contains:

* `id`
* `name`
* `rate`
* `category`
* `qty`
* `batch`
* `mfg`

---

## 6. Generate Invoice / PDF Architecture

### A. Previous Native Browser Print Pipeline — SUPERSEDED

The original Generate Invoice flow used:

`window.print()`

This depended on the browser's HTML print engine.

The application experienced:

* iOS print dialog failures
* delayed iOS print behavior
* oversized SVG logo on iOS
* Android blank/extra pages
* inconsistent behavior between Safari, Chrome and desktop browsers

The native browser print pipeline is no longer used by Generate Invoice.

---

### B. Previous iOS SVG Print Issue — SUPERSEDED FOR GENERATE FLOW

The print-area originally depended on the browser loading and printing the SVG logo.

On iOS, the SVG could render at an incorrect oversized size during printing.

The current PDF flow does not rely on browser print rendering.

---

### C. Authentication

Authentication remains unchanged.

Firebase Authentication continues to handle:

* Google popup authentication
* Email/password authentication
* Local persistence
* Authorization verification

---

### D. Direct Client-Side PDF Generation — CURRENT

The Generate Invoice button now uses **pdfmake 0.3.11**.

The library is loaded directly in `index.html`:

* `pdfmake.min.js`
* `vfs_fonts.js`

No backend PDF service is used.

No Firebase Cloud Function is used.

No Firebase Storage bucket is used.

No paid PDF API is used.

PDF generation happens entirely inside the browser.

The PDF is generated as an A4 document containing:

* Varahi Biologicals logo
* Company information
* Bill of Supply heading
* Invoice number
* Date
* Due information
* Balance due
* Bill To information
* Product table
* Product category
* Batch
* Manufacturing date
* MRP
* Rate
* Quantity
* Amount
* Subtotal
* Discount
* Total
* Balance Due

The PDF uses pdfmake's embedded Roboto VFS font.

The local `img/Logo.svg` file is fetched as SVG text during application startup and supplied directly to pdfmake.

This avoids browser print-layout problems with the SVG.

---

### E. Mobile PDF Delivery

The Generate Invoice click opens a blank destination tab synchronously:

`window.open('', '_blank')`

This occurs immediately inside the user's button click.

The application then performs the asynchronous work needed to build the PDF.

Once the PDF is ready, pdfmake opens the generated PDF in the already-authorized destination window.

This is intended to avoid popup blocking caused by attempting to open a new window only after asynchronous work has completed.

If the initial destination window is unavailable, the implementation falls back to opening the generated PDF in the current browser window.

It does **not** fall back to `window.print()`.

---

### F. Firestore Behaviour

The existing Firestore behaviour is retained.

The invoice counter is updated in the background.

When `Save Invoice to Cloud?` is checked, the invoice record is written to:

`invoices/{invoiceNumber}`

PDF generation does not wait for these Firestore writes to complete.

---

### G. Legacy Print DOM

The old `#print-area` remains in `index.html`.

It is retained for compatibility with the existing CSS and project structure.

The new Generate Invoice flow does not populate it for printing and does not call:

`window.print()`

The visible application UI remains unchanged.

---

## 7. Local Development Guidelines

### Local Server

Use a local server such as VS Code Live Server.

Example:

`http://127.0.0.1:5501`

### iOS Testing

iOS behaviour must be tested on an actual iPhone.

Desktop WebKit/Playwright emulation should not be treated as proof of iOS behaviour because:

* Safari print behaviour is device-specific
* PWA standalone behaviour is device-specific
* popup restrictions differ
* PDF viewer behaviour differs
* iOS browser lifecycle behaviour differs

For iOS verification, deploy to GitHub Pages and test using the real device.

---

## 8. Service Worker

`sw.js` uses a versioned cache:

`varahi-invoices-v2-pdf`

The service worker uses a network-first strategy for same-origin GET requests.

It intentionally does not intercept:

* Firebase SDK requests
* Firestore requests
* Firebase Authentication
* Google authentication
* External CDN requests

The pdfmake CDN dependency is therefore not cached by the service worker.

Whenever `index.html`, `style.css`, `app.js`, or another app-shell file is changed, increment `CACHE_VERSION` in `sw.js`.

---

## 9. Current Verification Status

The PDF migration has been implemented but requires real-device testing.

Required testing:

### Desktop

* Generate invoice
* Multiple items
* Discount
* No discount
* ₹ currency
* Logo
* Saved invoice
* Search invoice
* View details

### Android Chrome

* Generate on first tap
* PDF opens
* PDF is not blank
* PDF has one correct A4 page where appropriate
* Logo size
* ₹ rendering
* Multiple items
* Discount
* Save Invoice to Cloud

### iPhone Safari

* Generate on first tap
* Destination PDF tab opens
* PDF renders
* Logo size
* ₹ rendering
* Multiple items
* Discount
* Save Invoice to Cloud

### iPhone Installed PWA

* Generate on first tap
* PDF opens correctly
* PDF viewer/share/save behaviour
* No application crash
* No popup failure
* No blank output

---

## 10. Changelog / Agent Log

*Newest entries at top.*

### 2026-09-10 — Direct Client-Side PDF Renderer

* Replaced the Generate Invoice -> `window.print()` pipeline with direct A4 PDF generation using **pdfmake 0.3.11**.
* No visible UI changes were made.
* PDF output recreates the existing invoice structure directly in PDF space.
* The local SVG logo is embedded directly as SVG in the PDF.
* The Generate click synchronously opens a blank destination tab.
* The PDF is generated asynchronously and then opened in that already-authorized tab.
* This avoids depending on the Safari/Chrome webpage print pipeline.
* No Firebase Function was added.
* No Firebase Storage was added.
* No paid PDF service was added.
* PDF generation remains client-side.
* `index.html` now loads pdfmake and its VFS font bundle.
* `app.js` contains the new PDF document-generation pipeline.
* `sw.js` cache version was bumped.
* `style.css` was intentionally left unchanged.
* Real-device testing is still required.

### 2026-09-10 — User Reversion Context

The user reverted toward the application's core functionality after testing previous print/PDF approaches.

Observed state before the current PDF implementation:

* Android: previous build worked
* PC: previous build worked
* iOS: previous build continued to fail

The objective of the current implementation is to remove the browser print pipeline entirely while keeping the existing invoice application and visible UI intact.

### 2026-09-10 — Synchronous Native Print Attempt & Failure

* Completely removed third-party PDF generation libraries and popup/blob tab-opening tricks.
* Attempted a direct synchronous `window.print()` call.
* Used document-title hijacking for desktop PDF filenames.
* PC remained functional.
* Android produced blank PDF/print output.
* iOS continued to fail.
* The approach was rejected because mobile behaviour was inconsistent.

### 2026-09-10 — Earlier Print/UX Changes

* Removed a double `requestAnimationFrame` delay around `window.print()`.
* Added global loading feedback.
* Added button loading states.
* Added PWA manifest.
* Added PWA icons.
* Added service worker.
* Added iOS safe-area support.
* Added iOS-style design tokens.
* Added responsive UI improvements.
* Added logo preload.
* Added Android print-page reset.

These changes remain in the project where applicable, but the new Generate Invoice PDF path no longer relies on browser printing.