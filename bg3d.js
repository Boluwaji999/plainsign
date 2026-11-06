/*
 * Plainsign's 3D background: a calm silk wave of fine lines along the bottom
 * of the screen, fixed behind the whole page at every window size. It fades
 * out before it reaches the text, and scrolling glides you forward over it.
 *
 * Raw WebGL, no libraries: the GPU shapes the wave in one draw call, and idle
 * motion is capped at 30 frames a second. With reduced motion it only moves
 * with the scroll.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('bg3d');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, powerPreference: 'low-power' });
  if (!gl) return; // no WebGL: the page simply keeps its plain background

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dark = window.matchMedia('(prefers-color-scheme: dark)');

  const VERT = `
    attribute vec2 aPos; // x across the wave (-1..1), depth into it (0 near, 1 far)
    uniform float uTime, uTravel, uAspect, uFocal;
    varying float vFade, vDepth;
    float wave(float x, float z) {
      return 0.34 * sin(x * 0.55 + z * 0.38 + uTime * 0.42)
           + 0.20 * sin(x * 1.05 - z * 0.24 - uTime * 0.30)
           + 0.09 * sin(z * 0.85 + x * 0.3 + uTime * 0.55);
    }
    void main() {
      float z = mix(1.6, 15.0, aPos.y);
      float x = aPos.x * (3.0 + z * 1.15);
      float y = wave(x, z + uTravel) - 1.25;
      float f = uFocal / z;
      gl_Position = vec4(x * f * uAspect, y * f - 0.3, 0.0, 1.0);
      vDepth = aPos.y;
      vFade = pow(1.0 - aPos.y, 1.5) * smoothstep(0.0, 0.1, aPos.y) * (1.0 - pow(abs(aPos.x), 4.0));
    }`;

  const FRAG = `
    precision mediump float;
    uniform vec3 uNear, uFar;
    uniform float uAlpha;
    varying float vFade, vDepth;
    void main() {
      float a = vFade * uAlpha;
      gl_FragColor = vec4(mix(uNear, uFar, vDepth) * a, a);
    }`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const U = {};
  ['uTime', 'uTravel', 'uAspect', 'uFocal', 'uNear', 'uFar', 'uAlpha'].forEach((n) => {
    U[n] = gl.getUniformLocation(program, n);
  });

  // ---------- the wave: parallel lines running across the screen ----------

  const LINES = 44;
  const SEGMENTS = 90;
  const verts = new Float32Array(LINES * SEGMENTS * 4);
  let o = 0;
  for (let l = 0; l < LINES; l++) {
    const depth = Math.pow(l / (LINES - 1), 1.6); // lines bunch up towards the viewer
    for (let s = 0; s < SEGMENTS; s++) {
      verts[o++] = -1 + (2 * s) / SEGMENTS;
      verts[o++] = depth;
      verts[o++] = -1 + (2 * (s + 1)) / SEGMENTS;
      verts[o++] = depth;
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  // ---------- drawing ----------

  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const PALETTE = {
    light: { start: [[0.31, 0.42, 1], [0.55, 0.36, 0.96]], end: [[0.05, 0.6, 0.72], [0.31, 0.42, 1]], alpha: 0.6 },
    dark: { start: [[0.44, 0.53, 1], [0.65, 0.55, 0.98]], end: [[0.3, 0.83, 0.85], [0.44, 0.53, 1]], alpha: 0.55 },
  };
  const FRAME_MS = 33; // idle motion runs at about 30 frames a second

  let height = 0;
  let time = 0;
  let last = 0;
  let drawn = 0;
  let raf = 0;
  let lastY = -1;

  function resize() {
    const width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Keep the swell looking the same shape in tall and wide windows.
    gl.uniform1f(U.uAspect, Math.min(1, height / width));
    gl.uniform1f(U.uFocal, 1.05);
    draw();
  }

  function draw() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - height;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    const colours = dark.matches ? PALETTE.dark : PALETTE.light;
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uTravel, y * 0.006);
    gl.uniform1f(U.uAlpha, colours.alpha);
    gl.uniform3fv(U.uNear, mix3(colours.start[0], colours.end[0], p));
    gl.uniform3fv(U.uFar, mix3(colours.start[1], colours.end[1], p));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.LINES, 0, verts.length / 2);
    lastY = y;
    drawn = performance.now();
  }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (!reduce) time += dt;
    // Scrolling always draws; otherwise skip frames to save the battery.
    if (window.scrollY !== lastY || now - drawn >= FRAME_MS) draw();
    if (!reduce && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', kick, { passive: true });
  document.addEventListener('visibilitychange', kick);
  dark.addEventListener('change', kick);

  resize();
  kick();
})();
