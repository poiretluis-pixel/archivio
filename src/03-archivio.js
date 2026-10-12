/* ===== 3. Archivio: stato in memoria e salvataggio locale cifrato =====
   S.A    : l'archivio vero e proprio, identico ad archivio.json nel repository dei dati.
   S.est  : dati scritti da altri (Garmin, rapporti di Claude), letti dal repository e mai riscritti dalla pagina.
   S.disp : impostazioni di questo dispositivo (token di GitHub). Restano solo qui, cifrate. */
const S = {
  sbloccato: false, chiave: null, chiaveGrezza: null, testata: null, A: null, est: {}, disp: {}, estVoci: [],
  persona: '', sync: { stato: 'spento', ultimo: null, errore: '' }, sporco: false, ultimaAttivita: Date.now(),
};
const SCHEMA = 'archivio-vita/1';

/* IndexedDB: 'kv' per la busta e le note locali del dispositivo, 'blob' per gli allegati cifrati. */
let _db;
function db() {
  return _db || (_db = new Promise((ok, ko) => {
    const r = indexedDB.open('archivio-vita', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('blob'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  }));
}
async function idb(negozio, modo, fn) {
  const d = await db();
  return new Promise((ok, ko) => {
    const tx = d.transaction(negozio, modo); const rq = fn(tx.objectStore(negozio));
    tx.oncomplete = () => ok(rq ? rq.result : undefined); tx.onerror = tx.onabort = () => ko(tx.error);
  });
}
const kvLeggi = k => idb('kv', 'readonly', st => st.get(k));
const kvScrivi = (k, v) => idb('kv', 'readwrite', st => st.put(v, k));
const kvTogli = k => idb('kv', 'readwrite', st => st.delete(k));
const blobLeggi = id => idb('blob', 'readonly', st => st.get(id));
const blobScrivi = (id, bytes) => idb('blob', 'readwrite', st => st.put(bytes, id));
const blobTogli = id => idb('blob', 'readwrite', st => st.delete(id));
const blobChiavi = () => idb('blob', 'readonly', st => st.getAllKeys());

function archivioVuoto() {
  return { schema: SCHEMA, meta: { creato: adesso(), aggiornato: adesso() }, persone: [], voci: [], allegati: [], aree: [], registro: [], impostazioni: { agg: adesso(), blocco_min: 15 } };
}
function completa(a) {
  const v = archivioVuoto();
  for (const k of Object.keys(v)) if (a[k] == null) a[k] = v[k];
  return a;
}

/* --- Creazione, sblocco, blocco --- */
/* Prepara la cifratura locale con una frase nuova. L'archivio (S.A) lo imposta chi chiama. */
async function preparaLocale(frase, promemoria) {
  for (const k of await blobChiavi()) await blobTogli(k);
  await kvTogli('sporco');
  const grezza = casuale(32);
  S.testata = { promemoria, slot: [await creaSlot('frase', frase, grezza)], slot_agg: adesso() };
  S.chiaveGrezza = grezza; S.chiave = await importaChiaveDati(grezza);
  S.est = {}; S.disp = {}; S.estVoci = []; S.sporco = false;
}
async function creaArchivio(frase, promemoria, nomePersona, nascita) {
  await preparaLocale(frase, promemoria);
  S.A = archivioVuoto();
  S.A.persone.push({ id: uid(), nome: nomePersona, nascita: nascita || '', ruolo: 'titolare', creato: adesso(), agg: adesso() });
  S.sbloccato = true;
  await persisti();
}
/* Contenuto della busta locale: dalla versione 2 contiene archivio, dati esterni e impostazioni del dispositivo. */
function apriContenuto(x) {
  if (x && x.formato_locale === 2) return { A: completa(x.A), est: x.est || {}, disp: x.disp || {} };
  const A = completa(x), disp = {};
  if (A.impostazioni.github) { disp.github = A.impostazioni.github; delete A.impostazioni.github; }
  return { A, est: {}, disp };
}
async function apriBusta(busta, segreto, tipo) {
  if (!busta || busta.formato !== 'archivio-vita') throw new Error('Il file non è un archivio valido.');
  for (const slot of busta.slot.filter(x => x.tipo === tipo)) {
    try {
      const grezza = await apriSlot(slot, segreto);
      const chiave = await importaChiaveDati(grezza);
      return { grezza, chiave, ...apriContenuto(await dissigilla(busta, chiave)) };
    } catch (e) { /* segreto sbagliato per questo slot: provo il prossimo */ }
  }
  throw new Error(tipo === 'recupero' ? 'Codice di recupero non valido.' : 'Frase segreta non corretta.');
}
async function sblocca(busta, segreto, tipo) {
  const r = await apriBusta(busta, segreto, tipo);
  S.chiaveGrezza = r.grezza; S.chiave = r.chiave; S.A = r.A; S.est = r.est; S.disp = r.disp;
  ricostruisciEsterni();
  S.testata = { promemoria: busta.promemoria || '', slot: busta.slot, slot_agg: busta.slot_agg };
  S.sbloccato = true; S.ultimaAttivita = Date.now();
  S.sporco = !!(await kvLeggi('sporco'));
  const p = S.A.persone.filter(x => !x.canc);
  S.persona = p.length === 1 ? p[0].id : '';
}
function blocca() {
  if (S.chiaveGrezza) S.chiaveGrezza.fill(0);
  Object.assign(S, { sbloccato: false, chiave: null, chiaveGrezza: null, A: null, est: {}, disp: {}, estVoci: [], persona: '' });
  chiudiModale();
  disegna();
}

/* --- Salvataggio --- */
let _tSalva, _codaSalva = Promise.resolve();
async function persisti() {
  if (!S.sbloccato) return;
  const busta = await sigilla({ formato_locale: 2, A: S.A, est: S.est, disp: S.disp }, S.chiave, S.testata);
  await kvScrivi('busta', busta);
  return busta;
}
function salva(ridisegna = true) {
  S.A.meta.aggiornato = adesso();
  S.sporco = true; kvScrivi('sporco', 1);
  clearTimeout(_tSalva);
  _tSalva = setTimeout(() => { _codaSalva = _codaSalva.then(persisti).then(programmaSync).catch(e => avviso('Salvataggio non riuscito: ' + e.message, 'errore')); }, 250);
  if (ridisegna) disegna();
}
const salvaSubito = () => { clearTimeout(_tSalva); return (_codaSalva = _codaSalva.then(persisti)); };

/* --- Accesso ai dati --- */
const persone = () => S.A.persone.filter(p => !p.canc);
const nomePersona = id => (S.A.persone.find(p => p.id === id) || {}).nome || '';
const personaPredefinita = () => S.persona || (persone()[0] || {}).id || '';
function voci(area, tipo, tutti = false) {
  const filtro = v => !v.canc && v.area === area && (!tipo || v.tipo === tipo) && (tutti || !S.persona || !v.persona || v.persona === S.persona);
  const l = S.A.voci.filter(filtro);
  return area === 'salute' && S.estVoci.length ? l.concat(S.estVoci.filter(filtro)) : l;
}
/* Righe dei file garmin/*.csv trasformate in voci di sola lettura. */
function ricostruisciEsterni() {
  const titolare = (S.A.persone.find(p => !p.canc && p.ruolo === 'titolare') || S.A.persone.find(p => !p.canc) || {}).id || '';
  const out = [];
  for (const righe of Object.values((S.est && S.est.file) || {})) for (const [data, tipo, metrica, valore, unita] of righe) {
    out.push({ id: 'g-' + data + '-' + nomeFile(metrica), area: 'salute', tipo: tipo === 'corpo' ? 'corpo' : 'sensore', persona: titolare, data, metrica, valore, unita, fonte: 'Garmin', auto: true, creato: data });
  }
  S.estVoci = out;
}
const voce = id => S.A.voci.find(v => v.id === id && !v.canc);
function metti(v, ridisegna = true) {
  const t = adesso();
  if (!v.id) v.id = uid();
  if (!v.creato) v.creato = t;
  v.agg = t;
  const i = S.A.voci.findIndex(x => x.id === v.id);
  if (i >= 0) S.A.voci[i] = v; else S.A.voci.push(v);
  salva(ridisegna);
  return v;
}
/* Le cancellazioni lasciano una lapide (canc: true), così la sincronizzazione tra dispositivi non le fa riapparire. */
function togli(lista, id) {
  const i = S.A[lista].findIndex(x => x.id === id);
  if (i < 0) return;
  const x = S.A[lista][i];
  S.A[lista][i] = { id: x.id, area: x.area, tipo: x.tipo, canc: true, agg: adesso() };
  salva();
}
function annota(azione, origine, esito) {
  S.A.registro.push({ id: uid(), quando: adesso(), agg: adesso(), azione, origine, ...esito });
  if (S.A.registro.length > 400) S.A.registro.splice(0, S.A.registro.length - 400);
}
const allegati = () => S.A.allegati.filter(a => !a.canc && (!S.persona || !a.persona || a.persona === S.persona));

async function aggiungiAllegato(file, extra = {}) {
  const bytes = new Uint8Array(await leggiFile(file, 'bytes'));
  return aggiungiAllegatoBytes(bytes, { nome: file.name, mime: file.type || 'application/octet-stream', ...extra });
}
async function aggiungiAllegatoBytes(bytes, meta) {
  const id = meta.id || uid();
  await blobScrivi(id, await cifraBytes(bytes, S.chiave));
  const est = ((meta.nome || '').match(/\.[a-z0-9]{1,6}$/i) || ['.bin'])[0].toLowerCase();
  const a = { area: '', persona: personaPredefinita(), data: oggi(), stato: 'da elaborare', nota: '', rif: '', file: 'documenti/' + id + est, ...meta, id, dim: bytes.length, creato: meta.creato || adesso(), agg: adesso() };
  const i = S.A.allegati.findIndex(x => x.id === id);
  if (i >= 0) S.A.allegati[i] = a; else S.A.allegati.push(a);
  return a;
}
async function contenutoAllegato(a) {
  const c = await blobLeggi(a.id);
  if (c) return decifraBytes(c, S.chiave);
  if (ghPronto() && a.file) {
    const chiaro = await ghScaricaAllegato(a.file);
    if (chiaro) { await blobScrivi(a.id, await cifraBytes(chiaro, S.chiave)); return chiaro; }
  }
  throw new Error(ghPronto() ? 'Documento non trovato nel repository dei dati.' : 'Il contenuto di questo documento non è su questo dispositivo. Collega il repository dei dati per scaricarlo.');
}

/* --- Unione di due archivi: per ogni elemento vince la modifica più recente --- */
const LISTE = ['persone', 'voci', 'allegati', 'aree', 'registro'];
function unisci(locale, remoto) {
  let daRemoto = 0, daLocale = 0;
  const out = { schema: SCHEMA, meta: { creato: locale.meta.creato < remoto.meta.creato ? locale.meta.creato : remoto.meta.creato, aggiornato: adesso() } };
  for (const nome of LISTE) {
    const m = new Map((locale[nome] || []).map(x => [x.id, x]));
    const visti = new Set();
    for (const r of remoto[nome] || []) {
      visti.add(r.id);
      const l = m.get(r.id);
      if (!l || (r.agg || '') > (l.agg || '')) { m.set(r.id, r); daRemoto++; }
      else if ((l.agg || '') > (r.agg || '')) daLocale++;
    }
    for (const id of m.keys()) if (!visti.has(id)) daLocale++;
    out[nome] = [...m.values()];
  }
  const il = locale.impostazioni || {}, ir = remoto.impostazioni || {};
  if ((ir.agg || '') > (il.agg || '')) { out.impostazioni = ir; daRemoto++; } else { out.impostazioni = il; if ((il.agg || '') > (ir.agg || '')) daLocale++; }
  return { unito: out, daRemoto, daLocale };
}

/* --- Forma del file archivio.json: un elemento per riga, ordinati per id, così le modifiche nel repository si leggono riga per riga.
   strumenti/archivio.py nel repository dei dati scrive esattamente nello stesso modo. --- */
function serializza(A) {
  const d = x => JSON.stringify(x);
  const testa = ['{', ` "schema": ${d(A.schema || SCHEMA)},`, ` "meta": ${d(A.meta)},`, ` "impostazioni": ${d(A.impostazioni)},`];
  const liste = LISTE.map(n => {
    const el = [...(A[n] || [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return ` "${n}": [` + (el.length ? '\n' + el.map(x => '  ' + d(x)).join(',\n') + '\n ]' : ']');
  });
  return testa.join('\n') + '\n' + liste.join(',\n') + '\n}\n';
}

/* --- Esportazione in chiaro: il formato aperto da cui ricostruire tutto --- */
async function esportaChiaro(conAllegati) {
  const copia = JSON.parse(JSON.stringify(S.A));
  for (const n of LISTE) copia[n] = copia[n].filter(x => !x.canc);
  copia.esportato = adesso();
  if (conAllegati) for (const a of copia.allegati) {
    try { a.contenuto_base64 = b64(await contenutoAllegato(a)); } catch (e) { a.contenuto_mancante = true; }
  }
  return copia;
}
/* Importazione di un file nel formato aperto. mappaPersone: id nel file -> id nell'archivio ('' = crea). */
async function importaChiaro(dati, mappaPersone, origine) {
  const esito = { aggiunti: 0, aggiornati: 0, saltati: 0, errori: [] };
  const map = {};
  for (const p of dati.persone || []) {
    const dest = mappaPersone[p.id];
    if (dest) { map[p.id] = dest; const q = S.A.persone.find(x => x.id === dest); if (q && !q.nascita && p.nascita) { q.nascita = p.nascita; q.agg = adesso(); } }
    else { const n = { ...p, id: S.A.persone.some(x => x.id === p.id) ? uid() : p.id, creato: p.creato || adesso(), agg: adesso() }; S.A.persone.push(n); map[p.id] = n.id; esito.aggiunti++; }
  }
  const rimappa = x => (x.persona && map[x.persona] ? { ...x, persona: map[x.persona] } : x);
  const fondi = (lista, x) => {
    if (!x || !x.id) { esito.errori.push('Elemento senza identificativo ignorato.'); return false; }
    const i = S.A[lista].findIndex(y => y.id === x.id);
    if (i < 0) { S.A[lista].push({ creato: adesso(), ...x, agg: x.agg || adesso() }); esito.aggiunti++; return true; }
    if ((x.agg || '') > (S.A[lista][i].agg || '')) { S.A[lista][i] = x; esito.aggiornati++; return true; }
    esito.saltati++; return false;
  };
  for (const v of dati.voci || []) {
    if (!v.area || !v.tipo) { esito.errori.push(`Voce ${v.id || '?'} senza area o tipo: ignorata.`); continue; }
    fondi('voci', rimappa(v));
  }
  for (const a of dati.aree || []) fondi('aree', a);
  for (const a0 of dati.allegati || []) {
    const { contenuto_base64, contenuto_mancante, ...a } = rimappa(a0);
    const presente = S.A.allegati.find(y => y.id === a.id && !y.canc);
    if (contenuto_base64) {
      if (presente && (await blobLeggi(a.id))) { esito.saltati++; continue; }
      try { await aggiungiAllegatoBytes(daB64(contenuto_base64), a); esito.aggiunti++; }
      catch (e) { esito.errori.push(`Documento "${a.nome}" non caricato: ${e.message}`); }
    } else if (!presente && a.file) { S.A.allegati.push({ creato: adesso(), ...a, agg: a.agg || adesso() }); esito.aggiunti++; }
    else if (!presente) esito.errori.push(`Documento "${a.nome}" presente nell'elenco ma senza contenuto: non caricato.`);
    else esito.saltati++;
  }
  annota('Importazione file dati', origine, esito);
  salva();
  return esito;
}
