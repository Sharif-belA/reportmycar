# 🚗 نظام تنبيه السيارات الذكي بالـ QR Code (نسخة موحدة جاهزة للتشغيل)

> 🇬🇧 **For English Documentation:** See **[README.en.md](./README.en.md)** (أو انزل لأسفل هذا الملف للنسخة الإنجليزية).
> 🟢 **لأخذ نسخة خاصة بك في ثانية واحدة:** اضغط على زر **[Use this template](https://github.com/Sharif-belA/reportmycar/generate)** أعلى الصفحة!

يجمع هذا المستودع الواحد بين:
1. **موقع الإبلاغ للناس في الشارع (`/`)**: يفتح عند مسح استيكر الـ QR Code الموجود على السيارة (`/?id=XXXXXXXX`).
2. **تطبيق المالك للموبايل (`/app/`)**: تطبيق ويب تقدمي (PWA) محمي بكلمة سر لاستقبال البلاغات وإشعارات الموبايل، إدارة السيارات، وتصميم وطباعة استيكر الباركود الملون بثيم السيارة.

---

## 🛠️ خطوات التشغيل خطوة بخطوة (في 5 دقائق مجاناً 100%)

### الخطوة 1: إنشاء قاعدة بياناتك الخاصة على Firebase
1. افتح موقع **[Firebase Console](https://console.firebase.google.com/)** بحساب الجيميل الخاص بك واضغط **Create a project**.
<img width="1300" height="537" alt="1" src="https://github.com/user-attachments/assets/6ffd8122-e835-46a6-b3c5-28158b6ebf15" />
<img width="1539" height="800" alt="2" src="https://github.com/user-attachments/assets/ad98c0bb-5f63-409e-a8c6-689e0e44dea8" />
<img width="772" height="610" alt="3" src="https://github.com/user-attachments/assets/d3331ce0-4ee2-4350-a959-6a3efa722a49" />

2. من القائمة الجانبية، اختر **Build** ⬅️ **Authentication** ⬅️ اضغط **Get started** ⬅️ اختر **Email/Password** وفعّل أول خيار (**Enable**) ثم اضغط **Save**.
<img width="523" height="478" alt="4" src="https://github.com/user-attachments/assets/a2d09f31-67b3-4538-b590-76a4fb4e39d0" />
<img width="1281" height="552" alt="6" src="https://github.com/user-attachments/assets/33a3b34d-892e-43d9-b9a6-72383591bae3" />
<img width="1281" height="552" alt="7" src="https://github.com/user-attachments/assets/598a7517-1cac-426e-8be5-93f3266df3a9" />

3. من القائمة الجانبية، اختر **Build** ⬅️ **Firestore Database** ⬅️ اضغط **Create database** ⬅️ اختر **Start in production mode** ثم **Create**.
<img width="1036" height="592" alt="8" src="https://github.com/user-attachments/assets/3e8b60c5-f4c9-480e-b575-4f292e8c3a9a" />
<img width="844" height="1539" alt="9" src="https://github.com/user-attachments/assets/b9181b66-68f0-438f-b0fd-f0804e2a8546" />

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
<img width="1575" height="880" alt="10" src="https://github.com/user-attachments/assets/354d4aa6-a6bc-45a0-a1aa-62beb6a373c0" />

---

### الخطوة 2: نسخ مفاتيح Firebase ووضعها في ملف `firebase-keys.js`
1. في إعدادات مشروعك على Firebase (**Project Settings** ⚙️)، انزل للأسفل واضغط على أيقونة الويب **`</>`** لتسجيل موقع جديد.
<img width="1333" height="789" alt="11" src="https://github.com/user-attachments/assets/c7c906b6-6be8-400a-92f1-51119822c80a" />
<img width="539" height="488" alt="12" src="https://github.com/user-attachments/assets/f0f528c2-cccd-4fc5-ba2d-e2cdb95e2308" />

2. سيظهر لك كود بـ 6 أسطر اسمه `firebaseConfig`.
<img width="630" height="654" alt="13" src="https://github.com/user-attachments/assets/be8385bb-27dd-4244-b549-301838e124cf" />

3. افتح ملف **`firebase-keys.js`** الموجود في هذا الفولدر، وضع القيم الخاصة بمشروعك بداخله واحفظ الملف.
<img width="941" height="933" alt="14" src="https://github.com/user-attachments/assets/64235983-5413-4443-88e7-1c3e130b4277" />

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

---
---

# 🇬🇧 English Setup Guide — Smart Car QR Alert System

This unified repository combines both parts of the **Smart Car QR Alert System** into a single project:
1. **Public Street Reporter Website (`/`)**: Opens when someone on the street scans the QR code sticker on your car (`/?id=XXXXXXXX`).
2. **Owner Mobile App PWA (`/app/`)**: Password-protected Progressive Web App (PWA) for the car owner to receive real-time alerts & background push notifications, manage multiple cars, customize the public site, and print/download custom color-themed QR stickers.

### Step 1: Create Your Own Firebase Database
1. Go to **[Firebase Console](https://console.firebase.google.com/)** with your Google account and click **Create a project**.
2. Go to **Build** ➡️ **Authentication** ➡️ **Get started** ➡️ select **Email/Password**, toggle **Enable**, and click **Save**.
3. Go to **Build** ➡️ **Firestore Database** ➡️ **Create database** ➡️ select **Start in production mode** and click **Create**.
4. Open the **Rules** tab inside **Firestore Database**, paste the security rules shown above in Step 1, and click **Publish**.

### Step 2: Paste Your Firebase Config into `firebase-keys.js`
1. In Firebase Console ➡️ **Project Settings** ⚙️, scroll down and click the Web icon **`</>`** to register a web app.
2. Copy the `firebaseConfig` object.
3. Open **[`firebase-keys.js`](./firebase-keys.js)**, paste your keys, and save the file. *(This single file powers both the public website and the owner app automatically!)*

### Step 3: Deploy to GitHub & Vercel
1. Push this folder to a new **GitHub Repository** (can be **Private 🔒**).
2. Log in to **[Vercel.com](https://vercel.com)** with GitHub, click **Add New...** ➡️ **Project** ➡️ **Import** your repository and click **Deploy**.
3. Your live links will be:
   * 🌐 **Public Street QR Link:** `https://your-project.vercel.app/?id=XXXXXXXX`
   * 📱 **Owner Mobile App Link:** `https://your-project.vercel.app/app/`

### Step 4: Set Up Your Owner Account & Print Your Car Sticker
1. Open `https://your-project.vercel.app/app/` on your phone.
2. Enter your email and password and tap **"إنشاء حساب المالك لأول مرة" (Create Owner Account)** to lock the app to your account.
3. Tap **"تثبيت التطبيق" (Install App)** to add the PWA to your home screen, then go to **"🚗 سياراتي" (My Cars)** to customize your car and download/print your QR sticker!

