(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector('.menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const setMenu = open => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    mobileNav.hidden = !open;
  };
  menuBtn.addEventListener('click', () => setMenu(mobileNav.hidden));
  mobileNav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- Network range chart ---------- */
  const radar = document.getElementById('radar');
  if (radar) {
    const C = 300, R = 270, MAX_KM = 6000;
    const el = (tag, attrs, parent = radar) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.appendChild(n);
      return n;
    };
    const rad = d => d * Math.PI / 180;
    const bearing = (a, b) => {
      const [la1, lo1, la2, lo2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
      const y = Math.sin(lo2 - lo1) * Math.cos(la2);
      const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };
    const polar = (deg, r) => [C + r * Math.sin(rad(deg)), C - r * Math.cos(rad(deg))];

    const defs = el('defs', {});
    const grad = el('radialGradient', { id: 'sweepGrad', cx: C, cy: C, r: R, gradientUnits: 'userSpaceOnUse' }, defs);
    el('stop', { offset: '0', 'stop-color': '#4CB851', 'stop-opacity': '.05' }, grad);
    el('stop', { offset: '1', 'stop-color': '#4CB851', 'stop-opacity': '.32' }, grad);

    // axes + rings
    el('line', { class: 'axis', x1: C - R, y1: C, x2: C + R, y2: C });
    el('line', { class: 'axis', x1: C, y1: C - R, x2: C, y2: C + R });
    [2000, 4000, 6000].forEach(km => el('circle', { class: km === MAX_KM ? 'ring ring-outer' : 'ring', cx: C, cy: C, r: R * km / MAX_KM }));

    // compass ticks
    for (let d = 0; d < 360; d += 5) {
      const major = d % 90 === 0, mid = d % 30 === 0;
      const len = major ? 14 : mid ? 9 : 5;
      const [x1, y1] = polar(d, R + 4), [x2, y2] = polar(d, R + 4 + len);
      el('line', { class: major || mid ? 'tick tick-major' : 'tick', x1, y1, x2, y2 });
    }
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, d]) => {
      const [x, y] = polar(d, R + 26);
      el('text', { class: 'compass', x, y }).textContent = t;
    });

    // rotating sweep: 40° wedge with a bright leading edge
    const sweep = el('g', { class: 'sweep' });
    const [sx, sy] = polar(-40, R), [ex, ey] = polar(0, R);
    el('path', { d: `M${C} ${C}L${sx} ${sy}A${R} ${R} 0 0 1 ${ex} ${ey}Z`, fill: 'url(#sweepGrad)', opacity: '.75' }, sweep);
    el('line', { x1: C, y1: C, x2: ex, y2: ey, stroke: '#4CB851', 'stroke-width': 1.4, opacity: '.9' }, sweep);

    // routes + markers (distances as given, bearings computed from Dubai)
    const DXB = [25.2048, 55.2708];
    const places = [
      { n: 1, at: [51.5074, -0.1278], km: 5473 },   // London
      { n: 2, at: [36.5101, -4.8825], km: 5785 },   // Marbella
      { n: 3, at: [1.3521, 103.8198], km: 5837 },   // Singapore (ASEAN)
    ];
    places.forEach(p => {
      const b = bearing(DXB, p.at), r = R * p.km / MAX_KM;
      const [x, y] = polar(b, r);
      // gentle arc: control point offset perpendicular to the route
      const [mx, my] = polar(b + 9, r * .55);
      el('path', { class: 'route', d: `M${C} ${C}Q${mx} ${my} ${x} ${y}` });
      const g = el('g', { class: 'marker' });
      el('circle', { cx: x, cy: y, r: 13 }, g);
      el('text', { x, y }, g).textContent = p.n;
    });
    el('circle', { class: 'hq-halo', cx: C, cy: C, r: 7 });
    el('circle', { class: 'hq', cx: C, cy: C, r: 7 });
  }

  /* ---------- Worldie globe ---------- */
  const canvas = document.getElementById('globe');
  const orbit = document.getElementById('orbit');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    new ResizeObserver(resize).observe(canvas);

    // nodes on the sphere (lat, lon)
    const nodes = [[25, 55], [51, 0], [36, -5], [1, 104], [40, -74], [35, 139], [-34, 151], [-23, -46], [19, 73], [52, 13], [-26, 28], [31, 121], [48, 2], [55, 37], [6, 3], [43, -79]]
      .map(([la, lo]) => [la * Math.PI / 180, lo * Math.PI / 180]);
    const links = [];
    nodes.forEach((a, i) => nodes.forEach((b, j) => {
      if (j <= i) return;
      const d = Math.acos(Math.sin(a[0]) * Math.sin(b[0]) + Math.cos(a[0]) * Math.cos(b[0]) * Math.cos(a[1] - b[1]));
      if (d < 0.95) links.push([i, j]);
    }));

    const TILT = 0.38;
    const project = (lat, lon, rot, R, cx, cy) => {
      let x = Math.cos(lat) * Math.sin(lon + rot);
      let y = Math.sin(lat);
      let z = Math.cos(lat) * Math.cos(lon + rot);
      // tilt around x axis
      const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
      const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
      return [cx + x * R, cy - y2 * R, z2];
    };
    // great-circle interpolation for arcs
    const toVec = ([la, lo]) => [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const slerp = (a, b, t) => {
      const va = toVec(a), vb = toVec(b);
      const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
      const om = Math.acos(dot), so = Math.sin(om) || 1;
      const s1 = Math.sin((1 - t) * om) / so, s2 = Math.sin(t * om) / so;
      const v = [va[0] * s1 + vb[0] * s2, va[1] * s1 + vb[1] * s2, va[2] * s1 + vb[2] * s2];
      return [Math.asin(v[2]), Math.atan2(v[1], v[0])];
    };

    const tags = orbit ? [...orbit.children] : [];
    let rot = 0, last = performance.now(), visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

    const draw = now => {
      const dt = Math.min(64, now - last); last = now;
      if (!reduceMotion) rot += dt * 0.00012;
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
      ctx.clearRect(0, 0, W, H);

      // outline
      ctx.strokeStyle = 'rgba(243,242,237,.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

      // graticule
      const line = pts => {
        let pen = false;
        ctx.beginPath();
        pts.forEach(([x, y, z]) => { if (z < 0) { pen = false; return; } pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; });
        ctx.stroke();
      };
      ctx.strokeStyle = 'rgba(243,242,237,.12)';
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts = [];
        for (let lon = 0; lon <= 360; lon += 6) pts.push(project(lat * Math.PI / 180, lon * Math.PI / 180, rot, R, cx, cy));
        line(pts);
      }
      for (let lon = 0; lon < 360; lon += 30) {
        const pts = [];
        for (let lat = -90; lat <= 90; lat += 6) pts.push(project(lat * Math.PI / 180, lon * Math.PI / 180, rot, R, cx, cy));
        line(pts);
      }

      // arcs
      links.forEach(([i, j], k) => {
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const [la, lo] = slerp(nodes[i], nodes[j], t);
          const lift = 1 + Math.sin(t * Math.PI) * 0.12;
          const p = project(la, lo, rot, R * lift, cx, cy);
          pts.push(p);
        }
        ctx.strokeStyle = 'rgba(76,184,81,.55)';
        line(pts);
        // travelling packet
        const t = ((now / 2400) + k * 0.37) % 1;
        const [la, lo] = slerp(nodes[i], nodes[j], t);
        const [px, py, pz] = project(la, lo, rot, R * (1 + Math.sin(t * Math.PI) * 0.12), cx, cy);
        if (pz > 0 && !reduceMotion) { ctx.fillStyle = '#C9F5CB'; ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill(); }
      });

      // nodes
      nodes.forEach(([la, lo]) => {
        const [x, y, z] = project(la, lo, rot, R, cx, cy);
        if (z < 0) return;
        ctx.fillStyle = 'rgba(76,184,81,.22)'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4CB851'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });

      // orbiting tags on a tilted ellipse
      const rx = Math.min(W * 0.42, R * 1.55), ry = R * 0.52;
      tags.forEach((tag, i) => {
        const a = now * (reduceMotion ? 0 : 0.00018) + i * (Math.PI * 2 / tags.length);
        const x = cx + Math.cos(a) * rx - tag.offsetWidth / 2;
        const y = cy + Math.sin(a) * ry + (Math.cos(a) * -18) - tag.offsetHeight / 2;
        const depth = Math.sin(a); // >0 in front
        tag.style.transform = `translate(${x}px, ${y}px) scale(${0.86 + depth * 0.14})`;
        tag.style.opacity = (0.45 + (depth + 1) * 0.275).toFixed(2);
        tag.style.zIndex = depth > 0 ? 2 : 0;
      });
      if (orbit) orbit.style.zIndex = 'auto';

      if (visible || reduceMotion) requestAnimationFrame(draw);
      else setTimeout(() => requestAnimationFrame(draw), 300);
    };
    requestAnimationFrame(draw);
  }

  /* ---------- Agent console log ---------- */
  const log = document.getElementById('console-log');
  if (log) {
    const lines = [
      ['qualify inbound leads', 'done'],
      ["draft this week's posts", 'done'],
      ['answer website chat', 'live'],
      ['summarise new reviews', 'done'],
      ['route invoices to finance', 'done'],
    ];
    const MAX = 5;
    const add = (text, status) => {
      const ln = document.createElement('div');
      ln.className = 'ln';
      ln.innerHTML = '<span class="cmd"></span><span class="dotfill"></span><span class="st"></span>';
      log.appendChild(ln);
      while (log.children.length > MAX) log.firstElementChild.remove();
      return ln;
    };
    if (reduceMotion) {
      lines.forEach(([t, s]) => {
        const ln = add();
        ln.querySelector('.cmd').textContent = t;
        ln.querySelector('.dotfill').textContent = ' ' + '.'.repeat(60);
        const st = ln.querySelector('.st'); st.textContent = s; if (s === 'live') st.classList.add('live');
      });
    } else {
      let i = 0;
      const run = () => {
        const [text, status] = lines[i % lines.length];
        const ln = add();
        const cmd = ln.querySelector('.cmd'), fill = ln.querySelector('.dotfill'), st = ln.querySelector('.st');
        const caret = document.createElement('span'); caret.className = 'caret';
        let c = 0;
        const type = () => {
          cmd.textContent = text.slice(0, ++c);
          cmd.appendChild(caret);
          if (c < text.length) return setTimeout(type, 34 + Math.random() * 40);
          setTimeout(() => {
            caret.remove();
            fill.textContent = ' ' + '.'.repeat(60);
            st.textContent = status === 'live' ? 'live' : '…';
            if (status === 'live') { st.classList.add('live'); setTimeout(next, 1400); }
            else setTimeout(() => { st.textContent = 'done'; next(); }, 700);
          }, 250);
        };
        type();
      };
      const next = () => { i++; setTimeout(run, 500); };
      run();
    }
  }

  /* ---------- Enquiry form ---------- */
  const form = document.getElementById('enquiry');
  if (form) {
    const propSet = document.getElementById('property-type');
    const done = form.querySelector('.f-done');
    const syncProperty = () => {
      const isHomes = form.division.value === 'KLB Homes';
      propSet.hidden = !isHomes;
      propSet.disabled = !isHomes;
      if (!isHomes) propSet.classList.remove('invalid');
    };
    form.addEventListener('change', e => {
      if (e.target.name === 'division') syncProperty();
      if (e.target.name === 'property') propSet.classList.remove('invalid');
    });
    form.addEventListener('input', e => e.target.closest('.f-field')?.classList.remove('invalid'));
    syncProperty();

    form.addEventListener('submit', e => {
      e.preventDefault();
      let firstBad = null;
      form.querySelectorAll('input[required]:not([type="radio"])').forEach(inp => {
        const ok = inp.checkValidity() && inp.value.trim() !== '';
        inp.closest('.f-field').classList.toggle('invalid', !ok);
        if (!ok && !firstBad) firstBad = inp;
      });
      if (!propSet.disabled && !form.property.value) {
        propSet.classList.add('invalid');
        firstBad = firstBad || propSet.querySelector('input');
      }
      if (firstBad) { firstBad.focus(); return; }

      // TODO: send to the enquiry endpoint (CRM / email service). Payload is routed by division.
      const data = Object.fromEntries(new FormData(form));
      console.info('Enquiry', data);

      form.querySelectorAll('.f-row, .f-grid, .f-submit').forEach(n => { n.hidden = true; });
      done.hidden = false;
      done.focus?.();
    });
  }

  /* ---------- Listings carousel ---------- */
  const track = document.getElementById('listings');
  if (track) {
    const [prev, next] = document.querySelectorAll('.ls-nav button');
    const step = () => track.firstElementChild.getBoundingClientRect().width + 16;
    const sync = () => {
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step() }));
    next.addEventListener('click', () => track.scrollBy({ left: step() }));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }
})();
