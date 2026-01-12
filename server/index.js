import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8787;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const isProduction =
  process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
const defaultDbPath = process.env.RAILWAY_ENVIRONMENT
  ? "/data/stablecoins.db"
  : path.join(__dirname, "data", "stablecoins.db");
const DB_PATH = process.env.DB_PATH || defaultDbPath;
let distPath = null;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS stablecoins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issuerAddress TEXT NOT NULL,
    stablecoinId TEXT NOT NULL,
    name TEXT NOT NULL,
    ticker TEXT NOT NULL,
    chainId INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    issuerRoleGranted INTEGER NOT NULL DEFAULT 0
  );

  CREATE UNIQUE INDEX IF NOT EXISTS stablecoins_unique
    ON stablecoins (issuerAddress, stablecoinId, chainId);

  CREATE INDEX IF NOT EXISTS stablecoins_issuer_chain
    ON stablecoins (issuerAddress, chainId);
`);

const existingColumns = db.pragma("table_info(stablecoins)");
const hasIssuerRole = existingColumns.some(
  (column) => column.name === "issuerRoleGranted"
);
if (!hasIssuerRole) {
  db.exec(
    "ALTER TABLE stablecoins ADD COLUMN issuerRoleGranted INTEGER NOT NULL DEFAULT 0"
  );
}

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin === CLIENT_ORIGIN) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

if (isProduction) {
  distPath = path.resolve(__dirname, "..", "dist");
  app.use(express.static(distPath));
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/stablecoins", (req, res) => {
  const issuerAddress = String(req.query.issuerAddress || "").toLowerCase();
  const chainId = Number(req.query.chainId);

  if (!isAddress(issuerAddress) || !Number.isInteger(chainId)) {
    return res.status(400).json({ error: "Invalid issuerAddress or chainId" });
  }

  const rows = db
    .prepare(
      `SELECT stablecoinId, name, ticker, chainId, createdAt, issuerRoleGranted
       FROM stablecoins
       WHERE issuerAddress = ? AND chainId = ?
       ORDER BY createdAt DESC`
    )
    .all(issuerAddress, chainId);

  return res.json({ items: rows });
});

app.post("/stablecoins", (req, res) => {
  const {
    issuerAddress,
    stablecoinId,
    name,
    ticker,
    chainId,
    createdAt,
  } = req.body || {};

  const normalizedIssuer = String(issuerAddress || "").toLowerCase();
  const normalizedStablecoin = String(stablecoinId || "").toLowerCase();
  const normalizedName = String(name || "").trim();
  const normalizedTicker = String(ticker || "").trim().toUpperCase();
  const numericChainId = Number(chainId);
  const timestamp = createdAt ? String(createdAt) : new Date().toISOString();

  if (
    !isAddress(normalizedIssuer) ||
    !isAddress(normalizedStablecoin) ||
    !normalizedName ||
    !normalizedTicker ||
    !Number.isInteger(numericChainId)
  ) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    db.prepare(
      `INSERT OR IGNORE INTO stablecoins
       (issuerAddress, stablecoinId, name, ticker, chainId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      normalizedIssuer,
      normalizedStablecoin,
      normalizedName,
      normalizedTicker,
      numericChainId,
      timestamp
    );

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Insert stablecoin failed", error);
    return res.status(500).json({ error: "Failed to store stablecoin" });
  }
});

app.patch("/stablecoins/:stablecoinId", (req, res) => {
  const stablecoinId = String(req.params.stablecoinId || "").toLowerCase();
  const issuerAddress = String(req.body?.issuerAddress || "").toLowerCase();
  const chainId = Number(req.body?.chainId);
  const issuerRoleGranted =
    req.body?.issuerRoleGranted === undefined
      ? 1
      : Number(Boolean(req.body.issuerRoleGranted));

  if (
    !isAddress(stablecoinId) ||
    !isAddress(issuerAddress) ||
    !Number.isInteger(chainId)
  ) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const result = db
      .prepare(
        `UPDATE stablecoins
         SET issuerRoleGranted = ?
         WHERE issuerAddress = ? AND stablecoinId = ? AND chainId = ?`
      )
      .run(issuerRoleGranted, issuerAddress, stablecoinId, chainId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Stablecoin not found" });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Update stablecoin failed", error);
    return res.status(500).json({ error: "Failed to update stablecoin" });
  }
});

if (isProduction && distPath) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Stablecoin registry listening on ${PORT}`);
});
