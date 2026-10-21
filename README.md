# 🚗 نظام تنبيه السيارات الذكي بالـ QR Code (نسخة موحدة جاهزة للتشغيل)

يجمع هذا المستودع الواحد بين:
1. **موقع الإبلاغ للناس في الشارع (`/`)**: يفتح عند مسح استيكر الـ QR Code الموجود على السيارة (`/?id=XXXXXXXX`).
2. **تطبيق المالك للموبايل (`/app/`)**: تطبيق ويب تقدمي (PWA) محمي بكلمة سر لاستقبال البلاغات وإشعارات الموبايل، إدارة السيارات، وتصميم وطباعة استيكر الباركود الملون بثيم السيارة.

---

## 🛠️ خطوات التشغيل خطوة بخطوة (في 5 دقائق مجاناً 100%)

### الخطوة 1: إنشاء قاعدة بياناتك الخاصة على Firebase
1. افتح موقع **[Firebase Console](https://console.firebase.google.com/)** بحساب الجيميل الخاص بك واضغط **Create a project**.
2. من القائمة الجانبية، اختر **Build** ⬅️ **Authentication** ⬅️ اضغط **Get started** ⬅️ اختر **Email/Password** وفعّل أول خيار (**Enable**) ثم اضغط **Save**.
3. من القائمة الجانبية، اختر **Build** ⬅️ **Firestore Database** ⬅️ اضغط **Create database** ⬅️ اختر **Start in production mode** ثم **Create**.
4. داخل صفحة **Firestore Database**، اضغط على تبويب **Rules** في الأعلى، وامسح الموجود والصق الكود التالي ثم اضغط **Publish**:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // السيارات: مسموح للناس قراءة السيارة الممسوح الباركود الخاص بها فقط (get)
    match /cars/{carId} {
      allow get: if true;
      allow list, create, update, delete: if request.auth != null;
    }

    // البلاغات: مسموح للناس إرسال بلاغ جديد فقط، والقراءة والحذف للمالك فقط
    match /car_reports/{reportId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }

    // إعدادات الموقع والإشعارات: التعديل للمالك المسجل دخوله فقط
    match /site_settings/config {
      allow get: if true;
      allow list, write: if request.auth != null;
    }

    match /site_settings/push_config {
      allow get: if true;
      allow list, write: if request.auth != null;
    }

    match /fcm_tokens/{tokenId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

### الخطوة 2: نسخ مفاتيح Firebase ووضعها في ملف `firebase-keys.js`
1. في إعدادات مشروعك على Firebase (**Project Settings** ⚙️)، انزل للأسفل واضغط على أيقونة الويب **`</>`** لتسجيل موقع جديد.
2. سيظهر لك كود بـ 6 أسطر اسمه `firebaseConfig`.
3. افتح ملف **`firebase-keys.js`** الموجود في هذا الفولدر، وضع القيم الخاصة بمشروعك بداخله واحفظ الملف.

---

### الخطوة 3: رفع المشروع على GitHub وربطه بـ Vercel
1. ارفع هذا الفولدر بالكامل في مستودع (**Repository**) واحد على حسابك في **GitHub** (يمكنك جعله **Private 🔒**).
2. ادخل على موقع **[Vercel.com](https://vercel.com)** بحساب GitHub الخاص بك.
3. اضغط **Add New...** ⬅️ **Project** ⬅️ اختر المستودع واضغط **Deploy**.
4. سيعطيك Vercel رابط موقعك الموحد، مثلاً:
   * 🌐 **رابط الناس في الشارع:** `https://your-project.vercel.app/?id=XXXXXXXX`
   * 📱 **رابط تطبيق المالك للموبايل:** `https://your-project.vercel.app/app/`

---

### الخطوة 4: فتح تطبيق المالك وإضافة سيارتك وطباعة الاستيكر
1. افتح رابط تطبيقك من موبايلك: `https://your-project.vercel.app/app/`
2. اكتب بريدك الإلكتروني وكلمة مرور من اختيارك واضغط **"إنشاء حساب المالك لأول مرة"** (سيتم قفل التطبيق على حسابك أنت فقط للأبد).
3. اضغط على زر **"تثبيت التطبيق"** ليظهر كأيقونة تطبيق على شاشة موبايلك.
4. من تبويب **"🚗 سياراتي"**: عدّل اسم ولون ورقم وصورة سيارتك، ثم اضغط **"الاستيكر والباركود"** لتحميل أو طباعة استيكر سيارتك الملون بثيم عربيتك!
