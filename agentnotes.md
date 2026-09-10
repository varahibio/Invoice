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

### A. The Synchronous Print Rule (iOS Safari Block)
*   **The Problem:** iOS completely blocks print dialogs if they are triggered asynchronously (e.g., waiting for an `await setDoc()` promise to resolve before printing). iOS views delayed popups as spam/malware.
*   **The Fix:** In `app.js`, the `window.print()` command is called *synchronously* during the "Generate Invoice" button click event. Database writes (`setDoc`) for the invoice counter and the saved invoice are executed as "fire-and-forget" promises in the background, allowing the print dialog to fire in the exact same millisecond the user taps the button.

### B. SVG Logo Sizing (WebKit Print Render Bug)
*   **The Problem:** WebKit (Safari's engine) fails to accurately calculate the bounding box of SVG files during print rendering, causing the company logo to expand to 100% of the A4 page width.
*   **The Fix:** In `style.css` under the `@media print` query, the `.print-logo-container` and its internal `img` tag have rigid `!important` width constraints (120px) to force WebKit to contain the graphic.

### C. Authentication Flow Reversion
*   **The Problem:** Attempting to use `signInWithRedirect` for mobile users failed because modern browsers block third-party cookies upon redirecting back to the host domain, resulting in instant session loss.
*   **The Fix:** The app uses `signInWithPopup`. Combined with the Google Cloud Application Restrictions being set to "None", this allows the popup flow to succeed on all mobile browsers without `Referer` header rejections.

---

## 7. Local Development Guidelines
*   **Local Server:** Use a tool like VS Code Live Server to run the app on `http://127.0.0.1:5501`.
*   **Testing WebKit:** To test iOS Safari CSS/Print quirks natively on Windows, install Playwright (`npm install playwright`) and launch a WebKit instance pointing to the local server.