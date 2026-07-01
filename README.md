# DP Last - Comprehensive Urbanism Automation Suite

DP Last is a high-performance web platform designed to automate the complex process of filing **Déclarations Préalables (DP)** for architectural and renovation projects in France. By centralizing data entry, automating PDF mapping, and leveraging AI for descriptive notice generation, DP Last reduces the time required to prepare a compliant file from hours to minutes.

## 🎯 Project Purpose

The primary goal of DP Last is to lower the barrier to entry for urban planning compliance. Navigating the French administration's requirements (like the CERFA 13703* and the DP4 descriptive notice) is notoriously difficult for non-experts. This project provides a structured, multi-step workflow that guides the user through every legal requirement, ensuring that the final output is accurate, professional, and ready for submission to the town hall (Mairie).

## 🗺️ The Application Flow

The application is structured into 6 logical steps, each designed to collect and process specific data points required by the administration:

### 1. Identité (Identity)
The system collects legally binding information about the applicant. 
- **Personal vs. Corporate**: Handles both individual citizens and legal entities (Sociétés).
- **Automation**: Distinguishes between 'Demandeur' and 'Représentant' to ensure the CERFA is populated according to strict administrative rules.

### 2. Coordonnées (Coordinates & Terrain)
Collects specific details about the project site.
- **Cadastral Integration**: Captures prefix, section, and parcel numbers essential for plot identification.
- **Dynamic Previews**: Integrates map views to help users verify the exact location of their project.

### 3. Travaux (Work Description & Surfaces)
The core technical engine of the application.
- **Project Scope**: Handles various work types (Rénovations, Facades, Toitures, etc.).
- **Surface Tracking**: Automatically tracks "Surface Existante", "Surface Créée", and "Surface Supprimée" to calculate the project's tax implications and feasibility.
- **Project Descriptions**: Collects initial descriptions that will later be tuned by AI.

### 4. Pièces Jointes (Photos & Plans)
A centralized file management system for visual proof.
- **Slot-Based Uploads**: Users provide "Avant" (Before) photos of all facades (North, South, East, West).
- **Vision Preparation**: These images are utilized by the AI Vision engine in the next step to understand the architectural context.

### 5. Notice DP4 (AI Generation)
Where the heavy lifting happens.
- **Vision AI Analysis**: Using the Mistral-14B model (via NVIDIA NIM), the system "sees" the uploaded photos and the project data.
- **Professional Drafting**: It automatically drafts the "Notice Descriptive" (DP4), explaining the initial state and how the project integrates into the urban environment using professional architectural vocabulary.

### 6. Génération (Finalization)
The final assembly line.
- **Legal Engagement**: Captures the final "Engagement du Déclarant" (Signature details, date, and place).
- **PDF Compilation**: The system maps all collected data onto the official CERFA 13703* PDF and generates the supplementary DP documents.

## 🧱 Key Features

- **Test Mode**: A developer-focused toggle in the header that instantly populates all steps with valid dummy data for rapid testing and demonstrations.
- **Brutalist Design System**: A high-contrast, premium aesthetic that prioritizes clarity and speed.
- **Universal .gitignore**: Optimized to exclude build artifacts (`.next`, `node_modules`) while preserving essential configuration templates.

## 🛠️ Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS** & Vanilla CSS Custom Variables
- **Mistral-14B Instruct** (via NVIDIA NIM)
- **pdf-lib** for pixel-perfect administrative form mapping

---

## 🔐 Accounts & Persistence

The app is **gated behind authentication**: users register/log in (email + password), and each
account's dossiers are saved server-side (Postgres) and resumable across devices. Photos, maps and
AI images are stored in **Vercel Blob** — the dossier row keeps only their URLs, never base64.

- **Auth**: bcrypt-hashed passwords, stateless JWT (`jose`) in an httpOnly cookie. Edge gate in
  `src/middleware.ts` (imports only `src/lib/session.ts` — never `bcryptjs`/`drizzle`).
- **DB**: Drizzle ORM over Neon (`src/lib/db/`). Schema: `users`, `dossiers(data jsonb, …)`.
- **Blob**: `src/app/api/blob/upload` + client helper `src/lib/uploadImage.ts`.

### Required environment variables (`.env.local` locally, Vercel project env in prod)
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon/Postgres connection (pooled). Pull via `vercel env pull`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token (Storage → your store → `.env.local` tab). |
| `AUTH_SECRET` | Strong random string for signing session JWTs. |
| `OPENROUTER_API_KEY` | AI image + notice generation. |

### Database migrations
```bash
npm run db:generate   # generate SQL from src/lib/db/schema.ts → ./drizzle
npm run db:migrate    # apply to DATABASE_URL  (run as a deploy step, NOT during `next build`)
npm run db:studio     # optional: browse the DB
```

## 🏁 Getting Started

1. **Clone**: `git clone https://github.com/ayouubmzariiii/DP-Last.git`
2. **Install**: `npm install`
3. **Env**: create `.env.local` with the variables in the table above (`vercel env pull` fills
   `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN`; set your own `AUTH_SECRET`).
4. **Migrate**: `npm run db:migrate`
5. **Dev**: `npm run dev` → open `/register`.

---
Copyright © 2024 DP Last. All rights reserved.
