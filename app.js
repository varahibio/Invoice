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
        const authorized = await isUserAuthorized(user.email);
        
        if (authorized) {
            currentAuthenticatedUser = user;
            deniedScreen.style.display = 'none';
            loginScreen.style.display = 'none';
            appScreen.style.display = 'block';
            userBadge.textContent = `Signed in as: ${user.email}`;
            loadProducts();
            loadInvoiceConfig();
            startInactivityTimer();
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
    signInWithPopup(auth, googleProvider)
        .then(() => {
            document.getElementById('error-msg').style.display = 'none';
        })
        .catch((error) => {
            const errorMsg = document.getElementById('error-msg');
            errorMsg.style.display = 'block';
            errorMsg.textContent = error.message || "Google sign-in failed.";
        });
});

// Email/Password Login
document.getElementById('login-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
        .then(() => {
            document.getElementById('error-msg').style.display = 'none';
        })
        .catch(() => {
            const errorMsg = document.getElementById('error-msg');
            errorMsg.style.display = 'block';
            errorMsg.textContent = "Incorrect email or password.";
        });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    signOut(auth);
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

discountInput.addEventListener('input', updateCartUI);

window.removeItem = function(index) {
    cart.splice(index, 1);
    updateCartUI();
}

// Generate & Print Invoice
document.getElementById('generate-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (cart.length === 0) {
        alert("Cannot generate an empty invoice. Add items to the bill.");
        return;
    }

    const clientName = document.getElementById('client-name').value || "Cash Customer";
    const clientAddress = document.getElementById('client-address').value || "";
    const invNum = invoiceNumInput.value.trim() || "INV0001";
    
    const rawDate = dateInput.value;
    const parsedDate = new Date(rawDate);
    const dateString = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    document.getElementById('print-inv-num').textContent = invNum;
    document.getElementById('print-date').textContent = dateString;
    document.getElementById('print-client-name').textContent = clientName;
    document.getElementById('print-client-address').textContent = clientAddress;

    // Fire and Forget: Update Counter in Background
    const numericMatch = invNum.match(/\d+/);
    if (numericMatch) {
        const usedNumber = parseInt(numericMatch[0], 10);
        setDoc(doc(db, "config", "invoiceCounter"), { lastNumber: usedNumber }, { merge: true }).catch(console.error);
    }

    const tbody = document.getElementById('print-table-body');
    tbody.innerHTML = "";
    
    let subtotal = 0;

    cart.forEach(item => {
        const itemTotal = item.rate * item.qty;
        subtotal += itemTotal;

        const tr = document.createElement('tr');
        const categoryTag = item.category ? `Category: ${item.category}<br>` : "";
        
        tr.innerHTML = `
            <td style="text-align: left;">
                <strong style="color: #333;">${item.name}</strong>
                <div class="print-item-meta">
                    ${categoryTag}
                    Batch : ${item.batch}<br>
                    Mfg Dt. : ${item.mfg}<br>
                    MRP : ${Math.round(item.rate + (item.rate * 0.2))}
                </div>
            </td>
            <td style="text-align: right;">${formatINR(item.rate)}</td>
            <td style="text-align: right;">${item.qty}</td>
            <td style="text-align: right;">${formatINR(itemTotal)}</td>
        `;
        tbody.appendChild(tr);
    });

    const discountPct = parseFloat(discountInput.value) || 0;
    const discountAmount = subtotal * (discountPct / 100);
    const finalTotal = subtotal - discountAmount;

    document.getElementById('print-subtotal').textContent = formatINR(subtotal);
    
    const printDiscountRow = document.getElementById('print-discount-row');
    if (discountAmount > 0) {
        printDiscountRow.style.display = 'flex';
        document.getElementById('print-discount-val').textContent = `- ${formatINR(discountAmount)}`;
    } else {
        printDiscountRow.style.display = 'none';
    }

    document.getElementById('print-total').textContent = formatINR(finalTotal);
    document.getElementById('print-balance-top').textContent = formatINR(finalTotal).replace('₹', '');
    document.getElementById('print-balance-bottom').textContent = formatINR(finalTotal).replace('₹', '');

    // Fire and Forget: Save to Cloud if requested
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
        setDoc(doc(db, "invoices", invNum), invoiceRecord).then(() => {
            console.log(`Invoice ${invNum} saved to cloud.`);
        }).catch(console.error);
    }

    // Set title and synchronously call print immediately
    const originalTitle = document.title;
    document.title = `varahi - ${invNum}`;

    window.print();

    setTimeout(() => {
        document.title = originalTitle;
    }, 1000);
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