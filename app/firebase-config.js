// ==============================================================================
// إعدادات Firebase لتطبيق الموبايل الخاص بالمالك (يقرأ المفاتيح تلقائياً من ../firebase-keys.js)
// ==============================================================================

const isDemoMode = typeof firebaseConfig === "undefined" || !firebaseConfig.projectId || firebaseConfig.projectId === "YOUR_PROJECT_ID";

let db = null;
let auth = null;
let messaging = null;

if (!isDemoMode && typeof firebase !== "undefined") {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        if (typeof firebase.auth === "function") {
            auth = firebase.auth();
        }
        if (typeof firebase.messaging === "function" && firebase.messaging.isSupported()) {
            messaging = firebase.messaging();
        }
        console.log("🟢 تطبيق الموبايل متصل بـ Firebase بنجاح!");
    } catch (e) {
        console.warn("خطأ في الاتصال بـ Firebase:", e);
    }
}

// ==============================================================================
// نظام حماية تطبيق المالك بكلمة سر (Firebase Authentication + قفل لمالك واحد فقط)
// ==============================================================================
async function checkIsOwnerRegistered() {
    if (isDemoMode || !db) return false;
    try {
        const doc = await db.collection("site_settings").doc("config").get();
        return !!(doc.exists && doc.data() && doc.data().ownerUid);
    } catch (e) {
        return false;
    }
}

async function verifyOrBindOwnerAccount(user) {
    if (isDemoMode || !db || !user) return true;
    try {
        const ref = db.collection("site_settings").doc("config");
        const doc = await ref.get();
        const data = doc.exists ? doc.data() : {};

        if (!data.ownerUid) {
            // ربط الحساب كمالك وحيد للتطبيق لأول مرة
            await ref.set({
                ownerUid: user.uid,
                ownerEmail: user.email || ""
            }, { merge: true });
            return true;
        }

        // إذا كان هناك مالك مسجل مسبقاً، نتأكد أن هذا المستخدم هو نفسه المالك الوحيد
        if (data.ownerUid !== user.uid) {
            if (auth) await auth.signOut();
            return false;
        }
        return true;
    } catch (e) {
        return true;
    }
}

// حفظ واسترجاع إعدادات إشعارات الخلفية (FCM Push Config)
async function getPushConfigFromDB() {
    if (isDemoMode || !db) return null;
    try {
        const doc = await db.collection("site_settings").doc("push_config").get();
        return doc.exists ? doc.data() : null;
    } catch (e) {
        return null;
    }
}

async function savePushConfigToDB(configData) {
    if (isDemoMode || !db) return;
    await db.collection("site_settings").doc("push_config").set({
        ...configData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// تسجيل هذا الموبايل لاستقبال إشعارات الخلفية حتى والتطبيق مغلق
async function registerDeviceForBackgroundPush() {
    if (!messaging || !db) {
        throw new Error("متصفحك الحالي لا يدعم Web Push أو يتطلب تثبيت التطبيق على الشاشة الرئيسية أولاً.");
    }

    const pushCfg = await getPushConfigFromDB();
    if (!pushCfg || !pushCfg.vapidKey) {
        throw new Error("يرجى إدخال مفتاح VAPID Key في قسم إعدادات الإشعارات أولاً.");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error("يرجى السماح بالإشعارات من المتصفح.");
    }

    const swReg = await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
    const currentToken = await messaging.getToken({
        vapidKey: pushCfg.vapidKey.trim(),
        serviceWorkerRegistration: swReg
    });

    if (!currentToken) {
        throw new Error("تعذر استخراج كود الإشعارات لهذا الجهاز.");
    }

    // حفظ توكن الموبايل في Firestore
    const tokenDocId = "dev_" + btoa(currentToken).replace(/[^A-Za-z0-9]/g, "").slice(-16);
    await db.collection("fcm_tokens").doc(tokenDocId).set({
        token: currentToken,
        userAgent: navigator.userAgent,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    localStorage.setItem("registered_fcm_token", currentToken);
    return currentToken;
}

// دالة توليد ID عشوائي للسيارة مكون من 8 خانات (أرقام وحروف)
function generateRandomCarId(length = 8) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// فحص هل الـ ID مكون من 8 خانات عشوائية
function isValid8CharId(id) {
    return typeof id === "string" && /^[A-Za-z0-9]{8}$/.test(id);
}

// الإعدادات الافتراضية لشكل الموقع وعناوينه وترتيب المشاكل
const DEFAULT_SITE_SETTINGS = {
    theme: "dark", // 'dark' | 'light' | 'black'
    gridColumns: 2, // 2 | 1
    mainTitle: "تنبيه مالك السيارة",
    subTitle: "شكراً لاهتمامك وحرصك على المساعدة",
    issuesLabel: "ما هي المشكلة التي لاحظتها؟ (اختر واحداً أو أكثر)",
    noteLabel: "تفاصيل إضافية عن المشكلة (اختياري):",
    notePlaceholder: "مثال: الشباك الخلفي اليمين، أو أنا منتظر بجانب السيارة...",
    phoneLabel: "رقم هاتفك للتواصل (اختياري لو تحب المالك يتواصل معك):",
    submitBtnText: "إرسال البلاغ لمالك السيارة",
    successTitle: "تم إرسال البلاغ بنجاح!",
    successMessage: "وصل تنبيهك إلى تطبيق مالك السيارة فوراً. شكراً جزيلاً لتعاونك وحرصك على مساعدة الآخرين!",
    showNoteField: true,
    showPhoneField: true,
    stickerTopAr: "العربية فيها مشكلة؟",
    stickerTopEn: "Issue with the car?",
    stickerBottomAr: "اعمل سكان للـ Qr Code وبلغني",
    stickerBottomEn: "Scan Qr Code and Tell Me",
    issuesList: [
        { id: "iss_1", label: "قافل على حد / راكن غلط", value: "العربية قافلة على حد / ركنة مخالفة", icon: "fa-ban", color: "#F59E0B" },
        { id: "iss_2", label: "شباك العربية مفتوح", value: "شباك أو زجاج السيارة مفتوح", icon: "fa-window-maximize", color: "#3B82F6" },
        { id: "iss_3", label: "الأنوار شغالة", value: "أنوار السيارة مضاءة", icon: "fa-lightbulb", color: "#EAB308" },
        { id: "iss_4", label: "الكاوتش نايم / مريح", value: "الكاوتش مريح / به تسريب", icon: "fa-compact-disc", color: "#F43F5E" },
        { id: "iss_5", label: "صوت الإنذار بيضرب", value: "إنذار السيارة يعمل بصوت مرتفع", icon: "fa-bell", color: "#A855F7" },
        { id: "iss_6", label: "خبطة أو صدمة", value: "السيارة تعرضت لخبطة أو صدمة", icon: "fa-car-burst", color: "#EF4444" }
    ]
};

// السيارات الافتراضية المبدئية بمعرّفات عشوائية من 8 خانات
function createDefaultCarsList() {
    const id1 = generateRandomCarId(8);
    const id2 = generateRandomCarId(8);
    return [
        {
            id: id1,
            name: "ميتسوبيشي لانسر",
            plate: "أ ب ج 1234",
            colorName: "فضي",
            color: "#10B981",
            icon: "fa-car-side",
            image: null,
            subtitle: "",
            order: 1
        },
        {
            id: id2,
            name: "السيارة الثانية",
            plate: "س ع د 5678",
            colorName: "أسود",
            color: "#3B82F6",
            icon: "fa-car",
            image: null,
            subtitle: "",
            order: 2
        }
    ];
}

// الاستماع اللحظي لقائمة سيارات المالك (مع ترقية أي ID قديم تلقائياً إلى 8 خانات عشوائية)
function subscribeToCars(onCarsUpdated) {
    if (!isDemoMode && db) {
        return db.collection("cars").onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                const initialCars = createDefaultCarsList();
                for (const car of initialCars) {
                    await db.collection("cars").doc(car.id).set(car);
                }
                return;
            }

            const cars = [];
            let migratedAny = false;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (!isValid8CharId(doc.id)) {
                    // ترقية الـ ID القديم مثل car_1 إلى ID عشوائي من 8 خانات تلقائياً
                    const newRandomId = generateRandomCarId(8);
                    const migratedCar = { ...data, id: newRandomId };
                    await db.collection("cars").doc(newRandomId).set(migratedCar);
                    await db.collection("cars").doc(doc.id).delete();
                    migratedAny = true;
                } else {
                    cars.push({ id: doc.id, ...data });
                }
            }

            if (migratedAny) return; // سيستدعي الـ snapshot الجديد تلقائياً بعد الترقية

            cars.sort((a, b) => (a.order || 99) - (b.order || 99));
            onCarsUpdated(cars);
        }, err => {
            console.error("Error listening to cars:", err);
            onCarsUpdated(createDefaultCarsList());
        });
    } else {
        let localCarsMap = JSON.parse(localStorage.getItem("demo_cars") || "null");
        if (!localCarsMap) {
            localCarsMap = {};
            createDefaultCarsList().forEach(c => localCarsMap[c.id] = c);
            localStorage.setItem("demo_cars", JSON.stringify(localCarsMap));
        }
        onCarsUpdated(Object.values(localCarsMap));
        return () => {};
    }
}

// حفظ أو تعديل بيانات السيارة (مع إمكانية تغيير الـ ID العشوائي لو تم توليده من جديد)
async function saveCarData(carId, carData, oldCarId = null) {
    if (!isDemoMode && db) {
        if (oldCarId && oldCarId !== carId) {
            await db.collection("cars").doc(oldCarId).delete();
        }
        await db.collection("cars").doc(carId).set({
            ...carData,
            id: carId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } else {
        const localCarsMap = JSON.parse(localStorage.getItem("demo_cars") || "{}");
        if (oldCarId && oldCarId !== carId) {
            delete localCarsMap[oldCarId];
        }
        localCarsMap[carId] = { ...(localCarsMap[carId] || {}), ...carData, id: carId };
        localStorage.setItem("demo_cars", JSON.stringify(localCarsMap));
    }
}

// حذف سيارة
async function removeCarData(carId) {
    if (!isDemoMode && db) {
        await db.collection("cars").doc(carId).delete();
    } else {
        const localCarsMap = JSON.parse(localStorage.getItem("demo_cars") || "{}");
        delete localCarsMap[carId];
        localStorage.setItem("demo_cars", JSON.stringify(localCarsMap));
    }
}

// الاستماع اللحظي لإعدادات شكل الموقع والعناوين وترتيب المشاكل
function subscribeToSiteSettings(onSettingsUpdated) {
    if (!isDemoMode && db) {
        return db.collection("site_settings").doc("config").onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                onSettingsUpdated({
                    ...DEFAULT_SITE_SETTINGS,
                    ...data,
                    issuesList: (data.issuesList && data.issuesList.length > 0) ? data.issuesList : DEFAULT_SITE_SETTINGS.issuesList
                });
            } else {
                onSettingsUpdated(DEFAULT_SITE_SETTINGS);
            }
        }, err => {
            console.warn("Error listening to site settings:", err);
            onSettingsUpdated(DEFAULT_SITE_SETTINGS);
        });
    } else {
        const localSettings = JSON.parse(localStorage.getItem("demo_site_settings") || "null") || DEFAULT_SITE_SETTINGS;
        onSettingsUpdated(localSettings);
        return () => {};
    }
}

// حفظ إعدادات شكل الموقع والعناوين وترتيب المشاكل
async function saveSiteSettingsData(newSettings) {
    if (!isDemoMode && db) {
        await db.collection("site_settings").doc("config").set({
            ...newSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } else {
        localStorage.setItem("demo_site_settings", JSON.stringify(newSettings));
    }
}

// الاستماع اللحظي للبلاغات من جميع السيارات
function subscribeToReports(onReportsUpdated) {
    if (!isDemoMode && db) {
        return db.collection("car_reports")
            .orderBy("createdAt", "desc")
            .onSnapshot(snapshot => {
                const reports = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    reports.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
                    });
                });
                onReportsUpdated(reports);
            }, error => {
                console.error("Firestore listen error:", error);
            });
    } else {
        const getLocalReports = () => JSON.parse(localStorage.getItem("demo_car_reports") || "[]");
        onReportsUpdated(getLocalReports());

        const channel = new BroadcastChannel("car_alerts_channel");
        channel.onmessage = (event) => {
            if (event.data && event.data.type === "NEW_REPORT") {
                onReportsUpdated(getLocalReports(), true);
            }
        };

        const interval = setInterval(() => {
            onReportsUpdated(getLocalReports());
        }, 3000);

        return () => {
            clearInterval(interval);
            channel.close();
        };
    }
}

// تحديث حالة البلاغ
async function updateReportStatus(reportId, newStatus) {
    if (!isDemoMode && db) {
        await db.collection("car_reports").doc(reportId).update({
            status: newStatus
        });
    } else {
        const reports = JSON.parse(localStorage.getItem("demo_car_reports") || "[]");
        const idx = reports.findIndex(r => r.id === reportId);
        if (idx !== -1) {
            reports[idx].status = newStatus;
            localStorage.setItem("demo_car_reports", JSON.stringify(reports));
        }
    }
}

// حذف البلاغ
async function deleteReport(reportId) {
    if (!isDemoMode && db) {
        await db.collection("car_reports").doc(reportId).delete();
    } else {
        let reports = JSON.parse(localStorage.getItem("demo_car_reports") || "[]");
        reports = reports.filter(r => r.id !== reportId);
        localStorage.setItem("demo_car_reports", JSON.stringify(reports));
    }
}

// إرسال بلاغ تجريبي لاختبار التنبيهات
async function sendMockReport(targetCar) {
    const mockIssues = [
        ["شباك أو زجاج السيارة مفتوح"],
        ["أنوار السيارة مضاءة"],
        ["الكاوتش مريح / به تسريب"],
        ["العربية قافلة على حد / ركنة مخالفة"]
    ];
    const chosen = mockIssues[Math.floor(Math.random() * mockIssues.length)];
    const car = targetCar || {
        id: "K8M3X9P2",
        name: "السيارة الأولى",
        plate: "أ ب ج 1234",
        color: "#10B981",
        icon: "fa-car-side"
    };

    const mockData = {
        carId: car.id,
        carName: car.name,
        carPlate: car.plate,
        carColor: car.color || "#10B981",
        carIcon: car.icon || "fa-car-side",
        issues: chosen,
        note: `بلاغ تجريبي لـ (${car.name}) لاختبار وصول التنبيهات والصوت للتطبيق`,
        reporterPhone: "01012345678",
        status: "new"
    };

    if (!isDemoMode && db) {
        await db.collection("car_reports").add({
            ...mockData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        const reports = JSON.parse(localStorage.getItem("demo_car_reports") || "[]");
        const newReport = {
            id: "rep_" + Date.now(),
            ...mockData,
            createdAt: new Date().toISOString()
        };
        reports.unshift(newReport);
        localStorage.setItem("demo_car_reports", JSON.stringify(reports));

        try {
            const channel = new BroadcastChannel("car_alerts_channel");
            channel.postMessage({ type: "NEW_REPORT", data: newReport });
        } catch (e) {}
    }
}
