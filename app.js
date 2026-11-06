(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const { analyze, LEVELS } = window.SigDecoder;
  const Access = window.PlainsignAccess;
  const CFG = Access.config;
  const SYMBOL = '$' + CFG.token.symbol;
  const fmtNum = (n) => Number(n).toLocaleString('en-US');
  const shortAddr = (a) => a.slice(0, 6) + '…' + a.slice(-4);
  const guardMin = () => CFG.tiers[CFG.tiers.length - 1].min;
  const SCROLL = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  const RISK = {
    safe: { label: 'Looks low risk', icon: '✓' },
    caution: { label: 'Check carefully before signing', icon: '!' },
    danger: { label: 'High risk — this could drain your wallet', icon: '✕' },
  };

  // ---------- examples (all addresses below are demo values) ----------

  const ATTACKER = '0x7a3fd1c2b9e84a6f0d5e3b7c8a9f1e2d4c6bc91e';
  const YOU = '0x4b20993bc481177ec7e8f571cecae8a9e22c02db';
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const BAYC = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
  const ONEINCH = '0x111111125421cA6dc452d289314280a0f8842A65';
  const ZERO = '0x0000000000000000000000000000000000000000';
  const ZERO32 = '0x' + '0'.repeat(64);
  const MAX256 = 2n ** 256n - 1n;
  const MAX160 = (2n ** 160n - 1n).toString();
  const MAX48 = (2n ** 48n - 1n).toString();

  const word = (x) => (typeof x === 'string' ? x.slice(2).toLowerCase() : x.toString(16)).padStart(64, '0');
  const calldata = (selector, ...args) => '0x' + selector + args.map(word).join('');
  const now = () => Math.floor(Date.now() / 1000);
  const json = (o) => JSON.stringify(o, null, 2);
  const domainType = [
    { name: 'name', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ];

  const EXAMPLES = [
    {
      label: 'Permit2 drain', level: 'danger',
      make: () => json({
        method: 'eth_signTypedData_v4',
        params: [YOU, {
          types: {
            EIP712Domain: domainType,
            PermitBatch: [{ name: 'details', type: 'PermitDetails[]' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }],
            PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }],
          },
          primaryType: 'PermitBatch',
          domain: { name: 'Permit2', chainId: 1, verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
          message: {
            details: [
              { token: USDC, amount: MAX160, expiration: MAX48, nonce: '0' },
              { token: WETH, amount: MAX160, expiration: MAX48, nonce: '0' },
            ],
            spender: ATTACKER,
            sigDeadline: String(now() + 3600),
          },
        }],
      }),
    },
    {
      label: '0 ETH NFT listing', level: 'danger',
      make: () => json({
        types: {
          EIP712Domain: [...domainType.slice(0, 1), { name: 'version', type: 'string' }, ...domainType.slice(1)],
          OrderComponents: ['offerer:address', 'zone:address', 'offer:OfferItem[]', 'consideration:ConsiderationItem[]', 'orderType:uint8', 'startTime:uint256', 'endTime:uint256', 'zoneHash:bytes32', 'salt:uint256', 'conduitKey:bytes32', 'counter:uint256']
            .map((f) => ({ name: f.split(':')[0], type: f.split(':')[1] })),
          OfferItem: ['itemType:uint8', 'token:address', 'identifierOrCriteria:uint256', 'startAmount:uint256', 'endAmount:uint256']
            .map((f) => ({ name: f.split(':')[0], type: f.split(':')[1] })),
          ConsiderationItem: ['itemType:uint8', 'token:address', 'identifierOrCriteria:uint256', 'startAmount:uint256', 'endAmount:uint256', 'recipient:address']
            .map((f) => ({ name: f.split(':')[0], type: f.split(':')[1] })),
        },
        primaryType: 'OrderComponents',
        domain: { name: 'Seaport', version: '1.6', chainId: 1, verifyingContract: '0x0000000000000068F116a894984e2DB1123eB395' },
        message: {
          offerer: YOU,
          zone: ZERO,
          offer: [{ itemType: '2', token: BAYC, identifierOrCriteria: '8817', startAmount: '1', endAmount: '1' }],
          consideration: [{ itemType: '0', token: ZERO, identifierOrCriteria: '0', startAmount: '1', endAmount: '1', recipient: ATTACKER }],
          orderType: '0',
          startTime: String(now()),
          endTime: String(now() + 5 * 365 * 86400),
          zoneHash: ZERO32,
          salt: '0',
          conduitKey: ZERO32,
          counter: '0',
        },
      }),
    },
    {
      label: 'Unlimited USDC approval', level: 'danger',
      make: () => json({
        method: 'eth_sendTransaction',
        params: [{ from: YOU, to: USDC, value: '0x0', data: calldata('095ea7b3', ATTACKER, MAX256) }],
      }),
    },
    {
      label: 'NFT collection approval', level: 'danger',
      make: () => json({ from: YOU, to: BAYC, chainId: 1, data: calldata('a22cb465', ATTACKER, 1n) }),
    },
    {
      label: 'Account delegation (7702)', level: 'danger',
      make: () => json({
        from: YOU, to: YOU, chainId: '0x1', data: '0x',
        authorizationList: [{ chainId: '0x0', address: ATTACKER, nonce: '0x0' }],
      }),
    },
    {
      label: 'Blind hash (eth_sign)', level: 'danger',
      make: () => json({ method: 'eth_sign', params: [YOU, '0xd7a1c3e5f2b4968a0c1e3f5a7b9d2c4e6f8a0b1c3d5e7f9a2b4c6d8e0f1a3b5c'] }),
    },
    {
      label: 'Exact approval for a swap', level: 'safe',
      make: () => json({ from: YOU, to: USDC, chainId: 1, data: calldata('095ea7b3', ONEINCH, 100000000n) }),
    },
    {
      label: 'Login message', level: 'safe',
      make: () => [
        'app.example.org wants you to sign in with your Ethereum account:',
        YOU,
        '',
        'Sign in to Example App.',
        '',
        'URI: https://app.example.org',
        'Version: 1',
        'Chain ID: 1',
        'Nonce: 8f3k2j1hq9',
        `Issued At: ${new Date().toISOString()}`,
      ].join('\n'),
    },
  ];

  // What to do right now if a high-risk request was already signed, by result kind.
  const COMPROMISED = 'Treat this wallet as fully compromised. Revoking will not help. Move everything you can to a brand-new wallet with a new seed phrase, right now.';
  const IF_SIGNED = {
    permit2: 'Revoke your tokens\' approval to the Uniswap Permit2 contract — that cancels this permission. Then move the tokens to a new wallet.',
    permit: 'A permit cannot be cancelled directly. Move this token to a new wallet immediately. Once the balance is gone, the permit is useless.',
    approve: 'If you sent this transaction, revoke the approval right away with a revoke tool or your wallet\'s approvals page.',
    increaseAllowance: 'If you sent this transaction, revoke the approval right away with a revoke tool or your wallet\'s approvals page.',
    permit2Approve: 'Revoke the Permit2 allowance (or the token\'s approval to Permit2) right away, then move the tokens to a new wallet.',
    setApprovalForAll: 'Turn off the collection approval for this operator right away, then move your NFTs to a new wallet.',
    seaport: 'Cancel your listings on the marketplace (OpenSea: "Cancel all listings") and move the NFTs to a new wallet.',
    blur: 'Cancel your Blur listings and move the NFTs to a new wallet.',
    '7702': COMPROMISED,
    blind: COMPROMISED,
    message: 'If you typed your seed phrase or private key anywhere, treat the wallet as fully compromised and move everything to a brand-new wallet now.',
    default: 'Revoke any approvals you don\'t recognise and move valuable assets to a new wallet.',
  };

  // ---------- rendering ----------

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // never innerHTML: input is untrusted
    return e;
  }

  // opts.locked: free limit reached, so show only the verdict and the main reason.
  // opts.demo: a built-in example, which never uses up free reports.
  function render(r, opts) {
    opts = opts || {};
    const box = $('result');
    box.replaceChildren();
    if (!r) { box.hidden = true; return; }
    const meta = RISK[r.risk] || RISK.caution;
    box.className = 'result ' + r.risk;

    const banner = el('div', 'banner');
    banner.append(el('span', 'icon', meta.icon), el('span', 'level', meta.label));

    const body = el('div', 'body');
    body.append(el('h2', 'title', r.title), el('p', 'summary', r.summary));

    // Worst findings first, except in batches where step order matters.
    const findings = r.kind === 'batch'
      ? r.findings
      : [...r.findings].sort((a, b) => LEVELS[b.level] - LEVELS[a.level]);

    if (opts.locked) {
      const ul = el('ul', 'findings');
      if (findings.length) ul.append(el('li', 'f-' + findings[0].level, findings[0].text));
      body.append(ul);
      if (r.risk === 'danger') body.append(el('p', 'donot', 'Do not sign this unless you are completely sure what it does.'));
      const lock = el('div', 'lockbox');
      const go = el('button', 'primary small', 'See how to unlock →');
      go.type = 'button';
      go.addEventListener('click', () => showTab('unlock', true));
      lock.append(
        el('strong', null, `You've used your ${CFG.freeDailyReports} free detailed reports today.`),
        el('p', null, `Hold ${fmtNum(guardMin())} ${SYMBOL} for unlimited detailed reports, or come back tomorrow. The verdict above is always free.`),
        go);
      body.append(lock);
      box.append(banner, body);
      box.hidden = false;
      return;
    }

    if (opts.demo) body.append(el('p', 'demo-note', 'Example: this does not use your free reports.'));

    if (findings.length) {
      const ul = el('ul', 'findings');
      findings.forEach((f) => ul.append(el('li', 'f-' + f.level, f.text)));
      body.append(ul);
    }

    if (r.explain) {
      const ex = el('div', 'explain');
      ex.append(el('h3', null, 'What this means'), el('p', null, r.explain));
      body.append(ex);
    }

    if (r.risk === 'danger') {
      const box2 = el('div', 'ifsigned');
      const go = el('button', 'ghost small', 'Open the emergency guide →');
      go.type = 'button';
      go.addEventListener('click', () => showTab('signed', true));
      box2.append(el('strong', null, 'Already signed this?'), el('p', null, IF_SIGNED[r.kind] || IF_SIGNED.default), go);
      body.append(box2);
    }

    if (r.details.length) {
      const dl = el('dl', 'details');
      r.details.forEach(([k, v]) => dl.append(el('dt', null, k), el('dd', null, v)));
      const det = el('details');
      det.append(el('summary', null, 'Technical details'), dl);
      body.append(det);
    }

    box.append(banner, body);
    box.hidden = false;
  }

  function run(scroll, demo) {
    const input = $('input').value;
    let r;
    try {
      r = analyze(input);
    } catch (e) {
      r = {
        kind: 'error', title: 'Something went wrong reading this', risk: 'caution',
        summary: 'Plainsign could not decode this input. Treat the request with care.',
        explain: '', findings: [{ level: 'caution', text: String(e && e.message || e) }], details: [],
      };
    }
    // Only real amber/red reports count toward the free limit.
    const countable = !!r && (r.risk === 'caution' || r.risk === 'danger') && r.kind !== 'error' && r.kind !== 'unknown';
    const locked = countable && !demo && !Access.useReport(input);
    render(r, { locked, demo: demo && countable });
    if (r && scroll) $('result').scrollIntoView({ behavior: SCROLL, block: 'start' });
  }

  // ---------- holder access UI ----------

  function renderQuota() {
    const q = $('quota');
    const t = Access.tier();
    const left = Access.remaining();
    q.className = 'quota' + (!t && left === 0 ? ' out' : '') + (t ? ' holder' : '');
    const text = t
      ? `Unlimited reports · ${t.name}`
      : `${left} of ${CFG.freeDailyReports} free detailed reports left today`;
    if (q.textContent && q.textContent !== text) {
      // Restart the "bump" animation so the change is noticed.
      q.classList.remove('bump');
      void q.offsetWidth;
      q.classList.add('bump');
    }
    q.textContent = text;
  }

  function renderWalletButton() {
    const { wallet } = Access.state();
    const t = Access.tier();
    $('wallet-btn').textContent = wallet ? shortAddr(wallet.address) + (t ? ' · ' + t.name : '') : 'Connect wallet';
  }

  function renderMember() {
    const box = $('member');
    const s = Access.state();
    box.replaceChildren();
    const btn = (label, cls, onClick) => {
      const b = el('button', cls, label);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    };
    const actions = el('div', 'row');

    if (!s.wallet) {
      box.append(
        el('h2', 'title', 'Unlock unlimited reports'),
        el('p', null, `Hold ${SYMBOL} on ${CFG.token.chainName} to unlock unlimited detailed reports and more. Connect your wallet to check your holdings.`));
      actions.append(btn(s.status === 'connecting' ? 'Check your wallet…' : 'Connect wallet', 'primary', () => Access.connect()));
      box.append(actions);
      if (s.status === 'nowallet') box.append(el('p', 'member-note', 'No browser wallet found. Install a wallet extension such as MetaMask or Rabby, then reload this page.'));
      else if (s.error) box.append(el('p', 'member-note', s.error));
    } else {
      box.append(el('h2', 'title', 'Your wallet'));
      const dl = el('dl', 'member-info');
      const add = (k, v) => dl.append(el('dt', null, k), el('dd', null, v));
      add('Address', s.wallet.address);
      if (s.status === 'prelaunch') {
        add('Tier', 'Free');
        box.append(dl, el('p', 'member-note', `${SYMBOL} hasn't launched yet. Once it does, your perks unlock automatically when you hold enough.`));
      } else if (s.status === 'checking') {
        box.append(dl, el('p', 'member-note', `Checking your ${SYMBOL} balance…`));
      } else {
        if (s.wallet.balance != null) add('Balance', `${fmtNum(s.wallet.balance)} ${SYMBOL}`);
        add('Tier', s.tier ? s.tier.name : 'Free');
        box.append(dl);
        if (s.status === 'error') box.append(el('p', 'member-note', s.error));
        // Next tier up, if any.
        const bal = Number(s.wallet.balance || 0);
        const next = [...CFG.tiers].reverse().find((t) => bal < t.min);
        if (next && s.wallet.balance != null) {
          box.append(el('p', 'member-note', `Hold ${fmtNum(next.min - bal)} more ${SYMBOL} to reach ${next.name}.`));
        }
      }
      if (CFG.token.buyUrl) {
        const a = el('a', 'primary buy', `Get ${SYMBOL}`);
        a.href = CFG.token.buyUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        actions.append(a);
      }
      actions.append(btn('Refresh', 'ghost', () => Access.refresh()), btn('Disconnect', 'ghost', () => Access.disconnect()));
      box.append(actions);
    }

    document.querySelectorAll('.tier').forEach((card) => {
      card.classList.toggle('current', !!s.tier && card.dataset.tier === s.tier.id);
    });
  }

  function renderAccess() {
    renderQuota();
    renderWalletButton();
    renderMember();
  }

  // Fill tier amounts and limits from config.js so the page never disagrees with it.
  CFG.tiers.forEach((t) => {
    const p = document.querySelector(`[data-min="${t.id}"]`);
    if (p) p.textContent = `Hold ${fmtNum(t.min)} ${SYMBOL}`;
  });
  document.querySelectorAll('[data-free-limit]').forEach((n) => { n.textContent = CFG.freeDailyReports; });
  document.querySelectorAll('[data-chain-name]').forEach((n) => { n.textContent = CFG.token.chainName; });

  Access.onChange(renderAccess);
  $('wallet-btn').addEventListener('click', () => {
    if (!Access.state().wallet) Access.connect();
    showTab('unlock', true);
  });
  $('quota').addEventListener('click', () => showTab('unlock', true));

  // ---------- tabs ----------

  const TABS = ['explain', 'signed', 'unlock'];

  function showTab(name, scroll) {
    if (!TABS.includes(name)) name = 'explain';
    document.querySelectorAll('[role=tab]').forEach((b) => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.tabpanel').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
    try {
      history.replaceState(null, '', name === 'explain' ? location.pathname + location.search : '#' + name);
    } catch (e) { /* some file:// contexts block this */ }
    if (scroll) document.querySelector('.tabs').scrollIntoView({ behavior: SCROLL, block: 'start' });
  }

  document.querySelectorAll('[role=tab]').forEach((b) => {
    b.addEventListener('click', () => showTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.indexOf(b.dataset.tab) + (e.key === 'ArrowRight' ? 1 : -1);
      const next = TABS[(i + TABS.length) % TABS.length];
      showTab(next);
      $('tabbtn-' + next).focus();
    });
  });
  // Only tab names switch tabs; other anchors (#how, #top) just scroll.
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (TABS.includes(h)) showTab(h);
  });
  if (TABS.includes(location.hash.slice(1))) showTab(location.hash.slice(1));
  window.PlainsignUI = { showTab };

  // ---------- wiring ----------

  const chips = $('examples');
  EXAMPLES.forEach((ex) => {
    const b = el('button', 'chip');
    b.type = 'button';
    b.append(el('span', 'dot ' + ex.level), document.createTextNode(ex.label));
    b.addEventListener('click', () => {
      $('input').value = ex.make();
      run(true, true);
    });
    chips.append(b);
  });

  $('analyze').addEventListener('click', () => run(true));
  $('clear').addEventListener('click', () => {
    $('input').value = '';
    render(null);
    $('input').focus();
  });
  $('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(true);
  });
  $('input').addEventListener('paste', () => setTimeout(() => run(true), 0));

  renderAccess();
})();
