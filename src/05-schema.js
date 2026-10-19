/* ===== 5. Schema: aree, tipi di voce e campi =====
   Per aggiungere un'area o un tipo basta aggiungere una descrizione qui: tabelle, moduli,
   importazione CSV ed esportazione si generano da soli. I dati già salvati non vanno toccati. */
const c = (k, etichetta, tipo = 'testo', extra = {}) => ({ k, etichetta, tipo, ...extra });
const CAT_ESAMI = ['Rene', 'Lipidi', 'Glicemia', 'Fegato', 'Infiammazione', 'Ematologia', 'Ferro e vitamine', 'Tiroide e ormoni', 'Proteine', 'Elettroliti', 'Intestino', 'Urine', 'Sierologie', 'Allergologia', 'Altro'];
const RIPETI = { mai: 0, mensile: 1, trimestrale: 3, semestrale: 6, annuale: 12 };
/* Categorie dei movimenti. Le categorie neutre non contano né come entrata né come uscita:
   giroconti tra conti propri, soldi messi in società o investimenti (restano patrimonio), prestiti ricevuti (sono debiti). */
const CAT_USCITE = ['Casa', 'Spesa alimentare', 'Ristoranti e bar', 'Auto e trasporti', 'Salute', 'Figli', 'Istruzione', 'Sport e benessere', 'Abbigliamento', 'Viaggi e svago', 'Abbonamenti', 'Assicurazioni', 'Tasse e imposte', 'Rate e finanziamenti', 'Lavori e ristrutturazioni', 'Regali e donazioni', 'Contanti prelevati', 'Commissioni bancarie', 'Investimenti e partecipazioni', 'Altre uscite'];
const CAT_ENTRATE = ['Compensi e stipendio', 'Utili e dividendi', 'Contributi famiglia', 'Rimborsi', 'Affitti', 'Prestiti ricevuti', 'Altre entrate'];
const GIROCONTO = 'Giroconto';
const CAT_NEUTRE = new Set([GIROCONTO, 'Investimenti e partecipazioni', 'Prestiti ricevuti']);
const AMBITI = ['Lavoro', 'Famiglia', 'Personale', 'Salute', 'Finanze'];
/* Liste di lavoro, come in Google Task: Oggi, Coda, Archivio. Valgono per i task e per le mail da gestire. Il vecchio valore Domani vale come Coda. */
const LISTE_LAVORO = ['Oggi', 'Coda', 'Archivio'];
const PRIORITA = ['alta', 'media', 'bassa'];
/* Task ricorrenti: quando si segna fatto, la scadenza passa alla prossima e il task torna in Coda. */
const RIPETI_TASK = ['ogni giorno', 'nei giorni lavorativi', 'ogni settimana', 'ogni 2 settimane', 'ogni mese', 'ogni 3 mesi', 'ogni 6 mesi', 'ogni anno'];
const CASELLE = ['Personale', '3MEDical Pioltello', '3MEDical Porta Romana'];
const CAT_SITI = ['Gestionali', 'Banche e pagamenti', 'Personale e paghe', 'Google e comunicazione', 'Sito e social', 'Altro'];
const RIGUARDA = ['3MEDical', '3MEDical Pioltello', '3MEDical Porta Romana', 'Psiche e Soma', 'Personale'];
/* Etichette dei task personali: un task con una di queste etichette sta in Organizzazione, non nella pagina Task di lavoro. */
const ETICHETTE_PERSONALI = ['CASA', 'GIARDINO', 'PROGETTI'];

const AREE_BASE = [
  { id: 'finanze', nome: 'Finanze', tipi: {
    saldo: { nome: 'Saldo di un conto', plur: 'Saldi dei conti', titolo: v => v.conto, colonne: ['data', 'conto', 'categoria', 'valore'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('conto', 'Conto', 'testo', { obbl: true, suggerisci: true, esempi: ['BPM personale', 'BPM famiglia'] }), c('categoria', 'Tipo', 'scelta', { opzioni: ['Conto corrente', 'Risparmio', 'Investimenti', 'Previdenza', 'Contanti', 'Carta di credito', 'Debito'] }), c('valore', 'Saldo in euro', 'numero', { obbl: true, euro: true }), c('nota', 'Nota')] },
    movimento: { nome: 'Movimento', plur: 'Entrate e uscite', titolo: v => v.descrizione, colonne: ['data', 'descrizione', 'categoria', 'valore', 'conto'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('descrizione', 'Descrizione', 'testo', { obbl: true }), c('categoria', 'Categoria', 'scelta', { opzioni: [...CAT_USCITE, ...CAT_ENTRATE, GIROCONTO] }),
      c('valore', 'Importo in euro (negativo per le uscite)', 'numero', { obbl: true, euro: true }), c('conto', 'Conto', 'testo', { suggerisci: true }), c('ricorrente', 'Spesa o entrata ricorrente', 'si_no'), c('nota', 'Nota')] },
    budget: { nome: 'Tetto di spesa', plur: 'Tetti di spesa mensili', titolo: v => v.categoria, colonne: ['categoria', 'valore', 'data'], campi: [
      c('categoria', 'Categoria', 'scelta', { obbl: true, opzioni: CAT_USCITE }), c('valore', 'Tetto mensile in euro', 'numero', { obbl: true, euro: true }), c('data', 'In vigore dal', 'data', { obbl: true }), c('nota', 'Nota')] },
  } },
  { id: 'patrimonio', nome: 'Patrimonio', tipi: {
    bene: { nome: 'Bene', plur: 'Beni', titolo: v => v.titolo, colonne: ['titolo', 'categoria', 'valore', 'data'], campi: [
      c('titolo', 'Nome', 'testo', { obbl: true }), c('categoria', 'Tipo', 'scelta', { opzioni: ['Immobile', 'Quote societarie', 'Investimenti finanziari', 'Polizze e previdenza', 'Veicolo', 'Oggetti di valore', 'Altro'] }), c('valore', 'Valore stimato oggi in euro', 'numero', { obbl: true, euro: true }),
      c('data', 'Data della stima', 'data'), c('costo', 'Costo di acquisto in euro', 'numero', { euro: true }), c('acquisto', 'Data di acquisto', 'data'), c('nota', 'Nota', 'lungo')] },
    debito: { nome: 'Debito', plur: 'Debiti', titolo: v => v.titolo, colonne: ['titolo', 'categoria', 'valore', 'scadenza'], campi: [
      c('titolo', 'Nome', 'testo', { obbl: true }), c('categoria', 'Tipo', 'scelta', { opzioni: ['Mutuo', 'Finanziamento', 'Leasing', 'Altro'] }), c('valore', 'Residuo in euro', 'numero', { obbl: true, euro: true }),
      c('data', 'Data del residuo', 'data'), c('rata', 'Rata mensile in euro', 'numero', { euro: true }), c('scadenza', 'Fine prevista', 'data'), c('nota', 'Nota', 'lungo')] },
  } },
  { id: 'organizzazione', nome: 'Organizzazione', tipi: {
    obiettivo: { nome: 'Obiettivo', plur: 'Obiettivi', titolo: v => v.titolo, colonne: ['titolo', 'ambito', 'avanzamento', 'scadenza', 'stato'], campi: [
      c('titolo', 'Obiettivo', 'testo', { obbl: true }), c('ambito', 'Ambito', 'scelta', { opzioni: AMBITI }), c('data', 'Fissato il', 'data', { obbl: true }), c('scadenza', 'Da raggiungere entro', 'data'),
      c('misura', 'Come si misura (es. 10 kg in meno, 20.000 € di riserva)', 'lungo'), c('avanzamento', 'Avanzamento in %', 'numero'), c('stato', 'Stato', 'scelta', { opzioni: ['attivo', 'raggiunto', 'in pausa', 'abbandonato'] }), c('nota', 'Nota', 'lungo')] },
    attivita: { nome: 'Cosa da fare', plur: 'Cose da fare', titolo: v => v.titolo, colonne: ['data', 'titolo', 'ambito', 'lista', 'priorita', 'stato'], campi: [
      c('titolo', 'Cosa', 'testo', { obbl: true }), c('ambito', 'Ambito', 'scelta', { opzioni: AMBITI }), c('data', 'Entro il (facoltativo)', 'data'),
      c('ripeti', 'Si ripete (serve la scadenza)', 'scelta', { opzioni: RIPETI_TASK }),
      c('lista', 'Lista', 'scelta', { opzioni: LISTE_LAVORO }), c('casella', 'Riguarda (CASA, GIARDINO e PROGETTI stanno in Organizzazione)', 'scelta', { opzioni: [...RIGUARDA, ...ETICHETTE_PERSONALI] }),
      c('priorita', 'Priorità', 'scelta', { opzioni: PRIORITA }), c('stato', 'Stato', 'scelta', { opzioni: ['da fare', 'in corso', 'fatta'] }), c('nota', 'Nota', 'lungo')] },
    mail: { nome: 'Mail da gestire', plur: 'Mail da gestire', titolo: v => v.titolo, colonne: ['data', 'titolo', 'mittente', 'casella', 'lista', 'stato'], campi: [
      c('titolo', 'Oggetto', 'testo', { obbl: true }), c('mittente', 'Da chi', 'testo', { suggerisci: true }), c('casella', 'Casella', 'scelta', { opzioni: CASELLE }),
      c('data', 'Ricevuta il', 'data', { obbl: true }), c('azione', 'Cosa fare', 'lungo'), c('lista', 'Lista', 'scelta', { opzioni: LISTE_LAVORO }),
      c('priorita', 'Priorità', 'scelta', { opzioni: PRIORITA }), c('stato', 'Stato', 'scelta', { opzioni: ['da gestire', 'in attesa di altri', 'gestita'] }),
      c('link', 'Collegamento a Gmail'), c('nota', 'Nota', 'lungo')] },
    sito: { nome: 'Sito o gestionale', plur: 'Siti e gestionali', titolo: v => v.titolo, colonne: ['titolo', 'categoria', 'casella', 'link'], campi: [
      c('titolo', 'Nome', 'testo', { obbl: true }), c('link', 'Indirizzo (https://…)', 'testo', { obbl: true }), c('categoria', 'Tipo', 'scelta', { opzioni: CAT_SITI }),
      c('casella', 'Riguarda', 'scelta', { opzioni: RIGUARDA }), c('nota', 'Nota (mai password)', 'lungo')] },
    revisione: { nome: 'Revisione della settimana', plur: 'Revisioni settimanali', titolo: v => 'Settimana del ' + fmtData(v.data), colonne: ['data', 'voto', 'focus'], campi: [
      c('data', 'Lunedì della settimana', 'data', { obbl: true }), c('voto', 'Come è andata, da 1 a 5', 'numero'), c('bene', 'Cosa è andato bene', 'lungo'), c('male', 'Cosa non è andato', 'lungo'),
      c('focus', 'Le tre cose della prossima settimana', 'lungo'), c('famiglia', 'Tempo per la famiglia: cosa ho fatto', 'lungo')] },
  } },
  { id: 'salute', nome: 'Salute e longevità', tipi: {
    misura: { nome: 'Esame di laboratorio', plur: 'Esami di laboratorio', titolo: v => v.parametro, colonne: ['data', 'parametro', 'valore', 'unita', 'rif_testo', 'laboratorio'], campi: [
      c('data', 'Data del prelievo', 'data', { obbl: true }), c('parametro', 'Parametro', 'testo', { obbl: true, suggerisci: true }), c('categoria', 'Categoria', 'scelta', { opzioni: CAT_ESAMI }),
      c('valore', 'Valore', 'numero'), c('testo', 'Risultato a parole (es. Negativo)'), c('unita', 'Unità di misura', 'testo', { suggerisci: true }),
      c('rif_min', 'Riferimento minimo', 'numero'), c('rif_max', 'Riferimento massimo', 'numero'), c('rif_testo', 'Riferimento come scritto sul referto'),
      c('fuori', 'Segnalato fuori intervallo dal laboratorio', 'si_no'), c('laboratorio', 'Laboratorio', 'testo', { suggerisci: true }), c('doc', 'Referto di origine', 'allegato'), c('nota', 'Nota', 'lungo')] },
    visita: { nome: 'Visita o referto', plur: 'Visite e referti', titolo: v => v.specialista, colonne: ['data', 'specialista', 'struttura', 'conclusioni'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('specialista', 'Specialista o tipo di esame', 'testo', { obbl: true }), c('struttura', 'Struttura'), c('motivo', 'Motivo'),
      c('conclusioni', 'Conclusioni', 'lungo'), c('indicazioni', 'Indicazioni ricevute', 'lungo'), c('doc', 'Referto di origine', 'allegato')] },
    sensore: { nome: 'Dato del dispositivo', plur: 'Dati del dispositivo', titolo: v => v.metrica, colonne: ['data', 'metrica', 'valore', 'unita', 'fonte'], largo: 'metrica', campi: [
      c('data', 'Data', 'data', { obbl: true }), c('metrica', 'Metrica', 'testo', { obbl: true, suggerisci: true }), c('valore', 'Valore', 'numero', { obbl: true }), c('unita', 'Unità'), c('fonte', 'Dispositivo', 'testo', { suggerisci: true })] },
    corpo: { nome: 'Misura del corpo', plur: 'Peso e misure', titolo: v => v.metrica, colonne: ['data', 'metrica', 'valore', 'unita'], largo: 'metrica', campi: [
      c('data', 'Data', 'data', { obbl: true }), c('metrica', 'Misura', 'testo', { obbl: true, suggerisci: true, esempi: ['Peso', 'Altezza', 'Massa grassa', 'Massa magra', 'Circonferenza vita', 'Pressione sistolica', 'Pressione diastolica'] }), c('valore', 'Valore', 'numero', { obbl: true }), c('unita', 'Unità')] },
    alimentazione: { nome: 'Piano alimentare', plur: 'Piani alimentari', titolo: v => v.titolo, colonne: ['data', 'titolo', 'calorie', 'stato'], campi: [
      c('titolo', 'Nome del piano', 'testo', { obbl: true }), c('data', 'Dal', 'data', { obbl: true }), c('autore', 'Prescritto da'), c('obiettivo', 'Obiettivo', 'scelta', { opzioni: ['Dimagrimento', 'Mantenimento', 'Massa', 'Salute'] }),
      c('calorie', 'Calorie giornaliere', 'numero'), c('stato', 'Stato', 'scelta', { opzioni: ['in uso', 'seguito poco', 'concluso'] }), c('sintesi', 'Sintesi del piano', 'lungo'), c('doc', 'Documento di origine', 'allegato')] },
    osservazione: { nome: 'Osservazione', plur: 'Osservazioni e piano', titolo: v => v.titolo, colonne: ['data', 'titolo', 'priorita', 'stato'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('titolo', 'Titolo', 'testo', { obbl: true }), c('testo', 'Testo', 'lungo'), c('priorita', 'Priorità', 'scelta', { opzioni: ['alta', 'media', 'bassa'] }),
      c('stato', 'Stato', 'scelta', { opzioni: ['aperta', 'in corso', 'chiusa'] }), c('origine', 'Scritta da')] },
  } },
  { id: 'sport', nome: 'Sport', tipi: {
    attivita: { nome: 'Attività sportiva', plur: 'Attività sportive', titolo: v => v.disciplina, colonne: ['data', 'disciplina', 'minuti', 'intensita'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('disciplina', 'Disciplina', 'testo', { obbl: true, suggerisci: true, esempi: ['Palestra', 'Corsa', 'Camminata', 'Padel', 'Pilates', 'Nuoto', 'Bici'] }),
      c('minuti', 'Durata in minuti', 'numero'), c('intensita', 'Intensità', 'scelta', { opzioni: ['leggera', 'moderata', 'intensa'] }), c('distanza', 'Distanza in km', 'numero'), c('nota', 'Nota', 'lungo')] },
    allenamento: { nome: 'Seduta di allenamento', plur: 'Sedute da scheda', titolo: v => v.seduta || v.scheda, colonne: ['data', 'scheda', 'seduta', 'serie', 'stimato'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('scheda', 'Scheda', 'testo', { obbl: true, suggerisci: true }), c('settimana', 'Settimana della scheda', 'numero'), c('seduta', 'Seduta', 'testo'),
      c('serie', 'Serie eseguite', 'numero'), c('dettaglio', 'Esercizi (serie × ripetizioni, carico)', 'lungo'), c('stimato', 'Valori stimati', 'si_no'), c('stime', 'Cosa è stimato', 'lungo'),
      c('doc', 'Scheda di origine', 'allegato'), c('nota', 'Nota', 'lungo')] },
    massimale: { nome: 'Massimale', plur: 'Massimali', titolo: v => v.esercizio, colonne: ['data', 'esercizio', 'valore', 'ripetizioni'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('esercizio', 'Esercizio', 'testo', { obbl: true, suggerisci: true }), c('valore', 'Chili', 'numero', { obbl: true }), c('ripetizioni', 'Ripetizioni', 'numero'), c('nota', 'Nota', 'lungo')] },
  } },
  { id: 'mindfulness', nome: 'Mindfulness', tipi: {
    pratica: { nome: 'Pratica', plur: 'Pratiche', titolo: v => v.pratica, colonne: ['data', 'pratica', 'minuti', 'umore'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('pratica', 'Pratica', 'testo', { obbl: true, suggerisci: true, esempi: ['Meditazione', 'Respirazione', 'Diario', 'Gratitudine', 'Passeggiata consapevole'] }),
      c('minuti', 'Minuti', 'numero'), c('umore', 'Umore dopo, da 1 a 5', 'numero'), c('nota', 'Nota', 'lungo')] },
  } },
  { id: 'lettura', nome: 'Lettura', tipi: {
    libro: { nome: 'Libro', plur: 'Libri', titolo: v => v.titolo, colonne: ['titolo', 'autore', 'stato', 'fine', 'voto'], campi: [
      c('titolo', 'Titolo', 'testo', { obbl: true }), c('autore', 'Autore', 'testo', { suggerisci: true }), c('categoria', 'Genere', 'testo', { suggerisci: true, esempi: ['Business', 'Crescita personale', 'Salute', 'Finanza', 'Narrativa', 'Storia'] }),
      c('stato', 'Stato', 'scelta', { opzioni: ['da leggere', 'in lettura', 'letto', 'abbandonato'] }), c('data', 'Iniziato il', 'data'), c('fine', 'Finito il', 'data'), c('pagine', 'Pagine', 'numero'),
      c('voto', 'Voto da 1 a 5', 'numero'), c('idee', 'Idee da tenere e da applicare', 'lungo')] },
    sessione: { nome: 'Sessione di lettura', plur: 'Sessioni di lettura', titolo: v => v.libro, colonne: ['data', 'libro', 'minuti', 'pagine'], campi: [
      c('data', 'Data', 'data', { obbl: true }), c('libro', 'Libro', 'testo', { suggerisci: true }), c('minuti', 'Minuti', 'numero'), c('pagine', 'Pagine lette', 'numero')] },
  } },
  { id: 'viaggi', nome: 'Viaggi ed esperienze', tipi: {
    viaggio: { nome: 'Viaggio', plur: 'Viaggi', titolo: v => v.titolo, colonne: ['data', 'titolo', 'luogo', 'con', 'voto'], campi: [
      c('titolo', 'Titolo', 'testo', { obbl: true }), c('luogo', 'Luogo', 'testo'), c('paese', 'Paese', 'testo', { suggerisci: true }), c('data', 'Partenza', 'data', { obbl: true }), c('fine', 'Rientro', 'data'),
      c('con', 'Con chi'), c('valore', 'Costo in euro', 'numero', { euro: true }), c('voto', 'Voto da 1 a 5', 'numero'), c('nota', 'Ricordi e note', 'lungo')] },
    esperienza: { nome: 'Esperienza', plur: 'Esperienze', titolo: v => v.titolo, colonne: ['data', 'titolo', 'categoria', 'voto'], campi: [
      c('titolo', 'Titolo', 'testo', { obbl: true }), c('data', 'Data', 'data', { obbl: true }), c('categoria', 'Categoria', 'testo', { suggerisci: true }), c('luogo', 'Luogo'),
      c('con', 'Con chi'), c('valore', 'Costo in euro', 'numero', { euro: true }), c('voto', 'Voto da 1 a 5', 'numero'), c('nota', 'Note', 'lungo')] },
  } },
  { id: 'progetti', nome: 'Progetti', tipi: {
    progetto: { nome: 'Progetto', plur: 'Progetti', titolo: v => v.titolo, colonne: ['titolo', 'stato', 'agg'], campi: [
      c('titolo', 'Titolo', 'testo', { obbl: true }), c('stato', 'Stato', 'scelta', { opzioni: ['idea', 'attivo', 'in pausa', 'concluso'] }), c('obiettivo', 'Obiettivo in una frase', 'lungo')] },
  } },
];
const TIPO_SCADENZA = { nome: 'Scadenza', plur: 'Scadenze', titolo: v => v.titolo, colonne: ['data', 'titolo', 'ripeti', 'stato'], campi: [
  c('titolo', 'Cosa', 'testo', { obbl: true }), c('data', 'Entro il', 'data', { obbl: true }), c('zona', 'Area', 'testo', { suggerisci: true }),
  c('ripeti', 'Si ripete', 'scelta', { opzioni: Object.keys(RIPETI) }), c('stato', 'Stato', 'scelta', { opzioni: ['da fare', 'fatta'] }), c('nota', 'Nota', 'lungo')] };
const TIPO_LIBERO = { nome: 'Voce', plur: 'Voci', titolo: v => v.titolo, colonne: ['data', 'titolo', 'categoria', 'valore'], campi: [
  c('titolo', 'Titolo', 'testo', { obbl: true }), c('data', 'Data', 'data', { obbl: true }), c('categoria', 'Categoria', 'testo', { suggerisci: true }), c('valore', 'Valore numerico (facoltativo)', 'numero'), c('unita', 'Unità'), c('nota', 'Note', 'lungo')] };
/* Consigli: presenti in ogni cartella, anche in quelle personalizzate. Li scrive Claude e li mette in ordine; si possono anche aggiungere a mano. */
const TIPO_CONSIGLIO = { nome: 'Consiglio', plur: 'Consigli', titolo: v => v.titolo, colonne: ['priorita', 'titolo', 'stato', 'data'], campi: [
  c('titolo', 'Consiglio', 'testo', { obbl: true }), c('data', 'Data', 'data', { obbl: true }), c('priorita', 'Priorità (1 = il più importante)', 'numero'),
  c('azione', 'Cosa fare', 'lungo'), c('perche', 'Perché, in base ai dati', 'lungo'), c('stato', 'Stato', 'scelta', { opzioni: ['da fare', 'in corso', 'fatto', 'scartato'] }), c('origine', 'Scritto da')] };
const AREA_SISTEMA = { id: 'sistema', nome: 'Scadenze', tipi: { scadenza: TIPO_SCADENZA } };

function aree() {
  const extra = S.A.aree.filter(a => !a.canc).map(a => ({ id: a.id, nome: a.nome, libera: true, tipi: { voce: TIPO_LIBERO } }));
  return [...AREE_BASE, ...extra].map(a => ({ ...a, tipi: { ...a.tipi, consiglio: TIPO_CONSIGLIO } }));
}
const area = id => (id === 'sistema' ? AREA_SISTEMA : aree().find(a => a.id === id));
const tipoDef = (a, t) => (area(a) || { tipi: {} }).tipi[t];
const ETICHETTE = { agg: 'Ultima modifica', persona: 'Persona' };
const etichetta = (def, k) => (def.campi.find(f => f.k === k) || {}).etichetta || ETICHETTE[k] || k;

/* Fonti da tenere aggiornate: la pagina segnala da quanto tempo non arrivano dati nuovi. */
const FONTI = [
  { id: 'movimenti', nome: 'Movimenti dei conti BPM', area: 'finanze', tipi: ['movimento'], giorni: 35, come: 'Scarica dall\'home banking i movimenti del mese (Excel o CSV) e caricali in Documenti, oppure mandali a Claude in chat: li classifica lui.' },
  { id: 'saldi', nome: 'Saldi dei conti', area: 'finanze', tipi: ['saldo'], giorni: 35, come: 'Li ricava Claude dagli estratti conto. Puoi anche aggiungerli a mano in Finanze.' },
  { id: 'dispositivo', nome: 'Dati del Garmin', area: 'salute', tipi: ['sensore'], giorni: 3, come: 'Arrivano da soli ogni notte da Garmin Connect. Se sono fermi, guarda lo stato in Impostazioni.' },
  { id: 'corpo', nome: 'Peso e misure', area: 'salute', tipi: ['corpo'], giorni: 35, come: 'Registra il peso nell\'app Garmin Connect (arriva da solo) oppure aggiungilo qui in Salute.' },
  { id: 'referti', nome: 'Esami e referti', area: 'salute', tipi: ['misura', 'visita'], giorni: 200, come: 'Carica il PDF in Documenti o mandalo a Claude in chat: i valori li inserisce lui.' },
  { id: 'allenamenti', nome: 'Schede di allenamento', area: 'sport', tipi: ['allenamento', 'attivita'], giorni: 21, come: 'Carica la scheda in Documenti o mandala a Claude: le sedute le ricava lui.' },
  { id: 'revisione', nome: 'Revisione della settimana', area: 'organizzazione', tipi: ['revisione'], giorni: 9, come: 'Dieci minuti la domenica sera: cosa è andato, cosa no, le tre cose della prossima settimana. Puoi dettarla a Claude.' },
];
function statoFonte(f) {
  const l = voci(f.area).filter(v => f.tipi.includes(v.tipo));
  if (!l.length) return { stato: 'vuota', testo: 'Mai caricati' };
  const caricato = l.reduce((m, v) => ((v.creato || '') > m ? v.creato : m), '');
  const dato = l.reduce((m, v) => ((v.data || '') > m ? v.data : m), '');
  const g = giorniDa(caricato);
  return { stato: g > f.giorni ? 'ritardo' : 'ok', testo: `Ultimo caricamento ${fa(g)}` + (dato ? `, dati fino al ${fmtData(dato)}` : ''), giorni: g };
}
function fuoriIntervallo(v) {
  if (v.fuori === true) return true;
  if (typeof v.valore !== 'number') return false;
  return (typeof v.rif_min === 'number' && v.valore < v.rif_min) || (typeof v.rif_max === 'number' && v.valore > v.rif_max);
}
function testoRif(v) {
  if (v.rif_testo) return v.rif_testo;
  const a = typeof v.rif_min === 'number', b = typeof v.rif_max === 'number';
  return a && b ? `${fmtNum(v.rif_min, 3)} - ${fmtNum(v.rif_max, 3)}` : a ? `≥ ${fmtNum(v.rif_min, 3)}` : b ? `≤ ${fmtNum(v.rif_max, 3)}` : '';
}
const valoreTesto = v => (typeof v.valore === 'number' ? fmtNum(v.valore, 3) : (v.testo || ''));
function prossimaData(iso, ripeti) {
  const mesi = RIPETI[ripeti] || 0; if (!mesi) return null;
  const d = new Date(tempo(iso)); const giorno = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + mesi);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return isoData(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(giorno, ultimo));
}
