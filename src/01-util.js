'use strict';
/* ===== 1. Utilità di base ===== */
const $ = (s, r = document) => r.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';
const PROP = new Set(['value', 'checked', 'disabled', 'selected', 'required', 'hidden', 'multiple', 'open']);

function _el(el, attrs, kids) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (PROP.has(k) && !(el instanceof SVGElement)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = c => {
    if (c == null || c === false || c === '') return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}
/* Tutti i dati dell'utente passano da qui come testo, mai come HTML. */
const h = (tag, attrs, ...kids) => _el(document.createElement(tag), attrs, kids);
const s = (tag, attrs, ...kids) => _el(document.createElementNS(SVGNS, tag), attrs, kids);

const adesso = () => new Date().toISOString();
const oggi = () => { const d = new Date(); return isoData(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const isoData = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));
const MS_G = 86400000;
const tempo = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const giorniDa = iso => Math.floor((tempo(oggi()) - tempo(iso.slice(0, 10))) / MS_G);

const _fd = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const _fm = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const fmtData = iso => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? _fd.format(new Date(tempo(iso))) : (iso || ''));
const fmtMese = ym => _fm.format(new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1)));
const fmtQuando = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
function fmtNum(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '';
  return Number(n).toLocaleString('it-IT', { maximumFractionDigits: dec });
}
const fmtEuro = n => (n == null || isNaN(n) ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
const fmtDim = b => (b > 1048576 ? fmtNum(b / 1048576, 1) + ' MB' : fmtNum(Math.max(1, Math.round(b / 1024)), 0) + ' kB');
function fa(giorni) {
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 60) return `${giorni} giorni fa`;
  if (giorni < 730) return `${Math.round(giorni / 30)} mesi fa`;
  return `${Math.round(giorni / 365)} anni fa`;
}

/* Lettura tollerante di numeri e date scritti in formati diversi (file CSV di banche, dispositivi, laboratori). */
function leggiNum(x) {
  if (typeof x === 'number') return isFinite(x) ? x : null;
  if (x == null) return null;
  let t = String(x).trim().replace(/[\s€$£% ]/g, '').replace(/^\+/, '');
  if (!t || !/^-?[\d.,]+$/.test(t)) return null;
  const v = t.lastIndexOf(','), p = t.lastIndexOf('.');
  if (v >= 0 && p >= 0) t = v > p ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (v >= 0) t = /^-?\d{1,3}(,\d{3}){2,}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return isFinite(n) ? n : null;
}
/* In una colonna, "12,450" è dodicimila se accanto ci sono interi di almeno tre cifre (passi, calorie), altrimenti è un decimale. */
function lettoreColonna(valori) {
  const v = valori.map(x => String(x == null ? '' : x).trim()).filter(Boolean);
  const conVirgola = v.filter(x => x.includes(','));
  const migliaia = conVirgola.length > 0 && conVirgola.every(x => /^-?\d{1,3}(,\d{3})+$/.test(x)) && v.some(x => /^-?\d{3,}$/.test(x)) && !v.some(x => /\d\.\d/.test(x) && x.includes(','));
  return migliaia ? x => leggiNum(String(x == null ? '' : x).replace(/,/g, '')) : leggiNum;
}
const MESI = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12, jan: 1, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, dec: 12 };
function leggiData(x) {
  if (!x) return null;
  const t = String(x).trim();
  let m;
  const ok = (y, mo, d) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 2200 ? isoData(y, mo, d) : null);
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return ok(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return ok(+m[3], +m[2], +m[1]);
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})(?!\d)/))) return ok(2000 + +m[3], +m[2], +m[1]);
  if ((m = t.match(/^(\d{1,2})\s+([a-zA-Z]{3})[a-zA-Z]*\.?,?\s+(\d{4})/)) && MESI[m[2].toLowerCase()]) return ok(+m[3], MESI[m[2].toLowerCase()], +m[1]);
  if ((m = t.match(/^([a-zA-Z]{3})[a-zA-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MESI[m[1].toLowerCase()]) return ok(+m[3], MESI[m[1].toLowerCase()], +m[2]);
  return null;
}

const cod = new TextEncoder(), decod = new TextDecoder();
function b64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let t = '';
  for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(t);
}
function daB64(t) {
  const bin = atob(String(t).replace(/\s/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function scarica(nome, contenuto, mime = 'application/octet-stream') {
  const url = URL.createObjectURL(contenuto instanceof Blob ? contenuto : new Blob([contenuto], { type: mime }));
  const a = h('a', { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const leggiFile = (f, come = 'text') => (come === 'text' ? f.text() : f.arrayBuffer());
function raggruppa(lista, chiave) {
  const m = new Map();
  for (const x of lista) { const k = chiave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
const somma = l => l.reduce((a, b) => a + (Number(b) || 0), 0);
const perData = (a, b) => (a.data || '').localeCompare(b.data || '');
const nomeFile = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'file';

/* CSV: riconosce da solo il separatore e gestisce le virgolette. */
function leggiCsv(testo) {
  testo = testo.replace(/^﻿/, '');
  const prima = testo.split(/\r?\n/, 1)[0];
  const sep = [';', '\t', ','].map(c => [c, prima.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const righe = []; let riga = [], campo = '', q = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (q) { if (c === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === sep) { riga.push(campo); campo = ''; }
    else if (c === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || riga.length) { riga.push(campo); righe.push(riga); }
  const piene = righe.filter(r => r.some(x => x.trim() !== ''));
  return { intestazioni: (piene[0] || []).map(x => x.trim()), righe: piene.slice(1) };
}
function creaCsv(intestazioni, righe) {
  const q = v => { const t = v == null ? '' : String(v); return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return '﻿' + [intestazioni, ...righe].map(r => r.map(q).join(';')).join('\r\n');
}
