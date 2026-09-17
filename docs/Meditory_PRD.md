# Product Requirements Document: Meditory

**Tagline:** Clinic-to-Clinic Healthcare Inventory & Emergency Referral Network for Bharat  
**Version:** 2.0  
**Status:** Approved — Hackathon MVP (Build Bharat Tour, WeMakeDevs × AWS, "Ship It" track)  
**Owner:** Mayank  

---

## 1. Overview

Meditory is a serverless, mobile-first inventory and emergency referral platform designed for public primary healthcare clinics (Sub-Centres, PHCs, CHCs) across Bharat. 

Rather than exposing drug searches to untrained citizens—who cannot clinically evaluate drug indications or formulations—Meditory is an **internal, clinic-to-clinic operational system** built exclusively for frontline clinic staff (pharmacists, ANMs, staff nurses).

The platform addresses two operational imperatives:
- **Clinic Rapid Desk** — a single-tap dispensing and restocking operational interface that replaces cumbersome paper registers with atomic cloud commits (<10ms).
- **Inter-Clinic Referral & Stock Locator** — an internal network search that allows a healthcare worker whose clinic is out of an essential drug (e.g., Anti-Snake Venom, Anti-Rabies Vaccine) to instantly locate which neighboring clinic has verified stock, enabling immediate, life-saving patient referrals or inter-clinic stock balancing.

Meditory enforces a **single authenticated role (Facility Worker)** with **strict clinic-to-clinic mutation isolation**: staff can only mutate their own clinic's inventory, but can view neighboring stock for emergency referral.

---

## 2. Problem Statement

- **High Stock-Outs in Rural Facilities:** Primary healthcare centers regularly face stock-outs of essential emergency medicines (Anti-Snake Venom, Anti-Rabies Vaccine, ORS, Paracetamol), persisting for 4 to 14 weeks.
- **Referral Blindness:** When an emergency patient arrives (e.g., snakebite, rabid dog bite) at a Sub-Centre or PHC with zero vials, the clinic worker has no visibility into neighboring facilities. They are forced to send patients on blind journeys across rural districts, causing tragic delays in critical care.
- **Clinical Overload & Abandoned Software:** Peripheral dispensary staff are overwhelmed by OPD queues. Complex desktop ERPs and multi-step forms are abandoned for paper registers, leaving district health registries completely out of sync with physical shelves.
- **Patient Self-Medication Hazard:** Exposing raw medicine searches directly to citizens promotes unguided self-medication and confusion between generic variants, strengths, and contraindications. Healthcare inventory must be managed and interpreted by clinical workers at the point of care.

---

## 3. Goals

| Goal | Success Signal |
|---|---|
| **Zero-Lag Inventory Logging** | Dispense/restock action takes ≤1 tap and commits atomically to DynamoDB in ≤10ms |
| **Emergency Clinic-to-Clinic Referrals** | When local stock is 0, clinic staff can locate the nearest facility with verified stock in ≤2 seconds |
| **Strict Clinic Multi-Tenancy** | Clinic A's workers can never mutate Clinic B's inventory; cross-facility writes return a strict `403 Forbidden` |
| **Tamper-Evident Accountability** | Every dispense and restock mutation is permanently recorded in an immutable facility audit trail |
| **Proactive Stockout Prevention** | Amazon CloudWatch Metric Alarms trigger when critical emergency drugs fall below safety thresholds |

---

## 4. Non-Goals (Out of Scope for MVP)

- Public / Patient-facing unauthenticated self-diagnosis or medicine search (explicitly eliminated).
- OCR-based physical invoice scanning.
- Hardware barcode/RFID scanners.
- Central state procurement bidding & financial billing.
- ABDM/ABHA electronic health record linkage (post-MVP, see §11).

---

## 5. User Roles & Personas

Meditory MVP operates with **a single authenticated role: Facility Worker**.

### 5.1 Facility Worker / Clinic Pharmacist (Authenticated — Clinic Scoped)
- **Who:** Pharmacists, ANMs, dispensary workers, and Medical Officers at Sub-Centres, PHCs, and CHCs.
- **Authentication:** Login using **Work Email / Staff ID** + **Secure Password** (bcrypt hashed, enterprise-grade security).
- **Permissions & Capabilities:**
  - **Own Clinic Inventory:** View full live stock levels, categorized by IPHS tiers (Emergency, Essential, Routine).
  - **1-Tap Dispense (-1):** Single tap to dispense with optimistic UI update and atomic DynamoDB conditional write.
  - **Stepped Restock (+10 / +50 / +100):** Quick incremental batch restocking.
  - **Facility Audit Log:** View immutable audit log of who dispensed/restocked what and when.
  - **Inter-Clinic Stock Locator:** Search the district clinic network to find which neighboring clinic has stock when local inventory is depleted, along with facility contact and distance.
- **Strict Boundary (Cannot Do):** Cannot view other clinics' audit logs or mutate any other clinic's inventory.

---

## 6. Clinic-to-Clinic Authentication & Authorization

### 6.1 Design Principles
1. **All Endpoints Authenticated:** Zero unauthenticated public access. Every API request requires a valid, signed JWT.
2. **Secure, Enterprise-Grade Authentication:** Frontline staff authenticate using their **Work Email / Username** and **Secure Password** (hashed with `bcrypt`), preventing brute-force attacks and meeting healthcare data standards.
3. **Cryptographic Clinic Scoping:** The issued JWT contains `{ role: "facility_worker", facilityId, userId, exp }`.
4. **Clinic-to-Clinic Mutation Isolation:** AWS API Gateway + Lambda Authorizer verifies that the `facilityId` in the JWT matches the target facility in the mutation request. Any cross-clinic mutation is rejected with `403 Forbidden`.
5. **Auditable Attribution:** Every inventory mutation persists the `userId` in DynamoDB.

### 6.2 Permission Matrix

| Capability | Facility Worker (Own Clinic) | Facility Worker (Neighboring Clinic) |
|---|:---:|:---:|
| View Live Inventory | ✅ | ❌ (Private internal shelf view) |
| Search Medicine Availability for Referral | ✅ | ✅ (Aggregated stock status & location) |
| 1-Tap Dispense (-1) | ✅ | ❌ (Strictly Forbidden — 403) |
| Stepped Restock (+10/+50) | ✅ | ❌ (Strictly Forbidden — 403) |
| View Facility Audit Trail | ✅ | ❌ (Strictly Forbidden — 403) |
| Receive Low-Stock Alarm | ✅ | ❌ |

### 6.3 Authentication Flow
1. Staff opens Meditory on clinic phone/tablet or desktop.
2. Enters **Work Email / Username** (e.g. `pharmacist.alibag@health.gov.in`) and **Password**.
3. Auth Lambda verifies password against salted `bcrypt` hash in DynamoDB, resolves assigned `facilityId`, and returns a signed JWT.
4. JWT is stored in client session storage and passed as `Authorization: Bearer <token>` on all requests.
5. Lambda authorizer inspects token, validates expiration & signature, and extracts `facilityId` and `userId`.

### 6.4 Data Model (Amazon DynamoDB Single-Table Design)

| Entity Type | Partition Key (PK) | Sort Key (SK) | GSI1-PK | GSI1-SK | Key Attributes |
|---|---|---|---|---|---|
| **Facility Metadata** | `FACILITY#<FacilityId>` | `METADATA` | `DISTRICT#<DistrictId>` | `FACILITY#<FacilityId>` | `name`, `type` (PHC/CHC/SC), `phone`, `lat`, `lng` |
| **Worker Record** | `FACILITY#<FacilityId>` | `USER#<UserId>` | `USER#<Email>` | `METADATA` | `name`, `email`, `passwordHash`, `role`, `status` |
| **Inventory Item** | `FACILITY#<FacilityId>` | `DRUG#<DrugId>` | `DRUG#<DrugId>` | `STATUS#<InStock\|Low\|Out>` | `drugName`, `quantity`, `unit`, `threshold`, `updatedAt` |
| **Inventory Audit Log**| `FACILITY#<FacilityId>` | `AUDIT#<Timestamp>`| — | — | `action` (DISPENSE/RESTOCK), `delta`, `drugId`, `workerId` |
| **Global Drug Registry**| `DRUG#<DrugId>` | `METADATA` | — | — | `genericName`, `category`, `form`, `isCritical` |

---

## 7. Core Features

### 7.1 Clinic Rapid Desk (Internal Operational Dashboard)
- **Emergency Priority View:** Life-critical drugs (Anti-Snake Venom, Anti-Rabies Vaccine, Adrenaline) are pinned to the top with immediate visual status (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`).
- **1-Tap Dispense (-1):** Tap the dispense button $\rightarrow$ UI updates instantaneously (0ms optimistic latency) while background Lambda executes an atomic DynamoDB conditional decrement:
  $$\text{ConditionExpression: } \text{quantity} > 0$$
- **Stepped Restock (+10 / +50 / +100):** Quick one-click increments with instant confirmation.
- **Facility Audit Trail:** Tab to inspect all historical actions, timestamps, and staff attributions.

### 7.2 Inter-Clinic Referral & Stock Locator
- Triggered automatically when local stock hits **0** or is critically low, or searchable on-demand by drug name.
- Queries GSI-1 to surface neighboring clinics in the district that have confirmed stock of the required medicine.
- Displays clinic name, distance/location, facility phone number, and verified stock count so the healthcare worker can coordinate an immediate patient transfer or inter-clinic supply shift.

### 7.3 Observability & Low-Stock Alerts
- **CloudWatch Custom Metrics:** Dispensing Lambdas emit custom metrics (`StockLevel`, `DispenseLatency`) via CloudWatch Embedded Metric Format (EMF).
- **CloudWatch Metric Alarms:** Alarm triggers automatically when critical drugs (e.g. Anti-Snake Venom) drop below the clinic's safety threshold (e.g., $< 5$ vials).
- **Desk Alert Banner:** Active CloudWatch alarm state is visualized directly on the clinic desk.

---

## 8. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | All endpoints shall require JWT authentication; unauthenticated requests shall be rejected with 401 Unauthorized | P0 |
| FR-2 | System shall strictly isolate inventory mutations so that staff can only mutate their own clinic's stock | P0 |
| FR-3 | System shall reject any cross-facility mutation attempt with 403 Forbidden | P0 |
| FR-4 | System shall provide an Inter-Clinic Stock Locator allowing staff to find neighboring clinics with stock for patient referral | P0 |
| FR-5 | Dispense actions shall be atomic and conditional, guaranteeing stock never drops below 0 | P0 |
| FR-6 | Every dispense and restock event shall be immutably recorded in the clinic audit log with staff identity and timestamp | P0 |
| FR-7 | System shall emit CloudWatch metrics and trigger alarms when critical drug levels cross below configured thresholds | P0 |
| FR-8 | UI shall optimistically reflect dispensing actions with zero perceptible lag for high-volume clinic queues | P0 |

---

## 9. Non-Functional Requirements

- **Latency:** Inventory mutations committed to DynamoDB in <10ms; frontend reacts in 0ms optimistically.
- **Mobile-First & Low-Bandwidth:** Designed for low-cost Android tablets and smartphones used by clinic staff on 3G/4G rural networks.
- **Security:** Bcrypt-hashed password storage, short-lived signed JWTs, API Gateway perimeter authorization, server-side conditional expression validation.
- **Reliability:** Serverless scale-to-zero architecture on AWS (zero server maintenance, zero idle cost).

---

## 10. Technical Architecture Summary

- **Frontend:** Next.js (App Router) + Tailwind CSS + Lucide Icons + TanStack Query; hosted on AWS Amplify or S3 + CloudFront.
- **API Layer:** Amazon API Gateway (HTTP API v2) with a Lambda Authorizer protecting all routes.
- **Compute:** AWS Lambda (Node.js 20.x, TypeScript), AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`).
- **Data:** Amazon DynamoDB Single-Table Design with GSI-1 for inter-clinic referral search.
- **Monitoring:** Amazon CloudWatch Logs, Custom EMF Metrics, and CloudWatch Metric Alarms.
- **Infrastructure as Code:** AWS CDK (TypeScript) for reproducible 1-click cloud deployment.

---

## 11. Future Scope (Post-Hackathon)

- **Formal Inter-Clinic Stock Transfer Orders:** Two-phase commit transfer workflow where Clinic A initiates a surplus transfer and Clinic B confirms receipt.
- **District Chief Medical Officer (CMO) Dashboard:** Read-only district aggregation for macro-level supply planning.
- **ABDM/ABHA Integration:** Linking dispensed medicines to Ayushman Bharat Health Accounts.
- **Automated Reordering via GeM:** Integration with Government e-Marketplace for automatic replenishment triggers.

---

## 12. Success Metrics (Hackathon Demo)

| Metric | Target |
|---|---|
| **Dispense Latency** | Demonstrated <10ms DynamoDB commit latency in CloudWatch |
| **Zero-Lag UX** | 1-tap dispense with instant optimistic UI update |
| **Security Enforcement** | Demonstrated 403 Forbidden when attempting cross-clinic mutation |
| **Emergency Referral Workflow** | Clinic A hits 0 stock on Anti-Snake Venom $\rightarrow$ Inter-Clinic Locator identifies Clinic B with stock $\rightarrow$ displays referral contact |
| **CloudWatch Alarm Transition** | Live demonstration of CloudWatch alarm flipping to `ALARM` state when critical medicine drops below threshold |
