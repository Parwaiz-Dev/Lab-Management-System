# Lab Management System (LMS)

## Overview

The Lab Management System (LMS) is a desktop application built using Tauri, which combines a Rust backend for performance and security with a React frontend for a modern user interface. This system is designed to manage laboratory operations, including patient records, test orders, results, and reporting.

## Features

- **Patient Management**: Create, update, and manage patient records
- **Test Management**: Handle laboratory tests and their configurations
- **Order Management**: Process and track test orders
- **Report Generation**: Generate and manage test reports
- **Modular Architecture**: Feature-based modules for easy maintenance and extension

## Architecture

### Frontend (React)
- **UI Framework**: React with TypeScript
- **Build Tool**: Vite
- **Structure**:
  - `src/components/`: Reusable UI components (common, layout, forms)
  - `src/modules/`: Feature-based modules (patient, test, order, report)
  - `src/hooks/`: Custom React hooks
  - `src/lib/`: Utility functions and helpers
  - `src/routes/`: Routing configuration
  - `src/assets/`: Static assets (images, logos)

### Backend (Rust/Tauri)
- **Framework**: Tauri for cross-platform desktop app
- **Language**: Rust
- **Database**: SQLite (or configurable)
- **Structure**:
  - `src-tauri/src/db/`: Database setup and schema
  - `src-tauri/src/modules/`: Feature-based business logic
  - `src-tauri/src/utils/`: Helper utilities
  - `src-tauri/src/errors/`: Error handling (to be implemented)

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Rust (latest stable)
- Tauri CLI

### Installation

1. Clone the repository
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Install Tauri CLI:
   ```bash
   cargo install tauri-cli
   ```
4. Run the development server:
   ```bash
   npm run tauri dev
   ```

### Building

To build for production:
```bash
npm run tauri build
```

## Project Structure

```
LMS/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   │   ├── common/
│   │   ├── layout/
│   │   └── forms/
│   ├── modules/            # Feature modules
│   │   ├── patient/
│   │   ├── test/
│   │   ├── order/
│   │   └── report/
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities
│   ├── routes/             # Routing
│   ├── assets/             # Static assets
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── db/             # Database layer
│   │   ├── modules/        # Business logic modules
│   │   ├── utils/          # Utilities
│   │   └── errors/         # Error handling
│   ├── Cargo.toml
│   └── tauri.conf.json
└── README.md
```

## Contributing

1. Follow the modular structure for new features
2. Use TypeScript for frontend code
3. Follow Rust best practices for backend code
4. Write tests for new functionality
5. Update documentation as needed

## License

[Add license information here]

## Contact

[Add contact information here]



//new
# 🧪 Lab Management System (LMS)

A modern **desktop-based Lab Management System** built with **Tauri (Rust + React)**, designed for diagnostic labs to manage patients, test orders, results, and billing — all in an **offline-first environment**.

---

## 🚀 Why This Project?

Most small labs need:
- Fast software ⚡
- Offline support 📴
- Simple UI 🧾
- Low cost 💰

This system solves that by providing a **lightweight desktop app** with **production-ready workflow**.

---

## ✨ Key Features

### 👤 Patient Management
- Create & manage patients
- Auto patient selection
- Compact entry UI

### 🧪 Test Selection
- Search & select lab tests
- Multi-test selection
- Dynamic total calculation

### 📦 Order Management
- Create test orders
- Link tests with patients
- Track order lifecycle

### 🧬 Result Entry
- Parameter-based result input
- Auto-load previous values
- Save & update results

### 📄 Report Generation
- Structured lab reports
- Patient + test details
- Ready for print/export

### 🧾 Receipt & Billing
- Payment tracking
- GST support (optional)
- Pending & paid calculation
- Print-ready receipt

### ⚙ Settings
- Lab name & config
- Doctor share (future-ready)
- System customization

---

## 🧱 Tech Stack

### 🖥 Frontend
- React + TypeScript
- Vite
- Custom Design System (Card, Button, Input)

### ⚙ Backend
- Rust (Tauri)
- SQLite (local database)
- Command-based API (Tauri invoke)

### 💾 Database
- Patients
- Tests
- Orders
- Results
- Settings
- Doctors

---

## 🧭 Application Flow
Patient → Select Tests → Create Order → Enter Results → Generate Report → Print Receipt


src/
components/ui/ # Design system (Button, Card, Input)
modules/
patient/
test/
settings/
App.tsx

src-tauri/
db/ # SQLite schema & connection
modules/ # Business logic
main.rs # Tauri entry




---

## 🛠 Installation & Setup

### 🔹 Prerequisites

- Node.js (v18+ recommended)
- Rust (latest stable)
- Tauri CLI

---

### 🔹 Install

```bash
git clone https://github.com/your-username/lab-management-system.git
cd lab-management-system
npm install


🔹 Run (Development)
npm run tauri dev
🔹 Build Desktop App
npm run tauri build

👉 Output will be inside:

src-tauri/target/release/bundle/
💡 Key Highlights
⚡ Fast (Rust backend)
📴 Offline-first (SQLite)
🧩 Modular architecture
🖥 Desktop UX (not web UI)
💰 Scalable to SaaS later
🔐 Future Enhancements
🔑 Multi-user login system
📊 Analytics dashboard
🧾 Invoice PDF export
👨‍⚕ Doctor commission tracking
☁ Cloud sync (SaaS version)
🤝 Contributing

Pull requests are welcome.

Steps:

Create a branch
Make changes
Commit with clear message
Push & create PR
📌 Author

Parwaiz Afshaan

Full Stack Developer (React + Rust)
Focus: Real-world production systems
📄 License
GAP Group Product

⭐ If you like this project

Give it a ⭐ on GitHub — it helps a lot!