// Owner App Logic: Multi-Car, 8-Char ID, Car Photo Upload, Custom Sticker, & Site Customizer

let allReports = [];
let allCars = [];
let siteSettings = { ...DEFAULT_SITE_SETTINGS };
let currentFilter = 'all';
let currentCarFilter = 'all';
let currentReport = null;
let previousCount = null;
let deferredInstallPrompt = null;
let activeQRLink = "";
let currentEditingCarImage = null;

let unsubCars = null;
let unsubSettings = null;
let unsubReports = null;
let appInitialized = false;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
    registerPWA();
    setupInstallBanner();
    initAuthGuard();
});

// =========================================================================
// OWNER AUTHENTICATION GUARD (حماية تطبيق المالك بكلمة سر)
// =========================================================================
async function initAuthGuard() {
    const authScreen = document.getElementById("auth-screen");
    const firstSetupWrapper = document.getElementById("auth-first-setup-wrapper");

    if (isDemoMode || !auth) {
        if (authScreen) authScreen.classList.add("hidden");
        initApp();
        checkNotificationStatus();
        return;
    }

    // إخفاء زر "إنشاء حساب لأول مرة" إذا كان المالك قد سجل حسابه بالفعل
    checkIsOwnerRegistered().then((isRegistered) => {
        if (isRegistered && firstSetupWrapper) {
            firstSetupWrapper.classList.add("hidden");
        }
    });

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const isAuthorizedOwner = await verifyOrBindOwnerAccount(user);
            if (!isAuthorizedOwner) {
                showAuthError("عفواً، هذا التطبيق مربوط بحساب مالك السيارة فقط ولا يمكن الدخول بحساب آخر.");
                if (authScreen) authScreen.classList.remove("hidden");
                return;
            }

            if (authScreen) authScreen.classList.add("hidden");
            if (firstSetupWrapper) firstSetupWrapper.classList.add("hidden");

            const accountDesc = document.getElementById("owner-account-desc");
            if (accountDesc) {
                accountDesc.textContent = `🔒 حساب المالك: ${user.email}`;
            }

            initApp();
            checkNotificationStatus();
        } else {
            stopSubscriptions();
            if (authScreen) authScreen.classList.remove("hidden");
        }
    });
}

function stopSubscriptions() {
    if (typeof unsubCars === "function") { unsubCars(); unsubCars = null; }
    if (typeof unsubSettings === "function") { unsubSettings(); unsubSettings = null; }
    if (typeof unsubReports === "function") { unsubReports(); unsubReports = null; }
    appInitialized = false;
    allReports = [];
    allCars = [];
    previousCount = null;
}

function showAuthError(msgHtml) {
    const box = document.getElementById("auth-error-box");
    if (!box) return;
    box.innerHTML = msgHtml;
    box.classList.remove("hidden");
}

function hideAuthError() {
    const box = document.getElementById("auth-error-box");
    if (box) box.classList.add("hidden");
}

function formatFirebaseAuthError(err) {
    const code = (err && err.code) ? err.code : "";
    if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found") {
        const pid = (typeof firebaseConfig !== "undefined" && firebaseConfig.projectId) ? firebaseConfig.projectId : "";
        const authUrl = pid ? `https://console.firebase.google.com/project/${pid}/authentication/providers` : "https://console.firebase.google.com/";
        return `يرجى تفعيل خيار <b>Email/Password</b> من لوحة تحكم Firebase أولاً:<br><a href="${authUrl}" target="_blank" class="underline text-emerald-400">اضغط هنا لفتح صفحة التفعيل في Firebase</a>`;
    }
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }
    if (code === "auth/email-already-in-use") {
        return "هذا البريد مسجل بالفعل! اضغط على زر 'تسجيل الدخول للتطبيق' مباشرة.";
    }
    if (code === "auth/weak-password") {
        return "يرجى اختيار كلمة مرور قوية (6 خانات على الأقل).";
    }
    if (code === "auth/invalid-email") {
        return "يرجى كتابة بريد إلكتروني صحيح.";
    }
    return "حدث خطأ أثناء الدخول: " + (err.message || code);
}

async function handleOwnerLogin(event) {
    if (event) event.preventDefault();
    hideAuthError();

    const email = document.getElementById("auth-email").value.trim();
    const pass = document.getElementById("auth-password").value;
    const btn = document.getElementById("btn-auth-login");

    if (!email || !pass) {
        showAuthError("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
        return;
    }

    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري التحقق...</span>`;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
        showAuthError(formatFirebaseAuthError(err));
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}

async function handleOwnerRegister() {
    hideAuthError();

    const email = document.getElementById("auth-email").value.trim();
    const pass = document.getElementById("auth-password").value;
    const btn = document.getElementById("btn-auth-register");

    if (!email || !pass || pass.length < 6) {
        showAuthError("يرجى كتابة بريدك الإلكتروني وكلمة مرور (6 خانات على الأقل) في الحقول بالأعلى أولاً ثم الضغط على إنشاء حساب المالك.");
        return;
    }

    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري إنشاء وقفل حساب المالك...</span>`;

    try {
        const alreadyHasOwner = await checkIsOwnerRegistered();
        if (alreadyHasOwner) {
            showAuthError("تم إعداد حساب المالك مسبقاً! يرجى تسجيل الدخول بحساب المالك مباشرة.");
            return;
        }
        await auth.createUserWithEmailAndPassword(email, pass);
    } catch (err) {
        showAuthError(formatFirebaseAuthError(err));
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}

async function handleOwnerLogout() {
    if (auth) {
        await auth.signOut();
    }
}

function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    updateDatabaseStatus();
    loadSettings();

    // 1. Subscribe to Cars list in real-time
    unsubCars = subscribeToCars((cars) => {
        allCars = cars || [];
        renderCarFilterBar();
        renderCarsManagementTab();
        renderReportsList();
    });

    // 2. Subscribe to Site Settings (Theme, Titles, Issues Order, Language, App Branding)
    unsubSettings = subscribeToSiteSettings((settings) => {
        siteSettings = JSON.parse(JSON.stringify(settings));
        populateSiteCustomizerUI();
        syncBrandingAndLangFromSettings(siteSettings);
    });

    // 3. Subscribe to Reports list in real-time
    unsubReports = subscribeToReports((reports) => {
        allReports = reports || [];

        if (previousCount !== null && allReports.length > previousCount) {
            playAlertSound();
            if (navigator.vibrate) navigator.vibrate([300, 100, 300]);

            const latestReport = allReports[0];
            if (latestReport) {
                showSystemNotification(latestReport);
            }
        }
        previousCount = allReports.length;

        updateStats();
        renderReportsList();
    });
}

// Register PWA Service Worker
function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("PWA Service Worker registered"))
            .catch(err => console.log("SW failed:", err));
    }
}

// Setup PWA Installation
function setupInstallBanner() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        const banner = document.getElementById("install-banner");
        if (banner) banner.classList.remove("hidden");
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        const banner = document.getElementById("install-banner");
        if (banner) banner.classList.add("hidden");
    });
}

function triggerInstallPWA() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                document.getElementById("install-banner").classList.add("hidden");
            }
            deferredInstallPrompt = null;
        });
    } else {
        alert("لتثبيت التطبيق على هاتفك:\n- أندرويد (Chrome): اضغط على قائمة المتصفح (⋮) ثم اختر 'تثبيت التطبيق' أو 'إضافة إلى الشاشة الرئيسية'.\n- آيفون (Safari): اضغط على زر المشاركة ثم 'إضافة إلى الشاشة الرئيسية'.");
    }
}

// Notification System
function checkNotificationStatus() {
    const banner = document.getElementById("notification-banner");
    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            // إذا كان مسموحاً بالفعل، نربط الموبايل بإشعارات الخلفية تلقائياً فور فتح التطبيق
            registerDeviceForBackgroundPush().then(() => {
                if (banner) banner.classList.add("hidden");
                loadPushConfigUI();
            }).catch(() => {
                if (banner) banner.classList.remove("hidden");
            });
        } else {
            if (banner) banner.classList.remove("hidden");
        }
    }
}

async function requestNotificationAccess() {
    if (!("Notification" in window)) {
        alert("متصفحك لا يدعم الإشعارات.");
        return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        document.getElementById("notification-banner").classList.add("hidden");
        // محاولة ربط الموبايل بإشعارات الخلفية تلقائياً إذا كانت مفاتيح FCM محفوظة
        try {
            await registerDeviceForBackgroundPush();
            loadPushConfigUI();
        } catch (e) {
            console.log("Background push registration note:", e.message);
        }
        showSystemNotification({
            id: "test",
            carName: "تنبيهات سيارتي",
            issues: ["تم تفعيل الإشعارات بنجاح!"],
            carPlate: "سياراتك متصلة"
        });
    } else {
        alert("يرجى السماح بالإشعارات من إعدادات المتصفح ليصلك تنبيه عند وجود بلاغ.");
    }
}

function showSystemNotification(report) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const carInfo = findCarByReport(report);
    const title = `🚨 بلاغ جديد: ${carInfo.name} (${carInfo.plate})`;
    const body = `${(report.issues && report.issues[0]) || 'تنبيه جديد'} - ${report.note || ''}`;

    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
                body: body,
                icon: "./icon-192.png",
                badge: "./icon-192.png",
                vibrate: [300, 100, 300, 100, 300],
                tag: report.id || "car-alert",
                renotify: true
            });
        }).catch(() => {
            new Notification(title, { body: body, icon: "./icon-192.png" });
        });
    } else {
        new Notification(title, { body: body, icon: "./icon-192.png" });
    }
}

// Notification Chime Sound
function playAlertSound() {
    const soundEl = document.getElementById("setting-sound");
    if (soundEl && !soundEl.checked) return;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;

        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, now);
        osc1.frequency.setValueAtTime(880.00, now + 0.1);
        osc1.frequency.setValueAtTime(1174.66, now + 0.2);

        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);

        osc1.start(now);
        osc1.stop(now + 0.45);
    } catch (e) {}
}

// Helper: Match report to its live Car data
function findCarByReport(report) {
    if (report.carId) {
        const matched = allCars.find(c => c.id === report.carId);
        if (matched) return matched;
    }
    return {
        id: report.carId || "K8M3X9P2",
        name: report.carName || "السيارة الأولى",
        plate: report.carPlate || "أ ب ج 1234",
        color: report.carColor || "#10B981",
        icon: report.carIcon || "fa-car-side",
        image: null
    };
}

// Render Car Filter Bar in Reports Tab
function renderCarFilterBar() {
    const bar = document.getElementById("car-filter-bar");
    if (!bar) return;

    let html = `
        <button type="button" onclick="setCarFilter('all')" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${currentCarFilter === 'all' ? 'bg-white text-slate-950 border-white shadow-sm' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}">
            <i class="fa-solid fa-layer-group"></i>
            <span>كل السيارات (${allReports.length})</span>
        </button>
    `;

    allCars.forEach(car => {
        const isSelected = currentCarFilter === car.id;
        const count = allReports.filter(r => r.carId === car.id).length;
        const iconClass = car.icon || "brand-mitsubishi";
        const carColor = getCarThemeColor(car);
        html += `
            <button type="button" onclick="setCarFilter('${car.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${isSelected ? 'bg-slate-800 text-white border-emerald-500 shadow-sm' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}">
                <span style="color: ${carColor};">${renderCarIconMarkup(iconClass)}</span>
                <span>${car.name}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-slate-300 font-mono">${count}</span>
            </button>
        `;
    });

    bar.innerHTML = html;
}

function setCarFilter(carId) {
    currentCarFilter = carId;
    renderCarFilterBar();
    updateStats();
    renderReportsList();
}

// Update App Counters
function updateStats() {
    let baseList = allReports;
    if (currentCarFilter !== 'all') {
        baseList = allReports.filter(r => r.carId === currentCarFilter);
    }

    const total = baseList.length;
    const newCount = baseList.filter(r => r.status === 'new').length;
    const resolvedCount = baseList.filter(r => r.status === 'resolved').length;

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-new").textContent = newCount;
    document.getElementById("stat-resolved").textContent = resolvedCount;
    renderCarFilterBar();
}

// Set Status Filter
function setFilter(filterType, btnEl) {
    currentFilter = filterType;
    document.querySelectorAll(".filter-chip").forEach(chip => {
        chip.classList.remove("active");
        chip.classList.add("text-slate-400");
    });
    if (btnEl) {
        btnEl.classList.add("active");
        btnEl.classList.remove("text-slate-400");
    }
    renderReportsList();
}

// Render Reports List
function renderReportsList() {
    const listContainer = document.getElementById("reports-list");
    const emptyState = document.getElementById("empty-state");

    let filtered = allReports;
    if (currentCarFilter !== 'all') {
        filtered = filtered.filter(r => r.carId === currentCarFilter);
    }
    if (currentFilter === 'new') {
        filtered = filtered.filter(r => r.status === 'new');
    } else if (currentFilter === 'resolved') {
        filtered = filtered.filter(r => r.status === 'resolved');
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = "";
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    listContainer.innerHTML = filtered.map(report => {
        const isNew = report.status === 'new';
        const primaryIssue = (report.issues && report.issues[0]) ? report.issues[0] : "تنبيه عام";
        const iconInfo = getIssueIcon(primaryIssue);
        const relativeTime = getRelativeTime(report.createdAt);
        const carInfo = findCarByReport(report);
        const carColor = getCarThemeColor(carInfo);
        const carIcon = carInfo.icon || "brand-mitsubishi";

        const carVisualHtml = carInfo.image
            ? `<img src="${carInfo.image}" class="w-6 h-6 rounded-lg object-cover border border-slate-700">`
            : `<span style="background-color: ${carColor}25; color: ${carColor};" class="w-6 h-6 rounded-lg flex items-center justify-center text-xs">${renderCarIconMarkup(carIcon)}</span>`;

        return `
            <div onclick="openReportDetail('${report.id}')" class="bg-slate-900/90 hover:bg-slate-800/90 border ${isNew ? 'border-rose-500/40 shadow-lg shadow-rose-500/5' : 'border-slate-800'} p-3.5 rounded-2xl cursor-pointer transition-all active:scale-[0.98]">
                <div class="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5">
                    <div class="flex items-center gap-1.5">
                        ${carVisualHtml}
                        <span class="text-[11px] font-bold text-white">${carInfo.name}</span>
                        <span class="text-[10px] font-mono bg-slate-950 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800">${carInfo.plate}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-[10px] text-slate-400 font-mono">${relativeTime}</span>
                        <span class="text-[9px] px-2 py-0.5 rounded-full font-bold ${isNew ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                            ${isNew ? 'جديد' : 'تم الحل'}
                        </span>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-2xl ${iconInfo.bg} ${iconInfo.color} flex items-center justify-center text-lg flex-shrink-0">
                        <i class="${iconInfo.icon}"></i>
                    </span>
                    <div class="flex-grow">
                        <div class="flex items-center gap-2">
                            <h4 class="text-xs font-bold text-white">${primaryIssue}</h4>
                            ${isNew ? '<span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>' : ''}
                        </div>
                        <p class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            ${report.note || 'بدون تفاصيل إضافية'}
                        </p>
                    </div>
                    <i class="fa-solid fa-chevron-left text-xs text-slate-600"></i>
                </div>
            </div>
        `;
    }).join('');
}

// =========================================================================
// TAB 2: CARS MANAGEMENT (الـ ID العشوائي من 8 خانات، صورة العربية، الشكل واللون)
// =========================================================================

function getBasePublicUrl() {
    const input = document.getElementById("config-github-url");
    let url = (input && input.value.trim()) ? input.value.trim() : window.location.origin;
    return url.replace(/\/+$/, '');
}

function getCarLink(carId) {
    return `${getBasePublicUrl()}/?id=${encodeURIComponent(carId)}`;
}

function renderCarsManagementTab() {
    const container = document.getElementById("cars-list-container");
    if (!container) return;

    container.innerHTML = allCars.map((car) => {
        const carColor = getCarThemeColor(car);
        const carIcon = car.icon || "brand-mitsubishi";
        const carLink = getCarLink(car.id);

        const visualAvatar = car.image
            ? `<img src="${car.image}" alt="${car.name}" class="w-16 h-14 rounded-2xl object-contain bg-slate-950 p-1 border border-slate-800 shadow-md">`
            : `<div style="background-color: ${carColor}; box-shadow: 0 6px 16px -3px ${carColor}66;" class="w-14 h-14 rounded-2xl text-white flex items-center justify-center text-2xl">${renderCarIconMarkup(carIcon, "w-7 h-7")}</div>`;

        return `
            <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-3">
                        ${visualAvatar}
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-sm font-black text-white">${car.name}</h3>
                                <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-emerald-400 font-mono tracking-wider" title="كود السيارة (8 خانات)">ID: ${car.id}</span>
                            </div>
                            <div class="text-xs font-mono font-bold text-slate-300 mt-0.5">
                                الرقم: <span style="color: ${carColor};">${car.plate}</span>
                                ${car.colorName ? `<span class="text-slate-400 font-sans mr-2">• اللون: ${car.colorName}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <button onclick="openCarEditModal('${car.id}')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all">
                        <i class="fa-solid fa-pen-to-square text-emerald-400"></i>
                        <span>تعديل وصورة</span>
                    </button>
                </div>

                <!-- Dedicated Street Link Box -->
                <div class="bg-slate-950 border border-slate-800/80 rounded-2xl p-2.5 mb-3 flex items-center justify-between gap-2">
                    <div class="truncate text-left dir-ltr flex-grow">
                        <span class="text-[10px] text-slate-500 block text-right mb-0.5">لينك الإبلاغ الخاص بهذه السيارة:</span>
                        <a href="${carLink}" target="_blank" dir="ltr" class="text-[11px] font-mono text-emerald-400 hover:underline truncate block">${carLink}</a>
                    </div>
                    <button onclick="copyTextToClipboard('${carLink}', 'تم نسخ لينك ${car.name} بنجاح!')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex-shrink-0 flex items-center gap-1">
                        <i class="fa-solid fa-copy"></i>
                        <span>نسخ</span>
                    </button>
                </div>

                <!-- Action Buttons -->
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="openQRModal('${car.id}')" style="background-color: ${carColor}20; color: ${carColor}; border-color: ${carColor}40;" class="py-2.5 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 hover:opacity-90 transition-all">
                        <i class="fa-solid fa-qrcode"></i>
                        <span>الاستيكر والباركود</span>
                    </button>
                    <button onclick="sendMockReportForCar('${car.id}')" class="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/70 text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                        <i class="fa-solid fa-bolt text-amber-400"></i>
                        <span>تجربة بلاغ للسيارة</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Open Car Edit / Create Modal
function openCarEditModal(carId) {
    const modal = document.getElementById("car-edit-modal");
    const deleteBtn = document.getElementById("btn-delete-car");
    const fileInput = document.getElementById("edit-car-image-input");
    if (fileInput) fileInput.value = "";

    let car = null;
    if (carId) {
        car = allCars.find(c => c.id === carId);
    }

    if (car) {
        document.getElementById("edit-car-original-id").value = car.id;
        document.getElementById("edit-car-id").value = car.id;
        document.getElementById("edit-car-name").value = car.name || "";
        document.getElementById("edit-car-plate").value = car.plate || "";
        document.getElementById("edit-car-color-name").value = car.colorName || "";
        document.getElementById("edit-car-subtitle").value = car.subtitle || "";
        document.getElementById("edit-car-color").value = getCarThemeColor(car);
        document.getElementById("edit-car-icon").value = car.icon || "brand-mitsubishi";
        currentEditingCarImage = car.image || null;

        if (allCars.length > 1) {
            deleteBtn.classList.remove("hidden");
        } else {
            deleteBtn.classList.add("hidden");
        }
    } else {
        const nextNum = allCars.length + 1;
        const newRandomId = generateRandomCarId(8);
        document.getElementById("edit-car-original-id").value = "";
        document.getElementById("edit-car-id").value = newRandomId;
        document.getElementById("edit-car-name").value = `السيارة رقم ${nextNum}`;
        document.getElementById("edit-car-plate").value = "م ص ر 1111";
        document.getElementById("edit-car-color-name").value = "أحمر";
        document.getElementById("edit-car-subtitle").value = "";
        document.getElementById("edit-car-color").value = "#E31E24";
        document.getElementById("edit-car-icon").value = "brand-mitsubishi";
        currentEditingCarImage = null;
        deleteBtn.classList.add("hidden");
    }

    updateCarPreview();
    modal.classList.remove("hidden");
}

function closeCarEditModal() {
    document.getElementById("car-edit-modal").classList.add("hidden");
}

function regenerateModalCarId() {
    document.getElementById("edit-car-id").value = generateRandomCarId(8);
}

// Handle Car Image Upload & Save as Pure Transparent PNG
function handleCarImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const maxDim = 420;
            let w = img.width;
            let h = img.height;
            if (w > h) {
                if (w > maxDim) { h = Math.round(h * (maxDim / w)); w = maxDim; }
            } else {
                if (h > maxDim) { w = Math.round(w * (maxDim / h)); h = maxDim; }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            // Always use PNG to preserve 100% transparency across all devices
            currentEditingCarImage = canvas.toDataURL("image/png");
            updateCarPreview();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Smart One-Click Background Remover (Flood-fill from corners for black or white backgrounds)
function removeCarImageBackground() {
    if (!currentEditingCarImage) return;
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement("canvas");
        const w = img.width;
        const h = img.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Detect corner color (black or white/solid color)
        const r0 = data[0], g0 = data[1], b0 = data[2];
        const tolerance = 38;

        const isMatch = (idx) => {
            const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
            if (a === 0) return true;
            return Math.abs(r - r0) <= tolerance &&
                   Math.abs(g - g0) <= tolerance &&
                   Math.abs(b - b0) <= tolerance;
        };

        const visited = new Uint8Array(w * h);
        const stack = [];

        for (let x = 0; x < w; x++) {
            stack.push(x, 0);
            stack.push(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
            stack.push(0, y);
            stack.push(w - 1, y);
        }

        while (stack.length > 0) {
            const cy = stack.pop();
            const cx = stack.pop();
            if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
            const pos = cy * w + cx;
            if (visited[pos]) continue;
            visited[pos] = 1;

            const pixelIdx = pos * 4;
            if (isMatch(pixelIdx)) {
                data[pixelIdx + 3] = 0; // Make transparent
                stack.push(cx + 1, cy);
                stack.push(cx - 1, cy);
                stack.push(cx, cy + 1);
                stack.push(cx, cy - 1);
            }
        }

        ctx.putImageData(imgData, 0, 0);
        currentEditingCarImage = canvas.toDataURL("image/png");
        updateCarPreview();
    };
    img.src = currentEditingCarImage;
}

function clearCarImage() {
    currentEditingCarImage = null;
    const fileInput = document.getElementById("edit-car-image-input");
    if (fileInput) fileInput.value = "";
    updateCarPreview();
}

// تحويل اسم لون العربية المكتوب بالعربي إلى كود لون الثيم المقابل تلقائياً
function resolveColorFromArabicName(colorName) {
    if (!colorName || typeof colorName !== "string") return null;
    const t = colorName.trim().toLowerCase();
    if (t.includes("احمر") || t.includes("أحمر") || t.includes("حمراء") || t.includes("red")) return "#E31E24";
    if (t.includes("نبيتي") || t.includes("عنابي") || t.includes("دم الغزال") || t.includes("maroon")) return "#991B1B";
    if (t.includes("ازرق") || t.includes("أزرق") || t.includes("زرقاء") || t.includes("لبني") || t.includes("blue")) return "#2563EB";
    if (t.includes("كحلي") || t.includes("بترولي") || t.includes("navy")) return "#1E3A8A";
    if (t.includes("اخضر") || t.includes("أخضر") || t.includes("زيتي") || t.includes("green")) return "#10B981";
    if (t.includes("ذهبي") || t.includes("دهبي") || t.includes("اصفر") || t.includes("أصفر") || t.includes("شامبين") || t.includes("بيج") || t.includes("gold")) return "#D97706";
    if (t.includes("برتقالي") || t.includes("اورنج") || t.includes("orange")) return "#EA580C";
    if (t.includes("بني") || t.includes("موكا") || t.includes("brown")) return "#78350F";
    if (t.includes("بنفسجي") || t.includes("موف") || t.includes("purple")) return "#7C3AED";
    if (t.includes("فضي") || t.includes("سيلفر") || t.includes("رمادي") || t.includes("فيراني") || t.includes("جراي") || t.includes("silver") || t.includes("gray")) return "#475569";
    if (t.includes("اسود") || t.includes("أسود") || t.includes("سوداء") || t.includes("black")) return "#18181B";
    if (t.includes("ابيض") || t.includes("أبيض") || t.includes("بيضاء") || t.includes("white")) return "#334155";
    return null;
}

function getCarThemeColor(car) {
    if (!car) return "#E31E24";
    const mappedFromName = resolveColorFromArabicName(car.colorName);
    // إذا كان اللون المخزن هو الأخضر الافتراضي القديم وكان اسم اللون مكتوباً (مثل أحمر أو فضي)، نستخدم اللون المطابق لاسم لون العربية
    if (mappedFromName && (!car.color || car.color === "#10B981")) {
        return mappedFromName;
    }
    return car.color || mappedFromName || "#E31E24";
}

function renderCarIconMarkup(iconClass, extraClass = "") {
    if (iconClass === "brand-mitsubishi") {
        return `<svg class="w-5 h-5 fill-current inline-block ${extraClass}" viewBox="0 0 200 180"><polygon points="100,11 130,63 100,115 70,63"/><polygon points="100,115 40,115 10,167 70,167"/><polygon points="100,115 160,115 190,167 130,167"/></svg>`;
    }
    return `<i class="fa-solid ${iconClass || 'fa-car-side'} ${extraClass}"></i>`;
}

function handleCarColorNameInput(val) {
    const mapped = resolveColorFromArabicName(val);
    if (mapped) {
        document.getElementById("edit-car-color").value = mapped;
    }
    updateCarPreview();
}

function selectCarIconShape(iconClass) {
    document.getElementById("edit-car-icon").value = iconClass;
    updateCarPreview();
}

function selectCarColor(hexColor) {
    document.getElementById("edit-car-color").value = hexColor;
    updateCarPreview();
}

function updateCarPreview() {
    const name = document.getElementById("edit-car-name").value.trim() || "اسم نوع العربية";
    const plate = document.getElementById("edit-car-plate").value.trim() || "أ ب ج 1234";
    const colorName = document.getElementById("edit-car-color-name").value.trim();
    const color = document.getElementById("edit-car-color").value || "#E31E24";
    const iconClass = document.getElementById("edit-car-icon").value || "brand-mitsubishi";

    document.getElementById("preview-car-name").textContent = name;
    document.getElementById("preview-car-plate").textContent = plate;
    const colorNamePreview = document.getElementById("preview-car-color-name");
    if (colorNamePreview) {
        colorNamePreview.textContent = colorName || "";
        colorNamePreview.style.display = colorName ? "block" : "none";
        colorNamePreview.style.color = color;
    }

    const photoBox = document.getElementById("preview-car-photo-box");
    const photoImg = document.getElementById("preview-car-photo-img");
    const iconBox = document.getElementById("preview-car-icon-box");
    const clearImgBtn = document.getElementById("btn-clear-car-image");
    const removeBgBtn = document.getElementById("btn-remove-bg-image");

    if (currentEditingCarImage) {
        photoBox.classList.remove("hidden");
        photoImg.src = currentEditingCarImage;
        iconBox.classList.add("hidden");
        clearImgBtn.classList.remove("hidden");
        if (removeBgBtn) removeBgBtn.classList.remove("hidden");
    } else {
        photoBox.classList.add("hidden");
        iconBox.classList.remove("hidden");
        iconBox.style.backgroundColor = color;
        iconBox.style.boxShadow = `0 8px 20px -4px ${color}80`;
        iconBox.innerHTML = iconClass === "brand-mitsubishi"
            ? `<svg class="w-9 h-9 fill-current text-white" viewBox="0 0 200 180"><polygon points="100,11 130,63 100,115 70,63"/><polygon points="100,115 40,115 10,167 70,167"/><polygon points="100,115 160,115 190,167 130,167"/></svg>`
            : `<i id="preview-car-icon-el" class="fa-solid ${iconClass} text-white"></i>`;
        clearImgBtn.classList.add("hidden");
        if (removeBgBtn) removeBgBtn.classList.add("hidden");
    }

    document.querySelectorAll(".car-shape-btn").forEach(btn => {
        const i = btn.querySelector("i");
        const isMitsubishiBtn = !i && btn.querySelector("svg");
        const matched = (iconClass === "brand-mitsubishi" && isMitsubishiBtn) || (i && i.classList.contains(iconClass));
        if (matched) {
            btn.classList.add("border-emerald-500", "bg-emerald-500/15");
        } else {
            btn.classList.remove("border-emerald-500", "bg-emerald-500/15");
        }
    });
}

async function saveCarFromModal() {
    const originalId = document.getElementById("edit-car-original-id").value.trim();
    let carId = document.getElementById("edit-car-id").value.trim().toUpperCase();
    const name = document.getElementById("edit-car-name").value.trim();
    const plate = document.getElementById("edit-car-plate").value.trim();
    const colorName = document.getElementById("edit-car-color-name").value.trim();
    const subtitle = document.getElementById("edit-car-subtitle").value.trim();
    const color = document.getElementById("edit-car-color").value;
    const icon = document.getElementById("edit-car-icon").value || "brand-mitsubishi";

    if (!carId || carId.length !== 8) {
        carId = generateRandomCarId(8);
    }

    if (!name || !plate) {
        alert("يرجى إدخال اسم نوع العربية ورقم العربية!");
        return;
    }

    const existing = allCars.find(c => c.id === (originalId || carId));
    const order = existing ? (existing.order || 1) : (allCars.length + 1);

    await saveCarData(carId, {
        name,
        plate,
        colorName,
        subtitle,
        color,
        icon,
        image: currentEditingCarImage || null,
        order
    }, originalId);

    closeCarEditModal();
}

async function deleteCarFromModal() {
    const carId = document.getElementById("edit-car-original-id").value.trim() || document.getElementById("edit-car-id").value.trim();
    if (!carId) return;
    if (confirm("هل أنت متأكد من حذف هذه السيارة؟")) {
        await removeCarData(carId);
        closeCarEditModal();
    }
}

// =========================================================================
// STICKER MODAL (التصميم الجديد الملون بثيم لون العربية + تحميل صورة PNG عالية الدقة)
// =========================================================================
let activeStickerCarId = null;
let activeStickerThemeColor = "#E31E24";
let activeStickerLogoMode = "mitsubishi"; // 'mitsubishi' | 'icon' | 'photo'

function openQRModal(carId) {
    const car = allCars.find(c => c.id === carId);
    if (!car) return;

    activeStickerCarId = car.id;
    activeStickerThemeColor = getCarThemeColor(car);
    if (car.stickerLogoMode) {
        activeStickerLogoMode = car.stickerLogoMode;
    } else if (car.icon && car.icon !== "brand-mitsubishi" && !car.name.includes("ميتسوبيشي") && !car.name.toLowerCase().includes("mitsubishi") && !car.name.includes("لانسر")) {
        activeStickerLogoMode = "mitsubishi";
    } else {
        activeStickerLogoMode = "mitsubishi";
    }

    const customColorInput = document.getElementById("sticker-custom-color");
    if (customColorInput) customColorInput.value = activeStickerThemeColor;

    const modal = document.getElementById("qr-sticker-modal");
    activeQRLink = getCarLink(car.id);

    const qrBox = document.getElementById("qrcode-box");
    qrBox.innerHTML = "";

    try {
        new QRCode(qrBox, {
            text: activeQRLink,
            width: 178,
            height: 178,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    } catch (e) {
        console.error("QR Error:", e);
    }

    applyStickerThemeUI();
    modal.classList.remove("hidden");
}

function applyStickerThemeUI() {
    const car = allCars.find(c => c.id === activeStickerCarId) || allCars[0];
    const themeColor = activeStickerThemeColor || "#E31E24";

    const belaghniEl = document.getElementById("sticker-title-belaghni");
    const qrFrameEl = document.getElementById("sticker-qr-frame");
    const visualBox = document.getElementById("sticker-car-visual-box");

    if (belaghniEl) belaghniEl.style.color = themeColor;
    if (qrFrameEl) qrFrameEl.style.borderColor = themeColor;
    if (visualBox) {
        visualBox.style.color = themeColor;
        if (activeStickerLogoMode === "photo" && car && car.image) {
            visualBox.innerHTML = `<img src="${car.image}" alt="${car.name}" class="w-full h-full object-contain">`;
        } else if (activeStickerLogoMode === "icon") {
            const iconCls = (car && car.icon && car.icon !== "brand-mitsubishi") ? car.icon : "fa-car-side";
            visualBox.innerHTML = `<i class="fa-solid ${iconCls} text-6xl" style="color: ${themeColor};"></i>`;
        } else {
            // شعار ميتسوبيشي الثلاثي بنفس اللون بالضبط
            visualBox.innerHTML = `
                <svg class="w-20 h-20" style="fill: ${themeColor};" viewBox="0 0 200 180">
                    <polygon points="100,11 130,63 100,115 70,63"/>
                    <polygon points="100,115 40,115 10,167 70,167"/>
                    <polygon points="100,115 160,115 190,167 130,167"/>
                </svg>
            `;
        }
    }

    // تحديث أزرار اختيار نوع الشعار
    ["mitsubishi", "icon", "photo"].forEach(mode => {
        const btn = document.getElementById(`sticker-logo-btn-${mode}`);
        if (!btn) return;
        if (mode === activeStickerLogoMode) {
            btn.className = "px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold";
        } else {
            btn.className = "px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold";
        }
    });
}

async function changeStickerThemeColor(newHexColor) {
    activeStickerThemeColor = newHexColor;
    applyStickerThemeUI();

    // حفظ اللون في بيانات السيارة أيضاً ليتوحد الثيم في الموقع والتطبيق
    if (activeStickerCarId) {
        const car = allCars.find(c => c.id === activeStickerCarId);
        if (car) {
            car.color = newHexColor;
            await saveCarData(car.id, { ...car, color: newHexColor });
        }
    }
}

async function setStickerLogoMode(mode) {
    const car = allCars.find(c => c.id === activeStickerCarId);
    if (mode === "photo" && (!car || !car.image)) {
        alert("لم تقم برفع صورة لهذه السيارة بعد! يمكنك رفع صورتها من زر (تعديل وصورة).");
        return;
    }
    activeStickerLogoMode = mode;
    applyStickerThemeUI();
    if (car) {
        await saveCarData(car.id, { ...car, stickerLogoMode: mode });
    }
}

// رسم وتحميل الاستيكر كصورة PNG عالية الدقة (بنفس مقاسات وتصميم الصورة المرفقة بالضبط 726x1024 مضاعفة)
async function downloadStickerAsPNG() {
    const car = allCars.find(c => c.id === activeStickerCarId) || allCars[0];
    const themeColor = activeStickerThemeColor || "#E31E24";

    const W = 726 * 2;  // 1452px
    const H = 1024 * 2; // 2048px
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Helper for rounded rectangle path
    const drawRoundedRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    };

    // 1. الإطار الرمادي الخارجي المستدير والخلفية البيضاء
    const padX = 76;
    const padY = 66;
    const cardW = W - padX * 2;
    const cardH = H - padY * 2;
    const radius = 210;
    const borderW = 54;

    drawRoundedRect(padX, padY, cardW, cardH, radius);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = borderW;
    ctx.strokeStyle = "#848688";
    ctx.stroke();

    // 2. رسم الشعار في أعلى اليسار (شعار ميتسوبيشي أو صورة السيارة)
    if (activeStickerLogoMode === "photo" && car && car.image) {
        await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const maxW = 360, maxH = 300;
                const scale = Math.min(maxW / img.width, maxH / img.height);
                const dw = img.width * scale;
                const dh = img.height * scale;
                ctx.drawImage(img, 240 + (maxW - dw) / 2, 210 + (maxH - dh) / 2, dw, dh);
                resolve();
            };
            img.onerror = resolve;
            img.src = car.image;
        });
    } else {
        // رسم شعار ميتسوبيشي الهندسي بدقة فيكتور عالية بلون الثيم
        ctx.save();
        ctx.fillStyle = themeColor;
        const logoX = 225;
        const logoY = 185;
        const scale = 2.05;
        const drawPoly = (pts) => {
            ctx.beginPath();
            pts.forEach((p, idx) => {
                const px = logoX + p[0] * scale;
                const py = logoY + p[1] * scale;
                if (idx === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.fill();
        };
        drawPoly([[100, 11], [130, 63], [100, 115], [70, 63]]);
        drawPoly([[100, 115], [40, 115], [10, 167], [70, 167]]);
        drawPoly([[100, 115], [160, 115], [190, 167], [130, 167]]);
        ctx.restore();
    }

    // 3. رسم كلمة "بلغني" و "العربية فيها مشكلة؟" في أعلى اليمين
    await document.fonts.ready;
    ctx.textAlign = "center";
    ctx.direction = "rtl";

    ctx.fillStyle = themeColor;
    ctx.font = "900 175px 'Cairo', sans-serif";
    ctx.fillText("بلغني", 975, 365);

    ctx.fillStyle = "#000000";
    ctx.font = "800 66px 'Cairo', sans-serif";
    ctx.fillText("العربية فيها مشكلة؟", 975, 515);

    // 4. رسم المربع الملون حول الـ QR Code في المنتصف
    const qrFrameSize = 860;
    const qrFrameX = (W - qrFrameSize) / 2;
    const qrFrameY = 635;
    const qrBorder = 30;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(qrFrameX, qrFrameY, qrFrameSize, qrFrameSize);
    ctx.lineWidth = qrBorder;
    ctx.strokeStyle = themeColor;
    ctx.strokeRect(qrFrameX, qrFrameY, qrFrameSize, qrFrameSize);

    // رسم صورة الـ QR Code داخل المربع
    const qrCanvas = document.querySelector("#qrcode-box canvas");
    const qrImg = document.querySelector("#qrcode-box img");
    const qrSource = qrCanvas || qrImg;
    if (qrSource) {
        const innerPad = 62;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            qrSource,
            qrFrameX + innerPad,
            qrFrameY + innerPad,
            qrFrameSize - innerPad * 2,
            qrFrameSize - innerPad * 2
        );
    }

    // 5. رسم نص "امسح الQR Code" في الأسفل
    ctx.fillStyle = "#000000";
    ctx.font = "800 120px 'Cairo', sans-serif";
    ctx.fillText("امسح الQR Code", W / 2, 1755);

    // تحميل ملف الـ PNG
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `sticker-${car ? car.id : 'car'}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function closeQRModal() {
    document.getElementById("qr-sticker-modal").classList.add("hidden");
}

function copyActiveQRLink() {
    if (activeQRLink) {
        copyTextToClipboard(activeQRLink, "تم نسخ لينك السيارة بنجاح!");
    }
}

function copyTextToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
        alert(successMsg || "تم نسخ الرابط!");
    }).catch(() => {
        prompt("انسخ الرابط التالي:", text);
    });
}

// =========================================================================
// TAB 3: SITE CUSTOMIZER (التحكم في شكل الموقع، العناوين، وترتيب المشاكل)
// =========================================================================

function populateSiteCustomizerUI() {
    selectSiteThemeUI(siteSettings.theme || 'dark');
    selectGridColsUI(siteSettings.gridColumns || 2);

    document.getElementById("cust-main-title").value = siteSettings.mainTitle || "";
    document.getElementById("cust-sub-title").value = siteSettings.subTitle || "";
    document.getElementById("cust-issues-label").value = siteSettings.issuesLabel || "";
    document.getElementById("cust-submit-text").value = siteSettings.submitBtnText || "";
    document.getElementById("cust-success-title").value = siteSettings.successTitle || "";
    document.getElementById("cust-show-note").checked = siteSettings.showNoteField !== false;
    document.getElementById("cust-show-phone").checked = siteSettings.showPhoneField !== false;

    renderCustomizerIssuesList();
}

function selectSiteTheme(themeName) {
    siteSettings.theme = themeName;
    selectSiteThemeUI(themeName);
}

function selectSiteThemeUI(themeName) {
    document.querySelectorAll(".site-theme-btn").forEach(btn => {
        btn.className = "site-theme-btn p-2 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5";
    });
    const active = document.getElementById(`theme-opt-${themeName}`);
    if (active) {
        active.className = "site-theme-btn p-2 rounded-xl border border-emerald-500 bg-emerald-500/10 text-xs font-bold text-white flex items-center justify-center gap-1.5";
    }
}

function selectGridCols(cols) {
    siteSettings.gridColumns = cols;
    selectGridColsUI(cols);
}

function selectGridColsUI(cols) {
    document.querySelectorAll(".grid-col-btn").forEach(btn => {
        btn.className = "grid-col-btn p-2 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5";
    });
    const active = document.getElementById(`grid-opt-${cols}`);
    if (active) {
        active.className = "grid-col-btn p-2 rounded-xl border border-emerald-500 bg-emerald-500/10 text-xs font-bold text-white flex items-center justify-center gap-1.5";
    }
}

function renderCustomizerIssuesList() {
    const container = document.getElementById("customizer-issues-list");
    if (!container) return;

    const list = siteSettings.issuesList || [];
    container.innerHTML = list.map((item, idx) => `
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-2">
            <!-- Order Number & Icon -->
            <span style="background-color: ${item.color || '#10B981'}22; color: ${item.color || '#10B981'};" class="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0">
                <i class="fa-solid ${item.icon || 'fa-triangle-exclamation'}"></i>
            </span>

            <!-- Editable Issue Label -->
            <input type="text" value="${item.label}" oninput="updateIssueLabel(${idx}, this.value)" class="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 outline-none">

            <!-- Up / Down / Delete Controls -->
            <div class="flex items-center gap-1 flex-shrink-0">
                <button type="button" onclick="moveIssueItem(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs flex items-center justify-center" title="تحريك لأعلى">
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button type="button" onclick="moveIssueItem(${idx}, 1)" ${idx === list.length - 1 ? 'disabled' : ''} class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs flex items-center justify-center" title="تحريك لأسفل">
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
                <button type="button" onclick="deleteIssueItem(${idx})" class="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 text-xs flex items-center justify-center" title="حذف">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function updateIssueLabel(index, newText) {
    if (!siteSettings.issuesList[index]) return;
    siteSettings.issuesList[index].label = newText;
    siteSettings.issuesList[index].value = newText;
}

function moveIssueItem(index, direction) {
    const list = siteSettings.issuesList;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;
    renderCustomizerIssuesList();
}

function deleteIssueItem(index) {
    if (siteSettings.issuesList.length <= 1) {
        alert("يجب الإبقاء على مشكلة واحدة على الأقل!");
        return;
    }
    siteSettings.issuesList.splice(index, 1);
    renderCustomizerIssuesList();
}

function addNewIssueItem() {
    const label = prompt("اكتب نص المشكلة الجديدة التي تريد إضافتها لموقع الناس:");
    if (!label || !label.trim()) return;
    siteSettings.issuesList.push({
        id: "iss_" + Date.now(),
        label: label.trim(),
        value: label.trim(),
        icon: "fa-circle-exclamation",
        color: "#10B981"
    });
    renderCustomizerIssuesList();
}

async function saveSiteCustomizer() {
    siteSettings.mainTitle = document.getElementById("cust-main-title").value.trim() || "تنبيه مالك السيارة";
    siteSettings.subTitle = document.getElementById("cust-sub-title").value.trim() || "شكراً لاهتمامك وحرصك على المساعدة";
    siteSettings.issuesLabel = document.getElementById("cust-issues-label").value.trim() || DEFAULT_SITE_SETTINGS.issuesLabel;
    siteSettings.submitBtnText = document.getElementById("cust-submit-text").value.trim() || DEFAULT_SITE_SETTINGS.submitBtnText;
    siteSettings.successTitle = document.getElementById("cust-success-title").value.trim() || DEFAULT_SITE_SETTINGS.successTitle;
    siteSettings.showNoteField = document.getElementById("cust-show-note").checked;
    siteSettings.showPhoneField = document.getElementById("cust-show-phone").checked;

    await saveSiteSettingsData(siteSettings);
    alert("✅ تم حفظ وتحديث شكل الموقع وترتيب المشاكل فوراً!");
}

// =========================================================================
// REPORT DETAIL & HELPERS
// =========================================================================

function getIssueIcon(issueText) {
    if (issueText.includes("شباك") || issueText.includes("زجاج")) {
        return { icon: "fa-solid fa-window-maximize", color: "text-blue-400", bg: "bg-blue-500/10" };
    } else if (issueText.includes("أنوار") || issueText.includes("نور")) {
        return { icon: "fa-solid fa-lightbulb", color: "text-yellow-400", bg: "bg-yellow-500/10" };
    } else if (issueText.includes("كاوتش") || issueText.includes("إطار")) {
        return { icon: "fa-solid fa-compact-disc", color: "text-rose-400", bg: "bg-rose-500/10" };
    } else if (issueText.includes("قافل") || issueText.includes("ركنة")) {
        return { icon: "fa-solid fa-ban", color: "text-amber-400", bg: "bg-amber-500/10" };
    } else if (issueText.includes("إنذار")) {
        return { icon: "fa-solid fa-bell", color: "text-purple-400", bg: "bg-purple-500/10" };
    } else if (issueText.includes("خبطة") || issueText.includes("صدمة")) {
        return { icon: "fa-solid fa-car-burst", color: "text-red-500", bg: "bg-red-500/10" };
    }
    return { icon: "fa-solid fa-triangle-exclamation", color: "text-emerald-400", bg: "bg-emerald-500/10" };
}

function getRelativeTime(isoString) {
    if (!isoString) return "الآن";
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return "منذ لحظات";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} د`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} س`;
    return date.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' });
}

function openReportDetail(reportId) {
    currentReport = allReports.find(r => r.id === reportId);
    if (!currentReport) return;

    const modal = document.getElementById("detail-modal");
    const card = document.getElementById("detail-card");
    const carInfo = findCarByReport(currentReport);
    const carColor = carInfo.color || "#10B981";
    const carIcon = carInfo.icon || "fa-car-side";

    const isNew = currentReport.status === 'new';
    const statusBadge = document.getElementById("detail-status-badge");
    statusBadge.textContent = isNew ? "بلاغ جديد" : "تم الحل";
    statusBadge.className = isNew 
        ? "text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30"
        : "text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";

    const detailCarIcon = document.getElementById("detail-car-icon");
    if (carInfo.image) {
        detailCarIcon.innerHTML = `<img src="${carInfo.image}" class="w-full h-full object-cover">`;
    } else {
        detailCarIcon.style.backgroundColor = `${carColor}25`;
        detailCarIcon.style.color = carColor;
        detailCarIcon.innerHTML = `<i class="fa-solid ${carIcon}"></i>`;
    }

    const detailCarNameBadge = document.getElementById("detail-car-name-badge");
    detailCarNameBadge.textContent = `${carInfo.name} (${carInfo.plate})`;
    detailCarNameBadge.style.borderColor = `${carColor}50`;
    detailCarNameBadge.style.color = carColor;

    document.getElementById("detail-title").textContent = currentReport.issues[0] || "تفاصيل البلاغ";
    document.getElementById("detail-note").textContent = currentReport.note || "لا توجد تفاصيل إضافية مكتوبة.";

    const tagsContainer = document.getElementById("detail-issues-container");
    tagsContainer.innerHTML = (currentReport.issues || []).map(issue => `
        <span class="px-2.5 py-1 rounded-xl bg-slate-800 text-xs text-slate-200 border border-slate-700">
            ${issue}
        </span>
    `).join('');

    const contactSection = document.getElementById("detail-contact-section");
    if (currentReport.reporterPhone) {
        contactSection.classList.remove("hidden");
        document.getElementById("detail-phone-text").textContent = currentReport.reporterPhone;
        document.getElementById("btn-call-reporter").href = `tel:${currentReport.reporterPhone}`;
        
        let waNumber = currentReport.reporterPhone.replace(/[^\d]/g, '');
        if (waNumber.startsWith('01')) waNumber = '2' + waNumber;
        document.getElementById("btn-whatsapp-reporter").href = `https://wa.me/${waNumber}`;
    } else {
        contactSection.classList.add("hidden");
    }

    const reportDate = new Date(currentReport.createdAt || Date.now());
    document.getElementById("detail-time").textContent = `التوقيت: ${reportDate.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})} - ${reportDate.toLocaleDateString('ar-EG')}`;
    document.getElementById("detail-plate").textContent = `اللوحة: ${carInfo.plate}`;

    const btnToggleText = document.getElementById("btn-toggle-status-text");
    btnToggleText.textContent = isNew ? "تحديد كـ 'تم الحل' ✅" : "إعادة فتح كـ 'جديد' 🔄";

    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.remove("opacity-0");
        card.classList.remove("translate-y-full");
    }, 10);
}

function closeDetailModal() {
    const modal = document.getElementById("detail-modal");
    const card = document.getElementById("detail-card");

    modal.classList.add("opacity-0");
    card.classList.add("translate-y-full");
    setTimeout(() => {
        modal.classList.add("hidden");
        currentReport = null;
    }, 300);
}

async function toggleCurrentReportStatus() {
    if (!currentReport) return;
    const nextStatus = currentReport.status === 'new' ? 'resolved' : 'new';
    await updateReportStatus(currentReport.id, nextStatus);
    closeDetailModal();
}

async function deleteCurrentReport() {
    if (!currentReport) return;
    if (confirm("هل أنت متأكد من حذف هذا البلاغ نهائياً؟")) {
        await deleteReport(currentReport.id);
        closeDetailModal();
    }
}

async function clearAllReports() {
    if (confirm("هل تريد مسح جميع البلاغات؟")) {
        for (const r of allReports) {
            await deleteReport(r.id);
        }
    }
}

// Switch Bottom Tabs
function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".bottom-nav-btn").forEach(el => {
        el.classList.remove("active");
        el.classList.add("text-slate-400");
    });

    document.getElementById(`tab-${tabId}`).classList.remove("hidden");
    const activeBtn = document.getElementById(`nav-tab-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add("active");
        activeBtn.classList.remove("text-slate-400");
    }

    if (tabId === 'cars') {
        renderCarsManagementTab();
    } else if (tabId === 'customizer') {
        populateSiteCustomizerUI();
    }
}

function updateDatabaseStatus() {
    const badge = document.getElementById("connection-badge");
    const desc = document.getElementById("db-status-desc");
    if (!isDemoMode && db) {
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> متصل بـ Firebase`;
        desc.textContent = "🟢 متصل بقاعدة بيانات Firebase Firestore السحابية بنجاح.";
    } else {
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> وضع تجريبي محلي`;
        desc.textContent = "🟡 وضع المعاينة المحلي (Demo Mode).";
    }
}

function triggerMockReport() {
    const targetCar = (currentCarFilter !== 'all')
        ? allCars.find(c => c.id === currentCarFilter)
        : allCars[Math.floor(Math.random() * allCars.length)];
    sendMockReport(targetCar);
}

function sendMockReportForCar(carId) {
    const car = allCars.find(c => c.id === carId);
    sendMockReport(car);
    switchTab('reports');
}

function saveBaseUrlSetting() {
    const val = document.getElementById("config-github-url").value.trim();
    if (val) {
        localStorage.setItem("base_github_url", val);
        renderCarsManagementTab();
    }
}

let pendingServiceAccount = null;

function loadSettings() {
    const savedUrl = localStorage.getItem("base_github_url");
    const input = document.getElementById("config-github-url");
    if (input) {
        input.value = savedUrl || window.location.origin;
    }
    initAppBrandingAndLanguage();
    loadPushConfigUI();
}

// =========================================================================
// LANGUAGE SWITCHER (العربية / English) & APP BRANDING (اسم وأيقونة البرنامج)
// =========================================================================
let currentAppLang = localStorage.getItem("owner_app_lang") || "ar";
let appBranding = JSON.parse(localStorage.getItem("owner_app_branding") || "null") || {
    name: "تنبيهات سيارتي",
    icon: "fa-car-side",
    color: "#10B981",
    customImage: null
};

const OWNER_I18N = {
    ar: {
        dir: "rtl",
        test_report_btn: "تجربة بلاغ",
        connection_live: "متصل لحظياً",
        stat_total_label: "إجمالي البلاغات",
        stat_new_label: "جديدة",
        stat_resolved_label: "تم حلها",
        filter_all: "الكل",
        filter_new: "جديدة 🔴",
        filter_resolved: "تم الحل ✅",
        empty_title: "لا توجد بلاغات هنا",
        empty_sub: "سياراتك بأمان! أي تنبيه يسجله شخص في الشارع لأي سيارة سيظهر هنا فوراً.",
        cars_tab_title: "سياراتي والباركود",
        cars_tab_sub: "تحكم في صورة السيارة، شكلها، لونها، والـ ID العشوائي",
        add_car_btn: "سيارة جديدة",
        cust_tab_title: "التحكم في شكل ومحتوى موقع الناس",
        cust_tab_sub: "أي تعديل تحفظه هنا يتغير فوراً على موقع الشارع",
        save_all_btn: "حفظ الكل",
        settings_title: "إعدادات التطبيق",
        lang_setting_title: "لغة البرنامج والموقع (Language)",
        lang_setting_sub: "التبديل بين العربية والإنجليزية",
        app_branding_title: "تغيير اسم وأيقونة البرنامج",
        app_preview_label: "معاينة شكل البرنامج:",
        app_name_label: "اسم البرنامج:",
        app_icon_label: "اختيار شكل الأيقونة أو رفع صورة خاصة:",
        upload_custom_icon: "رفع صورة أيقونة",
        save_app_branding_btn: "حفظ اسم وأيقونة البرنامج",
        nav_reports: "البلاغات",
        nav_cars: "سياراتي",
        nav_customizer: "شكل الموقع",
        nav_settings: "الإعدادات"
    },
    en: {
        dir: "ltr",
        test_report_btn: "Test Alert",
        connection_live: "Live Connected",
        stat_total_label: "Total Reports",
        stat_new_label: "New",
        stat_resolved_label: "Resolved",
        filter_all: "All",
        filter_new: "New 🔴",
        filter_resolved: "Resolved ✅",
        empty_title: "No Reports Yet",
        empty_sub: "Your cars are safe! Any street alert submitted for your cars will appear here instantly.",
        cars_tab_title: "My Cars & QR Stickers",
        cars_tab_sub: "Manage car photo, icon shape, color theme, and 8-char ID",
        add_car_btn: "New Car",
        cust_tab_title: "Customize Public Street Website",
        cust_tab_sub: "Any changes saved here update the street website immediately",
        save_all_btn: "Save All",
        settings_title: "App Settings",
        lang_setting_title: "App & Website Language",
        lang_setting_sub: "Switch between Arabic and English",
        app_branding_title: "Customize App Name & Icon",
        app_preview_label: "App Header & Icon Preview:",
        app_name_label: "App Name:",
        app_icon_label: "Choose Icon Shape or Upload Custom Image:",
        upload_custom_icon: "Upload Icon",
        save_app_branding_btn: "Save App Name & Icon",
        nav_reports: "Reports",
        nav_cars: "My Cars",
        nav_customizer: "Site Design",
        nav_settings: "Settings"
    }
};

function initAppBrandingAndLanguage() {
    const nameInput = document.getElementById("setting-app-name");
    if (nameInput) nameInput.value = appBranding.name || "تنبيهات سيارتي";
    const colorInput = document.getElementById("setting-app-icon-color");
    if (colorInput) colorInput.value = appBranding.color || "#10B981";

    updateAppBrandingPreview();
    applyAppBrandingToDOM();
    applyAppLanguageUI(currentAppLang);
}

function syncBrandingAndLangFromSettings(settings) {
    if (!settings) return;
    let changedBranding = false;
    if (settings.appName && settings.appName !== appBranding.name) {
        appBranding.name = settings.appName;
        changedBranding = true;
    }
    if (settings.appIcon && settings.appIcon !== appBranding.icon) {
        appBranding.icon = settings.appIcon;
        changedBranding = true;
    }
    if (settings.appIconColor && settings.appIconColor !== appBranding.color) {
        appBranding.color = settings.appIconColor;
        changedBranding = true;
    }
    if (settings.appCustomIcon !== undefined && settings.appCustomIcon !== appBranding.customImage) {
        appBranding.customImage = settings.appCustomIcon;
        changedBranding = true;
    }
    if (changedBranding) {
        localStorage.setItem("owner_app_branding", JSON.stringify(appBranding));
        const nameInput = document.getElementById("setting-app-name");
        if (nameInput) nameInput.value = appBranding.name;
        updateAppBrandingPreview();
        applyAppBrandingToDOM();
    }
    if (settings.appLang && settings.appLang !== currentAppLang) {
        currentAppLang = settings.appLang;
        localStorage.setItem("owner_app_lang", currentAppLang);
        applyAppLanguageUI(currentAppLang);
    }
}

async function setAppLanguage(lang) {
    currentAppLang = (lang === "en") ? "en" : "ar";
    localStorage.setItem("owner_app_lang", currentAppLang);
    applyAppLanguageUI(currentAppLang);

    siteSettings.appLang = currentAppLang;
    try {
        await saveSiteSettingsData({ appLang: currentAppLang });
    } catch (e) {}
}

function toggleAppLanguage() {
    setAppLanguage(currentAppLang === "ar" ? "en" : "ar");
}

function applyAppLanguageUI(lang) {
    const dict = OWNER_I18N[lang] || OWNER_I18N.ar;
    document.documentElement.lang = lang;
    document.documentElement.dir = dict.dir;

    const headerLangBtn = document.getElementById("header-lang-btn");
    if (headerLangBtn) headerLangBtn.textContent = lang === "ar" ? "EN" : "عربي";

    const btnAr = document.getElementById("btn-lang-ar");
    const btnEn = document.getElementById("btn-lang-en");
    if (btnAr && btnEn) {
        if (lang === "ar") {
            btnAr.className = "py-2 rounded-xl border border-emerald-500 bg-emerald-500/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all";
            btnEn.className = "py-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all";
        } else {
            btnEn.className = "py-2 rounded-xl border border-emerald-500 bg-emerald-500/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all";
            btnAr.className = "py-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all";
        }
    }

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.textContent = dict[key];
    });

    // Translate bottom navigation labels
    const navMap = {
        "nav-tab-reports": dict.nav_reports,
        "nav-tab-cars": dict.nav_cars,
        "nav-tab-customizer": dict.nav_customizer,
        "nav-tab-settings": dict.nav_settings
    };
    Object.keys(navMap).forEach(id => {
        const span = document.querySelector(`#${id} span`);
        if (span) span.textContent = navMap[id];
    });

    renderCarFilterBar();
    renderReportsList();
    renderCarsManagementTab();
}

function selectAppBrandingIcon(iconName) {
    appBranding.icon = iconName;
    appBranding.customImage = null;
    updateAppBrandingPreview();
}

function selectAppBrandingColor(colorHex) {
    appBranding.color = colorHex;
    updateAppBrandingPreview();
}

function handleCustomAppIconUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            canvas.width = 192;
            canvas.height = 192;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 192, 192);
            // Draw image centered/cover inside 192x192
            const scale = Math.max(192 / img.width, 192 / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (192 - w) / 2, (192 - h) / 2, w, h);
            appBranding.customImage = canvas.toDataURL("image/png");
            updateAppBrandingPreview();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function renderAppLogoBoxContent(boxEl, iconSizeClass = "text-base") {
    if (!boxEl) return;
    const color = appBranding.color || "#10B981";
    if (appBranding.customImage) {
        boxEl.style.background = "transparent";
        boxEl.innerHTML = `<img src="${appBranding.customImage}" alt="App Icon" class="w-full h-full object-cover">`;
    } else {
        boxEl.style.background = color;
        if (appBranding.icon === "brand-mitsubishi") {
            boxEl.innerHTML = `<svg class="w-5 h-5 fill-current text-white" viewBox="0 0 200 180"><polygon points="100,11 130,63 100,115 70,63"/><polygon points="100,115 40,115 10,167 70,167"/><polygon points="100,115 160,115 190,167 130,167"/></svg>`;
        } else {
            boxEl.innerHTML = `<i class="fa-solid ${appBranding.icon || 'fa-car-side'} text-white ${iconSizeClass}"></i>`;
        }
    }
}

function updateAppBrandingPreview() {
    const nameInput = document.getElementById("setting-app-name");
    const currentName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : (appBranding.name || "تنبيهات سيارتي");
    appBranding.name = currentName;

    const previewName = document.getElementById("preview-app-name-text");
    if (previewName) previewName.textContent = currentName;

    const previewBox = document.getElementById("preview-app-icon-box");
    renderAppLogoBoxContent(previewBox, "text-xl");

    document.querySelectorAll(".app-icon-opt").forEach(btn => {
        const i = btn.querySelector("i");
        const isMitsu = !i && btn.querySelector("svg");
        const matched = !appBranding.customImage && ((appBranding.icon === "brand-mitsubishi" && isMitsu) || (i && i.classList.contains(appBranding.icon)));
        if (matched) {
            btn.className = "app-icon-opt p-2 rounded-xl bg-slate-900 border border-emerald-500 text-white text-sm flex items-center justify-center";
        } else {
            btn.className = "app-icon-opt p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm flex items-center justify-center";
        }
    });
}

function generateDynamicAppIconDataUrl(size = 192) {
    if (appBranding.customImage) return appBranding.customImage;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const color = appBranding.color || "#10B981";

    // Rounded background
    const r = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Inner symbol
    ctx.fillStyle = "#FFFFFF";
    if (appBranding.icon === "brand-mitsubishi") {
        const scale = (size * 0.65) / 200;
        const ox = size * 0.175;
        const oy = size * 0.20;
        const drawP = (pts) => {
            ctx.beginPath();
            pts.forEach((p, idx) => {
                if (idx === 0) ctx.moveTo(ox + p[0] * scale, oy + p[1] * scale);
                else ctx.lineTo(ox + p[0] * scale, oy + p[1] * scale);
            });
            ctx.closePath();
            ctx.fill();
        };
        drawP([[100, 11], [130, 63], [100, 115], [70, 63]]);
        drawP([[100, 115], [40, 115], [10, 167], [70, 167]]);
        drawP([[100, 115], [160, 115], [190, 167], [130, 167]]);
    } else {
        ctx.font = `900 ${Math.round(size * 0.42)}px 'Cairo', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((appBranding.name || "🚗").slice(0, 2), size / 2, size / 2);
    }
    return canvas.toDataURL("image/png");
}

function applyAppBrandingToDOM() {
    const titleText = appBranding.name || "تنبيهات سيارتي";
    const headerTitle = document.getElementById("header-app-title");
    if (headerTitle) headerTitle.textContent = titleText;

    const docTitle = document.getElementById("doc-app-title");
    if (docTitle) docTitle.textContent = titleText;
    document.title = titleText;

    const appleTitle = document.getElementById("meta-apple-title");
    if (appleTitle) appleTitle.setAttribute("content", titleText);

    const headerLogoBox = document.getElementById("header-app-logo-box");
    renderAppLogoBoxContent(headerLogoBox, "text-sm");

    try {
        const icon192 = generateDynamicAppIconDataUrl(192);
        const favicon = document.getElementById("dynamic-favicon");
        const appleIcon = document.getElementById("dynamic-apple-icon");
        if (favicon) favicon.href = icon192;
        if (appleIcon) appleIcon.href = icon192;
    } catch (e) {}
}

async function saveAppBrandingSettings() {
    updateAppBrandingPreview();
    localStorage.setItem("owner_app_branding", JSON.stringify(appBranding));
    applyAppBrandingToDOM();

    siteSettings.appName = appBranding.name;
    siteSettings.appIcon = appBranding.icon;
    siteSettings.appIconColor = appBranding.color;
    siteSettings.appCustomIcon = appBranding.customImage || null;

    await saveSiteSettingsData({
        appName: appBranding.name,
        appIcon: appBranding.icon,
        appIconColor: appBranding.color,
        appCustomIcon: appBranding.customImage || null
    });

    alert(currentAppLang === "en"
        ? "✅ App name and icon updated successfully!"
        : "✅ تم حفظ وتحديث اسم وأيقونة البرنامج بنجاح!");
}

async function loadPushConfigUI() {
    const pushCfg = await getPushConfigFromDB();
    const badge = document.getElementById("bg-push-status-badge");
    const vapidInput = document.getElementById("setting-vapid-key");
    const jsonLabel = document.getElementById("service-json-label");

    if (pushCfg) {
        if (pushCfg.vapidKey && vapidInput) vapidInput.value = pushCfg.vapidKey;
        if (pushCfg.clientEmail && jsonLabel) {
            jsonLabel.textContent = "✅ تم حفظ ملف المفتاح (" + pushCfg.clientEmail.split("@")[0] + ")";
            pendingServiceAccount = {
                clientEmail: pushCfg.clientEmail,
                privateKey: pushCfg.privateKey
            };
        }
    }

    const myToken = localStorage.getItem("registered_fcm_token");
    if (badge) {
        if (pushCfg && pushCfg.vapidKey && pushCfg.clientEmail && myToken) {
            badge.textContent = "🟢 مفعل على هذا الموبايل";
            badge.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold";
        } else if (pushCfg && pushCfg.vapidKey && pushCfg.clientEmail) {
            badge.textContent = "🟡 اضغط تفعيل لربط الموبايل";
            badge.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold";
        } else {
            badge.textContent = "غير مفعل";
            badge.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold";
        }
    }
}

function handleServiceAccountUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (!json.client_email || !json.private_key) {
                alert("ملف الـ JSON غير صالح! تأكد من تحميل ملف الـ Service Account من إعدادات Firebase.");
                return;
            }
            pendingServiceAccount = {
                clientEmail: json.client_email,
                privateKey: json.private_key
            };
            document.getElementById("service-json-label").textContent = "✅ تم قراءة الملف: " + json.client_email.split("@")[0];
        } catch (err) {
            alert("تعذر قراءة ملف JSON!");
        }
    };
    reader.readAsText(file);
}

async function activateBackgroundPush() {
    const vapidKey = document.getElementById("setting-vapid-key").value.trim();
    const btn = document.getElementById("btn-activate-bg-push");

    if (!vapidKey) {
        alert("يرجى لصق مفتاح الـ Web Push (VAPID Key) أولاً!");
        return;
    }
    if (!pendingServiceAccount || !pendingServiceAccount.clientEmail || !pendingServiceAccount.privateKey) {
        alert("يرجى اختيار ملف الـ Service Account JSON أولاً!");
        return;
    }

    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري ربط الموبايل وتفعيل الإشعارات...</span>`;

    try {
        await savePushConfigToDB({
            vapidKey: vapidKey,
            clientEmail: pendingServiceAccount.clientEmail,
            privateKey: pendingServiceAccount.privateKey
        });

        await registerDeviceForBackgroundPush();
        await loadPushConfigUI();
        alert("🎉 تم تفعيل إشعارات الخلفية على هذا الموبايل بنجاح! الآن ستصلك الإشعارات حتى والتطبيق مغلق تماماً.");
    } catch (err) {
        alert("تنبيه: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}
