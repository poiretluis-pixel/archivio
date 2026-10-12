/* ===== 2. Cifratura =====
   Schema: una chiave dati casuale (256 bit) cifra tutto con AES-256-GCM.
   La chiave dati è a sua volta cifrata in uno o più "slot", ognuno apribile con un segreto
   (frase segreta oppure codice di recupero) tramite PBKDF2-HMAC-SHA256.
   Cambiare frase significa riscrivere solo lo slot, non i dati. Il formato è descritto in LEGGIMI.md. */
const ITERAZIONI = 600000;
const casuale = n => crypto.getRandomValues(new Uint8Array(n));
const normFrase = t => String(t).normalize('NFKC').trim();
const normCodice = t => String(t).toUpperCase().replace(/[^A-Z0-9]/g, '');

async function chiaveDaSegreto(segreto, sale, iter) {
  const base = await crypto.subtle.importKey('raw', cod.encode(segreto), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sale, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function creaSlot(tipo, segreto, chiaveDati) {
  const sale = casuale(16), iv = casuale(12);
  const k = await chiaveDaSegreto(tipo === 'recupero' ? normCodice(segreto) : normFrase(segreto), sale, ITERAZIONI);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, chiaveDati);
  return { tipo, kdf: 'PBKDF2-HMAC-SHA256', iterazioni: ITERAZIONI, sale: b64(sale), iv: b64(iv), chiave: b64(ct), creato: adesso() };
}
async function apriSlot(slot, segreto) {
  const k = await chiaveDaSegreto(slot.tipo === 'recupero' ? normCodice(segreto) : normFrase(segreto), daB64(slot.sale), slot.iterazioni);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daB64(slot.iv) }, k, daB64(slot.chiave)));
}
const importaChiaveDati = grezza => crypto.subtle.importKey('raw', grezza, 'AES-GCM', false, ['encrypt', 'decrypt']);

async function flusso(bytes, trasformazione) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(trasformazione)).arrayBuffer());
}
const haGzip = typeof CompressionStream !== 'undefined';

/* Busta: il file che finisce su disco e nel cloud. Contiene solo testo cifrato più i parametri per riaprirlo. */
async function sigilla(oggetto, chiave, testata) {
  let chiaro = cod.encode(JSON.stringify(oggetto));
  if (haGzip) chiaro = await flusso(chiaro, new CompressionStream('gzip'));
  const iv = casuale(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, chiaro);
  return {
    formato: 'archivio-vita', versione: 1, promemoria: testata.promemoria || '', slot: testata.slot, slot_agg: testata.slot_agg,
    cifra: 'AES-256-GCM', compressione: haGzip ? 'gzip' : 'nessuna', iv: b64(iv), dati: b64(ct), salvato: adesso(),
  };
}
async function dissigilla(busta, chiave) {
  let chiaro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daB64(busta.iv) }, chiave, daB64(busta.dati)));
  if (busta.compressione === 'gzip') chiaro = await flusso(chiaro, new DecompressionStream('gzip'));
  return JSON.parse(decod.decode(chiaro));
}
/* Allegati: 12 byte di IV seguiti dal testo cifrato, con la stessa chiave dati. */
async function cifraBytes(bytes, chiave) {
  const iv = casuale(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, bytes));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return out;
}
async function decifraBytes(bytes, chiave) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, chiave, u.subarray(12)));
}
function forzaFrase(t) {
  const n = normFrase(t).length;
  if (n === 0) return null;
  if (n < 10) return { livello: 'debole', testo: 'Debole: meno di 10 caratteri si indovina in poco tempo se il file cifrato finisce in mani sbagliate.' };
  if (n < 16 && !/\s/.test(t.trim())) return { livello: 'media', testo: 'Discreta. Meglio una frase di 4 o 5 parole.' };
  return { livello: 'buona', testo: 'Buona.' };
}
