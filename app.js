// Street Reporter Logic (Matches Mockup: Car Image + Name + Plate + Color Name + Issues Grid)

let selectedIssues = [];
let siteConfig = { ...DEFAULT_SITE_SETTINGS };
let currentCar = {
    id: "K8M3X9P2",
    name: "اسم نوع العربية",
    plate: "أ ب ج 1234",
    colorName: "فضي",
    color: "#10B981",
    icon: "fa-car-side",
    image: null,
    subtitle: ""
};

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const carIdParam = urlParams.get("id");
    const manualPlateParam = urlParams.get("car");

    // 1. الاستماع لإعدادات شكل الموقع والعناوين وترتيب المشاكل
    subscribeToSiteSettings((settings) => {
        siteConfig = settings;
        applySiteSettingsUI();
        applyCarUI();
    });

    // 2. الاستماع لبيانات السيارة المحددة بالـ ID فقط (إخفاء البيانات تماماً بدون QR صحيح)
    subscribeToCarInfo(
        carIdParam,
        (carData) => {
            currentCar = { ...currentCar, ...carData };
            if (manualPlateParam) {
                currentCar.plate = manualPlateParam;
            }
            const qrScreen = document.getElementById("qr-required-screen");
            const heroHeader = document.getElementById("car-hero-header");
            const formContainer = document.getElementById("report-form-container");
            const successScreen = document.getElementById("success-screen");

            if (qrScreen) qrScreen.classList.add("hidden");
            if (heroHeader) heroHeader.classList.remove("hidden");
            if (formContainer && successScreen && successScreen.classList.contains("hidden")) {
                formContainer.classList.remove("hidden");
            }
            applyCarUI();
        },
        (reason) => {
            const qrScreen = document.getElementById("qr-required-screen");
            const qrTitle = document.getElementById("qr-required-title");
            const qrMsg = document.getElementById("qr-required-msg");
            const heroHeader = document.getElementById("car-hero-header");
            const formContainer = document.getElementById("report-form-container");

            if (heroHeader) heroHeader.classList.add("hidden");
            if (formContainer) formContainer.classList.add("hidden");
            if (qrScreen) qrScreen.classList.remove("hidden");

            if (reason === "not_found") {
                if (qrTitle) qrTitle.textContent = "كود السيارة غير مسجل أو تم تغييره";
                if (qrMsg) qrMsg.textContent = "يرجى التأكد من مسح استيكر الـ QR Code الصحيح الموجود على السيارة مباشرة.";
            } else {
                if (qrTitle) qrTitle.textContent = "يرجى مسح كود الـ QR الخاص بالسيارة";
                if (qrMsg) qrMsg.textContent = "للحفاظ على الخصوصية، لا يمكن عرض بيانات السيارة أو إرسال بلاغ إلا من خلال مسح استيكر الـ QR Code الموجود على زجاج السيارة مباشرة.";
            }
        }
    );
});

// تطبيق إعدادات شكل الموقع والعناوين وترتيب المشاكل واللغة
function applySiteSettingsUI() {
    const isEn = siteConfig.appLang === "en";
    document.documentElement.lang = isEn ? "en" : "ar";
    document.documentElement.dir = isEn ? "ltr" : "rtl";

    // 1. Theme
    const body = document.getElementById("page-body");
    body.classList.remove("theme-dark", "theme-light", "theme-black");
    body.classList.add(`theme-${siteConfig.theme || 'dark'}`);

    // 2. Texts & Labels (Supporting English mode automatically)
    document.getElementById("label-issues-heading").textContent = isEn && (!siteConfig.issuesLabel || siteConfig.issuesLabel === DEFAULT_SITE_SETTINGS.issuesLabel)
        ? "What issue did you notice? (Select one or more)"
        : (siteConfig.issuesLabel || DEFAULT_SITE_SETTINGS.issuesLabel);
    document.getElementById("label-note-heading").textContent = isEn && (!siteConfig.noteLabel || siteConfig.noteLabel === DEFAULT_SITE_SETTINGS.noteLabel)
        ? "Additional details (optional):"
        : (siteConfig.noteLabel || DEFAULT_SITE_SETTINGS.noteLabel);
    document.getElementById("report-note").placeholder = isEn && (!siteConfig.notePlaceholder || siteConfig.notePlaceholder === DEFAULT_SITE_SETTINGS.notePlaceholder)
        ? "Example: Rear right window is open, or I am waiting next to the car..."
        : (siteConfig.notePlaceholder || DEFAULT_SITE_SETTINGS.notePlaceholder);
    document.getElementById("label-phone-heading").textContent = isEn && (!siteConfig.phoneLabel || siteConfig.phoneLabel === DEFAULT_SITE_SETTINGS.phoneLabel)
        ? "Your phone number (optional, if you'd like the owner to contact you):"
        : (siteConfig.phoneLabel || DEFAULT_SITE_SETTINGS.phoneLabel);
    document.getElementById("btn-text").textContent = isEn && (!siteConfig.submitBtnText || siteConfig.submitBtnText === DEFAULT_SITE_SETTINGS.submitBtnText)
        ? "Send Alert to Car Owner"
        : (siteConfig.submitBtnText || DEFAULT_SITE_SETTINGS.submitBtnText);
    document.getElementById("success-title-label").textContent = isEn && (!siteConfig.successTitle || siteConfig.successTitle === DEFAULT_SITE_SETTINGS.successTitle)
        ? "Alert Sent Successfully!"
        : (siteConfig.successTitle || DEFAULT_SITE_SETTINGS.successTitle);
    document.getElementById("success-msg-label").textContent = isEn && (!siteConfig.successMessage || siteConfig.successMessage === DEFAULT_SITE_SETTINGS.successMessage)
        ? "Your alert has been delivered to the car owner's mobile app immediately. Thank you for helping out!"
        : (siteConfig.successMessage || DEFAULT_SITE_SETTINGS.successMessage);

    // 3. Show/Hide optional fields
    document.getElementById("note-field-wrapper").style.display = (siteConfig.showNoteField === false) ? "none" : "block";
    document.getElementById("phone-field-wrapper").style.display = (siteConfig.showPhoneField === false) ? "none" : "block";

    // 4. Issues Grid Layout & Ordering
    const grid = document.getElementById("issues-grid-container");
    const cols = Number(siteConfig.gridColumns) === 1 ? "grid-cols-1" : "grid-cols-2";
    grid.className = `grid ${cols} gap-2.5 ${isEn ? 'text-left' : 'text-right'}`;

    const enIssueMap = {
        "iss_1": "Blocking / Double Parked",
        "iss_2": "Car Window Open",
        "iss_3": "Headlights Left On",
        "iss_4": "Flat / Low Tire",
        "iss_5": "Car Alarm Ringing",
        "iss_6": "Accident / Scratched"
    };

    const issues = siteConfig.issuesList || DEFAULT_SITE_SETTINGS.issuesList;
    grid.innerHTML = issues.map(item => {
        const isActive = selectedIssues.includes(item.value);
        const isRow = Number(siteConfig.gridColumns) === 1;
        const iconColor = item.color || "#10B981";
        const displayLabel = (isEn && enIssueMap[item.id] && item.label === (DEFAULT_SITE_SETTINGS.issuesList.find(d => d.id === item.id) || {}).label)
            ? enIssueMap[item.id]
            : item.label;
        const safeValue = (item.value || item.label).replace(/'/g, "\\'");
        return `
            <button type="button" onclick="toggleIssue(this, '${safeValue}')" class="issue-btn ${isActive ? 'active' : ''} p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 hover:border-emerald-500 transition-all flex ${isRow ? 'flex-row items-center gap-3' : 'flex-col items-start gap-2'} ${isEn ? 'text-left' : 'text-right'}">
                <span style="background-color: ${iconColor}20; color: ${iconColor};" class="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0">
                    <i class="fa-solid ${item.icon || 'fa-circle-exclamation'}"></i>
                </span>
                <span class="issue-label text-xs font-bold opacity-95">${displayLabel}</span>
            </button>
        `;
    }).join('');
}

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
    if (t.includes("فضي") || t.includes("سيلفر") || t.includes("رمادي") || t.includes("فيراني") || t.includes("جراي") || t.includes("silver") || t.includes("gray")) return "#64748B";
    if (t.includes("اسود") || t.includes("أسود") || t.includes("سوداء") || t.includes("black")) return "#10B981";
    if (t.includes("ابيض") || t.includes("أبيض") || t.includes("بيضاء") || t.includes("white")) return "#38BDF8";
    return null;
}

// تطبيق بيانات السيارة: الصورة فوق، وتحتها (اسم نوع العربية + رقم العربية + لونها) مع تلوين ثيم الموقع بلون العربية
function applyCarUI() {
    const nameLabel = document.getElementById("car-name-label");
    const plateLabel = document.getElementById("car-plate-label");
    const colorNameLabel = document.getElementById("car-color-name-label");
    const subtitleLabel = document.getElementById("car-subtitle-label");

    const photoWrapper = document.getElementById("header-car-photo-wrapper");
    const photoImg = document.getElementById("header-car-photo");
    const headerIconBox = document.getElementById("header-car-icon-box");
    const submitBtn = document.getElementById("submit-btn");

    // السطر 1: اسم نوع العربية
    const carTitle = currentCar.name || "اسم نوع العربية";
    if (nameLabel) nameLabel.textContent = carTitle;
    document.getElementById("page-doc-title").textContent = siteConfig.mainTitle || carTitle;

    // السطر 2: رقم العربية
    if (plateLabel) plateLabel.textContent = currentCar.plate || "أ ب ج 1234";

    const mappedColor = resolveColorFromArabicName(currentCar.colorName);
    const color = (mappedColor && (!currentCar.color || currentCar.color === "#10B981"))
        ? mappedColor
        : (currentCar.color || mappedColor || "#10B981");
    const iconClass = currentCar.icon || "brand-mitsubishi";

    // تطبيق لون السيارة على متغيرات الـ CSS الخاصة بثيم الصفحة
    document.documentElement.style.setProperty("--car-theme", color);
    document.documentElement.style.setProperty("--car-theme-soft", `${color}26`);
    document.documentElement.style.setProperty("--car-theme-glow", `${color}45`);

    // السطر 3: لونها
    if (colorNameLabel) {
        if (currentCar.colorName) {
            colorNameLabel.textContent = currentCar.colorName;
            colorNameLabel.style.color = color;
            colorNameLabel.classList.remove("hidden");
        } else {
            colorNameLabel.textContent = "";
            colorNameLabel.classList.add("hidden");
        }
    }

    // سطر ترحيبي إضافي إن وجد
    if (subtitleLabel) {
        if (currentCar.subtitle) {
            subtitleLabel.textContent = currentCar.subtitle;
            subtitleLabel.classList.remove("hidden");
        } else {
            subtitleLabel.classList.add("hidden");
        }
    }

    // إظهار صورة العربية الكبيرة في الأعلى، أو الشعار/الأيقونة إذا لم ترفع صورة بعد
    if (currentCar.image) {
        photoWrapper.classList.remove("hidden");
        photoImg.src = currentCar.image;
        headerIconBox.classList.add("hidden");
    } else {
        photoWrapper.classList.add("hidden");
        headerIconBox.classList.remove("hidden");
        headerIconBox.style.backgroundColor = color;
        headerIconBox.style.boxShadow = `0 10px 25px -5px ${color}66`;
        headerIconBox.innerHTML = iconClass === "brand-mitsubishi"
            ? `<svg class="w-11 h-11 fill-current text-white" viewBox="0 0 200 180"><polygon points="100,11 130,63 100,115 70,63"/><polygon points="100,115 40,115 10,167 70,167"/><polygon points="100,115 160,115 190,167 130,167"/></svg>`
            : `<i id="header-car-icon" class="fa-solid ${iconClass} text-white"></i>`;
    }

    if (submitBtn) {
        submitBtn.style.backgroundColor = color;
        submitBtn.style.color = "#FFFFFF";
    }
}

function toggleIssue(btn, issueText) {
    if (btn.classList.contains("active")) {
        btn.classList.remove("active");
        selectedIssues = selectedIssues.filter(i => i !== issueText);
    } else {
        btn.classList.add("active");
        selectedIssues.push(issueText);
    }
}

async function handleReportSubmission() {
    const note = document.getElementById("report-note").value.trim();
    const reporterPhone = document.getElementById("reporter-phone").value.trim();
    const submitBtn = document.getElementById("submit-btn");
    const btnText = document.getElementById("btn-text");

    if (selectedIssues.length === 0 && !note) {
        alert("يرجى اختيار المشكلة أو كتابة ملاحظة توضيحية قبل الإرسال!");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-70", "cursor-not-allowed");
    btnText.innerHTML = `<i class="fa-solid fa-spinner fa-spin ml-2"></i> جاري الإرسال...`;

    const reportData = {
        carId: currentCar.id,
        carName: currentCar.name || "سيارتي",
        carPlate: currentCar.plate || "أ ب ج 1234",
        carColorName: currentCar.colorName || "",
        carColor: currentCar.color || "#10B981",
        carIcon: currentCar.icon || "fa-car-side",
        issues: selectedIssues.length > 0 ? selectedIssues : ["ملاحظة مخصصة"],
        note: note || "لا توجد تفاصيل إضافية",
        reporterPhone: reporterPhone || null,
        userAgent: navigator.userAgent
    };

    try {
        await submitCarReport(reportData);

        document.getElementById("report-form-container").classList.add("hidden");
        document.getElementById("success-screen").classList.remove("hidden");
    } catch (err) {
        console.error("Error submitting report:", err);
        alert("حدث خطأ أثناء إرسال البلاغ، يرجى المحاولة مرة أخرى.");
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
        btnText.textContent = siteConfig.submitBtnText || "إرسال البلاغ لمالك السيارة";
    }
}

function resetForm() {
    selectedIssues = [];
    document.querySelectorAll(".issue-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("report-note").value = "";
    document.getElementById("reporter-phone").value = "";

    const submitBtn = document.getElementById("submit-btn");
    const btnText = document.getElementById("btn-text");
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
    btnText.textContent = siteConfig.submitBtnText || "إرسال البلاغ لمالك السيارة";

    document.getElementById("success-screen").classList.add("hidden");
    document.getElementById("report-form-container").classList.remove("hidden");
}
