# Meditory

**Last-Mile Healthcare Inventory & Emergency Referral Network for Bharat**  
*Built for the WeMakeDevs × AWS Hackathon ("Ship It" Track)*

Meditory is a serverless, mobile-first internal inventory management and emergency inter-clinic referral platform built for primary healthcare clinics (Sub-Centres, Primary Health Centres [PHCs], and Community Health Centres [CHCs]) across rural and semi-urban India.

---

## 🧭 The Problem & Solution

* **The Reality in Rural Clinics:** Primary healthcare workers often face erratic supply chains. Critical life-saving medicines like Anti-Snake Venom (ASV) or Anti-Rabies Vaccine (ARV) can suddenly run out, while a Community Health Centre only 15 km away has surplus vials.
* **Meditory's Solution:** A lightweight, staff-only digital desk enabling:
  1. **1-Tap Quick Dispensing:** Rapid single-tap (-1) deduction for emergency injectables during acute clinical emergencies, plus custom batch dispensing for tablets/strips.
  2. **Inter-Clinic Emergency Referral Network:** When a critical drug reaches zero stock locally, staff can instantly discover neighboring clinics with verified stock, calculated travel distance, and direct phone contact to arrange urgent patient transfers.
  3. **Strict Clinic Isolation:** Facility workers can only view and mutate their own clinic's stock, preventing cross-clinic data tampering.
  4. **Immutable Audit Trail:** Chronological record of every dispense and restock action for district transparency.

---

## 🏛️ Monorepo Architecture

The repository is organized following modular monorepo best practices using `pnpm` workspaces:

```text
meditory/
├── apps/
│   ├── web/                     # Frontend Application (Next.js 14 App Router)
│   │   ├── src/app/             # Pages, Layouts, and UI Components
│   │   ├── next.config.mjs      # Next.js configuration (transpiles @meditory/shared)
│   │   ├── tailwind.config.ts   # Styling & responsive design
│   │   └── package.json         # Name: "web" (Port 3000)
│   │
│   └── api/                     # AWS Serverless Backend & CDK Infrastructure
│       ├── bin/infra.ts         # AWS CDK App entry point
│       ├── lib/                 # AWS CDK Stack (DynamoDB, API Gateway, Lambdas, CloudWatch)
│       ├── src/
│       │   ├── authorizer/      # JWT validation & clinic-isolation middleware
│       │   ├── handlers/        # Lambda handlers (auth, inventory, dispense, restock, locator, audit)
│       │   ├── seeds/           # Multi-table seed dataset (Raigad district clinics)
│       │   ├── shared/          # DynamoDB client, JWT auth-utils, standardized HTTP responses
│       │   ├── inspect-db.ts    # CLI table inspector for local DynamoDB
│       │   ├── local-server.ts  # Express-compatible HTTP test server for local dev (Port 3001)
│       │   └── test-handlers.ts # 28-test automated end-to-end test suite
│       ├── cdk.json             # CDK execution configuration
│       └── package.json         # Name: "api"
│
├── packages/
│   └── shared/                  # Shared Domain Types, Contracts & Constants
│       ├── src/
│       │   ├── constants.ts     # Table names, index names, IPHS priority tiers, status enums
│       │   ├── types.ts         # TypeScript models (Facility, FacilityWorker, InventoryItem, AuditLog)
│       │   ├── dtos.ts          # Strongly-typed API Request & Response interfaces
│       │   └── index.ts         # Barrel export
│       └── package.json         # Name: "@meditory/shared"
│
├── docker-compose.yml           # Local DynamoDB (Port 8000) + DynamoDB Admin GUI (Port 8001)
├── package.json                 # Root workspace orchestrator
├── pnpm-workspace.yaml          # Workspaces: ["apps/*", "packages/*"]
└── docs/
    └── Meditory_PRD.md          # Approved Product Requirements Document v2.0
```

---

## 🗄️ Database Architecture (Amazon DynamoDB Multi-Table)

Meditory utilizes **4 clean, domain-separated DynamoDB tables** to avoid attribute pollution and maintain strict isolation:

| Table Name | Partition Key (PK) | Sort Key (SK) | Global Secondary Index (GSI) | Purpose |
|---|---|---|---|---|
| **`Meditory_Facilities`** | `id` (e.g. `PHC-ALIBAG-01`) | — | — | Clinic metadata, geolocation (lat/long), and emergency contact phone. |
| **`Meditory_Workers`** | `email` (e.g. `rahul.sharma@phc-alibag.in`) | — | — | Staff credentials, bcrypt-hashed password, assigned `facilityId`, and role. |
| **`Meditory_Inventory`** | `facilityId` (e.g. `PHC-ALIBAG-01`) | `drugId` (e.g. `DRUG-ASV-01`) | `DrugLookupIndex`<br>(`drugId` [PK] + `status` [SK]) | Clinic shelf inventory with atomic condition expressions (`quantity >= :qty`). GSI enables cross-clinic stock lookup. |
| **`Meditory_AuditLogs`** | `facilityId` (e.g. `PHC-ALIBAG-01`) | `timestamp` (ISO string) | — | Append-only audit trail capturing every dispense/restock event and staff identity. |

---

## ⚡ Tech Stack & MERN Developer Translation

| MERN Stack Concept | Meditory / AWS Serverless Equivalent | Why AWS Serverless for Rural Clinics? |
|---|---|---|
| **MongoDB / Mongoose** | **Amazon DynamoDB** (`@aws-sdk/lib-dynamodb`) | Single-digit millisecond latency at any scale. Fully managed, zero database server patching, pay only for reads/writes used. |
| **Express.js Server (`app.listen(5000)`)** | **AWS Lambda + Amazon API Gateway** | **Scale-to-Zero:** Rural clinics sleep at night. Traditional servers run 24/7 incurring cost; Lambdas only wake up when a doctor taps "Dispense" and cost \$0 when idle. |
| **Express Middleware (`auth.js`)** | **Lambda Authorizer & Scope Guard** (`enforceClinicScope`) | Verifies `jsonwebtoken` signature and enforces strict clinic tenancy. Cross-clinic mutations return 403 Forbidden. |
| **React + Vite / CRA** | **Next.js 14 App Router + Tailwind CSS** | Server Components for instant load on rural 3G/4G connections, combined with responsive client interactions. |
| **`console.log` / Morgan Logger** | **Amazon CloudWatch EMF (Embedded Metric Format)** | Logs structured JSON metrics directly into CloudWatch to power real-time low-stock alarms without extra metric servers. |
| **Manual Server Setup (EC2 / VPS)** | **AWS CDK (Cloud Development Kit in TypeScript)** | Entire cloud infrastructure (databases, APIs, lambdas, permissions) is defined in 100% typed code. |

---

## 🌐 Local Architecture & Port Map

Meditory runs as a modular, lightweight multi-service architecture locally:

| Service | Port | Local URL | Description |
|---|---|---|---|
| **Dispensary Web App** (`apps/web`) | `3000` | [`http://localhost:3000`](http://localhost:3000) | Next.js 14 App Router dispensary workstation, rapid desk, offline engine, and locator. |
| **Serverless API Gateway Mock** (`apps/api`) | `3001` | [`http://localhost:3001`](http://localhost:3001) | Express/Lambda local emulator executing exact AWS Lambda handler business logic. |
| **District Admin Portal** (`apps/admin`) | `3005` | [`http://localhost:3005`](http://localhost:3005) | Dedicated District Health Authority Gateway for clinic approvals and health grid governance. |
| **Amazon DynamoDB Local** (Docker) | `8000` | `http://localhost:8000` | Local persistent DynamoDB container matching AWS production schemas. |
| **DynamoDB Admin GUI** (Docker) | `8001` | [`http://localhost:8001`](http://localhost:8001) | Visual browser GUI to inspect tables, items, GSIs, and attributes in real-time. |

---

## 🚀 Step-by-Step Local Development Setup

### 1. Prerequisites
Ensure you have the following installed on your system:
* **Node.js**: `v20.x` or higher (`node -v`)
* **pnpm**: `v9.x` or higher (`npm install -g pnpm`)
* **Docker & Docker Compose**: Running and accessible (`docker compose version`)

---

### 2. Clone & Install Dependencies
Clone the repository and install all workspace dependencies across packages and apps:
```bash
git clone https://github.com/mayankjain92/meditory.git
cd meditory

# Install all monorepo dependencies
pnpm install
```

---

### 3. Start Local DynamoDB & Visual Admin GUI
Launch the local DynamoDB container and the visual web inspector:
```bash
# Start DynamoDB Local (8000) and DynamoDB Admin Web UI (8001) in background
pnpm ddb:local
# (or: docker compose up -d)
```
> [!TIP]
> You can open **`http://localhost:8001`** in your browser at any time to visually inspect your DynamoDB tables, partitions, and records.

---

### 4. Seed the Database with Realistic Clinic Data
Populate the database with pre-configured Raigad district clinics, doctor credentials, and shelf formularies:
```bash
pnpm seed
```
This seeds:
* **3 Health Facilities**: Alibag PHC (primary node), Vadkhal PHC (low stock), and Pen CHC (surplus hub).
* **3 Verified Clinic Workers**: Medical officers with hashed credentials.
* **18 Formulary Shelf Items**: Including Anti-Snake Venom (ASV), Anti-Rabies Vaccines (ARV), ORS, Paracetamol, and Amoxicillin.
* **District Admin Account**: Initialized for District Health Authority governance.

---

### 5. Run the Automated Test Suite (103 Tests)
Run the full end-to-end integration and business logic verification suite:
```bash
pnpm test
```
Executes all **103 automated tests** across 9 test groups:
1. Clinic Worker Authentication & Session Verification
2. Shelf Inventory Retrieval & Multi-Table Tenancy
3. Atomic 1-Tap Dispensing & CloudWatch Metrics
4. Tamper-Evident Audit Logging & Restocking
5. Inter-Clinic Referral Stock Locator (Haversine distance sorting)
6. Two-Way Handshake Inter-Clinic Requisitions (6-digit PIN verification)
7. Offline-First Sync Engine & Idempotent Batch Sync
8. Emergency Doctor & Clinic Phone Directory
9. Clinic Self-Registration & District Admin 1-Tap Approval Flow

---

### 6. Start the Development Servers

You can start all services concurrently with a single command:
```bash
pnpm dev
```
*(Runs `api` on :3001, `web` on :3000, and `admin` on :3005 concurrently).*

#### Alternatively, run services in separate terminals:
```bash
# Terminal 1: Start API Gateway & Lambda Handler Service (:3001)
pnpm dev:api

# Terminal 2: Start Next.js Primary Clinic Workstation (:3000)
pnpm dev:web

# Terminal 3: Start District Health Authority Admin Portal (:3005)
pnpm dev:admin
```

---

## 👥 Pre-Seeded Accounts & Roles

### 1. Primary Clinic Workers (Sign-in at [`http://localhost:3000/login`](http://localhost:3000/login))

| Clinic / Health Facility | Facility Type | Staff Email | Password | Role | Demo Test Scenario |
|---|---|---|---|---|---|
| **Alibag PHC** | Primary Health Centre | `rahul.sharma@phc-alibag.in` | `Password@123` | `facility_worker` | **Zero ASV Stock**: 1-tap dispense, stockout alarm, and emergency referral trigger to Pen CHC. |
| **Vadkhal PHC** | Primary Health Centre | `priya.deshmukh@phc-vadkhal.in` | `Password@123` | `facility_worker` | **Low Stock**: 2 vials remaining; demonstrates safety threshold indicators. |
| **Pen CHC** | Community Health Centre | `amit.patil@chc-pen.in` | `Password@123` | `facility_worker` | **Surplus ASV Hub**: 25 vials in stock; receives inter-clinic transfer requisitions. |

### 2. District Health Authority (Sign-in at [`http://localhost:3005`](http://localhost:3005))

| Role | Portal URL | Official Email | Password | Permissions |
|---|---|---|---|---|
| **District Health Admin** | `http://localhost:3005` | `admin@meditory.gov.in` | `Password@123` | Review pending clinic registrations, 1-tap approvals, auto-seed formularies, state audit oversight. |

---

## 🧪 Testing Key Scenarios Locally

### Scenario 1: 1-Tap Emergency Dispense & Offline Mode
1. Navigate to `http://localhost:3000/login` and log in as `rahul.sharma@phc-alibag.in` / `Password@123`.
2. You will land on the **Rapid Desk**.
3. Locate **Paracetamol 500mg** or **Anti-Rabies Vaccine** and click **"-1 Quick Dispense"**.
4. Notice the real-time stock decrement, badge update, and instantaneous audit trail entry under `/audit`.
5. Toggle your browser DevTools to **Offline** (Network tab) and perform dispensations. Observe the offline banner and queue counter. Toggle back to **Online** to see automatic, idempotent batch synchronization.

### Scenario 2: Emergency Inter-Clinic Stock Referral & WhatsApp Dispatch
1. On Alibag PHC's Rapid Desk, notice **Anti-Snake Venom (ASV)** is at **0 vials (CRITICAL STOCKOUT)**.
2. Click **"Locate Nearest Stock"** or navigate to the **Stock Locator** (`/locator?drug=DRUG-ASV-01`).
3. The locator queries the district via DynamoDB Global Secondary Index and ranks clinics by real-time distance:
   * **Pen Community Health Centre** (25 vials available, 14.8 km distance, cold-chain verified at 3.8°C).
4. Click **"Direct Call MOIC"** to view doctor contact details, or click **"WhatsApp Referral"** to preview a pre-formatted emergency dispatch text containing clinic coordinates and patient instructions.

### Scenario 3: Two-Way Handshake Inter-Clinic Transfer
1. From the Stock Locator, click **"Request Stock Transfer"** to request 2 vials of ASV from Pen CHC.
2. Log out and sign into Pen CHC (`amit.patil@chc-pen.in` / `Password@123`).
3. Open the **Transfer Requisitions Desk** from the sidebar. You will see Alibag's incoming transfer request.
4. Click **"Approve Transfer"**. A **6-digit secure Handshake PIN** is generated.
5. Click **"Dispense with PIN"** to release the stock into transit, automatically decrementing Pen CHC's inventory atomically.

### Scenario 4: Self-Registration & District Admin 1-Tap Approval
1. Visit `http://localhost:3000/register` and submit a new rural clinic application (e.g. Roha Primary Health Centre).
2. Visit the District Admin Portal at `http://localhost:3005` and log in as `admin@meditory.gov.in` / `Password@123`.
3. Locate the pending application in the queue and review the doctor credentials and facility GPS coordinates.
4. Click **"Approve Clinic & Provision Stock"**.
5. The clinic is instantly activated, a starter emergency formulary is seeded into DynamoDB, and the doctor can immediately sign into the Rapid Desk.

---

## 🔒 Security & Route Protection

All internal workstation routes (`/rapid-desk`, `/locator`, `/audit`, `/admin`) are strictly protected:
* **Next.js Edge Middleware** (`apps/web/src/middleware.ts`) intercepts all unauthenticated page requests and redirects them to `/login`.
* **Client-Side Auth Guards** in `WorkstationShell` verify the session against `/api/auth/me` and prevent protected UI flash.
* **Serverless Scope Authorizer** (`enforceClinicScope`) prevents authenticated staff from mutating data belonging to other clinics.

---

## 🛠️ CLI Utilities & Commands

```bash
# Start all services concurrently
pnpm dev

# Inspect all 4 DynamoDB tables in formatted terminal tables
pnpm inspect

# Re-run full 103-test suite
pnpm test

# Reset and re-seed the local DynamoDB database
pnpm clean:db && pnpm seed

# Stop the local DynamoDB container
pnpm ddb:stop

# Synthesize AWS CDK CloudFormation templates
pnpm cdk:synth

# Deploy full stack to AWS Cloud
pnpm cdk:deploy
```

