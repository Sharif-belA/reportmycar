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

<img width="941" height="933" alt="15" src="https://github.com/user-attachments/assets/24c6f326-1ec0-4a19-bd13-87b8efa49836" />
<img width="941" height="1249" alt="17" src="https://github.com/user-attachments/assets/2d2174d0-1ffb-49f5-9afb-a2fee7fbda41" />

3. اضغط **Add New...** ⬅️ **Project** ⬅️ اختر المستودع واضغط **Deploy**.
<img width="948" height="301" alt="18" src="https://github.com/user-attachments/assets/5942c4be-1b3b-4afc-8f46-dbcb5dce4940" />
<img width="766" height="679" alt="19" src="https://github.com/user-attachments/assets/ab076ba7-9641-4c05-8b4c-b651f6a4220d" />
<img width="738" height="800" alt="20" src="https://github.com/user-attachments/assets/9d72e5bc-dd8e-4cf7-a488-fd6b5c98a668" />

4. سيعطيك Vercel رابط موقعك الموحد، مثلاً:
   * 🌐 **رابط الناس في الشارع:** `https://your-project.vercel.app/?id=XXXXXXXX`
   * 📱 **رابط تطبيق المالك للموبايل:** `https://your-project.vercel.app/app/`
<img width="1028" height="471" alt="21" src="https://github.com/user-attachments/assets/2acad767-9f5d-4800-ae63-5b78e0881991" />

---

### الخطوة 4: فتح تطبيق المالك وإضافة سيارتك وطباعة الاستيكر
1. افتح رابط تطبيقك من موبايلك: `https://your-project.vercel.app/app/`
2. اكتب بريدك الإلكتروني وكلمة مرور من اختيارك واضغط **"إنشاء حساب المالك لأول مرة"** (سيتم قفل التطبيق على حسابك أنت فقط للأبد).
<img width="532" height="556" alt="22" src="https://github.com/user-attachments/assets/1d2e630e-ad77-4582-b902-61060434caa6" />


3. اضغط على زر **"تثبيت التطبيق"** ليظهر كأيقونة تطبيق على شاشة موبايلك.
4. من تبويب **"🚗 سياراتي"**: عدّل اسم ولون ورقم وصورة سيارتك، ثم اضغط **"الاستيكر والباركود"** لتحميل أو طباعة استيكر سيارتك الملون بثيم عربيتك!
<img width="540" height="1136" alt="Screenshot_2026-10-21-14-46-47-040_com android chrome-edit jpg" src="https://github.com/user-attachments/assets/e9bec5ed-3592-474e-87a5-84f99fe4cf09" />

---
---

# 🇬🇧 English Setup Guide — Smart Car QR Alert System

## 🛠️ Step-by-Step Setup Guide (5 Minutes — 100% Free)

### Step 1: Create Your Own Firebase Database
1. Go to **[Firebase Console](https://console.firebase.google.com/)** with your Google account and click **Create a project**.
<img width="1300" height="537" alt="1" src="https://github.com/user-attachments/assets/6ffd8122-e835-46a6-b3c5-28158b6ebf15" />
<img width="1539" height="800" alt="2" src="https://github.com/user-attachments/assets/ad98c0bb-5f63-409e-a8c6-689e0e44dea8" />
<img width="772" height="610" alt="3" src="https://github.com/user-attachments/assets/d3331ce0-4ee2-4350-a959-6a3efa722a49" />

2. From the left sidebar, go to **Build** ➡️ **Authentication** ➡️ click **Get started** ➡️ select **Email/Password**, toggle **Enable**, and click **Save**.
<img width="523" height="478" alt="4" src="https://github.com/user-attachments/assets/a2d09f31-67b3-4538-b590-76a4fb4e39d0" />
<img width="1281" height="552" alt="6" src="https://github.com/user-attachments/assets/33a3b34d-892e-43d9-b9a6-72383591bae3" />
<img width="1281" height="552" alt="7" src="https://github.com/user-attachments/assets/598a7517-1cac-426e-8be5-93f3266df3a9" />

3. From the left sidebar, go to **Build** ➡️ **Firestore Database** ➡️ click **Create database** ➡️ select **Start in production mode** and click **Create**.
<img width="1036" height="592" alt="8" src="https://github.com/user-attachments/assets/3e8b60c5-f4c9-480e-b575-4f292e8c3a9a" />
<img width="844" height="1539" alt="9" src="https://github.com/user-attachments/assets/b9181b66-68f0-438f-b0fd-f0804e2a8546" />

4. Inside **Firestore Database**, open the **Rules** tab at the top, replace the existing rules with the following code, and click **Publish**:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // 1. Cars: Public can only fetch a single car if they have its 8-char QR ID (get).
    // Listing all cars or modifying them is restricted to the authenticated owner.
    match /cars/{carId} {
      allow get: if true;
      allow list, create, update, delete: if request.auth != null;
    }

    // 2. Reports: Public can only submit new reports (create).
    // Reading, updating, or deleting reports is restricted to the authenticated owner.
    match /car_reports/{reportId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }

    // 3. Site & Push Settings: Read allowed for operation; write restricted to owner.
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

### Step 2: Paste Your Firebase Config into `firebase-keys.js`
1. In your Firebase Console, open **Project Settings** ⚙️, scroll down, and click the Web icon **`</>`** to register a new web app.
<img width="1333" height="789" alt="11" src="https://github.com/user-attachments/assets/c7c906b6-6be8-400a-92f1-51119822c80a" />
<img width="539" height="488" alt="12" src="https://github.com/user-attachments/assets/f0f528c2-cccd-4fc5-ba2d-e2cdb95e2308" />

2. Copy the `firebaseConfig` values shown on screen.
<img width="630" height="654" alt="13" src="https://github.com/user-attachments/assets/be8385bb-27dd-4244-b549-301838e124cf" />

3. Open **[`firebase-keys.js`](./firebase-keys.js)** in the root of this project, paste your keys, and save the file. *(This single file automatically powers both the public website and the owner mobile app!)*
<img width="941" height="933" alt="14" src="https://github.com/user-attachments/assets/64235983-5413-4443-88e7-1c3e130b4277" />

---

### Step 3: Deploy to GitHub & Vercel
1. Upload this folder to a new **GitHub Repository** on your account (you can keep the repository **Private 🔒**).
2. Log in to **[Vercel.com](https://vercel.com)** with your GitHub account.

<img width="941" height="933" alt="15" src="https://github.com/user-attachments/assets/24c6f326-1ec0-4a19-bd13-87b8efa49836" />
<img width="941" height="1249" alt="17" src="https://github.com/user-attachments/assets/2d2174d0-1ffb-49f5-9afb-a2fee7fbda41" />

3. Click **Add New...** ➡️ **Project** ➡️ **Import** your repository and click **Deploy**.
<img width="948" height="301" alt="18" src="https://github.com/user-attachments/assets/5942c4be-1b3b-4afc-8f46-dbcb5dce4940" />
<img width="766" height="679" alt="19" src="https://github.com/user-attachments/assets/ab076ba7-9641-4c05-8b4c-b651f6a4220d" />
<img width="738" height="800" alt="20" src="https://github.com/user-attachments/assets/9d72e5bc-dd8e-4cf7-a488-fd6b5c98a668" />

4. Vercel will give you your live domain (for example, `https://your-project.vercel.app`):
   * 🌐 **Public Street QR Link:** `https://your-project.vercel.app/?id=XXXXXXXX`
   * 📱 **Owner Mobile App Link:** `https://your-project.vercel.app/app/`
<img width="1028" height="471" alt="21" src="https://github.com/user-attachments/assets/2acad767-9f5d-4800-ae63-5b78e0881991" />

---

### Step 4: Set Up Your Owner Account & Print Your Car Sticker
1. Open `https://your-project.vercel.app/app/` on your phone.
2. Enter your email and a password (at least 6 characters) and tap **"إنشاء حساب المالك لأول مرة" (Create Owner Account for the First Time)**.
   * *Note: This permanently locks the app to your single owner account.*
<img width="532" height="556" alt="22" src="https://github.com/user-attachments/assets/1d2e630e-ad77-4582-b902-61060434caa6" />

3. Tap **"تثبيت التطبيق" (Install App)** at the top to install the PWA on your phone's home screen.
4. Go to the **"🚗 سياراتي" (My Cars)** tab to customize your car's name, plate number, color theme, and photo, then tap **"الاستيكر والباركود" (Sticker & QR Code)** to download a high-resolution PNG sticker or print it directly!
<img width="540" height="1136" alt="Screenshot_2026-10-21-14-46-47-040_com android chrome-edit jpg" src="https://github.com/user-attachments/assets/e9bec5ed-3592-474e-87a5-84f99fe4cf09" />

---

## 🔔 Optional: Enabling Background Push Notifications (When App is Closed)
To receive mobile notifications even when the app is completely closed:
1. In Firebase Console ➡️ **Project Settings** ⚙️ ➡️ **Cloud Messaging** tab ➡️ under **Web configuration**, click **Generate key pair** and copy the **VAPID Key**.
2. In **Project Settings** ⚙️ ➡️ **Service accounts** tab ➡️ click **Generate new private key** to download the `.json` file.
3. Open your Owner App (`/app/`) ➡️ go to the **"⚙️ الإعدادات" (Settings)** tab ➡️ paste the **VAPID Key**, select the downloaded **`.json` file**, and tap **"حفظ وتفعيل إشعارات الخلفية لهذا الموبايل"**.
