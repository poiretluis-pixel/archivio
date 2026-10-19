/* ===== 10. Schermata di sblocco e avvio ===== */
let _modoBlocco = '';
async function dopoSblocco() {
  _modoBlocco = '';
  S.ultimaAttivita = Date.now();
  disegna();
  if (ghPronto()) sincronizza(false);
}
async function schermataBlocco() {
  const busta = await kvLeggi('busta');
  const modo = _modoBlocco || (busta ? 'apri' : 'benvenuto');
  const vai = m => { _modoBlocco = m; schermataBlocco().then(el => $('#app').replaceChildren(el)); };
  const err = h('div', { class: 'errore', role: 'alert' });
  const attesa = (form, si) => { const b = form.querySelector('button[type=submit]'); b.disabled = si; if (si) { b.dataset.t = b.textContent; b.textContent = 'Un momento…'; } else if (b.dataset.t) b.textContent = b.dataset.t; };
  const campo = (name, etich, extra = {}) => h('label', { class: 'campo intero' }, h('span', {}, etich), h('input', { name, autocomplete: 'off', spellcheck: 'false', ...extra }));
  const cornice = (...kids) => h('div', { class: 'blocco' }, h('div', { class: 'blocco-scheda' }, h('div', { class: 'marchio grande' }, logoLp(), h('span', {}, 'Life Planning')), kids));
  const invio = (form, fn) => async e => { e.preventDefault(); err.textContent = ''; attesa(form, true); try { await fn(form.elements); } catch (ex) { err.textContent = ex.message === 'Failed to fetch' ? 'Impossibile raggiungere GitHub: controlla la connessione.' : ex.message; attesa(form, false); } };
  const campiFrase = () => {
    const forza = h('div', { class: 'forza intero' });
    return [
      campo('frase', 'Frase segreta per aprire la pagina su questo dispositivo', { type: 'password', required: true, autocomplete: 'new-password', oninput: e => { const f = forzaFrase(e.target.value); forza.textContent = f ? f.testo : ''; forza.className = 'forza intero ' + (f ? f.livello : ''); } }), forza,
      campo('ripeti', 'Ripeti la frase segreta', { type: 'password', required: true, autocomplete: 'new-password' }),
      campo('promemoria', 'Promemoria (facoltativo, visibile a chiunque apra la pagina)', { placeholder: 'Una domanda che solo tu sai collegare alla frase' }),
    ];
  };
  const controllaFrase = el => {
    if (el.frase.value !== el.ripeti.value) throw new Error('Le due frasi non coincidono.');
    if (normFrase(el.frase.value).length < 4) throw new Error('La frase segreta deve avere almeno 4 caratteri.');
  };

  if (modo === 'apri') {
    const form = h('form', { class: 'modulo' },
      busta.promemoria ? h('p', { class: 'promemoria intero' }, 'Promemoria: ' + busta.promemoria) : null,
      campo('segreto', 'Frase segreta', { type: 'password', required: true, autocomplete: 'current-password' }), err,
      h('div', { class: 'azioni intero' }, h('button', { class: 'btn primario', type: 'submit' }, 'Sblocca')));
    form.onsubmit = invio(form, async el => { await sblocca(busta, el.segreto.value, 'frase'); await dopoSblocco(); });
    setTimeout(() => { const i = form.elements.segreto; if (i) i.focus(); });
    return cornice(h('p', { class: 'sotto' }, 'Su questo dispositivo i dati sono cifrati. Si aprono solo con la tua frase.'), form,
      h('p', { class: 'collegamenti' }, btn('Ho dimenticato la frase', () => vai('dimenticata'), 'piatto'), btn('Collega un altro archivio', () => vai('collega'), 'piatto')));
  }
  if (modo === 'dimenticata') {
    const nonInviate = !!(await kvLeggi('sporco'));
    return cornice(h('h2', {}, 'Frase dimenticata'),
      h('p', {}, 'La frase protegge solo la copia su questo dispositivo. L\'archivio vero è nel tuo repository dei dati: ricollega il dispositivo con il token di GitHub e scegli una frase nuova.'),
      nonInviate ? h('p', { class: 'errore' }, 'Attenzione: su questo dispositivo ci sono modifiche non ancora inviate al repository. Ricollegandolo andranno perse.') : null,
      h('div', { class: 'azioni' }, btn('Ricollega il dispositivo', () => vai('collega'), 'primario'), btn('Indietro', () => vai('apri'), 'piatto')));
  }
  if (modo === 'benvenuto') {
    return cornice(h('p', { class: 'sotto' }, 'Il tuo archivio personale: salute, finanze, patrimonio, viaggi e progetti. I dati vivono nel tuo repository privato su GitHub; su questo dispositivo restano cifrati con una frase che conosci solo tu.'),
      h('div', { class: 'azioni colonna' }, btn('Collega il mio archivio', () => vai('collega'), 'primario')),
      h('p', { class: 'collegamenti' }, btn('Prova senza repository', () => vai('nuovo'), 'piatto')));
  }
  if (modo === 'nuovo') {
    const form = h('form', { class: 'modulo' }, campo('nome', 'Il tuo nome', { required: true }), campo('nascita', 'Data di nascita (facoltativa)', { type: 'date' }), campiFrase(), err,
      h('div', { class: 'azioni intero' }, h('button', { class: 'btn primario', type: 'submit' }, 'Crea l\'archivio'), btn('Indietro', () => vai(busta ? 'apri' : 'benvenuto'), 'piatto')));
    form.onsubmit = invio(form, async el => {
      controllaFrase(el);
      if (busta && !confirm('Su questo dispositivo c\'è già un archivio: verrà sostituito qui. Continuare?')) { attesa(form, false); return; }
      await creaArchivio(el.frase.value, el.promemoria.value.trim(), el.nome.value.trim(), el.nascita.value);
      await dopoSblocco();
    });
    return cornice(h('h2', {}, 'Archivio solo su questo dispositivo'), h('p', { class: 'sotto' }, 'Utile per provare. Puoi collegare il repository in qualunque momento da Impostazioni: i dati inseriti qui si uniscono a quelli già presenti.'), form);
  }
  /* modo collega: primo avvio, dispositivo nuovo o frase dimenticata */
  const form = h('form', { class: 'modulo' },
    campo('proprietario', 'Utente GitHub', { required: true, autocapitalize: 'none' }), campo('repo', 'Repository privato dei dati', { required: true, value: 'archivio-dati', autocapitalize: 'none' }),
    campo('token', 'Token di accesso', { type: 'password', required: true }), campiFrase(),
    campo('nome', 'Il tuo nome (serve solo se il repository è ancora vuoto)'), err,
    h('div', { class: 'azioni intero' }, h('button', { class: 'btn primario', type: 'submit' }, 'Collega e apri'), btn('Indietro', () => vai(busta ? 'apri' : 'benvenuto'), 'piatto')));
  form.onsubmit = invio(form, async el => {
    controllaFrase(el);
    const g = { proprietario: el.proprietario.value.trim(), repo: el.repo.value.trim(), ramo: '', token: el.token.value.trim() };
    await ghControllaRepo(g);
    const remoto = await ghLeggiArchivio(g);
    if (!remoto && !el.nome.value.trim()) throw new Error('Il repository è vuoto: scrivi il tuo nome per creare l\'archivio.');
    if (busta && !confirm('L\'archivio già presente su questo dispositivo verrà sostituito da quello del repository. Continuare?')) { attesa(form, false); return; }
    if (remoto) { await preparaLocale(el.frase.value, el.promemoria.value.trim()); S.A = remoto.A; }
    else await creaArchivio(el.frase.value, el.promemoria.value.trim(), el.nome.value.trim(), '');
    S.disp.github = g; S.sbloccato = true;
    const p = persone(); S.persona = p.length === 1 ? p[0].id : '';
    ricostruisciEsterni();
    await persisti();
    await dopoSblocco();
  });
  return cornice(h('h2', {}, 'Collega il tuo archivio'),
    h('p', { class: 'sotto' }, 'Servono il tuo utente GitHub, il nome del repository dei dati e un token di accesso. La guida per il token è nel LEGGIMI.'), form);
}

['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { S.ultimaAttivita = Date.now(); }, { passive: true }));
setInterval(() => { if (S.sbloccato && Date.now() - S.ultimaAttivita > (S.A.impostazioni.blocco_min || 15) * 60000) { salvaSubito().finally(blocca); } }, 20000);
window.addEventListener('online', programmaSync);
document.addEventListener('visibilitychange', () => {
  if (!S.sbloccato) return;
  if (document.hidden) salvaSubito().catch(() => {});
  else if (ghPronto()) programmaSync();
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (!window.isSecureContext || !crypto.subtle) document.getElementById('app').textContent = 'Questa pagina va aperta da un indirizzo https (o da localhost): senza, il browser non permette la cifratura.';
else disegna();
