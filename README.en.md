# 🚗 Smart Car QR Alert System (Unified Single-Repo Template)

> 🇸🇦 **للنسخة العربية:** راجع ملف [README.md](./README.md) أو القسم العربي.

This unified repository combines both parts of the **Smart Car QR Alert System** into a single project:
1. **Public Street Reporter Website (`/`)**: Opens when someone on the street scans the QR code sticker on your car (`/?id=XXXXXXXX`).
2. **Owner Mobile App PWA (`/app/`)**: Password-protected Progressive Web App (PWA) for the car owner to receive real-time alerts & background push notifications, manage multiple cars, customize the public site, and print/download custom color-themed QR stickers.

---

## 🛠️ Step-by-Step Setup Guide (5 Minutes — 100% Free)

### Step 1: Create Your Own Firebase Database
1. Go to **[Firebase Console](https://console.firebase.google.com/)** with your Google account and click **Create a project**.
2. From the left sidebar, go to **Build** ➡️ **Authentication** ➡️ click **Get started** ➡️ select **Email/Password**, toggle **Enable**, and click **Save**.
3. From the left sidebar, go to **Build** ➡️ **Firestore Database** ➡️ click **Create database** ➡️ select **Start in production mode** and click **Create**.
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

---

### Step 2: Paste Your Firebase Config into `firebase-keys.js`
1. In your Firebase Console, open **Project Settings** ⚙️, scroll down, and click the Web icon **`</>`** to register a new web app.
2. Copy the `firebaseConfig` values shown on screen.
3. Open **[`firebase-keys.js`](./firebase-keys.js)** in the root of this project, paste your keys, and save the file. *(This single file automatically powers both the public website and the owner mobile app!)*

---

### Step 3: Deploy to GitHub & Vercel
1. Upload this folder to a new **GitHub Repository** on your account (you can keep the repository **Private 🔒**).
2. Log in to **[Vercel.com](https://vercel.com)** with your GitHub account.
3. Click **Add New...** ➡️ **Project** ➡️ **Import** your repository and click **Deploy**.
4. Vercel will give you your live domain (for example, `https://your-project.vercel.app`):
   * 🌐 **Public Street QR Link:** `https://your-project.vercel.app/?id=XXXXXXXX`
   * 📱 **Owner Mobile App Link:** `https://your-project.vercel.app/app/`

---

### Step 4: Set Up Your Owner Account & Print Your Car Sticker
1. Open `https://your-project.vercel.app/app/` on your phone.
2. Enter your email and a password (at least 6 characters) and tap **"إنشاء حساب المالك لأول مرة" (Create Owner Account for the First Time)**.
   * *Note: This permanently locks the app to your single owner account.*
3. Tap **"تثبيت التطبيق" (Install App)** at the top to install the PWA on your phone's home screen.
4. Go to the **"🚗 سياراتي" (My Cars)** tab to customize your car's name, plate number, color theme, and photo, then tap **"الاستيكر والباركود" (Sticker & QR Code)** to download a high-resolution PNG sticker or print it directly!

---

## 🔔 Optional: Enabling Background Push Notifications (When App is Closed)
To receive mobile notifications even when the app is completely closed:
1. In Firebase Console ➡️ **Project Settings** ⚙️ ➡️ **Cloud Messaging** tab ➡️ under **Web configuration**, click **Generate key pair** and copy the **VAPID Key**.
2. In **Project Settings** ⚙️ ➡️ **Service accounts** tab ➡️ click **Generate new private key** to download the `.json` file.
3. Open your Owner App (`/app/`) ➡️ go to the **"⚙️ الإعدادات" (Settings)** tab ➡️ paste the **VAPID Key**, select the downloaded **`.json` file**, and tap **"حفظ وتفعيل إشعارات الخلفية لهذا الموبايل"**.
