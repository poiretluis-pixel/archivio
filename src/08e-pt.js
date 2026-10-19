/* ===== 8e. Personal trainer: clienti, presenze del mese e conteggi da fatturare =====
   Le presenze dei clienti arrivano dal calendario Google "Personal trainer" (le carica Claude ogni sera, origine "calendario")
   oppure si aggiungono a mano. Le lezioni del corso posturale sono presenze con cliente "Corso posturale": i presenti si spuntano qui.
   L'importo del mese è sedute × euro a seduta, oppure la cifra fissa mensile. Un conteggio salvato vale più del calcolo. */
const CORSO_PT = 'Corso posturale';
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const normaNome = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
const clientiPt = () => voci('pt', 'cliente').sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));
const lezioneCorso = x => normaNome(x.cliente) === normaNome(CORSO_PT);
const presenzeFatte = () => voci('pt', 'presenza').filter(x => (x.stato || 'fatta') === 'fatta');
const partecipantiDi = x => String(x.partecipanti || '').split(',').map(t => t.trim()).filter(Boolean);
/* Presenze di un cliente: le sue sedute più le lezioni del corso in cui è segnato tra i presenti. */
function presenzeCliente(c, lista = presenzeFatte()) {
  const n = normaNome(c.titolo);
  return lista.filter(x => (lezioneCorso(x) ? partecipantiDi(x).some(p => normaNome(p) === n) : normaNome(x.cliente) === n)).sort(perData);
}
const delMese = (l, mese) => l.filter(x => (x.data || '').startsWith(mese));
const attivoPt = c => (c.stato || 'attivo') === 'attivo';
/* Importo del mese: cifra fissa mensile, altrimenti per ogni seduta il suo importo (quando varia) o la tariffa. Senza tariffa resta da indicare. */
function importoCalcolato(c, pres) {
  if (c.tariffa_mese) return pres.length ? c.tariffa_mese : 0;
  let tot = 0;
  for (const x of pres) { const v = typeof x.importo === 'number' && !lezioneCorso(x) ? x.importo : c.tariffa; if (typeof v !== 'number') return null; tot += v; }
  return tot;
}
const etichettaPagamento = p => (p ? h('span', { class: 'etichetta e-' + (p === 'contanti' ? 'verde' : 'blu') }, p) : h('span', { class: 'attenuato piccolo' }, '?'));
/* Giorni in cui viene di solito: i giorni della settimana con almeno due presenze negli ultimi 60 giorni, con l'ora più frequente. */
function giorniAbituali(pres) {
  const recenti = pres.filter(x => giorniDa(x.data) >= 0 && giorniDa(x.data) < 60);
  const conta = new Map(), ore = new Map();
  for (const d of new Set(recenti.map(x => x.data))) { const g = new Date(tempo(d)).getUTCDay(); conta.set(g, (conta.get(g) || 0) + 1); }
  for (const x of recenti) if (x.ora) ore.set(x.ora, (ore.get(x.ora) || 0) + 1);
  const giorni = [1, 2, 3, 4, 5, 6, 0].filter(g => (conta.get(g) || 0) >= 2).map(g => GIORNI_BREVI[g]);
  if (!giorni.length) return '';
  const ora = [...ore].sort((a, b) => b[1] - a[1])[0];
  return giorni.join(', ') + (ora ? ', ' + ora[0] : '');
}
function statoScheda(c) {
  if (!c.scheda_fine) return { testo: c.scheda ? c.scheda : '', tipo: '' };
  const g = -giorniDa(c.scheda_fine);
  return g < 0 ? { testo: `scaduta il ${fmtData(c.scheda_fine)}`, tipo: 'ritardo' } : g <= 14 ? { testo: `scade il ${fmtData(c.scheda_fine)}`, tipo: 'vuota' } : { testo: `fino al ${fmtData(c.scheda_fine)}`, tipo: 'ok' };
}
function pacchettoUsato(c, pres) {
  if (!c.pacchetto) return '';
  const usate = pres.filter(x => !c.pacchetto_dal || x.data >= c.pacchetto_dal).length;
  return `${usate} su ${c.pacchetto}`;
}
const meseDopo = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const meseLungo = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, 15)).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const titolarePt = () => (S.A.persone.find(p => !p.canc && p.ruolo === 'titolare') || S.A.persone.find(p => !p.canc) || {}).id;
const conteggioDi = (c, mese) => voci('pt', 'conteggio').find(x => (x.data || '').startsWith(mese) && normaNome(x.cliente) === normaNome(c.titolo));

/* Righe del mese: per ogni cliente attivo o con sedute nel mese. */
function righeMesePt(mese) {
  const tutte = presenzeFatte();
  return clientiPt().map(c => {
    const pres = presenzeCliente(c, tutte), mesePres = delMese(pres, mese), salvato = conteggioDi(c, mese);
    const calc = importoCalcolato(c, mesePres);
    return { c, pres, sedute: mesePres.length, calc, salvato, importo: salvato ? salvato.valore : calc };
  });
}
function registraConteggi(mese, righe) {
  const da = righe.filter(r => !r.salvato && r.sedute && r.calc != null);
  if (!da.length) { avviso('Niente da registrare: i conteggi del mese sono già salvati o manca la tariffa.'); return; }
  for (const r of da) metti({ area: 'pt', tipo: 'conteggio', persona: titolarePt(), data: mese + '-01', cliente: r.c.titolo, sedute: r.sedute, valore: r.calc, ...(r.c.pagamento ? { pagamento: r.c.pagamento } : {}), origine: 'calcolo' }, false);
  disegna(); avviso(`Registrati ${da.length} conteggi di ${meseLungo(mese)}.`);
}
function segnaPresenti(lezione) {
  const corsisti = clientiPt().filter(c => c.servizio === CORSO_PT && attivoPt(c));
  const gia = new Set(partecipantiDi(lezione).map(normaNome));
  const caselle = corsisti.map(c => h('label', { class: 'campo riga' }, h('input', { type: 'checkbox', value: c.titolo, checked: gia.has(normaNome(c.titolo)) }), h('span', {}, c.titolo)));
  apriModale(`Presenti al corso del ${fmtData(lezione.data)}`, h('div', {},
    corsisti.length ? h('div', { class: 'modulo' }, caselle) : h('p', { class: 'attenuato' }, 'Nessun cliente con servizio "Corso posturale". Indicalo nella scheda del cliente.'),
    h('div', { class: 'azioni' }, btn('Salva', () => {
      const scelti = caselle.map(l => l.querySelector('input')).filter(i => i.checked).map(i => i.value);
      const { partecipanti, ...resto } = lezione;
      metti(scelti.length ? { ...resto, partecipanti: scelti.join(', ') } : resto); chiudiModale(); avviso(`Presenti: ${scelti.length}.`);
    }, 'primario'), btn('Annulla', chiudiModale))));
}
function abbina(x, nome) {
  if (!nome) return;
  metti({ ...x, cliente: nome, stato: 'fatta' }); avviso(`Presenza abbinata a ${nome}.`);
}

/* --- Sedute di un cliente nel mese: aggiungere, spostare, togliere --- */
const ultimoDelMese = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
const giornoNelMese = m => (oggi().startsWith(m) ? oggi() : ultimoDelMese(m));
function aggiungiSeduta(c, data) {
  if (!data) return;
  metti({ area: 'pt', tipo: 'presenza', persona: titolarePt(), data, cliente: c.titolo, stato: 'fatta', origine: 'a mano' });
  avviso(`Seduta del ${fmtData(data)} aggiunta.`);
}
/* Una seduta del calendario non si cancella ma si annulla, così l'aggiornamento della sera non la rimette; per il corso si toglie solo il nome dai presenti. */
function togliSeduta(c, x) {
  if (lezioneCorso(x)) {
    const resto = partecipantiDi(x).filter(p => normaNome(p) !== normaNome(c.titolo)), { partecipanti, ...v } = x;
    metti(resto.length ? { ...v, partecipanti: resto.join(', ') } : v);
  } else if (x.origine === 'calendario') metti({ ...x, stato: 'annullata', a_mano: true });
  else togli('voci', x.id);
  avviso(`Seduta del ${fmtData(x.data)} tolta.`);
}
function dettaglioMesePt(c, mese) {
  const riapri = () => dettaglioMesePt(voce(c.id) || c, mese);
  const pres = delMese(presenzeCliente(c), mese), calc = importoCalcolato(c, pres), salvato = conteggioDi(c, mese);
  const nuovaData = h('input', { type: 'date', value: giornoNelMese(mese), 'aria-label': 'Giorno della nuova seduta' });
  const riga = x => h('li', { class: 'seduta-pt' },
    h('input', { type: 'date', value: x.data, disabled: lezioneCorso(x), 'aria-label': 'Giorno della seduta', onchange: e => { if (!e.target.value) return; metti({ ...x, data: e.target.value, a_mano: true }); avviso(`Spostata al ${fmtData(e.target.value)}.`); riapri(); } }),
    h('span', { class: 'attenuato piccolo' }, [x.ora, lezioneCorso(x) ? 'lezione del corso' : x.origine === 'calendario' ? 'dal calendario' : 'aggiunta a mano'].filter(Boolean).join(', ')),
    lezioneCorso(x) ? null : h('label', { class: 'importo-seduta' }, h('span', { class: 'attenuato piccolo' }, '€'),
      h('input', { type: 'number', min: 0, step: 1, inputmode: 'decimal', value: typeof x.importo === 'number' ? x.importo : '', placeholder: typeof c.tariffa === 'number' ? String(c.tariffa) : '', 'aria-label': 'Importo di questa seduta',
        onchange: e => { const n = e.target.value === '' ? null : Number(e.target.value); const { importo, ...v } = x; metti(n == null || isNaN(n) ? v : { ...v, importo: n }); riapri(); } })),
    btn('Togli', () => { togliSeduta(c, x); riapri(); }, 'piccolo'));
  apriModale(`${c.titolo}, ${meseLungo(mese)}`, h('div', {},
    h('p', { class: 'sotto' }, [`${pres.length} ${pres.length === 1 ? 'seduta' : 'sedute'}`, calc == null ? 'tariffa da indicare' : fmtEuro(calc), c.pagamento ? 'paga con ' + c.pagamento : '', c.tariffa_mese ? `${fmtEuro(c.tariffa_mese)} al mese` : typeof c.tariffa === 'number' ? `${fmtEuro(c.tariffa)} a seduta` : ''].filter(Boolean).join(', ')),
    salvato && salvato.valore !== calc ? h('p', { class: 'attenuato piccolo' }, `Conteggio già registrato per questo mese: ${fmtEuro(salvato.valore)}. Se hai cambiato le sedute, aggiornalo da "Conteggi e incassi".`) : null,
    pres.length ? h('ul', { class: 'elenco' }, pres.map(riga)) : h('p', { class: 'attenuato' }, 'Nessuna seduta in questo mese.'),
    h('div', { class: 'azioni' }, nuovaData, btn('Aggiungi una seduta', () => { aggiungiSeduta(c, nuovaData.value); riapri(); }, 'primario')),
    h('p', { class: 'attenuato piccolo' }, 'Cambia il giorno con il calendario della riga. L\'importo della singola seduta serve solo quando il prezzo varia: vuoto vuol dire tariffa normale.'),
    h('div', { class: 'azioni' }, btn('Modifica i dati del cliente', () => { chiudiModale(); apriModulo('pt', 'cliente', voce(c.id) || c); }), btn('Chiudi', chiudiModale))), true);
}

function vistaPt(meseRotta) {
  const mese = /^\d{4}-\d{2}$/.test(meseRotta || '') ? meseRotta : oggi().slice(0, 7);
  const tutte = righeMesePt(mese), righe = tutte.filter(r => r.sedute || r.salvato || attivoPt(r.c));
  const clienti = clientiPt(), attivi = clienti.filter(attivoPt), inattivi = clienti.filter(c => !attivoPt(c));
  const vedi = S.ptClienti === 'inattivi' ? 'inattivi' : 'attivi', pag = PAGAMENTI_PT.includes(S.ptPagamento) ? S.ptPagamento : '';
  const mostrate = (vedi === 'inattivi' ? tutte.filter(r => !attivoPt(r.c)) : righe).filter(r => !pag || r.c.pagamento === pag);
  const perPag = p => somma(righe.filter(r => r.c.pagamento === p).map(r => r.importo || 0));
  const filtro = (chiave, valore, testo, scelto) => h('button', { type: 'button', class: 'filtro' + (scelto ? ' scelto' : ''), 'aria-pressed': scelto ? 'true' : 'false', onclick: () => { S[chiave] = valore; disegna(); } }, testo);
  const nuovaPresenza = () => apriModulo('pt', 'presenza', null, { data: oggi(), stato: 'fatta', origine: 'a mano' });
  if (!clienti.length && !voci('pt', 'presenza').length) return h('div', {}, h('div', { class: 'testa' }, h('h1', {}, 'Personal trainer')),
    pannello('', vuoto('Nessun cliente. Aggiungi i clienti con il nome che usi nel calendario Personal trainer: le presenze arrivano da sole ogni sera.', btn('Aggiungi un cliente', () => apriModulo('pt', 'cliente', null, { stato: 'attivo', servizio: 'Personal' }), 'primario'))));
  const totSedute = somma(righe.map(r => r.sedute)), totImporto = somma(righe.map(r => r.importo || 0)), senzaTariffa = righe.filter(r => r.sedute && r.importo == null).length;
  const daRinnovare = attivi.filter(c => c.ha_scheda && ['ritardo', 'vuota'].includes(statoScheda(c).tipo));
  const daAbbinare = voci('pt', 'presenza').filter(x => x.stato === 'da abbinare').sort(perData);
  const lezioni = delMese(presenzeFatte().filter(lezioneCorso), mese).sort(perData);
  const incassato = somma(voci('pt', 'conteggio').filter(x => x.data.startsWith(mese) && x.incassato).map(x => x.valore));
  /* Andamento dell'anno: conteggi salvati, e per i mesi senza conteggi il calcolo dalle presenze. */
  const anno = mese.slice(0, 4), mesi = Array.from({ length: 12 }, (_, i) => `${anno}-${String(i + 1).padStart(2, '0')}`).filter(m => m <= oggi().slice(0, 7));
  const perMese = mesi.map(m => { const salvati = voci('pt', 'conteggio').filter(x => x.data.startsWith(m)); return salvati.length ? somma(salvati.map(x => x.valore)) : somma(righeMesePt(m).map(r => r.importo || 0)); });
  const cella = (txt, cl = '') => h('td', { class: cl }, txt);
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, 'Personal trainer'), h('p', { class: 'sotto largo-testo' }, 'Le presenze arrivano ogni sera dal calendario Personal trainer. Qui vedi sedute e importi del mese, pacchetti, schede e giorni abituali di ogni cliente.')),
      h('div', { class: 'azioni' }, btn('Aggiungi una presenza', nuovaPresenza, 'primario'), btn('Aggiungi un cliente', () => apriModulo('pt', 'cliente', null, { stato: 'attivo', servizio: 'Personal' })))),
    h('nav', { class: 'mese-nav azioni', 'aria-label': 'Mese' },
      h('a', { class: 'btn piccolo', href: '#/pt/' + meseDopo(mese, -1), 'aria-label': 'Mese precedente' }, '‹'),
      h('strong', { class: 'mese-pt' }, meseLungo(mese)),
      h('a', { class: 'btn piccolo', href: '#/pt/' + meseDopo(mese, 1), 'aria-label': 'Mese successivo' }, '›'),
      mese !== oggi().slice(0, 7) ? h('a', { class: 'btn piccolo', href: '#/pt' }, 'Questo mese') : null),
    h('div', { class: 'dati' }, dato('Sedute nel mese', totSedute, lezioni.length ? `${lezioni.length} lezioni del corso` : ''),
      dato('Da fatturare', fmtEuro(totImporto), [`contanti ${fmtEuro(perPag('contanti'))}, carta ${fmtEuro(perPag('carta'))}`, senzaTariffa ? `${senzaTariffa} senza tariffa` : '', incassato ? `incassati ${fmtEuro(incassato)}` : ''].filter(Boolean).join('; '), senzaTariffa ? 'allerta' : ''),
      dato('Clienti attivi', attivi.length, `${inattivi.length} inattivi`), dato('Schede da rinnovare', daRinnovare.length, '', daRinnovare.length ? 'allerta' : '')),
    daAbbinare.length ? pannello('Presenze da abbinare', h('p', { class: 'attenuato piccolo' }, 'Appuntamenti del calendario con un nome che non corrisponde a nessun cliente. Sceglilo una volta: poi aggiungi quel nome nel campo "Come compare nel calendario" del cliente.'),
      h('ul', { class: 'elenco' }, daAbbinare.map(x => h('li', { class: 'tra' }, h('span', {}, h('strong', {}, x.cliente), h('span', { class: 'attenuato' }, ` ${fmtData(x.data)}${x.ora ? ', ' + x.ora : ''}`)),
        h('span', { class: 'azioni' }, h('select', { 'aria-label': 'Cliente per ' + x.cliente, onchange: e => abbina(x, e.target.value) }, h('option', { value: '' }, 'Scegli il cliente…'), [CORSO_PT, ...clienti.map(c => c.titolo)].map(n => h('option', { value: n }, n))),
          btn('Non è una seduta', () => { metti({ ...x, stato: 'annullata' }); avviso('Presenza scartata.'); }, 'piccolo')))))) : null,
    pannello('Clienti del mese',
      h('div', { class: 'azioni filtri' }, h('span', { class: 'attenuato piccolo' }, 'Clienti:'), filtro('ptClienti', 'attivi', `Attivi (${attivi.length})`, vedi === 'attivi'), filtro('ptClienti', 'inattivi', `Inattivi (${inattivi.length})`, vedi === 'inattivi'),
        h('span', { class: 'attenuato piccolo' }, 'Pagamento:'), filtro('ptPagamento', '', 'Tutti', !pag), filtro('ptPagamento', 'contanti', 'Contanti', pag === 'contanti'), filtro('ptPagamento', 'carta', 'Carta', pag === 'carta')),
      mostrate.length ? h('div', { class: 'scorri' }, h('table', { class: 'tabella-pt' },
      h('thead', {}, h('tr', {}, ['Cliente', 'Paga con', 'Giorni abituali', 'Sedute', 'Importo', 'Pacchetto', 'Scheda', 'Ultima volta'].map((t, i) => h('th', { class: [3, 4].includes(i) ? 'destra' : '' }, t)))),
      h('tbody', {}, mostrate.map(r => { const sc = statoScheda(r.c), ult = r.pres[r.pres.length - 1];
        const apri = () => dettaglioMesePt(r.c, mese), ferma = e => e.stopPropagation();
        return h('tr', { class: 'cliccabile', tabindex: 0, title: 'Apri le sedute del mese', onclick: apri, onkeydown: e => { if (e.key === 'Enter') apri(); } },
          cella(h('span', {}, h('strong', {}, r.c.titolo), r.c.servizio === CORSO_PT ? h('span', { class: 'attenuato piccolo' }, ' corso') : null, !attivoPt(r.c) ? h('span', { class: 'attenuato piccolo' }, ' inattivo') : null)),
          cella(etichettaPagamento(r.c.pagamento)), cella(giorniAbituali(r.pres), 'attenuato'), cella(h('span', { class: 'contatore-pt', onclick: ferma },
            h('button', { type: 'button', class: 'btn piccolo', 'aria-label': 'Togli una seduta a ' + r.c.titolo, disabled: !r.sedute, onclick: () => { const m = delMese(r.pres, mese); if (m.length) togliSeduta(r.c, m[m.length - 1]); } }, '−'),
            h('strong', { class: 'num' }, String(r.sedute)),
            h('button', { type: 'button', class: 'btn piccolo', 'aria-label': 'Aggiungi una seduta a ' + r.c.titolo, onclick: () => aggiungiSeduta(r.c, giornoNelMese(mese)) }, '+')), 'destra nonspezza'),
          cella(r.importo == null ? (r.sedute ? 'tariffa?' : '') : fmtEuro(r.importo) + (r.salvato ? (r.salvato.incassato ? ' ✓' : '') : ''), 'num destra nonspezza' + (r.importo == null && r.sedute ? ' fuori' : '')),
          cella(pacchettoUsato(r.c, r.pres)), cella(h('span', { class: 'scheda-pt', onclick: ferma }, h('button', { type: 'button', class: 'filtro' + (r.c.ha_scheda ? ' scelto' : ''), 'aria-pressed': r.c.ha_scheda ? 'true' : 'false', title: 'Tocca per cambiare', 'aria-label': (r.c.ha_scheda ? 'Ha la scheda: ' : 'Senza scheda: ') + r.c.titolo,
            onclick: () => { const { ha_scheda, ...v } = r.c; metti(r.c.ha_scheda ? v : { ...v, ha_scheda: true }); avviso(r.c.ha_scheda ? `${r.c.titolo}: senza scheda.` : `${r.c.titolo}: ha la scheda.`); } }, r.c.ha_scheda ? 'sì' : 'no'),
            r.c.ha_scheda && sc.testo ? (sc.tipo ? stato(sc.tipo, sc.testo) : h('span', { class: 'attenuato piccolo' }, sc.testo)) : null)), cella(ult ? fmtData(ult.data) : '', 'nonspezza'));
      })))) : h('p', { class: 'attenuato' }, vedi === 'inattivi' ? 'Nessun cliente inattivo.' : 'Nessuna seduta in questo mese.'),
      h('p', { class: 'attenuato piccolo' }, 'Tocca un cliente per vedere e modificare le sedute del mese, giorno per giorno; con − e + togli l\'ultima seduta o ne aggiungi una oggi. Nella colonna Scheda tocca sì o no per cambiarlo. Importo: sedute per euro a seduta, oppure la cifra fissa mensile; per le sedute con prezzo variabile (come le sostituzioni del corso) vale l\'importo scritto nella presenza. Dopo "Registra i conteggi" l\'importo resta fisso e puoi segnarlo come incassato. ✓ vuol dire incassato.'),
      h('div', { class: 'azioni' }, btn('Registra i conteggi del mese', () => registraConteggi(mese, righe), 'piccolo'), h('a', { class: 'btn piccolo', href: '#/a/pt/conteggio' }, 'Conteggi e incassi'), h('a', { class: 'btn piccolo', href: '#/a/pt/presenza' }, 'Tutte le presenze'), h('a', { class: 'btn piccolo', href: '#/a/pt/cliente' }, 'Tutti i clienti'))),
    lezioni.length ? pannello('Corso posturale', h('ul', { class: 'elenco' }, lezioni.map(x => h('li', { class: 'tra' },
      h('span', {}, h('strong', {}, fmtData(x.data) + (x.ora ? ', ' + x.ora : '')), h('span', { class: 'attenuato' }, partecipantiDi(x).length ? ` ${partecipantiDi(x).join(', ')}` : ' presenti da segnare')),
      btn(partecipantiDi(x).length ? `Presenti (${partecipantiDi(x).length})` : 'Segna i presenti', () => segnaPresenti(x), 'piccolo'))))) : null,
    daRinnovare.length ? pannello('Schede da rinnovare', h('ul', { class: 'elenco' }, daRinnovare.map(c => h('li', { class: 'tra' }, h('strong', {}, c.titolo), stato(statoScheda(c).tipo, statoScheda(c).testo), btn('Aggiorna la scheda', () => apriModulo('pt', 'cliente', c), 'piccolo'))))) : null,
    perMese.some(v => v > 0) ? pannello(`Incassi del ${anno}`, grafico(`Importi per mese del ${anno}`, w => graficoBarre(w, { categorie: mesi.map(m => fmtMese(m).replace(/ \d{4}$/, '')), serie: [{ nome: 'Importo', classe: 'g-barra1', valori: perMese }], fmt: v => fmtNum(v, 0) })),
      h('p', { class: 'attenuato piccolo' }, `Totale ${fmtEuro(somma(perMese))}, media ${fmtEuro(somma(perMese) / Math.max(1, perMese.filter(v => v > 0).length))} al mese.`)) : null);
}
