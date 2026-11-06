/*
 * Plainsign access: the free daily report limit and token-holder tiers.
 *
 * Everything is stored in this browser only. The one network request is a
 * balanceOf() read on the configured RPC, which sends just the wallet address.
 */
(function (global) {
  'use strict';

  const CFG = global.PLAINSIGN_CONFIG;
  const USAGE_KEY = 'plainsign.usage';
  const WALLET_KEY = 'plainsign.wallet';
  const listeners = [];

  // ---------- storage (may be unavailable in private windows) ----------

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; }
  }
  function save(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage blocked: limits reset on reload, which is acceptable */ }
  }

  // ---------- daily limit ----------

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  let usage = load(USAGE_KEY);
  function currentUsage() {
    if (!usage || usage.day !== today() || !Array.isArray(usage.seen)) usage = { day: today(), seen: [] };
    return usage;
  }

  // Short fingerprint of an input, so re-checking the same request is free.
  function fingerprint(text) {
    let h = 5381;
    const s = String(text).trim();
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16) + ':' + s.length;
  }

  const remaining = () => Math.max(0, CFG.freeDailyReports - currentUsage().seen.length);

  // Returns true if a detailed report may be shown for this input, counting it if new.
  function useReport(input) {
    if (tier()) return true;
    const u = currentUsage();
    const id = fingerprint(input);
    if (u.seen.includes(id)) return true;
    if (u.seen.length >= CFG.freeDailyReports) return false;
    u.seen.push(id);
    save(USAGE_KEY, u);
    emit();
    return true;
  }

  // ---------- wallet + holdings ----------

  let wallet = load(WALLET_KEY); // { address, balance, tierId, checkedAt }
  let provider = null;
  let status = 'idle'; // idle | connecting | checking | ok | prelaunch | error | nowallet
  let lastError = '';

  // EIP-6963: wallets announce themselves; keep the first one, fall back to window.ethereum.
  const announced = [];
  global.addEventListener('eip6963:announceProvider', (e) => {
    if (e.detail && e.detail.provider) announced.push(e.detail);
  });
  global.dispatchEvent(new Event('eip6963:requestProvider'));
  const findProvider = () => (announced[0] && announced[0].provider) || global.ethereum || null;

  const tierFor = (wholeTokens) => CFG.tiers.find((t) => wholeTokens >= BigInt(t.min)) || null;
  function tier() {
    if (!wallet || !wallet.tierId) return null;
    return CFG.tiers.find((t) => t.id === wallet.tierId) || null;
  }

  async function readBalance(address) {
    const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0'); // balanceOf(address)
    const res = await fetch(CFG.token.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CFG.token.address, data }, 'latest'] }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'RPC error');
    return BigInt(json.result && json.result !== '0x' ? json.result : '0x0');
  }

  async function refresh() {
    if (!wallet) return;
    if (!CFG.token.address) {
      status = 'prelaunch';
      wallet = { address: wallet.address, balance: null, tierId: null, checkedAt: Date.now() };
      save(WALLET_KEY, wallet);
      emit();
      return;
    }
    status = 'checking';
    emit();
    try {
      const raw = await readBalance(wallet.address);
      const whole = raw / 10n ** BigInt(CFG.token.decimals);
      const t = tierFor(whole);
      wallet = { address: wallet.address, balance: whole.toString(), tierId: t ? t.id : null, checkedAt: Date.now() };
      save(WALLET_KEY, wallet);
      status = 'ok';
    } catch (e) {
      lastError = 'Could not reach ' + CFG.token.chainName + '. Try again in a moment.';
      status = 'error';
      // Keep a recent result rather than locking a holder out over a network blip.
      if (wallet.checkedAt && Date.now() - wallet.checkedAt > 60 * 60 * 1000) wallet.tierId = null;
    }
    emit();
  }

  async function connect() {
    provider = findProvider();
    if (!provider) {
      status = 'nowallet';
      emit();
      return;
    }
    status = 'connecting';
    emit();
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || !accounts[0]) throw new Error('No account');
      wallet = { address: accounts[0], balance: null, tierId: null, checkedAt: 0 };
      save(WALLET_KEY, wallet);
      watchAccounts();
      await refresh();
    } catch (e) {
      status = 'idle';
      lastError = e && e.code === 4001 ? 'Connection cancelled.' : 'Could not connect to your wallet.';
      emit();
    }
  }

  function disconnect() {
    wallet = null;
    save(WALLET_KEY, null);
    status = 'idle';
    emit();
  }

  let watching = false;
  function watchAccounts() {
    if (watching || !provider || !provider.on) return;
    watching = true;
    provider.on('accountsChanged', (accounts) => {
      if (!accounts || !accounts[0]) { disconnect(); return; }
      wallet = { address: accounts[0], balance: null, tierId: null, checkedAt: 0 };
      save(WALLET_KEY, wallet);
      refresh();
    });
  }

  // On load: only trust a saved address if the wallet still exposes it (no popup).
  async function restore() {
    if (!wallet) return;
    // Wallets announce shortly after load; give them a moment.
    await new Promise((r) => setTimeout(r, 300));
    provider = findProvider();
    if (!provider) { disconnect(); return; }
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      const match = (accounts || []).find((a) => a.toLowerCase() === wallet.address.toLowerCase());
      if (!match) { disconnect(); return; }
      watchAccounts();
      const stale = Date.now() - (wallet.checkedAt || 0) > CFG.recheckMinutes * 60 * 1000;
      if (stale || !CFG.token.address) await refresh();
      else { status = 'ok'; emit(); }
    } catch (e) {
      disconnect();
    }
  }

  setInterval(() => { if (wallet && status !== 'checking') refresh(); }, CFG.recheckMinutes * 60 * 1000);

  // ---------- events ----------

  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } }); }

  global.PlainsignAccess = {
    config: CFG,
    remaining,
    useReport,
    tier,
    connect,
    disconnect,
    refresh,
    state: () => ({ wallet, status, error: lastError, tier: tier(), remaining: remaining() }),
    onChange: (fn) => listeners.push(fn),
  };

  restore();
})(typeof window !== 'undefined' ? window : globalThis);
