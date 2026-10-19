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
function importoCalcolato(c, sedute) {
  if (c.tariffa_mese) return sedute ? c.tariffa_mese : 0;
  return typeof c.tariffa === 'number' ? sedute * c.tariffa : null;
}
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
    const calc = importoCalcolato(c, mesePres.length);
    return { c, pres, sedute: mesePres.length, calc, salvato, importo: salvato ? salvato.valore : calc };
  }).filter(r => r.sedute || r.salvato || (r.c.stato || 'attivo') === 'attivo');
}
function registraConteggi(mese, righe) {
  const da = righe.filter(r => !r.salvato && r.sedute && r.calc != null);
  if (!da.length) { avviso('Niente da registrare: i conteggi del mese sono già salvati o manca la tariffa.'); return; }
  for (const r of da) metti({ area: 'pt', tipo: 'conteggio', persona: titolarePt(), data: mese + '-01', cliente: r.c.titolo, sedute: r.sedute, valore: r.calc, origine: 'calcolo' }, false);
  disegna(); avviso(`Registrati ${da.length} conteggi di ${meseLungo(mese)}.`);
}
function segnaPresenti(lezione) {
  const corsisti = clientiPt().filter(c => c.servizio === CORSO_PT && c.stato !== 'concluso');
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

function vistaPt(meseRotta) {
  const mese = /^\d{4}-\d{2}$/.test(meseRotta || '') ? meseRotta : oggi().slice(0, 7);
  const righe = righeMesePt(mese);
  const clienti = clientiPt(), attivi = clienti.filter(c => (c.stato || 'attivo') === 'attivo');
  const nuovaPresenza = () => apriModulo('pt', 'presenza', null, { data: oggi(), stato: 'fatta', origine: 'a mano' });
  if (!clienti.length && !voci('pt', 'presenza').length) return h('div', {}, h('div', { class: 'testa' }, h('h1', {}, 'Personal trainer')),
    pannello('', vuoto('Nessun cliente. Aggiungi i clienti con il nome che usi nel calendario Personal trainer: le presenze arrivano da sole ogni sera.', btn('Aggiungi un cliente', () => apriModulo('pt', 'cliente', null, { stato: 'attivo', servizio: 'Personal' }), 'primario'))));
  const totSedute = somma(righe.map(r => r.sedute)), totImporto = somma(righe.map(r => r.importo || 0)), senzaTariffa = righe.filter(r => r.sedute && r.importo == null).length;
  const daRinnovare = attivi.filter(c => ['ritardo', 'vuota'].includes(statoScheda(c).tipo));
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
      dato('Da fatturare', fmtEuro(totImporto), senzaTariffa ? `${senzaTariffa} clienti senza tariffa` : incassato ? `incassati ${fmtEuro(incassato)}` : '', senzaTariffa ? 'allerta' : ''),
      dato('Clienti attivi', attivi.length), dato('Schede da rinnovare', daRinnovare.length, '', daRinnovare.length ? 'allerta' : '')),
    daAbbinare.length ? pannello('Presenze da abbinare', h('p', { class: 'attenuato piccolo' }, 'Appuntamenti del calendario con un nome che non corrisponde a nessun cliente. Sceglilo una volta: poi aggiungi quel nome nel campo "Come compare nel calendario" del cliente.'),
      h('ul', { class: 'elenco' }, daAbbinare.map(x => h('li', { class: 'tra' }, h('span', {}, h('strong', {}, x.cliente), h('span', { class: 'attenuato' }, ` ${fmtData(x.data)}${x.ora ? ', ' + x.ora : ''}`)),
        h('span', { class: 'azioni' }, h('select', { 'aria-label': 'Cliente per ' + x.cliente, onchange: e => abbina(x, e.target.value) }, h('option', { value: '' }, 'Scegli il cliente…'), [CORSO_PT, ...clienti.map(c => c.titolo)].map(n => h('option', { value: n }, n))),
          btn('Non è una seduta', () => { metti({ ...x, stato: 'annullata' }); avviso('Presenza scartata.'); }, 'piccolo')))))) : null,
    pannello('Clienti del mese', righe.length ? h('div', { class: 'scorri' }, h('table', { class: 'tabella-pt' },
      h('thead', {}, h('tr', {}, ['Cliente', 'Giorni abituali', 'Sedute', 'Importo', 'Pacchetto', 'Scheda', 'Ultima volta'].map((t, i) => h('th', { class: [2, 3].includes(i) ? 'destra' : '' }, t)))),
      h('tbody', {}, righe.map(r => { const sc = statoScheda(r.c), ult = r.pres[r.pres.length - 1];
        return h('tr', { class: 'cliccabile', tabindex: 0, onclick: () => apriModulo('pt', 'cliente', r.c), onkeydown: e => { if (e.key === 'Enter') apriModulo('pt', 'cliente', r.c); } },
          cella(h('span', {}, h('strong', {}, r.c.titolo), r.c.servizio === CORSO_PT ? h('span', { class: 'attenuato piccolo' }, ' corso') : null, r.c.stato && r.c.stato !== 'attivo' ? h('span', { class: 'attenuato piccolo' }, ' ' + r.c.stato) : null)),
          cella(giorniAbituali(r.pres), 'attenuato'), cella(String(r.sedute), 'num destra'),
          cella(r.importo == null ? (r.sedute ? 'tariffa?' : '') : fmtEuro(r.importo) + (r.salvato ? (r.salvato.incassato ? ' ✓' : '') : ''), 'num destra nonspezza' + (r.importo == null && r.sedute ? ' fuori' : '')),
          cella(pacchettoUsato(r.c, r.pres)), cella(sc.testo ? (sc.tipo ? stato(sc.tipo, sc.testo) : sc.testo) : ''), cella(ult ? fmtData(ult.data) : '', 'nonspezza'));
      })))) : h('p', { class: 'attenuato' }, 'Nessuna seduta in questo mese.'),
      h('p', { class: 'attenuato piccolo' }, 'Importo: sedute per euro a seduta, oppure la cifra fissa mensile. Dopo "Registra i conteggi" l\'importo resta fisso e puoi segnarlo come incassato. ✓ vuol dire incassato.'),
      h('div', { class: 'azioni' }, btn('Registra i conteggi del mese', () => registraConteggi(mese, righe), 'piccolo'), h('a', { class: 'btn piccolo', href: '#/a/pt/conteggio' }, 'Conteggi e incassi'), h('a', { class: 'btn piccolo', href: '#/a/pt/presenza' }, 'Tutte le presenze'), h('a', { class: 'btn piccolo', href: '#/a/pt/cliente' }, 'Tutti i clienti'))),
    lezioni.length ? pannello('Corso posturale', h('ul', { class: 'elenco' }, lezioni.map(x => h('li', { class: 'tra' },
      h('span', {}, h('strong', {}, fmtData(x.data) + (x.ora ? ', ' + x.ora : '')), h('span', { class: 'attenuato' }, partecipantiDi(x).length ? ` ${partecipantiDi(x).join(', ')}` : ' presenti da segnare')),
      btn(partecipantiDi(x).length ? `Presenti (${partecipantiDi(x).length})` : 'Segna i presenti', () => segnaPresenti(x), 'piccolo'))))) : null,
    daRinnovare.length ? pannello('Schede da rinnovare', h('ul', { class: 'elenco' }, daRinnovare.map(c => h('li', { class: 'tra' }, h('strong', {}, c.titolo), stato(statoScheda(c).tipo, statoScheda(c).testo), btn('Aggiorna la scheda', () => apriModulo('pt', 'cliente', c), 'piccolo'))))) : null,
    perMese.some(v => v > 0) ? pannello(`Incassi del ${anno}`, grafico(`Importi per mese del ${anno}`, w => graficoBarre(w, { categorie: mesi.map(m => fmtMese(m).replace(/ \d{4}$/, '')), serie: [{ nome: 'Importo', classe: 'g-barra1', valori: perMese }], fmt: v => fmtNum(v, 0) })),
      h('p', { class: 'attenuato piccolo' }, `Totale ${fmtEuro(somma(perMese))}, media ${fmtEuro(somma(perMese) / Math.max(1, perMese.filter(v => v > 0).length))} al mese.`)) : null);
}
