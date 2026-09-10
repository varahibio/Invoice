import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDkFaTrs-qEGdjw2ogV4OqE65KPZPOjohk",
    authDomain: "varahi-invoices.firebaseapp.com",
    databaseURL: "https://varahi-invoices-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "varahi-invoices",
    storageBucket: "varahi-invoices.firebasestorage.app",
    messagingSenderId: "133035066591",
    appId: "1:133035066591:web:282499c3963377aa2b556a",
    measurementId: "G-5N53LRXF8M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Enable Local Persistence (Session persists across refreshes)
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Cart, Inactivity & Search Cache
let cart = [];
let inactivityTimer;
let currentAuthenticatedUser = null;
let searchedInvoiceData = null;
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const detailsScreen = document.getElementById('details-screen');
const deniedScreen = document.getElementById('denied-screen');
const deniedEmailText = document.getElementById('denied-email-text');
const deniedBackBtn = document.getElementById('denied-back-btn');
const userBadge = document.getElementById('user-badge');

const globalLoader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');

function showLoader(text) {
    loaderText.textContent = text || 'Loading…';
    globalLoader.style.display = 'flex';
}

function hideLoader() {
    globalLoader.style.display = 'none';
}

// True only while we're actively in the middle of a sign-in attempt the
// user just initiated — guards against showing the loader on the app's
// very first, silent auth check when the page loads with no user.
let signInInProgress = false;

const productSelect = document.getElementById('product-select');
const batchInput = document.getElementById('product-batch');
const mfgInput = document.getElementById('product-mfg');
const discountInput = document.getElementById('discount-pct');
const cartListUI = document.getElementById('cart-list');
const dateInput = document.getElementById('invoice-date');
const invoiceNumInput = document.getElementById('invoice-number');
const saveCheckbox = document.getElementById('save-invoice-checkbox');

const searchInput = document.getElementById('search-invoice-input');
const searchBtn = document.getElementById('search-invoice-btn');
const searchStatusMsg = document.getElementById('search-status-msg');
const viewDetailsBtn = document.getElementById('view-details-btn');
const detailsBackBtn = document.getElementById('details-back-btn');

// Details Screen Elements
const detailInvNum = document.getElementById('detail-inv-num');
const detailDate = document.getElementById('detail-date');
const detailClientName = document.getElementById('detail-client-name');
const detailClientAddress = document.getElementById('detail-client-address');
const detailSavedBy = document.getElementById('detail-saved-by');
const detailItemsList = document.getElementById('detail-items-list');
const detailSubtotal = document.getElementById('detail-subtotal');
const detailDiscount = document.getElementById('detail-discount');
const detailTotal = document.getElementById('detail-total');

// Set default date to today
const today = new Date();
dateInput.value = today.toISOString().split('T')[0];

// Preload the print logo so it's already cached & decoded before the
// user ever taps "Generate Invoice". On iOS Safari, printing an image
// that hasn't finished loading/decoding yet can cause window.print()
// to be dropped or delayed, and can cause the image to render at the
// wrong size.
const printLogoImg = document.getElementById('print-logo-img');
if (printLogoImg && !printLogoImg.complete) {
    const preload = new Image();
    preload.src = printLogoImg.src;
}

// PDF logo cache. The logo is fetched once at app startup so invoice generation
// does not depend on a late image request after the Generate button is tapped.
let invoiceLogoSvg = null;
const invoiceLogoPromise = fetch('img/Logo.svg', { cache: 'force-cache' })
    .then((response) => {
        if (!response.ok) throw new Error(`Logo request failed: ${response.status}`);
        return response.text();
    })
    .then((svg) => {
        invoiceLogoSvg = svg;
        return svg;
    })
    .catch((error) => {
        console.warn('Invoice PDF logo preload failed:', error);
        return null;
    });

// Authorization Verification
async function isUserAuthorized(email) {
    if (!email) return false;
    try {
        const userRef = doc(db, "authorized_users", email.toLowerCase());
        const userSnap = await getDoc(userRef);
        return userSnap.exists() && userSnap.data().active === true;
    } catch (error) {
        console.error("Auth check failed:", error);
        return false;
    }
}

// Auth Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (signInInProgress) showLoader('Checking your access…');
        const authorized = await isUserAuthorized(user.email);
        
        if (authorized) {
            currentAuthenticatedUser = user;
            if (signInInProgress) showLoader('Loading your workspace…');

            deniedScreen.style.display = 'none';
            loginScreen.style.display = 'none';
            appScreen.style.display = 'block';
            userBadge.textContent = `Signed in as: ${user.email}`;
            await Promise.all([loadProducts(), loadInvoiceConfig()]);
            startInactivityTimer();
            signInInProgress = false;
            hideLoader();
        } else {
            const rejectedEmail = user.email;
            currentAuthenticatedUser = null;
            await signOut(auth);
            
            appScreen.style.display = 'none';
            detailsScreen.style.display = 'none';
            loginScreen.style.display = 'none';
            deniedEmailText.textContent = `Signed in as: ${rejectedEmail}`;
            deniedScreen.style.display = 'block';
            clearTimeout(inactivityTimer);
            removeActivityListeners();
            signInInProgress = false;
            hideLoader();
        }
    } else {
        currentAuthenticatedUser = null;
        if (deniedScreen.style.display !== 'block') {
            loginScreen.style.display = 'flex';
        }
        appScreen.style.display = 'none';
        detailsScreen.style.display = 'none';
        userBadge.textContent = "";
        clearTimeout(inactivityTimer);
        removeActivityListeners();
        signInInProgress = false;
        hideLoader();
    }
});

// Denied Screen Handler
deniedBackBtn.addEventListener('click', () => {
    deniedScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
});

// Inactivity Watcher
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        signOut(auth);
    }, INACTIVITY_LIMIT);
}

function setupActivityListeners() {
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('mousedown', resetInactivityTimer);
    window.addEventListener('keypress', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);
    window.addEventListener('scroll', resetInactivityTimer);
}

function removeActivityListeners() {
    window.removeEventListener('mousemove', resetInactivityTimer);
    window.removeEventListener('mousedown', resetInactivityTimer);
    window.removeEventListener('keypress', resetInactivityTimer);
    window.removeEventListener('touchstart', resetInactivityTimer);
    window.removeEventListener('scroll', resetInactivityTimer);
}

function startInactivityTimer() {
    setupActivityListeners();
    resetInactivityTimer();
}

// Google Sign-In (Reverted to Popup)
document.getElementById('google-login-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    signInInProgress = true;
    showLoader('Signing in…');
    signInWithPopup(auth, googleProvider)
        .then(() => {
            document.getElementById('error-msg').style.display = 'none';
            // Loader stays up — onAuthStateChanged takes over from here
            // and hides it once the authorized workspace is ready.
        })
        .catch((error) => {
            signInInProgress = false;
            hideLoader();
            const errorMsg = document.getElementById('error-msg');
            errorMsg.style.display = 'block';
            errorMsg.textContent = error.message || "Google sign-in failed.";
        });
});

// Email/Password Login
document.getElementById('login-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    signInInProgress = true;
    showLoader('Signing in…');
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .then(() => {
            document.getElementById('error-msg').style.display = 'none';
            // Loader stays up — onAuthStateChanged hides it once ready.
        })
        .catch(() => {
            signInInProgress = false;
            hideLoader();
            const errorMsg = document.getElementById('error-msg');
            errorMsg.style.display = 'block';
            errorMsg.textContent = "Incorrect email or password.";
        });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showLoader('Signing out…');
    signOut(auth).finally(hideLoader);
});

// Invoice Number Auto-Sequence
async function loadInvoiceConfig() {
    try {
        const counterRef = doc(db, "config", "invoiceCounter");
        const docSnap = await getDoc(counterRef);
        let nextNum = 1;
        
        if (docSnap.exists()) {
            nextNum = docSnap.data().lastNumber + 1;
        }
        
        invoiceNumInput.value = "INV" + String(nextNum).padStart(4, '0');
    } catch (error) {
        console.error("Error loading invoice counter:", error);
    }
}

// Fetch Products
async function loadProducts() {
    productSelect.innerHTML = '<option value="" disabled selected>Loading...</option>';
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        productSelect.innerHTML = '<option value="" disabled selected>Select a Product...</option>';
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            const option = document.createElement('option');
            option.value = JSON.stringify({ id: doc.id, name: product.name, rate: product.rate, category: product.category || '' });
            option.textContent = `${product.name} - ₹${product.rate}`;
            productSelect.appendChild(option);
        });
    } catch (error) {
        productSelect.innerHTML = '<option value="" disabled selected>Error loading products</option>';
    }
}

function formatINR(number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(number);
}

// Add Item
document.getElementById('add-item-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!productSelect.value) {
        alert("Please select a product first.");
        return;
    }
    
    const productData = JSON.parse(productSelect.value);
    const qty = parseInt(document.getElementById('product-qty').value);
    const batch = batchInput.value.trim() || "As Per Pack";
    const mfg = mfgInput.value.trim() || "As Per Pack";
    
    if (qty < 1 || isNaN(qty)) return;

    const existingItem = cart.find(item => item.id === productData.id && item.batch === batch);
    if (existingItem) {
        existingItem.qty += qty;
    } else {
        cart.push({
            ...productData,
            qty: qty,
            batch: batch,
            mfg: mfg
        });
    }

    productSelect.value = "";
    batchInput.value = "";
    mfgInput.value = "";
    document.getElementById('product-qty').value = "1";
    
    updateCartUI();
});

// Update Cart Display
function updateCartUI() {
    cartListUI.innerHTML = "";
    let subtotal = 0;

    if (cart.length === 0) {
        cartListUI.innerHTML = '<p style="color: #777; font-size: 14px; margin: 0;">Cart is empty.</p>';
    }

    cart.forEach((item, index) => {
        const itemTotal = item.rate * item.qty;
        subtotal += itemTotal;

        const li = document.createElement('div');
        li.className = 'cart-item';
        li.innerHTML = `
            <div class="cart-item-details">
                <span class="cart-item-title">${item.name}</span>
                <span class="cart-item-math">${item.qty} x ${formatINR(item.rate)} = ${formatINR(itemTotal)} (Batch: ${item.batch})</span>
            </div>
            <button class="remove-btn" type="button" onclick="removeItem(${index})">&times;</button>
        `;
        cartListUI.appendChild(li);
    });

    const discountPct = parseFloat(discountInput.value) || 0;
    const discountAmount = subtotal * (discountPct / 100);
    const finalTotal = subtotal - discountAmount;

    document.getElementById('cart-subtotal').textContent = formatINR(subtotal);
    document.getElementById('cart-discount').textContent = `- ${formatINR(discountAmount)}`;
    document.getElementById('cart-total').textContent = `Total: ${formatINR(finalTotal)}`;
}

// Reusable button loading-state helper (used anywhere a tap kicks off
// work the user should get instant feedback on).
function setButtonLoading(btn, loading, loadingText) {
    if (!btn) return;
    if (loading) {
        if (btn.dataset.originalText === undefined) {
            btn.dataset.originalText = btn.textContent;
        }
        btn.textContent = loadingText || 'Please wait…';
        btn.disabled = true;
        btn.classList.add('is-loading');
    } else {
        if (btn.dataset.originalText !== undefined) {
            btn.textContent = btn.dataset.originalText;
        }
        btn.disabled = false;
        btn.classList.remove('is-loading');
    }
}

discountInput.addEventListener('input', updateCartUI);

window.removeItem = function(index) {
    cart.splice(index, 1);
    updateCartUI();
}

// Generate Invoice -> real PDF
//
// The invoice is now rendered directly into a PDF with pdfmake instead of
// asking Safari/Chrome to print the webpage. This removes the mobile-browser
// print pipeline from the critical path while leaving the visible UI intact.
// A blank tab is opened synchronously from the user's tap, then pdfmake fills
// that already-authorized window after the PDF has been generated.
const generateBtn = document.getElementById('generate-btn');

function buildInvoiceDocDefinition({
    invNum,
    dateString,
    clientName,
    clientAddress,
    items,
    subtotal,
    discountPct,
    discountAmount,
    finalTotal,
    logoSvg
}) {
    const currency = (value) => formatINR(value);

    const descriptionCell = (item) => {
        const meta = [];
        if (item.category) meta.push(`Category: ${item.category}`);
        meta.push(`Batch : ${item.batch || 'As Per Pack'}`);
        meta.push(`Mfg Dt. : ${item.mfg || 'As Per Pack'}`);
        meta.push(`MRP : ${Math.round(item.rate + (item.rate * 0.2))}`);

        return {
            stack: [
                { text: item.name || '', bold: true, color: '#333333', margin: [0, 0, 0, 3] },
                { text: meta.join('\n'), fontSize: 8, color: '#666666', lineHeight: 1.25 }
            ],
            margin: [0, 0, 0, 2]
        };
    };

    const tableBody = [
        [
            { text: 'DESCRIPTION', style: 'tableHeader', alignment: 'left' },
            { text: 'RATE', style: 'tableHeader', alignment: 'right' },
            { text: 'QTY', style: 'tableHeader', alignment: 'right' },
            { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
        ]
    ];

    items.forEach((item) => {
        const itemTotal = item.rate * item.qty;
        tableBody.push([
            descriptionCell(item),
            { text: currency(item.rate), alignment: 'right', margin: [0, 2, 0, 2] },
            { text: String(item.qty), alignment: 'right', margin: [0, 2, 0, 2] },
            { text: currency(itemTotal), alignment: 'right', margin: [0, 2, 0, 2] }
        ]);
    });

    const logoNode = logoSvg
        ? { svg: logoSvg, fit: [32, 35], alignment: 'left' }
        : { text: '', width: 32 };

    const header = {
        columns: [
            { width: 38, stack: [logoNode] },
            {
                width: '*',
                stack: [
                    { text: 'Varahi Biologicals', style: 'companyName' },
                    { text: 'Plot No 60/A, D.No.2-30/JV/90/A/BR/603, JV Colony, Gachibowli', style: 'companyInfo' },
                    { text: 'Hyderabad 500032', style: 'companyInfo' },
                    { text: 'GSTIN : 36AUCPK7425M1ZB', style: 'companyInfo' },
                    { text: '8333979678', style: 'companyInfo' },
                    { text: 'varahibio@gmail.com', style: 'companyInfo' }
                ],
                margin: [4, 0, 8, 0]
            },
            {
                width: 42,
                alignment: 'right',
                stack: [
                    { text: 'BILL OF SUPPLY', style: 'metaLabel', alignment: 'right' },
                    { text: invNum, style: 'metaValue', alignment: 'right' },
                    { text: 'DATE', style: 'metaLabel', alignment: 'right', margin: [0, 10, 0, 0] },
                    { text: dateString, style: 'metaValue', alignment: 'right' },
                    { text: 'DUE', style: 'metaLabel', alignment: 'right', margin: [0, 10, 0, 0] },
                    { text: 'On Receipt', style: 'metaValue', alignment: 'right' },
                    { text: 'BALANCE DUE', style: 'metaLabel', alignment: 'right', margin: [0, 10, 0, 0] },
                    { text: `INR ${finalTotal.toFixed(2)}`, style: 'metaValueBold', alignment: 'right' }
                ]
            }
        ],
        columnGap: 8,
        margin: [0, 0, 0, 18]
    };

    const billTo = {
        stack: [
            { text: 'BILL TO', style: 'metaLabel' },
            { text: clientName, style: 'billToName' },
            { text: clientAddress || '', style: 'billToAddress' }
        ],
        margin: [0, 0, 0, 16]
    };

    const totals = {
        columns: [
            { width: '*', text: '' },
            {
                width: 78,
                table: {
                    widths: ['*', 'auto'],
                    body: [
                        [
                            { text: 'SUBTOTAL', style: 'totalLabel', border: [false, false, false, false] },
                            { text: currency(subtotal), style: 'totalValue', border: [false, false, false, false] }
                        ],
                        ...(discountAmount > 0 ? [[
                            { text: 'DISCOUNT', style: 'totalLabel', border: [false, false, false, false] },
                            { text: `- ${currency(discountAmount)}`, style: 'totalValue', border: [false, false, false, false] }
                        ]] : []),
                        [
                            { text: 'TOTAL', style: 'totalLabelStrong', border: [false, true, false, false], margin: [0, 8, 0, 0] },
                            { text: currency(finalTotal), style: 'totalValueStrong', border: [false, true, false, false], margin: [0, 8, 0, 0] }
                        ],
                        [
                            { text: 'BALANCE DUE', style: 'balanceLabel', border: [false, true, false, true] },
                            { text: `INR ${finalTotal.toFixed(2)}`, style: 'balanceValue', border: [false, true, false, true] }
                        ]
                    ]
                },
                layout: {
                    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.6,
                    vLineWidth: () => 0,
                    hLineColor: () => '#DDDDDD',
                    paddingLeft: () => 0,
                    paddingRight: () => 0,
                    paddingTop: () => 4,
                    paddingBottom: () => 4
                }
            }
        ],
        margin: [0, 6, 0, 0]
    };

    return {
        pageSize: 'A4',
        pageMargins: [20, 20, 20, 20],
        info: {
            title: `Varahi Invoice ${invNum}`,
            author: 'Varahi Biologicals',
            subject: 'Bill of Supply'
        },
        content: [
            header,
            billTo,
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 30, 22, 34],
                    body: tableBody
                },
                layout: {
                    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0,
                    vLineWidth: () => 0,
                    hLineColor: () => '#333333',
                    paddingLeft: (i) => i === 0 ? 0 : 4,
                    paddingRight: (i) => i === 3 ? 0 : 4,
                    paddingTop: (i) => i === 0 ? 5 : 8,
                    paddingBottom: (i) => i === 0 ? 5 : 8
                }
            },
            totals
        ],
        defaultStyle: {
            font: 'Roboto',
            fontSize: 9,
            color: '#333333'
        },
        styles: {
            companyName: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
            companyInfo: { fontSize: 8.5, color: '#555555', margin: [0, 1.5, 0, 0] },
            metaLabel: { fontSize: 7.5, bold: true, color: '#555555', margin: [0, 0, 0, 2] },
            metaValue: { fontSize: 8.5, color: '#333333' },
            metaValueBold: { fontSize: 8.5, bold: true, color: '#333333' },
            billToName: { fontSize: 11, bold: true, margin: [0, 3, 0, 2] },
            billToAddress: { fontSize: 9, color: '#555555', lineHeight: 1.2 },
            tableHeader: { fontSize: 7.5, bold: true, color: '#555555' },
            totalLabel: { fontSize: 8.5, color: '#555555' },
            totalValue: { fontSize: 8.5, color: '#333333', alignment: 'right' },
            totalLabelStrong: { fontSize: 9, bold: true, color: '#333333' },
            totalValueStrong: { fontSize: 9, bold: true, color: '#333333', alignment: 'right' },
            balanceLabel: { fontSize: 9, bold: true, color: '#333333' },
            balanceValue: { fontSize: 10, bold: true, color: '#333333', alignment: 'right' }
        }
    };
}

async function generateInvoicePdf(docDefinition, targetWindow) {
    if (!window.pdfMake) {
        throw new Error('PDF engine did not load. Please refresh the page and try again.');
    }

    const pdf = window.pdfMake.createPdf(docDefinition);

    // pdfmake 0.3.x supports passing an already-opened window for async PDF
    // generation. This avoids a second popup attempt after the user gesture.
    if (targetWindow && !targetWindow.closed) {
        await pdf.open(targetWindow);
    } else {
        // Last-resort fallback if the browser blocked the initial blank tab.
        // This replaces the current app tab with the generated PDF instead of
        // falling back to window.print().
        await pdf.open(window);
    }
}

generateBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (cart.length === 0) {
        alert('Cannot generate an empty invoice. Add items to the bill.');
        return;
    }

    setButtonLoading(generateBtn, true, 'Preparing…');

    // Open the destination window immediately while this is still a trusted
    // user gesture. PDF generation itself is asynchronous.
    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
        try {
            pdfWindow.document.title = 'Preparing invoice…';
            pdfWindow.document.body.innerHTML = `
                <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:32px;text-align:center;color:#555;">
                    Preparing invoice…
                </div>`;
        } catch (error) {
            console.warn('Could not write PDF preparation page:', error);
        }
    }

    try {
        const clientName = document.getElementById('client-name').value.trim() || 'Cash Customer';
        const clientAddress = document.getElementById('client-address').value.trim();
        const invNum = invoiceNumInput.value.trim() || 'INV0001';

        const rawDate = dateInput.value;
        const parsedDate = new Date(`${rawDate}T00:00:00`);
        const dateString = parsedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        let subtotal = 0;
        cart.forEach((item) => {
            subtotal += item.rate * item.qty;
        });

        const discountPct = parseFloat(discountInput.value) || 0;
        const discountAmount = subtotal * (discountPct / 100);
        const finalTotal = subtotal - discountAmount;

        // Wait only for the logo data that was requested at app startup. If
        // that request failed, the PDF is still generated without the logo.
        if (!invoiceLogoSvg) {
            await invoiceLogoPromise;
        }

        const docDefinition = buildInvoiceDocDefinition({
            invNum,
            dateString,
            clientName,
            clientAddress,
            items: cart,
            subtotal,
            discountPct,
            discountAmount,
            finalTotal,
            logoSvg: invoiceLogoSvg
        });

        // Keep the existing Firestore behaviour exactly as before. PDF output
        // no longer depends on these writes completing.
        const numericMatch = invNum.match(/\d+/);
        if (numericMatch) {
            const usedNumber = parseInt(numericMatch[0], 10);
            setDoc(doc(db, 'config', 'invoiceCounter'), { lastNumber: usedNumber }, { merge: true })
                .catch(console.error);
        }

        if (saveCheckbox.checked) {
            const invoiceRecord = {
                invoiceNumber: invNum,
                date: dateString,
                clientName: clientName,
                clientAddress: clientAddress,
                items: cart,
                subtotal: subtotal,
                discountPct: discountPct,
                discountAmount: discountAmount,
                total: finalTotal,
                savedBy: currentAuthenticatedUser ? currentAuthenticatedUser.email : 'System',
                createdAt: new Date().toISOString()
            };
            setDoc(doc(db, 'invoices', invNum), invoiceRecord)
                .then(() => console.log(`Invoice ${invNum} saved to cloud.`))
                .catch(console.error);
        }

        await generateInvoicePdf(docDefinition, pdfWindow);
        setButtonLoading(generateBtn, false);
    } catch (error) {
        console.error('Invoice PDF generation failed:', error);
        if (pdfWindow && !pdfWindow.closed) {
            try {
                pdfWindow.close();
            } catch (_) {}
        }
        setButtonLoading(generateBtn, false);
        alert('Could not generate the invoice PDF. Please try again.');
    }
});

// Search Saved Invoice
searchBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const queryId = searchInput.value.trim().toUpperCase();
    searchStatusMsg.textContent = "";
    searchStatusMsg.className = "status-msg";
    viewDetailsBtn.style.display = "none";
    searchedInvoiceData = null;

    if (!queryId) {
        searchStatusMsg.textContent = "Please enter an invoice number.";
        searchStatusMsg.classList.add("status-error");
        return;
    }

    searchStatusMsg.textContent = "Searching...";
    setButtonLoading(searchBtn, true, 'Searching…');
    try {
        const invRef = doc(db, "invoices", queryId);
        const invSnap = await getDoc(invRef);

        if (invSnap.exists()) {
            searchedInvoiceData = invSnap.data();
            searchStatusMsg.textContent = `Invoice ${queryId} found!`;
            searchStatusMsg.classList.add("status-success");
            viewDetailsBtn.style.display = "block";
        } else {
            searchStatusMsg.textContent = `No invoice found for ${queryId}.`;
            searchStatusMsg.classList.add("status-error");
        }
    } catch (err) {
        console.error("Error searching invoice:", err);
        searchStatusMsg.textContent = "Error fetching invoice.";
        searchStatusMsg.classList.add("status-error");
    } finally {
        setButtonLoading(searchBtn, false);
    }
});

// View Details Screen
viewDetailsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!searchedInvoiceData) return;

    detailInvNum.textContent = searchedInvoiceData.invoiceNumber;
    detailDate.textContent = searchedInvoiceData.date;
    detailClientName.textContent = searchedInvoiceData.clientName;
    detailClientAddress.textContent = searchedInvoiceData.clientAddress || "None provided";
    detailSavedBy.textContent = searchedInvoiceData.savedBy || "N/A";

    detailItemsList.innerHTML = "";
    (searchedInvoiceData.items || []).forEach(item => {
        const itemTotal = item.rate * item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-details">
                <span class="cart-item-title">${item.name}</span>
                <span class="cart-item-math">${item.qty} x ${formatINR(item.rate)} = ${formatINR(itemTotal)} (Batch: ${item.batch || 'N/A'}, Mfg: ${item.mfg || 'N/A'})</span>
            </div>
        `;
        detailItemsList.appendChild(div);
    });

    detailSubtotal.textContent = formatINR(searchedInvoiceData.subtotal || 0);
    detailDiscount.textContent = `- ${formatINR(searchedInvoiceData.discountAmount || 0)}`;
    detailTotal.textContent = `Total: ${formatINR(searchedInvoiceData.total || 0)}`;

    appScreen.style.display = "none";
    detailsScreen.style.display = "block";
});

// Return to Invoice Generator Screen
detailsBackBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    detailsScreen.style.display = "none";
    appScreen.style.display = "block";
});