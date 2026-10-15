/* ===== 8c. Da fare: cose da fare e mail da gestire in una vista sola, divise in Oggi, Domani e Archivio =====
   Le cose da fare sono le voci organizzazione/attivita, le mail sono organizzazione/mail (le carica Claude da Gmail).
   Una voce messa in "Domani" passa da sola in "Oggi" il giorno dopo; senza lista, decide la data. */
const domani = () => { const d = new Date(tempo(oggi()) + MS_G); return isoData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
function listaDi(x) {
  if (x.lista === 'Domani' && x.lista_dal && x.lista_dal < oggi()) return 'Oggi';
  if (LISTE_LAVORO.includes(x.lista)) return x.lista;
  if (!x.data || x.data <= oggi()) return 'Oggi';
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
const quantiOggi = () => lavoriAperti().filter(x => listaDi(x) === 'Oggi').length;
const linkGmail = x => (typeof x.link === 'string' && /^https:\/\/mail\.google\.com\//.test(x.link) ? x.link : '');

function spostaLavoro(x, lista) { metti({ ...x, lista, lista_dal: oggi() }); avviso(`Spostata in ${lista}.`); }
function chiudiLavoro(x) {
  metti(x.tipo === 'mail' ? { ...x, stato: 'gestita', gestita_il: oggi() } : { ...x, stato: 'fatta', fatta_il: oggi() });
  avviso(x.tipo === 'mail' ? 'Mail segnata come gestita.' : 'Fatta.');
}

function rigaLavoro(x) {
  const l = listaDi(x), mail = x.tipo === 'mail';
  const dove = mail ? x.casella : (x.casella || x.ambito);
  const g = mail ? null : -giorniDa(x.data);
  const quando = mail ? `ricevuta il ${fmtData(x.data)}` : g < 0 ? `in ritardo dal ${fmtData(x.data)}` : g === 0 ? 'entro oggi' : `entro il ${fmtData(x.data)}`;
  const link = linkGmail(x);
  return h('li', { class: 'lavoro', 'data-tipo': x.tipo },
    h('div', { class: 'tra' },
      h('span', {}, h('span', { class: 'etichetta-tipo ' + (mail ? 'e-mail' : 'e-cosa') }, mail ? 'Mail' : 'Da fare'), ' ', h('strong', {}, x.titolo)),
      x.priorita === 'alta' ? stato('ritardo', 'Priorità alta') : null),
    h('div', { class: 'elenco-nota' }, [dove, mail && x.mittente ? 'da ' + x.mittente : '', quando, mail && x.stato === 'in attesa di altri' ? 'in attesa di altri' : ''].filter(Boolean).join(', ')),
    x.azione || x.nota ? h('div', { class: 'elenco-nota testo-lungo' }, x.azione || x.nota) : null,
    h('div', { class: 'azioni' },
      btn(mail ? 'Gestita' : 'Fatta', () => chiudiLavoro(x), 'piccolo primario'),
      LISTE_LAVORO.filter(n => n !== l).map(n => btn('In ' + n.toLowerCase(), () => spostaLavoro(x, n), 'piccolo')),
      link ? h('a', { class: 'btn piccolo', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Apri in Gmail') : null,
      btn('Modifica', () => apriModulo('organizzazione', x.tipo, x), 'piccolo')));
}

function vistaLavoro() {
  const filtro = S.filtroLavoro || '';
  const tutte = lavoriAperti();
  const l = tutte.filter(x => !filtro || (x.tipo === 'mail' ? x.casella : (x.casella || x.ambito)) === filtro);
  const fonti = [...new Set(tutte.map(x => (x.tipo === 'mail' ? x.casella : (x.casella || x.ambito))).filter(Boolean))].sort();
  const perLista = n => l.filter(x => listaDi(x) === n).sort(perPrioritaLavoro);
  const nuova = () => apriModulo('organizzazione', 'attivita', null, { stato: 'da fare', priorita: 'media', ambito: 'Lavoro', lista: 'Oggi', lista_dal: oggi(), data: oggi() });
  const testi = { Oggi: 'Niente per oggi.', Domani: 'Niente per domani.', Archivio: 'Archivio vuoto.' };
  const nMail = tutte.filter(x => x.tipo === 'mail').length;
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, 'Da fare'), h('p', { class: 'sotto largo-testo' }, 'Cose da fare e mail delle tre caselle in un posto solo. Le mail le porta qui Claude da Gmail; quello che sposti in Domani torna da solo in Oggi il giorno dopo.')),
      h('div', { class: 'azioni' }, btn('Aggiungi una cosa da fare', nuova, 'primario'))),
    h('div', { class: 'dati' }, dato('Per oggi', perLista('Oggi').length, `${l.filter(x => listaDi(x) === 'Oggi' && x.priorita === 'alta').length} con priorità alta`), dato('Per domani', perLista('Domani').length), dato('Mail da gestire', nMail, 'tutte le caselle')),
    fonti.length > 1 ? h('div', { class: 'azioni filtri' }, h('span', { class: 'attenuato piccolo' }, 'Mostra:'),
      ['', ...fonti].map(f => btn(f || 'Tutto', () => { S.filtroLavoro = f; disegna(); }, 'piccolo' + (f === filtro ? ' primario' : '')))) : null,
    LISTE_LAVORO.map(n => { const x = perLista(n); return pannello(`${n} (${x.length})`, x.length ? h('ul', { class: 'elenco' }, x.map(rigaLavoro)) : h('p', { class: 'attenuato' }, testi[n])); }));
}
