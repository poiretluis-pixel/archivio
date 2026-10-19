/* ===== 8c. Task, Gestione mail e task personali: liste Oggi, Coda e Archivio =====
   Le cose da fare sono le voci organizzazione/attivita, le mail sono organizzazione/mail (le carica Claude da Gmail).
   I task con etichetta CASA, GIARDINO o PROGETTI sono personali: stanno nella cartella Organizzazione, non nella pagina Task.
   Per i task la scadenza si mette con il calendario della riga; il calendario Google TASK lo aggiorna Claude. */
const listaSalvata = x => (x.lista === 'Domani' ? 'Coda' : x.lista);
/* Un task in Coda o in Archivio passa da solo in Oggi quando arriva la scadenza, a meno che sia stato spostato dopo la scadenza. Le mail restano dove sono. */
function listaDi(x) {
  const l = listaSalvata(x);
  if (x.tipo === 'attivita' && x.data && x.data <= oggi() && l !== 'Oggi' && !(x.lista_dal && x.lista_dal >= x.data)) return 'Oggi';
  if (LISTE_LAVORO.includes(l)) return l;
  if (x.tipo === 'mail') return 'Oggi';
  return x.data ? (x.data <= oggi() ? 'Oggi' : 'Coda') : 'Archivio';
}
const apertaLavoro = x => (x.tipo === 'mail' ? x.stato !== 'gestita' : x.stato !== 'fatta');
function lavoriAperti() {
  return [...voci('organizzazione', 'attivita'), ...voci('organizzazione', 'mail')].filter(apertaLavoro);
}
/* Tipo di pagina: 'attivita' (task di lavoro), 'personale' (task di Organizzazione) o 'mail'. */
const taskPersonale = x => x.tipo === 'attivita' && ETICHETTE_PERSONALI.includes(x.casella);
const tipoPagina = x => (taskPersonale(x) ? 'personale' : x.tipo);
const ordinePriorita = x => (PRIORITA.includes(x.priorita) ? PRIORITA.indexOf(x.priorita) : 1);
function perPrioritaLavoro(a, b) {
  return ordinePriorita(a) - ordinePriorita(b) || perData(a, b);
}
const quantiOggi = tipo => lavoriAperti().filter(x => tipoPagina(x) === tipo && listaDi(x) === 'Oggi').length;
/* Calendario Google TASK: Luis sceglie con un clic quali task mettere (calendario: true); gli eventi li crea, sposta e toglie Claude (evento_id, evento_data). */
function statoCalendario(x) {
  if (!x.data) return '';
  if (!x.calendario) return x.evento_id ? 'esce dal calendario al prossimo aggiornamento' : '';
  return x.evento_id && x.evento_data === x.data ? 'nel calendario TASK' : 'entra nel calendario al prossimo aggiornamento';
}
function pulsanteCalendario(x) {
  if (!x.data) return null;
  return x.calendario
    ? btn('Togli dal calendario', () => { metti({ ...x, calendario: false }); avviso('Esce dal calendario TASK al prossimo aggiornamento.'); }, 'piccolo')
    : btn('Aggiungi al calendario', () => { metti({ ...x, calendario: true }); avviso('Entra nel calendario TASK al prossimo aggiornamento.'); }, 'piccolo');
}
/* Etichette colorate per chi riguarda il task o la mail: Pioltello blu, Porta Romana giallo, Personale rosso; per i task personali CASA viola, GIARDINO verde, PROGETTI acqua. */
const COLORI_ETICHETTA = { '3MEDical Pioltello': 'blu', '3MEDical Porta Romana': 'giallo', 'Personale': 'rosso', '3MEDical': 'blu', 'Psiche e Soma': 'arancione', 'Personal trainer': 'viola', CASA: 'viola', GIARDINO: 'verde', PROGETTI: 'acqua' };
const etichettaColore = nome => (nome ? h('span', { class: 'etichetta e-' + (COLORI_ETICHETTA[nome] || 'grigio') }, nome) : null);
const linkGmail = x => (typeof x.link === 'string' && /^https:\/\/mail\.google\.com\//.test(x.link) ? x.link : '');

/* Prossima scadenza di un task ricorrente: sempre dopo oggi, anche se è stato fatto in ritardo. */
const piuGiorni = (iso, n) => { const d = new Date(tempo(iso) + n * MS_G); return isoData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
function passoRipeti(iso, ripeti) {
  if (ripeti === 'ogni giorno') return piuGiorni(iso, 1);
  if (ripeti === 'nei giorni lavorativi') { let d = piuGiorni(iso, 1); while ([0, 6].includes(new Date(tempo(d)).getUTCDay())) d = piuGiorni(d, 1); return d; }
  if (ripeti === 'ogni settimana') return piuGiorni(iso, 7);
  if (ripeti === 'ogni 2 settimane') return piuGiorni(iso, 14);
  const mesi = { 'ogni mese': 'mensile', 'ogni 3 mesi': 'trimestrale', 'ogni 6 mesi': 'semestrale', 'ogni anno': 'annuale' }[ripeti];
  return mesi ? prossimaData(iso, mesi) : null;
}
function prossimaRipetizione(x) {
  if (!RIPETI_TASK.includes(x.ripeti)) return null;
  let d = passoRipeti(x.data || oggi(), x.ripeti);
  for (let i = 0; d && d <= oggi() && i < 5000; i++) d = passoRipeti(d, x.ripeti);
  return d;
}
function spostaLavoro(x, lista) { metti({ ...x, lista, lista_dal: oggi() }); avviso(`Spostata in ${lista}.`); }
function chiudiLavoro(x) {
  const pros = x.tipo === 'attivita' ? prossimaRipetizione(x) : null;
  if (pros) { metti({ ...x, data: pros, lista: 'Coda', lista_dal: oggi(), fatta_ultima: oggi() }); avviso(`Fatta. Torna il ${fmtData(pros)}.`); return; }
  metti(x.tipo === 'mail' ? { ...x, stato: 'gestita', gestita_il: oggi() } : { ...x, stato: 'fatta', fatta_il: oggi() });
  avviso(x.tipo === 'mail' ? 'Mail segnata come gestita.' : 'Fatta.');
}

function rigaLavoro(x) {
  const l = listaDi(x), mail = x.tipo === 'mail';
  const dove = mail ? x.casella : (x.casella || x.ambito);
  const g = mail ? null : -giorniDaSe(x.data);
  const quando = mail ? `ricevuta il ${fmtData(x.data)}` : !x.data ? '' : g < 0 ? `in ritardo dal ${fmtData(x.data)}` : g === 0 ? 'entro oggi' : `entro il ${fmtData(x.data)}`;
  const link = linkGmail(x);
  return h('li', { class: 'lavoro', 'data-tipo': x.tipo },
    h('div', { class: 'tra' },
      h('span', { class: 'titolo-lavoro' }, etichettaColore(dove), h('strong', {}, x.titolo)),
      x.priorita === 'alta' ? stato('ritardo', 'Priorità alta') : null),
    h('div', { class: 'elenco-nota' }, [mail && x.mittente ? 'da ' + x.mittente : '', quando, !mail && RIPETI_TASK.includes(x.ripeti) ? '↻ si ripete ' + x.ripeti : '', mail && x.stato === 'in attesa di altri' ? 'in attesa di altri' : ''].filter(Boolean).join(', ')),
    x.azione || x.nota ? h('div', { class: 'elenco-nota testo-lungo' }, x.azione || x.nota) : null,
    h('div', { class: 'azioni' },
      btn(mail ? 'Gestita' : 'Fatta', () => chiudiLavoro(x), 'piccolo primario'),
      LISTE_LAVORO.filter(n => n !== l).map(n => btn('In ' + n.toLowerCase(), () => spostaLavoro(x, n), 'piccolo')),
      link ? h('a', { class: 'btn piccolo', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Apri in Gmail') : null,
      mail ? null : h('label', { class: 'scadenza-rapida' }, h('span', { class: 'attenuato piccolo' }, 'Scadenza'),
        h('input', { type: 'date', value: x.data || '', 'aria-label': 'Scadenza di ' + x.titolo, onchange: e => { const d = e.target.value; const { data, ...resto } = x; metti(d ? { ...resto, data: d } : resto); avviso(d ? `Scadenza il ${fmtData(d)}.` : 'Scadenza tolta.'); } })),
      mail ? null : pulsanteCalendario(x),
      !mail && statoCalendario(x) ? h('span', { class: 'attenuato piccolo' }, statoCalendario(x)) : null,
      btn('Modifica', () => apriModulo('organizzazione', x.tipo, x), 'piccolo')));
}

/* Tre pagine: Task (lavoro), Gestione mail e la cartella Organizzazione (task personali). Stesse liste, stesso comportamento. */
const fonteDi = x => (x.tipo === 'mail' ? x.casella : (x.casella || x.ambito));
const SCHEDE_LAVORO = { oggi: 'Oggi', coda: 'Coda', archivio: 'Archivio', tutti: 'Tutti' };
function vistaLavoro(tipo, scheda) {
  const mail = tipo === 'mail', pers = tipo === 'personale';
  const base = mail ? '#/mail/' : pers ? '#/a/organizzazione/' : '#/task/', sc = SCHEDE_LAVORO[scheda] ? scheda : 'oggi';
  const chiave = 'filtro_' + tipo, filtro = S[chiave] || '';
  const tutte = lavoriAperti().filter(x => tipoPagina(x) === tipo);
  const l = tutte.filter(x => !filtro || fonteDi(x) === filtro);
  const fonti = pers ? ETICHETTE_PERSONALI : [...new Set(tutte.map(fonteDi).filter(Boolean))].sort();
  const perLista = n => l.filter(x => listaDi(x) === n).sort(perPrioritaLavoro);
  const nuova = () => apriModulo('organizzazione', mail ? 'mail' : 'attivita', null, mail ? { stato: 'da gestire', priorita: 'media', lista: 'Oggi', lista_dal: oggi(), data: oggi() }
    : { stato: 'da fare', priorita: 'media', ambito: pers ? 'Personale' : 'Lavoro', ...(pers ? { casella: ETICHETTE_PERSONALI.includes(filtro) ? filtro : 'CASA' } : {}), lista: 'Oggi', lista_dal: oggi(), data: oggi() });
  const testi = mail ? { Oggi: 'Nessuna mail da gestire oggi.', Coda: 'Nessuna mail in coda.', Archivio: 'Archivio vuoto.' } : { Oggi: 'Nessun task per oggi.', Coda: 'Nessun task in coda.', Archivio: 'Archivio vuoto.' };
  const alte = l.filter(x => listaDi(x) === 'Oggi' && x.priorita === 'alta').length;
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, mail ? 'Gestione mail' : pers ? 'Organizzazione' : 'Task'), h('p', { class: 'sotto largo-testo' }, mail
        ? 'Le mail delle tre caselle che chiedono una risposta o un\'azione. Le porta qui Claude da Gmail ogni mattina.'
        : pers ? 'Le tue cose personali, divise tra CASA, GIARDINO e PROGETTI. Funziona come Task: con la scadenza il task passa da solo in Oggi, con "Aggiungi al calendario" lo metti nel calendario Google TASK.'
        : 'Le tue cose da fare, come in Google Task. Metti la scadenza con il calendario: quando arriva, il task passa da solo in Oggi. Con "Aggiungi al calendario" lo metti nel calendario Google TASK.')),
      h('div', { class: 'azioni' }, btn(mail ? 'Aggiungi una mail' : 'Aggiungi un task', nuova, 'primario'))),
    h('div', { class: 'dati' }, dato('Per oggi', perLista('Oggi').length, alte ? `${alte} con priorità alta` : ''), dato('In coda', perLista('Coda').length),
      mail ? dato('In attesa di altri', tutte.filter(x => x.stato === 'in attesa di altri').length) : dato('In ritardo', tutte.filter(x => giorniDaSe(x.data) > 0).length, '', tutte.some(x => giorniDaSe(x.data) > 0) ? 'allerta' : '')),
    fonti.length > 1 ? h('div', { class: 'azioni filtri' }, h('span', { class: 'attenuato piccolo' }, 'Mostra:'),
      ['', ...fonti].map(f => h('button', { type: 'button', class: 'filtro' + (f === filtro ? ' scelto' : ''), 'aria-pressed': f === filtro ? 'true' : 'false', onclick: () => { S[chiave] = f; disegna(); } }, f ? etichettaColore(f) : 'Tutto'))) : null,
    h('nav', { class: 'schede', 'aria-label': 'Liste' }, Object.entries(SCHEDE_LAVORO).map(([k, n]) => h('a', { href: base + k, class: k === sc ? 'attiva' : '', 'aria-current': k === sc ? 'page' : null },
      n, h('span', { class: 'conta' }, k === 'tutti' ? l.length : perLista(n).length)))),
    (sc === 'tutti' ? LISTE_LAVORO : [SCHEDE_LAVORO[sc]]).map(n => { const x = perLista(n); return pannello(sc === 'tutti' ? `${n} (${x.length})` : '', x.length ? h('ul', { class: 'elenco' }, x.map(rigaLavoro)) : h('p', { class: 'attenuato' }, testi[n])); }));
}
