/* ===== 8c. Task e Gestione mail: liste Oggi, Coda e Archivio =====
   Le cose da fare sono le voci organizzazione/attivita, le mail sono organizzazione/mail (le carica Claude da Gmail).
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
const ordinePriorita = x => (PRIORITA.includes(x.priorita) ? PRIORITA.indexOf(x.priorita) : 1);
function perPrioritaLavoro(a, b) {
  return ordinePriorita(a) - ordinePriorita(b) || perData(a, b);
}
const quantiOggi = tipo => lavoriAperti().filter(x => x.tipo === tipo && listaDi(x) === 'Oggi').length;
/* Calendario Google TASK: gli eventi li crea e li aggiorna Claude ogni mattina (evento_id, evento_data). */
const statoCalendario = x => (!x.data ? '' : x.evento_id && x.evento_data === x.data ? 'nel calendario TASK' : 'nel calendario domattina');
const linkGmail = x => (typeof x.link === 'string' && /^https:\/\/mail\.google\.com\//.test(x.link) ? x.link : '');

function spostaLavoro(x, lista) { metti({ ...x, lista, lista_dal: oggi() }); avviso(`Spostata in ${lista}.`); }
function chiudiLavoro(x) {
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
      h('strong', {}, x.titolo),
      x.priorita === 'alta' ? stato('ritardo', 'Priorità alta') : null),
    h('div', { class: 'elenco-nota' }, [dove, mail && x.mittente ? 'da ' + x.mittente : '', quando, mail && x.stato === 'in attesa di altri' ? 'in attesa di altri' : ''].filter(Boolean).join(', ')),
    x.azione || x.nota ? h('div', { class: 'elenco-nota testo-lungo' }, x.azione || x.nota) : null,
    h('div', { class: 'azioni' },
      btn(mail ? 'Gestita' : 'Fatta', () => chiudiLavoro(x), 'piccolo primario'),
      LISTE_LAVORO.filter(n => n !== l).map(n => btn('In ' + n.toLowerCase(), () => spostaLavoro(x, n), 'piccolo')),
      link ? h('a', { class: 'btn piccolo', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Apri in Gmail') : null,
      mail ? null : h('label', { class: 'scadenza-rapida' }, h('span', { class: 'attenuato piccolo' }, 'Scadenza'),
        h('input', { type: 'date', value: x.data || '', 'aria-label': 'Scadenza di ' + x.titolo, onchange: e => { const d = e.target.value; const { data, ...resto } = x; metti(d ? { ...resto, data: d } : resto); avviso(d ? `Scadenza il ${fmtData(d)}.` : 'Scadenza tolta.'); } })),
      !mail && statoCalendario(x) ? h('span', { class: 'attenuato piccolo' }, statoCalendario(x)) : null,
      btn('Modifica', () => apriModulo('organizzazione', x.tipo, x), 'piccolo')));
}

/* Due pagine: Task (cose da fare) e Gestione mail. Stesse liste, stesso comportamento. */
const fonteDi = x => (x.tipo === 'mail' ? x.casella : (x.casella || x.ambito));
function vistaLavoro(tipo) {
  const mail = tipo === 'mail', chiave = 'filtro_' + tipo, filtro = S[chiave] || '';
  const tutte = lavoriAperti().filter(x => x.tipo === tipo);
  const l = tutte.filter(x => !filtro || fonteDi(x) === filtro);
  const fonti = [...new Set(tutte.map(fonteDi).filter(Boolean))].sort();
  const perLista = n => l.filter(x => listaDi(x) === n).sort(perPrioritaLavoro);
  const nuova = () => apriModulo('organizzazione', tipo, null, mail ? { stato: 'da gestire', priorita: 'media', lista: 'Oggi', lista_dal: oggi(), data: oggi() } : { stato: 'da fare', priorita: 'media', ambito: 'Lavoro', lista: 'Oggi', lista_dal: oggi(), data: oggi() });
  const testi = mail ? { Oggi: 'Nessuna mail da gestire oggi.', Coda: 'Nessuna mail in coda.', Archivio: 'Archivio vuoto.' } : { Oggi: 'Nessun task per oggi.', Coda: 'Nessun task in coda.', Archivio: 'Archivio vuoto.' };
  const alte = l.filter(x => listaDi(x) === 'Oggi' && x.priorita === 'alta').length;
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, mail ? 'Gestione mail' : 'Task'), h('p', { class: 'sotto largo-testo' }, mail
        ? 'Le mail delle tre caselle che chiedono una risposta o un\'azione. Le porta qui Claude da Gmail ogni mattina.'
        : 'Le tue cose da fare, come in Google Task. Metti la scadenza con il calendario: quando arriva, il task passa da solo in Oggi. I task con scadenza compaiono nel calendario Google TASK, aggiornato ogni mattina.')),
      h('div', { class: 'azioni' }, btn(mail ? 'Aggiungi una mail' : 'Aggiungi un task', nuova, 'primario'))),
    h('div', { class: 'dati' }, dato('Per oggi', perLista('Oggi').length, alte ? `${alte} con priorità alta` : ''), dato('In coda', perLista('Coda').length),
      mail ? dato('In attesa di altri', tutte.filter(x => x.stato === 'in attesa di altri').length) : dato('In ritardo', tutte.filter(x => giorniDaSe(x.data) > 0).length, '', tutte.some(x => giorniDaSe(x.data) > 0) ? 'allerta' : '')),
    fonti.length > 1 ? h('div', { class: 'azioni filtri' }, h('span', { class: 'attenuato piccolo' }, 'Mostra:'),
      ['', ...fonti].map(f => btn(f || 'Tutto', () => { S[chiave] = f; disegna(); }, 'piccolo' + (f === filtro ? ' primario' : '')))) : null,
    LISTE_LAVORO.map(n => { const x = perLista(n); return pannello(`${n} (${x.length})`, x.length ? h('ul', { class: 'elenco' }, x.map(rigaLavoro)) : h('p', { class: 'attenuato' }, testi[n])); }));
}
