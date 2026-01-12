# Tempo Issuer Control Center

Passkey-first issuer console for Tempo Moderato with an Express + SQLite registry for managed stablecoins.

## Requirements

- Node.js 18+
- npm

## Local Development

Install dependencies:

```bash
npm install
```

Run the backend (Express + SQLite):

```bash
npm run server
```

Run the frontend (Vite):

```bash
npm run dev
```

The frontend expects the backend at `http://localhost:8787` by default.

## Environment Variables

### Frontend

- `VITE_API_URL` — URL of the backend API (default: `http://localhost:8787`).

### Backend

- `PORT` — Port for the Express server (default: `8787`).
- `CLIENT_ORIGIN` — Allowed CORS origin (default: `http://localhost:5173`).
- `DB_PATH` — SQLite DB file path (default: `server/data/stablecoins.db`, Railway: `/data/stablecoins.db`).

## API Endpoints

- `GET /stablecoins?issuerAddress=0x...&chainId=42431`
- `POST /stablecoins`
  - Body: `{ issuerAddress, stablecoinId, name, ticker, chainId, createdAt }`

## Deployment (Railway)

Deploy the backend + frontend service with the included `railway.toml`.

Recommended Railway variables:

- `PORT` (Railway sets this automatically)
- `CLIENT_ORIGIN` (your deployed frontend URL)
- `DB_PATH` (`/data/stablecoins.db` if using a Railway volume)

Railway will run `npm run build` to generate the Vite UI and serve it from `/`.
