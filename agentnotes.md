# Varahi Invoices — Agent Notes

## 1. Project Overview

Varahi Invoices is a small Vanilla JavaScript Progressive Web App hosted on GitHub Pages.

The application uses:

- Vanilla HTML/CSS/JavaScript
- Firebase Authentication
- Firebase Firestore
- Google Sign-In
- Email/password authentication
- Firestore-backed product catalogue
- Firestore-backed invoice storage
- Client-side PDF generation
- PWA manifest
- Service worker

There is no application backend hosted on GitHub Pages.

There is no Firebase Cloud Function for PDF generation.

There is no Firebase Storage dependency for generated PDFs.

There is no paid PDF-generation API.


---

## 2. Core Application Files

### `index.html`

Contains:

- Login screen
- Google sign-in button
- Email/password login
- Main invoice creation screen
- Product selector
- Quantity field
- Batch field
- Manufacturing-date field
- Cart
- Discount field
- Save-to-cloud checkbox
- Generate Invoice button
- Saved invoice search
- Invoice details screen
- Legacy hidden `print-area` markup
- pdfmake browser bundles
- Service-worker registration

The visible application UI is intentionally unchanged by the PDF-generation migration.


### `style.css`

Contains:

- Application UI styling
- Login screen
- Invoice form
- Buttons
- Loading states
- Search/details UI
- Responsive/mobile styling
- Legacy print styling

The application UI continues to use the existing Haffer font styling.

Haffer is a UI font only.

Haffer is NOT used by the current PDF renderer.


### `app.js`

Contains:

- Firebase initialization
- Authentication
- Authorization checks
- Product loading
- Invoice number sequencing
- Cart management
- Discount calculations
- Invoice saving
- Saved invoice search
- Invoice details
- Client-side PDF generation
- PDF pre-generation/cache
- Native mobile PDF sharing
- PDF fallback handling


### `manifest.json`

PWA manifest.


### `sw.js`

Minimal app-shell service worker with versioned caching.


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

- `name`
- `rate`
- `category`


### Invoice counter

Document:

`config/invoiceCounter`

Field:

`lastNumber`

The next invoice number is generated from:

`lastNumber + 1`

The displayed invoice number uses the format:

`INV0001`

Example:

`INV0042`


### Saved invoices

Collection:

`invoices`

Document ID:

invoice number

Example:

`INV0001`


---

## 4. Authentication Flow

The application uses Firebase Authentication with:

- Google popup sign-in
- Email/password sign-in
- Browser local persistence

After authentication:

1. Firebase returns the authenticated user.
2. The app checks `authorized_users/{lowercase email}`.
3. Access is allowed only when `active === true`.
4. Authorized users see the invoice application.
5. Unauthorized users are signed out.
6. Unauthorized users are shown the Access Denied screen.

The loading overlay is shown when the user actively initiates sign-in or logout.

Authentication and authorization logic should not be changed when modifying the PDF system unless explicitly required.


---

## 5. Invoice Data

Invoice records contain:

- `invoiceNumber`
- `date`
- `clientName`
- `clientAddress`
- `items`
- `subtotal`
- `discountPct`
- `discountAmount`
- `total`
- `savedBy`
- `createdAt`

Each cart item contains:

- `id`
- `name`
- `rate`
- `category`
- `qty`
- `batch`
- `mfg`

The cart combines identical products when both:

- product ID matches
- batch matches

Quantity is increased rather than creating a duplicate cart row.


---

## 6. Invoice Calculations

For every cart item:

`item total = rate × quantity`

Invoice subtotal:

`subtotal = sum of all item totals`

Discount:

`discountAmount = subtotal × (discountPct / 100)`

Final total:

`finalTotal = subtotal - discountAmount`

Currency formatting uses the Indian locale and INR:

`Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`


---

## 7. Generate Invoice / PDF Architecture

### A. Previous Native Browser Print Pipeline — SUPERSEDED

The original Generate Invoice flow used:

`window.print()`

This depended on the browser's HTML print engine.

Problems encountered included:

- iOS print dialog failures
- delayed iOS print behaviour
- oversized SVG logo on iOS
- Android blank/extra pages
- inconsistent behaviour between Safari, Chrome and desktop browsers
- browser-specific print-layout differences

The native browser print pipeline is no longer used by Generate Invoice.

Do NOT restore `window.print()` as the primary PDF mechanism.


---

### B. Previous Popup-Based PDF Opening Architecture — SUPERSEDED

An earlier PDF implementation attempted to:

1. Open a blank browser tab synchronously.
2. Perform asynchronous PDF generation.
3. Put the generated PDF into the previously opened destination.

This was intended to preserve popup permission.

That architecture is no longer the preferred current implementation for iOS.

The current implementation pre-generates the PDF before the user presses Generate whenever possible.


---

### C. Current PDF Renderer — pdfmake

The current Generate Invoice system uses:

**pdfmake 0.3.11**

pdfmake is loaded in `index.html` using its browser bundles:

- `pdfmake.min.js`
- `vfs_fonts.js`

The PDF is generated entirely on the client.

There is:

- no backend PDF service
- no Firebase Function
- no Firebase Storage requirement
- no paid PDF API
- no external PDF font dependency


---

## 8. Current PDF Font — ROBOTO

The PDF uses pdfmake's built-in:

`Roboto`

The current implementation intentionally does NOT register any custom PDF font.

There is no:

`pdfMake.addFonts(...)`

There is no custom Haffer font registration.

There is no Valley Sans font registration.

There are no external `.ttf` requests for PDF generation.

This was deliberately chosen for reliability and simplicity.

### Important distinction

The application UI can continue using Haffer through `style.css`.

The PDF uses Roboto.

Therefore:

- UI → Haffer
- PDF → Roboto

Do not modify the UI font merely to change the PDF font.

If a future custom PDF font is introduced, it should be treated as a separate PDF-only dependency.


---

## 9. PDF Document Generation

`app.js` builds an A4 pdfmake document definition directly.

The PDF contains:

- Varahi Biologicals logo
- Company information
- Bill of Supply heading
- Invoice number
- Invoice date
- Due information
- Balance Due
- Bill To information
- Product description
- Batch
- Manufacturing date
- Rate
- Quantity
- Amount
- Subtotal
- Discount when applicable
- Total
- Balance Due

The PDF does not depend on the browser's HTML layout.

The PDF is generated from structured JavaScript data.

This makes PDF layout independent of the visible UI CSS.


---

## 10. Logo Handling

The local:

`img/Logo.svg`

file is fetched as SVG text during application startup.

The SVG text is supplied directly to pdfmake.

The PDF therefore embeds the logo as SVG rather than relying on the browser's print engine to render the HTML image.

This avoids the previous iOS SVG print-size problem.

If the logo preload fails, the PDF generation code can continue without the embedded SVG logo rather than relying on browser print rendering.


---

## 11. iOS PDF Architecture — CURRENT

### Why this architecture exists

iOS Safari/WebKit has strict transient user-activation requirements for actions such as native sharing.

If the application waits for asynchronous PDF generation and only then calls a user-activation-sensitive API, Safari may reject the action.

Therefore the current architecture attempts to prepare the PDF before the Generate button is pressed.


### PDF pre-generation

The application maintains:

`preparedInvoicePdf`

and:

`preparedInvoiceSignature`

The PDF is automatically prepared after relevant invoice data changes.

Preparation is scheduled with a short debounce.

Relevant inputs include:

- client name
- client address
- invoice date
- invoice number
- cart contents
- discount

The generated PDF is stored as a `File` object.


### Invoice signature

A signature is generated from the current invoice state.

The signature includes:

- invoice number
- date
- client name
- client address
- cart items
- product IDs
- product names
- rates
- quantities
- batches
- manufacturing dates
- discount percentage

The cached PDF is reused only when its signature matches the current invoice state.


---

## 12. Generate Button Behaviour

When Generate Invoice is pressed:

1. The application checks that the cart is not empty.
2. Current invoice data is captured.
3. Firestore invoice/counter operations are initiated as appropriate.
4. If a matching pre-generated PDF already exists, it is used immediately.
5. On supported mobile browsers, the app attempts native file sharing.
6. If native sharing is unavailable, the application uses a PDF fallback.
7. `window.print()` is NOT called.

The critical iOS path is:

`Generate click → already-prepared PDF → navigator.share({ files: [file] })`

This keeps the share operation within the user's button interaction.


---

## 13. Native PDF Sharing

The current implementation checks for:

`navigator.share`

and:

`navigator.canShare`

with the prepared PDF file.

The share call uses:

```js
navigator.share({
    files: [preparedInvoicePdf],
    title: preparedInvoicePdf.name
});

# iOS PDF Generation & Sharing Method

## Overview

The invoice PDF is generated entirely on the client side using **pdfmake 0.3.11**.

The important part of the iOS implementation is **when the PDF is generated and when it is shared**.

We do **not** wait until the user presses Generate Invoice to begin generating the PDF.

Instead, the application prepares the PDF in advance and keeps the completed PDF in memory. When the user presses Generate Invoice, iOS can immediately receive the already-generated PDF through the native Web Share API.

---

## Complete Flow

```text
User opens invoice screen
        ↓
User enters invoice information
        ↓
Invoice state changes
        ↓
Application schedules PDF preparation
        ↓
pdfmake generates the PDF in the background
        ↓
PDF becomes a JavaScript File object
        ↓
File is stored in preparedInvoicePdf
        ↓
Application waits for further invoice changes
        ↓
User presses "Generate Invoice"
        ↓
Existing prepared PDF is used
        ↓
navigator.share({ files: [PDF] })
        ↓
iOS Share Sheet
        ↓
User saves or shares the PDF