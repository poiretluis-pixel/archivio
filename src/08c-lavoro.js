/* ===== 8c. Da fare: cose da fare e mail da gestire in una vista sola, divise in Oggi, Domani e Archivio =====
   Le cose da fare sono le voci organizzazione/attivita, le mail sono organizzazione/mail (le carica Claude da Gmail).
   Una voce messa in "Domani" passa da sola in "Oggi" il giorno dopo; senza lista, decide la data. */
const domani = () => { const d = new Date(tempo(oggi()) + MS_G); return isoData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
function listaDi(x) {
  if (x.lista === 'Domani' && x.lista_dal && x.lista_dal < oggi()) return 'Oggi';
  if (LISTE_LAVORO.includes(x.lista)) return x.lista;
  if (!x.data || x.data <= oggi()) return x.tipo === 'attivita' && !x.data ? 'Archivio' : 'Oggi';
  return x.data === domani() && x.tipo === 'attivita' ? 'Domani' : x.tipo === 'mail' ? 'Oggi' : 'Archivio';
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
  const testi = mail ? { Oggi: 'Nessuna mail da gestire oggi.', Domani: 'Nessuna mail per domani.', Archivio: 'Archivio vuoto.' } : { Oggi: 'Nessun task per oggi.', Domani: 'Nessun task per domani.', Archivio: 'Archivio vuoto.' };
  const alte = l.filter(x => listaDi(x) === 'Oggi' && x.priorita === 'alta').length;
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, mail ? 'Gestione mail' : 'Task'), h('p', { class: 'sotto largo-testo' }, mail
        ? 'Le mail delle tre caselle che chiedono una risposta o un\'azione. Le porta qui Claude da Gmail; quelle che sposti in Domani tornano da sole in Oggi il giorno dopo.'
        : 'Le tue cose da fare, come in Google Task. Quello che sposti in Domani torna da solo in Oggi il giorno dopo.')),
      h('div', { class: 'azioni' }, btn(mail ? 'Aggiungi una mail' : 'Aggiungi un task', nuova, 'primario'))),
    h('div', { class: 'dati' }, dato('Per oggi', perLista('Oggi').length, alte ? `${alte} con priorità alta` : ''), dato('Per domani', perLista('Domani').length),
      mail ? dato('In attesa di altri', tutte.filter(x => x.stato === 'in attesa di altri').length) : dato('In ritardo', tutte.filter(x => giorniDaSe(x.data) > 0).length, '', tutte.some(x => giorniDaSe(x.data) > 0) ? 'allerta' : '')),
    fonti.length > 1 ? h('div', { class: 'azioni filtri' }, h('span', { class: 'attenuato piccolo' }, 'Mostra:'),
      ['', ...fonti].map(f => btn(f || 'Tutto', () => { S[chiave] = f; disegna(); }, 'piccolo' + (f === filtro ? ' primario' : '')))) : null,
    LISTE_LAVORO.map(n => { const x = perLista(n); return pannello(`${n} (${x.length})`, x.length ? h('ul', { class: 'elenco' }, x.map(rigaLavoro)) : h('p', { class: 'attenuato' }, testi[n])); }));
}
