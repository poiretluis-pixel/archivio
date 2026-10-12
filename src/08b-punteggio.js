/* ===== 8b. Indice di salute e consigli in ordine di priorità =====
   L'indice è costruito da Claude con regole dichiarate qui sotto, non è una valutazione medica.
   Ogni componente va da 0 a 100; l'indice è la media pesata dei componenti di cui ci sono dati.
   Cambiare una regola significa cambiare l'indice di tutto lo storico: annotarlo in CLAUDE.md del repository dei dati. */
const limita = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
const plurale = (n, uno, molti) => `${fmtNum(n, 1)} ${Math.abs(n - 1) < 1e-9 ? uno : molti}`;
const PESI_SALUTE = { esami: 25, sonno: 20, recupero: 20, attivita: 20, corpo: 15 };
const PARAMETRI_CHIAVE = new Set(['Creatinina', 'eGFR (filtrato glomerulare stimato)', 'Colesterolo LDL', 'Colesterolo HDL', 'Trigliceridi', 'Glucosio a digiuno',
  'Emoglobina glicata', 'Proteina C-reattiva (PCR)', 'ALT (GPT)', 'AST (GOT)', 'Gamma-GT', 'Emoglobina', 'Vitamina D 25-OH', 'Ferritina', 'TSH', 'Calprotectina fecale']);

function serieMetrica(metrica, tipo) {
  return voci('salute', tipo).filter(v => v.metrica === metrica && typeof v.valore === 'number').sort(perData);
}
function mediaRecente(metrica, giorni, tipo = 'sensore') {
  const l = serieMetrica(metrica, tipo).filter(v => giorniDa(v.data) < giorni);
  return l.length ? { media: somma(l.map(v => v.valore)) / l.length, n: l.length } : null;
}
const ultimoValore = (metrica, tipo = 'corpo') => { const l = serieMetrica(metrica, tipo); return l.length ? l[l.length - 1] : null; };

function componentiSalute() {
  const c = {};
  /* Esami: quota dei parametri nell'intervallo all'ultima misura; i parametri chiave pesano tre volte. */
  const mis = voci('salute', 'misura').sort(perData);
  if (mis.length) {
    const ultimi = [...raggruppa(mis, v => v.parametro).values()].map(l => l[l.length - 1]);
    let tot = 0, ok = 0; const fuori = [];
    for (const v of ultimi) { const w = PARAMETRI_CHIAVE.has(v.parametro) ? 3 : 1; tot += w; if (fuoriIntervallo(v)) fuori.push(v.parametro); else ok += w; }
    const ultimo = mis[mis.length - 1].data;
    c.esami = { nome: 'Esami del sangue', punti: (ok / tot) * 100, eta: giorniDa(ultimo),
      testo: `${plurale(ultimi.length - fuori.length, 'parametro', 'parametri')} su ${ultimi.length} nell'intervallo all'ultima misura` + (fuori.length ? `; fuori: ${fuori.slice(0, 4).join(', ')}${fuori.length > 4 ? ` e altri ${fuori.length - 4}` : ''}` : '') + `. Ultimo prelievo ${fa(giorniDa(ultimo))}.` };
  }
  /* Sonno: media del punteggio del sonno Garmin degli ultimi 14 giorni (almeno 5 notti). */
  const so = mediaRecente('Punteggio del sonno', 14), ore = mediaRecente('Sonno totale', 14);
  if (so && so.n >= 5) c.sonno = { nome: 'Sonno', punti: so.media, eta: 0, testo: `Punteggio medio ${fmtNum(so.media, 0)} su ${so.n} notti` + (ore ? `, ${fmtNum(ore.media, 1)} ore in media.` : '.') };
  /* Recupero: frequenza a riposo (100 fino a 45 bpm, 3 punti in meno per ogni battito in più) e, con almeno 4 settimane di dati,
     variabilità cardiaca degli ultimi 7 giorni rispetto alla propria media (3 punti in meno per ogni punto percentuale sotto). */
  const fc = mediaRecente('Frequenza cardiaca a riposo', 14);
  if (fc && fc.n >= 5) {
    const parti = [limita(100 - (fc.media - 45) * 3)]; let testo = `Frequenza a riposo ${fmtNum(fc.media, 0)} bpm`;
    const hrv = serieMetrica('Variabilità cardiaca notturna (HRV)', 'sensore');
    if (hrv.length && giorniDa(hrv[0].data) >= 28) {
      const rec = hrv.filter(v => giorniDa(v.data) < 7), base = hrv.filter(v => giorniDa(v.data) >= 7 && giorniDa(v.data) < 60);
      if (rec.length >= 3 && base.length >= 14) {
        const r = somma(rec.map(v => v.valore)) / rec.length, b = somma(base.map(v => v.valore)) / base.length;
        parti.push(limita(100 - Math.max(0, (1 - r / b) * 100) * 3));
        testo += `, variabilità cardiaca ${fmtNum(r, 0)} ms contro una media personale di ${fmtNum(b, 0)}`;
      }
    } else testo += '; la variabilità cardiaca entra nel calcolo dopo 4 settimane di dati';
    c.recupero = { nome: 'Recupero', punti: somma(parti) / parti.length, eta: 0, testo: testo + '.' };
  }
  /* Attività: passi medi degli ultimi 14 giorni (100 da 10.000 in su) e sedute a settimana (100 da 3 in su),
     contando sia le sedute da scheda sia le altre attività sportive (cartella Sport). */
  const pa = mediaRecente('Passi', 14), al = [...voci('sport', 'allenamento'), ...voci('sport', 'attivita')].sort(perData);
  const partiA = [], testiA = [];
  if (pa && pa.n >= 5) { partiA.push(limita(pa.media / 100)); testiA.push(`${fmtNum(pa.media, 0)} passi al giorno`); }
  if (al.length) {
    const ultima = al[al.length - 1].data, da = isoData(...((d) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()])(new Date(tempo(ultima) - 27 * MS_G)));
    const fin = al.filter(v => v.data >= da), settimane = new Set(fin.map(v => lunedi(v.data))).size || 1;
    const spw = fin.length / settimane;
    partiA.push(limita(spw / 3 * 100)); testiA.push(`${plurale(spw, 'seduta', 'sedute')} a settimana ` + (settimane === 1 ? 'nell\'ultima settimana registrata' : `nelle ultime ${settimane} settimane registrate`));
  }
  if (partiA.length) c.attivita = { nome: 'Attività', punti: somma(partiA) / partiA.length, eta: al.length ? giorniDa(al[al.length - 1].data) : 0, testo: testiA.join(', ') + '.' };
  /* Corpo: rapporto vita/altezza (100 fino a 0,50, 6 punti in meno per ogni centesimo in più) e massa grassa (100 fino al 15%, 5 punti in meno per ogni punto in più). */
  const vita = ultimoValore('Circonferenza vita'), alt = ultimoValore('Altezza'), mg = ultimoValore('Massa grassa');
  const partiC = [], testiC = []; let etaC = 0;
  if (vita && alt) { const r = vita.valore / alt.valore; partiC.push(limita(100 - Math.max(0, r - 0.5) * 600)); testiC.push(`vita/altezza ${fmtNum(r, 2)}`); etaC = Math.max(etaC, giorniDa(vita.data)); }
  if (mg) { partiC.push(limita(100 - Math.max(0, mg.valore - 15) * 5)); testiC.push(`massa grassa ${fmtNum(mg.valore, 1)}%`); etaC = Math.max(etaC, giorniDa(mg.data)); }
  if (partiC.length) c.corpo = { nome: 'Composizione corporea', punti: somma(partiC) / partiC.length, eta: etaC, testo: testiC.join(', ') + `. Misure di ${fa(etaC)}.` };
  return c;
}
function indiceSalute() {
  const c = componentiSalute(), chiavi = Object.keys(PESI_SALUTE).filter(k => c[k]);
  if (!chiavi.length) return null;
  const peso = somma(chiavi.map(k => PESI_SALUTE[k]));
  const valore = somma(chiavi.map(k => c[k].punti * PESI_SALUTE[k])) / peso;
  const vecchi = chiavi.filter(k => (k === 'esami' && c[k].eta > 365) || (k === 'corpo' && c[k].eta > 180) || (k === 'attivita' && c[k].eta > 21));
  const mancano = Object.keys(PESI_SALUTE).filter(k => !c[k]);
  const affidabilita = mancano.length === 0 && !vecchi.length ? 'alta' : mancano.length <= 1 && vecchi.length <= 1 ? 'media' : 'bassa';
  return { valore, componenti: c, mancano, vecchi, affidabilita };
}
const fascia = v => (v >= 80 ? { tipo: 'ok', testo: 'Buono' } : v >= 60 ? { tipo: 'vuota', testo: 'Discreto' } : { tipo: 'ritardo', testo: 'Da migliorare' });
function anello(valore, dim = 132, nome = 'Indice di salute') {
  const r = dim / 2 - 9, circ = 2 * Math.PI * r, f = fascia(valore);
  return s('svg', { class: 'anello ' + f.tipo, width: dim, height: dim, viewBox: `0 0 ${dim} ${dim}`, role: 'img', 'aria-label': `${nome} ${Math.round(valore)} su 100, ${f.testo.toLowerCase()}` },
    s('circle', { class: 'anello-fondo', cx: dim / 2, cy: dim / 2, r }),
    s('circle', { class: 'anello-valore', cx: dim / 2, cy: dim / 2, r, 'stroke-dasharray': `${(circ * valore) / 100} ${circ}`, transform: `rotate(-90 ${dim / 2} ${dim / 2})` }),
    s('text', { class: 'anello-numero', x: dim / 2, y: dim / 2 + 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, String(Math.round(valore))),
    s('text', { class: 'anello-unita', x: dim / 2, y: dim / 2 + 26, 'text-anchor': 'middle' }, 'su 100'));
}
const NOMI_MANCANTI = { esami: 'esami del sangue', sonno: 'sonno', recupero: 'recupero', attivita: 'attività', corpo: 'misure del corpo' };
/* Pannello comune agli indici (corpo, finanze): anello, giudizio, affidabilità e componenti con il loro peso. */
function pannelloIndiceComune(titolo, nomeIndice, ind, pesi, nomiMancanti, nota) {
  const f = fascia(ind.valore);
  return h('section', { class: 'pannello indice' },
    h('h2', {}, titolo),
    h('div', { class: 'indice-testa' }, anello(ind.valore, 132, nomeIndice),
      h('div', {}, h('p', { class: 'indice-giudizio' }, stato(f.tipo, f.testo)),
        h('p', { class: 'piccolo' }, `Affidabilità ${ind.affidabilita}` + (ind.mancano.length ? `: mancano ${ind.mancano.map(k => nomiMancanti[k]).join(', ')}` : '') + (ind.vecchi.length ? `${ind.mancano.length ? ';' : ':'} dati vecchi per ${ind.vecchi.map(k => nomiMancanti[k]).join(', ')}` : '') + '.'),
        h('p', { class: 'attenuato piccolo' }, nota))),
    h('div', { class: 'componenti' }, Object.keys(pesi).filter(k => ind.componenti[k]).map(k => {
      const x = ind.componenti[k];
      return h('div', { class: 'componente' },
        h('div', { class: 'tra' }, h('strong', {}, x.nome), h('span', { class: 'num' }, `${Math.round(x.punti)}`, h('span', { class: 'attenuato' }, `, peso ${pesi[k]}%`))),
        h('span', { class: 'rip-pista' }, h('span', { class: 'rip-barra ' + fascia(x.punti).tipo, style: `width:${Math.max(2, x.punti)}%` })),
        h('div', { class: 'elenco-nota' }, x.testo));
    })));
}
function pannelloIndice() {
  const ind = indiceSalute(); if (!ind) return null;
  return pannelloIndiceComune('Situazione del corpo', 'Indice di salute', ind, PESI_SALUTE, NOMI_MANCANTI, 'Indice costruito da Claude sui tuoi dati, con regole fisse e visibili. Non è una valutazione medica.');
}

/* --- Indice finanziario: stesse regole di trasparenza dell'indice di salute ---
   Risparmio: quota delle entrate non spesa negli ultimi 3 mesi completi (100 dal 20% in su, 0 a zero o sotto).
   Riserva: mesi di spesa coperti dalla liquidità (conti correnti, risparmio, contanti) (100 da 6 mesi in su).
   Debiti: rate mensili (pagate o dichiarate, la più alta) rispetto alle entrate medie (100 fino al 10%, 0 dal 50% in su).
   Tetti di spesa: quota delle categorie con tetto rispettate nell'ultimo mese completo.
   Giroconti, investimenti e partecipazioni, prestiti ricevuti non contano (CAT_NEUTRE in 05-schema.js). */
const PESI_FINANZE = { risparmio: 35, riserva: 35, debiti: 15, budget: 15 };
const NOMI_MANCANTI_FIN = { risparmio: 'movimenti', riserva: 'saldi o movimenti', debiti: 'entrate', budget: 'tetti di spesa' };
const LIQUIDI = new Set(['Conto corrente', 'Risparmio', 'Contanti']);
const movimentiReali = () => voci('finanze', 'movimento').filter(v => !CAT_NEUTRE.has(v.categoria) && typeof v.valore === 'number');
function mesiCompleti(quanti) {
  const o = oggi(); let y = +o.slice(0, 4), m = +o.slice(5, 7); const out = [];
  for (let i = 0; i < quanti; i++) { if (--m < 1) { m = 12; y--; } out.unshift(`${y}-${String(m).padStart(2, '0')}`); }
  return out;
}
function liquidita() {
  const ultimi = new Map();
  for (const v of voci('finanze', 'saldo').sort(perData)) ultimi.set((v.persona || '') + '|' + v.conto, v);
  const l = [...ultimi.values()].filter(v => LIQUIDI.has(v.categoria));
  return l.length ? { valore: somma(l.map(v => v.valore)), data: l.reduce((m, v) => (v.data > m ? v.data : m), '') } : null;
}
function componentiFinanze() {
  const c = {}, mov = movimentiReali();
  const mesi = mesiCompleti(3).filter(k => mov.some(v => v.data.startsWith(k)));
  let entrateMedie = 0, usciteMedie = 0;
  if (mesi.length) {
    const nelPeriodo = mov.filter(v => mesi.some(k => v.data.startsWith(k)));
    const E = somma(nelPeriodo.filter(v => v.valore > 0).map(v => v.valore)), U = -somma(nelPeriodo.filter(v => v.valore < 0).map(v => v.valore));
    entrateMedie = E / mesi.length; usciteMedie = U / mesi.length;
    if (E > 0) { const r = (E - U) / E; c.risparmio = { nome: 'Risparmio', punti: limita(r / 0.2 * 100), eta: 0, testo: `Risparmiato il ${fmtNum(r * 100, 0)}% delle entrate (${fmtEuro(E - U)} su ${fmtEuro(E)}) negli ultimi ${mesi.length === 1 ? 'mese completo' : mesi.length + ' mesi completi'}.` }; }
  }
  const liq = liquidita();
  if (liq && usciteMedie > 0) {
    const m = liq.valore / usciteMedie;
    c.riserva = { nome: 'Riserva', punti: limita(m / 6 * 100), eta: giorniDa(liq.data), testo: `La liquidità (${fmtEuro(liq.valore)}) copre ${fmtNum(m, 1)} mesi di spesa media (${fmtEuro(usciteMedie)} al mese).` };
  }
  /* Rate: la più alta tra quelle pagate davvero (movimenti "Rate e finanziamenti") e quelle dichiarate nei debiti. */
  const deb = voci('patrimonio', 'debito'), rateDebiti = somma(deb.map(v => v.rata));
  const rateMov = mesi.length ? -somma(mov.filter(v => v.categoria === 'Rate e finanziamenti' && v.valore < 0 && mesi.some(k => v.data.startsWith(k))).map(v => v.valore)) / mesi.length : 0;
  const rate = Math.max(rateDebiti, rateMov);
  if (entrateMedie > 0) {
    const q = rate / entrateMedie;
    c.debiti = { nome: 'Debiti', punti: limita(100 - Math.max(0, q - 0.1) / 0.4 * 100), eta: 0, testo: rate ? `Le rate (${fmtEuro(rate)} al mese) valgono il ${fmtNum(q * 100, 0)}% delle entrate medie.` : 'Nessuna rata registrata.' };
  }
  const ultimo = mesiCompleti(1)[0], fine = ultimo + '-31';
  const tetti = new Map(); for (const b of voci('finanze', 'budget').filter(b => b.data <= fine).sort(perData)) tetti.set(b.categoria, b);
  if (tetti.size && mov.some(v => v.data.startsWith(ultimo))) {
    const sforati = [...tetti.values()].filter(b => -somma(mov.filter(v => v.data.startsWith(ultimo) && v.categoria === b.categoria && v.valore < 0).map(v => v.valore)) > b.valore).map(b => b.categoria);
    c.budget = { nome: 'Tetti di spesa', punti: (tetti.size - sforati.length) / tetti.size * 100, eta: 0, testo: `${tetti.size - sforati.length} categorie su ${tetti.size} nel tetto a ${fmtMese(ultimo)}` + (sforati.length ? `; sforate: ${sforati.join(', ')}.` : '.') };
  }
  return c;
}
function indiceFinanze() {
  const c = componentiFinanze(), chiavi = Object.keys(PESI_FINANZE).filter(k => c[k]);
  if (!chiavi.length) return null;
  const valore = somma(chiavi.map(k => c[k].punti * PESI_FINANZE[k])) / somma(chiavi.map(k => PESI_FINANZE[k]));
  const vecchi = chiavi.filter(k => k === 'riserva' && c[k].eta > 45);
  const mancano = Object.keys(PESI_FINANZE).filter(k => !c[k]);
  const affidabilita = mancano.length === 0 && !vecchi.length ? 'alta' : mancano.length <= 1 && vecchi.length <= 1 ? 'media' : 'bassa';
  return { valore, componenti: c, mancano, vecchi, affidabilita };
}
function pannelloIndiceFinanze() {
  const ind = indiceFinanze(); if (!ind) return null;
  return pannelloIndiceComune('Salute finanziaria', 'Indice finanziario', ind, PESI_FINANZE, NOMI_MANCANTI_FIN, 'Indice costruito da Claude sui tuoi movimenti e saldi, con regole fisse e visibili. Non è una consulenza finanziaria.');
}

/* --- Consigli: per ogni cartella, in ordine di priorità (1 = il più importante) --- */
const consigliAperti = idArea => voci(idArea, 'consiglio').filter(v => v.stato !== 'fatto' && v.stato !== 'scartato').sort((a, b) => (a.priorita || 99) - (b.priorita || 99));
function voceConsiglio(idArea, v, conArea) {
  return h('li', { class: 'consiglio cliccabile', tabindex: 0, onclick: () => apriModulo(idArea, 'consiglio', v), onkeydown: e => { if (e.key === 'Enter') apriModulo(idArea, 'consiglio', v); } },
    h('span', { class: 'consiglio-num num', 'aria-label': 'Priorità ' + (v.priorita || '') }, v.priorita || ''),
    h('div', {}, h('div', { class: 'tra' }, h('strong', {}, v.titolo), h('span', { class: 'attenuato piccolo' }, [conArea ? (area(idArea) || {}).nome : '', v.stato === 'in corso' ? 'in corso' : ''].filter(Boolean).join(', '))),
      v.azione ? h('div', { class: 'elenco-nota testo-lungo' }, v.azione) : null,
      v.perche ? h('div', { class: 'attenuato piccolo testo-lungo' }, 'Perché: ' + v.perche) : null));
}
function pannelloConsigli(idArea) {
  const l = consigliAperti(idArea), fatti = voci(idArea, 'consiglio').filter(v => v.stato === 'fatto').length;
  if (!l.length && !fatti) return null;
  return pannello('Consigli in ordine di priorità', l.length ? h('ol', { class: 'elenco consigli' }, l.map(v => voceConsiglio(idArea, v))) : h('p', { class: 'attenuato' }, 'Nessun consiglio aperto.'),
    fatti ? h('p', { class: 'attenuato piccolo' }, h('a', { href: `#/a/${idArea}/consiglio` }, fatti === 1 ? '1 consiglio già seguito' : `${fatti} consigli già seguiti`)) : null);
}
function consigliPrincipali() {
  const l = aree().flatMap(a => consigliAperti(a.id).slice(0, 2).map(v => [a.id, v]));
  if (!l.length) return null;
  return pannello('Consigli principali', h('ol', { class: 'elenco consigli' }, l.slice(0, 6).map(([a, v]) => voceConsiglio(a, v, true))),
    h('p', { class: 'attenuato piccolo' }, 'I primi due di ogni cartella. L\'elenco completo è in ciascuna cartella.'));
}
