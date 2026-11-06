/*
 * Plainsign scroll-linked motion: everything here follows the scroll position
 * and plays backwards when you scroll back up. It never takes over scrolling.
 *
 * Built to stay light: positions are measured once (and again only when the
 * layout changes), values go straight onto the elements that move, and nothing
 * is written unless it changed. With reduced motion this file does nothing.
 */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  root.classList.add('sfx');

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const sub = (p, a, b) => clamp((p - a) / (b - a)); // progress of p within [a, b]
  const ease = (t) => t * t * (3 - 2 * t);
  const fix = (n, d) => Number(n.toFixed(d));

  // An element plus the styles last written to it, so repeats are skipped.
  const item = (el) => ({ el, last: {} });
  function put(it, prop, value) {
    if (it.last[prop] === value) return;
    it.last[prop] = value;
    it.el.style[prop] = value;
  }

  const bar = item($('scroll-bar'));
  const hero = document.querySelector('.hero');
  const heroCopy = item(document.querySelector('.hero-copy'));

  const track = $('how-track');
  const steps = [...document.querySelectorAll('#how-steps .step-card')];
  const lines = [...document.querySelectorAll('#stage-lines .sl')].map((el) => ({
    line: item(el),
    label: item(el.querySelector('.sl-dec')),
  }));
  const scanEl = item($('stage-scan'));
  const verdict = item($('stage-verdict'));
  const railFill = item($('how-rail-fill'));
  const statusEl = $('stage-status');
  const STATUS = ['Paste a request', 'Decoding on your device', 'Verdict ready'];

  // Headlines that light up word by word.
  const headlines = [...document.querySelectorAll('[data-words]')].map((el) => {
    const words = el.textContent.trim().split(/\s+/).map((text) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = text;
      return item(w);
    });
    el.replaceChildren();
    words.forEach((w, i) => el.append(w.el, i < words.length - 1 ? ' ' : ''));
    return { el, words, top: 0, shown: false };
  });

  // Elements that build as they enter the screen.
  const scrubs = [...document.querySelectorAll('.scrub, .scrub-scale')].map((el) => ({
    ...item(el),
    full: el.classList.contains('scrub'),
    top: 0,
    shown: false,
  }));

  // Layout numbers, refreshed only by measure().
  const geo = {
    vh: 0, max: 0, heroRange: 1, heroEnd: 0, pinTop: 64, trackTop: 0, pinRange: 1, scanTravel: 0,
  };
  let pinned = false;
  let narrow = false;
  let lastHero = -1;
  let lastHow = -1;
  let activeStep = -1;
  let raf = 0;

  // Distance from the top of the page, ignoring any transform on the element.
  function pageTop(el) {
    let top = 0;
    for (let n = el; n; n = n.offsetParent) top += n.offsetTop;
    return top;
  }

  function setStep(i) {
    if (i === activeStep) return;
    activeStep = i;
    steps.forEach((s, n) => s.classList.toggle('active', n === i));
    statusEl.textContent = STATUS[i];
  }

  // Pinning needs enough height for the stage; small windows keep stacked steps.
  function measure() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const wasNarrow = narrow;
    narrow = w <= 900;
    const fits = w >= 320 && h >= (narrow ? 620 : 560);
    if (fits !== pinned) {
      pinned = fits;
      track.classList.toggle('pin', fits);
      steps.forEach((s) => s.classList.remove('active'));
      activeStep = -1;
    }
    if (wasNarrow !== narrow) {
      // The rail switches direction.
      railFill.last = {};
      railFill.el.style.transform = '';
    }

    geo.vh = h;
    geo.max = root.scrollHeight - h;
    geo.heroRange = Math.min(hero.offsetHeight, h);
    geo.heroEnd = pageTop(hero) + hero.offsetHeight;
    geo.pinTop = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 64;
    if (pinned) {
      geo.trackTop = pageTop(track);
      geo.pinRange = Math.max(1, track.offsetHeight - (h - geo.pinTop));
      geo.scanTravel = lines[lines.length - 1].line.el.offsetTop;
    }
    scrubs.forEach((s) => { s.shown = s.el.offsetParent !== null; s.top = s.shown ? pageTop(s.el) : 0; });
    headlines.forEach((l) => { l.shown = l.el.offsetParent !== null; l.top = l.shown ? pageTop(l.el) : 0; });
    lastHow = -1;
  }

  function renderHero(p) {
    put(heroCopy, 'translate', `0 ${fix(p * -70, 1)}px`);
  }

  function renderHow(p) {
    setStep(p < 0.34 ? 0 : p < 0.67 ? 1 : 2);
    put(railFill, 'transform', `${narrow ? 'scaleX' : 'scaleY'}(${fix(p, 3)})`);

    const scan = sub(p, 0.36, 0.62);
    const count = lines.length;
    lines.forEach(({ line, label }, i) => {
      const shown = ease(sub(p, 0.03 + i * 0.05, 0.1 + i * 0.05));
      put(line, 'opacity', String(fix(shown, 2)));
      put(line, 'translate', `0 ${fix((1 - shown) * 14, 1)}px`);
      const decoded = ease(sub(scan, i / count, (i + 0.7) / count));
      put(label, 'opacity', String(fix(decoded, 2)));
      put(label, 'scale', String(fix(0.86 + decoded * 0.14, 3)));
    });
    put(scanEl, 'translate', `0 ${fix(geo.scanTravel * scan, 1)}px`);
    put(scanEl, 'opacity', scan > 0 && scan < 1 ? '1' : '0');

    const v = ease(sub(p, 0.7, 0.84));
    put(verdict, 'opacity', String(fix(v, 2)));
    put(verdict, 'translate', `0 ${fix((1 - v) * 22, 1)}px`);
    put(verdict, 'scale', String(fix(0.96 + v * 0.04, 3)));
  }

  function frame() {
    raf = 0;
    const y = window.scrollY;
    const { vh, max } = geo;
    const atEnd = y >= max - 2;

    put(bar, 'transform', `scaleX(${max > 0 ? fix(clamp(y / max), 4) : 0})`);
    root.classList.toggle('calm', y > geo.heroEnd);

    const heroP = fix(clamp(y / geo.heroRange), 3);
    if (heroP !== lastHero) {
      lastHero = heroP;
      renderHero(heroP);
    }

    if (pinned) {
      const howP = fix(clamp((y + geo.pinTop - geo.trackTop) / geo.pinRange), 4);
      if (howP !== lastHow) {
        lastHow = howP;
        renderHow(howP);
      }
    }

    scrubs.forEach((s) => {
      const top = s.top - y;
      const p = atEnd || !s.shown ? 1 : ease(clamp((vh * 0.98 - top) / (vh * 0.3)));
      if (s.full) {
        put(s, 'opacity', String(fix(p, 2)));
        put(s, 'translate', `0 ${fix((1 - p) * 54, 1)}px`);
        put(s, 'scale', String(fix(0.95 + p * 0.05, 3)));
      } else {
        put(s, 'scale', String(fix(0.93 + p * 0.07, 3)));
      }
    });

    headlines.forEach((l) => {
      const top = l.top - y;
      const p = atEnd || !l.shown ? 1 : clamp((vh * 0.9 - top) / (vh * 0.34));
      const n = l.words.length;
      l.words.forEach((w, k) => put(w, 'opacity', String(fix(0.16 + 0.84 * sub(p, k / n, (k + 1) / n), 2))));
    });
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function remeasure() {
    measure();
    kick();
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', remeasure);
  // Tabs and results change the page height, which moves everything below them.
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

  measure();
  kick();
})();
