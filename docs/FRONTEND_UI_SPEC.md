# Meditory Frontend UI Specification & Visual Hierarchy Blueprint

> **System:** Meditory Clinical Dispensary & Emergency Network  
> **Target Viewport:** Desktop / Laptop Clinical Workstations (1440px viewport, responsive down to 1024px & 768px tablet)  
> **Design Movement:** Clinical Precision & Visual Clarity  
> **Stitch MCP Reference:** Project ID `14267053160395357447` (*Meditory - Clinical Dispensary & Rapid Desk*)  
> **Last Updated:** September 2026

---

## 1. Visual Hierarchy & Density Principles

To prevent cognitive fatigue and dispensing errors during high-pressure hospital shifts, Meditory adheres to strict **Visual Clarity & Information Hierarchy** standards:

1. **Prioritized Primary vs Demoted Secondary Information:**
   - **Primary Data:** Medicine Name, Available Physical Stock Count, and Stock Status Badge dominate visual weight.
   - **Secondary Metadata:** Batch / Lot number, Expiry Date, Storage Location, and Safety Buffer are collapsed into a **single muted caption line** (`text-[11px] text-slate-400 font-normal`) rather than heavy multi-row bordered boxes.
2. **One Status Badge Per Card / Row:**
   - Avoid competing colored pills. Only ONE clear status indicator is permitted per card (`In Stock`, `Low Stock`, or `Out of Stock`). Category tags are integrated cleanly into subtitles.
3. **Progressive Disclosure:**
   - Forensic and deep operational details (such as raw SHA-256 cryptographic hashes, facility transaction keys, transit routes, and full batch records) are tucked behind clean row expansions or drawer clicks rather than overwhelming the default view.
4. **Focused Action Hierarchy:**
   - Each card or row provides ONE dominant primary action (e.g. `Dispense...` or `Find in Nearby Clinics (Referral) →`), with secondary flows (such as `+ Inward Restock` or `Check Network`) demoted to clean text links.
5. **Breathing Room & Tabular Alignment:**
   - Stock quantities utilize prominent typography (`text-3xl` on emergency cards, `text-base` in tables) with tabular numerals (`font-mono`) and dedicated vertical whitespace.

---

## 2. Global Design System Foundations

### 2.1 Color Palette & Functional Tokens

| Token Role | Hex Code | Tailwind Equivalent | Purpose & Usage |
|---|---|---|---|
| **Canvas Background** | `#F8FAFC` | `bg-slate-50` | Low-glare foundational surface for 12-hour hospital shifts |
| **Card / Surface** | `#FFFFFF` | `bg-white` | Elevated clinical container, table backgrounds, inputs |
| **Primary Action** | `#0D9488` | `bg-teal-600` / `hover:bg-teal-700` | Primary clinical workflows: confirm dispense, restock, search |
| **Primary Container** | `#0F766E` | `bg-teal-700` | Active sidebar item, focused tabs, header pills |
| **Success / Safe Stock** | `#059669` | `text-emerald-700` / `bg-emerald-50` | In-stock status, verified stock increments, safe buffers |
| **Low Stock Warning** | `#D97706` | `text-amber-800` / `bg-amber-50` | Low buffer alerts (< threshold), restock reminders |
| **Emergency / Shortage** | `#E11D48` | `text-rose-800` / `bg-rose-50` | Out of stock, critical stockout alerts, referral bypass |
| **Dark Neutral (Heading)** | `#0F172A` | `text-slate-900` | Primary titles, drug names, tabular quantity counts |
| **Mid Neutral (Body)** | `#334155` | `text-slate-700` | Generic drug salts, form labels, table body text |
| **Muted Neutral (Metadata)** | `#64748B` | `text-slate-500` | Unit indicators, timestamps, helper text |
| **Subtle Caption (Demoted)** | `#94A3B8` | `text-slate-400` | Batch numbers, expiry dates, secondary sync indicators |
| **Borders & Dividers** | `#E2E8F0` | `border-slate-200` | Structural clean card boundaries, table dividers |
| **Active Input Borders** | `#CBD5E1` | `border-slate-300` | Form field outline, secondary button borders |

---

### 2.2 Typography Hierarchy

```
Font Family:
  Primary Sans:     'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
  Display Headings: 'Plus Jakarta Sans', 'Inter', sans-serif
  Tabular Numerics: font-feature-settings: "tnum" 1 (font-mono)
```

| Hierarchy Level | Font Size | Line Height | Weight | Letter Spacing | Target Elements |
|---|---|---|---|---|---|
| **Display Title** | `20px` (`1.25rem`) | `28px` (`1.75rem`) | `700` (Bold) | `-0.02em` | Page main titles, login headings |
| **Section Header** | `16px` (`1rem`) | `24px` (`1.5rem`) | `700` (Bold) | `-0.015em` | Emergency section title, ledger header |
| **Card Stock Count** | `30px` (`1.875rem`) | `36px` (`2.25rem`) | `700` (Bold) | `-0.02em` (Mono) | Emergency card primary count (`0`, `13`, `8`) |
| **Table Stock Count** | `16px` (`1rem`) | `24px` (`1.5rem`) | `700` (Bold) | `-0.01em` (Mono) | Ledger table physical stock (`490`, `120`) |
| **Medicine Title** | `14px` (`0.875rem`) | `20px` (`1.25rem`) | `700` (Bold) | `-0.01em` | Medicine names (Anti-Snake Venom, Paracetamol) |
| **Formulation Subtitle**| `12px` (`0.75rem`) | `16px` (`1rem`) | `500` (Medium) | Normal | Generic drug salts, form description |
| **Demoted Caption** | `11px` (`0.6875rem`) | `16px` (`1rem`) | `400` (Regular)| Normal | Single-line metadata (Batch, Exp, Cold Chain, Buffer) |
| **Status Badge Text** | `10px` (`0.625rem`) | `14px` (`0.875rem`) | `700` (Bold) | `+0.04em` | Status pills (`In Stock`, `Low Stock`, `Out of Stock`) |

---

## 3. Global Shell (`WorkstationShell`)

- **Fixed Sidebar:** Width `256px` (`w-64`), full height `100vh`, white background, `border-r border-slate-200`.
  - Brand header: Emblem `36px × 36px` (`w-9 h-9 rounded-xl bg-teal-600`), title `text-base font-bold text-slate-900`.
  - Facility tenancy card: `p-3 rounded-xl bg-slate-50 border border-slate-200/70`, facility name `text-xs font-bold`, active online pulse dot (`w-2 h-2 rounded-full bg-emerald-500 animate-pulse`).
  - Nav menu items: `px-3.5 py-2.5 rounded-lg text-xs font-semibold`. Active: `bg-teal-700 text-white shadow-xs`. Inactive: `text-slate-600 hover:bg-slate-100`.
  - Footer: Security badge + Sign Out button (`h-9 rounded-lg border border-slate-200 text-xs font-semibold`).
- **Sticky Top Bar:** Height `64px` (`h-16`), `bg-white/95 backdrop-blur-md px-6 border-b border-slate-200/80`.
  - Global Search: `max-w-lg h-9 pl-9 pr-4 rounded-lg bg-slate-50 border border-slate-200 text-xs`.
  - Quick Emergency Injections button: `h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs`.
  - Referral quick link: `h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200`.

---

## 4. Screen: Clinic Rapid Desk (`/rapid-desk`)

### 4.1 Executive Shortage Alert Banner
- Conditional warning banner when critical life-saving items fall below threshold.
- Container: `bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-xs mb-6`.
- Direct action: `+ Restock Now` (Teal) and `Locate Nearby Clinics` (White).

### 4.2 Executive KPI Summary Bar
- 4 clean metric cards (`grid-cols-2 lg:grid-cols-4 gap-4 mb-6`):
  1. Total Formulary Active Items
  2. Adequate Stock (Emerald count)
  3. Low Buffer Attention (Amber count, 1-click triage link to `/rapid-desk/emergency`)
  4. Stockouts (Rose count, 1-click triage link to `/rapid-desk/emergency`)

### 4.3 Dispensary Formulary Ledger (Single Source of Truth Table)
- Default view is clean and fast: Shortage alert banner (if applicable) + 4 KPI stats + Dispensary Shelf Stock Ledger table. The redundant emergency card grid is completely removed from the default view to eliminate duplicate rows and prevent visual competition with the shelf stock ledger.
- Toolbar integrates `+ Inward Stock Delivery` button alongside category filter pills (`All`, `Emergency`, `Essential`, `Low / Critical`). The table serves as the authoritative single source of truth for all medications.
- Streamlined 5-Column Essential View:
  1. **Medicine (35% width):** Name in bold `text-sm text-slate-900`, Generic salt & form in `text-xs text-slate-500`, with expand chevron icon (`ChevronRight` / `ChevronDown`).
  2. **Category (20% width):** Clean text `text-xs text-slate-600 font-medium` (no bulky badge borders).
  3. **Shelf Stock (18% width):** High-contrast tabular stock number in `text-base font-bold font-mono text-slate-900` + unit.
  4. **Status (12% width):** Single clean status pill (`In Stock` / `Low Stock` / `Out of Stock`).
  5. **Actions (15% width, right):** Compact button group: `-1` (Teal pill) + `Dispense` (Teal button).
- **Progressive Disclosure Drawer:**
  - Clicking any row smoothly expands an inline sub-drawer revealing secondary metadata:
    `Batch: LOT-2026-01` · `Expiry: 2027-12` · `Safety Buffer: 50 Tablet` · `Storage: Shelf Rack 3` · `+ Inward Restock` · `Locate nearby stock →`.

---

## 5. Screen: Emergency Response & Triage View (`/rapid-desk/emergency`)

### 5.1 Purpose & Entry Points
- Dedicated clinical triage view for life-critical Tier-1 medications (Anti-Snake Venom, Rabies Vaccine, Adrenaline/Epinephrine).
- Accessible via:
  - Sticky top navbar `Emergency Injections` button (`bg-rose-600 hover:bg-rose-700 text-white`).
  - Rapid Desk KPI cards (`Low Buffer Attention` and `Stockouts`).
- Header includes breadcrumb navigation: `← Back to Dispensary Shelf Ledger`.

### 5.2 Conditional Triage Card Rendering Rules
- **Rule:** ONLY items with `LOW_STOCK` or `OUT_OF_STOCK` status receive high-emphasis priority triage cards.
- An emergency drug that is fully in stock (e.g. Adrenaline: 24/5 vials) does NOT receive a red-border urgency card, avoiding signal dilution.
- **Urgent Triage Cards Structure (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`):**
  - **Out of Stock:** High-visibility border (`border-rose-300 ring-1 ring-rose-300/50 bg-rose-50/10`), `0% of buffer` progress bar, dominant primary button `Find in Nearby Clinics (Referral) →` (`bg-rose-600`), and secondary link `+ Inward delivery restock`.
  - **Low Stock:** Warning border (`border-amber-300 ring-1 ring-amber-300/50 bg-amber-50/10`), progress bar indicating percentage vs safety buffer, primary `Dispense...` + `-1 Quick` button, and secondary links `+ Restock delivery` and `Check network`.
  - **Demoted Single-Line Caption:** `text-[11px] text-slate-400 mt-2.5 font-mono` (`Batch LOT-2026-01 · Exp 2027-12 · Cold-Chain ILR · Buffer: 5 Injection`).

### 5.3 Compact Reassurance State (Nominal Stock)
- When `urgentEmergencyItems.length === 0`:
  - Renders a clean reassurance card: `bg-white rounded-xl border border-emerald-200 p-6 shadow-xs`.
  - Displays emerald checkmark icon with text: `✓ All emergency stock nominal — no action required`.
  - Provides a direct link button: `View Full Dispensary Ledger →`.

### 5.4 Nominal Reserves Section
- Adequate emergency supplies (`status === 'IN_STOCK'`) are rendered below urgent cards in a calm, non-alarming secondary ledger table with neutral emerald pills and standard actions (`-1`, `Dispense`), ensuring full visibility without triggering false alarm fatigue.

---

## 6. Screen: Immutable Clinic Audit Trail (`/audit`)

### 6.1 KPI Stat Cards (Single-Line Subtext)
- 4 summary cards with noise reduction (each subtext reduced from 2 lines to 1 single clear line):
  1. **Total Transactions:** `184 Records` — Subtext: `+12% vs prior shift`
  2. **Dispensed Doses:** `342 Units` — Subtext: `312 routine · 30 emergency`
  3. **Inward Restock:** `+1,250 Units` — Subtext: `4 verified dispatches recorded`
  4. **Ledger Integrity:** `100% Validated` — Subtext: `Tamper-evident DynamoDB commits`

### 6.2 Streamlined Audit Table (Hidden-by-Default Forensic SHA Hash)
- Eliminates the cluttered SHA-256 hash string column from the default table view.
- **Default Columns:**
  1. `Timestamp` (Time & expand chevron)
  2. `Action` (Dispense or Restock badge)
  3. `Medicine` (Drug name + Batch lot)
  4. `Delta` (+50 or -15 in bold tabular color)
  5. `Stock Shift` (Before → After)
  6. `Authorized Staff` (Worker name & ID)
- **Forensic Drawer (Progressive Disclosure):**
  - Clicking any log row expands an inline detail drawer showing: Full Transaction ID, Facility Node ID, and full Cryptographic SHA-256 Digest (`text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded text-[10px]`).

---

## 7. Screen: Inter-Clinic Referral Locator (`/locator`)

### 7.1 Streamlined Clinic Referral Cards
- Eliminates duplicate icon rows under each clinic card.
- **Header:** Clinic Name (`text-base font-bold text-slate-900`), distance chip (`18.4 km` in `text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-full`), and doctor in charge.
- **Stock Counter:** Prominent clean stock banner (`Verified Stock: 25 Vials` in `text-2xl font-bold font-mono text-emerald-700`).
- **Single Muted Caption Line:** `text-[11px] text-slate-400 mt-2` (`~28 mins via NH-66 · Verified LoRa Sync · Cold-Chain Normal (3.8°C)`).
- **Actions:**
  - Primary button: `Issue Emergency Referral` (`h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs`).
  - Secondary button: `Call Facility ({phone})` (`h-8 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200`).

---

## 7. Interactive Modals

### 7.1 Custom Dispense Modal (`max-w-md w-full rounded-xl shadow-xl`)
- Header: Dark header with `lucide:Pill` icon.
- Medicine preview card: Name, generic, available physical stock.
- Dispense quantity input: `h-10 text-base font-mono font-bold`.
- Quick preset chips: `1`, `2`, `5`, `10`, `15`, `30`, `All`.
- Dynamic balance preview: Real-time calculation (`490 - 15 = 475 Tablet remaining`).
- Optional OPD / Prescription reference field: `h-9 text-xs font-mono`.
- Action buttons: `Cancel` and `Confirm Dispense (X units)`.

### 7.2 Custom Restock Modal (`max-w-lg w-full rounded-xl shadow-xl`)
- Header: Dark header with `lucide:PackagePlus` icon.
- Medicine dropdown selector with current physical stock.
- Restock quantity input with presets: `+10`, `+25`, `+50`, `+100`, `+250`, `+500`.
- Dynamic balance preview: Real-time addition (`0 + 50 = 50 Injections`).
- 2-Column form grid: Batch / Lot #, Expiry Date (month/year), Storage Shelf / ILR, Depot Challan #.
- Action buttons: `Cancel` and `Confirm Restock (+X units)`.

---

## 8. Summary Checklist for Future Screen Additions

1. **Hierarchy Check:** Is the most important number or status instantly recognizable within 2 seconds?
2. **Metadata Demotion:** Are batch numbers, expiry dates, and hardware cold-chain IDs formatted as a single muted caption line (`text-[11px] text-slate-400`) rather than heavy multi-row boxes?
3. **Badge Budget:** Is there only ONE status badge per card? (Avoid stacking 3-4 colored pills).
4. **Forensic Hiding:** Are cryptographic hash digests and raw GUIDs hidden behind click-to-expand drawers?
5. **Progressive Disclosure:** Does dense tabular data use progressive disclosure for secondary attributes?
