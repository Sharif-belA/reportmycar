// ==============================================================================
// إعدادات Firebase لموقع الإبلاغ العام (يقرأ المفاتيح تلقائياً من ملف firebase-keys.js)
// ==============================================================================

const isDemoMode = typeof firebaseConfig === "undefined" || !firebaseConfig.projectId || firebaseConfig.projectId === "YOUR_PROJECT_ID";

let db = null;

if (!isDemoMode && typeof firebase !== "undefined") {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("🟢 تم الاتصال بقاعدة بيانات Firebase بنجاح!");
    } catch (e) {
        console.warn("تعذر الاتصال بـ Firebase، جاري التحويل للوضع التجريبي:", e);
    }
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
    issuesList: [
        { id: "iss_1", label: "قافل على حد / راكن غلط", value: "العربية قافلة على حد / ركنة مخالفة", icon: "fa-ban", color: "#F59E0B" },
        { id: "iss_2", label: "شباك العربية مفتوح", value: "شباك أو زجاج السيارة مفتوح", icon: "fa-window-maximize", color: "#3B82F6" },
        { id: "iss_3", label: "الأنوار شغالة", value: "أنوار السيارة مضاءة", icon: "fa-lightbulb", color: "#EAB308" },
        { id: "iss_4", label: "الكاوتش نايم / مريح", value: "الكاوتش مريح / به تسريب", icon: "fa-compact-disc", color: "#F43F5E" },
        { id: "iss_5", label: "صوت الإنذار بيضرب", value: "إنذار السيارة يعمل بصوت مرتفع", icon: "fa-bell", color: "#A855F7" },
        { id: "iss_6", label: "خبطة أو صدمة", value: "السيارة تعرضت لخبطة أو صدمة", icon: "fa-car-burst", color: "#EF4444" }
    ]
};

// الاستماع اللحظي لإعدادات شكل الموقع والعناوين وترتيب المشاكل
function subscribeToSiteSettings(onSettingsLoaded) {
    if (!isDemoMode && db) {
        return db.collection("site_settings").doc("config").onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                onSettingsLoaded({
                    ...DEFAULT_SITE_SETTINGS,
                    ...data,
                    issuesList: (data.issuesList && data.issuesList.length > 0) ? data.issuesList : DEFAULT_SITE_SETTINGS.issuesList
                });
            } else {
                onSettingsLoaded(DEFAULT_SITE_SETTINGS);
            }
        }, err => {
            console.warn("Error fetching site settings:", err);
            onSettingsLoaded(DEFAULT_SITE_SETTINGS);
        });
    } else {
        const localSettings = JSON.parse(localStorage.getItem("demo_site_settings") || "null") || DEFAULT_SITE_SETTINGS;
        onSettingsLoaded(localSettings);
        return () => {};
    }
}

// الاستماع اللحظي لبيانات السيارة المحددة بالـ ID فقط (ممنوع جلب أي سيارة بدون ID صحيح لحماية الخصوصية)
function subscribeToCarInfo(carId, onCarLoaded, onCarMissing) {
    const cleanId = (typeof carId === "string") ? carId.trim() : "";

    // التحقق من وجود كود ID صالح (8 خانات من الحروف والأرقام)
    if (!cleanId || !/^[A-Za-z0-9]{8}$/.test(cleanId)) {
        if (typeof onCarMissing === "function") onCarMissing("missing");
        return () => {};
    }

    if (!isDemoMode && db) {
        return db.collection("cars").doc(cleanId).onSnapshot((doc) => {
            if (doc.exists) {
                onCarLoaded({ id: doc.id, ...doc.data() });
            } else {
                if (typeof onCarMissing === "function") onCarMissing("not_found");
            }
        }, err => {
            console.warn("Error fetching car info:", err);
            if (typeof onCarMissing === "function") onCarMissing("error");
        });
    } else {
        const localCars = JSON.parse(localStorage.getItem("demo_cars") || "{}");
        if (localCars[cleanId]) {
            onCarLoaded(localCars[cleanId]);
        } else {
            if (typeof onCarMissing === "function") onCarMissing("not_found");
        }
        return () => {};
    }
}

// ==============================================================================
// إرسال إشعار خلفية فوري لهاتف المالك حتى والتطبيق مغلق (FCM HTTP v1 + Web Crypto)
// ==============================================================================

function base64UrlEncodeStr(str) {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function arrayBufferToBase64Url(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\\n/g, "")
        .replace(/\s+/g, "");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function getGoogleAccessToken(clientEmail, privateKeyPem) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now - 60,
        exp: now + 3500
    };

    const unsignedToken = `${base64UrlEncodeStr(JSON.stringify(header))}.${base64UrlEncodeStr(JSON.stringify(claim))}`;
    const keyBuffer = pemToArrayBuffer(privateKeyPem);
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
    );

    const jwt = `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`
    });
    const data = await res.json();
    return data.access_token;
}

async function sendBackgroundPushToOwner(reportData, reportId) {
    if (isDemoMode || !db) return;
    try {
        // 1. جلب إعدادات مفاتيح الدفع والأجهزة المسجلة من Firestore
        const pushDoc = await db.collection("site_settings").doc("push_config").get();
        if (!pushDoc.exists) return;

        const pushCfg = pushDoc.data();
        if (!pushCfg.clientEmail || !pushCfg.privateKey) return;

        const tokensSnap = await db.collection("fcm_tokens").get();
        if (tokensSnap.empty) return;

        const accessToken = await getGoogleAccessToken(pushCfg.clientEmail, pushCfg.privateKey);
        if (!accessToken) return;

        const title = `🚨 بلاغ جديد: ${reportData.carName || 'سيارتك'} (${reportData.carPlate || ''})`;
        const issueTitle = (reportData.issues && reportData.issues[0]) ? reportData.issues[0] : "تنبيه جديد";
        const body = reportData.note && reportData.note !== "لا توجد تفاصيل إضافية"
            ? `${issueTitle} - ${reportData.note}`
            : issueTitle;

        const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${firebaseConfig.projectId}/messages:send`;

        const sendPromises = [];
        tokensSnap.forEach(doc => {
            const tokenData = doc.data();
            if (tokenData && tokenData.token) {
                const payload = {
                    message: {
                        token: tokenData.token,
                        data: {
                            title: title,
                            body: body,
                            reportId: String(reportId || Date.now()),
                            url: window.location.origin + "/app/"
                        },
                        webpush: {
                            headers: {
                                Urgency: "high",
                                TTL: "86400"
                            }
                        }
                    }
                };
                sendPromises.push(
                    fetch(fcmEndpoint, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    }).catch(e => console.warn("Push token send error:", e))
                );
            }
        });

        await Promise.all(sendPromises);
    } catch (err) {
        console.warn("Background push error:", err);
    }
}

// دالة إرسال البلاغ
async function submitCarReport(reportData) {
    if (!isDemoMode && db) {
        const docRef = await db.collection("car_reports").add({
            ...reportData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "new"
        });
        // إرسال إشعار خلفية فوري لهاتف المالك حتى والتطبيق مغلق
        sendBackgroundPushToOwner(reportData, docRef.id);
        return { success: true, id: docRef.id };
    } else {
        const reports = JSON.parse(localStorage.getItem("demo_car_reports") || "[]");
        const newReport = {
            id: "rep_" + Date.now(),
            ...reportData,
            createdAt: new Date().toISOString(),
            status: "new"
        };
        reports.unshift(newReport);
        localStorage.setItem("demo_car_reports", JSON.stringify(reports));

        try {
            const channel = new BroadcastChannel("car_alerts_channel");
            channel.postMessage({ type: "NEW_REPORT", data: newReport });
        } catch (err) {}

        return { success: true, id: newReport.id };
    }
}
