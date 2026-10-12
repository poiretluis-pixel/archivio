/* ===== 4. Sincronizzazione con il repository privato dei dati =====
   Nel repository i file sono leggibili, così Claude e le automazioni possono lavorarci:
     archivio.json        l'archivio (scritto dalla pagina e da Claude)
     documenti/           gli originali dei documenti
     garmin/*.csv         dati del dispositivo, scritti ogni notte dall'automazione (sola lettura per la pagina)
     garmin/stato.json    esito dell'ultimo scaricamento
     rapporti/*.md        rapporti periodici scritti da Claude (sola lettura per la pagina)
   Sul dispositivo tutto resta cifrato con la frase segreta, token compreso. */
const GH = 'https://api.github.com';
const FILE_ARCHIVIO = 'archivio.json';
const gh = () => (S.disp && S.disp.github) || null;
const ghPronto = () => { const g = gh(); return !!(g && g.proprietario && g.repo && g.token); };

function ghUrl(g, percorso, conRef) {
  const p = percorso.split('/').map(encodeURIComponent).join('/');
  return `${GH}/repos/${encodeURIComponent(g.proprietario)}/${encodeURIComponent(g.repo)}/contents/${p}` + (conRef && g.ramo ? '?ref=' + encodeURIComponent(g.ramo) : '');
}
async function ghChiama(g, metodo, percorso, corpo, grezzo) {
  const r = await fetch(ghUrl(g, percorso, metodo === 'GET'), {
    method: metodo, cache: 'no-store',
    headers: { Authorization: 'Bearer ' + g.token, Accept: grezzo ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 404 && metodo === 'GET') return null;
  if (r.status === 401) throw new Error('GitHub rifiuta il token: è scaduto o errato. Creane uno nuovo e incollalo in Impostazioni.');
  if (r.status === 403) throw new Error('GitHub nega l\'accesso: il token non ha il permesso "Contents: read and write" su questo repository.');
  if (r.status === 404) throw new Error('Repository non trovato: controlla nome e permessi del token.');
  if (r.status === 409 || r.status === 422) { const e = new Error('conflitto'); e.conflitto = true; throw e; }
  if (!r.ok) throw new Error('GitHub ha risposto con errore ' + r.status + '.');
  return grezzo ? new Uint8Array(await r.arrayBuffer()) : r.json();
}
/* Distingue "repository inesistente o token senza accesso" da "repository vuoto". */
async function ghControllaRepo(g) {
  const r = await fetch(`${GH}/repos/${encodeURIComponent(g.proprietario)}/${encodeURIComponent(g.repo)}`, { cache: 'no-store', headers: { Authorization: 'Bearer ' + g.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (r.status === 401) throw new Error('GitHub rifiuta il token: è scaduto o errato.');
  if (r.status === 404 || r.status === 403) throw new Error(`Il repository "${g.proprietario}/${g.repo}" non esiste oppure il token non ha accesso: controlla utente, nome del repository e permessi del token.`);
  if (!r.ok) throw new Error('GitHub ha risposto con errore ' + r.status + '.');
}
async function ghLeggiTesto(g, percorso) {
  const b = await ghChiama(g, 'GET', percorso, null, true);
  return b ? decod.decode(b) : null;
}
async function ghLeggiArchivio(g) {
  const j = await ghChiama(g, 'GET', FILE_ARCHIVIO);
  if (!j) return null;
  const testo = j.content ? decod.decode(daB64(j.content)) : await ghLeggiTesto(g, FILE_ARCHIVIO);
  let A;
  try { A = JSON.parse(testo); } catch (e) { throw new Error('archivio.json nel repository non è un JSON valido: non lo tocco. Va corretto a mano o da Claude.'); }
  if (!A || !String(A.schema || '').startsWith('archivio-vita/')) throw new Error('archivio.json nel repository non è nel formato dell\'archivio: non lo tocco.');
  return { sha: j.sha, A: completa(A) };
}
function ghScrivi(g, percorso, bytes, sha, messaggio) {
  const corpo = { message: messaggio, content: b64(bytes) };
  if (sha) corpo.sha = sha;
  if (g.ramo) corpo.branch = g.ramo;
  return ghChiama(g, 'PUT', percorso, corpo);
}
async function ghScaricaAllegato(percorso) {
  try { return await ghChiama(gh(), 'GET', percorso, null, true); } catch (e) { return null; }
}
const elencoCartella = async (g, c) => ((await ghChiama(g, 'GET', c)) || []).filter(x => x.type === 'file');

let _tSync, _inSync = false;
function programmaSync() {
  if (!S.sbloccato || !ghPronto()) return;
  clearTimeout(_tSync);
  _tSync = setTimeout(() => sincronizza(false), 4000);
}
function statoSync(stato, errore = '') {
  S.sync.stato = stato; S.sync.errore = errore;
  if (stato === 'ok') S.sync.ultimo = adesso();
  const el = $('#stato-sync'); if (el) el.replaceWith(spiaSync());
}
async function sincronizza(manuale) {
  if (!ghPronto()) { if (manuale) avviso('Repository dei dati non collegato: vai in Impostazioni.', 'errore'); return; }
  if (_inSync) return;
  if (!navigator.onLine) { statoSync('errore', 'Sei offline: le modifiche restano su questo dispositivo e partiranno alla prossima connessione.'); return; }
  _inSync = true; statoSync('in corso');
  const g = gh();
  try {
    await salvaSubito();
    let fatto = false, cambiato = false;
    for (let giro = 0; giro < 4 && !fatto; giro++) {
      const remoto = await ghLeggiArchivio(g);
      if (!remoto) { await ghScrivi(g, FILE_ARCHIVIO, cod.encode(serializza(S.A)), null, 'Primo salvataggio dalla pagina'); fatto = true; break; }
      const u = unisci(S.A, remoto.A);
      if (u.daRemoto > 0) { S.A = u.unito; cambiato = true; }
      if (u.daLocale > 0) {
        try { await ghScrivi(g, FILE_ARCHIVIO, cod.encode(serializza(u.unito)), remoto.sha, 'Modifica dalla pagina'); S.A = u.unito; fatto = true; }
        catch (e) { if (!e.conflitto) throw e; /* qualcun altro ha scritto nel frattempo: rileggo e riunisco */ }
      } else fatto = true;
    }
    if (!fatto) throw new Error('Troppi tentativi in conflitto con un\'altra modifica: riprova tra poco.');
    const esitoDoc = await sincronizzaAllegati(g);
    if (await leggiEsterni(g)) cambiato = true;
    await persisti();
    S.sporco = false; await kvTogli('sporco');
    statoSync('ok');
    if (cambiato) disegna();
    if (manuale) avviso('Sincronizzato.' + (esitoDoc.caricati ? ` Documenti inviati: ${esitoDoc.caricati}.` : ''), 'ok');
  } catch (e) {
    statoSync('errore', e.message === 'Failed to fetch' ? 'Impossibile raggiungere GitHub: controlla la connessione.' : e.conflitto ? 'GitHub ha rifiutato la scrittura per un conflitto: riprova tra poco.' : e.message);
    if (manuale) avviso(S.sync.errore, 'errore');
  } finally { _inSync = false; }
}
async function sincronizzaAllegati(g) {
  const esito = { caricati: 0, rimossi: 0 };
  const remoti = new Map((await elencoCartella(g, 'documenti')).map(x => ['documenti/' + x.name, x.sha]));
  const locali = new Set(await blobChiavi());
  for (const a of S.A.allegati) {
    const file = a.file;
    if (a.canc) {
      if (locali.has(a.id)) await blobTogli(a.id);
      const f = file || [...remoti.keys()].find(k => k.startsWith('documenti/' + a.id + '.'));
      if (f && remoti.has(f)) { const c = { message: 'Rimozione documento', sha: remoti.get(f) }; if (g.ramo) c.branch = g.ramo; await ghChiama(g, 'DELETE', f, c); remoti.delete(f); esito.rimossi++; }
    } else if (file && locali.has(a.id) && !remoti.has(file)) {
      await ghScrivi(g, file, await decifraBytes(await blobLeggi(a.id), S.chiave), null, 'Nuovo documento: ' + (a.nome || a.id));
      esito.caricati++;
    }
  }
  return esito;
}
/* Garmin e rapporti: si riscaricano solo i file cambiati (GitHub dà un'impronta per ogni file). */
function leggiCsvGarmin(testo) {
  const { intestazioni, righe } = leggiCsv(testo);
  const i = n => intestazioni.indexOf(n);
  const [id, it, im, iv, iu] = ['data', 'tipo', 'metrica', 'valore', 'unita'].map(i);
  return righe.map(r => [r[id], it >= 0 ? r[it] : 'sensore', r[im], Number(r[iv]), iu >= 0 ? r[iu] : '']).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && r[2] && isFinite(r[3]));
}
async function leggiEsterni(g) {
  const E = S.est; let cambiato = false;
  E.file = E.file || {}; E.sha = E.sha || {}; E.rapporti = E.rapporti || {};
  const garmin = await elencoCartella(g, 'garmin');
  const visti = new Set();
  for (const f of garmin.filter(x => /\.csv$/i.test(x.name))) {
    visti.add(f.name);
    if (E.sha[f.name] === f.sha && E.file[f.name]) continue;
    E.file[f.name] = leggiCsvGarmin(await ghLeggiTesto(g, 'garmin/' + f.name)); E.sha[f.name] = f.sha; cambiato = true;
  }
  for (const n of Object.keys(E.file)) if (!visti.has(n)) { delete E.file[n]; delete E.sha[n]; cambiato = true; }
  const st = garmin.find(x => x.name === 'stato.json');
  if (st && st.sha !== E.statoSha) {
    try { E.stato = JSON.parse(await ghLeggiTesto(g, 'garmin/stato.json')); } catch (e) { E.stato = { esito: 'errore', messaggio: 'garmin/stato.json non leggibile' }; }
    E.statoSha = st.sha; cambiato = true;
  }
  const rap = (await elencoCartella(g, 'rapporti')).filter(x => /\.md$/i.test(x.name));
  const nomi = new Set(rap.map(x => x.name));
  for (const f of rap) {
    const r = E.rapporti[f.name];
    if (r && r.sha === f.sha) continue;
    E.rapporti[f.name] = { sha: f.sha, testo: await ghLeggiTesto(g, 'rapporti/' + f.name) }; cambiato = true;
  }
  for (const n of Object.keys(E.rapporti)) if (!nomi.has(n)) { delete E.rapporti[n]; cambiato = true; }
  if (cambiato) ricostruisciEsterni();
  return cambiato;
}
