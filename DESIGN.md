# Meditory Design System Specification (DESIGN.md)

> Extracted from Stitch Reference Projects:  
> - **Meditory Clinical Dispensary & Rapid Desk** (`projects/14267053160395357447`)  
> - **Meditory Healthcare Workstation System** (`projects/13120210108923112325`)  
>  
> 📖 **Comprehensive Dimensions & Component Blueprint:** See [FRONTEND_UI_SPEC.md](file:///home/mayankjain/Documents/hackathons/meditory/FRONTEND_UI_SPEC.md) for full component sizing, pixel heights, typography scales, modal dialog layouts, and responsive breakpoints.  
> Target: Desktop / Laptop Clinical Workstation (1440px+ viewport)

---

## 1. Creative North Star & Brand Personality

Meditory is an internal, clinical inventory and emergency referral platform engineered for primary healthcare dispensaries (PHCs, CHCs, and Sub-Centres) across Bharat.

- **Dependable & Unflinching:** Utterly legible and predictable on low-cost monitors, tablets, and ruggedized desktop terminals.
- **Clinical & Orderly:** Conveys pharmaceutical-grade accuracy. Eliminates visual noise to prevent dispensing errors and stock miscounts.
- **Calm Institutional Authority:** Utilizes deep clinical teal (`#0F4C5C`) and surgical slates rather than generic corporate blues, preserving visual stamina over grueling 12-hour shifts.
- **No Self-Medication / Internal Staff Only:** Explicitly branded as a restricted, government-authorized clinical operations portal under the National Rural Health Mission (NRHM).

---

## 2. Color Palette & Functional Tokens

The palette is engineered for clinical precision, WCAG AAA contrast, and immediate visual triage of emergency supplies.

### 2.1 Primary & Action Roles
| Token Name | Hex Code | Purpose & Usage |
|---|---|---|
| `primary` | `#003441` | High-contrast deep teal for active states and primary headers |
| `primary-container` | `#0F4C5C` | Signature Clinical Deep Teal: buttons, branding, top card accent |
| `on-primary` | `#FFFFFF` | Text and icons placed on primary surfaces |
| `on-primary-container` | `#87BBCE` | Subtle tinted contrast on primary containers |
| `primary-fixed` | `#B6EBFE` | Light teal container tint |
| `primary-fixed-dim` | `#9ACEE1` | Muted teal interactive highlight |

### 2.2 Secondary Roles (Safe & Operational Inventory)
| Token Name | Hex Code | Purpose & Usage |
|---|---|---|
| `secondary` | `#006C49` | Emerald Mint: verified staff, active sync, safe stock |
| `secondary-container` | `#6CF8BB` | Bright mint chip background |
| `on-secondary` | `#FFFFFF` | Text on secondary buttons |
| `secondary-fixed` | `#6FFBBE` | Soft green badge background |
| `on-secondary-fixed-variant` | `#005236` | High-contrast dark green label |

### 2.3 Tertiary & Emergency Roles (Trauma & Stockout Alerts)
| Token Name | Hex Code | Purpose & Usage |
|---|---|---|
| `tertiary` | `#D9383A` / `#67000B` | Emergency Red: Anti-Snake Venom override, stockout alerts |
| `tertiary-container` | `#910013` | Deep crimson alert button hover |
| `on-tertiary` | `#FFFFFF` | Text on emergency action buttons |
| `on-tertiary-container` | `#FF9790` | Alert text emphasis |

### 2.4 Neutral Surfaces & Structural Elements
| Token Name | Hex Code | Purpose & Usage |
|---|---|---|
| `background` / `surface` | `#F8F9FF` | Foundational desktop canvas base |
| `surface-dim` | `#CCDBF4` | Muted canvas contrast |
| `surface-bright` | `#F8F9FF` | Crisp clinical field |
| `surface-container-lowest` | `#FFFFFF` | Card body, focused input backgrounds |
| `surface-container-low` | `#EFF4FF` | Default input background, unit info strip |
| `surface-container` | `#E6EEFF` | Card footer metadata bar |
| `surface-container-high` | `#DDE9FF` | Language selector pill container |
| `surface-container-highest` | `#D5E3FD` | High-emphasis contrast background |
| `on-surface` | `#0D1C2F` | Primary text (ultra high-contrast navy-slate) |
| `on-surface-variant` | `#40484B` | Subtitles, helper text, and secondary labels |
| `outline` | `#70787C` | Input field borders and standard icons |
| `outline-variant` | `#C0C8CB` | Subtle dividers and separation bullets |

---

## 3. Typography & Hierarchy

The design system exclusively mandates **Inter** (`sans-serif`) for its uniform geometric glyphs, legibility under glare, and OpenType tabular numeral support (`font-feature-settings: "tnum" 1`).

| Token | Font Family | Size / Line Height | Weight | Usage |
|---|---|---|---|---|
| `headline-lg` | Inter | 30px / 38px | 700 (Bold) | Top workstation banner |
| `headline-md` | Inter | 22px / 28px | 600 (SemiBold) | Section headers |
| `headline-sm` | Inter | 18px / 24px | 600 (SemiBold) | Login card title ("Dispensary Terminal Sign-in") |
| `body-lg` | Inter | 16px / 24px | 400 (Regular) | Prominent body descriptions |
| `body-md` | Inter | 14px / 20px | 400 (Regular) | Input values, form placeholders |
| `body-sm` | Inter | 12px / 16px | 400 (Regular) | Helper text, sub-labels, legal disclaimers |
| `label-lg` | Inter | 14px / 20px | 600 (SemiBold) | Primary submit button text ("Log In to Inventory") |
| `label-md` | Inter | 12px / 16px | 600 (SemiBold) | Header institution tags, badge texts |
| `label-sm` | Inter | 11px / 14px | 600 (SemiBold) | Field labels ("WORK EMAIL / STAFF ID"), telemetry |
| `data-mono` | Inter | 14px / 20px (tnum) | 500 (Medium) | IP addresses, temperature telemetry (`3.8°C`) |

---

## 4. Spacing, Grid & Desktop Workstation Layout

### 4.1 Grid & Viewport
- **Target Resolution:** Desktop / Laptop (1440px+ wide display).
- **Max Width Container:** 1280px (`max-w-7xl`) centered with `px-6` gutters.
- **Base Spatial Unit:** 4px (`0.25rem`). All paddings and margins scale by multiples of 4px.

### 4.2 Vertical Layout Distribution
1. **Top Header Strip (`h-16` / `py-4`):**
   - Left: Ministry of Health & Family Welfare emblem badge + Tier-3 Rural Node pill.
   - Right: Real-time Sync Server Operational status with pulse indicator (`animate-ping`) + Language switch pills (EN / हिन्दी / தமிழ் / తెలుగు).
2. **Central Login Canvas (`flex-1 py-8`):**
   - Centered card with maximum width of `490px`.
   - Balanced vertical whitespace ensuring the card floats effortlessly in the center of 1080p and 1440p displays.
3. **Bottom Telemetry & Helpdesk Footer (`h-16` / `py-4`):**
   - Left: Toll-free rural dispensary helpdesk (`1800-MED-HELP`) + Terminal ticket dispatcher.
   - Right: Cold-Chain Main ILR telemetry (`3.8°C Normal`) + National Health Stack v4.2 version.

---

## 5. Component Styling Specifications

### 5.1 Card Structure
- **Dimensions:** Width `100%`, max-width `490px`.
- **Surface:** `#FFFFFF` (`surface-container-lowest`).
- **Curvature:** `rounded-xl` (`12px` / `0.75rem`).
- **Shadow:** `shadow-xl` (diffused ambient depth).
- **Top Accent:** 6px (`h-1.5`) solid strip of `#0F4C5C` (`bg-primary-container`).
- **Internal Padding:** `p-8 sm:p-9` with `space-y-6`.
- **Card Footer Bar:** `#E6EEFF` (`bg-surface-container`), `px-6 py-2.5`, displaying active station telemetry and static IP attribution (`10.42.88.194 [STATIC-PHC]`).

### 5.2 Input Fields
- **Container:** Height `44px` (`h-11`).
- **Background:** `#EFF4FF` (`bg-surface-container-low`), transitioning to `#FFFFFF` on active focus.
- **Border:** `1px solid rgba(203, 213, 225, 0.6)`, focus ring: `ring-2 ring-[#0F4C5C]/20 border-[#0F4C5C]`.
- **Left Icon:** Absolute position left 12px (`left-3`), neutral slate `#70787C`, 19px size.
- **Right Status / Toggle:**
  - Email/ID field: Verified green checkmark `#006C49` (`lucide:CheckCircle2`).
  - Password field: Show/Hide toggle button with `#70787C` hover state (`lucide:Eye` / `lucide:EyeOff`).
- **Typography:** `font-body-md` (14px), text color `#0D1C2F`.

### 5.3 Buttons
- **Primary Submit ("Log In to Inventory"):**
  - Height: `44px` (`h-11`), width `100%`.
  - Background: `#0F4C5C` (`bg-primary-container`), hover: `#003441` (`bg-primary`).
  - Text: White `#FFFFFF`, `font-semibold` 14px (`label-lg`), flex centered with arrow icon.
  - Interactive state: Submitting shows animated spinner and transitions button color to `#006C49` upon successful token dispatch.
- **Emergency Override Button ("Open Emergency Dispense"):**
  - Height: `32px` (`h-8`), px `12px`.
  - Background: `#D9383A` (`bg-tertiary`), hover: `#910013` (`bg-tertiary-container`).
  - Text: White `#FFFFFF`, `font-bold` 11px (`label-sm`).
  - Icon: Medical cross / kit (`lucide:PlusCircle` / `lucide:BriefcaseMedical`).

### 5.4 Auxiliary Elements & Indicators
- **Terminal Unit Info Bar:**
  - Background: `#EFF4FF` (`bg-surface-container-low`), `px-3.5 py-2`, `rounded`.
  - Icon: Building/Hospital (`lucide:Building2`), Text: "PHC Sector 4 — Dispensary Terminal A".
  - Action: "Switch Unit" link in `#0F4C5C`.
- **Emergency Callout Box:**
  - Background: `#D9383A` at 10% opacity (`bg-tertiary/10`), rounded `8px`, border `1px solid #FECACA`.
  - Title: "CRITICAL STOCK EMERGENCY?" in bold crimson `#D9383A`.
  - Description: Direct bypass note for Anti-Snake Venom and ARV protocols.
- **Security Notice:**
  - Lock icon (`lucide:Lock`), "RESTRICTED INTERNAL HEALTH SYSTEM" in 10px uppercase.
  - Subtext: Mentions authorized staff only and NHM audit log compliance.

---

## 6. Background Visuals & Textures

- **Layer 1 (Bottom):** Medical dispensary photo softly blurred (`blur-[2px] opacity-25 scale-105`), local asset `public/clinic-bg.jpg`.
- **Layer 2 (Gradient):** Ambient clinical wash `bg-gradient-to-tr from-[#F8F9FF] via-[#F8F9FF]/90 to-[#E6EEFF]/80`.
- **Layer 3 (Pattern):** Radial dot grid texture `radial-gradient(#0F4C5C 1px, transparent 1px)` with `28px` spacing and `15%` opacity.
