/* ===== 8d. Siti e gestionali: i collegamenti di lavoro di tutti i giorni (voci organizzazione/sito). Solo indirizzi https, mai password. ===== */
const linkSicuro = v => (typeof v.link === 'string' && /^https:\/\/[^\s]+$/.test(v.link.trim()) ? v.link.trim() : '');
const dominio = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
function vistaSiti() {
  const filtro = S.filtro_siti || '';
  const tutti = voci('organizzazione', 'sito');
  const l = tutti.filter(v => !filtro || v.casella === filtro);
  const fonti = [...new Set(tutti.map(v => v.casella).filter(Boolean))].sort();
  const gruppi = [...CAT_SITI, ''].map(cat => [cat, l.filter(v => (CAT_SITI.includes(v.categoria) ? v.categoria : '') === cat).sort((a, b) => (a.titolo || '').localeCompare(b.titolo || ''))]).filter(([, x]) => x.length);
  const nuovo = () => apriModulo('organizzazione', 'sito', null, { link: 'https://' });
  const carta = v => { const u = linkSicuro(v);
    return h('li', { class: 'sito' },
      u ? h('a', { class: 'sito-link', href: u, target: '_blank', rel: 'noopener noreferrer' }, h('strong', {}, v.titolo), h('span', { class: 'attenuato piccolo' }, dominio(u) + ' ↗'))
        : h('div', { class: 'sito-link' }, h('strong', {}, v.titolo), h('span', { class: 'fuori piccolo' }, 'Indirizzo non valido: deve iniziare con https://')),
      h('div', { class: 'sito-piede' }, etichettaColore(v.casella), v.nota ? h('span', { class: 'attenuato piccolo testo-lungo' }, v.nota) : null, btn('Modifica', () => apriModulo('organizzazione', 'sito', v), 'piccolo')));
  };
  return h('div', {},
    h('div', { class: 'testa' },
      h('div', {}, h('h1', {}, 'Siti e gestionali'), h('p', { class: 'sotto largo-testo' }, 'I siti e i gestionali che usi ogni giorno, a un clic. Si aprono in una scheda nuova. Le password restano nel gestore di password del browser, mai qui.')),
      h('div', { class: 'azioni' }, btn('Aggiungi un sito', nuovo, 'primario'))),
    fonti.length > 1 ? h('div', { class: 'azioni filtri' }, h('span', { class: 'attenuato piccolo' }, 'Mostra:'),
      ['', ...fonti].map(f => h('button', { type: 'button', class: 'filtro' + (f === filtro ? ' scelto' : ''), 'aria-pressed': f === filtro ? 'true' : 'false', onclick: () => { S.filtro_siti = f; disegna(); } }, f ? etichettaColore(f) : 'Tutto'))) : null,
    gruppi.length ? gruppi.map(([cat, x]) => pannello(cat || 'Altri', h('ul', { class: 'siti' }, x.map(carta))))
      : pannello('', vuoto('Nessun sito ancora. Aggiungi i siti e i gestionali che apri ogni giorno.', btn('Aggiungi un sito', nuovo, 'primario'))));
}
