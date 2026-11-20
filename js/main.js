// Scroll suave con inercia (Lenis, MIT). Los links internos (#...) también se deslizan.
const lenis = window.Lenis ? new window.Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 3.2), smoothWheel: true }) : null;
if (lenis) {
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#' ? null : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(id === '#inicio' ? 0 : target); // Lenis ya respeta el scroll-padding-top (88 px) del CSS
      history.replaceState(null, '', id);
    });
  });
}

// Entrada de cada sección: título, texto y tarjetas aparecen en cascada al llegar a la pantalla
(() => {
  const groups = [
    ['.stack', ['.eyebrow', '.marquee']],
    ['.process__card', ['.process__head > *']], // los pasos no: la hoja de ruta mide su posición
    ['.flow-section', ['#flow-title']],
    ['.flow__item', ['.flow__body > *', '.flow__visual']],
    ['.projects', ['.section__head > *', '.projects__grid > li']],
    ['.about', ['.about__aside > *', '.about__block', '.about .actions']],
    ['.services', ['.section__head > *', '.services__grid > li', '.services__note']],
    ['.foot', ['.foot__intro > *', '.foot__col', '.foot__bottom > *']],
  ];
  const all = [];
  groups.forEach(([root, sels]) => {
    document.querySelectorAll(root).forEach((r) => {
      let i = 0;
      sels.forEach((sel) => r.querySelectorAll(sel).forEach((el) => {
        if (el.hasAttribute('data-reveal')) return;
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--rd', Math.min(i++, 8));
        all.push(el);
      }));
    });
  });
  if (!('IntersectionObserver' in window)) { all.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });
  all.forEach((el) => io.observe(el));
  // Al final de la página el pie no llega a cruzar el margen: se muestra lo que quede.
  const atEnd = () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => { el.classList.add('is-in'); io.unobserve(el); });
    }
  };
  window.addEventListener('scroll', atEnd, { passive: true });
})();

// Avatar de "Sobre mí": se inclina y se desplaza hacia el lado del cursor.
const avatar = document.querySelector('.about__avatar');

if (avatar && window.matchMedia('(hover: hover)').matches) {
  const zone = avatar.closest('.about__aside') || avatar;

  zone.addEventListener('pointermove', (e) => {
    const r = avatar.getBoundingClientRect();
    const center = r.left + r.width / 2;
    // -1 a la izquierda, 1 a la derecha, limitado para que el movimiento sea sutil
    const mx = Math.max(-1, Math.min(1, (e.clientX - center) / (r.width / 2 + 120)));
    avatar.style.setProperty('--mx', mx.toFixed(3));
  });

  zone.addEventListener('pointerleave', () => avatar.style.setProperty('--mx', 0));
}

// Hoja de ruta de "Cómo trabajo": una curva que entra por la izquierda, pasa por detrás
// de las tres mini tarjetas y sale por la derecha. Se dibuja la primera vez que la
// sección entra en pantalla, y en cada tarjeta aparece un punto cuando la línea llega.
const card = document.querySelector('.process__card');
const roadmap = card && card.querySelector('.roadmap:not(.roadmap--dots)');
const dotsLayer = card && card.querySelector('.roadmap--dots');

if (card && roadmap && dotsLayer) {
  const NS = 'http://www.w3.org/2000/svg';
  const DURATION = 2.4; // segundos, igual que en styles.css
  const track = roadmap.querySelector('.roadmap__track');
  const line = roadmap.querySelector('.roadmap__line');
  // En el tercer paso la línea entra por la píldora del medio ("CI en GitHub Actions")
  const targets = [...card.querySelectorAll('.step')].map((s) => s.querySelector('.mini, .check:not(.check--sm)'));
  const measure = document.createElementNS(NS, 'path');
  roadmap.appendChild(measure);
  measure.style.visibility = 'hidden';

  const layout = () => {
    const box = card.getBoundingClientRect();
    const view = `0 0 ${box.width} ${box.height}`;
    roadmap.setAttribute('viewBox', view);
    dotsLayer.setAttribute('viewBox', view);

    // Punto de entrada a cada tarjeta: su borde izquierdo, un poco arriba del centro
    const pts = targets.map((t) => {
      const r = t.getBoundingClientRect();
      return [r.left - box.left, r.top - box.top + r.height * (t.classList.contains('check') ? 0.5 : 0.42)];
    });
    const last = targets[targets.length - 1].getBoundingClientRect();
    // El recorrido empieza y termina dentro de la tarjeta grande, con un margen de 40 px
    const pad = 40;
    const start = [Math.max(pad, pts[0][0] - 120), pts[0][1] + 40];
    const end = [Math.min(box.width - pad, last.right - box.left + 60), pts[pts.length - 1][1] - 70];
    const all = [start, ...pts, end];

    let d = `M ${start[0]} ${start[1]}`;
    const prefixes = [];
    for (let i = 1; i < all.length; i++) {
      const [x0, y0] = all[i - 1];
      const [x1, y1] = all[i];
      const dx = x1 - x0;
      const lift = i === 1 ? -18 : (i % 2 ? -44 : 38); // ondula hacia arriba y hacia abajo
      d += ` C ${x0 + dx * 0.5} ${y0 + lift}, ${x1 - dx * 0.5} ${y1 + lift}, ${x1} ${y1}`;
      if (i < all.length - 1) prefixes.push(d);
    }
    track.setAttribute('d', d);
    line.setAttribute('d', d);

    // Demora de cada punto = parte del recorrido hasta esa tarjeta
    measure.setAttribute('d', d);
    const total = measure.getTotalLength();
    dotsLayer.replaceChildren();
    pts.forEach(([x, y], k) => {
      measure.setAttribute('d', prefixes[k]);
      const delay = (measure.getTotalLength() / total) * DURATION;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'roadmap__dot');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 7);
      c.style.transitionDelay = `${delay.toFixed(2)}s`;
      dotsLayer.appendChild(c);
    });
  };

  layout();
  window.addEventListener('resize', layout);
  if (document.fonts) document.fonts.ready.then(layout);
  window.addEventListener('load', layout);

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      layout();
      requestAnimationFrame(() => card.classList.add('is-drawn'));
      io.disconnect(); // solo la primera vez
    }
  }, { threshold: 0.45 });
  io.observe(card.querySelector('.process__steps'));
}

// Dithering del hero: se arma pixel a pixel de abajo hacia arriba al cargar la página.
// Un lienzo del color del fondo tapa la imagen y se va destapando en bloques.
const art = document.querySelector('.hero__art');

if (art) {
  const DURATION = 1900; // ms
  const CELL = 12;       // tamaño del bloque en px
  const canvas = document.createElement('canvas');
  canvas.className = 'hero__cover';
  art.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const bg = getComputedStyle(document.body).backgroundColor;

  const w = art.clientWidth, h = art.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(w * dpr); canvas.height = Math.ceil(h * dpr);
  ctx.scale(dpr, dpr);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  art.classList.add('is-ready');

  // Cada bloque tiene su momento: los de abajo primero, con algo de azar para que se vea "pixelado"
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fromBottom = 1 - (r + 1) / rows;
      cells.push({ x: c * CELL, y: r * CELL, t: fromBottom * 0.72 + Math.random() * 0.28 });
    }
  }
  cells.sort((a, b) => a.t - b.t);

  let i = 0, t0 = null;
  const step = (now) => {
    if (t0 === null) t0 = now;
    const p = Math.min(1, (now - t0) / DURATION);
    while (i < cells.length && cells[i].t <= p) {
      ctx.clearRect(cells[i].x, cells[i].y, CELL, CELL);
      i++;
    }
    if (p < 1) requestAnimationFrame(step);
    else canvas.remove();
  };
  // Orden de la entrada: líneas y textos primero, el dithering se arma después (1,1 s)
  const hero = document.querySelector('.hero');
  const go = () => {
    requestAnimationFrame(() => hero.classList.add('is-in'));
    setTimeout(() => requestAnimationFrame(step), 1100);
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
}

// Cierre: copiar el mail y hora local de Resistencia
const copyBtn = document.querySelector('[data-copy]');
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    const label = copyBtn.querySelector('span');
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.copy);
      label.textContent = '¡Mail copiado!';
    } catch (e) {
      label.textContent = copyBtn.dataset.copy; // sin portapapeles: se muestra para copiarlo a mano
    }
    copyBtn.classList.add('is-copied');
    setTimeout(() => { label.textContent = 'Copiar mail'; copyBtn.classList.remove('is-copied'); }, 2200);
  });
}
const clock = document.getElementById('clock');
if (clock) {
  const fmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Cordoba' });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 30000);
}
