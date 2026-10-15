# Archivio

Pagina personale per finanze, patrimonio, organizzazione, salute, sport, mindfulness, lettura, viaggi, progetti e documenti.
Deriva dal programma di Lorenzo Ghessa (ArchivioGhessa), adattato alle aree di Luis Poiret.
Un solo file `index.html`, nessun server, nessuna libreria esterna.

In questo repository c'è solo il programma, **nessun dato personale**. I dati stanno nel repository privato separato `archivio-dati`, dove li leggono e scrivono la pagina, Claude e l'automazione Garmin.

## Come funziona

| Pezzo | Dove | Cosa fa |
|---|---|---|
| Pagina | questo repository, pubblicato con GitHub Pages | Mostra i dati e permette di modificarli. Su ogni dispositivo li tiene cifrati con una frase segreta. |
| Dati | repository privato `archivio-dati` | `archivio.json`, `documenti/`, `garmin/`, `rapporti/`, `strumenti/` |
| Garmin | automazione nel repository dei dati | Ogni notte scarica i dati da Garmin Connect in `garmin/AAAA.csv`. |
| Claude | collegato a GitHub | Trascrive i referti, aggiorna osservazioni e progetti, scrive il rapporto mensile, modifica la pagina. |

## Messa in opera (una volta sola)

1. **Due repository** dell'utente `poiretluis-pixel`: `archivio` pubblico (questo) e `archivio-dati` privato.
2. **Claude**: app GitHub di Claude installata su `archivio` e `archivio-dati` (github.com/apps/claude). Da lì Claude carica i file e li tiene aggiornati.
3. **Pubblicazione della pagina**: nel repository `archivio`, Settings, Pages, "Deploy from a branch", ramo `main`, cartella `/ (root)`. La pagina risponde a `https://poiretluis-pixel.github.io/archivio/`.
4. **Token per la pagina**: foto del profilo, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token. Repository access: "Only select repositories", `archivio-dati`. Permissions: Repository permissions, Contents, "Read and write". Scadenza: la più lunga disponibile.
5. **Garmin**: nel repository `archivio-dati`, Settings, Secrets and variables, Actions, "New repository secret": `GARMIN_EMAIL` e `GARMIN_PASSWORD`. Poi Actions, "Scarica dati Garmin", "Run workflow".
6. **Ogni dispositivo**: apri la pagina, "Collega il mio archivio", inserisci utente, `archivio-dati`, token e una frase segreta.

## Sicurezza

- I dati nel repository privato sono leggibili da chi entra nell'account GitHub e da Claude. Per questo password lunga e verifica in due passaggi sull'account GitHub sono indispensabili.
- Sul dispositivo dati e token sono cifrati (AES-256-GCM, chiave da PBKDF2-SHA256 con 600.000 iterazioni). La pagina si blocca dopo 15 minuti di inattività.
- Le credenziali Garmin stanno solo nei secrets di GitHub: non le vede la pagina né Claude.
- Il repository dei dati tiene la cronologia di ogni modifica: qualunque errore si può annullare.

## Formato dei dati: `archivio-vita/1`

`archivio.json` (nel repository dei dati), l'esportazione e i file di importazione hanno questa struttura. Nel repository il file è scritto con un elemento per riga, ordinati per `id`.

```json
{
 "schema": "archivio-vita/1",
 "meta": { "creato": "...", "aggiornato": "..." },
 "impostazioni": { "agg": "...", "blocco_min": 15 },
 "persone":  [{ "id": "...", "nome": "...", "nascita": "AAAA-MM-GG", "ruolo": "titolare" }],
 "voci":     [{ "id": "...", "area": "salute", "tipo": "misura", "persona": "<id persona>", "data": "AAAA-MM-GG", "...": "campi del tipo" }],
 "allegati": [{ "id": "...", "nome": "referto.pdf", "mime": "application/pdf", "file": "documenti/<id>.pdf", "area": "salute", "persona": "...", "data": "...", "stato": "da elaborare | elaborato" }],
 "aree":     [{ "id": "x-...", "nome": "Cartella personalizzata" }],
 "registro": [{ "id": "...", "quando": "...", "azione": "...", "origine": "...", "aggiunti": 0, "aggiornati": 0, "saltati": 0, "errori": [] }]
}
```

Ogni elemento ha `id` stabile, `creato` e `agg` (data e ora dell'ultima modifica, ISO 8601). Quando due modifiche si incrociano vince la più recente; un elemento cancellato resta come `{ "id", "canc": true, "agg" }`.
Date `AAAA-MM-GG`, numeri come numeri JSON. Nell'esportazione i documenti possono essere inclusi in `contenuto_base64`.

### Aree e tipi di voce

| Area | Tipo | Campi |
|---|---|---|
| `finanze` | `saldo` | `data`, `conto`, `categoria` (Conto corrente, Risparmio, Investimenti, Previdenza, Contanti, Carta di credito, Debito), `valore`, `nota` |
| `finanze` | `movimento` | `data`, `descrizione`, `categoria`, `valore` (negativo per le uscite), `conto`, `ricorrente`, `nota`. Le categorie `Giroconto`, `Investimenti e partecipazioni` e `Prestiti ricevuti` non contano né come entrata né come uscita |
| `finanze` | `budget` | `categoria`, `valore` (tetto mensile), `data` (in vigore dal), `nota` |
| `patrimonio` | `bene` | `titolo`, `categoria`, `valore`, `data`, `costo`, `acquisto`, `nota` |
| `patrimonio` | `debito` | `titolo`, `categoria`, `valore` (residuo), `data`, `rata`, `scadenza`, `nota` |
| `organizzazione` | `obiettivo` | `titolo`, `ambito` (Lavoro, Famiglia, Personale, Salute, Finanze), `data`, `scadenza`, `misura`, `avanzamento` (%), `stato`, `nota` |
| `organizzazione` | `attivita` | `titolo`, `ambito`, `data` (scadenza, facoltativa), `lista` (Oggi, Coda, Archivio), `lista_dal`, `casella`, `priorita`, `stato` (da fare, in corso, fatta), `nota` |
| `organizzazione` | `mail` | `titolo` (oggetto), `mittente`, `casella` (Personale, 3MEDical Pioltello, 3MEDical Porta Romana), `data` (ricevuta il), `azione`, `lista`, `lista_dal`, `priorita`, `stato` (da gestire, in attesa di altri, gestita), `link` (solo indirizzi mail.google.com), `nota` |
| `organizzazione` | `revisione` | `data` (lunedì), `voto`, `bene`, `male`, `focus`, `famiglia` |
| `salute` | `misura` | `data`, `parametro`, `categoria`, `valore` oppure `testo`, `unita`, `rif_min`, `rif_max`, `rif_testo`, `fuori`, `laboratorio`, `doc`, `nota` |
| `salute` | `visita` | `data`, `specialista`, `struttura`, `motivo`, `conclusioni`, `indicazioni`, `doc` |
| `salute` | `sensore` | `data`, `metrica`, `valore`, `unita`, `fonte` |
| `salute` | `corpo` | `data`, `metrica`, `valore`, `unita` |
| `salute` | `alimentazione` | `titolo`, `data`, `autore`, `obiettivo`, `calorie`, `stato`, `sintesi`, `doc` |
| `salute` | `osservazione` | `data`, `titolo`, `testo`, `priorita`, `stato`, `origine` |
| `sport` | `attivita` | `data`, `disciplina`, `minuti`, `intensita`, `distanza`, `nota` |
| `sport` | `allenamento` | `data`, `scheda`, `settimana`, `seduta`, `serie`, `dettaglio`, `stimato`, `stime`, `doc`, `nota` |
| `sport` | `massimale` | `data`, `esercizio`, `valore` (kg), `ripetizioni`, `nota` |
| `mindfulness` | `pratica` | `data`, `pratica`, `minuti`, `umore` (1-5), `nota` |
| `lettura` | `libro` | `titolo`, `autore`, `categoria`, `stato`, `data`, `fine`, `pagine`, `voto`, `idee` |
| `lettura` | `sessione` | `data`, `libro`, `minuti`, `pagine` |
| `viaggi` | `viaggio` | `titolo`, `luogo`, `paese`, `data`, `fine`, `con`, `valore`, `voto`, `nota` |
| `viaggi` | `esperienza` | `titolo`, `data`, `categoria`, `luogo`, `con`, `valore`, `voto`, `nota` |
| `progetti` | `progetto` | `titolo`, `stato`, `obiettivo`, `contenuto` (Markdown), `versione`, `versioni` |
| ogni area | `consiglio` | `titolo`, `data`, `priorita` (1 = il più importante), `azione`, `perche`, `stato`, `origine` |
| `sistema` | `scadenza` | `titolo`, `data`, `zona`, `ripeti`, `stato`, `nota` |
| cartella personalizzata | `voce` | `titolo`, `data`, `categoria`, `valore`, `unita`, `nota` |

### Task e Gestione mail

Le pagine **Task** (cose da fare) e **Gestione mail** hanno le stesse tre liste, come Google Task: Oggi, Coda, Archivio, ordinate per priorità e poi per data. `lista_dal` è il giorno in cui la voce è stata messa nella lista. Un task in Coda o in Archivio passa da solo in Oggi quando arriva la scadenza, salvo che sia stato spostato dopo; le mail restano dove sono. Il vecchio valore `Domani` vale come `Coda`. La scadenza si mette dal calendario sulla riga del task. Il pulsante "Aggiungi al calendario" mette `calendario: true` ("Togli dal calendario" lo mette a `false`); gli eventi nel calendario Google dedicato li crea, sposta e toglie Claude all'aggiornamento (`evento_id`, `evento_data`, `evento_titolo`). La pagina non chiama Google e mostra lo stato. Le mail le carica Claude da Gmail.

### Indici

Regole in `src/08b-punteggio.js`, visibili nella pagina. Cambiare una regola cambia l'indice di tutto lo storico.

- **Indice di salute**: esami 25%, sonno 20%, recupero 20%, attività 20% (passi e sedute delle cartelle Sport), composizione corporea 15%.
- **Indice finanziario**: risparmio 35% (100 dal 20% delle entrate in su, ultimi 3 mesi completi), riserva 35% (100 da 6 mesi di spesa coperti dalla liquidità), debiti 15% (rate mensili pagate o dichiarate, la più alta; 100 fino al 10% delle entrate, 0 dal 50%), tetti di spesa 15% (categorie rispettate nell'ultimo mese completo). Giroconti, investimenti e partecipazioni, prestiti ricevuti sono esclusi.

I dati Garmin non stanno in `archivio.json`: sono in `garmin/AAAA.csv` (`data;tipo;metrica;valore;unita`) e la pagina li mostra come voci `sensore` o `corpo` di sola lettura.

## Modificare la pagina

Sorgenti in `src/`, numerati nell'ordine in cui vengono uniti; `python3 costruisci.py` rigenera `index.html`.
Prima di pubblicare: `python3 prove/prova.py` deve finire con "TUTTO OK" (usa dati inventati e un GitHub simulato).
Per aggiungere un'area o un tipo di voce si modifica solo `src/05-schema.js`.
