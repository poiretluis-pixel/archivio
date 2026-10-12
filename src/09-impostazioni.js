/* ===== 9. Impostazioni: persone, cartelle, repository dei dati, Garmin, sicurezza ===== */
function toccaImpostazioni() { S.A.impostazioni.agg = adesso(); }
function modificaPersona(p) {
  const nuova = !p; p = p || { nome: '', nascita: '', ruolo: 'familiare' };
  const form = h('form', { class: 'modulo', onsubmit: e => {
    e.preventDefault(); const el = form.elements; if (!el.nome.value.trim()) return;
    Object.assign(p, { nome: el.nome.value.trim(), nascita: el.nascita.value, ruolo: el.ruolo.value, agg: adesso() });
    if (nuova) { p.id = uid(); p.creato = adesso(); S.A.persone.push(p); }
    salva(); chiudiModale();
  } },
    h('label', { class: 'campo' }, h('span', {}, 'Nome *'), h('input', { name: 'nome', value: p.nome, required: true })),
    h('label', { class: 'campo' }, h('span', {}, 'Data di nascita'), h('input', { name: 'nascita', type: 'date', value: p.nascita || '' })),
    h('label', { class: 'campo' }, h('span', {}, 'Ruolo'), h('select', { name: 'ruolo' }, ['titolare', 'coniuge', 'figlio o figlia', 'familiare'].map(r => h('option', { value: r, selected: r === p.ruolo }, r)))),
    h('div', { class: 'azioni intero' }, h('button', { class: 'btn primario', type: 'submit' }, 'Salva'),
      !nuova && persone().length > 1 ? btn('Rimuovi', () => { const n = S.A.voci.filter(v => !v.canc && v.persona === p.id).length; if (confirm(n ? `${p.nome} ha ${n} voci in archivio: restano salvate ma senza persona visibile. Rimuovere?` : `Rimuovere ${p.nome}?`)) { if (S.persona === p.id) S.persona = ''; togli('persone', p.id); chiudiModale(); } }, 'pericolo') : null));
  apriModale(nuova ? 'Nuova persona' : 'Persona', form);
}
function apriImportaDati(file, dati) {
  const pp = persone();
  const nelFile = dati.persone || [];
  const somiglia = (a, b) => { const x = a.toLowerCase().split(/\s+/), y = b.toLowerCase().split(/\s+/); return x.some(t => y.includes(t)); };
  const sel = nelFile.map(p => h('select', { 'data-id': p.id }, pp.map(q => h('option', { value: q.id, selected: q.id === p.id || somiglia(q.nome, p.nome) }, 'È ' + q.nome)), h('option', { value: '', selected: !pp.some(q => q.id === p.id || somiglia(q.nome, p.nome)) }, 'Nuova persona')));
  const corpo = h('div', {},
    h('p', {}, `File "${file.name}": ${(dati.voci || []).length} voci, ${(dati.allegati || []).length} documenti.`),
    nelFile.length ? h('div', { class: 'modulo' }, nelFile.map((p, i) => h('label', { class: 'campo' }, h('span', {}, `A chi appartengono i dati di "${p.nome}"?`), sel[i]))) : null,
    h('p', { class: 'attenuato piccolo' }, 'I dati si aggiungono a quelli presenti. Se una voce esiste già, resta la versione più recente.'),
    h('div', { class: 'azioni' }, btn('Importa', async () => {
      const mappa = {}; sel.forEach(x => { mappa[x.dataset.id] = x.value; });
      corpo.replaceChildren(h('p', {}, 'Importo e cifro i dati…'));
      try { corpo.replaceChildren(ricevuta(await importaChiaro(dati, mappa, file.name))); } catch (e) { corpo.replaceChildren(h('p', { class: 'errore' }, 'Importazione interrotta: ' + e.message)); }
    }, 'primario')));
  apriModale('Importa file dati', corpo);
}
async function scegliImportaDati(file) {
  let dati;
  try { dati = JSON.parse(await leggiFile(file)); } catch (e) { avviso(`"${file.name}" non è un file JSON leggibile: niente è stato importato.`, 'errore'); return; }
  if (dati.formato === 'archivio-vita-copia' || dati.formato === 'archivio-vita') { avviso('Questa è una copia cifrata della versione precedente della pagina: per aprirla usa decifra.py, poi importa il file in chiaro che produce.', 'errore'); return; }
  if (!dati.schema || !String(dati.schema).startsWith('archivio-vita/')) { avviso(`"${file.name}" non è nel formato dell'archivio (manca il campo schema): niente è stato importato.`, 'errore'); return; }
  apriImportaDati(file, dati);
}

function collegaRepository(g) { S.disp.github = g; return salvaSubito(); }
const linkGh = (g, percorso, testo) => h('a', { href: `https://github.com/${encodeURIComponent(g.proprietario)}/${encodeURIComponent(g.repo)}/${percorso}`, target: '_blank', rel: 'noopener' }, testo);
function pannelloGarmin() {
  const g = gh();
  if (!g) return pannello('Scaricamento automatico Garmin', h('p', { class: 'attenuato' }, 'Si attiva dopo aver collegato il repository dei dati.'));
  const st = S.est.stato, sg = statoGarmin();
  return pannello('Scaricamento automatico Garmin',
    sg ? h('p', {}, stato(sg.tipo, sg.testo)) : null, sg && sg.nota ? h('p', { class: 'attenuato piccolo' }, sg.nota) : null,
    st && st.ultimo_avvio ? h('p', { class: 'attenuato piccolo' }, `Ultimo tentativo: ${fmtQuando(st.ultimo_avvio)}` + (st.metriche && st.metriche.length ? `. Metriche ricevute: ${st.metriche.join(', ')}.` : '')) : null,
    h('details', { open: !st || st.esito === 'non configurato' }, h('summary', {}, 'Come si attiva (una volta sola)'), h('ol', { class: 'largo-testo' },
      h('li', {}, 'Apri ', linkGh(g, 'settings/secrets/actions', 'i secrets del repository dei dati'), '.'),
      h('li', {}, 'Premi "New repository secret": nome GARMIN_EMAIL, valore l\'email con cui entri in Garmin Connect.'),
      h('li', {}, 'Ripeti con nome GARMIN_PASSWORD e la password di Garmin Connect.'),
      h('li', {}, 'Apri ', linkGh(g, 'actions/workflows/garmin.yml', 'l\'automazione Garmin'), ', premi "Run workflow" e conferma: il primo scaricamento recupera gli ultimi 30 giorni.')),
      h('p', { class: 'attenuato piccolo' }, 'Le credenziali restano nella cassaforte di GitHub: non le vede la pagina, non le vede Claude e non compaiono nel repository. Da lì in poi lo scaricamento parte da solo ogni notte.')),
    h('p', { class: 'piccolo' }, linkGh(g, 'actions', 'Vedi le esecuzioni su GitHub')));
}
function vistaImpostazioni() {
  const g = gh() || {}, pp = persone();
  const el = (name, etich, val, extra = {}) => h('label', { class: 'campo' }, h('span', {}, etich), h('input', { name, value: val || '', autocomplete: 'off', spellcheck: 'false', ...extra }));
  const formGh = h('form', { class: 'modulo', onsubmit: async e => {
    e.preventDefault(); const f = formGh.elements;
    const nuovo = { proprietario: f.proprietario.value.trim(), repo: f.repo.value.trim(), ramo: f.ramo.value.trim(), token: f.token.value.trim() };
    if (!nuovo.proprietario || !nuovo.repo || !nuovo.token) { avviso('Servono utente, repository e token.', 'errore'); return; }
    await collegaRepository(nuovo);
    await sincronizza(true); disegna();
  } },
    el('proprietario', 'Utente GitHub', g.proprietario), el('repo', 'Repository privato dei dati', g.repo, { placeholder: 'es. archivio-dati' }),
    el('token', 'Token di accesso', g.token, { type: 'password' }), el('ramo', 'Ramo (lascia vuoto)', g.ramo),
    h('div', { class: 'azioni intero' }, h('button', { class: 'btn primario', type: 'submit' }, ghPronto() ? 'Salva e sincronizza' : 'Collega e sincronizza'),
      ghPronto() ? btn('Scollega', async () => { if (confirm('Scollegare questo dispositivo? I dati restano nel repository e qui, ma smettono di sincronizzarsi.')) { S.disp.github = null; await salvaSubito(); disegna(); } }) : null));
  const inclDoc = h('input', { type: 'checkbox', checked: true });
  const formFrase = h('form', { class: 'modulo', onsubmit: async e => {
    e.preventDefault(); const f = formFrase.elements;
    if (f.nuova.value !== f.ripeti.value) { avviso('Le due frasi non coincidono.', 'errore'); return; }
    if (normFrase(f.nuova.value).length < 4) { avviso('Frase troppo corta.', 'errore'); return; }
    S.testata.slot = [await creaSlot('frase', f.nuova.value, S.chiaveGrezza)];
    S.testata.promemoria = f.promemoria.value.trim(); S.testata.slot_agg = adesso();
    await salvaSubito(); formFrase.reset(); avviso('Frase segreta cambiata su questo dispositivo.');
  } },
    el('nuova', 'Nuova frase segreta', '', { type: 'password', required: true, autocomplete: 'new-password' }), el('ripeti', 'Ripeti la frase', '', { type: 'password', required: true, autocomplete: 'new-password' }),
    h('label', { class: 'campo intero' }, h('span', {}, 'Promemoria mostrato allo sblocco (visibile a chiunque apra la pagina)'), h('input', { name: 'promemoria', value: S.testata.promemoria || '' })),
    h('div', { class: 'azioni intero' }, h('button', { class: 'btn', type: 'submit' }, 'Cambia frase segreta')));
  const nomeArea = h('input', { placeholder: 'es. Formazione, Casa, Auto', 'aria-label': 'Nome della nuova cartella' });
  const stSync = !ghPronto() ? stato('ritardo', 'Non collegato: i dati sono solo su questo dispositivo') : S.sync.stato === 'errore' ? stato('ritardo', S.sync.errore) : stato('ok', S.sync.ultimo ? 'Ultima sincronizzazione ' + fmtQuando(S.sync.ultimo) : 'Collegato');
  return h('div', {},
    h('div', { class: 'testa' }, h('h1', {}, 'Impostazioni')),
    pannello('Persone', h('ul', { class: 'elenco' }, pp.map(p => h('li', { class: 'tra' }, h('span', {}, h('strong', {}, p.nome), h('span', { class: 'attenuato' }, ` ${p.ruolo || ''}` + (p.nascita ? `, ${fmtData(p.nascita)}` : ''))), btn('Modifica', () => modificaPersona(p), 'piccolo')))),
      h('div', { class: 'azioni' }, btn('Aggiungi una persona', () => modificaPersona(null))), h('p', { class: 'attenuato piccolo' }, 'Ogni voce appartiene a una persona. Con più persone compare in alto il selettore per vedere una sola persona o tutta la famiglia.')),
    pannello('Cartelle personalizzate', S.A.aree.filter(a => !a.canc).length ? h('ul', { class: 'elenco' }, S.A.aree.filter(a => !a.canc).map(a => h('li', { class: 'tra' }, h('strong', {}, a.nome), btn('Elimina', () => { const n = voci(a.id, null, true).length; if (confirm(n ? `La cartella contiene ${n} voci, che non saranno più visibili. Eliminare?` : 'Eliminare la cartella?')) togli('aree', a.id); }, 'piccolo')))) : null,
      h('div', { class: 'azioni' }, nomeArea, btn('Crea cartella', () => { const n = nomeArea.value.trim(); if (!n) return; S.A.aree.push({ id: 'x-' + uid().slice(0, 8), nome: n, creato: adesso(), agg: adesso() }); salva(); })),
      h('p', { class: 'attenuato piccolo' }, 'Le cartelle già previste (finanze, patrimonio, organizzazione, salute, sport, mindfulness, lettura, viaggi, progetti) hanno cruscotti dedicati. Una cartella personalizzata raccoglie voci libere con data, categoria e valore.')),
    pannello('Repository dei dati', h('p', {}, stSync), formGh,
      h('details', {}, h('summary', {}, 'Come si crea il token'), h('ol', { class: 'largo-testo' },
        h('li', {}, 'Su GitHub: foto del profilo, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.'),
        h('li', {}, 'Repository access: "Only select repositories" e scegli il repository dei dati.'),
        h('li', {}, 'Permissions: Repository permissions, Contents, "Read and write". Scadenza: la più lunga disponibile.'),
        h('li', {}, 'Copia il token e incollalo qui. Quando scade, la pagina lo segnala: se ne crea uno nuovo e lo si incolla di nuovo.')),
        h('p', { class: 'attenuato piccolo' }, 'Il token resta solo su questo dispositivo, cifrato con la tua frase.'))),
    pannelloGarmin(),
    pannello('Esportazione',
      h('div', { class: 'azioni' }, btn('Esporta tutto (.json)', async () => scarica(`archivio-${oggi()}.json`, JSON.stringify(await esportaChiaro(inclDoc.checked), null, 1), 'application/json')), h('label', { class: 'spunta' }, inclDoc, 'includi i documenti')),
      h('p', { class: 'attenuato piccolo' }, 'Formato aperto e leggibile, descritto nel LEGGIMI: serve per spostare i dati in qualunque sistema futuro. Il file non è protetto: conservalo con cura.'),
      h('div', { class: 'azioni' }, btn('Importa un file dati (.json)', () => scegliFile('.json,application/json', scegliImportaDati))),
      h('p', { class: 'attenuato piccolo' }, 'Per caricare dati preparati altrove nello stesso formato. Al termine vedi quante voci sono entrate e quali no.')),
    pannello('Sicurezza di questo dispositivo', formFrase,
      h('label', { class: 'campo stretto' }, h('span', {}, 'Blocco automatico dopo minuti di inattività'), h('input', { type: 'number', min: 1, max: 240, value: S.A.impostazioni.blocco_min || 15, onchange: e => { S.A.impostazioni.blocco_min = Math.max(1, +e.target.value || 15); toccaImpostazioni(); salva(false); } }))),
    pannello('Questo dispositivo', h('p', { class: 'attenuato piccolo' }, 'Rimuove l\'archivio solo da questo browser. Il repository dei dati non viene toccato.'),
      h('div', { class: 'azioni' }, btn('Rimuovi l\'archivio da questo dispositivo', async () => { if (!confirm(ghPronto() && !S.sporco ? 'Rimuovere l\'archivio da questo dispositivo?' : 'ATTENZIONE: ci sono dati che esistono solo qui e andranno persi. Rimuovere comunque?')) return; await kvTogli('busta'); await kvTogli('sporco'); for (const k of await blobChiavi()) await blobTogli(k); blocca(); }, 'pericolo'))));
}
