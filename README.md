# Meditory

**Last-Mile Healthcare Inventory & Emergency Referral Network for Bharat**  
*Built for the WeMakeDevs × AWS Hackathon ("Ship It" Track)*

Meditory is a serverless, mobile-first healthcare inventory management and emergency referral platform for primary public healthcare clinics (Sub-Centres, PHCs, and CHCs) across rural and semi-urban India.

---

## 🏛️ Monorepo Architecture

The repository is organized following standard modular monorepo best practices using `pnpm` workspaces:

```text
meditory/
├── apps/
│   ├── web/                     # Frontend Application (Next.js 14 App Router)
│   │   ├── src/app/             # Pages, Layouts, and UI Components
│   │   ├── next.config.mjs      # Next.js configuration (transpiles @meditory/shared)
│   │   ├── tailwind.config.ts   # Styling & responsive design
│   │   └── package.json         # Name: "web"
│   │
│   └── api/                     # AWS Serverless Backend & CDK Infrastructure
│       ├── bin/infra.ts         # AWS CDK App entry point
│       ├── lib/                 # AWS CDK Stack definitions (DynamoDB, API Gateway, Lambdas, CloudWatch)
│       ├── src/                 # Serverless Lambda handlers (auth, dispense, restock, locator)
│       ├── cdk.json             # CDK execution configuration
│       └── package.json         # Name: "api"
│
├── packages/
│   └── shared/                  # Shared Domain Types, Contracts & Constants
│       ├── src/
│       │   ├── constants.ts     # DDB single-table keys, IPHS drug priority tiers, status enums
│       │   ├── types.ts         # Domain models (Facility, User, InventoryItem, AuditLogEntry)
│       │   ├── dtos.ts          # Strongly-typed API Request & Response interfaces
│       │   └── index.ts         # Barrel export
│       └── package.json         # Name: "@meditory/shared"
│
├── package.json                 # Root workspace orchestrator
├── pnpm-workspace.yaml          # Workspaces: ["apps/*", "packages/*"]
└── docs/
    └── Meditory_PRD.md          # Approved Product Requirements Document
```

---

## ⚡ Tech Stack

- **Frontend (`apps/web`):** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons, TanStack React Query.
- **Backend & Cloud (`apps/api`):** AWS Lambda (Node.js 20.x, TypeScript), AWS SDK v3, `bcryptjs`, `jose` (JWT).
- **Database (`apps/api`):** Amazon DynamoDB (Single-Table Design with GSI-1 for inter-clinic referrals).
- **Observability (`apps/api`):** Amazon CloudWatch Logs, Embedded Metric Format (EMF), and Metric Alarms.
- **Infrastructure as Code (`apps/api`):** AWS CDK (TypeScript).

---

## 🚀 Quickstart Commands

```bash
# 1. Install all dependencies across all apps & packages
pnpm install

# 2. Run the Next.js frontend in development mode (http://localhost:3000)
pnpm dev

# 3. Build all workspace packages (typecheck + CDK synth + Next.js build)
pnpm build

# 4. Synthesize AWS CDK CloudFormation templates
pnpm cdk:synth

# 5. Deploy directly to AWS
pnpm cdk:deploy

# 6. Seed DynamoDB with realistic rural clinic data
pnpm seed
```
