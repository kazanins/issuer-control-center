import {
  Interface,
  parseUnits,
  hexlify,
  keccak256,
  solidityPacked,
  toUtf8Bytes,
  isAddress,
  formatUnits,
} from "ethers";
import confetti from "canvas-confetti";
import {
  createConfig,
  http,
  connect,
  disconnect,
  getAccount,
  watchAccount,
  reconnect,
  getWalletClient,
  getPublicClient,
} from "@wagmi/core";
import { tempoModerato } from "viem/chains";
import { Actions as TempoActions } from "viem/tempo";
import { Actions, KeyManager, webAuthn } from "wagmi/tempo";

const state = {
  account: null,
  passkeySupported: false,
  authPending: false,
  authMessage: null,
  faucetWarning: null,
  isAuthenticated: false,
  stablecoin: null,
  managedStablecoins: [],
  selectedStablecoinId: null,
  stablecoinsLoading: false,
  gateOpen: false,
  mintRecipientAccount: null,
  feeLiquidity: {
    validatorToken: "0x20c0000000000000000000000000000000000000",
    pool: null,
    lpBalance: null,
    balance: null,
    loading: false,
    adding: false,
    removing: false,
    addStatusLocked: false,
    removeStatusLocked: false,
  },
  alphaTransfer: {
    amount: 50,
    pending: false,
    poolReady: false,
    statusLocked: false,
  },
  actions: {
    creating: false,
    granting: false,
    minting: false,
  },
  carouselIndex: 0,
  messages: {
    create: "Awaiting input",
    grant: "Waiting for stablecoin",
    mint: "Awaiting issuer role",
  },
  lastTx: {
    create: null,
    grant: null,
    mint: null,
  },
};


const AUTH_STORAGE_KEY = "tempoAuth";
const AUTH_WAGMI_STORAGE_KEY = "wagmi.store";


const TIP20_FACTORY_ADDRESS = "0x20fc000000000000000000000000000000000000";
const TIP20_PREFIX = "20c000000000000000000000";
const DEFAULT_QUOTE_TOKEN = "0x20c0000000000000000000000000000000000001";
const DEFAULT_CURRENCY = "USD";
const DEFAULT_FEE_TOKEN = DEFAULT_QUOTE_TOKEN;

const tip20Interface = new Interface([
  "function balanceOf(address account) view returns (uint256)",
]);

const PATH_USD_TOKEN = "0x20c0000000000000000000000000000000000000";
const ALPHA_USD_TOKEN = "0x20c0000000000000000000000000000000000001";
const DEFAULT_ALPHA_RECIPIENT =
  "0x67448a00f45357066d4de7936BfBB2D5456bb5CB";

const passkeyConnector = webAuthn({
  keyManager: KeyManager.localStorage(),
});

const config = createConfig({
  chains: [tempoModerato],
  connectors: [passkeyConnector],
  multiInjectedProviderDiscovery: false,
  transports: {
    [tempoModerato.id]: http(),
  },
});

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8787";

const tip20FactoryInterface = new Interface([
  "event TokenCreated(address indexed token,string name,string symbol,string currency,address quoteToken,address admin,bytes32 salt)",
  "function createToken(string name,string symbol,string currency,address quoteToken,address admin,bytes32 salt) external returns (address)",
  "function getTokenAddress(address sender,bytes32 salt) external view returns (address)",
]);

const tip20TokenInterface = new Interface([
  "function grantRole(bytes32 role,address account) external",
  "function revokeRole(bytes32 role,address account) external",
  "function mint(address to,uint256 amount) external",
  "function transfer(address to,uint256 amount) external returns (bool)",
]);

const elements = {
  signupButton: document.querySelector("[data-signup]"),
  signinButton: document.querySelector("[data-signin]"),
  disconnectButton: document.querySelector("[data-disconnect]"),
  copyButton: document.querySelector("[data-copy]"),
  status: document.querySelector("[data-status]"),
  faucetButton: document.querySelector("[data-faucet]"),
  gateLogoutButton: document.querySelector("[data-gate-logout]"),
  address: document.querySelector("[data-address]"),
  addressRow: document.querySelector("[data-address-row]"),
  providerLabel: document.querySelector("[data-provider]"),
  stablecoinSelector: document.querySelector("[data-stablecoin-selector]"),
  stablecoinSelect: document.querySelector("[data-stablecoin-select]"),
  selectedStablecoinId: document.querySelector("[data-selected-stablecoin-id]"),
  selectedStablecoinTicker: document.querySelector(
    "[data-selected-stablecoin-ticker]"
  ),
  createGate: document.querySelector("[data-create-gate]"),
  createForm: document.querySelector("[data-create-form]"),
  stablecoinNameInput: document.querySelector("[data-stablecoin-name]"),
  stablecoinTickerInput: document.querySelector("[data-stablecoin-ticker]"),
  createButton: document.querySelector("[data-create]"),
  createStatus: document.querySelector("[data-create-status]"),
  issuerAddress: document.querySelector("[data-issuer-address]"),
  issuerStablecoin: document.querySelector("[data-issuer-stablecoin]"),
  grantTitle: document.querySelector("[data-grant-title]"),
  grantPanel: document.querySelector("[data-grant-panel]"),
  mintPanel: document.querySelector("[data-mint-panel]"),
  selectorPanel: document.querySelector("[data-selector-panel]"),
  grantButton: document.querySelector("[data-grant]"),
  grantStatus: document.querySelector("[data-grant-status]"),
  mintForm: document.querySelector("[data-mint-form]"),
  mintRecipientInput: document.querySelector("[data-mint-recipient]"),
  mintAmountInput: document.querySelector("[data-mint-amount]"),
  mintButton: document.querySelector("[data-mint]"),
  mintStatus: document.querySelector("[data-mint-status]"),
  activity: document.querySelector("[data-activity]"),
  activityPanel: document.querySelector("[data-activity-panel]"),
  activityToggle: document.querySelector("[data-activity-toggle]"),
  carouselTrack: document.querySelector("[data-card-track]"),
  carouselPrev: document.querySelector("[data-carousel-prev]"),
  carouselNext: document.querySelector("[data-carousel-next]"),
  carouselCards: [],
  feeAddAmount: document.querySelector("[data-fee-add-amount]"),
  feeRemoveAmount: document.querySelector("[data-fee-remove-amount]"),
  feeAddButton: document.querySelector("[data-fee-add]"),
  feeRemoveButton: document.querySelector("[data-fee-remove]"),
  feeAddStatus: document.querySelector("[data-fee-add-status]"),
  feeRemoveStatus: document.querySelector("[data-fee-remove-status]"),
  feeReserveCombined: Array.from(
    document.querySelectorAll("[data-fee-reserve]")
  ),
  feeBalance: Array.from(document.querySelectorAll("[data-fee-balance]")),
  feeLpBalance: Array.from(document.querySelectorAll("[data-fee-lp-balance]")),
  feeAddPanel: document.querySelector("[data-fee-add-panel]"),
  feeRemovePanel: document.querySelector("[data-fee-remove-panel]"),
  alphaAmountButtons: Array.from(
    document.querySelectorAll("[data-alpha-amount]")
  ),
  alphaRecipientInput: document.querySelector("[data-alpha-recipient]"),
  alphaSendButton: document.querySelector("[data-alpha-send]"),
  alphaStatus: document.querySelector("[data-alpha-status]"),
  alphaTransferPanel: document.querySelector("[data-alpha-transfer-panel]"),
};

function truncateAddress(address) {
  if (!address) return "";
  const raw = typeof address === "string" ? address : String(address);
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function truncateValue(value) {
  if (!value) return "";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function setMessage(key, message, txHash) {
  if (!state.messages) {
    state.messages = {
      create: "Awaiting input",
      grant: "Waiting for stablecoin",
      mint: "Awaiting issuer role",
    };
  }
  state.messages[key] = message;
  const target =
    key === "create"
      ? elements.createStatus
      : key === "grant"
        ? elements.grantStatus
        : elements.mintStatus;
  if (!target) return;
  target.textContent = message;
  if (txHash) {
    const spacer = document.createTextNode(" | ");
    const link = document.createElement("a");
    link.href = `https://explore.tempo.xyz/tx/${txHash}`;
    link.textContent = "TX";
    link.target = "_blank";
    link.rel = "noreferrer";
    target.append(spacer, link);
  }
}

function setLiquidityStatus(type, message, txHash) {
  const target =
    type === "add" ? elements.feeAddStatus : elements.feeRemoveStatus;
  if (!target) return;
  target.textContent = message;
  if (txHash) {
    const spacer = document.createTextNode(" | ");
    const link = document.createElement("a");
    link.href = `https://explore.tempo.xyz/tx/${txHash}`;
    link.textContent = "TX";
    link.target = "_blank";
    link.rel = "noreferrer";
    target.append(spacer, link);
  }
}

function setAlphaStatus(message, txHash) {
  if (!elements.alphaStatus) return;
  elements.alphaStatus.textContent = message;
  if (txHash) {
    const spacer = document.createTextNode(" | ");
    const link = document.createElement("a");
    link.href = `https://explore.tempo.xyz/tx/${txHash}`;
    link.textContent = "TX";
    link.target = "_blank";
    link.rel = "noreferrer";
    elements.alphaStatus.append(spacer, link);
  }
}

function logActivity(message) {
  if (!elements.activity) return;
  const item = document.createElement("li");
  const text = document.createElement("span");
  const time = document.createElement("time");
  const stamp = new Date();
  time.textContent = stamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  text.textContent = message;
  item.append(text, time);
  elements.activity.prepend(item);
}

function logTxActivity(label, hash) {
  if (!elements.activity) return;
  const item = document.createElement("li");
  const text = document.createElement("span");
  const link = document.createElement("a");
  const time = document.createElement("time");
  const stamp = new Date();
  const explorerUrl = `https://explore.tempo.xyz/tx/${hash}`;
  time.textContent = stamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  text.textContent = `${label} `;
  link.href = explorerUrl;
  link.textContent = hash;
  link.target = "_blank";
  link.rel = "noreferrer";
  text.append(link);
  item.append(text, time);
  elements.activity.prepend(item);
}

function fireConfetti() {
  confetti({
    particleCount: 320,
    spread: 100,
    startVelocity: 55,
    scalar: 1.35,
    ticks: 320,
    gravity: 0.8,
    colors: ["#0c0c0c", "#262626", "#5f5f5f", "#bcbcbc"],
    origin: { y: 0.7 },
  });
}

function getPredictedTokenAddress(sender, salt) {
  const packed = solidityPacked(["address", "bytes32"], [sender, salt]);
  const hash = keccak256(packed).slice(2);
  const lowerBytes = hash.slice(0, 16);
  return `0x${TIP20_PREFIX}${lowerBytes}`.toLowerCase();
}

function getIssuerRoleHash() {
  return keccak256(toUtf8Bytes("ISSUER_ROLE"));
}

function findTokenCreatedLog(receipt) {
  if (!receipt?.logs) return null;
  for (const log of receipt.logs) {
    if (!log?.address) continue;
    if (log.address.toLowerCase() !== TIP20_FACTORY_ADDRESS.toLowerCase()) {
      continue;
    }
    try {
      const parsed = tip20FactoryInterface.parseLog(log);
      if (parsed?.name === "TokenCreated") {
        return parsed.args?.token || null;
      }
    } catch (error) {
      // Ignore non-matching logs.
    }
  }
  return null;
}

function normalizeStablecoinRecord(record) {
  return {
    stablecoinId: String(record?.stablecoinId || "").toLowerCase(),
    name: String(record?.name || "").trim(),
    ticker: String(record?.ticker || "").trim().toUpperCase(),
    createdAt: record?.createdAt ? String(record.createdAt) : null,
    issuerRoleGranted: Boolean(record?.issuerRoleGranted),
  };
}

function setSelectedStablecoin(stablecoinId, { silent = false } = {}) {
  const normalized = stablecoinId ? stablecoinId.toLowerCase() : "";
  const selected = state.managedStablecoins.find(
    (coin) => coin.stablecoinId === normalized
  );
  state.selectedStablecoinId = selected ? selected.stablecoinId : null;
  state.stablecoin = selected
    ? {
        id: selected.stablecoinId,
        name: selected.name,
        ticker: selected.ticker,
        issuerRoleGranted: selected.issuerRoleGranted,
      }
    : null;
  state.feeLiquidity.pool = null;
  state.feeLiquidity.lpBalance = null;
  state.feeLiquidity.balance = null;
  state.feeLiquidity.addStatusLocked = false;
  state.feeLiquidity.removeStatusLocked = false;
  state.alphaTransfer.poolReady = false;
  state.alphaTransfer.pending = false;
  state.alphaTransfer.statusLocked = false;

  if (state.stablecoin) {
    setMessage("grant", "Ready to grant issuer role");
    if (state.stablecoin.issuerRoleGranted) {
      setMessage("mint", "Ready to mint");
    } else {
      setMessage("mint", "Awaiting issuer role grant");
    }
    void loadAlphaPoolReady();
  } else {
    state.alphaTransfer.poolReady = false;
  }

  renderStablecoinOptions();
  if (!silent) updateUI();
}

function renderStablecoinOptions() {
  if (!elements.stablecoinSelect) return;
  const select = elements.stablecoinSelect;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.stablecoinsLoading
    ? "Loading stablecoins..."
    : "Select a stablecoin";
  select.append(placeholder);

  state.managedStablecoins.forEach((coin) => {
    const option = document.createElement("option");
    option.value = coin.stablecoinId;
    option.textContent = `${coin.ticker || "—"} · ${truncateValue(
      coin.stablecoinId
    )}`;
    select.append(option);
  });

  const hasItems = state.managedStablecoins.length > 0;
  select.disabled = !state.account || state.stablecoinsLoading || !hasItems;

  const selectedId =
    state.selectedStablecoinId &&
    state.managedStablecoins.some(
      (coin) => coin.stablecoinId === state.selectedStablecoinId
    )
      ? state.selectedStablecoinId
      : "";
  select.value = selectedId;
}

function clearManagedStablecoins() {
  state.managedStablecoins = [];
  state.selectedStablecoinId = null;
  state.stablecoin = null;
  state.stablecoinsLoading = false;
  state.feeLiquidity.pool = null;
  state.feeLiquidity.lpBalance = null;
  state.feeLiquidity.balance = null;
  state.feeLiquidity.loading = false;
  state.feeLiquidity.addStatusLocked = false;
  state.feeLiquidity.removeStatusLocked = false;
  state.alphaTransfer.poolReady = false;
  state.alphaTransfer.pending = false;
  state.alphaTransfer.statusLocked = false;
  renderStablecoinOptions();
}


async function loadManagedStablecoins() {
  if (!state.account) {
    clearManagedStablecoins();
    return;
  }
  state.stablecoinsLoading = true;
  renderStablecoinOptions();

  try {
    const url = new URL(`${API_BASE}/stablecoins`);
    url.searchParams.set("issuerAddress", state.account);
    url.searchParams.set("chainId", String(tempoModerato.id));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load stablecoins (${response.status})`);
    }
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    state.managedStablecoins = items.map(normalizeStablecoinRecord).filter(
      (item) => item.stablecoinId && item.name && item.ticker
    );
  } catch (error) {
    console.error("Failed to load managed stablecoins", error);
  } finally {
    state.stablecoinsLoading = false;
    renderStablecoinOptions();
    if (!state.selectedStablecoinId && state.managedStablecoins.length > 0) {
      setSelectedStablecoin(state.managedStablecoins[0].stablecoinId, {
        silent: true,
      });
    }
    updateUI();
  }
}

function formatLiquidityValue(value) {
  if (value === null || value === undefined) return "—";
  return formatUnits(value, 6);
}


async function loadFeeLiquidityData() {
  if (!state.account || !state.stablecoin?.id) {
    state.feeLiquidity.pool = null;
    state.feeLiquidity.lpBalance = null;
    state.feeLiquidity.balance = null;
    updateUI();
    return;
  }
  if (state.feeLiquidity.loading) return;
  state.feeLiquidity.loading = true;
  updateUI();

  try {
    const pool = await Actions.amm.getPool(config, {
      userToken: state.stablecoin.id,
      validatorToken: state.feeLiquidity.validatorToken,
      chainId: tempoModerato.id,
    });
    const balance = await Actions.amm.getLiquidityBalance(config, {
      address: state.account,
      userToken: state.stablecoin.id,
      validatorToken: state.feeLiquidity.validatorToken,
      chainId: tempoModerato.id,
    });
    const publicClient = getPublicClient(config);
    if (publicClient) {
      const feeBalance = await publicClient.call({
        to: state.feeLiquidity.validatorToken,
        data: tip20Interface.encodeFunctionData("balanceOf", [state.account]),
      });
      const decoded = tip20Interface.decodeFunctionResult(
        "balanceOf",
        feeBalance.data
      );
      state.feeLiquidity.balance = Array.isArray(decoded) ? decoded[0] : decoded;
    }
    state.feeLiquidity.pool = pool;
    state.feeLiquidity.lpBalance = balance;
  } catch (error) {
    console.error("Failed to load fee liquidity data", error);
    state.feeLiquidity.pool = null;
    state.feeLiquidity.lpBalance = null;
    state.feeLiquidity.balance = null;
  } finally {
    state.feeLiquidity.loading = false;
    await loadAlphaPoolReady();
    updateUI();
  }
}

async function persistManagedStablecoin(stablecoin) {
  if (!state.account || !stablecoin?.id) return;
  const payload = {
    issuerAddress: state.account,
    stablecoinId: stablecoin.id,
    name: stablecoin.name,
    ticker: stablecoin.ticker,
    chainId: tempoModerato.id,
    createdAt: new Date().toISOString(),
  };

  const response = await fetch(`${API_BASE}/stablecoins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to store stablecoin (${response.status})`);
  }
}

async function markIssuerRoleGranted(stablecoinId, issuerRoleGranted) {
  if (!state.account || !stablecoinId) return;
  const response = await fetch(`${API_BASE}/stablecoins/${stablecoinId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      issuerAddress: state.account,
      chainId: tempoModerato.id,
      issuerRoleGranted,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update issuer role (${response.status})`);
  }

  const normalizedId = stablecoinId.toLowerCase();
  const entry = state.managedStablecoins.find(
    (coin) => coin.stablecoinId === normalizedId
  );
  if (entry) {
    entry.issuerRoleGranted = Boolean(issuerRoleGranted);
  }
  if (state.stablecoin?.id?.toLowerCase() === normalizedId) {
    state.stablecoin.issuerRoleGranted = Boolean(issuerRoleGranted);
  }
  updateUI();
}

async function requestFaucetFunds(address) {
  const response = await fetch("https://rpc.moderato.tempo.xyz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tempo_fundAddress",
      params: [address],
    }),
  });

  if (!response.ok) {
    throw new Error(`Faucet request failed (${response.status})`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message || "Faucet request failed");
  }
  return result.result;
}


async function fundAccount(address, { silent = false } = {}) {
  state.authPending = true;
  state.authMessage = "Funding account...";
  if (!silent) {
    state.faucetWarning = null;
  }
  updateUI();

  try {
    await requestFaucetFunds(address);
    logActivity("Faucet funded.");
    state.faucetWarning = null;
  } catch (error) {
    console.error("Faucet funding failed", error);
    state.faucetWarning = "Faucet funding failed";
    logActivity("Faucet funding failed.");
  } finally {
    state.authPending = false;
    state.authMessage = null;
    updateUI();
  }
}

async function addFeeLiquidity() {
  if (!(await ensureSignedIn())) {
    setLiquidityStatus("add", "Sign in to continue");
    return;
  }
  if (!state.stablecoin?.id) {
    setLiquidityStatus("add", "Select a stablecoin");
    return;
  }

  const amount = Number(elements.feeAddAmount?.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    setLiquidityStatus("add", "Enter a valid amount");
    return;
  }

  state.feeLiquidity.adding = true;
  setLiquidityStatus("add", "Awaiting passkey confirmation");
  updateUI();

  try {
    const walletClient = await getWalletClientInstance();
    if (state.feeLiquidity.balance !== null) {
      const required = parseUnits(String(amount), 6);
      if (state.feeLiquidity.balance < required) {
        setLiquidityStatus("add", "Insufficient pathUSD balance");
        state.feeLiquidity.adding = false;
        updateUI();
        return;
      }
    }

    const result = await TempoActions.amm.mintSync(walletClient, {
      account: walletClient.account,
      userTokenAddress: state.stablecoin.id,
      validatorTokenAddress: state.feeLiquidity.validatorToken,
      validatorTokenAmount: parseUnits(String(amount), 6),
      to: state.account,
    });

    const hash = result.receipt?.transactionHash;
    setLiquidityStatus("add", "Liquidity added", hash);
    state.feeLiquidity.addStatusLocked = true;
    logActivity("feeAMM liquidity added.");
    fireConfetti();
    await loadFeeLiquidityData();
  } catch (error) {
    console.error("Add fee liquidity failed", error);
    setLiquidityStatus("add", "Add liquidity failed");
    logActivity("feeAMM add liquidity failed.");
  } finally {
    state.feeLiquidity.adding = false;
    updateUI();
  }
}

async function removeFeeLiquidity() {
  if (!(await ensureSignedIn())) {
    setLiquidityStatus("remove", "Sign in to continue");
    return;
  }
  if (!state.stablecoin?.id) {
    setLiquidityStatus("remove", "Select a stablecoin");
    return;
  }

  const amount = Number(elements.feeRemoveAmount?.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    setLiquidityStatus("remove", "Enter a valid amount");
    return;
  }

  state.feeLiquidity.removing = true;
  setLiquidityStatus("remove", "Awaiting passkey confirmation");
  updateUI();

  try {
    const walletClient = await getWalletClientInstance();
    const result = await TempoActions.amm.burnSync(walletClient, {
      account: walletClient.account,
      userToken: state.stablecoin.id,
      validatorToken: state.feeLiquidity.validatorToken,
      liquidity: parseUnits(String(amount), 6),
      to: state.account,
    });

    const hash = result.receipt?.transactionHash;
    setLiquidityStatus("remove", "Liquidity removed", hash);
    state.feeLiquidity.removeStatusLocked = true;
    logActivity("feeAMM liquidity removed.");
    fireConfetti();
    await loadFeeLiquidityData();
  } catch (error) {
    console.error("Remove fee liquidity failed", error);
    setLiquidityStatus("remove", "Remove liquidity failed");
    logActivity("feeAMM remove liquidity failed.");
  } finally {
    state.feeLiquidity.removing = false;
    updateUI();
  }
}

async function loadAlphaPoolReady() {
  if (!state.stablecoin?.id) {
    state.alphaTransfer.poolReady = false;
    return;
  }
  try {
    const pool = await Actions.amm.getPool(config, {
      userToken: state.stablecoin.id,
      validatorToken: PATH_USD_TOKEN,
      chainId: tempoModerato.id,
    });
    state.alphaTransfer.poolReady =
      pool.reserveValidatorToken > 0n || pool.totalSupply > 0n;
  } catch (error) {
    console.error("Failed to load AlphaUSD pool", error);
    state.alphaTransfer.poolReady = false;
  } finally {
    updateUI();
  }
}

async function sendAlphaUsd() {
  if (!(await ensureSignedIn())) {
    setAlphaStatus("Sign in to continue");
    return;
  }
  if (!state.stablecoin?.id) {
    setAlphaStatus("Select a stablecoin for fees");
    return;
  }
  if (!state.alphaTransfer.poolReady) {
    setAlphaStatus("Pool needs liquidity with pathUSD");
    return;
  }

  const recipient = elements.alphaRecipientInput?.value.trim() || "";
  if (!isAddress(recipient)) {
    setAlphaStatus("Enter a valid address");
    return;
  }

  const amount = state.alphaTransfer.amount;
  state.alphaTransfer.pending = true;
  setAlphaStatus("Awaiting passkey confirmation");
  updateUI();

  try {
    const transferData = tip20TokenInterface.encodeFunctionData("transfer", [
      recipient,
      parseUnits(String(amount), 6),
    ]);
    const hash = await sendTransaction({
      to: ALPHA_USD_TOKEN,
      data: transferData,
      feeToken: state.stablecoin.id,
    });
    setAlphaStatus("AlphaUSD sent", hash);
    state.alphaTransfer.statusLocked = true;
    logActivity("AlphaUSD transfer submitted.");
    fireConfetti();
  } catch (error) {
    console.error("AlphaUSD transfer failed", error);
    setAlphaStatus("Transfer failed");
    logActivity("AlphaUSD transfer failed.");
  } finally {
    state.alphaTransfer.pending = false;
    updateUI();
  }
}

function addManagedStablecoin(stablecoin) {
  if (!stablecoin?.id) return;
  const normalizedId = stablecoin.id.toLowerCase();
  const record = {
    stablecoinId: normalizedId,
    name: stablecoin.name,
    ticker: stablecoin.ticker,
    createdAt: new Date().toISOString(),
    issuerRoleGranted: Boolean(stablecoin.issuerRoleGranted),
  };

  const existingIndex = state.managedStablecoins.findIndex(
    (coin) => coin.stablecoinId === normalizedId
  );
  if (existingIndex === -1) {
    state.managedStablecoins = [record, ...state.managedStablecoins];
  } else {
    state.managedStablecoins[existingIndex] = {
      ...state.managedStablecoins[existingIndex],
      ...record,
    };
  }
  setSelectedStablecoin(normalizedId);
  renderStablecoinOptions();
  updateUI();
}

async function getWalletClientInstance() {
  const client = await getWalletClient(config);
  if (!client) throw new Error("No passkey wallet client");
  return client;
}

function updateCarousel() {
  const track = elements.carouselTrack;
  if (!track) return;
  const cards = Array.from(track.querySelectorAll("[data-card]"));
  if (cards.length === 0) return;
  const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
  const viewport = track.parentElement;
  const viewportWidth = viewport?.getBoundingClientRect().width || 0;
  if (!viewportWidth) return;
  const cardWidth = (viewportWidth - gap * 2) / 3;
  const maxIndex = Math.max(0, cards.length - 3);
  if (state.carouselIndex > maxIndex) state.carouselIndex = maxIndex;
  const offset = (cardWidth + gap) * state.carouselIndex;
  track.style.transform = `translate3d(-${offset}px, 0, 0)`;
  if (elements.carouselPrev) {
    elements.carouselPrev.disabled = state.carouselIndex <= 0;
  }
  if (elements.carouselNext) {
    elements.carouselNext.disabled = state.carouselIndex >= maxIndex;
  }
}

async function sendTransaction({ to, data, value, feeToken }) {
  const client = await getWalletClientInstance();
  const from = client.account?.address;
  if (!from) throw new Error("No connected account");
  if (from !== state.account) {
    state.account = from;
    updateUI();
  }
  return client.sendTransaction({
    account: client.account,
    to,
    data,
    value,
    feeToken: feeToken || DEFAULT_FEE_TOKEN,
  });
}

async function waitForReceipt(hash, { timeoutMs = 60000, pollMs = 1500 } = {}) {
  const publicClient = getPublicClient(config);
  if (!publicClient) return null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt) return receipt;
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes("unsupported")) return null;
        if (message.includes("not found") || message.includes("receipt")) {
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          continue;
        }
      }
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return null;
}

function syncMintRecipient() {
  if (!elements.mintRecipientInput) return;
  if (!state.account) {
    elements.mintRecipientInput.value = "";
    state.mintRecipientAccount = null;
    return;
  }
  if (state.mintRecipientAccount !== state.account) {
    elements.mintRecipientInput.value = state.account;
    state.mintRecipientAccount = state.account;
  }
}

function updateUI() {
  const connected = Boolean(state.isAuthenticated && state.account);
  const supported = state.passkeySupported;
  const pending = state.authPending;
  const hasManagedStablecoins = state.managedStablecoins.length > 0;
  const shouldShowGate = connected && !state.stablecoinsLoading && !hasManagedStablecoins;

  state.gateOpen = shouldShowGate;

  elements.providerLabel.textContent = "Authentication: passkey (Tempo Moderato)";

  elements.signupButton.disabled = !supported || connected || pending;
  elements.signinButton.disabled = !supported || connected || pending;
  elements.signupButton.hidden = connected;
  elements.signinButton.hidden = connected;
  elements.disconnectButton.hidden = !connected;
  elements.disconnectButton.disabled = pending;
  if (elements.faucetButton) {
    elements.faucetButton.hidden =
      !connected || pending || state.faucetWarning === null;
    elements.faucetButton.disabled = pending;
  }
  if (elements.stablecoinSelector) {
    elements.stablecoinSelector.hidden =
      !connected || !hasManagedStablecoins || shouldShowGate;
  }

  if (elements.createGate) {
    elements.createGate.hidden = !shouldShowGate;
    document.body.classList.toggle("modal-open", shouldShowGate);
  }

  if (!supported) {
    elements.status.textContent = "Passkeys not supported";
  } else if (pending) {
    elements.status.textContent =
      state.authMessage || "Waiting for passkey confirmation";
  } else if (connected && state.faucetWarning) {
    elements.status.textContent = state.faucetWarning;
  } else if (connected) {
    elements.status.textContent = "Signed in";
  } else {
    elements.status.textContent = "Not signed in";
  }

  if (connected) {
    elements.addressRow.hidden = false;
    elements.addressRow.style.display = "flex";
    elements.address.textContent = truncateAddress(state.account);
  } else {
    elements.addressRow.hidden = true;
    elements.addressRow.style.display = "none";
    elements.address.textContent = "—";
  }

  const hasStablecoin = Boolean(state.stablecoin?.id);
  const actionsBlocked = pending || shouldShowGate;
  const issuerRoleGranted = Boolean(state.stablecoin?.issuerRoleGranted);
  const actionState = state.actions || {
    creating: false,
    granting: false,
    minting: false,
  };

  if (elements.selectorPanel) {
    elements.selectorPanel.classList.toggle("panel--disabled", !connected);
  }
  if (elements.grantPanel) {
    elements.grantPanel.classList.toggle("panel--disabled", !connected);
  }
  if (elements.mintPanel) {
    elements.mintPanel.classList.toggle("panel--disabled", !connected);
  }

  elements.createButton.disabled = !connected || pending || actionState.creating;
  elements.grantButton.disabled =
    !connected || !hasStablecoin || actionsBlocked || actionState.granting;
  elements.mintButton.disabled =
    !connected ||
    !hasStablecoin ||
    actionsBlocked ||
    !issuerRoleGranted ||
    actionState.minting;

  if (elements.mintRecipientInput) {
    elements.mintRecipientInput.disabled =
      !connected || actionsBlocked || !issuerRoleGranted;
  }
  if (elements.mintAmountInput) {
    elements.mintAmountInput.disabled =
      !connected || actionsBlocked || !issuerRoleGranted;
  }

  elements.issuerAddress.textContent = state.account
    ? truncateAddress(state.account)
    : "—";
  elements.issuerStablecoin.textContent = state.stablecoin?.id
    ? `${state.stablecoin.ticker || "—"} · ${truncateValue(state.stablecoin.id)}`
    : "—";

  if (!connected) {
    setMessage("grant", "Sign in to continue");
    setMessage("mint", "Sign in to continue");
    setAlphaStatus("Sign in to continue");
  } else if (state.stablecoin?.issuerRoleGranted) {
    setMessage("grant", "Issuer role granted");
  }

  if (elements.selectedStablecoinId) {
    elements.selectedStablecoinId.textContent = "";
    if (state.stablecoin?.id) {
      const link = document.createElement("a");
      link.href = `https://explore.tempo.xyz/token/${state.stablecoin.id}`;
      link.textContent = truncateValue(state.stablecoin.id);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.title = state.stablecoin.id;
      elements.selectedStablecoinId.append(link);
    } else {
      elements.selectedStablecoinId.textContent = "—";
    }
  }

  if (elements.selectedStablecoinTicker) {
    elements.selectedStablecoinTicker.textContent = state.stablecoin?.ticker || "—";
  }

  const liquidityReady = connected && hasStablecoin && !actionsBlocked;
  if (!connected || !hasStablecoin) {
    state.feeLiquidity.addStatusLocked = false;
    state.feeLiquidity.removeStatusLocked = false;
  }
  const reserveUserText = state.feeLiquidity.loading
    ? "Loading..."
    : formatLiquidityValue(state.feeLiquidity.pool?.reserveUserToken);
  const reserveValidatorText = state.feeLiquidity.loading
    ? "Loading..."
    : formatLiquidityValue(state.feeLiquidity.pool?.reserveValidatorToken);
  const lpBalanceText = state.feeLiquidity.loading
    ? "Loading..."
    : formatLiquidityValue(state.feeLiquidity.lpBalance ?? null);
  const reserveCombinedText = state.feeLiquidity.loading
    ? "Loading..."
    : `${reserveUserText} / ${reserveValidatorText}`;
  const balanceText = state.feeLiquidity.loading
    ? "Loading..."
    : formatLiquidityValue(state.feeLiquidity.balance ?? null);

  elements.feeReserveCombined.forEach((node) => {
    node.textContent = reserveCombinedText;
  });
  elements.feeBalance.forEach((node) => {
    node.textContent = balanceText;
  });
  elements.feeLpBalance.forEach((node) => {
    node.textContent = lpBalanceText;
  });

  if (elements.feeAddPanel) {
    elements.feeAddPanel.classList.toggle("panel--disabled", !liquidityReady);
  }
  if (elements.feeRemovePanel) {
    elements.feeRemovePanel.classList.toggle("panel--disabled", !liquidityReady);
  }
  if (elements.feeAddButton) {
    const amountValue = Number(elements.feeAddAmount?.value || 0);
    const amountValid = Number.isFinite(amountValue) && amountValue > 0;
    const balanceReady =
      state.feeLiquidity.balance === null ||
      state.feeLiquidity.balance >= parseUnits(String(amountValue || 0), 6);
    elements.feeAddButton.disabled =
      !liquidityReady ||
      state.feeLiquidity.loading ||
      state.feeLiquidity.adding ||
      !amountValid ||
      !balanceReady;
  }
  if (elements.feeRemoveButton) {
    elements.feeRemoveButton.disabled =
      !liquidityReady || state.feeLiquidity.loading || state.feeLiquidity.removing;
  }
  if (elements.alphaSendButton) {
    const recipientValid = isAddress(
      elements.alphaRecipientInput?.value.trim() || ""
    );
    elements.alphaSendButton.disabled =
      !connected ||
      !hasStablecoin ||
      !recipientValid ||
      !state.alphaTransfer.poolReady ||
      state.alphaTransfer.pending;
  }

  if (elements.alphaTransferPanel) {
    elements.alphaTransferPanel.classList.toggle(
      "panel--disabled",
      !connected || !hasStablecoin
    );
  }

  if (!state.feeLiquidity.adding && !state.feeLiquidity.addStatusLocked) {
    const amountValue = Number(elements.feeAddAmount?.value || 0);
    const amountValid = Number.isFinite(amountValue) && amountValue > 0;
    const balanceEnough =
      state.feeLiquidity.balance === null ||
      state.feeLiquidity.balance >= parseUnits(String(amountValue || 0), 6);

    if (!connected) {
      setLiquidityStatus("add", "Sign in to continue");
    } else if (!hasStablecoin) {
      setLiquidityStatus("add", "Select a stablecoin");
    } else if (state.feeLiquidity.loading) {
      setLiquidityStatus("add", "Loading pool data");
    } else if (!amountValid) {
      setLiquidityStatus("add", "Enter a valid amount");
    } else if (!balanceEnough) {
      setLiquidityStatus("add", "Insufficient pathUSD balance");
    } else {
      setLiquidityStatus("add", "Ready to add liquidity");
    }
  }

  if (!state.feeLiquidity.removing && !state.feeLiquidity.removeStatusLocked) {
    if (!connected) {
      setLiquidityStatus("remove", "Sign in to continue");
    } else if (!hasStablecoin) {
      setLiquidityStatus("remove", "Select a stablecoin");
    } else if (state.feeLiquidity.loading) {
      setLiquidityStatus("remove", "Loading pool data");
    } else {
      setLiquidityStatus("remove", "Ready to remove liquidity");
    }
  }

  if (connected && hasStablecoin && !state.alphaTransfer.statusLocked) {
    if (!state.alphaTransfer.poolReady) {
      setAlphaStatus("Pool needs liquidity with pathUSD");
    } else if (!isAddress(elements.alphaRecipientInput?.value.trim() || "")) {
      setAlphaStatus("Enter a valid address");
    } else if (state.alphaTransfer.pending) {
      setAlphaStatus("Awaiting passkey confirmation");
    } else {
      setAlphaStatus("Ready to send");
    }
  }


  if (state.stablecoin?.issuerRoleGranted) {
    setMessage("grant", "Issuer role granted");
  }

  if (elements.grantTitle) {
    elements.grantTitle.textContent = state.stablecoin?.issuerRoleGranted
      ? "Remove Issuer Role"
      : "Grant Issuer Role";
  }

  elements.alphaAmountButtons.forEach((button) => {
    const value = Number(button.dataset.alphaAmount);
    button.classList.toggle("is-active", value === state.alphaTransfer.amount);
    button.disabled =
      !connected || !hasStablecoin || state.alphaTransfer.pending || !state.alphaTransfer.poolReady;
  });

  if (elements.grantButton) {
    elements.grantButton.textContent = state.stablecoin?.issuerRoleGranted
      ? "Remove Issuer Role"
      : "Grant Issuer Role";
  }

  renderStablecoinOptions();
  syncMintRecipient();
  updateCarousel();
}

function resetWorkflow() {
  state.stablecoin = null;
  setMessage("create", "Awaiting input");

  setMessage("grant", "Waiting for stablecoin");
  setMessage("mint", "Awaiting issuer role");
  if (elements.mintAmountInput) elements.mintAmountInput.value = "";
}

async function signUp() {
  if (!state.passkeySupported || state.authPending) return;
  state.authPending = true;
  state.authMessage = "Waiting for passkey confirmation";
  state.faucetWarning = null;
  updateUI();
  try {
    await connect(config, {
      connector: passkeyConnector,
      capabilities: { type: "sign-up" },
    });
    const { address } = getAccount(config);
    if (address) {
      state.isAuthenticated = true;
      localStorage.setItem(AUTH_STORAGE_KEY, "1");
      state.account = address;
      setMessage("create", "Awaiting input");
      logActivity("Passkey account created.");
      await fundAccount(address, { silent: true });
      await loadManagedStablecoins();
    }
  } catch (error) {
    console.error("Passkey sign up failed", error);
    elements.status.textContent = "Sign up cancelled";
  } finally {
    state.authPending = false;
    state.authMessage = null;
    updateUI();
  }
}

async function signIn() {
  if (!state.passkeySupported || state.authPending) return;
  state.authPending = true;
  state.authMessage = "Waiting for passkey confirmation";
  updateUI();
  try {
    await connect(config, {
      connector: passkeyConnector,
    });
    const { address } = getAccount(config);
    if (address) {
      state.isAuthenticated = true;
      localStorage.setItem(AUTH_STORAGE_KEY, "1");
      state.account = address;
      setMessage("create", "Awaiting input");
      logActivity("Signed in with passkey.");
      await loadManagedStablecoins();
    }
  } catch (error) {
    console.error("Passkey sign in failed", error);
    elements.status.textContent = "Sign in cancelled";
  } finally {
    state.authPending = false;
    state.authMessage = null;
    updateUI();
  }
}

function handleAccountChange(account) {
  const nextAccount = account || null;
  const allowAutoAuth = localStorage.getItem(AUTH_STORAGE_KEY) === "1";

  if (!state.isAuthenticated && !allowAutoAuth) {
    if (state.account) {
      state.account = null;
      clearManagedStablecoins();
      resetWorkflow();
      updateUI();
    }
    return;
  }

  if (!state.isAuthenticated && allowAutoAuth) {
    state.isAuthenticated = true;
  }

  if (nextAccount === state.account) {
    if (!nextAccount) {
      clearManagedStablecoins();
      resetWorkflow();
      updateUI();
    }
    return;
  }

  state.account = nextAccount;
  if (!nextAccount) {
  clearManagedStablecoins();
  resetWorkflow();
  if (elements.carouselTrack) {
    elements.carouselCards = Array.from(
      elements.carouselTrack.querySelectorAll("[data-card]")
    );
  }
  updateCarousel();

    updateUI();
    return;
  }
  updateUI();
  loadManagedStablecoins();
}

async function ensureSignedIn() {
  if (state.account) return true;
  await signIn();
  return Boolean(state.account);
}

async function disconnectWallet() {
  state.isAuthenticated = false;
  state.account = null;
  state.faucetWarning = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_WAGMI_STORAGE_KEY);
  clearManagedStablecoins();
  resetWorkflow();
  updateUI();
  logActivity("Signed out.");

  try {
    const { connector } = getAccount(config);
    if (connector?.disconnect) {
      await disconnect(config);
    }
  } catch (error) {
    console.error("Sign out failed", error);
  }
}

async function copyAddress() {
  if (!state.account) return;

  try {
    await navigator.clipboard.writeText(state.account);
    elements.status.textContent = "Address copied";
    setTimeout(updateUI, 1200);
  } catch (error) {
    console.error("Copy failed", error);
    elements.status.textContent = "Copy failed";
  }
}

async function createStablecoin(event) {
  event.preventDefault();
  if (!(await ensureSignedIn())) {
    setMessage("create", "Sign in or sign up to continue");
    return;
  }

  const name = elements.stablecoinNameInput.value.trim();
  const ticker = elements.stablecoinTickerInput.value.trim().toUpperCase();

  if (!name || !ticker) {
    setMessage("create", "Add name and ticker");
    return;
  }

  state.actions.creating = true;
  setMessage("create", "Awaiting passkey confirmation");
  updateUI();
  logActivity(`Creating ${name} (${ticker}).`);

  try {
    const salt = hexlify(crypto.getRandomValues(new Uint8Array(32)));
    const stablecoinId = getPredictedTokenAddress(state.account, salt);

    const createData = tip20FactoryInterface.encodeFunctionData("createToken", [
      name,
      ticker,
      DEFAULT_CURRENCY,
      DEFAULT_QUOTE_TOKEN,
      state.account,
      salt,
    ]);

    const hash = await sendTransaction({
      to: TIP20_FACTORY_ADDRESS,
      data: createData,
    });

    state.stablecoin = {
      id: stablecoinId,
      name,
      ticker,
    };

    state.lastTx.create = hash;
    setMessage("create", "Stablecoin submitted");
    logTxActivity("Transaction submitted:", hash);

    const receipt = await waitForReceipt(hash);
    const createdToken = findTokenCreatedLog(receipt);
    if (createdToken) {
      state.stablecoin.id = createdToken;
    }
    if (
      receipt?.status === "0x1" ||
      receipt?.status === 1 ||
      receipt?.status === "success"
    ) {
      setMessage("create", "Stablecoin created", state.lastTx.create);
      setMessage("grant", "Ready to grant issuer role");
      logActivity(
        `Stablecoin created: ${truncateValue(state.stablecoin.id || stablecoinId)}.`
      );
      fireConfetti();
      try {
        await persistManagedStablecoin(state.stablecoin);
        addManagedStablecoin(state.stablecoin);
      } catch (error) {
        console.error("Failed to store stablecoin", error);
      }
    } else if (receipt === null) {
      setMessage("create", "Submitted. Confirm in explorer.", state.lastTx.create);
    } else {
      setMessage("create", "Transaction pending");
    }
  } catch (error) {
    console.error("Create stablecoin failed", error);
    setMessage("create", "Create request failed");
    logActivity("Stablecoin creation failed.");
  } finally {
    state.actions.creating = false;
    updateUI();
  }
}

async function grantIssuerRole() {
  if (!(await ensureSignedIn())) {
    setMessage("grant", "Sign in or sign up to continue");
    return;
  }

  if (!state.stablecoin?.id) {
    setMessage("grant", "Create a stablecoin first");
    return;
  }

  state.actions.granting = true;
  setMessage("grant", "Awaiting passkey confirmation");
  updateUI();
  logActivity("Requesting issuer role grant.");

  try {
    const grantData = tip20TokenInterface.encodeFunctionData("grantRole", [
      getIssuerRoleHash(),
      state.account,
    ]);

    const hash = await sendTransaction({
      to: state.stablecoin.id,
      data: grantData,
    });

    state.lastTx.grant = hash;
    setMessage("grant", "Issuer role submitted");
    logTxActivity("Issuer role tx:", hash);

    const receipt = await waitForReceipt(hash);
    if (
      receipt?.status === "0x1" ||
      receipt?.status === 1 ||
      receipt?.status === "success"
    ) {
      setMessage("grant", "Issuer role granted", state.lastTx.grant);
      setMessage("mint", "Ready to mint");
      logActivity("Issuer role granted.");
      fireConfetti();
      try {
        await markIssuerRoleGranted(state.stablecoin.id, true);
      } catch (error) {
        console.error("Failed to update issuer role", error);
      }
    } else if (receipt === null) {
      setMessage("grant", "Submitted. Confirm in explorer.", state.lastTx.grant);
    } else {
      setMessage("grant", "Transaction pending");
    }
  } catch (error) {
    console.error("Grant issuer role failed", error);
    setMessage("grant", "Grant request failed");
    logActivity("Issuer role grant failed.");
  } finally {
    state.actions.granting = false;
    updateUI();
  }
}

async function revokeIssuerRole() {
  if (!(await ensureSignedIn())) {
    setMessage("grant", "Sign in or sign up to continue");
    return;
  }

  if (!state.stablecoin?.id) {
    setMessage("grant", "Select a stablecoin first");
    return;
  }

  state.actions.granting = true;
  setMessage("grant", "Awaiting passkey confirmation");
  updateUI();
  logActivity("Removing issuer role.");

  try {
    const revokeData = tip20TokenInterface.encodeFunctionData("revokeRole", [
      getIssuerRoleHash(),
      state.account,
    ]);

    const hash = await sendTransaction({
      to: state.stablecoin.id,
      data: revokeData,
    });

    state.lastTx.grant = hash;
    setMessage("grant", "Issuer role removal submitted");
    logTxActivity("Issuer role tx:", hash);

    const receipt = await waitForReceipt(hash);
    if (
      receipt?.status === "0x1" ||
      receipt?.status === 1 ||
      receipt?.status === "success"
    ) {
      setMessage("grant", "Issuer role removed", state.lastTx.grant);
      setMessage("mint", "Awaiting issuer role grant");
      logActivity("Issuer role removed.");
      fireConfetti();
      try {
        await markIssuerRoleGranted(state.stablecoin.id, false);
      } catch (error) {
        console.error("Failed to update issuer role", error);
      }
    } else if (receipt === null) {
      setMessage(
        "grant",
        "Submitted. Confirm in explorer.",
        state.lastTx.grant
      );
    } else {
      setMessage("grant", "Transaction pending");
    }
  } catch (error) {
    console.error("Revoke issuer role failed", error);
    setMessage("grant", "Remove request failed");
    logActivity("Issuer role removal failed.");
  } finally {
    state.actions.granting = false;
    updateUI();
  }
}

async function mintStablecoins(event) {
  event.preventDefault();
  if (!(await ensureSignedIn())) {
    setMessage("mint", "Sign in or sign up to continue");
    return;
  }

  if (!state.stablecoin?.id) {
    setMessage("mint", "Create a stablecoin first");
    return;
  }

  const amount = Number(elements.mintAmountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setMessage("mint", "Enter a valid amount");
    return;
  }

  if (!state.stablecoin?.issuerRoleGranted) {
    setMessage("mint", "Awaiting issuer role grant");
    return;
  }

  const recipient = elements.mintRecipientInput?.value.trim() || "";
  if (!isAddress(recipient)) {
    setMessage("mint", "Enter a valid recipient address");
    return;
  }

  state.actions.minting = true;
  setMessage("mint", "Awaiting passkey confirmation");
  updateUI();
  logActivity(
    `Minting ${amount} ${state.stablecoin.ticker || "units"} to ${truncateAddress(recipient)}.`
  );

  try {
    const mintData = tip20TokenInterface.encodeFunctionData("mint", [
      recipient,
      parseUnits(String(amount), 6),
    ]);

    const hash = await sendTransaction({
      to: state.stablecoin.id,
      data: mintData,
    });

    state.lastTx.mint = hash;
    setMessage("mint", "Mint submitted");
    logTxActivity("Mint tx:", hash);

    const receipt = await waitForReceipt(hash);
    if (
      receipt?.status === "0x1" ||
      receipt?.status === 1 ||
      receipt?.status === "success"
    ) {
      setMessage("mint", "Stablecoins minted", state.lastTx.mint);
      logActivity("Mint successful.");
      fireConfetti();
      if (state.stablecoin?.id) {
        setTimeout(() => {
          void loadTotalSupply(state.stablecoin.id);
        }, 1000);
      }
    } else if (receipt === null) {
      setMessage("mint", "Submitted. Confirm in explorer.", state.lastTx.mint);
    } else {
      setMessage("mint", "Transaction pending");
    }
  } catch (error) {
    console.error("Mint failed", error);
    setMessage("mint", "Mint request failed");
    logActivity("Mint failed.");
  } finally {
    state.actions.minting = false;
    updateUI();
  }
}

function updateActivityToggle(isExpanded) {
  if (!elements.activityPanel || !elements.activityToggle) return;
  elements.activityPanel.classList.toggle("is-collapsed", !isExpanded);
  elements.activityToggle.setAttribute("aria-expanded", String(isExpanded));
  elements.activityToggle.textContent = isExpanded ? "Hide Activity" : "Show Activity";
}

async function init() {
  state.passkeySupported = Boolean(window.PublicKeyCredential);
  state.isAuthenticated = localStorage.getItem(AUTH_STORAGE_KEY) === "1";
  state.account = null;
  state.authPending = false;
  state.authMessage = null;
  state.faucetWarning = null;
  state.messages = {
    create: "Awaiting input",
    grant: "Waiting for stablecoin",
    mint: "Awaiting issuer role",
  };
  state.lastTx = {
    create: null,
    grant: null,
    mint: null,
  };
  state.alphaTransfer.amount = 50;
  state.alphaTransfer.pending = false;
  state.alphaTransfer.poolReady = false;
  state.alphaTransfer.statusLocked = false;
  clearManagedStablecoins();
  resetWorkflow();

  if (state.isAuthenticated) {
    try {
      await reconnect(config);
    } catch (error) {
      console.error("Reconnect failed", error);
    }
  }

  const initialAccount = getAccount(config);
  if (initialAccount?.address) {
    handleAccountChange(initialAccount.address);
  } else if (state.isAuthenticated) {
    state.isAuthenticated = false;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  watchAccount(config, {
    onChange: (account) => {
      handleAccountChange(account.address);
    },
  });

  elements.signupButton.addEventListener("click", signUp);
  elements.signinButton.addEventListener("click", signIn);
  elements.disconnectButton.addEventListener("click", disconnectWallet);
  elements.copyButton.addEventListener("click", copyAddress);
  if (elements.gateLogoutButton) {
    elements.gateLogoutButton.addEventListener("click", disconnectWallet);
  }
  if (elements.faucetButton) {
    elements.faucetButton.addEventListener("click", async () => {
      if (!state.account || state.authPending) return;
      await fundAccount(state.account);
    });
  }
  if (elements.stablecoinSelect) {
    elements.stablecoinSelect.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      setSelectedStablecoin(target.value);
    });
  }

  if (elements.feeAddButton) {
    elements.feeAddButton.addEventListener("click", addFeeLiquidity);
  }
  if (elements.feeRemoveButton) {
    elements.feeRemoveButton.addEventListener("click", removeFeeLiquidity);
  }
  if (elements.feeAddAmount) {
    elements.feeAddAmount.addEventListener("input", () => {
      state.feeLiquidity.addStatusLocked = false;
      void loadFeeLiquidityData();
    });
  }
  if (elements.feeRemoveAmount) {
    elements.feeRemoveAmount.addEventListener("input", () => {
      state.feeLiquidity.removeStatusLocked = false;
    });
  }
  elements.alphaAmountButtons.forEach((button) => {
    if (Number(button.dataset.alphaAmount) === state.alphaTransfer.amount) {
      button.classList.add("is-active");
    }
    button.addEventListener("click", () => {
      const value = Number(button.dataset.alphaAmount);
      if (!Number.isFinite(value)) return;
      state.alphaTransfer.amount = value;
      state.alphaTransfer.statusLocked = false;
      elements.alphaAmountButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });
      setAlphaStatus("Ready to send");
      updateUI();
    });
  });
  if (elements.alphaRecipientInput) {
    elements.alphaRecipientInput.value = DEFAULT_ALPHA_RECIPIENT;
    elements.alphaRecipientInput.addEventListener("input", () => {
      state.alphaTransfer.statusLocked = false;
      setAlphaStatus("Ready to send");
      updateUI();
    });
  }
  if (elements.alphaSendButton) {
    elements.alphaSendButton.addEventListener("click", sendAlphaUsd);
  }
  elements.createForm.addEventListener("submit", createStablecoin);
  elements.grantButton.addEventListener("click", () => {
    if (state.stablecoin?.issuerRoleGranted) {
      revokeIssuerRole();
    } else {
      grantIssuerRole();
    }
  });
  elements.mintForm.addEventListener("submit", mintStablecoins);
  [elements.mintRecipientInput, elements.mintAmountInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      if (state.stablecoin?.issuerRoleGranted) {
        setMessage("mint", "Ready to mint");
      } else {
        setMessage("mint", "Awaiting issuer role grant");
      }
    });
  });
  elements.stablecoinTickerInput.addEventListener("input", (event) => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  if (elements.carouselPrev) {
    elements.carouselPrev.addEventListener("click", () => {
      state.carouselIndex = Math.max(0, state.carouselIndex - 1);
      updateCarousel();
    });
  }
  if (elements.carouselNext) {
    elements.carouselNext.addEventListener("click", () => {
      state.carouselIndex = state.carouselIndex + 1;
      updateCarousel();
    });
  }
  window.addEventListener("resize", updateCarousel);
  requestAnimationFrame(updateCarousel);
  setTimeout(updateCarousel, 50);

  if (elements.activityToggle) {
    elements.activityToggle.addEventListener("click", () => {
      const isExpanded = elements.activityToggle.getAttribute("aria-expanded") === "true";
      updateActivityToggle(!isExpanded);
    });
  }
  updateActivityToggle(false);

  updateUI();
}

init();
