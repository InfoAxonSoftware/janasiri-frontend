# Distribution Management System — Frontend

React + TypeScript + Vite single-page application for the Janasiri Distribution System
(Admin / SuperAdmin / SalesCoordinator / SalesRep / Customer portals).

## 1. Overview

- React 19 + TypeScript, built with Vite
- TanStack Query for server state, Redux Toolkit for client state
- React Router for navigation, Tailwind CSS for styling
- Talks to the backend API and SignalR hubs over `VITE_API_URL` / `VITE_SIGNALR_URL`

## 2. Requirements

- Node.js 20+ (developed against Node 24 / npm 11 — see `package.json` for exact dependency versions)
- npm (lockfile-based installs only — use `npm ci`, not `npm install`, for reproducible builds)

## 3. Environment variables

Copy `.env.example` and adjust for your environment:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend REST API |
| `VITE_SIGNALR_URL` | Base URL of the backend SignalR hubs |

These are baked into the client bundle at build time (standard Vite behavior) — never put real
credentials in a `VITE_`-prefixed variable.

## 4. Install dependencies

```bash
npm ci
```

## 5. Development

```bash
npm run dev
```

## 6. Production build

```bash
npm run build
```

Runs `tsc -b && vite build`; output goes to `dist/`.

## 7. Dependency audit warning

This project currently has **8 documented high-severity npm audit findings** (0 critical, 0
moderate, 0 low) after a controlled remediation pass. Do not run `npm audit fix --force` without
re-reading the audit report first — several remaining findings require a major-version upgrade
that hasn't been validated against this app yet.

## 8. Known xlsx issue

`xlsx` (SheetJS) has two known advisories (prototype pollution, ReDoS) with **no patched version
published to the npm registry** — SheetJS only publishes fixed builds via their own CDN. This
package parses user-uploaded Excel files (stock/sales/outstanding/target report imports, product
bulk import). Treat those import features as trusted-user-only until a replacement is approved.
See the full audit for the CDN-based remediation option.

## 9. Full audit report

The complete dependency audit (vulnerability classification, dependency chains, bundle-size
findings, install-script review) lives one level up in the deployment workspace:
`../FRONTEND_DEPENDENCY_AUDIT.md`.
