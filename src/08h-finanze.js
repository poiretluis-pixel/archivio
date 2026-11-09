/* ===== 8h. Finanze: una pagina sola con il patrimonio dentro, divisa in sezioni =====
   Panoramica, Conti, Entrate e uscite, Patrimonio, Tetti di spesa. Le sezioni sono linguette in testa alla pagina
   e, sul computer, un sottomenu sotto la voce Finanze. Le spese ricorrenti hanno la loro pagina (#/spese). */

/* Sezione di Finanze indicata dalla rotta: '' per la panoramica, null se la rotta non è una sezione di Finanze. */
function sezioneFinanze(r) {
  if (r[0] !== 'a') return null;
  if (r[1] === 'finanze' && Object.prototype.hasOwnProperty.call(SEZIONI_FINANZE, r[2] || '')) return r[2] || '';
  if (r[1] === 'patrimonio' && !r[2]) return 'patrimonio';
  return null;
}

/* Gli ultimi 12 mesi, dal più vecchio al corrente, nella forma AAAA-MM. */
function ultimi12Mesi() {
  const mesi = []; const o = oggi(); let y = +o.slice(0, 4), m = +o.slice(5, 7);
  for (let i = 0; i < 12; i++) { mesi.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m < 1) { m = 12; y--; } }
  return mesi;
}
function contiFinanze() {
  const saldi = voci('finanze', 'saldo').sort(perData), mov = movimentiReali(), mesi = ultimi12Mesi();
  const date = [...new Set(saldi.map(v => v.data))];
  const serie = date.map(d => ({ data: d, y: totaleFinanze(saldi.filter(v => v.data <= d)) }));
  const ultimi = new Map(); for (const v of saldi) ultimi.set(v.conto, v);
  const entrate = mesi.map(k => somma(mov.filter(v => v.data.startsWith(k) && v.valore > 0).map(v => v.valore)));
  const uscite = mesi.map(k => -somma(mov.filter(v => v.data.startsWith(k) && v.valore < 0).map(v => v.valore)));
  return { saldi, mov, mesi, serie, ultimi, entrate, uscite };
}

const azioniFinanze = (...el) => h('div', { class: 'azioni' }, el);
const linkTabella = (idArea, idTipo, testo) => h('a', { class: 'btn piccolo', href: `#/a/${idArea}/${idTipo}` }, testo);

function vistaFinanze(sez) {
  const k = contiFinanze();
  const corpo = { '': finPanoramica, conti: finConti, movimenti: finMovimenti, patrimonio: finPatrimonio, tetti: finTetti }[sez] || finPanoramica;
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, 'Finanze'), h('p', { class: 'sotto largo-testo' }, 'Conti, entrate e uscite, patrimonio e tetti di spesa. Le spese ricorrenti del mese sono nella pagina Spese.')),
      h('div', { class: 'azioni' }, h('a', { class: 'btn', href: '#/spese' }, 'Vai alle spese'))),
    h('nav', { class: 'schede', 'aria-label': 'Sezioni di Finanze' }, Object.entries(SEZIONI_FINANZE).map(([c, nome]) =>
      h('a', { href: '#/a/finanze' + (c ? '/' + c : ''), class: c === sez ? 'attiva' : '', 'aria-current': c === sez ? 'page' : null }, nome))),
    corpo(k));
}

/* Panoramica: i numeri che contano, l'indice finanziario, i consigli e l'andamento. */
function finPanoramica(k) {
  const { saldi, mov, serie, entrate, uscite, mesi } = k;
  const haPatrimonio = voci('patrimonio', 'bene').length || voci('patrimonio', 'debito').length;
  if (!saldi.length && !mov.length && !haPatrimonio) return pannello('', vuoto('Ancora nessun dato. Il modo più rapido: carica in Documenti i movimenti BPM degli ultimi mesi (Excel o CSV) oppure mandali a Claude in chat. Li classifica lui e da lì si calcolano entrate, uscite, risparmio e indice finanziario.', btn('Aggiungi un saldo', () => apriModulo('finanze', 'saldo'), 'primario'), btn('Importa movimenti', () => apriImportaCsv('finanze', 'movimento'))));
  const ult = serie[serie.length - 1];
  const serieBarre = [{ nome: 'Entrate', classe: 'g-barra1', valori: entrate }, { nome: 'Uscite', classe: 'g-barra2', valori: uscite }];
  const spese = typeof speseDaPagareOggi === 'function' ? speseDaPagareOggi() : 0;
  return [
    h('div', { class: 'dati' },
      saldi.length || haPatrimonio ? dato('Patrimonio netto', fmtEuro(patrimonioNetto()), 'beni e disponibilità meno debiti') : null,
      saldi.length ? dato('Disponibilità sui conti', fmtEuro(ult.y), serie.length > 1 ? `${ult.y >= serie[0].y ? '+' : ''}${fmtEuro(ult.y - serie[0].y)} dal ${fmtData(serie[0].data)}` : `al ${fmtData(ult.data)}`) : null,
      mov.length ? dato('Entrate, ultimi 12 mesi', fmtEuro(somma(entrate))) : null,
      mov.length ? dato('Uscite, ultimi 12 mesi', fmtEuro(somma(uscite)), `risparmio ${fmtEuro(somma(entrate) - somma(uscite))}`) : null,
      spese ? dato('Spese in scadenza', spese, 'entro domani, nella pagina Spese', 'allerta') : null),
    pannelloIndiceFinanze(),
    pannelloConsigli('finanze'),
    serie.length > 1 ? pannello('Disponibilità nel tempo', grafico('Disponibilità finanziaria nel tempo', w => graficoLinea(w, { punti: serie, unita: '€', fmt: v => fmtNum(v, 0) })), h('p', { class: 'attenuato piccolo' }, 'Somma dell\'ultimo saldo noto di ogni conto a ciascuna data. I conti di tipo Debito sono sottratti.')) : null,
    mov.length ? pannello('Entrate e uscite per mese', legenda(serieBarre), grafico('Entrate e uscite per mese', w => graficoBarre(w, { categorie: mesi.map(fmtMese), serie: serieBarre, fmt: v => fmtNum(v, 0) })), azioniFinanze(h('a', { class: 'btn piccolo', href: '#/a/finanze/movimenti' }, 'Dettaglio entrate e uscite'))) : null,
  ];
}

/* Conti: dove sono i soldi oggi e l'ultimo saldo di ogni conto. */
function finConti(k) {
  const { saldi, ultimi, serie } = k;
  const aggiungi = btn('Aggiungi un saldo', () => apriModulo('finanze', 'saldo', null, { data: oggi() }), 'primario');
  if (!saldi.length) return pannello('', vuoto('Nessun saldo registrato. Aggiungi il saldo di ogni conto (BPM personale, BPM famiglia, Postepay…) quando lo controlli: bastano una o due volte al mese.', aggiungi));
  const lista = [...ultimi.values()].sort((a, b) => segnoSaldo(b) - segnoSaldo(a));
  return [
    h('div', { class: 'dati' }, dato('Disponibilità sui conti', fmtEuro(serie[serie.length - 1].y), `${lista.length} ${lista.length === 1 ? 'conto' : 'conti'}`)),
    pannello('Dove sono i soldi oggi', barreOrizzontali(lista.map(v => ({ nome: v.conto, valore: segnoSaldo(v) })), fmtEuro)),
    pannello('Ultimo saldo di ogni conto', h('ul', { class: 'elenco' }, lista.map(v => h('li', { class: 'cliccabile', tabindex: 0, onclick: () => apriModulo('finanze', 'saldo', v) },
      h('div', { class: 'tra' }, h('strong', {}, v.conto), h('span', { class: 'num' }, fmtEuro(segnoSaldo(v)))),
      h('div', { class: 'elenco-nota' }, [v.categoria, `al ${fmtData(v.data)}`].filter(Boolean).join(', '))))),
      azioniFinanze(aggiungi, linkTabella('finanze', 'saldo', 'Storico dei saldi'))),
  ];
}

/* Entrate e uscite: andamento per mese, dove vanno i soldi, ultimi movimenti. */
function finMovimenti(k) {
  const { mov, mesi, entrate, uscite } = k;
  const importa = btn('Importa movimenti', () => apriImportaCsv('finanze', 'movimento'), 'primario');
  const aggiungi = btn('Aggiungi un movimento', () => apriModulo('finanze', 'movimento', null, { data: oggi() }));
  if (!mov.length) return pannello('', vuoto('Nessun movimento. Carica l\'estratto conto BPM (Excel o CSV) in Documenti o mandalo a Claude in chat: classifica lui le voci.', importa, aggiungi));
  const corrente = oggi().slice(0, 7);
  const perCat = [...raggruppa(mov.filter(v => v.valore < 0 && v.data >= mesi[0]), v => v.categoria || 'Senza categoria')].map(([nome, l]) => ({ nome, valore: -somma(l.map(v => v.valore)) })).sort((a, b) => b.valore - a.valore).slice(0, 8);
  const serieBarre = [{ nome: 'Entrate', classe: 'g-barra1', valori: entrate }, { nome: 'Uscite', classe: 'g-barra2', valori: uscite }];
  return [
    h('div', { class: 'dati' },
      dato('Entrate, ultimi 12 mesi', fmtEuro(somma(entrate)), `media ${fmtEuro(somma(entrate) / 12)} al mese`),
      dato('Uscite, ultimi 12 mesi', fmtEuro(somma(uscite)), `media ${fmtEuro(somma(uscite) / 12)} al mese`),
      dato('Risparmio, ultimi 12 mesi', fmtEuro(somma(entrate) - somma(uscite)), somma(entrate) ? `${fmtNum((somma(entrate) - somma(uscite)) / somma(entrate) * 100, 0)}% delle entrate` : ''),
      dato('Questo mese', fmtEuro(entrate[11] - uscite[11]), `entrate ${fmtEuro(entrate[11])}, uscite ${fmtEuro(uscite[11])}`)),
    pannello('Entrate e uscite per mese', legenda(serieBarre), grafico('Entrate e uscite per mese', w => graficoBarre(w, { categorie: mesi.map(fmtMese), serie: serieBarre, fmt: v => fmtNum(v, 0) })),
      h('p', { class: 'attenuato piccolo' }, 'Giroconti, investimenti e prestiti ricevuti non contano: spostano soldi, non li spendono.')),
    perCat.length ? pannello('Uscite per categoria negli ultimi 12 mesi', barreOrizzontali(perCat, fmtEuro)) : null,
    pannello('Ultimi movimenti', tabella('finanze', 'movimento', voci('finanze', 'movimento').filter(v => v.data <= oggi() || v.data.startsWith(corrente)), { limite: 15, filtro: false }),
      azioniFinanze(aggiungi, btn('Importa movimenti', () => apriImportaCsv('finanze', 'movimento')), linkTabella('finanze', 'movimento', 'Tutti i movimenti'))),
  ];
}

/* Patrimonio: beni, debiti e patrimonio netto, insieme alle disponibilità dei conti. */
function finPatrimonio() {
  if (!voci('patrimonio', 'bene').length && !voci('patrimonio', 'debito').length) return cruscottoPatrimonio();
  return [
    ...[].concat(cruscottoPatrimonio()),
    pannelloConsigli('patrimonio'),
    azioniFinanze(btn('Aggiungi un bene', () => apriModulo('patrimonio', 'bene'), 'primario'), btn('Aggiungi un debito', () => apriModulo('patrimonio', 'debito')),
      linkTabella('patrimonio', 'bene', 'Tutti i beni'), linkTabella('patrimonio', 'debito', 'Tutti i debiti')),
  ];
}

/* Tetti di spesa: quanto hai speso nelle categorie che vuoi tenere sotto controllo. */
function finTetti(k) {
  const aggiungi = btn('Aggiungi un tetto', () => apriModulo('finanze', 'budget', null, { data: oggi() }), 'primario');
  if (!voci('finanze', 'budget').length) return pannello('Tetti di spesa', h('p', { class: 'attenuato' }, 'Nessun tetto impostato. Fissane uno per le categorie che vuoi tenere sotto controllo (per esempio ristoranti): l\'indice finanziario controlla ogni mese se lo rispetti.'), azioniFinanze(aggiungi));
  return [pannelloTetti(k.mov), azioniFinanze(aggiungi, linkTabella('finanze', 'budget', 'Tutti i tetti'))];
}
