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

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
   ========================================================= */

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


/* =========================================================
   PDF FONT
   ========================================================= */

const VALLEY_SANS_REGULAR_URL =
    "https://github.com/hethwiQ/siteassets/raw/refs/heads/main/fonts/Valley_Sans/static/ValleySans-Regular.ttf";

const VALLEY_SANS_MEDIUM_URL =
    "https://github.com/hethwiQ/siteassets/raw/refs/heads/main/fonts/Valley_Sans/static/ValleySans-Medium.ttf";

const VALLEY_SANS_SEMIBOLD_URL =
    "https://github.com/hethwiQ/siteassets/raw/refs/heads/main/fonts/Valley_Sans/static/ValleySans-SemiBold.ttf";

const VALLEY_SANS_BOLD_URL =
    "https://github.com/hethwiQ/siteassets/raw/refs/heads/main/fonts/Valley_Sans/static/ValleySans-Bold.ttf";


/*
 * Valley Sans is used ONLY by the generated PDF.
 * The website/app UI continues to use Haffer through style.css.
 */

if (window.pdfMake && typeof window.pdfMake.addFonts === "function") {

    window.pdfMake.addFonts({

        ValleySans: {
            normal: VALLEY_SANS_REGULAR_URL,
            bold: VALLEY_SANS_SEMIBOLD_URL,
            italics: VALLEY_SANS_REGULAR_URL,
            bolditalics: VALLEY_SANS_BOLD_URL
        },

        ValleySansMedium: {
            normal: VALLEY_SANS_MEDIUM_URL,
            bold: VALLEY_SANS_SEMIBOLD_URL,
            italics: VALLEY_SANS_MEDIUM_URL,
            bolditalics: VALLEY_SANS_BOLD_URL
        },

        ValleySansSemiBold: {
            normal: VALLEY_SANS_SEMIBOLD_URL,
            bold: VALLEY_SANS_SEMIBOLD_URL,
            italics: VALLEY_SANS_SEMIBOLD_URL,
            bolditalics: VALLEY_SANS_BOLD_URL
        },

        ValleySansBold: {
            normal: VALLEY_SANS_BOLD_URL,
            bold: VALLEY_SANS_BOLD_URL,
            italics: VALLEY_SANS_BOLD_URL,
            bolditalics: VALLEY_SANS_BOLD_URL
        }
    });
}


/*
 * Warm all PDF font files before Generate is pressed.
 */

[
    VALLEY_SANS_REGULAR_URL,
    VALLEY_SANS_MEDIUM_URL,
    VALLEY_SANS_SEMIBOLD_URL,
    VALLEY_SANS_BOLD_URL
].forEach((fontUrl) => {

    fetch(fontUrl, {
        cache: "force-cache"
    }).catch(() => {});

});


/* =========================================================
   AUTH PERSISTENCE
   ========================================================= */

setPersistence(
    auth,
    browserLocalPersistence
).catch(console.error);


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let cart = [];
let inactivityTimer;
let currentAuthenticatedUser = null;
let searchedInvoiceData = null;

const INACTIVITY_LIMIT =
    5 * 60 * 1000;


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const loginScreen =
    document.getElementById("login-screen");

const appScreen =
    document.getElementById("app-screen");

const detailsScreen =
    document.getElementById("details-screen");

const deniedScreen =
    document.getElementById("denied-screen");

const deniedEmailText =
    document.getElementById("denied-email-text");

const deniedBackBtn =
    document.getElementById("denied-back-btn");

const userBadge =
    document.getElementById("user-badge");

const globalLoader =
    document.getElementById("global-loader");

const loaderText =
    document.getElementById("loader-text");

const productSelect =
    document.getElementById("product-select");

const batchInput =
    document.getElementById("product-batch");

const mfgInput =
    document.getElementById("product-mfg");

const discountInput =
    document.getElementById("discount-pct");

const cartListUI =
    document.getElementById("cart-list");

const dateInput =
    document.getElementById("invoice-date");

const invoiceNumInput =
    document.getElementById("invoice-number");

const saveCheckbox =
    document.getElementById("save-invoice-checkbox");

const searchInput =
    document.getElementById("search-invoice-input");

const searchBtn =
    document.getElementById("search-invoice-btn");

const searchStatusMsg =
    document.getElementById("search-status-msg");

const viewDetailsBtn =
    document.getElementById("view-details-btn");

const detailsBackBtn =
    document.getElementById("details-back-btn");

const detailInvNum =
    document.getElementById("detail-inv-num");

const detailDate =
    document.getElementById("detail-date");

const detailClientName =
    document.getElementById("detail-client-name");

const detailClientAddress =
    document.getElementById("detail-client-address");

const detailSavedBy =
    document.getElementById("detail-saved-by");

const detailItemsList =
    document.getElementById("detail-items-list");

const detailSubtotal =
    document.getElementById("detail-subtotal");

const detailDiscount =
    document.getElementById("detail-discount");

const detailTotal =
    document.getElementById("detail-total");

const generateBtn =
    document.getElementById("generate-btn");


/* =========================================================
   LOADER
   ========================================================= */

function showLoader(text) {

    loaderText.textContent =
        text || "Loading…";

    globalLoader.style.display =
        "flex";
}

function hideLoader() {

    globalLoader.style.display =
        "none";
}

let signInInProgress = false;


/* =========================================================
   DEFAULT DATE
   ========================================================= */

const today = new Date();

dateInput.value =
    today.toISOString().split("T")[0];


/* =========================================================
   LOGO PRELOAD
   ========================================================= */

const printLogoImg =
    document.getElementById("print-logo-img");

if (
    printLogoImg &&
    !printLogoImg.complete
) {

    const preload =
        new Image();

    preload.src =
        printLogoImg.src;
}


/*
 * Fetch the SVG once at startup.
 */

let invoiceLogoSvg = null;

const invoiceLogoPromise =
    fetch(
        "img/Logo.svg",
        {
            cache: "force-cache"
        }
    )
        .then((response) => {

            if (!response.ok) {

                throw new Error(
                    `Logo request failed: ${response.status}`
                );
            }

            return response.text();
        })
        .then((svg) => {

            invoiceLogoSvg =
                svg;

            return svg;
        })
        .catch((error) => {

            console.warn(
                "Invoice PDF logo preload failed:",
                error
            );

            return null;
        });


/* =========================================================
   AUTHORIZATION
   ========================================================= */

async function isUserAuthorized(email) {

    if (!email) {
        return false;
    }

    try {

        const userRef =
            doc(
                db,
                "authorized_users",
                email.toLowerCase()
            );

        const userSnap =
            await getDoc(userRef);

        return (
            userSnap.exists() &&
            userSnap.data().active === true
        );

    } catch (error) {

        console.error(
            "Auth check failed:",
            error
        );

        return false;
    }
}


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (user) {

            if (signInInProgress) {
                showLoader(
                    "Checking your access…"
                );
            }

            const authorized =
                await isUserAuthorized(
                    user.email
                );

            if (authorized) {

                currentAuthenticatedUser =
                    user;

                if (signInInProgress) {
                    showLoader(
                        "Loading your workspace…"
                    );
                }

                deniedScreen.style.display =
                    "none";

                loginScreen.style.display =
                    "none";

                appScreen.style.display =
                    "block";

                userBadge.textContent =
                    `Signed in as: ${user.email}`;

                await Promise.all([
                    loadProducts(),
                    loadInvoiceConfig()
                ]);

                startInactivityTimer();

                signInInProgress =
                    false;

                hideLoader();

            } else {

                const rejectedEmail =
                    user.email;

                currentAuthenticatedUser =
                    null;

                await signOut(auth);

                appScreen.style.display =
                    "none";

                detailsScreen.style.display =
                    "none";

                loginScreen.style.display =
                    "none";

                deniedEmailText.textContent =
                    `Signed in as: ${rejectedEmail}`;

                deniedScreen.style.display =
                    "block";

                clearTimeout(
                    inactivityTimer
                );

                removeActivityListeners();

                signInInProgress =
                    false;

                hideLoader();
            }

        } else {

            currentAuthenticatedUser =
                null;

            if (
                deniedScreen.style.display !==
                "block"
            ) {

                loginScreen.style.display =
                    "flex";
            }

            appScreen.style.display =
                "none";

            detailsScreen.style.display =
                "none";

            userBadge.textContent =
                "";

            clearTimeout(
                inactivityTimer
            );

            removeActivityListeners();

            signInInProgress =
                false;

            hideLoader();
        }
    }
);


/* =========================================================
   DENIED SCREEN
   ========================================================= */

deniedBackBtn.addEventListener(
    "click",
    () => {

        deniedScreen.style.display =
            "none";

        loginScreen.style.display =
            "flex";
    }
);


/* =========================================================
   INACTIVITY WATCHER
   ========================================================= */

function resetInactivityTimer() {

    clearTimeout(
        inactivityTimer
    );

    inactivityTimer =
        setTimeout(
            () => {
                signOut(auth);
            },
            INACTIVITY_LIMIT
        );
}

function setupActivityListeners() {

    window.addEventListener(
        "mousemove",
        resetInactivityTimer
    );

    window.addEventListener(
        "mousedown",
        resetInactivityTimer
    );

    window.addEventListener(
        "keypress",
        resetInactivityTimer
    );

    window.addEventListener(
        "touchstart",
        resetInactivityTimer
    );

    window.addEventListener(
        "scroll",
        resetInactivityTimer
    );
}

function removeActivityListeners() {

    window.removeEventListener(
        "mousemove",
        resetInactivityTimer
    );

    window.removeEventListener(
        "mousedown",
        resetInactivityTimer
    );

    window.removeEventListener(
        "keypress",
        resetInactivityTimer
    );

    window.removeEventListener(
        "touchstart",
        resetInactivityTimer
    );

    window.removeEventListener(
        "scroll",
        resetInactivityTimer
    );
}

function startInactivityTimer() {

    setupActivityListeners();

    resetInactivityTimer();
}


/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

document
    .getElementById("google-login-btn")
    .addEventListener(
        "click",
        (e) => {

            e.preventDefault();
            e.stopPropagation();

            signInInProgress =
                true;

            showLoader(
                "Signing in…"
            );

            signInWithPopup(
                auth,
                googleProvider
            )
                .then(() => {

                    document.getElementById(
                        "error-msg"
                    ).style.display =
                        "none";
                })
                .catch((error) => {

                    signInInProgress =
                        false;

                    hideLoader();

                    const errorMsg =
                        document.getElementById(
                            "error-msg"
                        );

                    errorMsg.style.display =
                        "block";

                    errorMsg.textContent =
                        error.message ||
                        "Google sign-in failed.";
                });
        }
    );


/* =========================================================
   EMAIL / PASSWORD LOGIN
   ========================================================= */

document
    .getElementById("login-btn")
    .addEventListener(
        "click",
        (e) => {

            e.preventDefault();
            e.stopPropagation();

            signInInProgress =
                true;

            showLoader(
                "Signing in…"
            );

            signInWithEmailAndPassword(
                auth,
                document.getElementById(
                    "email"
                ).value,
                document.getElementById(
                    "password"
                ).value
            )
                .then(() => {

                    document.getElementById(
                        "error-msg"
                    ).style.display =
                        "none";
                })
                .catch(() => {

                    signInInProgress =
                        false;

                    hideLoader();

                    const errorMsg =
                        document.getElementById(
                            "error-msg"
                        );

                    errorMsg.style.display =
                        "block";

                    errorMsg.textContent =
                        "Incorrect email or password.";
                });
        }
    );


/* =========================================================
   LOGOUT
   ========================================================= */

document
    .getElementById("logout-btn")
    .addEventListener(
        "click",
        (e) => {

            e.preventDefault();
            e.stopPropagation();

            showLoader(
                "Signing out…"
            );

            signOut(auth).finally(
                hideLoader
            );
        }
    );


/* =========================================================
   INVOICE NUMBER
   ========================================================= */

async function loadInvoiceConfig() {

    try {

        const counterRef =
            doc(
                db,
                "config",
                "invoiceCounter"
            );

        const docSnap =
            await getDoc(
                counterRef
            );

        let nextNum = 1;

        if (docSnap.exists()) {

            nextNum =
                docSnap.data().lastNumber +
                1;
        }

        invoiceNumInput.value =
            "INV" +
            String(nextNum)
                .padStart(4, "0");

        scheduleInvoicePdfPreparation();

    } catch (error) {

        console.error(
            "Error loading invoice counter:",
            error
        );
    }
}


/* =========================================================
   PRODUCTS
   ========================================================= */

async function loadProducts() {

    productSelect.innerHTML =
        '<option value="" disabled selected>Loading...</option>';

    try {

        const querySnapshot =
            await getDocs(
                collection(
                    db,
                    "products"
                )
            );

        productSelect.innerHTML =
            '<option value="" disabled selected>Select a Product...</option>';

        querySnapshot.forEach(
            (productDoc) => {

                const product =
                    productDoc.data();

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    JSON.stringify({
                        id:
                            productDoc.id,

                        name:
                            product.name,

                        rate:
                            product.rate,

                        category:
                            product.category ||
                            ""
                    });

                option.textContent =
                    `${product.name} - ₹${product.rate}`;

                productSelect.appendChild(
                    option
                );
            }
        );

    } catch (error) {

        console.error(
            "Error loading products:",
            error
        );

        productSelect.innerHTML =
            '<option value="" disabled selected>Error loading products</option>';
    }
}


/* =========================================================
   CURRENCY
   ========================================================= */

function formatINR(number) {

    return new Intl.NumberFormat(
        "en-IN",
        {
            style: "currency",
            currency: "INR"
        }
    ).format(number);
}


/* =========================================================
   ADD ITEM
   ========================================================= */

document
    .getElementById("add-item-btn")
    .addEventListener(
        "click",
        (e) => {

            e.preventDefault();
            e.stopPropagation();

            if (!productSelect.value) {

                alert(
                    "Please select a product first."
                );

                return;
            }

            const productData =
                JSON.parse(
                    productSelect.value
                );

            const qty =
                parseInt(
                    document.getElementById(
                        "product-qty"
                    ).value
                );

            const batch =
                batchInput.value.trim() ||
                "As Per Pack";

            const mfg =
                mfgInput.value.trim() ||
                "As Per Pack";

            if (
                qty < 1 ||
                isNaN(qty)
            ) {
                return;
            }

            const existingItem =
                cart.find(
                    (item) =>
                        item.id ===
                            productData.id &&
                        item.batch ===
                            batch
                );

            if (existingItem) {

                existingItem.qty +=
                    qty;

            } else {

                cart.push({
                    ...productData,
                    qty:
                        qty,
                    batch:
                        batch,
                    mfg:
                        mfg
                });
            }

            productSelect.value =
                "";

            batchInput.value =
                "";

            mfgInput.value =
                "";

            document.getElementById(
                "product-qty"
            ).value =
                "1";

            updateCartUI();
        }
    );


/* =========================================================
   CART
   ========================================================= */

function updateCartUI() {

    cartListUI.innerHTML =
        "";

    let subtotal = 0;

    if (cart.length === 0) {

        cartListUI.innerHTML =
            '<p style="color: #777; font-size: 14px; margin: 0;">Cart is empty.</p>';
    }

    cart.forEach(
        (item, index) => {

            const itemTotal =
                item.rate *
                item.qty;

            subtotal +=
                itemTotal;

            const li =
                document.createElement(
                    "div"
                );

            li.className =
                "cart-item";

            li.innerHTML = `
                <div class="cart-item-details">
                    <span class="cart-item-title">${item.name}</span>

                    <span class="cart-item-math">
                        ${item.qty}
                        x
                        ${formatINR(item.rate)}
                        =
                        ${formatINR(itemTotal)}
                        (Batch: ${item.batch})
                    </span>
                </div>

                <button
                    class="remove-btn"
                    type="button"
                    onclick="removeItem(${index})"
                >&times;</button>
            `;

            cartListUI.appendChild(
                li
            );
        }
    );

    const discountPct =
        parseFloat(
            discountInput.value
        ) || 0;

    const discountAmount =
        subtotal *
        (discountPct / 100);

    const finalTotal =
        subtotal -
        discountAmount;

    document.getElementById(
        "cart-subtotal"
    ).textContent =
        formatINR(
            subtotal
        );

    document.getElementById(
        "cart-discount"
    ).textContent =
        `- ${formatINR(
            discountAmount
        )}`;

    document.getElementById(
        "cart-total"
    ).textContent =
        `Total: ${formatINR(
            finalTotal
        )}`;

    scheduleInvoicePdfPreparation();
}


/* =========================================================
   BUTTON LOADING
   ========================================================= */

function setButtonLoading(
    btn,
    loading,
    loadingText
) {

    if (!btn) {
        return;
    }

    if (loading) {

        if (
            btn.dataset.originalText ===
            undefined
        ) {

            btn.dataset.originalText =
                btn.textContent;
        }

        btn.textContent =
            loadingText ||
            "Please wait…";

        btn.disabled =
            true;

        btn.classList.add(
            "is-loading"
        );

    } else {

        if (
            btn.dataset.originalText !==
            undefined
        ) {

            btn.textContent =
                btn.dataset.originalText;
        }

        btn.disabled =
            false;

        btn.classList.remove(
            "is-loading"
        );
    }
}

discountInput.addEventListener(
    "input",
    updateCartUI
);

window.removeItem =
    function(index) {

        cart.splice(
            index,
            1
        );

        updateCartUI();
    };


/* =========================================================
   BUILD PDF DOCUMENT
   ========================================================= */

function buildInvoiceDocDefinition({

    invNum,
    dateString,
    clientName,
    clientAddress,
    items,
    subtotal,
    discountAmount,
    finalTotal,
    logoSvg

}) {

    const currency =
        (value) =>
            formatINR(value);


    /* -----------------------------------------------------
       DESCRIPTION CELL
       ----------------------------------------------------- */

    const descriptionCell =
        (item) => {

            const meta = [];

            meta.push(
                `Batch : ${
                    item.batch ||
                    "As Per Pack"
                }`
            );

            meta.push(
                `Mfg Dt. : ${
                    item.mfg ||
                    "As Per Pack"
                }`
            );

            return {

                stack: [

                    {
                        text:
                            item.name ||
                            "",

                        font:
                            "ValleySansMedium",

                        fontSize:
                            9.5,

                        color:
                            "#222222",

                        margin:
                            [
                                0,
                                0,
                                0,
                                3
                            ]
                    },

                    {
                        text:
                            meta.join(
                                "\n"
                            ),

                        font:
                            "ValleySans",

                        fontSize:
                            7.5,

                        color:
                            "#666666",

                        lineHeight:
                            1.15
                    }
                ],

                margin:
                    [
                        0,
                        1,
                        0,
                        2
                    ]
            };
        };


    /* -----------------------------------------------------
       TABLE
       ----------------------------------------------------- */

    const tableBody = [

        [

            {
                text:
                    "DESCRIPTION",

                style:
                    "tableHeader",

                alignment:
                    "left",

                noWrap:
                    true
            },

            {
                text:
                    "RATE",

                style:
                    "tableHeader",

                alignment:
                    "right",

                noWrap:
                    true
            },

            {
                text:
                    "QTY",

                style:
                    "tableHeader",

                alignment:
                    "right",

                noWrap:
                    true
            },

            {
                text:
                    "AMOUNT",

                style:
                    "tableHeader",

                alignment:
                    "right",

                noWrap:
                    true
            }
        ]
    ];


    items.forEach(
        (item) => {

            const itemTotal =
                item.rate *
                item.qty;

            tableBody.push([

                descriptionCell(
                    item
                ),

                {
                    text:
                        currency(
                            item.rate
                        ),

                    alignment:
                        "right",

                    margin:
                        [
                            0,
                            2,
                            0,
                            2
                        ],

                    noWrap:
                        true
                },

                {
                    text:
                        String(
                            item.qty
                        ),

                    alignment:
                        "right",

                    margin:
                        [
                            0,
                            2,
                            0,
                            2
                        ],

                    noWrap:
                        true
                },

                {
                    text:
                        currency(
                            itemTotal
                        ),

                    alignment:
                        "right",

                    margin:
                        [
                            0,
                            2,
                            0,
                            2
                        ],

                    noWrap:
                        true
                }
            ]);
        }
    );


    /* -----------------------------------------------------
       LOGO
       ----------------------------------------------------- */

    const logoNode =
        logoSvg

            ? {
                svg:
                    logoSvg,

                fit:
                    [
                        82,
                        82
                    ],

                alignment:
                    "left"
            }

            : {
                text:
                    "",

                width:
                    82
            };


    /* -----------------------------------------------------
       HEADER
       ----------------------------------------------------- */

    const header = {

        columns: [

            {
                width:
                    88,

                stack: [
                    logoNode
                ]
            },


            {
                width:
                    "*",

                stack: [

                    {
                        text:
                            "Varahi Biologicals",

                        font:
                            "ValleySansMedium",

                        fontSize:
                            16,

                        alignment:
                            "center",

                        margin:
                            [
                                0,
                                5,
                                0,
                                7
                            ]
                    },


                    {
                        text:
                            "Plot No 60/A, D.No.2-30/JV/90/A/BR/603, JV Colony, Gachibowli",

                        font:
                            "ValleySans",

                        fontSize:
                            7.5,

                        color:
                            "#444444",

                        alignment:
                            "left",

                        margin:
                            [
                                0,
                                0,
                                0,
                                2
                            ]
                    },


                    {
                        text:
                            "Hyderabad 500032",

                        font:
                            "ValleySans",

                        fontSize:
                            7.5,

                        color:
                            "#444444",

                        alignment:
                            "left",

                        margin:
                            [
                                0,
                                0,
                                0,
                                2
                            ]
                    },


                    {
                        text:
                            "GSTIN : 36AUCPK7425M1ZB",

                        font:
                            "ValleySans",

                        fontSize:
                            7.5,

                        color:
                            "#444444",

                        alignment:
                            "left",

                        margin:
                            [
                                0,
                                0,
                                0,
                                2
                            ]
                    },


                    {
                        text:
                            "8333979678",

                        font:
                            "ValleySans",

                        fontSize:
                            7.5,

                        color:
                            "#444444",

                        alignment:
                            "left",

                        margin:
                            [
                                0,
                                0,
                                0,
                                2
                            ]
                    },


                    {
                        text:
                            "varahibio@gmail.com",

                        font:
                            "ValleySans",

                        fontSize:
                            7.5,

                        color:
                            "#444444",

                        alignment:
                            "left"
                    }
                ],

                margin:
                    [
                        0,
                        0,
                        10,
                        0
                    ]
            },


            {
                width:
                    92,

                alignment:
                    "right",

                stack: [

                    {
                        text:
                            "BILL OF SUPPLY",

                        style:
                            "metaLabel",

                        alignment:
                            "right",

                        noWrap:
                            true
                    },


                    {
                        text:
                            invNum,

                        style:
                            "metaValue",

                        alignment:
                            "right",

                        noWrap:
                            true
                    },


                    {
                        text:
                            "DATE",

                        style:
                            "metaLabel",

                        alignment:
                            "right",

                        margin:
                            [
                                0,
                                10,
                                0,
                                0
                            ],

                        noWrap:
                            true
                    },


                    {
                        text:
                            dateString,

                        style:
                            "metaValue",

                        alignment:
                            "right",

                        noWrap:
                            true
                    },


                    {
                        text:
                            "DUE",

                        style:
                            "metaLabel",

                        alignment:
                            "right",

                        margin:
                            [
                                0,
                                10,
                                0,
                                0
                            ],

                        noWrap:
                            true
                    },


                    {
                        text:
                            "On Receipt",

                        style:
                            "metaValue",

                        alignment:
                            "right",

                        noWrap:
                            true
                    },


                    {
                        text:
                            "BALANCE DUE",

                        style:
                            "metaLabel",

                        alignment:
                            "right",

                        margin:
                            [
                                0,
                                10,
                                0,
                                0
                            ],

                        noWrap:
                            true
                    },


                    {
                        text:
                            `INR ${finalTotal.toFixed(
                                2
                            )}`,

                        style:
                            "metaValueBold",

                        alignment:
                            "right",

                        noWrap:
                            true
                    }
                ]
            }
        ],

        columnGap:
            8,

        margin:
            [
                0,
                0,
                0,
                18
            ]
    };


    /* -----------------------------------------------------
       BILL TO
       ----------------------------------------------------- */

    const billTo = {

        stack: [

            {
                text:
                    "BILL TO",

                style:
                    "metaLabel"
            },

            {
                text:
                    clientName,

                style:
                    "billToName"
            },

            {
                text:
                    clientAddress ||
                    "",

                style:
                    "billToAddress"
            }
        ],

        margin:
            [
                0,
                0,
                0,
                16
            ]
    };


    /* -----------------------------------------------------
       TOTALS
       ----------------------------------------------------- */

    const totals = {

        columns: [

            {
                width:
                    "*",

                text:
                    ""
            },


            {
                width:
                    240,

                table: {

                    widths: [
                        "*",
                        "auto"
                    ],

                    body: [

                        [

                            {
                                text:
                                    "SUBTOTAL",

                                style:
                                    "totalLabel",

                                border:
                                    [
                                        false,
                                        false,
                                        false,
                                        false
                                    ]
                            },

                            {
                                text:
                                    currency(
                                        subtotal
                                    ),

                                style:
                                    "totalValue",

                                border:
                                    [
                                        false,
                                        false,
                                        false,
                                        false
                                    ],

                                noWrap:
                                    true
                            }
                        ],


                        ...(discountAmount > 0
                            ? [

                                [

                                    {
                                        text:
                                            "DISCOUNT",

                                        style:
                                            "totalLabel",

                                        border:
                                            [
                                                false,
                                                false,
                                                false,
                                                false
                                            ]
                                    },

                                    {
                                        text:
                                            `- ${currency(
                                                discountAmount
                                            )}`,

                                        style:
                                            "totalValue",

                                        border:
                                            [
                                                false,
                                                false,
                                                false,
                                                false
                                            ],

                                        noWrap:
                                            true
                                    }
                                ]

                            ]
                            : []),


                        [

                            {
                                text:
                                    "TOTAL",

                                style:
                                    "totalLabelStrong",

                                border:
                                    [
                                        false,
                                        true,
                                        false,
                                        false
                                    ],

                                margin:
                                    [
                                        0,
                                        8,
                                        0,
                                        0
                                    ]
                            },

                            {
                                text:
                                    currency(
                                        finalTotal
                                    ),

                                style:
                                    "totalValueStrong",

                                border:
                                    [
                                        false,
                                        true,
                                        false,
                                        false
                                    ],

                                margin:
                                    [
                                        0,
                                        8,
                                        0,
                                        0
                                    ],

                                noWrap:
                                    true
                            }
                        ],


                        [

                            {
                                text:
                                    "BALANCE DUE",

                                style:
                                    "balanceLabel",

                                border:
                                    [
                                        false,
                                        true,
                                        false,
                                        true
                                    ],

                                noWrap:
                                    true
                            },

                            {
                                text:
                                    `INR ${finalTotal.toFixed(
                                        2
                                    )}`,

                                style:
                                    "balanceValue",

                                border:
                                    [
                                        false,
                                        true,
                                        false,
                                        true
                                    ],

                                noWrap:
                                    true
                            }
                        ]
                    ]
                },


                layout: {

                    hLineWidth:
                        (i, node) =>
                            (
                                i === 0 ||
                                i ===
                                    node.table.body.length
                            )
                                ? 0
                                : 0.6,

                    vLineWidth:
                        () => 0,

                    hLineColor:
                        () =>
                            "#DDDDDD",

                    paddingLeft:
                        () => 0,

                    paddingRight:
                        () => 0,

                    paddingTop:
                        () => 4,

                    paddingBottom:
                        () => 4
                }
            }
        ],

        margin:
            [
                0,
                6,
                0,
                0
            ]
    };


    /* -----------------------------------------------------
       DOCUMENT
       ----------------------------------------------------- */

    return {

        pageSize:
            "A4",

        pageMargins:
            [
                58,
                42,
                58,
                42
            ],

        info: {

            title:
                `varahibio(${invNum})`,

            author:
                "Varahi Biologicals",

            subject:
                "Bill of Supply"
        },


        content: [

            header,


            {
                canvas: [

                    {
                        type:
                            "line",

                        x1:
                            0,

                        y1:
                            0,

                        x2:
                            479,

                        y2:
                            0,

                        lineWidth:
                            0.5,

                        lineColor:
                            "#D0D0D0"
                    }
                ],

                margin:
                    [
                        0,
                        0,
                        0,
                        18
                    ]
            },


            billTo,


            {
                table: {

                    headerRows:
                        1,

                    widths: [
                        "*",
                        58,
                        35,
                        68
                    ],

                    body:
                        tableBody
                },


                layout: {

                    hLineWidth:
                        (i, node) =>
                            (
                                i === 0 ||
                                i === 1 ||
                                i ===
                                    node.table.body.length
                            )
                                ? 0.8
                                : 0,

                    vLineWidth:
                        () => 0,

                    hLineColor:
                        () =>
                            "#333333",

                    paddingLeft:
                        (i) =>
                            i === 0
                                ? 0
                                : 4,

                    paddingRight:
                        (i) =>
                            i === 3
                                ? 0
                                : 4,

                    paddingTop:
                        (i) =>
                            i === 0
                                ? 5
                                : 8,

                    paddingBottom:
                        (i) =>
                            i === 0
                                ? 5
                                : 8
                }
            },


            totals
        ],


        defaultStyle: {

            font:
                "ValleySans",

            fontSize:
                8.5,

            color:
                "#222222"
        },


        styles: {

            companyName: {

                font:
                    "ValleySansMedium",

                fontSize:
                    16,

                margin:
                    [
                        0,
                        0,
                        0,
                        5
                    ]
            },


            companyInfo: {

                font:
                    "ValleySans",

                fontSize:
                    7.5,

                color:
                    "#444444"
            },


            metaLabel: {

                font:
                    "ValleySansSemiBold",

                fontSize:
                    7,

                color:
                    "#555555",

                noWrap:
                    true
            },


            metaValue: {

                font:
                    "ValleySans",

                fontSize:
                    8,

                color:
                    "#333333"
            },


            metaValueBold: {

                font:
                    "ValleySansBold",

                fontSize:
                    8,

                color:
                    "#333333"
            },


            billToName: {

                font:
                    "ValleySansMedium",

                fontSize:
                    10,

                margin:
                    [
                        0,
                        3,
                        0,
                        2
                    ]
            },


            billToAddress: {

                font:
                    "ValleySans",

                fontSize:
                    8,

                color:
                    "#555555",

                lineHeight:
                    1.2
            },


            tableHeader: {

                font:
                    "ValleySansSemiBold",

                fontSize:
                    7,

                color:
                    "#555555",

                noWrap:
                    true
            },


            totalLabel: {

                font:
                    "ValleySans",

                fontSize:
                    8.5,

                color:
                    "#555555"
            },


            totalValue: {

                font:
                    "ValleySans",

                fontSize:
                    8.5,

                color:
                    "#333333",

                alignment:
                    "right"
            },


            totalLabelStrong: {

                font:
                    "ValleySansSemiBold",

                fontSize:
                    9,

                color:
                    "#333333"
            },


            totalValueStrong: {

                font:
                    "ValleySansSemiBold",

                fontSize:
                    9,

                color:
                    "#333333",

                alignment:
                    "right"
            },


            balanceLabel: {

                font:
                    "ValleySansSemiBold",

                fontSize:
                    9,

                color:
                    "#333333"
            },


            balanceValue: {

                font:
                    "ValleySansSemiBold",

                fontSize:
                    10,

                color:
                    "#333333",

                alignment:
                    "right"
            }
        }
    };
}


/* =========================================================
   CURRENT PDF DATA
   ========================================================= */

function getCurrentInvoicePdfData() {

    const clientName =
        document
            .getElementById(
                "client-name"
            )
            .value
            .trim() ||
        "Cash Customer";

    const clientAddress =
        document
            .getElementById(
                "client-address"
            )
            .value
            .trim();

    const invNum =
        invoiceNumInput.value.trim() ||
        "INV0001";

    const rawDate =
        dateInput.value;

    const parsedDate =
        new Date(
            `${rawDate}T00:00:00`
        );

    const dateString =
        parsedDate.toLocaleDateString(
            "en-US",
            {
                month:
                    "short",

                day:
                    "numeric",

                year:
                    "numeric"
            }
        );

    let subtotal = 0;

    cart.forEach(
        (item) => {

            subtotal +=
                item.rate *
                item.qty;
        }
    );

    const discountPct =
        parseFloat(
            discountInput.value
        ) || 0;

    const discountAmount =
        subtotal *
        (discountPct / 100);

    const finalTotal =
        subtotal -
        discountAmount;

    const signature =
        JSON.stringify({

            invNum:
                invNum,

            dateString:
                dateString,

            clientName:
                clientName,

            clientAddress:
                clientAddress,

            items:
                cart,

            discountPct:
                discountPct,

            discountAmount:
                discountAmount,

            finalTotal:
                finalTotal
        });

    return {

        invNum:
            invNum,

        dateString:
            dateString,

        clientName:
            clientName,

        clientAddress:
            clientAddress,

        subtotal:
            subtotal,

        discountPct:
            discountPct,

        discountAmount:
            discountAmount,

        finalTotal:
            finalTotal,

        signature:
            signature
    };
}


/* =========================================================
   PDF CACHE
   ========================================================= */

let preparedInvoicePdf =
    null;

let preparedInvoiceSignature =
    "";

let pdfPreparationTimer =
    null;

let pdfPreparationInProgress =
    false;


function isIOSBrowser() {

    return (
        /iPad|iPhone|iPod/.test(
            navigator.userAgent
        ) &&
        !window.MSStream
    );
}


async function buildPreparedInvoicePdf() {

    if (!window.pdfMake) {

        throw new Error(
            "PDF engine did not load."
        );
    }

    const data =
        getCurrentInvoicePdfData();

    if (!invoiceLogoSvg) {
        await invoiceLogoPromise;
    }

    const docDefinition =
        buildInvoiceDocDefinition({

            invNum:
                data.invNum,

            dateString:
                data.dateString,

            clientName:
                data.clientName,

            clientAddress:
                data.clientAddress,

            items:
                cart,

            subtotal:
                data.subtotal,

            discountAmount:
                data.discountAmount,

            finalTotal:
                data.finalTotal,

            logoSvg:
                invoiceLogoSvg
        });

    const pdf =
        window.pdfMake.createPdf(
            docDefinition
        );

    const blob =
        await new Promise(
            (resolve, reject) => {

                pdf.getBlob(
                    (result) => {

                        if (result) {

                            resolve(
                                result
                            );

                        } else {

                            reject(
                                new Error(
                                    "PDF blob generation failed."
                                )
                            );
                        }
                    }
                );
            }
        );

    return {

        file:
            new File(
                [
                    blob
                ],

                `varahibio(${data.invNum}).pdf`,

                {
                    type:
                        "application/pdf"
                }
            ),

        signature:
            data.signature
    };
}


async function prepareInvoicePdfCache() {

    if (
        pdfPreparationInProgress
    ) {

        return;
    }

    pdfPreparationInProgress =
        true;

    try {

        const prepared =
            await buildPreparedInvoicePdf();

        preparedInvoicePdf =
            prepared.file;

        preparedInvoiceSignature =
            prepared.signature;

    } catch (error) {

        console.warn(
            "Background PDF preparation failed:",
            error
        );

    } finally {

        pdfPreparationInProgress =
            false;
    }
}


function scheduleInvoicePdfPreparation() {

    clearTimeout(
        pdfPreparationTimer
    );

    pdfPreparationTimer =
        setTimeout(
            () => {

                prepareInvoicePdfCache();

            },
            250
        );
}


function watchInvoicePdfInputs() {

    [

        "client-name",
        "client-address",
        "invoice-date",
        "invoice-number",
        "discount-pct"

    ].forEach(
        (id) => {

            const element =
                document.getElementById(
                    id
                );

            if (!element) {
                return;
            }

            element.addEventListener(
                "input",
                scheduleInvoicePdfPreparation
            );

            element.addEventListener(
                "change",
                scheduleInvoicePdfPreparation
            );
        }
    );
}

watchInvoicePdfInputs();


/* =========================================================
   IOS NATIVE SHARE
   ========================================================= */

function sharePreparedInvoicePdf() {

    if (
        !preparedInvoicePdf ||
        !navigator.share ||
        !navigator.canShare
    ) {

        return false;
    }

    try {

        const shareData = {

            files: [
                preparedInvoicePdf
            ],

            title:
                preparedInvoicePdf.name
        };

        if (
            !navigator.canShare(
                shareData
            )
        ) {

            return false;
        }

        const sharePromise =
            navigator.share(
                shareData
            );

        sharePromise.catch(
            (error) => {

                if (
                    error &&
                    error.name !==
                        "AbortError"
                ) {

                    console.warn(
                        "Native PDF share failed:",
                        error
                    );
                }
            }
        );

        return true;

    } catch (error) {

        console.warn(
            "Native PDF share invocation failed:",
            error
        );

        return false;
    }
}


function openPreparedPdfFallback(
    file
) {

    if (!file) {
        return false;
    }

    const url =
        URL.createObjectURL(
            file
        );

    window.location.href =
        url;

    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        60000
    );

    return true;
}


/* =========================================================
   GENERATE INVOICE
   ========================================================= */

generateBtn.addEventListener(
    "click",
    async (e) => {

        e.preventDefault();
        e.stopPropagation();


        if (cart.length === 0) {

            alert(
                "Cannot generate an empty invoice. Add items to the bill."
            );

            return;
        }


        const currentData =
            getCurrentInvoicePdfData();


        /*
         * iOS:
         *
         * If the PDF was already prepared before the
         * tap, invoke navigator.share immediately while
         * the user activation is still valid.
         */

        if (

            isIOSBrowser() &&

            preparedInvoicePdf &&

            preparedInvoiceSignature ===
                currentData.signature

        ) {

            if (
                sharePreparedInvoicePdf()
            ) {

                const numericMatch =
                    currentData.invNum.match(
                        /\d+/
                    );


                if (numericMatch) {

                    const usedNumber =
                        parseInt(
                            numericMatch[0],
                            10
                        );

                    setDoc(

                        doc(
                            db,
                            "config",
                            "invoiceCounter"
                        ),

                        {
                            lastNumber:
                                usedNumber
                        },

                        {
                            merge:
                                true
                        }

                    ).catch(
                        console.error
                    );
                }


                if (
                    saveCheckbox.checked
                ) {

                    const invoiceRecord = {

                        invoiceNumber:
                            currentData.invNum,

                        date:
                            currentData.dateString,

                        clientName:
                            currentData.clientName,

                        clientAddress:
                            currentData.clientAddress,

                        items:
                            cart,

                        subtotal:
                            currentData.subtotal,

                        discountPct:
                            currentData.discountPct,

                        discountAmount:
                            currentData.discountAmount,

                        total:
                            currentData.finalTotal,

                        savedBy:
                            currentAuthenticatedUser
                                ? currentAuthenticatedUser.email
                                : "System",

                        createdAt:
                            new Date().toISOString()
                    };


                    setDoc(

                        doc(
                            db,
                            "invoices",
                            currentData.invNum
                        ),

                        invoiceRecord

                    )
                        .then(
                            () => {

                                console.log(
                                    `Invoice ${currentData.invNum} saved to cloud.`
                                );
                            }
                        )
                        .catch(
                            console.error
                        );
                }


                return;
            }
        }


        setButtonLoading(
            generateBtn,
            true,
            "Preparing…"
        );


        try {

            await prepareInvoicePdfCache();


            const refreshedData =
                getCurrentInvoicePdfData();


            /*
             * iOS fallback:
             * If the cache became ready during this click,
             * share it immediately.
             */

            if (

                isIOSBrowser() &&

                preparedInvoicePdf &&

                preparedInvoiceSignature ===
                    refreshedData.signature

            ) {

                if (
                    sharePreparedInvoicePdf()
                ) {

                    const numericMatch =
                        refreshedData.invNum.match(
                            /\d+/
                        );


                    if (numericMatch) {

                        const usedNumber =
                            parseInt(
                                numericMatch[0],
                                10
                            );

                        setDoc(

                            doc(
                                db,
                                "config",
                                "invoiceCounter"
                            ),

                            {
                                lastNumber:
                                    usedNumber
                            },

                            {
                                merge:
                                    true
                            }

                        ).catch(
                            console.error
                        );
                    }


                    if (
                        saveCheckbox.checked
                    ) {

                        const invoiceRecord = {

                            invoiceNumber:
                                refreshedData.invNum,

                            date:
                                refreshedData.dateString,

                            clientName:
                                refreshedData.clientName,

                            clientAddress:
                                refreshedData.clientAddress,

                            items:
                                cart,

                            subtotal:
                                refreshedData.subtotal,

                            discountPct:
                                refreshedData.discountPct,

                            discountAmount:
                                refreshedData.discountAmount,

                            total:
                                refreshedData.finalTotal,

                            savedBy:
                                currentAuthenticatedUser
                                    ? currentAuthenticatedUser.email
                                    : "System",

                            createdAt:
                                new Date().toISOString()
                        };


                        setDoc(

                            doc(
                                db,
                                "invoices",
                                refreshedData.invNum
                            ),

                            invoiceRecord

                        )
                            .then(
                                () => {

                                    console.log(
                                        `Invoice ${refreshedData.invNum} saved to cloud.`
                                    );
                                }
                            )
                            .catch(
                                console.error
                            );
                    }


                    setButtonLoading(
                        generateBtn,
                        false
                    );

                    return;
                }
            }


            /*
             * Non-iOS / fallback:
             * Navigate directly to the generated PDF.
             */

            if (

                preparedInvoicePdf &&

                preparedInvoiceSignature ===
                    refreshedData.signature

            ) {

                openPreparedPdfFallback(
                    preparedInvoicePdf
                );

            } else {

                throw new Error(
                    "PDF was not ready."
                );
            }


            /*
             * Update invoice counter.
             */

            const numericMatch =
                refreshedData.invNum.match(
                    /\d+/
                );


            if (numericMatch) {

                const usedNumber =
                    parseInt(
                        numericMatch[0],
                        10
                    );

                setDoc(

                    doc(
                        db,
                        "config",
                        "invoiceCounter"
                    ),

                    {
                        lastNumber:
                            usedNumber
                    },

                    {
                        merge:
                            true
                    }

                ).catch(
                    console.error
                );
            }


            /*
             * Save invoice to Firestore if requested.
             */

            if (
                saveCheckbox.checked
            ) {

                const invoiceRecord = {

                    invoiceNumber:
                        refreshedData.invNum,

                    date:
                        refreshedData.dateString,

                    clientName:
                        refreshedData.clientName,

                    clientAddress:
                        refreshedData.clientAddress,

                    items:
                        cart,

                    subtotal:
                        refreshedData.subtotal,

                    discountPct:
                        refreshedData.discountPct,

                    discountAmount:
                        refreshedData.discountAmount,

                    total:
                        refreshedData.finalTotal,

                    savedBy:
                        currentAuthenticatedUser
                            ? currentAuthenticatedUser.email
                            : "System",

                    createdAt:
                        new Date().toISOString()
                };


                setDoc(

                    doc(
                        db,
                        "invoices",
                        refreshedData.invNum
                    ),

                    invoiceRecord

                )
                    .then(
                        () => {

                            console.log(
                                `Invoice ${refreshedData.invNum} saved to cloud.`
                            );
                        }
                    )
                    .catch(
                        console.error
                    );
            }


            setButtonLoading(
                generateBtn,
                false
            );

        } catch (error) {

            console.error(
                "Invoice PDF generation failed:",
                error
            );

            setButtonLoading(
                generateBtn,
                false
            );

            alert(
                "Could not generate the invoice PDF. Please try again."
            );
        }
    }
);


/* =========================================================
   SEARCH SAVED INVOICE
   ========================================================= */

searchBtn.addEventListener(
    "click",
    async (e) => {

        e.preventDefault();
        e.stopPropagation();


        const queryId =
            searchInput.value
                .trim()
                .toUpperCase();


        searchStatusMsg.textContent =
            "";

        searchStatusMsg.className =
            "status-msg";

        viewDetailsBtn.style.display =
            "none";

        searchedInvoiceData =
            null;


        if (!queryId) {

            searchStatusMsg.textContent =
                "Please enter an invoice number.";

            searchStatusMsg.classList.add(
                "status-error"
            );

            return;
        }


        searchStatusMsg.textContent =
            "Searching...";


        setButtonLoading(
            searchBtn,
            true,
            "Searching…"
        );


        try {

            const invRef =
                doc(
                    db,
                    "invoices",
                    queryId
                );

            const invSnap =
                await getDoc(
                    invRef
                );


            if (
                invSnap.exists()
            ) {

                searchedInvoiceData =
                    invSnap.data();

                searchStatusMsg.textContent =
                    `Invoice ${queryId} found!`;

                searchStatusMsg.classList.add(
                    "status-success"
                );

                viewDetailsBtn.style.display =
                    "block";

            } else {

                searchStatusMsg.textContent =
                    `No invoice found for ${queryId}.`;

                searchStatusMsg.classList.add(
                    "status-error"
                );
            }

        } catch (err) {

            console.error(
                "Error searching invoice:",
                err
            );

            searchStatusMsg.textContent =
                "Error fetching invoice.";

            searchStatusMsg.classList.add(
                "status-error"
            );

        } finally {

            setButtonLoading(
                searchBtn,
                false
            );
        }
    }
);


/* =========================================================
   VIEW DETAILS
   ========================================================= */

viewDetailsBtn.addEventListener(
    "click",
    (e) => {

        e.preventDefault();
        e.stopPropagation();


        if (
            !searchedInvoiceData
        ) {

            return;
        }


        detailInvNum.textContent =
            searchedInvoiceData.invoiceNumber;

        detailDate.textContent =
            searchedInvoiceData.date;

        detailClientName.textContent =
            searchedInvoiceData.clientName;

        detailClientAddress.textContent =
            searchedInvoiceData.clientAddress ||
            "None provided";

        detailSavedBy.textContent =
            searchedInvoiceData.savedBy ||
            "N/A";


        detailItemsList.innerHTML =
            "";


        (
            searchedInvoiceData.items ||
            []
        ).forEach(
            (item) => {

                const itemTotal =
                    item.rate *
                    item.qty;

                const div =
                    document.createElement(
                        "div"
                    );

                div.className =
                    "cart-item";

                div.innerHTML = `

                    <div class="cart-item-details">

                        <span class="cart-item-title">
                            ${item.name}
                        </span>

                        <span class="cart-item-math">
                            ${item.qty}
                            x
                            ${formatINR(item.rate)}
                            =
                            ${formatINR(itemTotal)}
                            (Batch:
                            ${item.batch || "N/A"},
                            Mfg:
                            ${item.mfg || "N/A"})
                        </span>

                    </div>

                `;

                detailItemsList.appendChild(
                    div
                );
            }
        );


        detailSubtotal.textContent =
            formatINR(
                searchedInvoiceData.subtotal ||
                0
            );


        detailDiscount.textContent =
            `- ${formatINR(
                searchedInvoiceData.discountAmount ||
                0
            )}`;


        detailTotal.textContent =
            `Total: ${formatINR(
                searchedInvoiceData.total ||
                0
            )}`;


        appScreen.style.display =
            "none";

        detailsScreen.style.display =
            "block";
    }
);


/* =========================================================
   BACK FROM DETAILS
   ========================================================= */

detailsBackBtn.addEventListener(
    "click",
    (e) => {

        e.preventDefault();
        e.stopPropagation();

        detailsScreen.style.display =
            "none";

        appScreen.style.display =
            "block";
    }
);


/* =========================================================
   INITIAL PDF PREPARATION
   ========================================================= */

setTimeout(
    () => {

        scheduleInvoicePdfPreparation();

    },
    1000
);