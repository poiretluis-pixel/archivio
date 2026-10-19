/* ===== 8g. Calendario Google TASK direttamente dalla pagina =====
   Con "Aggiungi al calendario" la pagina crea subito l'evento nel calendario TASK, senza aspettare Claude.
   Servono, in Impostazioni: l'ID client OAuth di Google (impostazioni.google_client_id) e l'ID del calendario TASK (impostazioni.calendario_task).
   L'accesso a Google si chiede in una finestra a parte (google.html) e vale circa un'ora, solo in memoria (nel passaggio dalla finestra resta in localStorage per pochi secondi).
   Senza ID client tutto funziona come prima: l'evento lo crea Claude al prossimo aggiornamento.
   Uniche chiamate di rete fuori da GitHub: accounts.google.com (accesso) e www.googleapis.com/calendar (eventi del calendario TASK). */
const GCAL = { token: '', scade: 0, inCorso: null, risposta: null };
const GCAL_API = 'https://www.googleapis.com/calendar/v3/calendars/';
const gcalPronto = () => !!(S.A.impostazioni.google_client_id && S.A.impostazioni.calendario_task);
const gcalTokenValido = () => !!GCAL.token && Date.now() < GCAL.scade - 60000;

/* Il ritorno da Google (google.html) arriva per tre strade, perché a seconda del browser la finestra di accesso perde il legame con questa pagina:
   messaggio alla finestra che l'ha aperta, BroadcastChannel e, per pochi secondi, localStorage. Vale solo se lo "state" è quello atteso. */
const GCAL_CHIAVE = 'accesso-google';
function gcalRicevi(d) {
  let atteso = '';
  try { atteso = localStorage.getItem(GCAL_CHIAVE + '-atteso') || ''; } catch (e) {}
  if (!d || d.tipo !== GCAL_CHIAVE || !d.state || d.state !== atteso) return;
  try { localStorage.removeItem(GCAL_CHIAVE); localStorage.removeItem(GCAL_CHIAVE + '-atteso'); } catch (e) {}
  if (d.access_token) { GCAL.token = d.access_token; GCAL.scade = Date.now() + (+d.expires_in || 3600) * 1000; }
  const r = GCAL.risposta; GCAL.risposta = null; GCAL.inCorso = null;
  if (r) d.access_token ? r.ok(GCAL.token) : r.no(new Error('Accesso a Google non riuscito' + (d.error ? ': ' + d.error : '.')));
}
function gcalControllaDeposito() { try { const v = localStorage.getItem(GCAL_CHIAVE); if (v) gcalRicevi(JSON.parse(v)); } catch (e) {} }
window.addEventListener('message', e => { if (e.origin === location.origin) gcalRicevi(e.data); });
window.addEventListener('storage', e => { if (e.key === GCAL_CHIAVE) gcalControllaDeposito(); });
window.addEventListener('focus', gcalControllaDeposito);
try { new BroadcastChannel(GCAL_CHIAVE).onmessage = e => gcalRicevi(e.data); } catch (e) {}

/* Va chiamata dentro il clic (il browser apre la finestra solo così). Restituisce il token. */
function gcalAccedi() {
  if (gcalTokenValido()) return Promise.resolve(GCAL.token);
  if (GCAL.inCorso) return GCAL.inCorso;
  const stato = uid();
  try { localStorage.setItem(GCAL_CHIAVE + '-atteso', stato); localStorage.removeItem(GCAL_CHIAVE); } catch (e) {}
  const ritorno = new URL('google.html', location.href.split('#')[0]).href;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: S.A.impostazioni.google_client_id, redirect_uri: ritorno, response_type: 'token',
    scope: 'https://www.googleapis.com/auth/calendar.events', include_granted_scopes: 'true', state: stato,
  });
  const fin = window.open(url, GCAL_CHIAVE, 'width=500,height=650');
  if (!fin) return Promise.reject(new Error('Il browser ha bloccato la finestra di accesso a Google: consenti le finestre per questa pagina.'));
  GCAL.inCorso = new Promise((ok, no) => {
    GCAL.risposta = { ok, no };
    setTimeout(() => { if (GCAL.risposta && GCAL.risposta.ok === ok) { GCAL.risposta = null; GCAL.inCorso = null; no(new Error('Accesso a Google non completato.')); } }, 5 * 60000);
  });
  return GCAL.inCorso;
}

async function gcal(metodo, percorso, corpo) {
  const r = await fetch(GCAL_API + encodeURIComponent(S.A.impostazioni.calendario_task) + percorso, {
    method: metodo, headers: { Authorization: 'Bearer ' + GCAL.token, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 401) { GCAL.token = ''; throw new Error('Accesso a Google scaduto: premi di nuovo il pulsante.'); }
  if (metodo === 'DELETE' && (r.status === 404 || r.status === 410)) return null;
  if (!r.ok) throw new Error('Google Calendar ha risposto ' + r.status + '.');
  return r.status === 204 ? null : r.json();
}

/* Titolo e descrizione come nelle regole del calendario TASK (CLAUDE.md del repository dei dati). */
function siglaTask(x) {
  const c = x.casella || '';
  if (ETICHETTE_PERSONALI.includes(c)) return c;
  if (c.startsWith('3MEDical')) return '3MED';
  return { 'Psiche e Soma': 'PES', 'Personal trainer': 'PT', Personale: 'LUIS' }[c] || x.ambito || 'LUIS';
}
const titoloEvento = x => `(${siglaTask(x)}) ${x.titolo}`;
const descrizioneEvento = x => 'Task del gestionale: https://poiretluis-pixel.github.io/archivio/#/' + (taskPersonale(x) ? 'a/organizzazione' : 'task') + (x.nota ? '\n\n' + x.nota : '');
function corpoEvento(x) {
  return { summary: titoloEvento(x), description: descrizioneEvento(x), start: { date: x.data }, end: { date: piuGiorni(x.data, 1) }, transparency: 'transparent', reminders: { useDefault: true } };
}
const senzaEvento = x => { const { evento_id, evento_data, evento_titolo, ...resto } = x; return resto; };

/* Porta il calendario TASK in pari con i task: crea, sposta o toglie gli eventi. Gli eventi di task cancellati li toglie Claude. */
async function gcalSincronizza() {
  let fatti = 0;
  for (const x0 of S.A.voci.filter(v => !v.canc && v.area === 'organizzazione' && v.tipo === 'attivita')) {
    const x = voce(x0.id) || x0;
    const deve = x.calendario && x.data && x.stato !== 'fatta';
    if (deve && !x.evento_id) {
      const e = await gcal('POST', '/events?sendUpdates=none', corpoEvento(x));
      metti({ ...(voce(x.id) || x), evento_id: e.id, evento_data: x.data, evento_titolo: titoloEvento(x) }, false); fatti++;
    } else if (deve && (x.evento_data !== x.data || x.evento_titolo !== titoloEvento(x))) {
      await gcal('PATCH', '/events/' + encodeURIComponent(x.evento_id) + '?sendUpdates=none', corpoEvento(x));
      metti({ ...(voce(x.id) || x), evento_data: x.data, evento_titolo: titoloEvento(x) }, false); fatti++;
    } else if (!deve && x.evento_id) {
      await gcal('DELETE', '/events/' + encodeURIComponent(x.evento_id) + '?sendUpdates=none');
      metti(senzaEvento(voce(x.id) || x), false); fatti++;
    }
  }
  if (fatti) disegna();
  return fatti;
}

/* Dal clic su "Aggiungi al calendario" o "Togli dal calendario". */
function gcalDopoClic(testo) {
  if (!gcalPronto()) { avviso(testo + ' al prossimo aggiornamento.'); return; }
  gcalAccedi().then(gcalSincronizza).then(() => avviso('Calendario TASK aggiornato.'))
    .catch(e => avviso(e.message + ' Lo farà Claude al prossimo aggiornamento.', 'errore'));
}

function pannelloGoogle() {
  const imp = S.A.impostazioni;
  const campo = (k, etich, extra = {}) => h('label', { class: 'campo intero' }, h('span', {}, etich),
    h('input', { value: imp[k] || '', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', ...extra, onchange: e => { const v = e.target.value.trim(); if (v) imp[k] = v; else delete imp[k]; toccaImpostazioni(); salva(); } }));
  return pannello('Calendario Google TASK',
    h('p', {}, gcalPronto() ? stato('ok', gcalTokenValido() ? 'Collegato: gli eventi si creano appena premi il pulsante' : 'Pronto: al primo clic Google ti chiede l\'accesso') : stato('ritardo', 'Non collegato: gli eventi li crea Claude')),
    h('div', { class: 'modulo' }, campo('google_client_id', 'ID client OAuth di Google', { placeholder: '…apps.googleusercontent.com' }), campo('calendario_task', 'ID del calendario TASK')),
    gcalPronto() ? h('div', { class: 'azioni' }, btn('Prova il collegamento', () => gcalAccedi().then(gcalSincronizza).then(n => avviso(n ? `Calendario TASK aggiornato (${n}).` : 'Collegato, il calendario TASK è già in pari.')).catch(e => avviso(e.message, 'errore')))) : null,
    h('details', { open: !gcalPronto() }, h('summary', {}, 'Come si ottiene l\'ID client (una volta sola)'), h('ol', { class: 'largo-testo' },
      h('li', {}, 'Su console.cloud.google.com crea un progetto, per esempio "Life Planning".'),
      h('li', {}, 'API e servizi, Libreria: attiva "Google Calendar API".'),
      h('li', {}, 'Schermata di consenso OAuth: tipo Esterno, stato Test, aggiungi il tuo indirizzo Gmail tra gli utenti di prova.'),
      h('li', {}, 'Credenziali, Crea credenziali, ID client OAuth, tipo "Applicazione web". Origine JavaScript: https://poiretluis-pixel.github.io. URI di reindirizzamento: https://poiretluis-pixel.github.io/archivio/google.html.'),
      h('li', {}, 'Copia l\'ID client e incollalo qui sopra.')),
      h('p', { class: 'attenuato piccolo' }, 'L\'accesso vale circa un\'ora e resta solo in memoria: dopo, al primo clic Google te lo richiede. Senza collegamento gli eventi li crea Claude al prossimo aggiornamento.')));
}
