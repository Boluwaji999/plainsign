/*
 * Plainsign decoder — turns wallet signature requests and transactions into
 * plain English with a risk level. Runs entirely in the browser: no network
 * calls, no API keys, no tracking.
 */
(function (global) {
  'use strict';

  const LEVELS = { info: -1, safe: 0, caution: 1, danger: 2 };
  const UNLIMITED = 2n ** 100n; // far above any real token balance
  const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
  const ALL = 'all';

  // Well-known addresses come from known.js, indexed by lowercase address.
  // One address can have different meanings on different chains.
  const KNOWN = {};
  (global.PLAINSIGN_KNOWN || []).forEach((e) => {
    const key = String(e.address).toLowerCase();
    (KNOWN[key] = KNOWN[key] || []).push(e);
  });

  const CHAINS = {
    1: 'Ethereum', 10: 'Optimism', 56: 'BNB Chain', 100: 'Gnosis', 137: 'Polygon', 8453: 'Base',
    42161: 'Arbitrum One', 43114: 'Avalanche', 11155111: 'Sepolia testnet',
  };

  // selector -> [name, number of 32-byte argument words]
  const SELECTORS = {
    '095ea7b3': ['approve', 2],
    '39509351': ['increaseAllowance', 2],
    'a22cb465': ['setApprovalForAll', 2],
    'a9059cbb': ['transfer', 2],
    '23b872dd': ['transferFrom', 3],
    '42842e0e': ['safeTransferFrom', 3],
    'b88d4fde': ['safeTransferFrom', 3],
    'd505accf': ['permit', 7],
    '87517c45': ['permit2Approve', 4],
  };

  // ---------- helpers ----------

  const lc = (s) => String(s == null ? '' : s).toLowerCase();
  const isAddr = (s) => /^0x[0-9a-fA-F]{40}$/.test(String(s));
  const isHex = (s) => /^0x[0-9a-fA-F]*$/.test(String(s));
  const short = (a) => (isAddr(a) ? a.slice(0, 6) + '…' + a.slice(-4) : String(a));

  function toBig(v) {
    try {
      if (typeof v === 'bigint') return v;
      if (typeof v === 'boolean') return v ? 1n : 0n;
      if (typeof v === 'number') return BigInt(Math.trunc(v));
      const s = String(v).trim();
      return s === '' ? null : BigInt(s);
    } catch (e) {
      return null;
    }
  }
  const num = (v) => { const b = toBig(v); return b === null ? undefined : Number(b); };

  function lookup(addr, chainId) {
    const entries = KNOWN[lc(addr)] || [];
    return entries.find((k) => k.chains === ALL || chainId === undefined || k.chains.includes(chainId)) || null;
  }
  const label = (addr, chainId) => { const k = lookup(addr, chainId); return k ? `${k.name} (${short(addr)})` : short(addr); };
  const tokenName = (addr, chainId) => {
    if (!addr) return 'tokens';
    const k = lookup(addr, chainId);
    return k ? (k.symbol || k.name) : `token ${short(addr)}`;
  };
  const chainName = (id) => (CHAINS[id] ? `${CHAINS[id]} (chain ${id})` : `chain ${id}`);

  function fmtUnits(v, decimals) {
    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = (v % base).toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
    if (whole === 0n && !frac && v > 0n) return '< 0.000001';
    return whole.toLocaleString('en-US') + (frac ? '.' + frac : '');
  }
  const fmtEth = (v) => `${fmtUnits(toBig(v) ?? 0n, 18)} ETH`;

  function formatAmount(raw, token, chainId) {
    const v = toBig(raw);
    const name = tokenName(token, chainId);
    if (v === null) return `${raw} ${name}`;
    if (v >= UNLIMITED) return `UNLIMITED ${name}`;
    const k = token ? lookup(token, chainId) : null;
    if (k && k.decimals != null) return `${fmtUnits(v, k.decimals)} ${name}`;
    return `${v.toString()} units of ${name}`;
  }

  // Unix-seconds timestamp -> { text, long } where long = more than a year away.
  function describeExpiry(raw) {
    const v = toBig(raw);
    if (v === null) return { text: String(raw), long: false };
    if (v >= 10n ** 12n) return { text: 'never (effectively forever)', long: true };
    const ms = Number(v) * 1000;
    const date = new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const days = (ms - Date.now()) / 864e5;
    if (days < 0) return { text: `${date} (already expired)`, long: false };
    const span = days > 730 ? `~${Math.round(days / 365)} years`
      : days > 60 ? `~${Math.round(days / 30)} months`
      : days >= 1 ? `~${Math.round(days)} days` : 'less than a day';
    return { text: `${date} (${span} from now)`, long: days > 365 };
  }

  function result(kind, title) {
    return { kind, title, summary: '', explain: '', findings: [], details: [], risk: 'safe' };
  }
  function flag(r, level, text) {
    r.findings.push({ level, text });
    if (LEVELS[level] > LEVELS[r.risk]) r.risk = level;
  }
  function detail(r, key, value) {
    r.details.push([key, String(value)]);
  }

  // Adds the spender / amount findings shared by every kind of approval.
  function approvalFindings(r, spender, amount, token, chainId) {
    const sp = lookup(spender, chainId);
    const unlimited = amount >= UNLIMITED;
    if (sp) flag(r, 'info', `Spender is a known contract: ${sp.name}.`);
    else flag(r, unlimited ? 'danger' : 'caution', `The spender ${short(spender)} is not a contract Plainsign recognises. Drainers use fresh, unknown addresses.`);
    if (unlimited) flag(r, sp ? 'caution' : 'danger', 'Unlimited amount — the spender can take your entire balance, now and in the future.');
    else flag(r, 'safe', `Limited to ${formatAmount(amount, token, chainId)}.`);
  }

  // ---------- entry points ----------

  function analyze(input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw) return null;
    if (raw[0] === '{' || raw[0] === '[') {
      let obj;
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        const r = result('error', 'This looks like JSON, but it is incomplete');
        r.summary = 'Make sure you copied the whole request, from the first { to the last }.';
        flag(r, 'caution', 'Could not read it: ' + e.message);
        return r;
      }
      return analyzeObject(obj);
    }
    if (isHex(raw)) return analyzeHex(raw, false);
    return analyzeText(raw, false);
  }

  function tryParse(s) {
    if (typeof s !== 'string') return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  }
  const asTypedData = (x) => {
    const o = typeof x === 'string' ? tryParse(x) : x;
    return o && typeof o === 'object' && o.types && (o.message || o.primaryType) ? o : null;
  };

  function analyzeObject(obj) {
    if (Array.isArray(obj)) {
      // Raw "params" arrays, e.g. [address, typedData] or [message, address]
      const td = obj.map(asTypedData).find(Boolean);
      if (td) return analyzeTypedData(td);
      const tx = obj.find((p) => p && typeof p === 'object' && ('data' in p || 'to' in p));
      if (tx) return analyzeTx(tx);
      const str = obj.find((p) => typeof p === 'string' && !isAddr(p));
      return str ? analyze(str) : unknownResult();
    }
    if (!obj || typeof obj !== 'object') return unknownResult();
    if (obj.method) return analyzeRpc(obj);
    if (asTypedData(obj)) return analyzeTypedData(obj);
    if (Array.isArray(obj.calls)) return analyzeCalls(obj.calls, obj.chainId);
    if ('data' in obj || 'to' in obj || 'input' in obj || 'authorizationList' in obj) return analyzeTx(obj);
    return unknownResult();
  }

  function analyzeRpc(req) {
    const m = String(req.method);
    const p = Array.isArray(req.params) ? req.params : [req.params];
    const firstString = () => p.find((x) => typeof x === 'string' && !isAddr(x));
    if (m.startsWith('eth_signTypedData')) {
      const td = p.map(asTypedData).find(Boolean);
      return td ? analyzeTypedData(td) : unknownResult();
    }
    if (m === 'eth_sign') return blindHash(firstString() || '', 'danger');
    if (m === 'personal_sign') {
      const msg = firstString() ?? String(p[0] ?? '');
      return isHex(msg) ? analyzeHex(msg, true) : analyzeText(msg, false);
    }
    if (m === 'eth_sendTransaction') return analyzeTx(p[0] || {});
    if (m === 'wallet_sendCalls') {
      const b = p[0] || {};
      return analyzeCalls(b.calls || [], b.chainId);
    }
    const r = result('unknown', `Wallet request: ${m}`);
    r.summary = 'Plainsign does not recognise this request type yet.';
    flag(r, 'caution', 'Unknown request type — treat it with care.');
    return r;
  }

  function unknownResult() {
    const r = result('unknown', 'Not recognised');
    r.summary = 'Plainsign could not work out what this is. Paste the full signature request, transaction, or message.';
    flag(r, 'caution', 'Unrecognised input — nothing was checked.');
    return r;
  }

  // ---------- hex: raw hashes, hex-encoded text, calldata ----------

  function hexToText(body) {
    if (!body.length || body.length % 2) return null;
    const bytes = new Uint8Array(body.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(body.substr(i * 2, 2), 16);
    let s;
    try { s = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { return null; }
    const chars = [...s];
    const printable = chars.filter((c) => c === '\n' || c === '\r' || c === '\t' || c >= ' ').length;
    return printable / chars.length > 0.95 ? s : null;
  }

  function analyzeHex(hex, fromPersonalSign) {
    const body = hex.slice(2);
    if (body.length === 64) return blindHash(hex, fromPersonalSign ? 'caution' : 'danger');
    if (body.length >= 8 && SELECTORS[body.slice(0, 8).toLowerCase()]) return analyzeTx({ data: hex });
    const text = hexToText(body);
    if (text) return analyzeText(text, true);
    if (body.length >= 8) return analyzeTx({ data: hex });
    return unknownResult();
  }

  function blindHash(hash, level) {
    const r = result('blind', 'Blind signature (raw hash)');
    r.summary = 'The site wants you to sign a raw 32-byte hash. You cannot see what it represents.';
    r.explain = 'A hash is a fingerprint of some hidden data — it can stand for a transaction that empties your wallet. Legitimate apps almost never need this. Reject unless you know exactly where the hash came from.';
    flag(r, level, level === 'danger'
      ? 'Raw hash signing (eth_sign) is the most dangerous request type and a classic drainer technique.'
      : 'You are signing an unreadable hash. Only continue if you fully trust the site.');
    detail(r, 'Hash', hash);
    return r;
  }

  // ---------- plain text messages ----------

  function analyzeText(text, wasHex) {
    const siwe = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(\S+) wants you to sign in with your Ethereum account:\r?\n(0x[0-9a-fA-F]{40})/.exec(text);
    if (siwe) {
      const domain = siwe[1];
      const r = result('siwe', 'Sign-In with Ethereum (login)');
      r.summary = `A login request from ${domain}. Signing it does not move funds or give any approvals.`;
      r.explain = 'This is a standard login message — it only proves you own the address. The one thing to check: a fake site can show a login for a domain it does not own, so make sure your address bar shows exactly this domain.';
      flag(r, 'safe', 'Standard login message — it cannot move tokens or NFTs.');
      flag(r, 'info', `Check that your browser's address bar shows: ${domain}`);
      detail(r, 'Requesting site', domain);
      detail(r, 'Your address', siwe[2]);
      const re = /^(URI|Version|Chain ID|Nonce|Issued At|Expiration Time|Request ID):\s*(.+)$/gm;
      let mm;
      while ((mm = re.exec(text))) {
        detail(r, mm[1], mm[2]);
        if (mm[1] === 'URI') {
          let host = null;
          try { host = new URL(mm[2]).host; } catch (e) { /* not a URL */ }
          if (host && host !== domain) flag(r, 'caution', `The login is for ${domain} but its URI points to ${host}.`);
        }
      }
      return r;
    }

    const r = result('message', 'Plain text message');
    r.summary = 'The site wants you to sign a readable text message.';
    r.explain = 'Signing plain text cannot move your tokens on-chain by itself. Still read it: some off-chain services treat signed text as permission, and scam sites use messages to make you "agree" to things.';
    flag(r, 'safe', 'Plain text cannot directly transfer on-chain assets.');
    const sensitive = /(approve|transfer|withdraw|permit|grant|authori[sz])/i.exec(text);
    if (sensitive) flag(r, 'caution', `The message mentions "${sensitive[0]}". Read it carefully.`);
    if (/(seed phrase|recovery phrase|secret phrase|private key|mnemonic)/i.test(text)) {
      flag(r, 'danger', 'The message mentions your seed phrase or private key. No legitimate site ever needs these.');
    }
    detail(r, 'Message', text.length > 2000 ? text.slice(0, 2000) + '…' : text);
    if (wasHex) detail(r, 'Note', 'Decoded from hex');
    return r;
  }

  // ---------- transactions ----------

  const words = (data) => {
    const b = data.slice(10);
    const out = [];
    for (let i = 0; i + 64 <= b.length; i += 64) out.push(b.slice(i, i + 64));
    return out;
  };
  const wAddr = (w) => '0x' + w.slice(24);
  const wUint = (w) => BigInt('0x' + w);

  function analyzeTx(tx, chainHint) {
    const data = lc(tx.data || tx.input || '0x');
    const to = isAddr(tx.to) ? tx.to : null;
    const chainId = tx.chainId != null ? num(tx.chainId) : chainHint;
    const value = toBig(tx.value || 0) || 0n;
    let r;
    if (Array.isArray(tx.authorizationList) && tx.authorizationList.length) r = delegation(tx.authorizationList, chainId);
    else if (data === '0x') r = nativeTransfer(to, value, chainId);
    else r = decodeCall(data, to, chainId);
    if (value > 0n && data !== '0x') flag(r, 'caution', `Also sends ${fmtEth(value)} to ${label(to, chainId)}.`);
    if (to) r.details.unshift(['Interacting with', label(to, chainId) + (lookup(to, chainId) ? '' : ' — not in the known list')]);
    if (chainId !== undefined) detail(r, 'Network', chainName(chainId));
    return r;
  }

  function nativeTransfer(to, value, chainId) {
    const r = result('transfer', 'Send ETH');
    if (value === 0n) {
      r.title = 'Empty transaction';
      r.summary = 'Sends nothing and calls no function.';
      flag(r, 'caution', 'Unusual — check why the site wants you to send this.');
      return r;
    }
    r.summary = `Sends ${fmtEth(value)} to ${label(to, chainId)}.`;
    r.explain = 'A plain transfer: only the amount shown leaves your wallet. Double-check every character of the recipient — scammers plant look-alike addresses that share the first and last few characters.';
    flag(r, 'safe', 'Simple transfer — nothing beyond this amount can leave your wallet.');
    flag(r, 'info', 'Compare the FULL address, not just the start and end.');
    return r;
  }

  function delegation(auths, chainId) {
    const r = result('7702', 'Turn your wallet into a smart account (EIP-7702)');
    const targets = auths.map((a) => a.address || a.contractAddress).filter(Boolean);
    r.summary = `Makes your wallet run code from ${targets.map((t) => label(t, chainId)).join(', ') || 'an unknown contract'}. That code gets full control of your account.`;
    r.explain = 'EIP-7702 lets a normal wallet run smart-contract code. Whoever wrote that code can move every token and NFT you own. Only do this from your wallet\'s own built-in upgrade screen — never because a website asked you to.';
    flag(r, 'danger', 'Delegation hands the target code full control of your wallet.');
    if (auths.some((a) => num(a.chainId) === 0)) flag(r, 'danger', 'Chain ID 0: this applies on EVERY network, not just this one.');
    targets.forEach((t, i) => detail(r, `Delegate ${i + 1}`, t));
    return r;
  }

  function analyzeCalls(calls, chainHint) {
    const chainId = num(chainHint);
    const r = result('batch', `Batch of ${calls.length} action${calls.length === 1 ? '' : 's'}`);
    r.summary = 'Several actions bundled into one confirmation. All of them happen if you approve.';
    r.explain = 'Batches can hide one harmful step between harmless ones. Every step is listed below.';
    if (!calls.length) flag(r, 'caution', 'The batch is empty.');
    calls.forEach((c, i) => {
      const s = analyzeTx(c || {}, chainId);
      flag(r, s.risk, `Step ${i + 1} — ${s.title}: ${s.summary}`);
      s.findings.filter((f) => LEVELS[f.level] >= LEVELS.caution).forEach((f) => flag(r, f.level, `Step ${i + 1}: ${f.text}`));
    });
    return r;
  }

  function decodeCall(data, to, chainId) {
    const sel = data.slice(2, 10);
    const entry = SELECTORS[sel];
    const w = words(data);
    if (!entry || w.length < entry[1]) return unknownCall(sel, data, to, chainId, entry && entry[0]);
    const name = entry[0];
    const tk = to ? lookup(to, chainId) : null;
    const r = result(name, '');

    if (name === 'approve' || name === 'increaseAllowance') {
      const spender = wAddr(w[0]);
      const amount = wUint(w[1]);
      if (tk && tk.nft) {
        r.title = 'Approve one NFT';
        r.summary = `Lets ${label(spender, chainId)} transfer your ${tk.name} #${amount}.`;
        r.explain = 'This gives another address permission to move one specific NFT.';
        if (lookup(spender, chainId)) flag(r, 'caution', 'Known marketplace contract — normal when listing an NFT.');
        else flag(r, 'danger', `Unknown address ${short(spender)} — it could take this NFT.`);
      } else if (amount === 0n) {
        r.title = 'Revoke token approval';
        r.summary = `Removes ${label(spender, chainId)}'s permission to spend your ${tokenName(to, chainId)}.`;
        r.explain = 'Setting an approval to zero cuts off access. This is a safety action.';
        flag(r, 'safe', 'Removes access — this protects you.');
      } else {
        const unlimited = amount >= UNLIMITED;
        r.title = name === 'approve' ? 'Token approval' : 'Increase token approval';
        r.summary = unlimited
          ? `Lets ${label(spender, chainId)} spend ALL your ${tokenName(to, chainId)} — no limit, no expiry.`
          : `Lets ${label(spender, chainId)} spend up to ${formatAmount(amount, to, chainId)} from your wallet.`;
        r.explain = 'An approval lets another address move your tokens later without asking you again. It stays active until you revoke it.';
        approvalFindings(r, spender, amount, to, chainId);
        if (!tk) flag(r, 'info', 'If this contract is an NFT collection, the number is an NFT ID rather than an amount.');
      }
      detail(r, 'Spender', spender);
      detail(r, 'Amount (raw)', amount.toString());
    } else if (name === 'setApprovalForAll') {
      const op = wAddr(w[0]);
      const on = wUint(w[1]) !== 0n;
      const coll = tk ? tk.name : to ? `collection ${short(to)}` : 'this collection';
      if (!on) {
        r.title = 'Revoke NFT collection approval';
        r.summary = `Removes ${label(op, chainId)}'s control over your ${coll} NFTs.`;
        flag(r, 'safe', 'Removes access — this protects you.');
      } else {
        r.title = 'Approve ALL NFTs in a collection';
        r.summary = `Gives ${label(op, chainId)} control over EVERY ${coll} NFT you own — now and in the future.`;
        r.explain = '"Set approval for all" is how marketplaces list NFTs — and the most common way NFTs get stolen. The operator can move every item in the collection at any time.';
        const known = lookup(op, chainId);
        if (known) flag(r, 'caution', `Operator is a known marketplace contract (${known.name}). Normal the first time you list, but it is still full control.`);
        else flag(r, 'danger', `Operator ${short(op)} is unknown. This is the classic NFT drain.`);
      }
      detail(r, 'Operator', op);
    } else if (name === 'transfer') {
      const rcpt = wAddr(w[0]);
      const amount = wUint(w[1]);
      r.title = 'Send tokens';
      r.summary = `Sends ${formatAmount(amount, to, chainId)} to ${label(rcpt, chainId)}.`;
      r.explain = 'A direct token transfer: only this amount leaves your wallet. Double-check the full recipient address — scammers plant look-alike addresses in your history.';
      flag(r, 'safe', 'Only the amount shown can leave your wallet.');
      flag(r, 'info', 'Compare the FULL recipient address, not just the first and last characters.');
      detail(r, 'Recipient', rcpt);
    } else if (name === 'transferFrom' || name === 'safeTransferFrom') {
      const from = wAddr(w[0]);
      const dest = wAddr(w[1]);
      const x = wUint(w[2]);
      const isNft = (tk && tk.nft) || name === 'safeTransferFrom';
      r.title = isNft ? 'Transfer NFT' : 'Transfer tokens';
      r.summary = `Moves ${isNft ? `${tk ? tk.name : 'NFT'} #${x}` : formatAmount(x, to, chainId)} from ${short(from)} to ${label(dest, chainId)}.`;
      r.explain = 'A direct transfer of a token or NFT to another address.';
      flag(r, 'caution', 'Check that the recipient is an address you control or intend to pay.');
      detail(r, 'From', from);
      detail(r, 'To', dest);
    } else if (name === 'permit') {
      const owner = wAddr(w[0]);
      const spender = wAddr(w[1]);
      const value = wUint(w[2]);
      r.title = 'Submit a token permit';
      r.summary = `Activates a permit letting ${label(spender, chainId)} spend ${value >= UNLIMITED ? 'ALL' : formatAmount(value, to, chainId)} of ${short(owner)}'s ${tokenName(to, chainId)}.`;
      r.explain = 'This puts a previously signed permit on-chain, turning it into a real approval.';
      approvalFindings(r, spender, value, to, chainId);
      detail(r, 'Deadline', describeExpiry(wUint(w[3])).text);
    } else if (name === 'permit2Approve') {
      const token = wAddr(w[0]);
      const spender = wAddr(w[1]);
      const amount = wUint(w[2]);
      const exp = describeExpiry(wUint(w[3]));
      r.title = 'Permit2 approval';
      r.summary = `Lets ${label(spender, chainId)} spend ${amount >= UNLIMITED ? 'ALL your ' + tokenName(token, chainId) : 'up to ' + formatAmount(amount, token, chainId)} through Permit2.`;
      r.explain = 'Permit2 is a shared approval contract used by Uniswap and others. This sets how much a spender may move for you, and until when.';
      approvalFindings(r, spender, amount, token, chainId);
      if (exp.long) flag(r, 'caution', `Lasts a long time: ${exp.text}.`);
      detail(r, 'Expires', exp.text);
    }
    return r;
  }

  function unknownCall(sel, data, to, chainId, malformedName) {
    const r = result('call', 'Unknown contract action');
    r.summary = `Calls function 0x${sel} on ${to ? label(to, chainId) : 'a contract'}. Plainsign can't read what it does yet.`;
    r.explain = 'Many normal actions use functions Plainsign does not decode yet. But drainer sites disguise theft as "Claim", "Verify wallet" or "Security update". If you did not expect a transaction here, reject it.';
    flag(r, 'caution', 'Unknown function — its effect cannot be verified.');
    if (malformedName) flag(r, 'caution', `The data is too short for ${malformedName}() — it may be malformed.`);
    detail(r, 'Function selector', '0x' + sel);
    detail(r, 'Data size', `${Math.max(0, (data.length - 2) / 2)} bytes`);
    return r;
  }

  // ---------- EIP-712 typed data ----------

  function analyzeTypedData(td) {
    const d = td.domain || {};
    const m = td.message || {};
    const pt = String(td.primaryType || '');
    const chainId = d.chainId != null ? num(d.chainId) : undefined;
    const vc = lc(d.verifyingContract);
    let r;
    if (vc === PERMIT2 || d.name === 'Permit2') r = permit2Sig(pt, m, chainId);
    else if (d.name === 'Seaport' || pt === 'OrderComponents') r = seaportSig(m, chainId);
    else if (d.name === 'Blur Exchange') r = blurSig(pt, m, chainId);
    else if (pt === 'Permit' && m.spender) r = erc2612Sig(m, d, chainId);
    else r = genericSig(td, chainId);

    if (d.name === 'Permit2' && vc && vc !== PERMIT2) flag(r, 'danger', 'Claims to be Permit2 but points at a different contract.');
    if (d.name === 'Seaport' && vc && !lookup(vc, chainId)) flag(r, 'caution', 'Says "Seaport" but the contract is not a known Seaport version.');
    if (d.verifyingContract) detail(r, 'Signature is for contract', label(d.verifyingContract, chainId));
    if (d.name) detail(r, 'App name (set by the website)', d.name);
    if (chainId !== undefined) detail(r, 'Network', chainName(chainId));
    return r;
  }

  function permit2Sig(pt, m, chainId) {
    const r = result('permit2', 'Permit2 token permission');
    const list = (x) => (Array.isArray(x) ? x : x ? [x] : []);
    const oneTime = !m.details; // SignatureTransfer: a single pull of tokens
    const items = oneTime
      ? list(m.permitted).map((x) => ({ token: x.token, amount: x.amount }))
      : list(m.details).map((x) => ({ token: x.token, amount: x.amount, expiration: x.expiration }));
    const spender = m.spender;
    const sp = lookup(spender, chainId);
    const witness = 'witness' in m || /Witness/.test(pt);

    r.title = oneTime ? 'Permit2: one-time token transfer' : 'Permit2: token spending approval';
    r.summary = `Lets ${label(spender, chainId)} ${oneTime ? 'take' : 'spend'}: ${items.map((it) => formatAmount(it.amount, it.token, chainId)).join(', ') || 'unknown tokens'}.`;
    r.explain = 'Permit2 signatures are the #1 tool of wallet drainers: no transaction, no gas, nothing in your history — but once signed, the spender can move these tokens whenever it likes until the permission expires.';

    if (sp) flag(r, 'info', `Spender is a known contract: ${sp.name}.`);
    else if (witness) flag(r, 'caution', `Spender ${short(spender)} is not in the known list. This looks like a trade order (e.g. UniswapX) — only sign on the real app.`);
    else flag(r, 'danger', `Spender ${short(spender)} is not a known app contract. Real apps use their router as spender — an unknown address is a strong drain signal.`);
    const anyUnlimited = items.some((it) => (toBig(it.amount) ?? 0n) >= UNLIMITED);
    if (anyUnlimited) flag(r, sp || witness ? 'caution' : 'danger', 'Unlimited amount for at least one token.');
    if (items.length > 1) flag(r, sp ? 'caution' : 'danger', `Covers ${items.length} different tokens in one signature — drainers bundle everything they can find.`);
    items.forEach((it) => {
      if (it.expiration == null) return;
      const e = describeExpiry(it.expiration);
      if (e.long) flag(r, 'caution', `${tokenName(it.token, chainId)} permission lasts a long time: ${e.text}.`);
    });

    items.forEach((it, i) => detail(r, `Token ${i + 1}`,
      `${formatAmount(it.amount, it.token, chainId)} — ${it.token}` + (it.expiration != null ? `, expires ${describeExpiry(it.expiration).text}` : '')));
    detail(r, 'Spender', spender || '—');
    const dl = m.sigDeadline ?? m.deadline;
    if (dl != null) detail(r, 'Signature usable until', describeExpiry(dl).text);
    return r;
  }

  function describeItem(i, chainId) {
    const t = num(i.itemType);
    const amt = toBig(i.startAmount) ?? 0n;
    const k = lookup(i.token, chainId);
    const coll = k ? k.name : `NFT ${short(i.token)}`;
    if (t === 0) return fmtEth(amt);
    if (t === 1) return formatAmount(amt, i.token, chainId);
    if (t === 2) return `${coll} #${i.identifierOrCriteria}`;
    if (t === 3) return `${amt} × ${coll} #${i.identifierOrCriteria}`;
    if (t === 4 || t === 5) return `ANY ${coll} item${amt > 1n ? ` (×${amt})` : ''}`;
    return 'unknown item';
  }

  function seaportSig(m, chainId) {
    const r = result('seaport', 'NFT marketplace order (Seaport)');
    const offerer = lc(m.offerer);
    const offer = Array.isArray(m.offer) ? m.offer : [];
    const cons = Array.isArray(m.consideration) ? m.consideration : [];
    const toYou = cons.filter((c) => lc(c.recipient) === offerer);
    const toOthers = cons.filter((c) => lc(c.recipient) !== offerer);
    const give = offer.map((i) => describeItem(i, chainId));
    const get = toYou.map((i) => describeItem(i, chainId));

    r.summary = `You give: ${give.join(', ') || 'nothing'}. You receive: ${get.join(', ') || 'NOTHING'}.`;
    r.explain = 'This is an off-chain order. Once signed, anyone can complete it on-chain until it expires — you will not be asked again.';
    const givesNft = offer.some((i) => num(i.itemType) >= 2);
    const ethLike = toYou.every((c) => num(c.itemType) === 0 || (lookup(c.token, chainId) || {}).symbol === 'WETH');
    const received = toYou.reduce((s, c) => s + (toBig(c.startAmount) ?? 0n), 0n);
    if (givesNft && (!toYou.length || (ethLike && received < 10n ** 15n))) {
      flag(r, 'danger', 'You give away NFTs for nothing (or almost nothing). This is the classic "0 ETH listing" drain.');
    } else if (givesNft) {
      flag(r, 'caution', 'You are listing NFTs for sale. Check that the price above is what you intended.');
    } else {
      flag(r, 'caution', 'You are making an offer. Check the amounts above.');
    }
    if (toOthers.some((c) => num(c.itemType) >= 2)) flag(r, 'danger', 'NFTs from this order go to someone other than you.');
    if (toOthers.length) flag(r, 'info', `${toOthers.length} payment(s) go to other addresses — usually marketplace or creator fees.`);
    toOthers.forEach((c) => detail(r, `Paid to ${short(c.recipient)}`, describeItem(c, chainId)));
    if (m.endTime != null) {
      const e = describeExpiry(m.endTime);
      detail(r, 'Order valid until', e.text);
      if (e.long) flag(r, 'caution', `The order stays open a long time: ${e.text}.`);
    }
    detail(r, 'Offerer (you)', m.offerer || '—');
    return r;
  }

  function blurSig(pt, m, chainId) {
    if (pt === 'Root') {
      const r = result('blur', 'Blur bulk order (contents hidden)');
      r.summary = 'Signs a bundle of Blur orders. The individual listings are not visible in this signature.';
      r.explain = 'Blur uses bulk signatures to list many NFTs at once. Prices cannot be verified from the signature alone, so only sign this on the real Blur site.';
      flag(r, 'caution', 'Contents are hidden — make sure you are on the real Blur site.');
      return r;
    }
    const r = result('blur', 'NFT marketplace order (Blur)');
    const sell = num(m.side) === 1;
    const price = toBig(m.price) ?? 0n;
    const k = lookup(m.collection, chainId);
    const item = `${k ? k.name : 'NFT ' + short(m.collection)} #${m.tokenId}`;
    r.summary = sell ? `Sell ${item} for ${fmtEth(price)}.` : `Offer ${fmtEth(price)} to buy ${item}.`;
    r.explain = 'A signed Blur order can be filled by anyone until it expires.';
    if (sell && price < 10n ** 15n) flag(r, 'danger', 'Selling for nothing (or almost nothing) — a common drain trick.');
    else flag(r, 'caution', 'Check that the price is what you intended.');
    if (m.expirationTime != null) detail(r, 'Valid until', describeExpiry(m.expirationTime).text);
    return r;
  }

  function erc2612Sig(m, d, chainId) {
    const r = result('permit', 'Token permit (gasless approval)');
    const token = d.verifyingContract;
    const spender = m.spender;
    const daiStyle = 'allowed' in m; // DAI: boolean "allowed", expiry 0 = never
    const amount = daiStyle
      ? (m.allowed === true || m.allowed === 'true' ? 2n ** 256n - 1n : 0n)
      : (toBig(m.value) ?? 0n);
    if (amount === 0n) {
      r.summary = `Removes ${label(spender, chainId)}'s permission to spend your ${tokenName(token, chainId)}.`;
      flag(r, 'safe', 'Revokes access — this protects you.');
    } else {
      r.summary = `Lets ${label(spender, chainId)} spend ${amount >= UNLIMITED ? 'ALL your ' + tokenName(token, chainId) : 'up to ' + formatAmount(amount, token, chainId)} — without a transaction.`;
      r.explain = 'A permit is an approval you sign off-chain. No gas and nothing in your history — but the spender can submit it and take the tokens any time before the deadline.';
      approvalFindings(r, spender, amount, token, chainId);
    }
    const dl = m.deadline ?? m.expiry;
    if (dl != null) {
      const e = daiStyle && toBig(dl) === 0n ? { text: 'never', long: true } : describeExpiry(dl);
      detail(r, 'Deadline', e.text);
      if (e.long && amount !== 0n) flag(r, 'caution', `Valid for a long time: ${e.text}.`);
    }
    detail(r, 'Spender', spender);
    return r;
  }

  function flatten(v, prefix, out) {
    if (v && typeof v === 'object') Object.keys(v).forEach((k) => flatten(v[k], prefix ? `${prefix}.${k}` : k, out));
    else out.push([prefix || '(value)', v]);
    return out;
  }

  function genericSig(td, chainId) {
    const pt = td.primaryType || 'unknown';
    const r = result('typed', `Structured signature: ${pt}`);
    r.summary = `A "${pt}" message for ${(td.domain && td.domain.name) || 'an unnamed app'}. Plainsign has no specific decoder for this type yet.`;
    r.explain = 'Structured (EIP-712) signatures can be harmless — logins, votes, profile updates — or they can authorise moving your assets. Look for spenders, operators, amounts and deadlines in the fields below.';
    flag(r, 'caution', 'Unrecognised signature type — read the fields before signing.');
    const flat = flatten(td.message, '', []);
    flat.forEach(([k, v]) => {
      const key = k.split('.').pop();
      if (/^(spender|operator|delegate|delegatee|approved|taker|receiver|recipient|to)$/i.test(key) && isAddr(v) && !lookup(v, chainId)) {
        flag(r, 'caution', `"${k}" is an unknown address (${short(v)}).`);
      }
      if (/(amount|value|allowance|wad|quantity)/i.test(key)) {
        const b = toBig(v);
        if (b !== null && b >= UNLIMITED) flag(r, 'danger', `"${k}" is an unlimited amount.`);
      }
    });
    flat.slice(0, 40).forEach(([k, v]) => detail(r, k, v));
    if (flat.length > 40) detail(r, '…', `${flat.length - 40} more fields`);
    return r;
  }

  global.SigDecoder = { analyze, LEVELS };
})(typeof window !== 'undefined' ? window : globalThis);
