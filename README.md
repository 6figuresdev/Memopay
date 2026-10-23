# Stablecoin Payment Dashboard

A fully functional USDC payment dashboard built for the [TestSprite Hackathon Season 4](https://www.testsprite.com/hackathon-s4). Track transactions, create payment requests, monitor analytics, and keep every pull request tested automatically.

Built with [Arc Studio](https://studio.arc.io)

---

## Live URL

<!-- Replace with your deployed URL after connecting to Vercel/Netlify -->
**[https://your-app.vercel.app](https://your-app.vercel.app)**

---

## What It Does

| Feature | Description |
|---|---|
| **Dashboard** | Summary stats (total received, sent, net balance, open requests) + recent transaction feed |
| **Payment Requests** | Create requests with title, amount, payer, expiry; copy shareable payment links; cancel pending requests |
| **Transactions** | Full transaction list with search, status filter (completed / processing / pending / failed), direction filter (sent / received), and ArcScan explorer links |
| **Analytics** | 7-day volume bar chart, volume breakdown donut, request outcome breakdown, KPI cards (success rate, avg tx value, payment rate) |

Data is persisted to `localStorage` so state survives page reloads. The app uses realistic simulated USDC transactions on Arc Testnet — no wallet required to explore.

---

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS v3 (Arc Light design system)
- **Animation:** Framer Motion
- **Icons:** Lucide React + @web3icons/react
- **State:** React hooks + localStorage persistence
- **CI:** GitHub Actions
- **Testing:** TestSprite 3.0 (E2E, automated on every PR)

---

## TestSprite Integration

Every pull request automatically triggers a full E2E suite via the **TestSprite GitHub App**. No workflow YAML changes required — the app installs on the repo and detects the Vercel preview deployment.

### What the Suite Covers

| Suite | Tests |
|---|---|
| `dashboard.test.json` | Dashboard loads, stat cards visible, recent tx list, nav links present |
| `requests.test.json` | Requests list, sheet opens, form validation, create flow, cancel action |
| `transactions.test.json` | List renders, status badges, search filter, status filter, direction filter, explorer links |
| `analytics.test.json` | KPI cards, bar chart, donut chart, request outcomes |

Total: **20 test cases** across 4 suites.

### How to Wire It (for judges)

1. Create a free account at [testsprite.com](https://testsprite.com)
2. Deploy the app (Vercel recommended — auto-deploys previews on every PR)
3. In the TestSprite portal: **New Project → Frontend → point at the live URL → Generate Tests**
4. Install the TestSprite GitHub App from `Settings → GitHub App` in the portal
5. Open a PR — TestSprite detects the Vercel preview and runs the suite automatically

The `testsprite_tests/` folder contains the test plan JSON files committed to the repo. TestSprite uses these during CI runs.

### Required GitHub Secrets (for the GitHub Actions CI backup workflow)

| Secret | Description |
|---|---|
| `TESTSPRITE_API_KEY` | From TestSprite portal → API Keys |
| `TESTSPRITE_PROJECT_ID` | Your project ID in TestSprite |
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |

---

## Development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0

### Install

```bash
bun install
```

### Run

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Lint + Type Check

```bash
bun run check
```

### Environment Variables

None. The app uses simulated data and requires no API keys or wallet connections to run.

---

## Deployment

The app is a static Vite build. Deploy anywhere that serves static files:

- **Vercel** (recommended for TestSprite GitHub App auto-detection): connect the repo via the Vercel dashboard, it deploys on every push and creates a preview URL for every PR.
- **Netlify**: drag and drop the `dist/` folder, or connect the repo for auto-deploys.

---

## Project Structure

```
src/
├── App.tsx                  # Shell: nav, routing, state
├── data/
│   ├── types.ts             # Transaction + PaymentRequest types
│   ├── mockData.ts          # Seeded realistic USDC data
│   └── store.ts             # localStorage-backed React hooks
└── components/
    ├── Dashboard.tsx        # Stats + recent tx
    ├── Requests.tsx         # Request list + create sheet
    ├── Transactions.tsx     # Full list + filters
    ├── Analytics.tsx        # Charts + KPIs
    └── ui/
        ├── StatusBadge.tsx  # Coloured status chip
        └── StatCard.tsx     # Metric card

testsprite_tests/            # TestSprite test plan JSON files
.github/workflows/ci.yml     # GitHub Actions: build + deploy + TestSprite
```
