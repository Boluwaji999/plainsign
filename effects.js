/*
 * Plainsign visual effects: glass header, scroll reveals, count-up stats,
 * cursor spotlight on cards, and the animated hero demo.
 * Purely decorative. With reduced motion, everything shows in its final state.
 */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canObserve = 'IntersectionObserver' in window;
  const $ = (id) => document.getElementById(id);

  // ---------- header turns to glass once the page scrolls ----------
  const header = $('site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---------- links that open a tab ([data-goto]) ----------
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('[data-goto]');
    if (!link || !window.PlainsignUI) return;
    e.preventDefault();
    window.PlainsignUI.showTab(link.dataset.goto, true);
  });

  // ---------- scroll reveals ----------
  if (!reduce && canObserve) {
    document.documentElement.classList.add('fx');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  // ---------- count-up numbers ----------
  function countUp(el) {
    const target = Number(el.dataset.count);
    const start = performance.now();
    const duration = 1400;
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if (!reduce && canObserve) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        co.unobserve(en.target);
        countUp(en.target);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = '0';
      co.observe(el);
    });
  }

  // ---------- cursor spotlight on cards ----------
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.spot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // ---------- hero demo: a raw request gets decoded ----------
  const demo = $('demo');
  if (!demo) return;

  const SCENES = [
    {
      level: 'danger', site: 'claim-airdrop.xyz', method: 'eth_signTypedData_v4',
      raw: ['primaryType: "PermitBatch"', 'spender: 0x7a3f…c91e', 'tokens: USDC, WETH', 'amount: 1461501637330902918…', 'expiration: 281474976710655'],
      title: 'High risk — this could drain your wallet',
      text: 'Lets an unknown address take ALL your USDC and WETH, forever.',
    },
    {
      level: 'caution', site: 'opensea.io', method: 'eth_signTypedData_v4',
      raw: ['primaryType: "OrderComponents"', 'offer: Azuki #4521', 'consideration: 2.4 ETH → you', 'fees: 0.06 ETH → OpenSea', 'endTime: in 30 days'],
      title: 'Check carefully before signing',
      text: 'Lists Azuki #4521 for 2.4 ETH. Make sure the price is what you meant.',
    },
    {
      level: 'safe', site: 'app.uniswap.org', method: 'personal_sign',
      raw: ['app.uniswap.org wants you to', 'sign in with your Ethereum account', 'account: 0x4b20…02db', 'Chain ID: 1', 'Nonce: 8f3k2j1hq9'],
      title: 'Looks low risk',
      text: 'A standard login. It cannot move your tokens or NFTs.',
    },
    {
      level: 'danger', site: 'free-mint.io', method: 'eth_sendTransaction',
      raw: ['type: 0x4 (EIP-7702)', 'authorization: 0x9c1e…77ab', 'chainId: 0 (every network)', 'to: your own wallet', 'value: 0'],
      title: 'High risk — account takeover',
      text: 'Hands full control of your wallet to unknown code, on every network.',
    },
  ];
  const ICON = { danger: '✕', caution: '!', safe: '✓' };

  const raw = $('demo-raw');
  const verdict = $('demo-verdict');
  const scan = $('demo-scan');
  let index = 0;
  let timers = [];
  let onScreen = true;
  let waiting = false;

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  // One raw line, with "key:" highlighted.
  function line(text) {
    const el = document.createElement('span');
    el.className = 'ln';
    const m = /^([\w ]+:)(.*)$/.exec(text);
    if (m) {
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = m[1];
      el.append(k, document.createTextNode(m[2]));
    } else {
      el.textContent = text;
    }
    return el;
  }

  function showVerdict(s) {
    demo.dataset.level = s.level;
    $('demo-icon').textContent = ICON[s.level];
    $('demo-title').textContent = s.title;
    $('demo-text').textContent = s.text;
    verdict.classList.add('show');
  }

  function next() {
    if (!onScreen || document.hidden) { waiting = true; return; }
    play();
  }

  function play() {
    timers.forEach(clearTimeout);
    timers = [];
    const s = SCENES[index++ % SCENES.length];
    $('demo-site').textContent = s.site;
    $('demo-method').textContent = s.method;
    verdict.classList.remove('show');
    raw.replaceChildren();

    if (reduce) {
      s.raw.forEach((t) => raw.append(line(t)));
      showVerdict(s);
      later(next, 6000);
      return;
    }

    const gap = 260;
    s.raw.forEach((t, n) => later(() => {
      if (raw.lastChild) raw.lastChild.classList.remove('typing');
      const l = line(t);
      l.classList.add('typing');
      raw.append(l);
    }, 300 + n * gap));
    const typed = 300 + s.raw.length * gap + 150;
    later(() => {
      if (raw.lastChild) raw.lastChild.classList.remove('typing');
      scan.classList.remove('run');
      void scan.offsetWidth; // restart the scan animation
      scan.classList.add('run');
    }, typed);
    later(() => showVerdict(s), typed + 900);
    later(() => verdict.classList.remove('show'), typed + 900 + 3400);
    later(next, typed + 900 + 3900);
  }

  // Pause while the demo is off-screen or the tab is in the background.
  if (canObserve) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
      if (onScreen && waiting) { waiting = false; play(); }
    }).observe(demo);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && waiting && onScreen) { waiting = false; play(); }
  });

  play();
})();
