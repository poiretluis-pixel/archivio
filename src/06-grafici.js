/* ===== 6. Grafici (SVG disegnato a mano, nessuna libreria esterna) ===== */
function grafico(descrizione, disegnaFn) {
  const box = h('div', { class: 'grafico', role: 'img', 'aria-label': descrizione });
  const ro = new ResizeObserver(() => {
    const w = Math.floor(box.clientWidth);
    if (w > 0 && w !== box._w) { box._w = w; box.replaceChildren(...disegnaFn(w)); }
  });
  ro.observe(box);
  return box;
}
function tacche(min, max, quante = 4) {
  if (min === max) { min -= 1; max += 1; }
  const grezzo = (max - min) / quante, mag = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const passo = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= grezzo) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + passo * 1e-9; v += passo) out.push(Math.round(v / passo) * passo);
  return out;
}
function fumetto() { return h('div', { class: 'g-fumetto', hidden: true }); }
function mostraFumetto(f, x, y, w, righe) {
  f.replaceChildren(...righe.map((r, i) => h('div', { class: i === 0 ? 'g-f-titolo' : (r.forte ? 'g-f-forte' : '') }, r.testo || r)));
  f.hidden = false;
  const fw = f.offsetWidth;
  f.style.left = Math.max(0, Math.min(w - fw, x + (x + fw + 14 > w ? -fw - 10 : 10))) + 'px';
  f.style.top = Math.max(0, y - f.offsetHeight - 8) + 'px';
}

/* Serie nel tempo, con fascia di riferimento. punti: [{data, y, fuori, righe: [testo...]}] */
function graficoLinea(w, { punti, banda, unita, alto = 210, fmt = v => fmtNum(v, 2) }) {
  const xs = punti.map(p => tempo(p.data)), ys = punti.map(p => p.y);
  const m = { s: 46, d: 14, a: 12, b: 26 };
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 30 * MS_G; x1 += 30 * MS_G; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (banda) { if (typeof banda.min === 'number') y0 = Math.min(y0, banda.min); if (typeof banda.max === 'number') y1 = Math.max(y1, banda.max); }
  const margine = (y1 - y0 || Math.abs(y1) || 1) * 0.12; y0 -= margine; y1 += margine;
  m.s = Math.max(m.s, 14 + 6.6 * Math.max(...tacche(y0, y1).map(v => fmt(v).length)));
  const pw = w - m.s - m.d, ph = alto - m.a - m.b;
  const fx = x1 - x0 < 800 * MS_G ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }) : _fm;
  const X = t => m.s + ((t - x0) / (x1 - x0)) * pw, Y = v => m.a + (1 - (v - y0) / (y1 - y0)) * ph;
  const svg = s('svg', { width: w, height: alto, viewBox: `0 0 ${w} ${alto}` });
  if (banda && (typeof banda.min === 'number' || typeof banda.max === 'number')) {
    const su = typeof banda.max === 'number' ? Y(banda.max) : m.a, giu = typeof banda.min === 'number' ? Y(banda.min) : m.a + ph;
    svg.append(s('rect', { class: 'g-banda', x: m.s, y: su, width: pw, height: Math.max(0, giu - su) }));
  }
  for (const v of tacche(y0, y1)) {
    svg.append(s('line', { class: 'g-griglia', x1: m.s, x2: m.s + pw, y1: Y(v), y2: Y(v) }), s('text', { class: 'g-asse', x: m.s - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmt(v)));
  }
  const etichetteX = w > 460 && punti.length > 2 ? [x0, (x0 + x1) / 2, x1] : [x0, x1];
  etichetteX.forEach((t, i) => svg.append(s('text', { class: 'g-asse', x: X(t), y: alto - 6, 'text-anchor': i === 0 ? 'start' : i === etichetteX.length - 1 ? 'end' : 'middle' }, fx.format(new Date(t)))));
  if (punti.length > 1) svg.append(s('path', { class: 'g-linea', d: punti.map((p, i) => (i ? 'L' : 'M') + X(tempo(p.data)).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ') }));
  const cursore = s('line', { class: 'g-cursore', y1: m.a, y2: m.a + ph, visibility: 'hidden' });
  svg.append(cursore);
  const pochi = punti.length <= 60;
  punti.forEach(p => {
    const px = X(tempo(p.data)), py = Y(p.y);
    if (p.fuori) svg.append(s('path', { class: 'g-fuori', d: `M${px} ${py - 6} L${px + 6} ${py} L${px} ${py + 6} L${px - 6} ${py} Z` }));
    else if (pochi) svg.append(s('circle', { class: 'g-punto', cx: px, cy: py, r: 4.5 }));
  });
  const f = fumetto();
  const tocco = s('rect', { x: m.s - 8, y: 0, width: pw + 16, height: alto, fill: 'transparent' });
  tocco.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), mx = e.clientX - r.left;
    let best = 0; punti.forEach((p, i) => { if (Math.abs(X(tempo(p.data)) - mx) < Math.abs(X(tempo(punti[best].data)) - mx)) best = i; });
    const p = punti[best], px = X(tempo(p.data));
    cursore.setAttribute('x1', px); cursore.setAttribute('x2', px); cursore.setAttribute('visibility', 'visible');
    mostraFumetto(f, px, Y(p.y), w, [fmtData(p.data), { testo: fmt(p.y) + (unita ? ' ' + unita : ''), forte: true }, ...(p.fuori ? ['Fuori intervallo'] : []), ...(p.righe || [])]);
  });
  tocco.addEventListener('pointerleave', () => { f.hidden = true; cursore.setAttribute('visibility', 'hidden'); });
  svg.append(tocco);
  return [svg, f];
}

/* Barre affiancate per categoria. serie: [{nome, classe, valori}] con valori >= 0 */
function graficoBarre(w, { categorie, serie, fmt = v => fmtNum(v, 0), alto = 200 }) {
  const max = Math.max(1e-9, ...serie.flatMap(x => x.valori));
  const tk = tacche(0, max), tetto = Math.max(max, tk[tk.length - 1]);
  const m = { s: Math.max(40, 14 + 6.6 * Math.max(...tk.map(v => fmt(v).length))), d: 8, a: 10, b: 26 }, pw = w - m.s - m.d, ph = alto - m.a - m.b;
  const Y = v => m.a + (1 - v / tetto) * ph;
  const svg = s('svg', { width: w, height: alto, viewBox: `0 0 ${w} ${alto}` });
  for (const v of tk) svg.append(s('line', { class: 'g-griglia', x1: m.s, x2: m.s + pw, y1: Y(v), y2: Y(v) }), s('text', { class: 'g-asse', x: m.s - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmt(v)));
  const gw = pw / categorie.length, bw = Math.max(2, Math.min(22, (gw - 8) / serie.length - 2));
  const ogni = Math.ceil(categorie.length / Math.max(1, Math.floor(pw / 56)));
  const f = fumetto();
  categorie.forEach((cat, i) => {
    const cx = m.s + gw * i + gw / 2, largh = serie.length * (bw + 2) - 2;
    serie.forEach((sr, j) => {
      const v = sr.valori[i] || 0; if (v <= 0) return;
      const x = cx - largh / 2 + j * (bw + 2), y = Y(v), r = Math.min(4, bw / 2, (m.a + ph - y));
      svg.append(s('path', { class: sr.classe, d: `M${x} ${m.a + ph} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${m.a + ph} Z` }));
    });
    if (i % ogni === 0) svg.append(s('text', { class: 'g-asse', x: cx, y: alto - 6, 'text-anchor': 'middle' }, cat));
    const zona = s('rect', { x: m.s + gw * i, y: 0, width: gw, height: m.a + ph, fill: 'transparent' });
    zona.addEventListener('pointerenter', () => mostraFumetto(f, cx, Y(Math.max(...serie.map(x => x.valori[i] || 0))), w, [cat, ...serie.map(x => ({ testo: (serie.length > 1 ? x.nome + ': ' : '') + fmt(x.valori[i] || 0), forte: serie.length === 1 }))]));
    zona.addEventListener('pointerleave', () => { f.hidden = true; });
    svg.append(zona);
  });
  svg.append(s('line', { class: 'g-base', x1: m.s, x2: m.s + pw, y1: m.a + ph, y2: m.a + ph }));
  return [svg, f];
}
function legenda(serie) {
  return h('div', { class: 'legenda' }, serie.map(x => h('span', {}, h('i', { class: 'chiave ' + x.classe }), x.nome)));
}
/* Ripartizione: barre orizzontali in HTML, con il valore scritto accanto. */
function barreOrizzontali(voci_, fmt) {
  const max = Math.max(1e-9, ...voci_.map(x => Math.abs(x.valore)));
  return h('div', { class: 'ripartizione' }, voci_.map(x => h('div', { class: 'rip-riga' },
    h('span', { class: 'rip-nome' }, x.nome),
    h('span', { class: 'rip-pista' }, h('span', { class: 'rip-barra', style: `width:${Math.max(1.5, (Math.abs(x.valore) / max) * 100)}%` })),
    h('span', { class: 'rip-valore num' }, fmt(x.valore)))));
}
function scintilla(valori, ultimoFuori) {
  if (valori.length < 2) return h('span', { class: 'attenuato' }, valori.length ? '1 misura' : '');
  const w = 84, a = 24, min = Math.min(...valori), max = Math.max(...valori), amp = max - min || 1;
  const X = i => 4 + (i / (valori.length - 1)) * (w - 8), Y = v => 4 + (1 - (v - min) / amp) * (a - 8);
  return s('svg', { class: 'scintilla', width: w, height: a, viewBox: `0 0 ${w} ${a}`, 'aria-hidden': 'true' },
    s('path', { class: 'g-linea', d: valori.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ') }),
    s('circle', { class: ultimoFuori ? 'g-punto-fuori' : 'g-punto', cx: X(valori.length - 1), cy: Y(valori[valori.length - 1]), r: 3.5 }));
}
