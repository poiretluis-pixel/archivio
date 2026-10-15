/* ===== 8. Viste: quadro generale e cruscotti delle cartelle ===== */
const segnoSaldo = v => (v.categoria === 'Debito' || v.categoria === 'Carta di credito' ? -Math.abs(v.valore) : v.valore);
function totaleFinanze(lista) {
  const ultimi = new Map();
  for (const v of [...lista].sort(perData)) ultimi.set((v.persona || '') + '|' + v.conto, v);
  return somma([...ultimi.values()].map(segnoSaldo));
}
function patrimonioNetto() {
  return totaleFinanze(voci('finanze', 'saldo')) + somma(voci('patrimonio', 'bene').map(v => v.valore)) - somma(voci('patrimonio', 'debito').map(v => Math.abs(v.valore)));
}
function riassuntoEsito(r) {
  const p = [];
  if (r.aggiunti) p.push(`${r.aggiunti} nuovi`); if (r.aggiornati) p.push(`${r.aggiornati} aggiornati`); if (r.saltati) p.push(`${r.saltati} già presenti`);
  if (r.errori && r.errori.length) p.push(`${r.errori.length} non caricati`);
  return p.join(', ') || 'nessuna modifica';
}

function vistaCasa() {
  const daFare = [];
  const sc = voci('sistema', 'scadenza').filter(x => x.stato !== 'fatta').sort(perData);
  for (const x of sc) { const g = -giorniDa(x.data); if (g <= 30) daFare.push({ tipo: g < 0 ? 'ritardo' : 'vuota', testo: x.titolo, nota: g < 0 ? `Scaduta il ${fmtData(x.data)}` : g === 0 ? 'Scade oggi' : `Entro il ${fmtData(x.data)}`, href: '#/scadenze' }); }
  const lav = lavoriAperti().filter(x => listaDi(x) === 'Oggi').sort(perPrioritaLavoro);
  for (const x of lav.slice(0, 6)) {
    const mail = x.tipo === 'mail', g = mail ? 0 : -giorniDa(x.data);
    daFare.push({ tipo: x.priorita === 'alta' || g < 0 ? 'ritardo' : 'vuota', testo: (mail ? 'Mail: ' : '') + x.titolo,
      nota: [mail ? x.casella : (x.casella || x.ambito), mail ? (x.mittente ? 'da ' + x.mittente : '') : g < 0 ? `in ritardo dal ${fmtData(x.data)}` : g === 0 ? 'entro oggi' : `entro il ${fmtData(x.data)}`].filter(Boolean).join(', '), href: mail ? '#/mail' : '#/task' });
  }
  if (lav.length > 6) daFare.push({ tipo: 'vuota', testo: `Altre ${lav.length - 6} cose per oggi`, nota: 'Tutte nelle pagine Task e Gestione mail.', href: '#/task' });
  const daElab = allegati().filter(a => a.stato === 'da elaborare').length;
  if (daElab) daFare.push({ tipo: 'vuota', testo: daElab === 1 ? '1 documento in attesa che Claude ne inserisca i valori' : `${daElab} documenti in attesa che Claude ne inserisca i valori`, nota: 'Sono al sicuro. Li elabora alla verifica del lunedì, oppure subito se glielo chiedi in chat.', href: '#/documenti' });
  if (!ghPronto()) daFare.push({ tipo: 'ritardo', testo: 'I dati sono solo su questo dispositivo', nota: 'Collega il repository dei dati in Impostazioni.', href: '#/impostazioni' });
  else if (S.sync.stato === 'errore') daFare.push({ tipo: 'ritardo', testo: 'La sincronizzazione non riesce', nota: S.sync.errore, href: '#/impostazioni' });
  const sg = statoGarmin(); if (sg && sg.tipo !== 'ok') daFare.push({ ...sg, href: '#/impostazioni' });

  const mis = voci('salute', 'misura');
  const perPar = [...raggruppa(mis.sort(perData), v => v.parametro).values()].map(l => l[l.length - 1]);
  const nFuori = perPar.filter(fuoriIntervallo).length;
  const ultimoPrelievo = mis.length ? mis[mis.length - 1].data : null;
  const viaggi = voci('viaggi', 'viaggio'), prossimo = viaggi.filter(v => v.data > oggi()).sort(perData)[0];
  const prog = voci('progetti', 'progetto');
  const schede = {
    salute: mis.length || S.estVoci.length ? [(ind => (ind ? dato('Indice di salute', `${Math.round(ind.valore)} su 100`, `${fascia(ind.valore).testo}, affidabilità ${ind.affidabilita}`) : null))(indiceSalute()), mis.length ? dato('Fuori intervallo all\'ultima misura', nFuori, `su ${perPar.length} parametri seguiti`, nFuori ? 'allerta' : '') : null] : null,
    finanze: voci('finanze').length ? [(ind => (ind ? dato('Indice finanziario', `${Math.round(ind.valore)} su 100`, `${fascia(ind.valore).testo}, affidabilità ${ind.affidabilita}`) : null))(indiceFinanze()), voci('finanze', 'saldo').length ? dato('Disponibilità finanziaria', fmtEuro(totaleFinanze(voci('finanze', 'saldo')))) : null] : null,
    organizzazione: voci('organizzazione').length ? [dato('Obiettivi attivi', voci('organizzazione', 'obiettivo').filter(o => o.stato === 'attivo' || !o.stato).length), dato('Cose da fare aperte', voci('organizzazione', 'attivita').filter(x => x.stato !== 'fatta').length)] : null,
    sport: voci('sport').length ? [dato('Sedute nelle ultime 4 settimane', [...voci('sport', 'allenamento'), ...voci('sport', 'attivita')].filter(v => giorniDa(v.data) < 28).length)] : null,
    mindfulness: voci('mindfulness').length ? [dato('Giorni di pratica negli ultimi 30', new Set(voci('mindfulness', 'pratica').filter(v => giorniDa(v.data) < 30).map(v => v.data)).size)] : null,
    lettura: voci('lettura').length ? [dato('Libri letti quest\'anno', voci('lettura', 'libro').filter(v => v.stato === 'letto' && (v.fine || '').startsWith(oggi().slice(0, 4))).length, (l => (l.length ? 'In lettura: ' + l.map(v => v.titolo).join(', ') : ''))(voci('lettura', 'libro').filter(v => v.stato === 'in lettura')))] : null,
    patrimonio: voci('patrimonio').length || voci('finanze', 'saldo').length ? [dato('Patrimonio netto', fmtEuro(patrimonioNetto()), 'beni e disponibilità meno debiti')] : null,
    viaggi: viaggi.length ? [dato('Viaggi registrati', viaggi.length, prossimo ? `Prossimo: ${prossimo.titolo}, ${fmtData(prossimo.data)}` : '')] : null,
    progetti: prog.length ? [dato('Progetti', prog.length, `${prog.filter(p => p.stato === 'attivo').length} attivi`)] : null,
  };
  return h('div', {},
    h('div', { class: 'testa' }, h('div', {}, h('h1', {}, 'Quadro generale'), h('p', { class: 'sotto' }, new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))),
    pannello('Da fare', daFare.length ? h('ul', { class: 'elenco' }, daFare.map(x => h('li', {}, h('a', { href: x.href }, stato(x.tipo, x.testo)), h('div', { class: 'elenco-nota' }, x.nota)))) : h('p', { class: 'attenuato' }, 'Niente in sospeso.')),
    consigliPrincipali(),
    h('div', { class: 'griglia' }, aree().map(a => h('a', { class: 'scheda', href: '#/a/' + a.id }, h('h3', {}, a.nome),
      schede[a.id] || (a.libera && voci(a.id).length ? dato('Voci', voci(a.id).length) : h('p', { class: 'attenuato' }, 'Ancora vuota.'))))),
    pannello('Stato dei caricamenti', h('ul', { class: 'elenco' }, FONTI.map(f => { const st = statoFonte(f); return h('li', {}, h('div', { class: 'tra' }, h('strong', {}, f.nome), stato(st.stato, st.stato === 'ok' ? 'In regola' : st.stato === 'ritardo' ? 'In ritardo' : 'Mai caricati')), h('div', { class: 'elenco-nota' }, st.stato === 'ok' ? st.testo : (st.stato === 'ritardo' ? st.testo + '. ' : '') + f.come)); }))),
    ultimoRapporto(),
    pannello('Ultimi caricamenti', ultimiCaricamenti()));
}
function ultimiCaricamenti() {
  const l = S.A.registro.filter(r => !r.canc).map(r => ({ quando: r.quando, titolo: r.azione, nota: (r.origine ? r.origine + ': ' : '') + riassuntoEsito(r) }));
  const st = S.est.stato;
  if (st && st.ultimo_avvio) l.push({ quando: st.ultimo_avvio, titolo: 'Scaricamento Garmin', nota: st.esito === 'ok' ? `${st.righe || 0} valori aggiornati` + (st.ultima_data ? `, dati fino al ${fmtData(st.ultima_data)}` : '') : (st.messaggio || st.esito) });
  if (!l.length) return h('p', { class: 'attenuato' }, 'Qui compare la ricevuta di ogni caricamento: quanti dati sono entrati e quali no.');
  return h('ul', { class: 'elenco' }, l.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 6).map(r => h('li', {}, h('div', { class: 'tra' }, h('strong', {}, r.titolo), h('span', { class: 'attenuato' }, fmtQuando(r.quando))), h('div', { class: 'elenco-nota' }, r.nota))));
}
/* Stato dello scaricamento automatico. tipo: ok, vuota (da attivare), ritardo (problema). */
function statoGarmin() {
  if (!ghPronto()) return null;
  const st = S.est.stato;
  const nota = 'Serve inserire email e password di Garmin nel repository dei dati: istruzioni in Impostazioni.';
  if (!st || st.esito === 'non configurato') return { tipo: 'vuota', testo: 'Scaricamento Garmin non ancora attivo', nota };
  if (st.esito === 'errore') return { tipo: 'ritardo', testo: 'Garmin: l\'ultimo scaricamento non è riuscito', nota: (st.messaggio || '') + ' Claude lo vede alla verifica del lunedì.' };
  const ultima = S.estVoci.reduce((m, v) => (v.data > m ? v.data : m), '');
  if (!ultima) return { tipo: 'vuota', testo: 'Garmin collegato, nessun dato ancora', nota: 'Controlla che l\'app Garmin Connect sul telefono abbia sincronizzato il dispositivo.' };
  if (giorniDa(ultima) > 3) return { tipo: 'ritardo', testo: `Dati Garmin fermi al ${fmtData(ultima)}`, nota: 'Apri l\'app Garmin Connect sul telefono per sincronizzare il dispositivo.' };
  return { tipo: 'ok', testo: `Dati Garmin aggiornati al ${fmtData(ultima)}`, nota: '' };
}

/* --- Rapporti scritti da Claude (rapporti/*.md nel repository dei dati) --- */
function inLinea(testo) {
  const out = []; let ultimo = 0;
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g; let m;
  while ((m = re.exec(testo))) {
    out.push(testo.slice(ultimo, m.index));
    out.push(m[1] ? h('strong', {}, m[1]) : m[2] ? h('code', {}, m[2]) : h('a', { href: m[4], target: '_blank', rel: 'noopener noreferrer' }, m[3]));
    ultimo = re.lastIndex;
  }
  out.push(testo.slice(ultimo));
  return out;
}
/* Markdown essenziale, costruito come elementi della pagina: il testo non viene mai interpretato come HTML. */
function mdInDom(testo) {
  const box = h('div', { class: 'md' }); let lista = null, par = [], tab = [];
  const chiudi = () => {
    if (par.length) { box.append(h('p', {}, inLinea(par.join(' ')))); par = []; }
    if (tab.length) { const righe = tab.filter(r => !/^\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(x => x.trim()));
      box.append(h('div', { class: 'scorri' }, h('table', {}, h('thead', {}, h('tr', {}, righe[0].map(x => h('th', {}, inLinea(x))))), h('tbody', {}, righe.slice(1).map(r => h('tr', {}, r.map(x => h('td', {}, inLinea(x))))))))); tab = []; }
    lista = null;
  };
  for (const riga of String(testo || '').split(/\r?\n/)) {
    const t = riga.trim(); let m;
    if (!t) { chiudi(); continue; }
    if (t.startsWith('|')) { if (par.length || lista) { const tt = tab; chiudi(); tab = tt; } tab.push(t); continue; }
    if (tab.length) chiudi();
    if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { chiudi(); box.append(h('h' + Math.min(5, m[1].length + 1), {}, inLinea(m[2]))); continue; }
    if ((m = t.match(/^(?:[-*]|(\d+)\.)\s+(.*)$/))) {
      if (par.length) { box.append(h('p', {}, inLinea(par.join(' ')))); par = []; }
      const tipo = m[1] ? 'ol' : 'ul';
      if (!lista || lista.tagName.toLowerCase() !== tipo) { lista = h(tipo, {}); box.append(lista); }
      lista.append(h('li', {}, inLinea(m[2]))); continue;
    }
    if (lista && /^\s{2,}/.test(riga)) { lista.lastChild.append(' ', ...inLinea(t)); continue; }
    lista = null; par.push(t.replace(/^>\s?/, ''));
  }
  chiudi();
  return box;
}
const titoloRapporto = (nome, r) => ((r.testo.match(/^#\s+(.+)$/m) || [])[1] || nome.replace(/\.md$/, ''));
function rapporti() { return Object.entries(S.est.rapporti || {}).sort((a, b) => b[0].localeCompare(a[0])); }
function ultimoRapporto() {
  const l = rapporti(); if (!l.length) return null;
  const [nome, r] = l[0];
  const primo = r.testo.replace(/^#.*$/m, '').trim().split(/\n\s*\n/)[0] || '';
  return pannello('Ultimo rapporto di Claude', h('p', {}, h('a', { href: '#/rapporti/' + encodeURIComponent(nome) }, titoloRapporto(nome, r))), h('div', { class: 'elenco-nota largo-testo' }, mdInDom(primo)));
}
function vistaRapporti(scelto) {
  const l = rapporti();
  if (!l.length) return h('div', {}, h('div', { class: 'testa' }, h('h1', {}, 'Rapporti')), vuoto('Nessun rapporto ancora. Claude ne scrive uno a inizio mese con l\'andamento dei dati e le cose da fare, e compare qui.'));
  const [nome, r] = l.find(x => x[0] === scelto) || l[0];
  return h('div', {},
    h('div', { class: 'testa' }, h('h1', {}, 'Rapporti'), l.length > 1 ? h('select', { 'aria-label': 'Rapporto', onchange: e => { location.hash = '#/rapporti/' + encodeURIComponent(e.target.value); } }, l.map(([n, x]) => h('option', { value: n, selected: n === nome }, titoloRapporto(n, x)))) : null),
    h('article', { class: 'largo-testo' }, mdInDom(r.testo)));
}

function vistaArea(a) {
  const cr = { salute: cruscottoSalute, finanze: cruscottoFinanze, patrimonio: cruscottoPatrimonio, organizzazione: cruscottoOrganizzazione, sport: cruscottoSport, mindfulness: cruscottoMindfulness, lettura: cruscottoLettura, viaggi: cruscottoViaggi, progetti: cruscottoProgetti }[a.id] || cruscottoLibero;
  return h('div', {},
    h('div', { class: 'testa' }, h('h1', {}, a.nome)),
    a.id === 'salute' ? pannelloIndice() : a.id === 'finanze' ? pannelloIndiceFinanze() : null,
    pannelloConsigli(a.id),
    cr(a),
    a.id === 'progetti' ? null : pannello('Sezioni di questa cartella', h('div', { class: 'sezioni' }, Object.entries(a.tipi).map(([k, d]) => h('div', { class: 'sezione' },
      h('a', { href: `#/a/${a.id}/${k}` }, d.plur), h('span', { class: 'attenuato' }, ` ${voci(a.id, k).length}`), btn('Aggiungi', () => apriModulo(a.id, k), 'piccolo'))))));
}

/* --- Salute e longevità --- */
function apriParametro(nome) {
  const l = voci('salute', 'misura').filter(v => v.parametro === nome).sort(perData);
  const num = l.filter(v => typeof v.valore === 'number');
  const u = num[num.length - 1];
  const corpo = h('div', {});
  if (num.length) corpo.append(grafico(`Andamento di ${nome}`, w => graficoLinea(w, {
    punti: num.map(v => ({ data: v.data, y: v.valore, fuori: fuoriIntervallo(v), righe: [testoRif(v) ? 'Riferimento: ' + testoRif(v) : '', v.laboratorio || ''].filter(Boolean) })),
    banda: { min: u.rif_min, max: u.rif_max }, unita: u.unita, fmt: v => fmtNum(v, 3) })),
    h('p', { class: 'attenuato piccolo' }, 'Fascia colorata: intervallo di riferimento dell\'ultimo referto. Ogni misura è valutata con l\'intervallo del proprio laboratorio; il rombo segna i valori fuori intervallo.'));
  corpo.append(h('div', { class: 'scorri' }, h('table', {}, h('thead', {}, h('tr', {}, ['Data', 'Valore', 'Riferimento', 'Laboratorio', ''].map(x => h('th', {}, x)))),
    h('tbody', {}, [...l].reverse().map(v => h('tr', {}, h('td', {}, fmtData(v.data)), h('td', { class: 'num' + (fuoriIntervallo(v) ? ' fuori' : '') }, valoreTesto(v) + (v.unita ? ' ' + v.unita : ''), fuoriIntervallo(v) ? ' ◆' : ''), h('td', {}, testoRif(v)), h('td', {}, v.laboratorio || ''),
      h('td', { class: 'destra' }, v.doc && S.A.allegati.some(a => a.id === v.doc && !a.canc) ? btn('Referto', () => apriAllegato(S.A.allegati.find(a => a.id === v.doc)), 'piccolo') : null, btn('Modifica', () => apriModulo('salute', 'misura', v), 'piccolo'))))))));
  apriModale(nome, corpo, true);
}
function rigaParametro(l) {
  const u = l[l.length - 1], num = l.filter(v => typeof v.valore === 'number'), f = fuoriIntervallo(u);
  return h('tr', { tabindex: 0, onclick: () => apriParametro(u.parametro), onkeydown: e => { if (e.key === 'Enter') apriParametro(u.parametro); } },
    h('td', {}, u.parametro), h('td', { class: 'num destra nonspezza' + (f ? ' fuori' : '') }, valoreTesto(u), u.unita && typeof u.valore === 'number' ? h('span', { class: 'unita' }, ' ' + u.unita) : null, f ? h('span', { class: 'segno-fuori', title: 'Fuori intervallo' }, ' ◆') : null),
    h('td', { class: 'rif' }, testoRif(u)), h('td', {}, fmtData(u.data)), h('td', {}, scintilla(num.map(v => v.valore), f)));
}
function pannelloSerie(titolo, lista, descrVuoto, azione) {
  if (!lista.length) return pannello(titolo, vuoto(descrVuoto, azione));
  const per = raggruppa(lista.sort(perData), v => v.metrica), nomi = [...per.keys()].sort();
  const box = h('div', {});
  const mostra = n => { const l = per.get(n); box.replaceChildren(grafico(`Andamento di ${n}`, w => graficoLinea(w, { punti: l.map(v => ({ data: v.data, y: v.valore })), unita: l[l.length - 1].unita })), h('p', { class: 'attenuato piccolo' }, `${l.length} valori dal ${fmtData(l[0].data)} al ${fmtData(l[l.length - 1].data)}. Ultimo: ${fmtNum(l[l.length - 1].valore)} ${l[l.length - 1].unita || ''}`)); };
  mostra(nomi[0]);
  return pannello(titolo, nomi.length > 1 ? h('select', { 'aria-label': 'Metrica', onchange: e => mostra(e.target.value) }, nomi.map(n => h('option', { value: n }, n))) : h('strong', {}, nomi[0]), box);
}
/* Sedute per settimana (ultime 12) e massimali: contesto per leggere recupero e sonno, non una valutazione degli esercizi. */
function lunedi(iso) { const t = tempo(iso), g = (new Date(t).getUTCDay() + 6) % 7, d = new Date(t - g * MS_G); return isoData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
function pannelloAllenamenti() {
  const al = voci('sport', 'allenamento').sort(perData), ma = voci('sport', 'massimale');
  if (!al.length && !ma.length) return null;
  const kids = [];
  if (al.length) {
    const sett = []; let l = lunedi(al[0].data); const fine = lunedi(oggi());
    while (l <= fine) { sett.push(l); l = isoData(...((d) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()])(new Date(tempo(l) + 7 * MS_G))); }
    const ultime = sett.slice(-12);
    const serie = [{ nome: 'Serie eseguite', classe: 'g-barra1', valori: ultime.map(s => somma(al.filter(v => lunedi(v.data) === s).map(v => v.serie))) }];
    kids.push(h('div', { class: 'dati' }, dato('Sedute nelle ultime 4 settimane', al.filter(v => giorniDa(v.data) < 28).length), dato('Ultima seduta', fmtData(al[al.length - 1].data), al[al.length - 1].scheda)),
      serie[0].valori.some(x => x > 0) ? [grafico('Serie eseguite per settimana', w => graficoBarre(w, { categorie: ultime.map(s => fmtData(s).replace(/ \d{4}$/, '')), serie, alto: 160 })),
        h('p', { class: 'attenuato piccolo' }, 'Serie eseguite per settimana, dalla scheda. I valori non segnati sono stimati secondo le tue regole e indicati nella seduta.')] : null,
      tabella('sport', 'allenamento', al, { limite: 6, filtro: false }));
  }
  if (ma.length) kids.push(h('h3', {}, 'Massimali'), tabella('sport', 'massimale', ma, { filtro: false }));
  return pannello('Sedute da scheda', kids);
}
function cruscottoSalute() {
  const mis = voci('salute', 'misura').sort(perData);
  const gruppi = [...raggruppa(mis, v => v.parametro).values()];
  const fuori = gruppi.filter(l => fuoriIntervallo(l[l.length - 1]));
  const oss = voci('salute', 'osservazione').filter(o => o.stato !== 'chiusa').sort((a, b) => ['alta', 'media', 'bassa'].indexOf(a.priorita) - ['alta', 'media', 'bassa'].indexOf(b.priorita));
  const visite = voci('salute', 'visita');
  const perCat = raggruppa(gruppi, l => l[l.length - 1].categoria || 'Altro');
  const testaTab = () => h('thead', {}, h('tr', {}, h('th', {}, 'Parametro'), h('th', { class: 'destra' }, 'Ultimo valore'), h('th', {}, 'Riferimento'), h('th', {}, 'Data'), h('th', {}, 'Andamento')));
  return [
    mis.length ? h('div', { class: 'dati' },
      dato('Fuori intervallo all\'ultima misura', fuori.length, `su ${gruppi.length} parametri seguiti`, fuori.length ? 'allerta' : ''),
      dato('Ultimo prelievo', fmtData(mis[mis.length - 1].data), fa(giorniDa(mis[mis.length - 1].data))),
      dato('Prelievi in archivio', new Set(mis.map(v => v.data)).size, `dal ${fmtData(mis[0].data)}`)) : null,
    mis.length ? pannello('Da tenere d\'occhio', fuori.length ? [h('div', { class: 'scorri' }, h('table', { class: 'cliccabile' }, testaTab(), h('tbody', {}, fuori.map(rigaParametro)))),
      h('p', { class: 'attenuato piccolo' }, 'Sono i parametri il cui ultimo valore è fuori dall\'intervallo indicato dal laboratorio. È un aiuto alla lettura: il significato clinico lo stabilisce il medico.')] : h('p', {}, 'Tutti gli ultimi valori sono nell\'intervallo di riferimento.')) : pannello('Esami di laboratorio', vuoto('Nessun esame inserito. Puoi inserire i valori a mano, importare un file dati, oppure caricare intanto il PDF in Documenti.', btn('Aggiungi un valore', () => apriModulo('salute', 'misura'), 'primario'))),
    pannello('Osservazioni e piano', oss.length ? h('ul', { class: 'elenco' }, oss.map(o => h('li', { class: 'cliccabile', tabindex: 0, onclick: () => apriModulo('salute', 'osservazione', o) }, h('div', { class: 'tra' }, h('strong', {}, o.titolo), h('span', { class: 'attenuato' }, [o.priorita ? 'priorità ' + o.priorita : '', fmtData(o.data)].filter(Boolean).join(', '))), h('div', { class: 'elenco-nota testo-lungo' }, o.testo || ''), o.origine ? h('div', { class: 'attenuato piccolo' }, 'Scritta da: ' + o.origine) : null))) : h('p', { class: 'attenuato' }, 'Nessuna osservazione aperta.'), h('div', { class: 'azioni' }, btn('Aggiungi osservazione', () => apriModulo('salute', 'osservazione', null, { stato: 'aperta' }), 'piccolo'))),
    mis.length ? pannello('Tutti i parametri per categoria', CAT_ESAMI.filter(k => perCat.has(k)).map(k => { const gl = perCat.get(k), nf = gl.filter(l => fuoriIntervallo(l[l.length - 1])).length; return h('details', { open: nf > 0 }, h('summary', {}, k, h('span', { class: 'attenuato' }, ` ${gl.length} parametri` + (nf ? `, ${nf} fuori intervallo` : ''))), h('div', { class: 'scorri' }, h('table', { class: 'cliccabile' }, testaTab(), h('tbody', {}, gl.sort((a, b) => a[0].parametro.localeCompare(b[0].parametro)).map(rigaParametro))))); })) : null,
    pannelloSerie('Dati del dispositivo', voci('salute', 'sensore'), 'Nessun dato del dispositivo. Arrivano da soli ogni notte una volta attivato lo scaricamento Garmin (Impostazioni). In alternativa puoi importare un CSV.', btn('Importa CSV', () => apriImportaCsv('salute', 'sensore'))),
    pannelloSerie('Peso e misure', voci('salute', 'corpo'), 'Nessuna misura del corpo registrata.', btn('Aggiungi misura', () => apriModulo('salute', 'corpo'), 'primario')),
    visite.length ? pannello('Visite e referti', tabella('salute', 'visita', visite, { limite: 6, filtro: false })) : null,
    voci('salute', 'alimentazione').length ? pannello('Alimentazione', tabella('salute', 'alimentazione', voci('salute', 'alimentazione'), { filtro: false })) : null,
  ];
}

/* --- Finanze --- */
function cruscottoFinanze() {
  const saldi = voci('finanze', 'saldo').sort(perData), mov = movimentiReali();
  if (!saldi.length && !mov.length) return pannello('', vuoto('Cartella vuota. Il modo più rapido: carica in Documenti i movimenti BPM degli ultimi mesi (Excel o CSV) oppure mandali a Claude in chat. Li classifica lui e da lì si calcolano entrate, uscite, risparmio e indice finanziario.', btn('Aggiungi un saldo', () => apriModulo('finanze', 'saldo'), 'primario'), btn('Importa movimenti', () => apriImportaCsv('finanze', 'movimento'))));
  const date = [...new Set(saldi.map(v => v.data))];
  const serie = date.map(d => ({ data: d, y: totaleFinanze(saldi.filter(v => v.data <= d)) }));
  const ultimi = new Map(); for (const v of saldi) ultimi.set(v.conto, v);
  const mesi = []; { const o = oggi(); let y = +o.slice(0, 4), m = +o.slice(5, 7); for (let i = 0; i < 12; i++) { mesi.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m < 1) { m = 12; y--; } } }
  const entrate = mesi.map(k => somma(mov.filter(v => v.data.startsWith(k) && v.valore > 0).map(v => v.valore)));
  const uscite = mesi.map(k => -somma(mov.filter(v => v.data.startsWith(k) && v.valore < 0).map(v => v.valore)));
  const perCat = [...raggruppa(mov.filter(v => v.valore < 0 && v.data >= mesi[0]), v => v.categoria || 'Senza categoria')].map(([nome, l]) => ({ nome, valore: -somma(l.map(v => v.valore)) })).sort((a, b) => b.valore - a.valore).slice(0, 8);
  const serieBarre = [{ nome: 'Entrate', classe: 'g-barra1', valori: entrate }, { nome: 'Uscite', classe: 'g-barra2', valori: uscite }];
  return [
    h('div', { class: 'dati' },
      saldi.length ? dato('Disponibilità finanziaria', fmtEuro(serie[serie.length - 1].y), serie.length > 1 ? `${serie[serie.length - 1].y >= serie[0].y ? '+' : ''}${fmtEuro(serie[serie.length - 1].y - serie[0].y)} dal ${fmtData(serie[0].data)}` : `al ${fmtData(serie[0].data)}`) : null,
      mov.length ? dato('Entrate negli ultimi 12 mesi', fmtEuro(somma(entrate))) : null, mov.length ? dato('Uscite negli ultimi 12 mesi', fmtEuro(somma(uscite)), `risparmio ${fmtEuro(somma(entrate) - somma(uscite))}`) : null),
    saldi.length ? pannello('Disponibilità nel tempo', grafico('Disponibilità finanziaria nel tempo', w => graficoLinea(w, { punti: serie, unita: '€', fmt: v => fmtNum(v, 0) })), h('p', { class: 'attenuato piccolo' }, 'Somma dell\'ultimo saldo noto di ogni conto a ciascuna data. I conti di tipo Debito sono sottratti.')) : null,
    saldi.length ? pannello('Dove sono i soldi oggi', barreOrizzontali([...ultimi.values()].map(v => ({ nome: v.conto, valore: segnoSaldo(v) })).sort((a, b) => b.valore - a.valore), fmtEuro)) : null,
    mov.length ? pannello('Entrate e uscite per mese', legenda(serieBarre), grafico('Entrate e uscite per mese', w => graficoBarre(w, { categorie: mesi.map(fmtMese), serie: serieBarre, fmt: v => fmtNum(v, 0) }))) : null,
    perCat.length ? pannello('Uscite per categoria negli ultimi 12 mesi', barreOrizzontali(perCat, fmtEuro)) : null,
    pannelloTetti(mov),
    mov.length ? pannello('Ultimi movimenti', tabella('finanze', 'movimento', voci('finanze', 'movimento'), { limite: 12, filtro: false })) : null,
  ];
}
/* Tetti di spesa: spesa del mese in corso e dell'ultimo mese completo per ogni categoria con un tetto. */
function pannelloTetti(mov) {
  const tetti = new Map(); for (const b of voci('finanze', 'budget').sort(perData)) tetti.set(b.categoria, b);
  if (!tetti.size) return mov.length ? pannello('Tetti di spesa', h('p', { class: 'attenuato' }, 'Nessun tetto impostato. Fissane uno per le categorie che vuoi tenere sotto controllo (per esempio ristoranti): l\'indice finanziario controlla ogni mese se lo rispetti.'), h('div', { class: 'azioni' }, btn('Aggiungi un tetto', () => apriModulo('finanze', 'budget', null, { data: oggi() }), 'piccolo'))) : null;
  const corrente = oggi().slice(0, 7), prec = mesiCompleti(1)[0];
  const spesa = (cat, mese) => Math.abs(somma(mov.filter(v => v.data.startsWith(mese) && v.categoria === cat && v.valore < 0).map(v => v.valore)));
  return pannello('Tetti di spesa', h('ul', { class: 'elenco' }, [...tetti.values()].map(b => {
    const ora = spesa(b.categoria, corrente), prima = spesa(b.categoria, prec), q = b.valore ? ora / b.valore : 0;
    return h('li', { class: 'cliccabile', tabindex: 0, onclick: () => apriModulo('finanze', 'budget', b) },
      h('div', { class: 'tra' }, h('strong', {}, b.categoria), h('span', { class: 'num' + (ora > b.valore ? ' fuori' : '') }, `${fmtEuro(ora)} di ${fmtEuro(b.valore)}`)),
      h('span', { class: 'rip-pista' }, h('span', { class: 'rip-barra ' + (q > 1 ? 'ritardo' : q > 0.8 ? 'vuota' : 'ok'), style: `width:${Math.max(2, Math.min(100, q * 100))}%` })),
      h('div', { class: 'elenco-nota' }, `Questo mese. ${fmtMese(prec)}: ${fmtEuro(prima)}` + (prima > b.valore ? ', sforato.' : '.')));
  })));
}

/* --- Organizzazione: obiettivi, cose da fare, revisione settimanale --- */
function cruscottoOrganizzazione() {
  const ob = voci('organizzazione', 'obiettivo'), att = voci('organizzazione', 'attivita'), rev = voci('organizzazione', 'revisione').sort(perData);
  if (!ob.length && !att.length && !rev.length) return pannello('', vuoto('Cartella vuota. Parti da 3-5 obiettivi per i prossimi 12 mesi, divisi tra lavoro, famiglia e personale. Gli appuntamenti restano nei tuoi calendari Google e iCloud: qui ci sono le priorità.', btn('Aggiungi un obiettivo', () => apriModulo('organizzazione', 'obiettivo', null, { data: oggi(), stato: 'attivo', avanzamento: 0 }), 'primario'), btn('Aggiungi una cosa da fare', () => apriModulo('organizzazione', 'attivita', null, { stato: 'da fare', priorita: 'media' }))));
  const attivi = ob.filter(o => o.stato === 'attivo' || !o.stato);
  const aperte = att.filter(x => x.stato !== 'fatta').sort((a, b) => ['alta', 'media', 'bassa'].indexOf(a.priorita) - ['alta', 'media', 'bassa'].indexOf(b.priorita) || perData(a, b));
  const ultimaRev = rev[rev.length - 1];
  const perAmbito = raggruppa(attivi, o => o.ambito || 'Senza ambito');
  return [
    h('div', { class: 'dati' }, dato('Obiettivi attivi', attivi.length, `${ob.filter(o => o.stato === 'raggiunto').length} raggiunti`), dato('Cose da fare aperte', aperte.length, `${aperte.filter(x => x.stato !== 'fatta' && giorniDa(x.data) > 0).length} in ritardo`, aperte.some(x => giorniDa(x.data) > 0) ? 'allerta' : ''),
      dato('Ultima revisione', ultimaRev ? fmtData(ultimaRev.data) : 'mai', ultimaRev && ultimaRev.voto ? `voto ${ultimaRev.voto} su 5` : '')),
    attivi.length ? pannello('Obiettivi', [...perAmbito].map(([amb, l]) => [h('h3', {}, amb), h('ul', { class: 'elenco' }, l.map(o => h('li', { class: 'cliccabile', tabindex: 0, onclick: () => apriModulo('organizzazione', 'obiettivo', o) },
      h('div', { class: 'tra' }, h('strong', {}, o.titolo), h('span', { class: 'attenuato num' }, `${fmtNum(o.avanzamento || 0, 0)}%` + (o.scadenza ? `, entro il ${fmtData(o.scadenza)}` : ''))),
      h('span', { class: 'rip-pista' }, h('span', { class: 'rip-barra ok', style: `width:${Math.max(2, Math.min(100, o.avanzamento || 0))}%` })),
      o.misura ? h('div', { class: 'elenco-nota' }, o.misura) : null)))])) : null,
    pannello('Cose da fare', aperte.length ? h('ul', { class: 'elenco' }, aperte.slice(0, 15).map(x => { const g = -giorniDa(x.data); return h('li', {}, h('div', { class: 'tra' }, h('span', {}, h('strong', {}, x.titolo), h('span', { class: 'attenuato' }, [x.ambito, x.priorita ? 'priorità ' + x.priorita : ''].filter(Boolean).map(s => ' ' + s).join(','))),
      stato(g < 0 ? 'ritardo' : 'vuota', g < 0 ? `In ritardo dal ${fmtData(x.data)}` : g === 0 ? 'Oggi' : fmtData(x.data))),
      h('div', { class: 'azioni' }, btn('Fatta', () => metti({ ...x, stato: 'fatta', fatta_il: oggi() }), 'piccolo'), btn('Modifica', () => apriModulo('organizzazione', 'attivita', x), 'piccolo'))); })) : h('p', { class: 'attenuato' }, 'Niente in sospeso.'),
      h('div', { class: 'azioni' }, btn('Aggiungi', () => apriModulo('organizzazione', 'attivita', null, { stato: 'da fare', priorita: 'media' }), 'piccolo'), h('a', { class: 'btn piccolo', href: '#/task' }, 'Apri Task'))),
    pannello('Revisione della settimana', ultimaRev ? [h('p', { class: 'attenuato piccolo' }, `Settimana del ${fmtData(ultimaRev.data)}`), ultimaRev.focus ? h('div', { class: 'testo-lungo' }, h('strong', {}, 'Focus: '), ultimaRev.focus) : null] : h('p', { class: 'attenuato' }, 'Dieci minuti a settimana: cosa è andato, cosa no, le tre cose su cui concentrarti. È l\'abitudine che tiene vivo tutto il resto.'),
      h('div', { class: 'azioni' }, btn('Scrivi la revisione', () => apriModulo('organizzazione', 'revisione', null, { data: lunedi(oggi()) }), 'piccolo'))),
  ];
}

/* --- Sport: attività e sedute da scheda --- */
function cruscottoSport() {
  const at = voci('sport', 'attivita').sort(perData), al = voci('sport', 'allenamento');
  if (!at.length && !al.length && !voci('sport', 'massimale').length) return pannello('', vuoto('Cartella vuota. Registra le attività (palestra, corsa, padel…) oppure manda a Claude le schede di allenamento: le sedute le ricava lui.', btn('Aggiungi un\'attività', () => apriModulo('sport', 'attivita', null, { data: oggi() }), 'primario')));
  const tutte = [...at, ...al].sort(perData);
  const sett = []; if (tutte.length) { let l = lunedi(tutte[0].data); const fine = lunedi(oggi()); while (l <= fine) { sett.push(l); l = isoData(...((d) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()])(new Date(tempo(l) + 7 * MS_G))); } }
  const ultime = sett.slice(-12);
  const serie = [{ nome: 'Sedute', classe: 'g-barra1', valori: ultime.map(s => tutte.filter(v => lunedi(v.data) === s).length) }];
  const perDisc = [...raggruppa(at.filter(v => giorniDa(v.data) < 90), v => v.disciplina)].map(([nome, l]) => ({ nome, valore: l.length })).sort((a, b) => b.valore - a.valore);
  return [
    h('div', { class: 'dati' }, dato('Sedute nelle ultime 4 settimane', tutte.filter(v => giorniDa(v.data) < 28).length, 'obiettivo: almeno 3 a settimana'), at.length ? dato('Minuti nelle ultime 4 settimane', fmtNum(somma(at.filter(v => giorniDa(v.data) < 28).map(v => v.minuti)), 0)) : null),
    ultime.length > 1 ? pannello('Sedute per settimana', grafico('Sedute per settimana', w => graficoBarre(w, { categorie: ultime.map(s => fmtData(s).replace(/ \d{4}$/, '')), serie, alto: 160 }))) : null,
    perDisc.length ? pannello('Attività negli ultimi 90 giorni', barreOrizzontali(perDisc, v => fmtNum(v, 0))) : null,
    at.length ? pannello('Ultime attività', tabella('sport', 'attivita', at, { limite: 8, filtro: false })) : null,
    pannelloAllenamenti(),
  ];
}

/* --- Mindfulness: costanza della pratica e stress misurato dal Garmin --- */
function cruscottoMindfulness() {
  const pr = voci('mindfulness', 'pratica').sort(perData), stress = mediaRecente('Stress medio', 14), stressPrima = (() => { const l = serieMetrica('Stress medio', 'sensore').filter(v => giorniDa(v.data) >= 14 && giorniDa(v.data) < 42); return l.length >= 7 ? somma(l.map(v => v.valore)) / l.length : null; })();
  if (!pr.length && !stress) return pannello('', vuoto('Cartella vuota. Registra ogni pratica, anche di 5 minuti: conta la costanza, non la durata. Lo stress misurato dal Garmin compare qui da solo.', btn('Aggiungi una pratica', () => apriModulo('mindfulness', 'pratica', null, { data: oggi() }), 'primario')));
  const giorni30 = new Set(pr.filter(v => giorniDa(v.data) < 30).map(v => v.data)).size;
  let serie = 0; { let d = oggi(); const giorni = new Set(pr.map(v => v.data)); if (!giorni.has(d)) d = isoData(...((x) => [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()])(new Date(tempo(d) - MS_G))); while (giorni.has(d)) { serie++; d = isoData(...((x) => [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()])(new Date(tempo(d) - MS_G))); } }
  return [
    h('div', { class: 'dati' }, dato('Giorni di pratica negli ultimi 30', giorni30), dato('Giorni consecutivi', serie), pr.length ? dato('Minuti negli ultimi 30 giorni', fmtNum(somma(pr.filter(v => giorniDa(v.data) < 30).map(v => v.minuti)), 0)) : null,
      stress ? dato('Stress medio Garmin, 14 giorni', fmtNum(stress.media, 0), stressPrima ? `prima ${fmtNum(stressPrima, 0)}; più basso è meglio` : 'su 100; più basso è meglio') : null),
    pannelloSerie('Stress misurato', voci('salute', 'sensore').filter(v => v.metrica === 'Stress medio' || v.metrica === 'Body Battery massima'), 'Lo stress arriva dal Garmin una volta attivato lo scaricamento.'),
    pr.length ? pannello('Ultime pratiche', tabella('mindfulness', 'pratica', pr, { limite: 10, filtro: false })) : null,
  ];
}

/* --- Lettura --- */
function cruscottoLettura() {
  const li = voci('lettura', 'libro'), se = voci('lettura', 'sessione');
  if (!li.length && !se.length) return pannello('', vuoto('Cartella vuota. Aggiungi il libro che stai leggendo e quelli in lista. Per ogni libro finito tieni le idee da applicare: è la parte che vale di più.', btn('Aggiungi un libro', () => apriModulo('lettura', 'libro', null, { stato: 'in lettura', data: oggi() }), 'primario')));
  const anno = oggi().slice(0, 4), letti = li.filter(v => v.stato === 'letto').sort((a, b) => (b.fine || '').localeCompare(a.fine || ''));
  const inLettura = li.filter(v => v.stato === 'in lettura'), lista = li.filter(v => v.stato === 'da leggere');
  const carta = v => h('li', { class: 'cliccabile', tabindex: 0, onclick: () => apriModulo('lettura', 'libro', v) }, h('div', { class: 'tra' }, h('strong', {}, v.titolo), h('span', { class: 'attenuato' }, [v.autore, v.voto ? `voto ${v.voto} su 5` : '', v.fine ? fmtData(v.fine) : ''].filter(Boolean).join(', '))), v.idee ? h('div', { class: 'elenco-nota testo-lungo' }, v.idee) : null);
  return [
    h('div', { class: 'dati' }, dato(`Libri letti nel ${anno}`, letti.filter(v => (v.fine || '').startsWith(anno)).length), dato('In lettura', inLettura.length), dato('In lista', lista.length),
      se.length ? dato('Minuti di lettura negli ultimi 30 giorni', fmtNum(somma(se.filter(v => giorniDa(v.data) < 30).map(v => v.minuti)), 0)) : null),
    inLettura.length ? pannello('In lettura', h('ul', { class: 'elenco' }, inLettura.map(carta))) : null,
    letti.length ? pannello('Letti, con le idee da tenere', h('ul', { class: 'elenco' }, letti.slice(0, 20).map(carta))) : null,
    lista.length ? pannello('Da leggere', h('ul', { class: 'elenco' }, lista.map(carta))) : null,
  ];
}

/* --- Patrimonio --- */
function cruscottoPatrimonio() {
  const beni = voci('patrimonio', 'bene'), debiti = voci('patrimonio', 'debito'), fin = totaleFinanze(voci('finanze', 'saldo'));
  if (!beni.length && !debiti.length) return pannello('', vuoto('Cartella vuota. Inserisci i beni con il loro valore stimato e i debiti con il residuo: il patrimonio netto si calcola da solo, insieme alle disponibilità della cartella Finanze.', btn('Aggiungi un bene', () => apriModulo('patrimonio', 'bene'), 'primario'), btn('Aggiungi un debito', () => apriModulo('patrimonio', 'debito'))));
  const tb = somma(beni.map(v => v.valore)), td = somma(debiti.map(v => Math.abs(v.valore)));
  const perTipo = [...raggruppa(beni, v => v.categoria || 'Altro')].map(([nome, l]) => ({ nome, valore: somma(l.map(v => v.valore)) }));
  if (fin) perTipo.push({ nome: 'Disponibilità finanziarie', valore: fin });
  return [
    h('div', { class: 'dati' }, dato('Patrimonio netto', fmtEuro(tb + fin - td), 'beni e disponibilità meno debiti'), dato('Beni', fmtEuro(tb), `${beni.length} voci`), dato('Debiti', fmtEuro(td), debiti.length ? `rate mensili ${fmtEuro(somma(debiti.map(v => v.rata)))}` : '')),
    pannello('Composizione', barreOrizzontali(perTipo.sort((a, b) => b.valore - a.valore), fmtEuro)),
    beni.length ? pannello('Beni', tabella('patrimonio', 'bene', beni, { filtro: false })) : null,
    debiti.length ? pannello('Debiti', tabella('patrimonio', 'debito', debiti, { filtro: false })) : null,
  ];
}

/* --- Viaggi ed esperienze --- */
function cruscottoViaggi() {
  const vg = voci('viaggi', 'viaggio').sort(perData), es = voci('viaggi', 'esperienza').sort(perData);
  if (!vg.length && !es.length) return pannello('', vuoto('Cartella vuota. Registra i viaggi fatti e quelli in programma, con chi eri e cosa vuoi ricordare.', btn('Aggiungi un viaggio', () => apriModulo('viaggi', 'viaggio'), 'primario'), btn('Aggiungi un\'esperienza', () => apriModulo('viaggi', 'esperienza'))));
  const giorni = somma(vg.map(v => (v.fine && v.fine >= v.data ? (tempo(v.fine) - tempo(v.data)) / MS_G + 1 : 1)));
  const tutti = [...vg, ...es].sort(perData), anni = [...new Set(tutti.map(v => v.data.slice(0, 4)))].sort();
  const serie = [{ nome: 'Viaggi', classe: 'g-barra1', valori: anni.map(a => vg.filter(v => v.data.startsWith(a)).length) }, { nome: 'Esperienze', classe: 'g-barra2', valori: anni.map(a => es.filter(v => v.data.startsWith(a)).length) }];
  const carta = (v, tipo) => h('li', { class: 'cliccabile', tabindex: 0, onclick: () => apriModulo('viaggi', tipo, v) }, h('div', { class: 'tra' }, h('strong', {}, v.titolo), h('span', { class: 'attenuato' }, fmtData(v.data) + (v.fine ? ' – ' + fmtData(v.fine) : ''))),
    h('div', { class: 'elenco-nota' }, [v.luogo, v.paese, v.con ? 'con ' + v.con : '', v.voto ? `voto ${v.voto} su 5` : '', v.valore ? fmtEuro(v.valore) : ''].filter(Boolean).join(', ')), v.nota ? h('div', { class: 'elenco-nota testo-lungo' }, v.nota) : null);
  const futuri = vg.filter(v => v.data > oggi());
  return [
    h('div', { class: 'dati' }, dato('Viaggi', vg.length, `${giorni} giorni in viaggio`), dato('Paesi', new Set(vg.map(v => v.paese).filter(Boolean)).size), dato('Esperienze', es.length), dato('Spesa registrata', fmtEuro(somma(tutti.map(v => v.valore))))),
    futuri.length ? pannello('In programma', h('ul', { class: 'elenco' }, futuri.map(v => carta(v, 'viaggio')))) : null,
    anni.length > 1 ? pannello('Per anno', legenda(serie), grafico('Viaggi ed esperienze per anno', w => graficoBarre(w, { categorie: anni, serie, alto: 170 }))) : null,
    pannello('Diario', h('ul', { class: 'elenco' }, tutti.filter(v => v.data <= oggi()).reverse().slice(0, 40).map(v => carta(v, v.tipo)))),
  ];
}

/* --- Cartelle personalizzate --- */
function cruscottoLibero(a) {
  const l = voci(a.id, 'voce').sort(perData);
  if (!l.length) return pannello('', vuoto('Cartella vuota. Ogni voce ha titolo, data, categoria, un valore numerico facoltativo e note.', btn('Aggiungi una voce', () => apriModulo(a.id, 'voce'), 'primario')));
  const num = l.filter(v => typeof v.valore === 'number');
  const perCat = [...raggruppa(l, v => v.categoria || 'Senza categoria')].map(([nome, x]) => ({ nome, valore: x.length })).sort((p, q) => q.valore - p.valore);
  return [
    h('div', { class: 'dati' }, dato('Voci', l.length, `ultima il ${fmtData(l[l.length - 1].data)}`), num.length ? dato('Somma dei valori', fmtNum(somma(num.map(v => v.valore)))) : null),
    num.length > 1 ? pannello('Valori nel tempo', grafico('Valori nel tempo', w => graficoLinea(w, { punti: num.map(v => ({ data: v.data, y: v.valore, righe: [v.titolo] })), unita: num[num.length - 1].unita }))) : null,
    perCat.length > 1 ? pannello('Voci per categoria', barreOrizzontali(perCat, v => fmtNum(v, 0))) : null,
    pannello('Ultime voci', tabella(a.id, 'voce', l, { limite: 10, filtro: false })),
  ];
}

/* --- Progetti: schede da portare in una chat e riportare indietro aggiornate --- */
function schedaProgetto(v) {
  return [`<!-- archivio-vita:progetto id=${v.id} versione=${v.versione || 1} esportato=${adesso()} -->`, `# ${v.titolo}`, '', `Stato: ${v.stato || 'attivo'}`, `Obiettivo: ${(v.obiettivo || '').replace(/\s*\n\s*/g, ' ')}`, '',
    '<!-- istruzioni:inizio -->', '> Per l\'assistente: questo file è la base di lavoro del progetto, conservata nell\'archivio personale del proprietario.',
    '> Parti da qui invece che da zero. A fine sessione restituisci questo stesso file completo e aggiornato (decisioni prese, stato, dati nuovi, prossimi passi),',
    '> lasciando intatte la prima riga e le righe Stato e Obiettivo, così può essere ricaricato nell\'archivio come nuova versione.', '<!-- istruzioni:fine -->', '', v.contenuto || ''].join('\n');
}
function leggiScheda(testo) {
  const out = {}; let t = testo.replace(/^﻿/, '');
  const m = t.match(/<!--\s*archivio-vita:progetto\s+id=(\S+)\s+versione=(\d+)[^>]*-->/);
  if (m) { out.id = m[1]; out.daVersione = +m[2]; t = t.replace(m[0], ''); }
  t = t.replace(/<!--\s*istruzioni:inizio\s*-->[\s\S]*?<!--\s*istruzioni:fine\s*-->/, '');
  const righe = t.replace(/^\s+/, '').split(/\r?\n/);
  if (/^#\s+/.test(righe[0] || '')) out.titolo = righe.shift().replace(/^#\s+/, '').trim();
  while (righe.length && (righe[0].trim() === '' || /^(Stato|Obiettivo):/.test(righe[0]))) {
    const r = righe.shift(), k = r.match(/^(Stato|Obiettivo):\s*(.*)$/);
    if (k) out[k[1].toLowerCase()] = k[2].trim();
  }
  out.contenuto = righe.join('\n').trim();
  return out;
}
function aggiornaContenuto(v, nuovo, origine, campi = {}) {
  if ((v.contenuto || '') !== nuovo && (v.contenuto || '').trim()) {
    v.versioni = [...(v.versioni || []), { n: v.versione || 1, quando: v.agg, contenuto: v.contenuto }].slice(-40);
  }
  if ((v.contenuto || '') !== nuovo) v.versione = (v.versione || 1) + ((v.contenuto || '').trim() ? 1 : 0);
  Object.assign(v, campi, { contenuto: nuovo });
  annota('Scheda di progetto aggiornata', origine, { aggiunti: 0, aggiornati: 1, saltati: 0, errori: [] });
  metti(v);
}
async function caricaScheda(file, v) {
  const sch = leggiScheda(await leggiFile(file));
  if (!sch.contenuto) { avviso(`"${file.name}" è vuoto: scheda non caricata.`, 'errore'); return; }
  if (!v && sch.id) v = voce(sch.id);
  if (v && sch.id && sch.id !== v.id && !confirm('Questo file appartiene a un altro progetto. Caricarlo comunque qui?')) return;
  const campi = {}; if (sch.titolo) campi.titolo = sch.titolo; if (sch.stato) campi.stato = sch.stato; if (sch.obiettivo) campi.obiettivo = sch.obiettivo;
  if (!v) { v = metti({ area: 'progetti', tipo: 'progetto', persona: personaPredefinita(), titolo: sch.titolo || file.name.replace(/\.[^.]+$/, ''), stato: sch.stato || 'attivo', obiettivo: sch.obiettivo || '', contenuto: '', versione: 1 }, false); }
  else if (sch.daVersione && sch.daVersione < (v.versione || 1) && !confirm(`Il file parte dalla versione ${sch.daVersione}, ma in archivio c'è già la ${v.versione}. Caricandolo, la versione attuale finisce nella cronologia. Procedere?`)) return;
  aggiornaContenuto(v, sch.contenuto, file.name, campi);
  avviso(`Scheda caricata: "${v.titolo}" è ora alla versione ${v.versione}.`);
  location.hash = '#/a/progetti/p/' + v.id;
}
const scegliFile = (accept, fn, multiplo) => { const i = h('input', { type: 'file', accept, multiple: !!multiplo, onchange: () => { if (i.files.length) fn(multiplo ? [...i.files] : i.files[0]); } }); i.click(); };
function cruscottoProgetti() {
  const l = voci('progetti', 'progetto').sort((a, b) => (b.agg || '').localeCompare(a.agg || ''));
  const azioni = h('div', { class: 'azioni' }, btn('Nuovo progetto', () => apriModulo('progetti', 'progetto', null, { stato: 'attivo' }), 'primario'), btn('Carica una scheda (.md)', () => scegliFile('.md,.txt,text/markdown,text/plain', f => caricaScheda(f, null))));
  return [
    h('p', { class: 'sotto largo-testo' }, 'Ogni progetto è una scheda di testo che conserva ragionamenti, decisioni e stato. La scarichi, la alleghi a una chat con un assistente, e ricarichi qui la versione aggiornata: la base resta tua e cresce a ogni giro.'),
    azioni,
    l.length ? h('div', { class: 'griglia' }, l.map(v => h('a', { class: 'scheda', href: '#/a/progetti/p/' + v.id }, h('h3', {}, v.titolo), h('p', {}, v.obiettivo || ''), h('p', { class: 'attenuato piccolo' }, `${v.stato || ''}, versione ${v.versione || 1}, aggiornato il ${fmtData((v.agg || '').slice(0, 10))}`)))) : vuoto('Nessun progetto. Creane uno e incolla dentro il riassunto di una chat, oppure carica una scheda già pronta.'),
  ];
}
function vistaProgetto(id) {
  const v = voce(id); if (!v) return vuoto('Progetto non trovato.');
  const area_ = h('textarea', { class: 'scheda-testo', rows: 22, spellcheck: 'false', 'aria-label': 'Contenuto della scheda' }, v.contenuto || '');
  const doc = S.A.allegati.filter(a => !a.canc && a.rif === id);
  return h('div', {},
    h('p', { class: 'briciole' }, h('a', { href: '#/a/progetti' }, 'Progetti'), ' / ', v.titolo),
    h('div', { class: 'testa' }, h('div', {}, h('h1', {}, v.titolo), h('p', { class: 'sotto' }, `${v.stato || ''}, versione ${v.versione || 1}, aggiornato il ${fmtQuando(v.agg)}`)),
      h('div', { class: 'azioni' }, btn('Scarica la scheda', () => scarica(nomeFile(v.titolo) + '.md', schedaProgetto(v), 'text/markdown'), 'primario'), btn('Carica la versione aggiornata', () => scegliFile('.md,.txt,text/markdown,text/plain', f => caricaScheda(f, v))), btn('Titolo e stato', () => apriModulo('progetti', 'progetto', v)))),
    v.obiettivo ? h('p', { class: 'largo-testo' }, h('strong', {}, 'Obiettivo: '), v.obiettivo) : null,
    pannello('Contenuto', area_, h('div', { class: 'azioni' }, btn('Salva il testo', () => { if (area_.value === (v.contenuto || '')) { avviso('Nessuna modifica da salvare.'); return; } aggiornaContenuto(v, area_.value, 'modifica a mano'); avviso(`Salvato come versione ${v.versione}.`); }, 'primario'), btn('Copia negli appunti', () => navigator.clipboard.writeText(schedaProgetto(v)).then(() => avviso('Scheda copiata.'), () => avviso('Copia non riuscita: usa Scarica la scheda.', 'errore'))))),
    pannello('Cronologia', (v.versioni || []).length ? h('ul', { class: 'elenco' }, [...v.versioni].reverse().map(x => h('li', {}, h('div', { class: 'tra' }, h('span', {}, h('strong', {}, `Versione ${x.n}`), h('span', { class: 'attenuato' }, ` del ${fmtQuando(x.quando)}, ${fmtNum(x.contenuto.length, 0)} caratteri`)),
      h('span', { class: 'azioni' }, btn('Vedi', () => apriModale(`Versione ${x.n}`, h('pre', { class: 'testo-lungo' }, x.contenuto), true), 'piccolo'), btn('Ripristina', () => { if (confirm(`Riportare il contenuto alla versione ${x.n}? Quella attuale resta in cronologia.`)) aggiornaContenuto(v, x.contenuto, `ripristino versione ${x.n}`); }, 'piccolo')))))) : h('p', { class: 'attenuato' }, 'Le versioni precedenti compaiono qui a ogni aggiornamento. Se ne conservano 40.')),
    pannello('File del progetto', doc.length ? elencoDocumenti(doc) : h('p', { class: 'attenuato' }, 'Nessun file collegato.'), h('div', { class: 'azioni' }, btn('Aggiungi file', () => scegliFile('', fs => caricaDocumenti(fs, { rif: id, area: 'progetti', stato: 'elaborato' }), true), 'piccolo'))));
}

/* --- Scadenze --- */
function creaIcs(lista) {
  const righe = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Archivio di vita//IT'];
  const freq = { mensile: 'FREQ=MONTHLY', trimestrale: 'FREQ=MONTHLY;INTERVAL=3', semestrale: 'FREQ=MONTHLY;INTERVAL=6', annuale: 'FREQ=YEARLY' };
  const pulisci = t => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  for (const x of lista) {
    const d = x.data.replace(/-/g, ''), fine = isoData(...((dt) => [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()])(new Date(tempo(x.data) + MS_G))).replace(/-/g, '');
    righe.push('BEGIN:VEVENT', `UID:${x.id}@archivio-vita`, `DTSTAMP:${adesso().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${fine}`, `SUMMARY:${pulisci(x.titolo)}`);
    if (x.nota) righe.push(`DESCRIPTION:${pulisci(x.nota)}`);
    if (freq[x.ripeti]) righe.push('RRULE:' + freq[x.ripeti]);
    righe.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Promemoria', 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
  }
  righe.push('END:VCALENDAR');
  return righe.join('\r\n');
}
function vistaScadenze() {
  const l = voci('sistema', 'scadenza').sort(perData), aperte = l.filter(x => x.stato !== 'fatta'), fatte = l.filter(x => x.stato === 'fatta').reverse();
  const fatta = x => { const pros = prossimaData(x.data, x.ripeti); if (pros) { let d = pros; while (d <= oggi()) d = prossimaData(d, x.ripeti); metti({ ...x, data: d }); avviso(`Fatta. Prossima il ${fmtData(d)}.`); } else metti({ ...x, stato: 'fatta', fatta_il: oggi() }); };
  return h('div', {},
    h('div', { class: 'testa' }, h('h1', {}, 'Scadenze'), h('div', { class: 'azioni' }, btn('Aggiungi', () => apriModulo('sistema', 'scadenza', null, { stato: 'da fare', ripeti: 'mai' }), 'primario'), aperte.length ? btn('Porta nel calendario (.ics)', () => scarica('scadenze.ics', creaIcs(aperte), 'text/calendar')) : null)),
    pannello('Da fare', aperte.length ? h('ul', { class: 'elenco' }, aperte.map(x => { const g = -giorniDa(x.data); return h('li', {}, h('div', { class: 'tra' }, h('span', {}, h('strong', {}, x.titolo), x.zona ? h('span', { class: 'attenuato' }, ' ' + x.zona) : null), stato(g < 0 ? 'ritardo' : 'vuota', g < 0 ? `Scaduta il ${fmtData(x.data)}` : g === 0 ? 'Oggi' : `${fmtData(x.data)}, tra ${g} giorni`)),
      x.nota ? h('div', { class: 'elenco-nota testo-lungo' }, x.nota) : null, h('div', { class: 'azioni' }, btn('Fatta', () => fatta(x), 'piccolo'), btn('Modifica', () => apriModulo('sistema', 'scadenza', x), 'piccolo'), x.ripeti && x.ripeti !== 'mai' ? h('span', { class: 'attenuato piccolo' }, 'si ripete: ' + x.ripeti) : null)); })) : h('p', { class: 'attenuato' }, 'Nessuna scadenza aperta.')),
    fatte.length ? pannello('Fatte', tabella('sistema', 'scadenza', fatte, { limite: 30, filtro: false })) : null);
}

/* --- Documenti: gli originali, cifrati --- */
const APRIBILI = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/;
async function apriAllegato(a, forzaScarica) {
  try {
    const bytes = await contenutoAllegato(a);
    if (!forzaScarica && APRIBILI.test(a.mime)) {
      /* Solo PDF, immagini e testo semplice si aprono nella pagina; tutto il resto si scarica, così un file non può eseguire codice qui dentro. */
      const url = URL.createObjectURL(new Blob([bytes], { type: a.mime }));
      const vista = a.mime === 'text/plain' ? h('pre', { class: 'testo-lungo' }, decod.decode(bytes)) : a.mime === 'application/pdf' ? h('iframe', { class: 'visore', src: url, title: a.nome }) : h('img', { class: 'visore-img', src: url, alt: a.nome });
      apriModale(a.nome, h('div', {}, h('div', { class: 'azioni' }, h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, 'Apri in una nuova scheda'), btn('Scarica', () => scarica(a.nome, new Blob([bytes], { type: a.mime })))), vista), true);
    } else scarica(a.nome, new Blob([bytes], { type: 'application/octet-stream' }));
  } catch (e) { avviso(e.message, 'errore'); }
}
const MAX_DOC = 20 * 1048576;
async function caricaDocumenti(files, extra = {}) {
  const esito = { aggiunti: 0, aggiornati: 0, saltati: 0, errori: [] }, nomi = [];
  for (const f of files) {
    if (f.size > MAX_DOC) { esito.errori.push(`"${f.name}" supera i 20 MB: non caricato.`); continue; }
    if (f.size === 0) { esito.errori.push(`"${f.name}" è vuoto: non caricato.`); continue; }
    try { await aggiungiAllegato(f, extra); esito.aggiunti++; nomi.push(f.name); } catch (e) { esito.errori.push(`"${f.name}" non caricato: ${e.message}`); }
  }
  annota('Caricamento documenti', nomi.join(', ').slice(0, 200) || 'nessun file', esito);
  salva();
  if (esito.errori.length) apriModale('Esito del caricamento', ricevuta(esito)); else avviso(`Documenti caricati e cifrati: ${esito.aggiunti}.`);
}
function modificaDocumento(a) {
  const pp = persone();
  const form = h('form', { class: 'modulo', onsubmit: e => { e.preventDefault(); const el = form.elements; Object.assign(a, { nome: el.nome.value.trim() || a.nome, area: el.area.value, data: el.data.value, stato: el.stato.value, nota: el.nota.value.trim(), persona: el.persona ? el.persona.value : a.persona, agg: adesso() }); salva(); chiudiModale(); } },
    h('label', { class: 'campo intero' }, h('span', {}, 'Nome'), h('input', { name: 'nome', value: a.nome })),
    h('label', { class: 'campo' }, h('span', {}, 'Cartella'), h('select', { name: 'area' }, h('option', { value: '' }, 'Nessuna'), aree().map(x => h('option', { value: x.id, selected: x.id === a.area }, x.nome)))),
    h('label', { class: 'campo' }, h('span', {}, 'Data del documento'), h('input', { name: 'data', type: 'date', value: a.data || '' })),
    h('label', { class: 'campo' }, h('span', {}, 'Stato'), h('select', { name: 'stato' }, ['da elaborare', 'elaborato'].map(x => h('option', { value: x, selected: x === a.stato }, x)))),
    pp.length > 1 ? h('label', { class: 'campo' }, h('span', {}, 'Persona'), h('select', { name: 'persona' }, pp.map(p => h('option', { value: p.id, selected: p.id === a.persona }, p.nome)))) : null,
    h('label', { class: 'campo intero' }, h('span', {}, 'Nota'), h('textarea', { name: 'nota', rows: 3 }, a.nota || '')),
    h('div', { class: 'azioni intero' }, h('button', { class: 'btn primario', type: 'submit' }, 'Salva'), btn('Elimina', () => { if (confirm(`Eliminare "${a.nome}"? Il file viene rimosso anche dal cloud alla prossima sincronizzazione.`)) { blobTogli(a.id); togli('allegati', a.id); chiudiModale(); } }, 'pericolo')));
  apriModale('Documento', form);
}
function elencoDocumenti(l) {
  return h('div', { class: 'scorri' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Nome'), h('th', { class: 'solo-largo' }, 'Cartella'), h('th', {}, 'Data'), h('th', {}, 'Stato'), h('th', { class: 'solo-largo destra' }, 'Dimensione'))),
    h('tbody', {}, [...l].sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(a => h('tr', {}, h('td', {}, h('div', { class: 'testo-lungo' }, a.nome), a.nota ? h('div', { class: 'attenuato piccolo' }, a.nota) : null,
        h('div', { class: 'azioni stretta' }, btn('Apri', () => apriAllegato(a), 'piccolo'), btn('Scarica', () => apriAllegato(a, true), 'piccolo'), btn('Modifica', () => modificaDocumento(a), 'piccolo'))),
      h('td', { class: 'solo-largo' }, (area(a.area) || {}).nome || ''), h('td', { class: 'nonspezza' }, fmtData(a.data)),
      h('td', {}, stato(a.stato === 'elaborato' ? 'ok' : 'vuota', a.stato === 'elaborato' ? 'Elaborato' : 'Da elaborare')), h('td', { class: 'num destra solo-largo' }, fmtDim(a.dim)))))));
}
function vistaDocumenti() {
  const l = allegati();
  const selArea = h('select', { 'aria-label': 'Cartella di destinazione' }, h('option', { value: '' }, 'Nessuna cartella'), aree().map(x => h('option', { value: x.id }, x.nome)));
  const prendi = fs => caricaDocumenti(fs, { area: selArea.value });
  const zona = h('div', { class: 'zona-carica', ondragover: e => { e.preventDefault(); zona.classList.add('sopra'); }, ondragleave: () => zona.classList.remove('sopra'), ondrop: e => { e.preventDefault(); zona.classList.remove('sopra'); if (e.dataTransfer.files.length) prendi([...e.dataTransfer.files]); } },
    h('p', {}, h('strong', {}, 'Trascina qui i file'), ' oppure sceglili dal dispositivo. Vengono cifrati prima di essere salvati.'),
    h('div', { class: 'azioni' }, selArea, btn('Scegli i file', () => scegliFile('', prendi, true), 'primario')));
  return h('div', {},
    h('div', { class: 'testa' }, h('div', {}, h('h1', {}, 'Documenti'), h('p', { class: 'sotto largo-testo' }, 'Carica qui referti e documenti, anche dal telefono. Claude li legge e ne inserisce i valori nelle cartelle alla verifica del lunedì, o subito se glielo chiedi.'))),
    zona,
    l.length ? pannello(`${l.length} documenti, ${fmtDim(somma(l.map(a => a.dim)))}`, elencoDocumenti(l)) : null);
}
