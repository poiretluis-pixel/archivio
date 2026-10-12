/* ===== 7. Interfaccia: guscio, finestre, moduli, tabelle, importazione ===== */
function avviso(testo, tipo = 'ok') {
  let box = $('#avvisi'); if (!box) { box = h('div', { id: 'avvisi', 'aria-live': 'polite' }); document.body.append(box); }
  const el = h('div', { class: 'avviso ' + tipo }, testo);
  box.append(el); setTimeout(() => el.remove(), tipo === 'errore' ? 9000 : 4500);
}
function apriModale(titolo, contenuto, largo) {
  chiudiModale();
  const m = h('div', { id: 'modale', class: 'velo', onclick: e => { if (e.target.id === 'modale') chiudiModale(); } },
    h('div', { class: 'finestra' + (largo ? ' larga' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titolo },
      h('div', { class: 'finestra-testa' }, h('h2', {}, titolo), h('button', { class: 'btn piatto', 'aria-label': 'Chiudi', onclick: chiudiModale }, 'Chiudi')),
      h('div', { class: 'finestra-corpo' }, contenuto)));
  document.body.append(m);
  const primo = m.querySelector('input,select,textarea'); if (primo) primo.focus();
}
function chiudiModale() { const m = $('#modale'); if (m) m.remove(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiModale(); });
const btn = (testo, onclick, classe = '') => h('button', { type: 'button', class: 'btn ' + classe, onclick }, testo);
const vuoto = (testo, ...azioni) => h('div', { class: 'vuoto' }, h('p', {}, testo), azioni.length ? h('div', { class: 'azioni' }, azioni) : null);
const pannello = (titolo, ...kids) => h('section', { class: 'pannello' }, titolo ? h('h2', {}, titolo) : null, kids);
const dato = (etich, valore, nota, classe = '') => h('div', { class: 'dato ' + classe }, h('div', { class: 'dato-etichetta' }, etich), h('div', { class: 'dato-valore num' }, valore), nota ? h('div', { class: 'dato-nota' }, nota) : null);
const stato = (tipo, testo) => h('span', { class: 'stato ' + tipo }, h('span', { class: 'stato-segno', 'aria-hidden': 'true' }, { ok: '✓', ritardo: '!', vuota: '○', fuori: '◆' }[tipo] || '•'), testo);

/* --- Modulo generato dallo schema --- */
function controllo(f, v, idArea, idTipo) {
  const val = v[f.k];
  const base = { name: f.k, id: 'f-' + f.k, required: !!f.obbl };
  if (f.tipo === 'lungo') return h('textarea', { ...base, rows: 4 }, val || '');
  if (f.tipo === 'data') return h('input', { ...base, type: 'date', value: val || '' });
  if (f.tipo === 'numero') return h('input', { ...base, type: 'text', inputmode: 'decimal', value: val == null ? '' : String(val).replace('.', ','), autocomplete: 'off' });
  if (f.tipo === 'si_no') return h('input', { ...base, type: 'checkbox', checked: !!val });
  if (f.tipo === 'scelta') return h('select', base, h('option', { value: '' }, ''), f.opzioni.map(o => h('option', { value: o, selected: o === val }, o)));
  if (f.tipo === 'allegato') return h('select', base, h('option', { value: '' }, 'Nessuno'), S.A.allegati.filter(a => !a.canc).map(a => h('option', { value: a.id, selected: a.id === val }, `${a.nome} (${fmtData(a.data)})`)));
  const attr = { ...base, type: 'text', value: val || '', autocomplete: 'off' };
  if (f.suggerisci) {
    const usati = [...new Set([...(f.esempi || []), ...S.A.voci.filter(x => !x.canc && x.area === idArea && x.tipo === idTipo).map(x => x[f.k]).filter(Boolean)])].sort();
    if (usati.length) { attr.list = 'dl-' + f.k; return [h('input', attr), h('datalist', { id: 'dl-' + f.k }, usati.map(u => h('option', { value: u })))]; }
  }
  return h('input', attr);
}
function leggiModulo(form, def) {
  const out = {}, errori = [];
  for (const f of def.campi) {
    const el = form.elements[f.k]; if (!el) continue;
    if (f.tipo === 'si_no') { if (el.checked) out[f.k] = true; continue; }
    const grezzo = el.value.trim();
    if (!grezzo) { if (f.obbl) errori.push(`Manca "${f.etichetta}".`); continue; }
    if (f.tipo === 'numero') { const n = leggiNum(grezzo); if (n == null) errori.push(`"${f.etichetta}" non è un numero.`); else out[f.k] = n; }
    else out[f.k] = grezzo;
  }
  return { out, errori };
}
function apriModulo(idArea, idTipo, esistente, predefiniti = {}) {
  const def = tipoDef(idArea, idTipo);
  const v = esistente || { data: def.campi.some(f => f.k === 'data' && f.obbl) ? oggi() : undefined, persona: personaPredefinita(), ...predefiniti };
  const pp = persone();
  const err = h('div', { class: 'errore', role: 'alert' });
  const form = h('form', { class: 'modulo', onsubmit: e => {
    e.preventDefault();
    const { out, errori } = leggiModulo(form, def);
    if (errori.length) { err.textContent = errori.join(' '); return; }
    const extra = {}; for (const k of Object.keys(v)) if (!def.campi.some(f => f.k === k)) extra[k] = v[k];
    metti({ ...extra, ...out, area: idArea, tipo: idTipo, persona: pp.length > 1 ? form.elements.persona.value : v.persona });
    chiudiModale(); avviso('Salvato.');
  } },
    def.campi.map(f => h('label', { class: 'campo' + (f.tipo === 'si_no' ? ' riga' : '') + (f.tipo === 'lungo' ? ' intero' : '') }, h('span', {}, f.etichetta + (f.obbl ? ' *' : '')), controllo(f, v, idArea, idTipo))),
    pp.length > 1 ? h('label', { class: 'campo' }, h('span', {}, 'Persona'), h('select', { name: 'persona' }, pp.map(p => h('option', { value: p.id, selected: p.id === v.persona }, p.nome)))) : null,
    err,
    h('div', { class: 'azioni intero' }, h('button', { class: 'btn primario', type: 'submit' }, 'Salva'),
      esistente ? btn('Elimina', () => { if (confirm('Eliminare questa voce?')) { togli('voci', esistente.id); chiudiModale(); } }, 'pericolo') : null));
  apriModale((esistente ? 'Modifica: ' : 'Nuovo: ') + def.nome.toLowerCase(), form);
}

/* --- Tabella generata dallo schema --- */
function cella(def, v, k) {
  const f = def.campi.find(x => x.k === k) || {};
  const x = v[k];
  if (k === 'agg') return fmtData((x || '').slice(0, 10));
  if (k === 'valore' && typeof x !== 'number' && v.testo && def.campi.some(q => q.k === 'testo' && q.tipo === 'testo')) return v.testo;
  if (k === 'rif_testo') return testoRif(v);
  if (x == null || x === '') return '';
  if (f.tipo === 'si_no') return x ? 'sì' : '';
  if (f.tipo === 'data') return fmtData(x);
  if (f.tipo === 'numero') return f.euro ? fmtEuro(x) : fmtNum(x, 3);
  const t = String(x); return t.length > 90 ? t.slice(0, 88) + '…' : t;
}
function tabella(idArea, idTipo, lista, { limite, filtro = true } = {}) {
  const def = tipoDef(idArea, idTipo);
  const cols = [...def.colonne, ...(persone().length > 1 && !S.persona ? ['persona'] : [])];
  const ordinata = [...lista].sort((a, b) => (b.data || b.agg || '').localeCompare(a.data || a.agg || ''));
  const corpo = h('tbody');
  const riempi = q => {
    const righe = (q ? ordinata.filter(v => JSON.stringify(v).toLowerCase().includes(q)) : ordinata).slice(0, limite || 2000);
    const apri = v => (v.auto ? avviso('Dato scaricato da Garmin: si corregge nell\'app Garmin Connect.') : apriModulo(idArea, idTipo, v));
    corpo.replaceChildren(...righe.map(v => h('tr', { tabindex: 0, onclick: () => apri(v), onkeydown: e => { if (e.key === 'Enter') apri(v); } },
      cols.map(k => { const f = def.campi.find(x => x.k === k) || {}; return h('td', { class: (f.tipo === 'numero' ? 'num destra' : '') + (k === 'valore' && idTipo === 'misura' && fuoriIntervallo(v) ? ' fuori' : '') }, k === 'persona' ? nomePersona(v.persona) : cella(def, v, k), k === 'valore' && idTipo === 'misura' && fuoriIntervallo(v) ? h('span', { class: 'segno-fuori', title: 'Fuori intervallo' }, ' ◆') : null); }))));
    if (!righe.length) corpo.append(h('tr', {}, h('td', { colspan: cols.length, class: 'attenuato' }, 'Nessun risultato.')));
  };
  riempi('');
  return h('div', {},
    filtro && lista.length > 8 ? h('input', { class: 'cerca', type: 'search', placeholder: 'Cerca', 'aria-label': 'Cerca nella tabella', oninput: e => riempi(e.target.value.trim().toLowerCase()) }) : null,
    h('div', { class: 'scorri' }, h('table', {}, h('thead', {}, h('tr', {}, cols.map(k => { const f = def.campi.find(x => x.k === k) || {}; return h('th', { class: f.tipo === 'numero' ? 'destra' : '' }, k === 'rif_testo' ? 'Riferimento' : etichetta(def, k).replace(/ \(.*\)$/, '').replace(/ in euro.*$/, '')); }))), corpo)));
}
function esportaCsvTipo(idArea, idTipo) {
  const def = tipoDef(idArea, idTipo), l = voci(idArea, idTipo);
  const ks = [...def.campi.map(f => f.k), 'persona', 'id'];
  scarica(`${idArea}-${idTipo}-${oggi()}.csv`, creaCsv(ks, l.map(v => ks.map(k => (k === 'persona' ? nomePersona(v.persona) : typeof v[k] === 'number' ? String(v[k]).replace('.', ',') : v[k])))), 'text/csv');
}
function vistaTipo(idArea, idTipo) {
  const a = area(idArea), def = tipoDef(idArea, idTipo);
  if (!def) return vuoto('Questa sezione non esiste.');
  const l = voci(idArea, idTipo);
  return h('div', {},
    h('p', { class: 'briciole' }, h('a', { href: '#/a/' + idArea }, a.nome), ' / ', def.plur),
    h('div', { class: 'testa' }, h('h1', {}, def.plur), h('div', { class: 'azioni' },
      btn('Aggiungi', () => apriModulo(idArea, idTipo), 'primario'), btn('Importa CSV', () => apriImportaCsv(idArea, idTipo)), l.length ? btn('Esporta CSV', () => esportaCsvTipo(idArea, idTipo)) : null)),
    l.length ? tabella(idArea, idTipo, l) : vuoto(`Ancora nessun dato in "${def.plur}".`, btn('Aggiungi', () => apriModulo(idArea, idTipo), 'primario'), btn('Importa CSV', () => apriImportaCsv(idArea, idTipo))));
}

/* --- Importazione CSV con abbinamento delle colonne --- */
function apriImportaCsv(idArea, idTipo) {
  const def = tipoDef(idArea, idTipo);
  const corpo = h('div', {});
  const scegli = h('input', { type: 'file', accept: '.csv,.txt,text/csv', onchange: async e => {
    const file = e.target.files[0]; if (!file) return;
    const csv = leggiCsv(await leggiFile(file));
    if (!csv.intestazioni.length || !csv.righe.length) { corpo.replaceChildren(h('p', { class: 'errore' }, 'Il file è vuoto o non è un CSV leggibile. Nessun dato importato.')); return; }
    corpo.replaceChildren(abbinamento(file.name, csv));
  } });
  const norm = t => nomeFile(t).replace(/-/g, '');
  function abbinamento(nome, csv, modoScelto) {
    const opz = sel => [h('option', { value: '' }, 'Non importare'), ...csv.intestazioni.map((x, i) => h('option', { value: i, selected: i === sel }, x || `Colonna ${i + 1}`))];
    const indovina = f => csv.intestazioni.findIndex(x => { const a = norm(x), b = norm(f.etichetta), k = norm(f.k); return a && (a === k || a === b || b.startsWith(a) || a.startsWith(k) || (f.k === 'data' && /^(date|data|giorno|day)/.test(a))); });
    const largo = def.largo && csv.intestazioni.length > 2;
    const usaLargo = largo && (modoScelto || 'largo') === 'largo';
    const modo = h('select', { onchange: () => corpo.replaceChildren(abbinamento(nome, csv, modo.value)) },
      h('option', { value: 'largo', selected: usaLargo }, 'Una colonna per ogni metrica (tipico dei dispositivi)'), h('option', { value: 'lungo', selected: !usaLargo }, 'Una riga per ogni valore'));
    let campi, spunta, selData;
    if (usaLargo) {
      const iData = Math.max(0, csv.intestazioni.findIndex(x => /^(date|data|giorno|day)/i.test(x.trim())));
      selData = h('select', {}, opz(iData).slice(1));
      spunta = csv.intestazioni.map((x, i) => { const numerica = csv.righe.slice(0, 20).some(r => leggiNum(r[i]) != null); return h('input', { type: 'checkbox', value: i, checked: i !== iData && numerica }); });
      campi = h('div', { class: 'modulo' }, h('label', { class: 'campo' }, h('span', {}, 'Colonna della data'), selData),
        h('fieldset', { class: 'intero' }, h('legend', {}, 'Metriche da importare'), csv.intestazioni.map((x, i) => h('label', { class: 'spunta' }, spunta[i], x || `Colonna ${i + 1}`))));
    } else {
      campi = h('div', { class: 'modulo' }, def.campi.filter(f => f.tipo !== 'allegato').map(f => h('label', { class: 'campo' }, h('span', {}, f.etichetta + (f.obbl ? ' *' : '')), h('select', { 'data-k': f.k }, opz(indovina(f))))));
    }
    const fonte = h('input', { type: 'text', placeholder: 'es. Garmin Cirqa' });
    const err = h('div', { class: 'errore', role: 'alert' });
    return h('div', {},
      h('p', {}, `File "${nome}": ${csv.righe.length} righe, ${csv.intestazioni.length} colonne.`),
      largo ? h('label', { class: 'campo' }, h('span', {}, 'Com\'è fatto il file'), modo) : null,
      campi,
      usaLargo && def.campi.some(f => f.k === 'fonte') ? h('label', { class: 'campo' }, h('span', {}, 'Dispositivo o fonte'), fonte) : null,
      h('details', {}, h('summary', {}, 'Anteprima delle prime righe'), h('div', { class: 'scorri' }, h('table', {}, h('thead', {}, h('tr', {}, csv.intestazioni.map(x => h('th', {}, x)))), h('tbody', {}, csv.righe.slice(0, 5).map(r => h('tr', {}, r.map(x => h('td', {}, x)))))))),
      err,
      h('div', { class: 'azioni' }, btn('Importa', () => {
        const esito = { aggiunti: 0, aggiornati: 0, saltati: 0, errori: [] };
        const persona = personaPredefinita(), t = adesso();
        const impronta = v => [v.persona || persona, v.data, v[def.largo || 'titolo'] || v.parametro || v.descrizione || v.conto || '', v.valore, v.testo || ''].join('|');
        const esistenti = new Map(S.A.voci.filter(v => !v.canc && v.area === idArea && v.tipo === idTipo).map(v => [impronta(v), v]));
        const nuova = (v, nRiga) => {
          const k = impronta(v);
          if (esistenti.has(k)) { esito.saltati++; return; }
          const n = { id: uid(), area: idArea, tipo: idTipo, persona, creato: t, agg: t, ...v };
          S.A.voci.push(n); esistenti.set(k, n); esito.aggiunti++;
        };
        if (usaLargo) {
          const iD = +selData.value, cols = spunta.filter(x => x.checked).map(x => +x.value);
          const lettori = {}; cols.forEach(i => { lettori[i] = lettoreColonna(csv.righe.map(r => r[i])); });
          if (!cols.length) { err.textContent = 'Seleziona almeno una metrica.'; return; }
          csv.righe.forEach((r, n) => {
            const d = leggiData(r[iD]); if (!d) { esito.errori.push(`Riga ${n + 2}: data non riconosciuta ("${r[iD] || ''}").`); return; }
            for (const i of cols) { const val = lettori[i](r[i]); if (val == null) continue; const v = { data: d, [def.largo]: csv.intestazioni[i], valore: val }; if (fonte.value.trim()) v.fonte = fonte.value.trim(); nuova(v, n); }
          });
        } else {
          const mappa = {}; campi.querySelectorAll('select[data-k]').forEach(sl => { if (sl.value !== '') mappa[sl.dataset.k] = +sl.value; });
          const lettori = {}; for (const [k, i] of Object.entries(mappa)) lettori[k] = lettoreColonna(csv.righe.map(r => r[i]));
          const mancanti = def.campi.filter(f => f.obbl && !(f.k in mappa)); if (mancanti.length) { err.textContent = 'Abbina una colonna a: ' + mancanti.map(f => f.etichetta).join(', ') + '.'; return; }
          csv.righe.forEach((r, n) => {
            const v = {}; let ko = '';
            for (const f of def.campi) {
              if (!(f.k in mappa)) continue; const g = (r[mappa[f.k]] || '').trim(); if (!g) { if (f.obbl) ko = `manca "${f.etichetta}"`; continue; }
              if (f.tipo === 'data') { const d = leggiData(g); if (d) v[f.k] = d; else ko = `data non riconosciuta ("${g}")`; }
              else if (f.tipo === 'numero') { const x = lettori[f.k](g); if (x != null) v[f.k] = x; else if (f.obbl) ko = `"${g}" non è un numero`; }
              else if (f.tipo === 'si_no') { if (/^(1|si|sì|true|x|\*)$/i.test(g)) v[f.k] = true; }
              else v[f.k] = g;
            }
            if (ko) esito.errori.push(`Riga ${n + 2}: ${ko}.`); else nuova(v, n);
          });
        }
        annota('Importazione CSV in ' + def.plur, nome, { ...esito, errori: esito.errori.slice(0, 50) });
        salva();
        corpo.replaceChildren(ricevuta(esito));
      }, 'primario')));
  }
  apriModale('Importa CSV in ' + def.plur.toLowerCase(), h('div', {}, h('p', {}, 'Scegli il file. Nel passo successivo indichi quale colonna corrisponde a quale dato; le righe già presenti non vengono duplicate.'), scegli, corpo), true);
}
function ricevuta(esito) {
  const tot = esito.aggiunti + esito.aggiornati;
  return h('div', { class: 'ricevuta' },
    h('p', { class: tot ? 'esito-ok' : 'esito-ko' }, tot ? `Caricati: ${esito.aggiunti} nuovi` + (esito.aggiornati ? `, ${esito.aggiornati} aggiornati.` : '.') : 'Nessun dato nuovo caricato.'),
    esito.saltati ? h('p', {}, `Già presenti e non duplicati: ${esito.saltati}.`) : null,
    esito.errori.length ? h('div', { class: 'errore' }, h('p', {}, `Non caricati: ${esito.errori.length}.`), h('ul', {}, esito.errori.slice(0, 12).map(e => h('li', {}, e))), esito.errori.length > 12 ? h('p', {}, 'L\'elenco completo è nel registro dei caricamenti.') : null) : null,
    h('div', { class: 'azioni' }, btn('Chiudi', chiudiModale, 'primario')));
}

/* --- Guscio dell'applicazione --- */
function leggiRotta() { return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent); }
function spiaSync() {
  const st = S.sync, pronto = S.sbloccato && ghPronto();
  const testo = !pronto ? 'Solo su questo dispositivo' : st.stato === 'in corso' ? 'Sincronizzo…' : st.stato === 'errore' ? 'Non sincronizzato' : S.sporco ? 'Modifiche da inviare' : st.ultimo ? 'Sincronizzato ' + new Date(st.ultimo).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'Sincronizzazione attiva';
  return h('button', { id: 'stato-sync', class: 'btn piatto spia ' + (!pronto ? 'spenta' : st.stato === 'errore' ? 'ko' : 'ok'), title: st.errore || (pronto ? 'Sincronizza adesso' : 'Configura la sincronizzazione'), 'aria-label': testo, onclick: () => (pronto ? sincronizza(true) : (location.hash = '#/impostazioni')) }, h('span', { class: 'spia-testo' }, testo));
}
function menu(rotta) {
  const attiva = r => (rotta.join('/') || 'casa').startsWith(r);
  const v = (href, testo, chiave, n) => h('a', { href, class: attiva(chiave) ? 'attiva' : '', 'aria-current': attiva(chiave) ? 'page' : null }, testo, n ? h('span', { class: 'conta' }, n) : null);
  const scadute = voci('sistema', 'scadenza').filter(x => x.stato !== 'fatta' && x.data <= oggi()).length;
  return h('nav', { class: 'menu', 'aria-label': 'Cartelle' },
    v('#/', 'Quadro generale', 'casa'),
    h('div', { class: 'menu-gruppo' }, 'Cartelle'),
    aree().map(a => v('#/a/' + a.id, a.nome, 'a/' + a.id)),
    h('div', { class: 'menu-gruppo' }, 'Archivio'),
    v('#/rapporti', 'Rapporti', 'rapporti'), v('#/scadenze', 'Scadenze', 'scadenze', scadute), v('#/documenti', 'Documenti', 'documenti', allegati().filter(a => a.stato === 'da elaborare').length), v('#/impostazioni', 'Impostazioni', 'impostazioni'));
}
function barra() {
  const pp = persone();
  return h('header', { class: 'barra' },
    h('a', { class: 'marchio', href: '#/' }, 'Archivio'),
    pp.length > 1 ? h('select', { class: 'chi', 'aria-label': 'Persona', onchange: e => { S.persona = e.target.value; disegna(); } }, h('option', { value: '' }, 'Tutta la famiglia'), pp.map(p => h('option', { value: p.id, selected: p.id === S.persona }, p.nome))) : h('span', { class: 'chi-solo' }, (pp[0] || {}).nome || ''),
    h('span', { class: 'spazio' }), spiaSync(), btn('Blocca', blocca, 'piatto'));
}
function disegna() {
  const app = $('#app');
  if (!S.sbloccato) { if (!$('.blocco')) schermataBlocco().then(el => app.replaceChildren(el)); return; }
  const rotta = leggiRotta();
  const vecchia = $('#vista'), scroll = vecchia && vecchia.dataset.rotta === rotta.join('/') ? window.scrollY : 0;
  const vista = h('main', { id: 'vista', 'data-rotta': rotta.join('/') });
  try { vista.append(vistaPer(rotta)); } catch (e) { console.error(e); vista.append(h('div', { class: 'errore' }, 'Errore nel mostrare questa pagina: ' + e.message)); }
  app.replaceChildren(h('div', { class: 'guscio' }, barra(), menu(rotta), vista));
  window.scrollTo(0, scroll);
}
function vistaPer(r) {
  if (!r.length) return vistaCasa();
  if (r[0] === 'a' && r[1]) {
    const a = area(r[1]); if (!a) return vuoto('Questa cartella non esiste più.');
    if (r[2] === 'p' && r[3]) return vistaProgetto(r[3]);
    if (r[2]) return vistaTipo(r[1], r[2]);
    return vistaArea(a);
  }
  if (r[0] === 'scadenze') return vistaScadenze();
  if (r[0] === 'rapporti') return vistaRapporti(r[1]);
  if (r[0] === 'documenti') return vistaDocumenti();
  if (r[0] === 'impostazioni') return vistaImpostazioni();
  return vuoto('Pagina non trovata.');
}
window.addEventListener('hashchange', () => { chiudiModale(); disegna(); });
