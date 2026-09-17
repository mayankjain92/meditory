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

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **pnpm**: `npm install -g pnpm`
- **Docker**: For running DynamoDB Local & the Admin GUI

### 2. Start Local DynamoDB & GUI
```bash
# Start DynamoDB Local (port 8000) and DynamoDB Admin GUI (port 8001)
docker compose up -d
```
* Visual Web GUI is immediately available at: **`http://localhost:8001`**

### 3. Seed the Database
```bash
pnpm seed
```
Seeds 3 realistic clinics in Raigad district (Alibag PHC, Vadkhal PHC, Pen CHC), 3 staff accounts, and 18 shelf inventory records.

### 4. Run Automated Handler Tests
```bash
pnpm test
```
Executes the comprehensive 28-test suite verifying authentication, JWT cookies, clinic isolation, atomic 1-tap dispensing, custom batch dispensing, restocking, audit logs, and inter-clinic referral lookups.

### 5. Start Development Servers
```bash
# Terminal 1: Start the API backend (http://localhost:3001)
pnpm dev:api

# Terminal 2: Start the Next.js frontend (http://localhost:3000)
pnpm dev
```

---

## 👥 Pre-Seeded Staff Accounts (For Demo & Testing)

| Health Facility | Facility Type | Staff Email | Password | Demo Scenario |
|---|---|---|---|---|
| **Alibag PHC** | Primary Health Centre | `rahul.sharma@phc-alibag.in` | `Password@123` | Demonstrates **0 stock of Anti-Snake Venom (ASV)** $\rightarrow$ triggers emergency referral to Pen CHC. |
| **Vadkhal PHC** | Primary Health Centre | `priya.deshmukh@phc-vadkhal.in` | `Password@123` | Demonstrates **Low Stock (2 vials remaining)** $\rightarrow$ triggers CloudWatch alarm threshold. |
| **Pen CHC** | Community Health Centre | `amit.patil@chc-pen.in` | `Password@123` | Demonstrates **Surplus stock (25 vials ASV)** $\rightarrow$ acts as destination clinic for emergency patient transfers. |

---

## 🛠️ CLI Utilities

```bash
# Inspect all 4 DynamoDB tables in formatted terminal tables
pnpm inspect

# Synthesize AWS CDK CloudFormation templates
pnpm cdk:synth

# Deploy full stack to AWS
pnpm cdk:deploy
```
