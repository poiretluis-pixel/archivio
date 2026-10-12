# Pagina dell'archivio: istruzioni per Claude

Codice della pagina dell'archivio personale di Luis Poiret. I dati sono nel repository privato `archivio-dati` dello stesso utente (`poiretluis-pixel`): istruzioni nel suo CLAUDE.md.
Questo repository è **pubblico**: mai dati personali, nemmeno nelle prove o nei messaggi di commit.
Il programma deriva da ArchivioGhessa di Lorenzo Ghessa: le migliorie generali si possono proporre anche a lui, ma qui si lavora solo su questa copia.

## Lavorare qui
- Sorgenti in `src/` (numerati, uniti in quest'ordine). `python3 costruisci.py` rigenera `index.html`: committare sempre sorgenti e `index.html` insieme.
- Prima di ogni push: `python3 prove/prova.py /tmp/schermate` deve finire con "TUTTO OK". Guardare le schermate dopo modifiche grafiche (anche a larghezza telefono). Aggiungere un controllo alla prova per ogni funzione nuova.
- GitHub Pages pubblica da `main`, radice, all'indirizzo https://poiretluis-pixel.github.io/archivio/: ogni push è online in 1-2 minuti.

## Regole
- Nessuna libreria esterna, nessuna chiamata di rete oltre a `api.github.com`.
- Il testo dei dati va inserito nella pagina sempre come testo (funzioni `h` e `s`), mai come HTML.
- Non cambiare il significato dei campi esistenti. Un cambiamento incompatibile del formato richiede `archivio-vita/2` e la conversione automatica della versione 1.
- La forma di `archivio.json` (funzione `serializza`) deve restare identica a quella di `strumenti/archivio.py` nel repository dei dati.
- Lingua dell'interfaccia: italiano; nei titoli solo la prima parola maiuscola; niente parole inglesi quando esiste l'equivalente italiano; incisi con le virgole, non con i trattini.
