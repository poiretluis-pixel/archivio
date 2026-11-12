/* ===== 8f. Spese: le spese ricorrenti e occasionali mese per mese, mie e della famiglia =====
   Ogni spesa (finanze/spesa) ha importo, frequenza e una scadenza di riferimento: da lì si calcolano le scadenze di ogni mese.
   Le occasionali (frequenza "occasionale") scadono una volta sola, alla data indicata.
   È pagata quando nei movimenti del conto c'è un'uscita che contiene la parola "riconosci" vicino alla scadenza,
   oppure quando Luis la segna a mano (campo pagati, elenco di mesi AAAA-MM). L'avviso del giorno prima, nel calendario
   Google SPESE, lo crea Claude ogni mattina. */
const spesaAttiva = sp => sp.stato !== 'chiusa';
const mesiTra = (da, a) => (+a.slice(0, 4) - +da.slice(0, 4)) * 12 + (+a.slice(5, 7) - +da.slice(5, 7));
function scadenzaNelMese(sp, mese) {
  if (!sp.data) return null;
  if (sp.frequenza === OCCASIONALE) return sp.data.slice(0, 7) === mese ? sp.data : null;
  const passo = MESI_FREQ[sp.frequenza] || 1, diff = mesiTra(sp.data.slice(0, 7), mese);
  if (diff < 0 || diff % passo) return null;
  const ultimo = +ultimoDelMese(mese).slice(8, 10), giorno = Math.min(+sp.data.slice(8, 10), ultimo);
  const d = `${mese}-${String(giorno).padStart(2, '0')}`;
  return sp.fine && d > sp.fine ? null : d;
}
function prossimaScadenza(sp, dal = oggi()) {
  let m = dal.slice(0, 7);
  for (let i = 0; i < 25; i++, m = meseDopo(m, 1)) { const d = scadenzaNelMese(sp, m); if (d && d >= dal) return d; }
  return null;
}
const mesiPagati = sp => String(sp.pagati || '').split(',').map(t => t.trim()).filter(Boolean);
/* Movimento che paga la spesa: uscita entro 10 giorni dalla scadenza, dello stesso conto se indicato, con la parola da riconoscere. */
function movimentoDi(sp, scad, uscite) {
  if (!sp.riconosci || !scad) return null;
  const parola = normaNome(sp.riconosci), t = tempo(scad);
  return uscite.find(m => Math.abs(tempo(m.data) - t) <= 10 * MS_G && (!sp.conto || normaNome(m.conto) === normaNome(sp.conto)) && normaNome(m.descrizione).includes(parola)) || null;
}
function righeSpese(mese) {
  const uscite = voci('finanze', 'movimento').filter(m => m.valore < 0);
  return voci('finanze', 'spesa').filter(spesaAttiva).map(sp => {
    const scad = scadenzaNelMese(sp, mese);
    if (!scad) return null;
    const mov = movimentoDi(sp, scad, uscite), aMano = mesiPagati(sp).includes(mese);
    return { sp, scad, mov, pagata: !!mov || aMano, aMano, importo: mov ? Math.abs(mov.valore) : sp.valore };
  }).filter(Boolean).sort((a, b) => a.pagata - b.pagata || a.scad.localeCompare(b.scad) || a.sp.titolo.localeCompare(b.sp.titolo, 'it'));
}
function speseDaPagareOggi() {
  const domani = piuGiorni(oggi(), 1);
  return righeSpese(oggi().slice(0, 7)).filter(r => !r.pagata && r.scad <= domani).length;
}
function segnaPagata(sp, mese, si) {
  const l = mesiPagati(sp).filter(m => m !== mese), { pagati, ...resto } = sp;
  if (si) l.push(mese);
  metti(l.length ? { ...resto, pagati: l.sort().join(', ') } : resto);
  avviso(si ? `${sp.titolo}: segnata pagata.` : `${sp.titolo}: di nuovo da pagare.`);
}
const eOccasionale = sp => sp.frequenza === OCCASIONALE;
/* Tipo della spesa: ricorrente (verde, con la frequenza) oppure occasionale (viola). */
const etichettaTipo = sp => eOccasionale(sp) ? h('span', { class: 'etichetta e-viola', title: 'Spesa occasionale, una volta sola' }, 'occasionale') : h('span', { class: 'etichetta e-verde', title: 'Spesa ricorrente' }, '↻ ' + (sp.frequenza || 'mensile'));
/* Conto da cui esce la spesa: BPM personale blu, BPM famiglia giallo, gli altri grigi. */
const etichettaConto = c => {
  if (!c) return null;
  const n = normaNome(c), colore = n.includes('famiglia') ? 'giallo' : n.includes('personale') ? 'blu' : 'grigio';
  return h('span', { class: 'etichetta conto-spesa e-' + colore, title: 'Conto: ' + c }, c);
};
const etichettaDiChi = d => (d ? h('span', { class: 'etichetta e-' + (d === 'mie' ? 'acqua' : 'arancione') }, d) : null);
const mensileEquivalente = sp => (eOccasionale(sp) ? 0 : sp.valore / (MESI_FREQ[sp.frequenza] || 1));
const TIPI_SPESE = { ricorrenti: r => !eOccasionale(r.sp), occasionali: r => eOccasionale(r.sp) };

function vistaSpese(meseRotta) {
  const mese = /^\d{4}-\d{2}$/.test(meseRotta || '') ? meseRotta : oggi().slice(0, 7);
  const nuova = () => apriModulo('finanze', 'spesa', null, { frequenza: 'mensile', di_chi: 'mie', stato: 'attiva', modo: 'addebito automatico', data: oggi() });
  const occasionale = () => apriModulo('finanze', 'spesa', null, { frequenza: OCCASIONALE, di_chi: 'mie', stato: 'attiva', modo: 'carta', data: oggi() });
  const tutte = voci('finanze', 'spesa').filter(spesaAttiva), ricorrenti = tutte.filter(sp => !eOccasionale(sp));
  if (!voci('finanze', 'spesa').length) return h('div', {}, h('div', { class: 'testa' }, h('h1', {}, 'Spese')),
    pannello('', vuoto('Nessuna spesa. Aggiungi mutuo, rate, bollette e abbonamenti, e anche le spese occasionali: qui vedi ogni mese cosa scade e cosa è già pagato, e il giorno prima arriva l\'avviso nel calendario SPESE.', btn('Aggiungi una spesa ricorrente', nuova, 'primario'), btn('Aggiungi una spesa occasionale', occasionale))));
  const chi = DI_CHI_SPESE.includes(S.speseChi) ? S.speseChi : '';
  const tipo = TIPI_SPESE[S.speseTipo] ? S.speseTipo : '';
  const righe = righeSpese(mese), viste = righe.filter(r => (!chi || r.sp.di_chi === chi) && (!tipo || TIPI_SPESE[tipo](r)));
  const tot = l => somma(l.map(r => r.importo));
  const perChi = (l, d) => tot(l.filter(r => r.sp.di_chi === d));
  const daPagare = righe.filter(r => !r.pagata), prossima = daPagare.find(r => r.scad >= oggi());
  const filtro = (valore, testo) => h('button', { type: 'button', class: 'filtro' + (chi === valore ? ' scelto' : ''), 'aria-pressed': chi === valore ? 'true' : 'false', onclick: () => { S.speseChi = valore; disegna(); } }, testo);
  const filtroTipo = (valore, testo) => h('button', { type: 'button', class: 'filtro filtro-tipo' + (tipo === valore ? ' scelto' : ''), 'aria-pressed': tipo === valore ? 'true' : 'false', onclick: () => { S.speseTipo = valore; disegna(); } }, testo);
  const statoRiga = r => {
    if (r.mov) return stato('ok', `pagata il ${fmtData(r.mov.data)}`);
    if (r.aMano) return stato('ok', 'pagata');
    const g = -giorniDaSe(r.scad);
    return g < 0 ? stato('ritardo', `scaduta il ${fmtData(r.scad)}`) : g <= 1 ? stato('ritardo', g === 0 ? 'scade oggi' : 'scade domani') : stato('vuota', 'da pagare');
  };
  const tabella = l => h('div', { class: 'scorri' }, h('table', { class: 'tabella-spese' },
    h('thead', {}, h('tr', {}, ['Giorno', 'Spesa', 'Tipo', 'Di chi', 'Importo', 'Conto', 'Stato', ''].map((t, i) => h('th', { class: i === 4 ? 'destra' : i === 5 ? 'col-conto' : '' }, t)))),
    h('tbody', {}, l.map(r => h('tr', { class: 'cliccabile ' + (eOccasionale(r.sp) ? 'riga-occasionale' : 'riga-ricorrente'), tabindex: 0, title: 'Modifica la spesa', onclick: () => apriModulo('finanze', 'spesa', r.sp), onkeydown: e => { if (e.key === 'Enter') apriModulo('finanze', 'spesa', r.sp); } },
      h('td', { class: 'nonspezza' }, fmtData(r.scad).replace(/ \d{4}$/, '')),
      h('td', {}, h('strong', {}, r.sp.titolo), r.sp.categoria ? h('div', { class: 'attenuato piccolo' }, r.sp.categoria + (r.sp.modo ? ', ' + r.sp.modo : '')) : null, r.sp.conto ? h('div', { class: 'solo-telefono' }, etichettaConto(r.sp.conto)) : null),
      h('td', { class: 'nonspezza' }, etichettaTipo(r.sp)),
      h('td', {}, etichettaDiChi(r.sp.di_chi)),
      h('td', { class: 'num destra nonspezza' }, (r.sp.variabile && !r.mov ? '~ ' : '') + fmtEuro2(r.importo)),
      h('td', { class: 'nonspezza col-conto' }, etichettaConto(r.sp.conto)),
      h('td', {}, statoRiga(r)),
      h('td', { class: 'destra', onclick: e => e.stopPropagation() }, r.mov ? null : btn(r.aMano ? 'Annulla' : 'Pagata', () => segnaPagata(r.sp, mese, !r.aMano), 'piccolo')))))));
  const perTipo = (l, t) => tot(l.filter(TIPI_SPESE[t]));
  const altre = tutte.filter(sp => sp.frequenza && sp.frequenza !== 'mensile' && (!chi || sp.di_chi === chi) && (!tipo || (tipo === 'occasionali') === eOccasionale(sp)) && !scadenzaNelMese(sp, mese))
    .map(sp => ({ sp, d: prossimaScadenza(sp, meseDopo(mese, 1) + '-01') })).filter(x => x.d || !eOccasionale(x.sp)).sort((a, b) => (a.d || '9').localeCompare(b.d || '9'));
  const equivalente = d => somma(ricorrenti.filter(sp => !d || sp.di_chi === d).map(mensileEquivalente));
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, 'Spese'), h('p', { class: 'sotto largo-testo' }, 'Le spese del mese, ricorrenti e occasionali, tue e della famiglia, in un solo elenco. Quando il movimento arriva dalla banca la spesa risulta pagata da sola; il giorno prima di ogni scadenza trovi l\'avviso nel calendario Google SPESE.')),
      h('div', { class: 'azioni' }, btn('Spesa ricorrente', nuova, 'primario'), btn('Spesa occasionale', occasionale))),
    h('nav', { class: 'mese-nav azioni', 'aria-label': 'Mese' },
      h('a', { class: 'btn piccolo', href: '#/spese/' + meseDopo(mese, -1), 'aria-label': 'Mese precedente' }, '‹'),
      h('strong', { class: 'mese-pt' }, meseLungo(mese)),
      h('a', { class: 'btn piccolo', href: '#/spese/' + meseDopo(mese, 1), 'aria-label': 'Mese successivo' }, '›'),
      mese !== oggi().slice(0, 7) ? h('a', { class: 'btn piccolo', href: '#/spese' }, 'Questo mese') : null),
    h('div', { class: 'dati' },
      dato('Ancora da pagare', fmtEuro(tot(daPagare)), [daPagare.length ? `${daPagare.length} ${daPagare.length === 1 ? 'spesa' : 'spese'}` : 'tutto pagato', prossima ? `prossima: ${prossima.sp.titolo}, ${fmtData(prossima.scad)}` : ''].filter(Boolean).join(', '), daPagare.some(r => r.scad < oggi()) ? 'allerta' : ''),
      dato('Spese del mese', fmtEuro(tot(righe)), `mie ${fmtEuro(perChi(righe, 'mie'))}, famiglia ${fmtEuro(perChi(righe, 'famiglia'))}`),
      dato('Già pagate', fmtEuro(tot(righe.filter(r => r.pagata))), `${righe.filter(r => r.pagata).length} su ${righe.length}`),
      dato('Ricorrenti, media al mese', fmtEuro(equivalente()), `mie ${fmtEuro(equivalente('mie'))}, famiglia ${fmtEuro(equivalente('famiglia'))}`)),
    h('div', { class: 'azioni filtri' }, h('span', { class: 'attenuato piccolo' }, 'Mostra:'), filtro('', 'Tutte'), filtro('mie', 'Mie'), filtro('famiglia', 'Famiglia'),
      h('span', { class: 'attenuato piccolo separa-filtri' }, 'Tipo:'), filtroTipo('', 'Tutti'), filtroTipo('ricorrenti', 'Ricorrenti'), filtroTipo('occasionali', 'Occasionali')),
    pannello('Spese del mese', viste.length ? [tabella(viste), h('p', { class: 'attenuato piccolo' },
      `Totale ${fmtEuro2(tot(viste))}: ricorrenti ${fmtEuro2(perTipo(viste, 'ricorrenti'))}, occasionali ${fmtEuro2(perTipo(viste, 'occasionali'))}; mie ${fmtEuro2(perChi(viste, 'mie'))}, famiglia ${fmtEuro2(perChi(viste, 'famiglia'))}.`)]
      : h('p', { class: 'attenuato' }, righe.length ? 'Nessuna spesa con questi filtri.' : 'Questo mese non scade nessuna spesa.')),
    altre.length ? pannello('Prossime scadenze negli altri mesi', h('ul', { class: 'elenco' }, altre.map(({ sp, d }) =>
      h('li', { class: 'tra cliccabile', tabindex: 0, onclick: () => apriModulo('finanze', 'spesa', sp) }, h('span', {}, h('strong', {}, sp.titolo), ' ', etichettaTipo(sp), ' ', etichettaDiChi(sp.di_chi), ' ', etichettaConto(sp.conto), h('span', { class: 'attenuato' }, ` ${fmtEuro2(sp.valore)}`)), h('span', { class: 'attenuato nonspezza' }, d ? fmtData(d) : 'finita'))))) : null,
    h('div', { class: 'azioni' }, h('a', { class: 'btn piccolo', href: '#/a/finanze/spesa' }, 'Tutte le spese in tabella')));
}
const fmtEuro2 = n => (n == null || isNaN(n) ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(+n) ? 0 : 2, maximumFractionDigits: 2 }));
