# Product Requirements Document: Meditory

**Tagline:** Last-Mile Healthcare Inventory & Real-Time Medicine Availability for Bharat
**Version:** 1.0
**Status:** Draft — Hackathon MVP (Build Bharat Tour, WeMakeDevs × AWS, "Ship It" track)
**Owner:** Mayank

---

## 1. Overview

Meditory is a serverless, mobile-first platform that closes the gap between what public health facilities (Sub-Centres, PHCs, CHCs) actually have on their shelves and what district administrators and citizens believe they have. It replaces slow, paper-driven, or desktop-form-based inventory logging with single-tap dispensing/restocking actions that commit atomically to the cloud, and exposes that data through a zero-authentication public search portal.

The platform has two faces:
- **Pharmacist Rapid Desk** — an internal, role-gated operational dashboard for facility staff.
- **Citizen Availability Board** — a public, unauthenticated search portal for patients, families, and ASHAs.

This PRD extends the original hackathon research blueprint by formalizing a **role-based authentication and authorization system**, replacing the "deferred / simple facility PIN" approach. For the MVP, scope is kept to **two roles** — public Citizen search and authenticated Pharmacist — with Facility Admin and District Admin roles planned for a post-hackathon rollout (see §11).

---

## 2. Problem Statement

- Essential medicine availability at primary-tier public facilities ranges from **17%–51%** of national targets, with stock-outs persisting **4–14 weeks**.
- Peripheral staff (pharmacists, ANMs) are clinically overloaded and abandon complex digital entry in favor of paper registers, so central dashboards reflect stale, theoretical stock levels.
- District administrators cannot proactively redirect surplus stock because local consumption surges surface weeks after the fact.
- Citizens and ASHAs travel blindly between facilities searching for medicines (e.g., Anti-Snake Venom, Anti-Rabies Vaccine, ORS), incurring transport costs, lost wages, and — for time-critical cases like snakebite or rabies exposure — risk to life.
- Out-of-pocket pharmaceutical spending is ~70% of household health expenditure, largely driven by patients turning to costly private pharmacies when public stock is depleted.

## 3. Goals

| Goal | Success Signal |
|---|---|
| Make inventory logging effortless enough that staff actually do it | Dispense/restock action takes ≤1 tap, ≤10ms DB commit |
| Give administrators real-time, trustworthy stock visibility | Facility stock data reflects last real dispensing event, not batch reconciliation |
| Eliminate information asymmetry for citizens | Public search returns live stock status with verification timestamp, no login required |
| Enforce accountability without adding friction | Every stock mutation is attributable to a role and identity via audit log |
| Support a credible multi-facility, multi-district rollout | Role model scales from single PHC pilot to district/state hierarchy |

## 4. Non-Goals (Out of Scope for MVP)

- OCR-based invoice scanning
- Barcode/hardware scanner integration
- Central procurement bidding / ERP workflows
- Full ABDM/ABHA health-record linkage (planned post-MVP, see §11)
- SMS/USSD/IVR fallback channels (planned post-MVP, see §11)

---

## 5. User Roles & Personas

Meditory introduces **two roles** for MVP, spanning the internal (authenticated) system and the external (public) portal. (Facility Admin and District Admin roles are deferred — see §11 Future Scope.)

### 5.1 Citizen / Frontline Health Worker (Public — No Login)
- **Who:** Patients, families, ASHAs, general public.
- **Access:** Fully anonymous. No account, password, or personal data required.
- **Can do:** Search medicines by generic/brand/symptom name; view stock status, verification timestamp, and facility location across nearby facilities; get redirected to the nearest facility with confirmed stock.
- **Cannot do:** View internal audit logs, modify inventory, see facility-internal notes.

### 5.2 Pharmacist / Dispensary Worker (Facility Role)
- **Who:** Pharmacists, ANMs, dispensary staff at a Sub-Centre/PHC/CHC.
- **Access:** Facility-scoped login (see §6 Auth Model).
- **Can do:** View own facility's inventory dashboard; Dispense (-1); Restock (+10/+50/+100); see own facility's audit trail.
- **Cannot do:** View or modify other facilities' inventory; access district-level analytics; manage users.

---

## 6. Multi-Role Authentication & Authorization

### 6.1 Design Principles
1. **Zero friction for the public.** The Citizen Availability Board never requires authentication — this is a hard product constraint, not just an MVP shortcut.
2. **Fast enough for a busy clinic.** Facility-role login must not slow down patient care — target under 10 seconds to authenticate.
3. **Scoped by default.** Every authenticated session is bound to exactly one facility (Pharmacist); no implicit cross-facility visibility.
4. **Auditable.** Every inventory mutation is tied to an authenticated identity (`workerPin` / `userId`), never anonymous, for the audit log.

### 6.2 Roles & Permission Matrix

| Capability | Citizen (Public) | Pharmacist |
|---|:---:|:---:|
| Public medicine search | ✅ | — |
| View own facility inventory | — | ✅ |
| Dispense (-1) | — | ✅ |
| Restock (+10/+50/+100) | — | ✅ |
| View facility audit log | — | ✅ (own facility) |

*Facility metadata editing, staff management, facility onboarding, and cross-facility analytics are deferred to the Facility Admin / District Admin roles — see §11 Future Scope.*

### 6.3 Authentication Flow (MVP → Production Path)

**MVP (24-hour build) — Fast Path:**
- Each facility is provisioned with a 4-digit **Facility PIN** plus an individual **Worker ID/PIN** combination at seed time.
- Login screen: enter Facility ID → enter personal PIN (single role: Pharmacist).
- Session issues a signed, short-lived JWT carrying `{ role: "pharmacist", facilityId, userId }`, stored in local storage/session, attached to every API call.
- API Gateway + Lambda authorizer validates the JWT and enforces facility scope on every write (`ConditionExpression` on facility ownership) before touching DynamoDB.
- No email/password/OTP required for MVP — optimized for staff with low digital literacy and shared devices.

**Production Hardening (Post-MVP):**
- Upgrade PIN-only auth to **Amazon Cognito User Pools** with role-based Cognito Groups (`pharmacist`, plus `facility_admin`/`district_admin` once those roles are built — see §11), phone/OTP-based login for individual accountability.
- Add mandatory PIN rotation and session timeout per facility device.

### 6.4 Data Model Addition — User/Role Entity

| Entity Type | Partition Key (PK) | Sort Key (SK) | Attributes | Access Pattern |
|---|---|---|---|---|
| **User/Staff Record** | `FACILITY#<FacilityID>` | `USER#<UserID>` | `role`, `name`, `pinHash`, `status`, `createdAt`, `lastLoginAt` | Authenticate staff and resolve facility scope at login |

This extends the original single-table design (Facility Metadata, Inventory Record, Global Drug Registry, Inventory Audit Log) from the base research blueprint without introducing relational joins. A `DISTRICT#<DistrictID>` entity is deferred until the District Admin role is built — see §11.

### 6.5 Authorization Enforcement
- Every mutation Lambda (`dispenseMedicineHandler`, `restockHandler`) validates the caller's JWT scope against the `facilityId` in the request path/body before executing the DynamoDB `UpdateCommand` — a Pharmacist token for Facility A cannot mutate Facility B's inventory even if the request is crafted manually.

---

## 7. Core Features

### 7.1 Pharmacist Rapid Desk (Authenticated)
- Facility-scoped login (Pharmacist, §6.3)
- IPHS-tiered inventory dashboard: emergency drugs (ARV, ASV) surfaced first
- One-tap **Dispense (-1)** with optimistic UI update + background mutation; auto-revert + alert on failure
- Stepped **Restock (+10 / +50 / +100)** with confirmation
- Facility-scoped audit trail view

### 7.2 Citizen Availability Board (Public, No Auth)
- Search by generic name, brand name, or symptom (e.g., "Snake venom," "Fever," "ORS")
- Results ranked by proximity within the administrative district
- Stock badges: **In Stock** (with verification timestamp) / **Critically Low** / **Out of Stock**
- Automatic redirect suggestion to nearest facility with confirmed stock when the closest one is out
- Access via direct link or QR code posted at facility entrances

### 7.3 Observability & Alerts
- CloudWatch log streams for all mutation Lambdas
- CloudWatch Metric Alarms trigger when a facility's critical-drug quantity drops below its threshold
- District Admin dashboard surfaces active alarms across all facilities in-scope

---

## 8. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | System shall allow unauthenticated public search of medicine availability across facilities | P0 |
| FR-2 | System shall require role-based authentication for any inventory-mutating action | P0 |
| FR-3 | System shall scope every authenticated session to exactly one facility or one district | P0 |
| FR-4 | System shall record every dispense/restock event with `workerPin`/`userId`, timestamp, and delta in an immutable audit log | P0 |
| FR-5 | System shall atomically update inventory counts using conditional expressions to prevent negative stock and race conditions | P0 |
| FR-6 | System shall trigger a CloudWatch alarm when a facility's stock for a critical drug crosses below its configured threshold | P0 |
| FR-7 | Public search shall suggest the nearest alternative facility when the closest match is out of stock | P1 |
| FR-8 | System shall reject any mutation request where the authenticated identity's facility scope does not match the target facility | P0 |

## 9. Non-Functional Requirements

- **Latency:** Inventory mutations committed in <10ms at the DynamoDB layer; UI reflects change optimistically and instantly.
- **Availability:** Serverless, scale-to-zero architecture; no maintenance windows required.
- **Low-bandwidth resilience:** Functional on constrained rural mobile networks; minimal payloads.
- **Security:** All authenticated endpoints protected by JWT + Lambda authorizer; PINs stored hashed, never in plaintext; public endpoints are strictly read-only.
- **Auditability:** No inventory mutation may occur without an attributable, logged identity.
- **Accessibility:** Public portal usable on low-end smartphones with minimal data entry (search-only interaction).

---

## 10. Technical Architecture Summary

- **Frontend:** React + Next.js + Tailwind CSS, mobile-first, optimistic rendering; hosted on AWS Amplify or S3 + CloudFront.
- **API Layer:** Amazon API Gateway (HTTP API) with a Lambda authorizer enforcing role/scope from the JWT before routing to handlers.
- **Compute:** AWS Lambda, Node.js 20.x, AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`).
- **Data:** Amazon DynamoDB, single-table design, On-Demand capacity; GSI-1 (`DRUG#<DrugID>` / `STATUS#<StockStatus>`) powers cross-facility public search.
- **Observability:** Amazon CloudWatch for logs and low-stock metric alarms.
- **Auth (MVP):** Facility/District PIN + signed JWT session.
- **Auth (Production path):** Amazon Cognito User Pools with role-based Groups, OTP login.

---

## 11. Future Scope (Post-Hackathon)

- **Facility Admin role:** Elevated facility-scoped role (PHC in-charge) that can do everything a Pharmacist can, plus add/remove Pharmacist accounts for their facility, edit facility metadata (contact, hours, geo-coordinates), view facility-level consumption trends, and set/override low-stock thresholds.
- **District Health Administrator role:** District-scoped, read/coordination-only role that can view real-time stock across all facilities in a district, identify surplus/shortage patterns for redistribution, view CloudWatch-driven low-stock alerts district-wide, onboard new facilities and Facility Admins, and export consumption reports — without direct dispense/restock access.
- **ABDM/ABHA integration:** Link dispensed medicines to citizens' electronic health records to reduce duplicate prescriptions.
- **UHI-compliant open APIs:** Allow authorized third-party apps to query public stock data.
- **ML-driven demand forecasting:** Use DynamoDB streams + Amazon Bedrock/SageMaker to predict seasonal surges (e.g., ASV demand in monsoon) and recommend proactive redistribution.
- **Multi-channel access:** SMS/USSD via Amazon SNS and regional-language IVR for citizens and ASHAs without smartphones.
- **Cognito-based production auth**, with individual OTP login, session revocation, and PIN rotation policies (see §6.3).

---

## 12. Success Metrics (Hackathon Demo)

| Metric | Target |
|---|---|
| Dispense action → DB commit latency | <10ms (shown via CloudWatch) |
| Public search → facility result | Real-time, no stale batch data |
| Role-boundary enforcement | Demonstrated 403 on cross-facility access attempt |
| Low-stock alarm trigger | Demonstrated ALARM state transition live in console |
| End-to-end flow | Citizen search → Out of Stock → Pharmacist restock → Public card updates, live on deployed URL |

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| PIN-only auth is weak for production | Explicitly scoped as MVP-only; Cognito upgrade path defined in §6.3 |
| Facility staff resist any login step, even PIN | Kept to Facility ID + PIN, target <10s login, no email/password |
| Role-scope bugs allow cross-facility writes | Enforced server-side via Lambda authorizer + conditional expressions, not client-side only (FR-8) |
