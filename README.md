# Clerkk — Premium Inventory Management + Barcode POS

A cross-platform desktop application for inventory management and point-of-sale with continuous barcode scanning, built with Electron + React + TypeScript + SQLite.

![Clerkk](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Tech](https://img.shields.io/badge/Stack-Electron%2BReact%2BTypeScript%2BSQLite-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 🏪 Core POS
- **Continuous Barcode Scanning** — Camera stays active in background; scans automatically add products to cart
- **Smart Camera Selection** — Prefers built-in camera (FaceTime) over iPhone Continuity cameras
- **New Sale Flow** — Product grid + live cart with quantity steppers, customer lookup by phone, instant invoice generation
- **Walk-in & Returning Customers** — Phone lookup auto-fills existing customers; new customers created on-the-fly
- **Multi-payment Support** — Cash, Card, UPI, Other
- **Real-time Stock Deduction** — Prevents overselling with insufficient stock warnings

### 📦 Inventory Management
- **Products CRUD** — Name, SKU/barcode, price, cost, stock, low-stock threshold, category, image, description
- **Auto-generate Barcodes** — EAN-13 compliant barcode generation
- **Stock Adjustments** — Quick +/- adjustments with audit trail
- **Bulk Import/Export** — CSV with full validation
- **Low Stock Alerts** — Dashboard badges + dedicated filter

### 👥 Customer Management
- **Customer Profiles** — Name, phone (unique), place/city
- **Order History** — Full purchase history per customer
- **Spending Analytics** — Total spent, order count, last purchase date
- **Quick Lookup** — Phone-based search in sale flow

### 📊 Dashboard & Analytics
- **Revenue Charts** — 7/30 day interactive area chart (Recharts)
- **Top Products** — Horizontal bar chart by quantity sold
- **Category Breakdown** — Donut chart by revenue
- **Key Metrics** — Total revenue, today's revenue, sales count, product count, low stock alerts, customer count
- **Recent Activity** — Live audit log feed

### 🧾 Professional Invoicing
- **PDF Generation** — pdfmake with company branding, itemized tables, tax calculation
- **Native Print Dialog** — Electron native print with background graphics
- **Save as PDF** — Native save dialog
- **Invoice Preview** — In-app PDF viewer (iframe)
- **Sales Reports** — Full period reports with summary cards + detailed item table

### ⚙️ Settings
- **Business Profile** — Name, owner, contact, address, logo upload
- **Billing** — Currency (14 options), tax rate %, receipt footer
- **Preferences** — Dark/Light theme, camera device selection, scanner sensitivity
- **Data Management** — Backup/restore SQLite DB, clear all data (with confirmation), load demo data

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `F1` | Focus New Sale |
| `F2` | Add Product |
| `Ctrl/⌘ + P` | Print Last Invoice |
| `Esc` | Close Dialogs |
| `Enter` (in customer phone) | Lookup Customer |

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Shell | Electron 33 |
| UI | React 18 + TypeScript + Vite (via electron-vite) |
| Styling | Tailwind CSS 3.4 (dark/light theme via CSS variables) |
| Database | SQLite (better-sqlite3) with WAL mode, FKs, migrations |
| Barcode | html5-qrcode (camera-based, no native deps) |
| Charts | Recharts 2 |
| PDF | pdfmake (server-side in main process) |
| State | Zustand 4 |
| Packaging | electron-builder 25 |

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- npm 10+ / pnpm 9+
- macOS 10.15+, Windows 10+, or Linux (GTK 3)

### Development
```bash
# Clone and install
git clone <repo> clerkk
cd clerkk
npm install

# Start dev server (hot reload)
npm run dev
```

### Production Build
```bash
# Build all platforms
npm run dist

# Platform-specific
npm run build:mac     # macOS (DMG)
npm run build:win     # Windows (NSIS)
npm run build:linux   # Linux (AppImage)
```

The installer will be in `dist/`.

### First Launch
1. Grant **Camera permission** when prompted (required for barcode scanning)
2. The app opens to **Dashboard** with demo data preloaded
3. Go to **Settings → Business Profile** to customize your business info
4. Start scanning barcodes in **New Sale**!

## 📁 Data Location

All data is stored locally in an SQLite database:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/clerkk/clerkk.db` |
| Windows | `%APPDATA%/clerkk/clerkk.db` |
| Linux | `~/.config/clerkk/clerkk.db` |

Includes WAL mode (`-shm`, `-wal` files) for performance.

### Backup & Restore
Use **Settings → Data & Backup**:
- **Backup** — Saves a consistent `.db` snapshot via SQLite backup API
- **Restore** — Replaces current DB; app reloads automatically
- **Clear All Data** — Wipes everything (type `DELETE` to confirm)

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Context | Action |
|----------|---------|--------|
| `F1` | Global | Open/focus New Sale |
| `F2` | Global | Open Add Product modal |
| `Ctrl/⌘ + P` | Global | Print last invoice |
| `Esc` | Modals | Close any open modal/dialog |
| `Enter` | Customer phone field | Trigger customer lookup |

## 📦 Default Demo Data

On first launch, the app seeds:
- **6 Categories**: Groceries, Beverages, Dairy, Snacks, Household, Electronics
- **15 Products** with realistic Indian retail pricing (₹)
- **4 Customers** with phones
- **4 Sales** with varied items & payment methods

Clear via **Settings → Danger Zone → Clear All Data** (type `DELETE`).

## 🔧 Configuration

### Environment Variables
None required for production. Development:
- `ELECTRON_RENDERER_URL` — Auto-set by electron-vite for HMR

### Camera Permissions
- **macOS**: System Settings → Privacy & Security → Camera → enable for Clerkk
- **Windows**: Settings → Privacy → Camera → allow desktop apps
- **Linux**: Usually automatic; check browser permissions if using Wayland

If camera fails, click **Retry** in the scanner status badge (top bar) or change device in **Settings → Preferences → Camera Device**.

## 🐛 Known Limitations

1. **Camera on Linux/Wayland** — May require `ELECTRON_OZONE_PLATFORM_HINT=auto` or explicit X11
2. **Barcode Formats** — html5-qrcode supports QR, EAN-13, UPC-A, Code-128, Code-39, ITF, DataMatrix. 1D barcodes need good lighting.
3. **Offline-only** — No cloud sync, no multi-device support (single-user local POS)
4. **Single Currency** — One currency per database; changing currency doesn't convert historical amounts
5. **No Tax Groups** — Single tax rate applied to entire sale
6. **Image Storage** — Product images stored as base64 data URLs in DB (keeps DB portable; ~500KB/image max after compression)
7. **No User Accounts** — Single admin profile; no role-based access
8. **macOS Code Signing** — Unsigned DMG; users must right-click → Open on first launch
8. **Windows Defender** — Unsigned NSIS installer may trigger SmartScreen

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ for small businesses who deserve premium POS without the cloud lock-in.