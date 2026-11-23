/* ===== 8i. Sport e Mindfulness con la navigazione nel tempo =====
   Dal 23/11/2026: in entrambe le pagine si sceglie la scala (settimana, mese, anno) e ci si sposta avanti e indietro
   con le frecce, con "Torna a oggi" e, sul telefono, scorrendo col dito. Lo stato vale per la visita. */

const SCALE_PERIODO = { settimana: 'Settimana', mese: 'Mese', anno: 'Anno' };
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI_SETT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const GIORNI_LUNGHI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const ADESSO_PERIODO = { settimana: 'Questa settimana', mese: 'Questo mese', anno: 'Quest\'anno' };
const PRIMA_PERIODO = { settimana: 'la settimana prima', mese: 'il mese prima', anno: 'l\'anno prima' };
const RISPETTO_A = { settimana: 'rispetto alla settimana prima', mese: 'rispetto al mese prima', anno: 'rispetto all\'anno prima' };

function periodoDi(chiave) {
  S.periodi = S.periodi || {};
  return S.periodi[chiave] || (S.periodi[chiave] = { scala: 'mese', off: 0 });
}
const giorniNelMese = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const giornoSettimana = iso => (new Date(tempo(iso)).getUTCDay() + 6) % 7;
function limitiPeriodo(scala, off) {
  const o = oggi(), y = +o.slice(0, 4), m = +o.slice(5, 7);
  if (scala === 'settimana') { const da = piuGiorni(lunedi(o), 7 * off); return { da, a: piuGiorni(da, 6) }; }
  if (scala === 'anno') return { da: isoData(y + off, 1, 1), a: isoData(y + off, 12, 31) };
  const k = y * 12 + (m - 1) + off, yy = Math.floor(k / 12), mm = (k % 12) + 1;
  return { da: isoData(yy, mm, 1), a: isoData(yy, mm, giorniNelMese(yy, mm)) };
}
/* Intervallo con etichetta e caselle del grafico: giorni per settimana e mese, mesi per l'anno. */
function intervallo(scala, off) {
  const L = limitiPeriodo(scala, off), g = d => +d.slice(8, 10), me = d => +d.slice(5, 7) - 1, an = d => d.slice(0, 4);
  let etichetta, caselle = [];
  if (scala === 'settimana') {
    etichetta = me(L.da) === me(L.a) ? `${g(L.da)}–${g(L.a)} ${MESI_LUNGHI[me(L.a)]} ${an(L.a)}`
      : `${g(L.da)} ${MESI_BREVI[me(L.da)]}${an(L.da) !== an(L.a) ? ' ' + an(L.da) : ''} – ${g(L.a)} ${MESI_BREVI[me(L.a)]} ${an(L.a)}`;
    for (let i = 0; i < 7; i++) { const d = piuGiorni(L.da, i); caselle.push({ da: d, a: d, etich: `${GIORNI_SETT[i]} ${g(d)}`, titolo: `${GIORNI_LUNGHI[i]} ${g(d)} ${MESI_LUNGHI[me(d)]}` }); }
  } else if (scala === 'mese') {
    etichetta = `${MESI_LUNGHI[me(L.da)]} ${an(L.da)}`;
    for (let d = L.da; d <= L.a; d = piuGiorni(d, 1)) caselle.push({ da: d, a: d, etich: String(g(d)), titolo: `${GIORNI_LUNGHI[giornoSettimana(d)]} ${g(d)} ${MESI_LUNGHI[me(d)]}` });
  } else {
    etichetta = an(L.da);
    for (let i = 0; i < 12; i++) { const y = +an(L.da); caselle.push({ da: isoData(y, i + 1, 1), a: isoData(y, i + 1, giorniNelMese(y, i + 1)), etich: MESI_BREVI[i], titolo: `${MESI_LUNGHI[i]} ${y}` }); }
  }
  const fineUtile = L.a < oggi() ? L.a : oggi();
  const giorniTrascorsi = L.da > oggi() ? 0 : Math.round((tempo(fineUtile) - tempo(L.da)) / MS_G) + 1;
  return { scala, off, ...L, etichetta, caselle, giorniTrascorsi, prec: limitiPeriodo(scala, off - 1) };
}
const nelPeriodo = (d, L) => !!d && d >= L.da && d <= L.a;

/* Barra del periodo: scala a pillole, frecce, etichetta grande e "Torna a oggi". */
function navPeriodo(chiave, primaData) {
  const p = periodoDi(chiave), I = intervallo(p.scala, p.off);
  const vai = f => { f(p); disegna(); };
  const indietroOk = !primaData || I.da > primaData;
  return h('div', { class: 'periodo' },
    h('div', { class: 'periodo-scale', role: 'tablist', 'aria-label': 'Scala del periodo' }, Object.entries(SCALE_PERIODO).map(([k, n]) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': p.scala === k ? 'true' : 'false', class: 'periodo-scala' + (p.scala === k ? ' scelta' : ''), onclick: () => vai(q => { q.scala = k; q.off = 0; }) }, n))),
    h('div', { class: 'periodo-nav' },
      h('button', { type: 'button', class: 'periodo-freccia', 'aria-label': 'Periodo precedente', title: 'Periodo precedente', disabled: !indietroOk, onclick: () => vai(q => { q.off--; }) }, '‹'),
      h('div', { class: 'periodo-etichetta' }, h('strong', {}, I.etichetta),
        p.off === 0 ? h('span', { class: 'periodo-adesso' }, ADESSO_PERIODO[p.scala]) : h('button', { type: 'button', class: 'periodo-oggi', onclick: () => vai(q => { q.off = 0; }) }, 'Torna a oggi')),
      h('button', { type: 'button', class: 'periodo-freccia', 'aria-label': 'Periodo successivo', title: 'Periodo successivo', disabled: p.off >= 0, onclick: () => vai(q => { q.off++; }) }, '›')));
}
/* Sul telefono si scorre col dito: verso destra il periodo precedente, verso sinistra il successivo. */
function scorrimentoPeriodo(el, chiave, primaData) {
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', e => { if (e.touches.length === 1 && !e.target.closest('.grafico')) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } else x0 = null; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    const p = periodoDi(chiave), I = intervallo(p.scala, p.off);
    if (dx > 0 && (!primaData || I.da > primaData)) { p.off--; disegna(); } else if (dx < 0 && p.off < 0) { p.off++; disegna(); }
  }, { passive: true });
  return el;
}
const fmtDurata = min => { min = Math.round(min || 0); if (min < 60) return `${min} min`; const o = Math.floor(min / 60), r = min % 60; return r ? `${o} h ${r} min` : `${o} h`; };
/* Riquadro numerico con il confronto col periodo precedente (descrittivo, senza giudizio). */
function riquadro(etich, valore, att, prima, I, fmtDelta) {
  let delta = null;
  if (prima > 0 || att > 0) {
    const d = att - prima;
    delta = prima <= 0 ? h('span', { class: 'kpi-delta su' }, 'nuovo ' + RISPETTO_A[I.scala])
      : d === 0 ? h('span', { class: 'kpi-delta' }, 'come ' + PRIMA_PERIODO[I.scala])
      : h('span', { class: 'kpi-delta ' + (d > 0 ? 'su' : 'giu') }, `${d > 0 ? '▲' : '▼'} ${fmtDelta(Math.abs(d))} ${RISPETTO_A[I.scala]}`);
  }
  return h('div', { class: 'kpi' }, h('div', { class: 'kpi-etichetta' }, etich), h('div', { class: 'kpi-valore' }, valore), delta);
}

/* Barre impilate: una pila per casella, un colore per disciplina. pile: [{nome, classe, valori}] */
function graficoPile(w, { categorie, titoli, pile, fmt = v => fmtNum(v, 0), alto = 210, evidenzia = -1 }) {
  const totali = categorie.map((_, i) => somma(pile.map(p => p.valori[i] || 0)));
  const max = Math.max(1e-9, ...totali), tk = tacche(0, max), tetto = Math.max(max, tk[tk.length - 1]);
  const m = { s: Math.max(40, 14 + 6.6 * Math.max(...tk.map(v => fmt(v).length))), d: 8, a: 10, b: 26 }, pw = w - m.s - m.d, ph = alto - m.a - m.b;
  const Y = v => m.a + (1 - v / tetto) * ph;
  const svg = s('svg', { width: w, height: alto, viewBox: `0 0 ${w} ${alto}` });
  for (const v of tk) svg.append(s('line', { class: 'g-griglia', x1: m.s, x2: m.s + pw, y1: Y(v), y2: Y(v) }), s('text', { class: 'g-asse', x: m.s - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmt(v)));
  const gw = pw / categorie.length, bw = Math.max(3, Math.min(30, gw * 0.62));
  const ogni = Math.ceil(categorie.length / Math.max(1, Math.floor(pw / 44)));
  const f = fumetto();
  categorie.forEach((cat, i) => {
    const cx = m.s + gw * i + gw / 2, x = cx - bw / 2;
    if (i === evidenzia) svg.append(s('rect', { class: 'g-oggi', x: m.s + gw * i + 1, y: m.a, width: gw - 2, height: ph, rx: 6 }));
    let base = 0;
    const pezzi = pile.map(p => ({ p, v: p.valori[i] || 0 })).filter(z => z.v > 0);
    pezzi.forEach((z, j) => {
      const y1 = Y(base), y2 = Y(base + z.v), alto_ = y1 - y2, r = j === pezzi.length - 1 ? Math.min(5, bw / 2, alto_) : 0;
      svg.append(s('path', { class: 'sp-pila ' + z.p.classe, d: `M${x} ${y1} V${y2 + r} Q${x} ${y2} ${x + r} ${y2} H${x + bw - r} Q${x + bw} ${y2} ${x + bw} ${y2 + r} V${y1} Z` }));
      base += z.v;
    });
    if (i % ogni === 0 || i === evidenzia) svg.append(s('text', { class: 'g-asse' + (i === evidenzia ? ' g-asse-forte' : ''), x: cx, y: alto - 6, 'text-anchor': 'middle' }, cat));
    const zona = s('rect', { x: m.s + gw * i, y: 0, width: gw, height: m.a + ph, fill: 'transparent' });
    zona.addEventListener('pointerenter', () => mostraFumetto(f, cx, Y(totali[i]), w, [(titoli || categorie)[i], { testo: totali[i] ? 'Totale ' + fmt(totali[i]) : 'Nessuna attività', forte: true }, ...pezzi.map(z => `${z.p.nome}: ${fmt(z.v)}`)]));
    zona.addEventListener('pointerleave', () => { f.hidden = true; });
    svg.append(zona);
  });
  svg.append(s('line', { class: 'g-base', x1: m.s, x2: m.s + pw, y1: m.a + ph, y2: m.a + ph }));
  return [svg, f];
}

/* ---------- Sport: solo le attività registrate con il Garmin, in sola lettura ---------- */
/* Dal 22/11/2026 non si mostrano cronometro, mobilità, camminata e cardio, voluto da Luis. */
const SPORT_NASCOSTI = new Set(['cronometro', 'mobilità', 'camminata', 'cardio']);
const attivitaGarmin = () => voci('sport', 'attivita').filter(v => v.auto && !SPORT_NASCOSTI.has(String(v.disciplina || '').trim().toLowerCase())).sort(perData);
const ICONE_SPORT = [[/cors|run|trail/i, '🏃'], [/nuot|swim/i, '🏊'], [/bici|cicl|bike|ride|spinning/i, '🚴'], [/cammin|walk|escurs|hik/i, '🚶'], [/forza|palestra|strength|pesi|funzional/i, '🏋️'], [/yoga|pilates|mobilit|stretch/i, '🧘'], [/padel|tennis/i, '🎾'], [/calcio|calcetto/i, '⚽'], [/sci\b|snow/i, '⛷️']];
const iconaSport = d => (ICONE_SPORT.find(([r]) => r.test(d || '')) || [0, '⌚'])[1];
const nomeDisc = v => v.disciplina || 'Attività';
const numero = x => Number(x) || 0;

function cruscottoSport() {
  const tutte = attivitaGarmin();
  if (!tutte.length) return pannello('', vuoto('Nessuna attività ancora. Le attività registrate con il Garmin arrivano qui da sole ogni notte da Garmin Connect. Se non arrivano, guarda lo stato del Garmin in Impostazioni.'));
  const p = periodoDi('sport'), I = intervallo(p.scala, p.off), primaData = tutte[0].data;
  const at = tutte.filter(v => nelPeriodo(v.data, I)), pr = tutte.filter(v => nelPeriodo(v.data, I.prec));
  /* Un colore fisso per disciplina, in ordine di frequenza su tutto lo storico: la stessa disciplina ha sempre lo stesso colore. */
  const ordine = [...raggruppa(tutte, nomeDisc)].sort((a, b) => b[1].length - a[1].length).map(x => x[0]);
  const classe = d => 'sp-c' + Math.min(Math.max(ordine.indexOf(d), 0), 5);
  const tot = l => ({ n: l.length, min: somma(l.map(v => numero(v.minuti))), km: somma(l.map(v => numero(v.distanza))), kcal: somma(l.map(v => numero(v.calorie))), giorni: new Set(l.map(v => v.data)).size });
  const T = tot(at), P = tot(pr);

  const testa = h('div', { class: 'sp-testa' },
    h('p', { class: 'sotto' }, 'Dal tuo Garmin, aggiornato ogni notte. Ultima attività: ', h('strong', {}, `${nomeDisc(tutte[tutte.length - 1])}, ${fmtData(tutte[tutte.length - 1].data)}`), '.'),
    navPeriodo('sport', primaData));

  if (!at.length) {
    return scorrimentoPeriodo(h('div', { class: 'sp-pagina' }, testa,
      h('div', { class: 'sp-vuoto' }, h('div', { class: 'sp-vuoto-icona', 'aria-hidden': 'true' }, '⌚'), h('strong', {}, 'Nessuna attività in questo periodo'),
        h('p', { class: 'attenuato' }, p.off === 0 ? 'Le attività registrate col Garmin compaiono qui la notte dopo.' : 'Usa le frecce per spostarti in un altro periodo.'))), 'sport', primaData);
  }

  /* Riquadri principali */
  const kpi = h('div', { class: 'kpi-griglia' },
    riquadro('Attività', String(T.n), T.n, P.n, I, n => fmtNum(n, 0)),
    riquadro('Tempo in movimento', fmtDurata(T.min), T.min, P.min, I, fmtDurata),
    riquadro('Distanza', T.km ? `${fmtNum(T.km, 1)} km` : '—', T.km, P.km, I, n => fmtNum(n, 1) + ' km'),
    riquadro('Giorni attivi', `${T.giorni}${I.giorniTrascorsi ? ' su ' + I.giorniTrascorsi : ''}`, T.giorni, P.giorni, I, n => fmtNum(n, 0)));

  /* Grafico del tempo per casella, impilato per disciplina */
  const discPeriodo = ordine.filter(d => at.some(v => nomeDisc(v) === d));
  const pile = discPeriodo.map(d => ({ nome: d, classe: classe(d), valori: I.caselle.map(c => somma(at.filter(v => nomeDisc(v) === d && nelPeriodo(v.data, c)).map(v => numero(v.minuti)))) }));
  const idxOggi = p.off === 0 ? I.caselle.findIndex(c => nelPeriodo(oggi(), c)) : -1;
  const grafPanel = pannello('Tempo di attività',
    grafico('Minuti di attività per ' + (p.scala === 'anno' ? 'mese' : 'giorno') + ', divisi per disciplina', w => graficoPile(w, { categorie: I.caselle.map(c => c.etich), titoli: I.caselle.map(c => c.titolo), pile, fmt: v => fmtNum(v, 0), alto: 220, evidenzia: idxOggi })),
    h('div', { class: 'sp-legenda' }, discPeriodo.map(d => h('span', {}, h('i', { class: 'sp-punto ' + classe(d) }), d))),
    h('p', { class: 'attenuato piccolo' }, `Minuti per ${p.scala === 'anno' ? 'mese' : 'giorno'}.` + (T.giorni ? ` In media ${fmtDurata(T.min / T.giorni)} nei giorni in cui ti sei allenato.` : '')));

  /* Per disciplina */
  const perDisc = discPeriodo.map(d => { const l = at.filter(v => nomeDisc(v) === d); return { d, ...tot(l) }; }).sort((a, b) => b.min - a.min || b.n - a.n);
  const maxMin = Math.max(1, ...perDisc.map(x => x.min));
  const discPanel = pannello('Per disciplina', h('div', { class: 'sp-disc-griglia' }, perDisc.map(x => h('div', { class: 'sp-disc' },
    h('div', { class: 'sp-disc-testa' }, h('span', { class: 'sp-icona ' + classe(x.d), 'aria-hidden': 'true' }, iconaSport(x.d)), h('strong', {}, x.d)),
    h('div', { class: 'sp-disc-valore' }, fmtDurata(x.min)),
    h('div', { class: 'sp-disc-pista' }, h('span', { class: 'sp-disc-barra ' + classe(x.d), style: `width:${Math.max(4, x.min / maxMin * 100)}%` })),
    h('div', { class: 'attenuato piccolo' }, [x.n === 1 ? '1 attività' : `${x.n} attività`, x.km ? `${fmtNum(x.km, 1)} km` : '', x.kcal ? `${fmtNum(x.kcal, 0)} kcal` : ''].filter(Boolean).join(' · '))))));

  /* Il meglio del periodo */
  const piuLunga = [...at].sort((a, b) => numero(b.minuti) - numero(a.minuti))[0];
  const piuLontana = [...at].filter(v => numero(v.distanza) > 0).sort((a, b) => numero(b.distanza) - numero(a.distanza))[0];
  const meglio = [piuLunga && numero(piuLunga.minuti) ? ['⏱', 'La più lunga', `${nomeDisc(piuLunga)}, ${fmtDurata(numero(piuLunga.minuti))}`, piuLunga.data] : null,
    piuLontana ? ['📍', 'La più lontana', `${nomeDisc(piuLontana)}, ${fmtNum(numero(piuLontana.distanza), 2)} km`, piuLontana.data] : null,
    T.kcal ? ['🔥', 'Calorie', `${fmtNum(T.kcal, 0)} kcal`, null] : null].filter(Boolean);
  const megliPanel = meglio.length ? h('div', { class: 'sp-meglio' }, meglio.map(([ic, tit, val, d]) => h('div', { class: 'sp-meglio-voce' },
    h('span', { class: 'sp-meglio-icona', 'aria-hidden': 'true' }, ic), h('div', {}, h('div', { class: 'attenuato piccolo' }, tit), h('strong', {}, val), d ? h('div', { class: 'attenuato piccolo' }, fmtData(d)) : null)))) : null;

  /* Elenco delle attività del periodo, raggruppate per giorno */
  const elenco = h('div', {});
  const disegnaElenco = tutteVisibili => {
    const l = [...at].reverse(), mostrate = tutteVisibili ? l : l.slice(0, 20);
    const gruppi = raggruppa(mostrate, v => v.data);
    elenco.replaceChildren(...[...gruppi].map(([d, lst]) => h('div', { class: 'sp-giorno' },
      h('div', { class: 'sp-giorno-titolo' }, `${GIORNI_LUNGHI[giornoSettimana(d)]} ${+d.slice(8, 10)} ${MESI_LUNGHI[+d.slice(5, 7) - 1]}` + (d.slice(0, 4) !== oggi().slice(0, 4) ? ' ' + d.slice(0, 4) : '')),
      h('ul', { class: 'sp-elenco' }, lst.map(v => h('li', { class: 'sp-attivita' },
        h('span', { class: 'sp-icona ' + classe(nomeDisc(v)), 'aria-hidden': 'true' }, iconaSport(v.disciplina)),
        h('div', { class: 'sp-testo' }, h('strong', {}, nomeDisc(v)), h('div', { class: 'attenuato piccolo' }, v.ora ? 'ore ' + v.ora : '')),
        h('div', { class: 'sp-numeri' },
          v.minuti ? h('span', {}, h('b', {}, fmtDurata(numero(v.minuti)))) : null,
          v.distanza ? h('span', {}, `${fmtNum(numero(v.distanza), 2)} km`) : null,
          v.fc_media ? h('span', { title: 'Frequenza cardiaca media' }, `♥ ${fmtNum(numero(v.fc_media), 0)}`) : null,
          v.calorie ? h('span', {}, `${fmtNum(numero(v.calorie), 0)} kcal`) : null)))))),
      !tutteVisibili && l.length > 20 ? h('div', { class: 'azioni' }, btn(`Mostra tutte le ${l.length} attività`, () => disegnaElenco(true), 'piccolo')) : '');
  };
  disegnaElenco(false);

  return scorrimentoPeriodo(h('div', { class: 'sp-pagina' }, testa, kpi, grafPanel, megliPanel, discPanel,
    pannello('Attività', elenco, h('p', { class: 'attenuato piccolo' }, 'Si correggono nell\'app Garmin Connect.'))), 'sport', primaData);
}

/* ---------- Mindfulness: solo le sessioni dell'app Mindfulness del Garmin (niente inserimenti a mano dal 22/11/2026) e stress del Garmin, per periodo ---------- */
function cruscottoMindfulness() {
  const giorni = giorniMeditazione(), stressTutti = serieMetrica('Stress medio', 'sensore');
  if (!giorni.size && !stressTutti.length) return pannello('', vuoto('Ancora nessuna sessione. Avvia la meditazione dall\'app Mindfulness del Garmin: le sessioni arrivano qui da sole ogni notte. Conta la costanza, non la durata.'));
  const date = [...giorni.keys(), ...stressTutti.map(v => v.data)].sort(), primaData = date[0];
  const p = periodoDi('mindfulness'), I = intervallo(p.scala, p.off);
  const dentro = L => [...giorni].filter(([d]) => nelPeriodo(d, L));
  const gp = dentro(I), gprec = dentro(I.prec);
  const minuti = l => somma(l.map(([, g]) => g.minuti)), conMin = gp.filter(([, g]) => g.minuti > 0);
  const media = l => (l.length ? somma(l.map(v => v.valore)) / l.length : null);
  const stP = stressTutti.filter(v => nelPeriodo(v.data, I)), stPrec = stressTutti.filter(v => nelPeriodo(v.data, I.prec));
  const serie = serieMeditazione(giorni), frase = fraseMindfulness(giorni, serie), fattoOggi = giorni.has(oggi());
  const mStress = media(stP), mStressPrec = media(stPrec);

  const kpi = h('div', { class: 'kpi-griglia' },
    riquadro('Giorni di pratica', `${gp.length}${I.giorniTrascorsi ? ' su ' + I.giorniTrascorsi : ''}`, gp.length, gprec.length, I, n => fmtNum(n, 0)),
    riquadro('Minuti di pratica', fmtDurata(minuti(gp)), minuti(gp), minuti(gprec), I, fmtDurata),
    h('div', { class: 'kpi' }, h('div', { class: 'kpi-etichetta' }, 'Media a seduta'), h('div', { class: 'kpi-valore' }, conMin.length ? fmtDurata(minuti(gp) / conMin.length) : '—')),
    h('div', { class: 'kpi' }, h('div', { class: 'kpi-etichetta' }, 'Stress medio Garmin'), h('div', { class: 'kpi-valore' }, mStress != null ? fmtNum(mStress, 0) : '—'),
      h('span', { class: 'kpi-delta' + (mStress != null && mStressPrec != null && mStress < mStressPrec ? ' su' : '') }, mStress != null && mStressPrec != null ? `prima ${fmtNum(mStressPrec, 0)}; più basso è meglio` : 'su 100; più basso è meglio')));

  /* Minuti per casella */
  const valori = I.caselle.map(c => minuti(dentro(c)));
  const idxOggi = p.off === 0 ? I.caselle.findIndex(c => nelPeriodo(oggi(), c)) : -1;
  const grafMin = pannello('Minuti di pratica',
    grafico('Minuti di meditazione per ' + (p.scala === 'anno' ? 'mese' : 'giorno'), w => graficoPile(w, { categorie: I.caselle.map(c => c.etich), titoli: I.caselle.map(c => c.titolo), pile: [{ nome: 'Minuti', classe: 'md-pila', valori }], alto: 190, evidenzia: idxOggi })),
    h('p', { class: 'attenuato piccolo' }, `Minuti per ${p.scala === 'anno' ? 'mese' : 'giorno'}, sessioni dell'app Mindfulness del Garmin.`));

  /* Griglia della costanza: finisce con il periodo scelto (un anno intero nella scala Anno). */
  const finePer = I.a < oggi() ? I.a : oggi();
  /* La griglia parte dal giorno più recente: sul telefono si vede subito la fine e si scorre indietro. */
  setTimeout(() => document.querySelectorAll('.med-griglia-box').forEach(b => { b.scrollLeft = b.scrollWidth; }));
  const griglia = pannello('Costanza', grigliaMeditazione(giorni, p.scala === 'anno' ? 53 : 13, p.scala === 'anno' ? I.a : finePer),
    h('p', { class: 'attenuato piccolo' }, 'Ogni quadrato è un giorno, più scuro quando hai meditato più a lungo.'));

  /* Stress nei giorni con e senza pratica, nel periodo */
  const con = stP.filter(v => giorni.has(v.data)), senza = stP.filter(v => !giorni.has(v.data));
  let confronto = null;
  if (con.length >= 3 && senza.length >= 3) {
    const mc = media(con), ms = media(senza), diff = Math.round(ms - mc);
    confronto = pannello('Stress nei giorni in cui mediti',
      h('p', { class: 'med-esito ' + (diff > 0 ? 'bene' : 'neutro') }, diff > 0 ? `Nei giorni in cui mediti lo stress è più basso di ${diff} punti.` : diff < 0 ? `Nei giorni in cui mediti lo stress è più alto di ${-diff} punti.` : 'Per ora lo stress è uguale nei giorni con e senza meditazione.'),
      barreOrizzontali([{ nome: 'Con meditazione', valore: mc }, { nome: 'Senza meditazione', valore: ms }], v => fmtNum(v, 0)),
      h('p', { class: 'attenuato piccolo' }, `Stress medio della giornata misurato dal Garmin nel periodo (${con.length} giorni con meditazione, ${senza.length} senza); più basso è meglio. È un confronto, non una prova di causa ed effetto.`));
  }

  const grafStress = stP.length >= 2 ? pannello('Stress misurato', grafico('Stress medio Garmin nel periodo', w => graficoLinea(w, { punti: stP.map(v => ({ data: v.data, y: v.valore, righe: giorni.has(v.data) ? ['giorno con meditazione'] : [] })), fmt: v => fmtNum(v, 0) })),
    h('p', { class: 'attenuato piccolo' }, `Stress medio della giornata, ${stP.length} giorni misurati.`)) : null;

  return scorrimentoPeriodo(h('div', { class: 'sp-pagina' },
    p.off === 0 ? h('div', { class: 'med-testa' + (fattoOggi ? ' fatto' : '') },
      h('div', { class: 'med-serie' }, h('span', { class: 'med-num num' }, String(serie.attuale)), h('span', { class: 'med-etich' }, serie.attuale === 1 ? 'giorno di fila' : 'giorni di fila'), serie.record ? h('span', { class: 'med-record' }, `record ${serie.record}`) : null),
      h('div', { class: 'med-frase' }, h('span', { class: 'med-stato' }, fattoOggi ? '✓ Fatto oggi' : '○ Oggi ancora da fare'), h('strong', {}, frase.titolo), h('p', {}, frase.testo))) : null,
    p.off === 0 ? pannello('Meditazione di questa settimana', settimanaMeditazione(giorni)) : null,
    navPeriodo('mindfulness', primaData),
    gp.length || stP.length ? [kpi, grafMin, griglia, confronto, grafStress]
      : [h('div', { class: 'sp-vuoto' }, h('div', { class: 'sp-vuoto-icona', 'aria-hidden': 'true' }, '🧘'), h('strong', {}, 'Nessun dato in questo periodo'), h('p', { class: 'attenuato' }, 'Usa le frecce per spostarti in un altro periodo.'))]),
    'mindfulness', primaData);
}
