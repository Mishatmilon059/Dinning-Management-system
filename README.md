# Hall Mess Management System (HMMS)

HMMS is a modern, responsive, and feature-rich Web Application designed to streamline dining hall operations, inventory logs, and financial accounting in residential dormitories (such as those at BUET).

Built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS**, the system offers a dual-mode database layer supporting live **Firebase Firestore** sync or a self-seeding **Local Storage** fallback. It delivers tailored experiences through three dedicated portals: **Student**, **Mess Manager**, and **Provost / Admin**.

---

## 🏛️ System Architecture & Portals

### 1. 🎓 Student Portal
Designed for residential students to manage their daily dining needs and maintain clear communication with administration:
* **Meal Status & Bookings:** View current meal statuses (On/Off) and book meals dynamically.
* **Menu Board:** Check the daily menu for Breakfast, Lunch, and Dinner, along with estimated meal costs.
* **Financial Oversight:** View current dues, pending payments, and transaction history.
* **Feedback & Reactions:** Submit reactions (Like, Love, Angry) and comments on meals to provide real-time feedback to managers.
* **Complaints System:** File administrative or facility complaints (e.g., water filter, hygiene issues) and request manager endorsements.
* **Directories:** Access quick contacts for the Provost, dining staff, security control room, and medical emergency assistance.

### 2. 🍳 Mess Manager Portal
A comprehensive workspace empowering student mess managers to run daily operations transparently and efficiently:
* **Real-time Inventory Tracking:** Log pantry stock (Rice, Lentils, Oil, Chicken, etc.) and view calculated daily usage rates with automatic depletion date estimators.
* **Itemized Expense Ledger:** Log daily purchases by category, calculate immediate totals, and lock pages to archive immutable financial records.
* **Cash Collections Ledger:** Log payments received from students and monitor live cash-on-hand.
* **Automated PDF Reports:** Generate clean, print-ready monthly financial ledgers and invoices using **jsPDF** and **jspdf-autotable**—complete with summary blocks and signature panels for audits.
* **Menu & Notice Manager:** Update the dining menu and broadcast notifications or set payment deadlines.
* **Student Directory & Logs:** Oversee student status, active/inactive dining members, and review student feedback.

### 3. 🛡️ Provost / Admin Portal
An executive dashboard for university administrators to monitor operations and maintain accountability:
* **Overview Analytics:** Audit total dining expenditures, cash collected, and overall financial health.
* **Manager Assignments:** Assign active student managers to specific operational months or suspend privileges.
* **Operational Logs & Audits:** Monitor real-time system events, notices, and financial summaries.
* **Complaints Board:** Review student complaints, track severity markers, and endorse action items for resolution.

---

## 🎨 Theme & Design Philosophy: "Royal Crest"

HMMS breaks away from generic dashboards by implementing the **Royal Crest** design system—a bespoke aesthetic tailored to evoke a premium, academic feel:
* **Sleek Palette:** Gold accents (`#C9A84C`) set against a rich, deep navy blue background (`#0A0F1E`) with cream typography.
* **Visual Layering:** Smooth glassmorphic containers (`backdrop-filter: blur(12px)`) sitting on top of slow-drifting colored ambient background blobs.
* **Film Grain Texture:** A subtle SVG noise overlay gives the interface a premium, physical paper-like texture.
* **Smooth Transitions:** Unified transition rules for colors, borders, and shadows to deliver fluid interaction feedbacks.
* **Custom Typography:** Integrated serif fonts (*Cormorant Garamond*) for headings, geometric sans-serif (*DM Sans*) for UI controls, and monospace (*JetBrains Mono*) for numeric stats and ledger tables.

---

## 🛠️ Technology Stack

* **Frontend:** React 19 (Functional components, Hooks)
* **Language:** TypeScript (Strict compiler rules)
* **Build System:** Vite (Fast bundle compilation and HMR)
* **Styling:** Tailwind CSS (Custom HSL theme maps, responsive design)
* **Database & Auth:** Firebase Firestore / Firebase Auth (with automatic local mock database fallback if config keys are missing)
* **Libraries:**
  * `framer-motion` (Dynamic micro-interactions and route animations)
  * `lucide-react` (Crisp SVG icon library)
  * `jspdf` & `jspdf-autotable` (Client-side PDF report compiler)
  * `react-router-dom` (Declarative routing)

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have **Node.js** (v18.0.0 or higher) and **npm** installed on your system.

### ⚙️ Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd "dinning management"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### 🔑 Configuration (Optional - Firebase)
To enable live cloud sync, create a `.env` file in the root directory and populate your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```
*Note: If these variables are omitted, the application will automatically run in local mock mode utilizing Local Storage. Out-of-the-box demo credentials will work immediately.*

### 🏃 Running Locally
Start the development server:
```bash
npm run dev
```
Open your browser and navigate to the local URL (usually `http://localhost:5173`).

### 📦 Building for Production
To compile and optimize the app for production:
```bash
npm run build
```
The output bundle will be generated in the `dist` directory.

---

## 👥 Demo Access Accounts
For testing in mock mode, use the following credentials on the login screen:

* **Mess Manager:**
  * **ID:** `2012001`
  * **Password:** `manager123`
* **Provost / Admin:**
  * **ID:** `1001`
  * **Password:** `provost123`
