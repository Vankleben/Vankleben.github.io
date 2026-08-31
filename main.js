/* ============ EMERALD HORIZON — shader background ============
   Source: ThreeUI StructureFlowCollection · emerald-horizon
   (exact port of the official source bundle, Three.js r128) */

(function emeraldHorizon () {
  const host = document.getElementById('emeraldBg');
  const canvas = document.getElementById('emeraldCanvas');
  if (!host || !canvas || typeof THREE === 'undefined') return;

  // props: speed / waveScale / variation / hue / glow / vignette = 1.00
  const options = { speed: 1, waveScale: 1, variation: 1, glow: 1, vignette: 1, hue: 1 };
  canvas.style.filter = `hue-rotate(${options.hue}deg)`;

  const LUMINA_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

  const LUMINA_FRAGMENT_SHADER = `
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_wave_scale;
uniform float u_variation;
uniform float u_glow;
uniform float u_vignette;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 1e4); }
float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}
void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  float yPos = st.y;
  float wave1 = sin(st.x * 3.0 + u_time * 0.5) * 0.1 * u_wave_scale;
  float wave2 = sin(st.x * 5.0 - u_time * 0.3) * 0.05 * u_wave_scale;
  float combinedWave = wave1 + wave2;
  float intensity = smoothstep(0.4, -0.1, yPos + combinedWave);
  float variation = noise(st.x * 2.0 + u_time * 0.1) * 0.5 + 0.5;
  intensity *= variation * 1.5 * u_variation;
  vec3 color = vec3(0.0, 0.02, 0.0);
  vec3 glowColor1 = vec3(0.05, 0.8, 0.2);
  vec3 glowColor2 = vec3(0.0, 1.0, 0.5);
  vec3 finalGlow = mix(glowColor1, glowColor2, st.x + sin(u_time*0.2)*0.5);
  color += finalGlow * pow(intensity, 1.5) * 1.2 * u_glow;
  float vignette = mix(1.0, smoothstep(1.2, 0.5, length(st - vec2(0.5, 0.0))), u_vignette);
  color *= vignette;
  gl_FragColor = vec4(color, 1.0);
}
`;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const uniforms = {
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_wave_scale: { value: 1 },
    u_variation: { value: 1 },
    u_glow: { value: 1 },
    u_vignette: { value: 1 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: LUMINA_VERTEX_SHADER,
    fragmentShader: LUMINA_FRAGMENT_SHADER,
    uniforms, depthWrite: false, depthTest: false
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));

  let frame = 0, visible = true;
  const start = performance.now();

  const resize = () => {
    const bounds = host.getBoundingClientRect();
    renderer.setSize(bounds.width, bounds.height, false);
    uniforms.u_resolution.value.set(bounds.width, bounds.height);
  };

  const render = (now) => {
    uniforms.u_time.value = (now - start) * 0.001 * options.speed;
    uniforms.u_wave_scale.value = options.waveScale;
    uniforms.u_variation.value = options.variation;
    uniforms.u_glow.value = options.glow;
    uniforms.u_vignette.value = options.vignette;
    renderer.render(scene, camera);
    frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
  };

  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry ? entry.isIntersecting : true;
    if (visible && !frame) frame = requestAnimationFrame(render);
    if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
  });
  resizeObserver.observe(host);
  intersection.observe(host);
  resize();
  frame = requestAnimationFrame(render);
})();

/* ============ 交互细节 ============ */

/* Uplink Loader 开屏：仅首次访问播放；走完一轮后淡出（点击可跳过） */
(function uplinkLoader () {
  const el = document.getElementById('uplinkLoader');
  const ready = () => dispatchEvent(new Event('uplink:done'));
  if (!el) { ready(); return; }

  let seen = false;
  try { seen = localStorage.getItem('uplink-seen') === '1'; } catch (e) {}
  if (seen) {                       // 老访客：直接进主页
    el.remove();
    ready();
    return;
  }

  const START = performance.now();
  const RUN_TIME = 8600 + 600;          // 与 loader 内部时间轴对齐：100% 后再停留片刻
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    try { localStorage.setItem('uplink-seen', '1'); } catch (e) {}
    el.classList.add('done');
    ready();
    setTimeout(() => el.remove(), 1200); // 淡出结束后移除 iframe，释放资源
  };
  const wait = Math.max(0, RUN_TIME - (performance.now() - START));
  const timer = setTimeout(dismiss, wait);
  el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
})();

/* 打字机：> PLAYER_ONE（等开屏结束后再敲） */
(function typewriter () {
  const el = document.getElementById('typeLine');
  if (!el) return;
  const text = el.dataset.text || '';
  const begin = () => {
    let i = 0;
    const tick = () => {
      if (i <= text.length) { el.textContent = text.slice(0, i++); setTimeout(tick, 70); }
    };
    setTimeout(tick, 500);
  };
  addEventListener('uplink:done', begin, { once: true });
})();

/* 项目卡片点击展开/收起 */
(function workToggle () {
  document.querySelectorAll('.work').forEach((w) => {
    const toggle = () => w.classList.toggle('open');
    w.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // 详情里的链接正常跳转
      toggle();
    });
    w.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
})();

/* HUD 滚动百分比 */
(function scrollPct () {
  const el = document.getElementById('scrollPct');
  if (!el) return;
  addEventListener('scroll', () => {
    const max = document.body.scrollHeight - innerHeight;
    const p = max > 0 ? Math.round(scrollY / max * 100) : 0;
    el.textContent = String(p).padStart(3, '0');
  }, { passive: true });
})();

/* 滚动显现 + 属性条生长 */
(function reveals () {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();

/* GPA 数字滚动计数 */
(function gpaCount () {
  const el = document.getElementById('gpaNum');
  if (!el) return;
  const target = parseFloat(el.dataset.val);
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now(), dur = 1400;
    const step = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * ease).toFixed(2);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: 0.4 });
  io.observe(el);
})();
