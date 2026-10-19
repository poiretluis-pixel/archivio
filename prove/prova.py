#!/usr/bin/env python3
"""Prova completa della pagina in un browser vero, con un GitHub simulato e dati inventati.

    python3 prove/prova.py [cartella_schermate]

Serve Playwright con Chromium. Termina con "TUTTO OK" oppure con l'elenco dei controlli falliti.
Da eseguire dopo ogni modifica e prima di ogni pubblicazione.
"""
import asyncio, base64, datetime as dt, functools, hashlib, http.server, json, pathlib, re, sys, threading
from playwright.async_api import async_playwright

RADICE = pathlib.Path(__file__).resolve().parent.parent
SCHERMATE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
UTENTE, REPO, TOKEN = "prova", "dati", "TOKEN-GIUSTO"
FRASE = "frase di prova abbastanza lunga"
fallimenti, errori_console = [], []


def controlla(cond, cosa):
    print(("ok   " if cond else "FAIL ") + cosa)
    if not cond:
        fallimenti.append(cosa)


def serializza(A):
    d = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
    testa = ["{", f' "schema": {d(A["schema"])},', f' "meta": {d(A["meta"])},', f' "impostazioni": {d(A["impostazioni"])},']
    liste = []
    for n in ["persone", "voci", "allegati", "aree", "registro"]:
        el = sorted(A[n], key=lambda x: x["id"])
        liste.append(f' "{n}": [' + ("\n" + ",\n".join("  " + d(x) for x in el) + "\n ]" if el else "]"))
    return "\n".join(testa) + "\n" + ",\n".join(liste) + "\n}\n"


def mesi_completi(oggi, quanti):
    y, m, out = oggi.year, oggi.month, []
    for _ in range(quanti):
        m -= 1
        if m < 1:
            m, y = 12, y - 1
        out.insert(0, f"{y}-{m:02d}")
    return out


def voci_nuove(T, oggi):
    """Finanze, organizzazione, sport, mindfulness e lettura: 3 mesi di movimenti con un giroconto che non deve contare."""
    v, n = [], 0
    def add(**x):
        nonlocal n
        n += 1
        v.append({"id": f"n-{n:03d}", "persona": "mario", "creato": T, "agg": T, **x})
    for k in mesi_completi(oggi, 3):
        add(area="finanze", tipo="movimento", data=k + "-05", descrizione="Compenso", categoria="Compensi e stipendio", valore=5000, conto="BPM personale")
        add(area="finanze", tipo="movimento", data=k + "-10", descrizione="Affitto", categoria="Casa", valore=-1500, conto="BPM famiglia")
        add(area="finanze", tipo="movimento", data=k + "-12", descrizione="Cene", categoria="Ristoranti e bar", valore=-600, conto="BPM personale")
        add(area="finanze", tipo="movimento", data=k + "-22", descrizione="Capitale sociale", categoria="Investimenti e partecipazioni", valore=-3000, conto="BPM personale")
        add(area="finanze", tipo="movimento", data=k + "-23", descrizione="Prestito", categoria="Prestiti ricevuti", valore=4000, conto="BPM personale")
        add(area="finanze", tipo="movimento", data=k + "-20", descrizione="Rata finanziamento", categoria="Rate e finanziamenti", valore=-1000, conto="BPM personale")
        add(area="finanze", tipo="movimento", data=k + "-15", descrizione="Bonifico al conto famiglia", categoria="Giroconto", valore=-2000, conto="BPM personale")
        add(area="finanze", tipo="movimento", data=k + "-15", descrizione="Bonifico dal conto personale", categoria="Giroconto", valore=2000, conto="BPM famiglia")
    add(area="finanze", tipo="budget", data="2026-01-01", categoria="Ristoranti e bar", valore=400)
    add(area="finanze", tipo="saldo", data=oggi.isoformat(), conto="BPM personale", categoria="Conto corrente", valore=12600)
    add(area="patrimonio", tipo="debito", titolo="Mutuo casa", categoria="Mutuo", valore=150000, rata=900)
    add(area="organizzazione", tipo="obiettivo", data="2026-01-01", titolo="Riserva di 6 mesi", ambito="Finanze", avanzamento=40, stato="attivo")
    add(area="organizzazione", tipo="attivita", data=(oggi - dt.timedelta(days=1)).isoformat(), titolo="Rinnovo assicurazione auto", ambito="Famiglia", priorita="alta", stato="da fare")
    ieri = (oggi - dt.timedelta(days=1)).isoformat()
    add(area="organizzazione", tipo="attivita", data=oggi.isoformat(), titolo="Chiamare il fornitore", ambito="Lavoro", lista="Domani", lista_dal=ieri, priorita="media", stato="da fare")
    v.append({"id": "n-senza-data", "persona": "mario", "creato": T, "agg": T, "area": "organizzazione", "tipo": "attivita", "titolo": "Task senza scadenza", "casella": "Psiche e Soma", "lista": "Archivio", "lista_dal": ieri, "priorita": "media", "stato": "da fare"})
    add(area="organizzazione", tipo="attivita", data=oggi.isoformat(), titolo="Report settimanale", casella="3MEDical Pioltello", ripeti="ogni settimana", lista="Coda", lista_dal=oggi.isoformat(), priorita="media", stato="da fare")
    add(area="organizzazione", tipo="attivita", data=oggi.isoformat(), titolo="Potare le rose", ambito="Personale", casella="GIARDINO", lista="Oggi", lista_dal=oggi.isoformat(), priorita="media", stato="da fare")
    add(area="organizzazione", tipo="attivita", titolo="Montare la mensola", ambito="Personale", casella="CASA", lista="Coda", lista_dal=ieri, priorita="bassa", stato="da fare")
    add(area="organizzazione", tipo="sito", titolo="Gestionale di prova", link="https://gestionale.example.com/accesso", categoria="Gestionali", casella="3MEDical Pioltello")
    add(area="organizzazione", tipo="sito", titolo="Banca di prova", link="https://banca.example.com", categoria="Banche e pagamenti", casella="Personale", nota="Accesso con l'app")
    add(area="organizzazione", tipo="sito", titolo="Sito sbagliato", link="javascript:alert(1)", categoria="Altro")
    add(area="organizzazione", tipo="attivita", titolo="Idea da riprendere", ambito="Lavoro", lista="Archivio", lista_dal=ieri, priorita="bassa", stato="da fare")
    add(area="organizzazione", tipo="mail", data=ieri, titolo="Documenti per il trimestre", mittente="Studio prova", casella="3MEDical Pioltello", lista="Oggi", lista_dal=ieri, priorita="alta", stato="da gestire", azione="Mandare gli estratti conto.", link="https://mail.google.com/mail/#all/prova1")
    add(area="organizzazione", tipo="mail", data=ieri, titolo="Locandina da pubblicare", mittente="Segreteria prova", casella="Personale", lista="Coda", lista_dal=ieri, priorita="media", stato="da gestire", link="javascript:alert(1)")
    add(area="sport", tipo="attivita", data=(oggi - dt.timedelta(days=2)).isoformat(), disciplina="Padel", minuti=90, intensita="moderata")
    add(area="mindfulness", tipo="pratica", data=oggi.isoformat(), pratica="Meditazione", minuti=10, umore=4)
    add(area="lettura", tipo="libro", titolo="Libro di prova", autore="Autore", stato="in lettura", data="2026-09-01")
    return v


def repo_iniziale():
    T = "2026-01-01T10:00:00.000Z"
    oggi = dt.date.today()
    A = {"schema": "archivio-vita/1", "meta": {"creato": T, "aggiornato": T}, "impostazioni": {"agg": T, "blocco_min": 15},
         "persone": [{"id": "mario", "nome": "Mario Rossi", "nascita": "1990-01-01", "ruolo": "titolare", "creato": T, "agg": T}],
         "voci": [
             {"id": "m-1", "area": "salute", "tipo": "misura", "persona": "mario", "data": "2026-01-10", "categoria": "Rene", "parametro": "Creatinina", "valore": 1.3, "unita": "mg/dL", "rif_min": 0.7, "rif_max": 1.2, "fuori": True, "laboratorio": "Lab A", "doc": "d-1", "creato": T, "agg": T},
             {"id": "m-2", "area": "salute", "tipo": "misura", "persona": "mario", "data": "2026-05-10", "categoria": "Rene", "parametro": "Creatinina", "valore": 1.1, "unita": "mg/dL", "rif_min": 0.7, "rif_max": 1.2, "laboratorio": "Lab A", "creato": T, "agg": T},
             {"id": "m-3", "area": "salute", "tipo": "misura", "persona": "mario", "data": "2026-05-10", "categoria": "Lipidi", "parametro": "Colesterolo LDL", "valore": 160, "unita": "mg/dL", "rif_max": 115, "creato": T, "agg": T},
             {"id": "a-1", "area": "sport", "tipo": "allenamento", "persona": "mario", "data": (oggi - dt.timedelta(days=3)).isoformat(), "scheda": "Scheda prova", "seduta": "Sessione 1", "serie": 18, "dettaglio": "Squat 5×5 @8, 100 kg", "stimato": True, "creato": T, "agg": T},
             {"id": "x-1", "area": "sport", "tipo": "massimale", "persona": "mario", "data": "2026-05-01", "esercizio": "Squat", "valore": 140, "creato": T, "agg": T},
             {"id": "k-1", "area": "salute", "tipo": "consiglio", "persona": "mario", "data": "2026-05-11", "titolo": "Secondo consiglio", "priorita": 2, "stato": "da fare", "creato": T, "agg": T},
             {"id": "k-2", "area": "salute", "tipo": "consiglio", "persona": "mario", "data": "2026-05-11", "titolo": "Primo consiglio", "priorita": 1, "azione": "Fare questo.", "perche": "Per questo.", "stato": "da fare", "creato": T, "agg": T},
             {"id": "k-3", "area": "salute", "tipo": "consiglio", "persona": "mario", "data": "2026-05-11", "titolo": "Consiglio seguito", "priorita": 3, "stato": "fatto", "creato": T, "agg": T},
             {"id": "c-1", "area": "salute", "tipo": "corpo", "persona": "mario", "data": "2026-05-11", "metrica": "Altezza", "valore": 180, "unita": "cm", "creato": T, "agg": T},
             {"id": "c-2", "area": "salute", "tipo": "corpo", "persona": "mario", "data": "2026-05-11", "metrica": "Circonferenza vita", "valore": 85, "unita": "cm", "creato": T, "agg": T},
             {"id": "c-3", "area": "salute", "tipo": "corpo", "persona": "mario", "data": "2026-05-11", "metrica": "Massa grassa", "valore": 18, "unita": "%", "creato": T, "agg": T},
             {"id": "o-1", "area": "salute", "tipo": "osservazione", "persona": "mario", "data": "2026-05-11", "titolo": "LDL alto", "testo": "Da discutere col medico.", "priorita": "alta", "stato": "aperta", "creato": T, "agg": T},
         ] + voci_nuove(T, oggi),
         "allegati": [{"id": "d-1", "nome": "referto.pdf", "mime": "application/pdf", "dim": 20, "area": "salute", "persona": "mario", "data": "2026-01-10", "stato": "elaborato", "file": "documenti/d-1.pdf", "creato": T, "agg": T}],
         "aree": [], "registro": []}
    righe = ["data;tipo;metrica;valore;unita"]
    for i in range(10):
        d = (oggi - dt.timedelta(days=9 - i)).isoformat()
        righe += [f"{d};sensore;Frequenza cardiaca a riposo;{52 + i % 3};bpm", f"{d};sensore;Passi;{8000 + 100 * i};passi", f"{d};sensore;Punteggio del sonno;{75 + i};", f"{d};sensore;Stress medio;{30 + i};"]
    righe.append(f"{oggi.isoformat()};corpo;Peso;78.4;kg")
    stato = {"esito": "ok", "ultimo_avvio": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "righe": 41, "ultima_data": oggi.isoformat(), "metriche": ["Passi", "Peso"]}
    return {
        "archivio.json": serializza(A).encode(),
        "documenti/d-1.pdf": b"%PDF-1.4 finto referto",
        f"garmin/{oggi.year}.csv": ("\n".join(righe) + "\n").encode(),
        "garmin/stato.json": json.dumps(stato).encode(),
        "rapporti/2026-09.md": "# Rapporto di settembre 2026\n\nIn breve: **tutto stabile**.\n\n## Cosa fare\n\n- Ripetere LDL\n- Camminare\n\n| Metrica | Valore |\n|---|---|\n| Passi | 8.500 |\n".encode(),
    }


repo = repo_iniziale()
sha = lambda b: hashlib.sha1(b).hexdigest()


async def github(route):
    rq = route.request
    H = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    m = re.match(rf"https://api\.github\.com/repos/{UTENTE}/{REPO}/contents/([^?]*)", rq.url)
    if rq.headers.get("authorization") != "Bearer " + TOKEN:
        return await route.fulfill(status=401, headers=H, body="{}")
    if rq.url == f"https://api.github.com/repos/{UTENTE}/{REPO}":
        return await route.fulfill(status=200, headers=H, body="{}")
    if not m:
        return await route.fulfill(status=404, headers=H, body="{}")
    p = m.group(1)
    if rq.method == "GET":
        if p in repo:
            c = repo[p]
            if "raw" in rq.headers.get("accept", ""):
                return await route.fulfill(status=200, headers={**H, "Content-Type": "application/octet-stream"}, body=c)
            return await route.fulfill(status=200, headers=H, body=json.dumps({"sha": sha(c), "type": "file", "content": base64.b64encode(c).decode() if len(c) < 1_000_000 else ""}))
        figli = [k for k in repo if k.startswith(p + "/") and "/" not in k[len(p) + 1:]]
        if figli:
            return await route.fulfill(status=200, headers=H, body=json.dumps([{"name": k.split("/")[-1], "sha": sha(repo[k]), "type": "file"} for k in figli]))
        return await route.fulfill(status=404, headers=H, body="{}")
    corpo = json.loads(rq.post_data)
    if rq.method == "PUT":
        if (p in repo) != bool(corpo.get("sha")) or (p in repo and corpo["sha"] != sha(repo[p])):
            return await route.fulfill(status=409, headers=H, body="{}")
        repo[p] = base64.b64decode(corpo["content"])
        return await route.fulfill(status=200, headers=H, body="{}")
    if rq.method == "DELETE":
        repo.pop(p, None)
        return await route.fulfill(status=200, headers=H, body="{}")


def avvia_server():
    class Silenzioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    gestore = functools.partial(Silenzioso, directory=str(RADICE))
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), gestore)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{s.server_address[1]}/index.html"


async def scatta(pg, nome, intera=True):
    if SCHERMATE:
        SCHERMATE.mkdir(parents=True, exist_ok=True)
        await pg.screenshot(path=str(SCHERMATE / f"{nome}.png"), full_page=intera)


async def main():
    URL = avvia_server()
    async with async_playwright() as p:
        b = await p.chromium.launch()

        async def dispositivo(w, h):
            ctx = await b.new_context(viewport={"width": w, "height": h}, accept_downloads=True)
            await ctx.route("https://api.github.com/**", github)
            pg = await ctx.new_page()
            pg.on("console", lambda m: errori_console.append(m.text) if m.type == "error" and not re.search(r"40[149]|409", m.text) else None)
            pg.on("pageerror", lambda e: errori_console.append("ERRORE PAGINA " + str(e)))
            pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(URL)
            await pg.wait_for_selector(".blocco")
            return pg

        async def collega(pg, token=TOKEN):
            await pg.click("text=Collega il mio archivio")
            await pg.fill("[name=proprietario]", UTENTE)
            await pg.fill("[name=repo]", REPO)
            await pg.fill("[name=token]", token)
            await pg.fill("[name=frase]", FRASE)
            await pg.fill("[name=ripeti]", FRASE)
            await pg.fill("[name=promemoria]", "Domanda di prova")
            await pg.click("text=Collega e apri")

        sincronizza = lambda pg: pg.evaluate("sincronizza(false)")

        # --- dispositivo A: primo collegamento
        A = await dispositivo(1280, 900)
        await scatta(A, "01-benvenuto", False)
        await collega(A, "TOKEN-SBAGLIATO")
        await A.wait_for_function("document.querySelector('.errore') && document.querySelector('.errore').textContent.length > 0")
        controlla("token" in (await A.inner_text(".errore")).lower(), "token errato: messaggio chiaro")
        await A.fill("[name=token]", TOKEN)
        await A.click("text=Collega e apri")
        await A.wait_for_selector("h1:has-text('Quadro generale')")
        await A.wait_for_function("S.sync.stato === 'ok'")
        N0 = len(json.loads(repo["archivio.json"])["voci"])
        controlla(await A.evaluate("S.A.voci.length") == N0, "archivio scaricato dal repository")
        controlla(await A.evaluate("S.estVoci.length") == 41, "dati Garmin letti dal repository (41 righe)")
        ind = await A.evaluate("(i => i && {v: i.valore, k: Object.keys(i.componenti)})(indiceSalute())")
        controlla(ind and 0 < ind["v"] <= 100 and sorted(ind["k"]) == ["attivita", "corpo", "esami", "recupero", "sonno"], f"indice di salute con cinque componenti {ind}")
        controlla(await A.locator(".scheda:has-text('Indice di salute')").count() == 1 and await A.locator("section:has(h2:has-text('Consigli principali')) li").count() == 2, "quadro generale: indice e consigli principali")
        controlla(await A.locator("text=Rapporto di settembre 2026").count() > 0, "ultimo rapporto in prima pagina")
        controlla(await A.locator("text=Scaricamento Garmin non ancora attivo").count() == 0, "Garmin risulta attivo")
        await scatta(A, "02-quadro")
        await A.goto(URL + "#/rapporti")
        controlla(await A.locator("article table td:has-text('8.500')").count() == 1 and await A.locator("article strong:has-text('tutto stabile')").count() == 1, "rapporto mostrato con tabella e grassetto")
        await A.goto(URL + "#/a/salute")
        await A.wait_for_timeout(300)
        await scatta(A, "03-salute")
        controlla(await A.locator("section:has(h2:has-text('Dati del dispositivo')) .grafico svg").count() == 1, "grafico dei dati Garmin")
        controlla(await A.locator("section.indice svg.anello").count() == 1 and await A.locator("section.indice .componente").count() == 5, "situazione del corpo: anello e cinque componenti")
        primi = await A.locator("section:has(h2:has-text('Consigli in ordine')) li strong").all_inner_texts()
        controlla(primi == ["Primo consiglio", "Secondo consiglio"], f"consigli ordinati per priorità, senza quelli seguiti {primi}")
        # --- finanze: indice, giroconti esclusi, tetti di spesa
        fin = await A.evaluate("(i => i && {v: i.valore, k: Object.keys(i.componenti), r: i.componenti.risparmio.punti, b: i.componenti.budget.punti})(indiceFinanze())")
        controlla(fin and sorted(fin["k"]) == ["budget", "debiti", "riserva", "risparmio"], f"indice finanziario con quattro componenti {fin}")
        controlla(fin and abs(fin["r"] - 100) < 1e-6 and fin["b"] == 0, f"risparmio 38% (giroconti, investimenti e prestiti esclusi) e tetto ristoranti sforato {fin}")
        deb = await A.evaluate("indiceFinanze().componenti.debiti.punti")
        controlla(abs(deb - 75) < 1e-6, f"rate pagate (1.000 €) prevalgono su quelle dichiarate (900 €): 20% delle entrate, 75 punti {deb}")
        await A.goto(URL + "#/a/finanze")
        await A.wait_for_timeout(300)
        await scatta(A, "04-finanze")
        controlla(await A.locator("section.indice:has(h2:has-text('Salute finanziaria')) .componente").count() == 4, "finanze: pannello dell'indice con quattro componenti")
        controlla(await A.locator("section:has(h2:has-text('Tetti di spesa')) li:has-text('Ristoranti e bar')").count() == 1, "finanze: tetti di spesa")
        controlla(await A.locator("section:has(h2:has-text('Uscite per categoria')) :text('Giroconto')").count() == 0, "i giroconti non compaiono tra le uscite")
        # --- sport, organizzazione, mindfulness, lettura
        await A.goto(URL + "#/a/sport")
        await A.wait_for_timeout(300)
        await scatta(A, "05-sport")
        sez = A.locator("section:has(h2:has-text('Sedute da scheda'))")
        controlla(await sez.locator(".grafico svg").count() == 1 and await sez.locator("td:has-text('Scheda prova')").count() == 1 and await sez.locator("td:has-text('140')").count() == 1 and await sez.locator("td:has-text('sì')").count() == 1, "sport: grafico, sedute e massimali")
        controlla(await A.locator("section:has(h2:has-text('Ultime attività')) td:has-text('Padel')").count() == 1, "sport: attività registrate")
        for area_, testo, nome in [("organizzazione", "Riserva di 6 mesi", "06-organizzazione"), ("mindfulness", "Meditazione", "07-mindfulness"), ("lettura", "Libro di prova", "08-lettura")]:
            await A.goto(URL + "#/a/" + area_)
            await A.wait_for_timeout(300)
            await scatta(A, nome)
            controlla(await A.locator(f"#vista :text('{testo}')").count() >= 1 and await A.locator("#vista .errore").count() == 0, f"cartella {area_} mostrata")
        await A.goto(URL + "#/a/mindfulness")
        await A.wait_for_timeout(200)
        controlla(await A.locator("#vista .dato:has-text('Stress medio Garmin')").count() == 1, "mindfulness: stress dal Garmin")
        await A.goto(URL + "#/")
        await A.wait_for_timeout(200)
        controlla(await A.locator("li:has-text('Rinnovo assicurazione auto')").count() == 1, "quadro generale: cose da fare in ritardo")
        controlla(await A.locator("li:has-text('Mail: Documenti per il trimestre')").count() == 1, "quadro generale: mail di oggi")
        # --- Task e Gestione mail: due pagine con Oggi, Coda, Archivio
        await A.goto(URL + "#/task")
        await A.wait_for_timeout(300)
        await scatta(A, "09-task")
        schede = await A.locator("nav.schede a").all_inner_texts()
        controlla([x.split()[0] for x in schede] == ["Oggi", "Coda", "Archivio", "Tutti"] and await A.locator("nav.schede a.attiva").inner_text() == "Oggi\n2" and await A.locator("#vista li.lavoro").count() == 2 and await A.locator("#vista section h2").count() == 0, f"schede in alto, si apre su Oggi {schede}")
        await A.click("nav.schede a:has-text('Archivio')")
        await A.wait_for_timeout(200)
        controlla(A.url.endswith("#/task/archivio") and await A.locator("#vista li.lavoro").count() == 2 and await A.locator("li:has-text('Idea da riprendere')").count() == 1, "scheda Archivio")
        controlla(await A.locator("li:has-text('Task senza scadenza') .etichetta.e-arancione").inner_text() == "Psiche e Soma", "etichetta colorata di chi riguarda il task")
        await A.goto(URL + "#/task/tutti")
        oggi_ = dt.date.today()
        await A.wait_for_timeout(300)
        titoli = await A.locator("section:has(h2:has-text('Oggi')) li strong").all_inner_texts()
        controlla(titoli == ["Rinnovo assicurazione auto", "Chiamare il fornitore"], f"Task, Oggi: priorità alta in cima, vecchio Domani con scadenza oggi passato a oggi, nessuna mail {titoli}")
        controlla(await A.locator("section:has(h2:has-text('Archivio')) li:has-text('Idea da riprendere')").count() == 1 and await A.locator("#vista li[data-tipo=mail]").count() == 0, "Task: archivio, senza mail")
        riga = A.locator("li:has-text('Task senza scadenza')")
        controlla(await riga.locator("button:has-text('Aggiungi al calendario')").count() == 0, "senza scadenza nessun pulsante per il calendario")
        await riga.locator("input[type=date]").fill("2026-12-01")
        await A.wait_for_timeout(200)
        r = A.locator("li:has-text('Task senza scadenza')")
        controlla(await A.evaluate("S.A.voci.find(v => v.titolo === 'Task senza scadenza').data") == "2026-12-01" and await r.locator("button:has-text('Aggiungi al calendario')").count() == 1 and await r.locator(":text('calendario TASK')").count() == 0, "scadenza dal calendario della riga, fuori dal calendario finché non lo chiedi")
        await r.locator("button:has-text('Aggiungi al calendario')").click()
        await A.wait_for_timeout(200)
        r = A.locator("li:has-text('Task senza scadenza')")
        controlla(await A.evaluate("S.A.voci.find(v => v.titolo === 'Task senza scadenza').calendario") is True and await r.locator(":text('entra nel calendario')").count() == 1, "Aggiungi al calendario: richiesta registrata")
        await A.evaluate("(v => metti({...v, evento_id: 'e1', evento_data: '2026-12-01'}))(S.A.voci.find(v => v.titolo === 'Task senza scadenza'))")
        await A.wait_for_timeout(200)
        r = A.locator("li:has-text('Task senza scadenza')")
        controlla(await r.locator(":text('nel calendario TASK')").count() == 1 and await r.locator("button:has-text('Togli dal calendario')").count() == 1, "task nel calendario TASK, con il pulsante per toglierlo")
        await r.locator("button:has-text('Togli dal calendario')").click()
        await A.wait_for_timeout(200)
        controlla(await A.locator("li:has-text('Task senza scadenza') :text('esce dal calendario')").count() == 1, "Togli dal calendario: uscita registrata")
        await A.locator("li:has-text('Task senza scadenza') input[type=date]").fill("")
        await A.wait_for_timeout(200)
        controlla(await A.evaluate("!('data' in S.A.voci.find(v => v.titolo === 'Task senza scadenza'))"), "scadenza tolta")
        controlla(await A.locator("section:has(h2:has-text('Archivio')) li:has-text('Task senza scadenza')").count() == 1 and await A.locator("#vista .errore").count() == 0, "task senza scadenza in archivio, senza errori")
        rr = A.locator("li:has-text('Report settimanale')")
        controlla(await rr.locator(":text('si ripete ogni settimana')").count() == 1, "task ricorrente indicato")
        await rr.locator("button:has-text('Fatta')").click()
        await A.wait_for_timeout(200)
        rep = await A.evaluate("(v => ({d: v.data, l: v.lista, s: v.stato}))(S.A.voci.find(v => v.titolo === 'Report settimanale'))")
        settimana = (oggi_ + dt.timedelta(days=7)).isoformat()
        controlla(rep == {"d": settimana, "l": "Coda", "s": "da fare"} and await A.locator("section:has(h2:has-text('Coda')) li:has-text('Report settimanale')").count() == 1, f"task ricorrente fatto: torna in Coda con la scadenza della settimana dopo {rep}")
        prox = await A.evaluate("[prossimaRipetizione({ripeti: 'ogni mese', data: '2026-01-31'}) > oggi(), passoRipeti('2026-10-16', 'nei giorni lavorativi'), passoRipeti('2026-01-31', 'ogni mese')]")
        controlla(prox == [True, "2026-10-19", "2026-02-28"], f"calcolo delle ripetizioni: dopo oggi, salta il fine settimana, fine mese {prox}")
        gruppi = await A.locator(".menu .menu-gruppo").all_text_contents()
        controlla(gruppi == ["Lavoro", "Personale", "Archivio"] and await A.locator(".menu-gruppo:has-text('Lavoro') + a[href='#/task'] + a[href='#/mail']").count() == 1, f"menu con i gruppi Lavoro e Personale {gruppi}")
        controlla(await A.locator(".menu a[href='#/task'] .conta").inner_text() == "2" and await A.locator(".menu a[href='#/mail'] .conta").inner_text() == "1", "il menu conta task e mail di oggi separatamente")
        await A.click("li:has-text('Idea da riprendere') >> button:has-text('In oggi')")
        controlla(await A.locator("section:has(h2:has-text('Oggi')) li:has-text('Idea da riprendere')").count() == 1, "spostamento dall'archivio a oggi")
        await A.goto(URL + "#/mail/tutti")
        await A.wait_for_timeout(300)
        await scatta(A, "09-mail")
        controlla(await A.locator("li:has-text('Documenti per il trimestre') .etichetta.e-blu").count() == 1 and await A.locator("li:has-text('Locandina da pubblicare') .etichetta.e-rosso").count() == 1, "Pioltello blu, Personale rosso")
        controlla(await A.locator("h1:has-text('Gestione mail')").count() == 1 and await A.locator("#vista li[data-tipo=attivita]").count() == 0, "Gestione mail: solo mail")
        controlla(await A.locator("section:has(h2:has-text('Oggi')) li:has-text('Documenti per il trimestre')").count() == 1 and await A.locator("section:has(h2:has-text('Coda')) li:has-text('Locandina da pubblicare')").count() == 1, "Gestione mail: Oggi e Coda, una mail in coda da ieri resta in coda")
        controlla(await A.locator("a:has-text('Apri in Gmail')").count() == 1 and await A.locator("a[href^='javascript']").count() == 0, "collegamento a Gmail solo se è davvero di Gmail")
        await A.click("button.filtro:has-text('3MEDical Pioltello')")
        controlla(await A.locator("#vista li.lavoro").count() == 1, "filtro per casella")
        await A.click("button.filtro:has-text('Tutto')")
        await A.click("li:has-text('Documenti per il trimestre') >> button:has-text('Gestita')")
        controlla(await A.locator("li:has-text('Documenti per il trimestre')").count() == 0 and await A.evaluate("S.A.voci.find(v => v.titolo === 'Documenti per il trimestre').stato") == "gestita", "mail segnata come gestita")
        await A.goto(URL + "#/siti")
        await A.wait_for_timeout(300)
        await scatta(A, "09-siti")
        controlla(await A.locator(".menu-gruppo:has-text('Lavoro') + a[href='#/task'] + a[href='#/mail'] + a[href='#/siti']").count() == 1 and await A.locator("h1:has-text('Siti e gestionali')").count() == 1, "pagina Siti e gestionali sotto Lavoro")
        g = A.locator("section:has(h2:has-text('Gestionali')) a.sito-link")
        controlla(await g.get_attribute("href") == "https://gestionale.example.com/accesso" and await g.get_attribute("target") == "_blank" and "noopener" in (await g.get_attribute("rel")), "collegamento che si apre in una scheda nuova")
        controlla(await A.locator("li.sito:has-text('Banca di prova') .etichetta.e-rosso").count() == 1 and await A.locator("a[href^='javascript']").count() == 0 and await A.locator("li.sito:has-text('Sito sbagliato') :text('Indirizzo non valido')").count() == 1, "etichette e solo indirizzi https")
        # --- Organizzazione: task personali con le etichette CASA, GIARDINO e PROGETTI, fuori dalla pagina Task
        controlla(await A.locator("li:has-text('Potare le rose')").count() == 0 and await A.locator("li:has-text('Montare la mensola')").count() == 0, "i task personali non sono nella pagina Task")
        await A.goto(URL + "#/a/organizzazione")
        await A.wait_for_timeout(300)
        await scatta(A, "06-organizzazione-task")
        controlla(await A.locator("h1:has-text('Organizzazione')").count() == 1 and await A.locator("nav.schede a.attiva").inner_text() == "Oggi\n1" and await A.locator("#vista li.lavoro").count() == 1, "Organizzazione si apre su Oggi con i soli task personali")
        controlla(await A.locator("li:has-text('Potare le rose') .etichetta.e-verde").inner_text() == "GIARDINO" and await A.locator("li:has-text('Rinnovo assicurazione auto')").count() == 0, "etichetta GIARDINO verde, niente task di lavoro")
        controlla(await A.locator("button.filtro").all_inner_texts() == ["Tutto", "CASA", "GIARDINO", "PROGETTI"], "filtri CASA, GIARDINO, PROGETTI sempre visibili")
        controlla(await A.locator(".menu a[href='#/a/organizzazione'] .conta").inner_text() == "1" and await A.locator(".menu a[href='#/task'] .conta").inner_text() == "3", "il menu conta i task personali a parte")
        await A.goto(URL + "#/a/organizzazione/coda")
        await A.wait_for_timeout(200)
        controlla(await A.locator("li:has-text('Montare la mensola') .etichetta.e-viola").count() == 1 and await A.locator("nav.schede a.attiva").inner_text() == "Coda\n1", "scheda Coda con il task CASA")
        await A.click("button.filtro:has-text('PROGETTI')")
        await A.click("button:has-text('Aggiungi un task')")
        controlla(await A.locator("[name=casella]").input_value() == "PROGETTI" and await A.locator("[name=ambito]").input_value() == "Personale", "nuovo task con l'etichetta del filtro scelto")
        await A.evaluate("chiudiModale()")
        await A.click("button.filtro:has-text('Tutto')")
        await A.click("li:has-text('Montare la mensola') >> button:has-text('In oggi')")
        controlla(await A.evaluate("S.A.voci.find(v => v.titolo === 'Montare la mensola').lista") == "Oggi", "task personale spostato in Oggi")
        controlla(await A.locator("section:has(h2:has-text('Obiettivi')) :text('Riserva di 6 mesi')").count() == 1 and await A.locator("section:has(h2:has-text('Revisione della settimana'))").count() == 1, "sotto i task restano obiettivi e revisione")
        # --- Passioni: sport, mindfulness, lettura e viaggi sotto una voce sola; nome Life Planning
        voci_menu = await A.locator(".menu a").all_inner_texts()
        controlla("Passioni" in voci_menu and not any(x.startswith(("Sport", "Mindfulness", "Lettura", "Viaggi")) for x in voci_menu), f"una sola voce Passioni nel menu {voci_menu}")
        controlla(await A.locator(".barra .marchio").inner_text() == "Life Planning" and await A.title() == "Life Planning", "il gestionale si chiama Life Planning")
        await A.goto(URL + "#/passioni")
        await A.wait_for_timeout(300)
        await scatta(A, "22-passioni")
        controlla(await A.locator("h1:has-text('Passioni')").count() == 1 and await A.locator(".griglia a.scheda").count() == 4 and await A.locator(".menu a.attiva").inner_text() == "Passioni", "pagina Passioni con le quattro cartelle")
        controlla(await A.locator("a.scheda[href='#/a/lettura'] :text('Libro di prova')").count() == 1, "scheda Lettura con il libro in lettura")
        await A.click("a.scheda[href='#/a/sport']")
        await A.wait_for_timeout(200)
        controlla(await A.locator("h1:has-text('Sport')").count() == 1 and await A.locator(".menu a.attiva").inner_text() == "Passioni" and await A.locator(".briciole a[href='#/passioni']").count() == 1, "Sport si apre da Passioni e il menu resta su Passioni")
        await A.goto(URL + "#/")
        await A.wait_for_timeout(200)
        controlla(await A.locator(".griglia a.scheda[href='#/passioni']").count() == 1 and await A.locator(".griglia a.scheda[href='#/a/sport']").count() == 0, "quadro generale con la scheda Passioni")
        await A.goto(URL + "#/da-fare")
        await A.wait_for_timeout(200)
        controlla(await A.locator("h1:has-text('Task')").count() == 1, "il vecchio indirizzo Da fare apre Task")
        await A.goto(URL + "#/a/salute/sensore")
        await A.click("tbody tr >> nth=0")
        controlla(await A.locator("#modale").count() == 0 and await A.locator(".avviso:has-text('Garmin Connect')").count() == 1, "un dato Garmin non si modifica dalla pagina")
        # documento presente solo nel repository: si scarica al bisogno
        await A.goto(URL + "#/documenti")
        await A.click("tr:has-text('referto.pdf') >> text=Apri")
        await A.wait_for_selector("#modale iframe.visore")
        controlla(True, "documento scaricato dal repository e aperto")
        await A.keyboard.press("Escape")

        # --- modifiche dalla pagina finiscono nel repository, leggibili
        await A.evaluate("metti({area:'finanze',tipo:'saldo',persona:'mario',data:'2026-10-01',conto:'Conto prova',categoria:'Conto corrente',valore:1234.5})")
        await A.goto(URL + "#/documenti")
        async with A.expect_file_chooser() as fc:
            await A.click("text=Scegli i file")
        prova_txt = pathlib.Path(SCHERMATE or "/tmp") / "nota-di-prova.txt"
        prova_txt.write_text("contenuto del documento di prova")
        await (await fc.value).set_files(str(prova_txt))
        await A.wait_for_timeout(400)
        await sincronizza(A)
        testo = repo["archivio.json"].decode()
        controlla("Conto prova" in testo, "il saldo inserito è nel repository in chiaro")
        controlla(testo == serializza(json.loads(testo)), "archivio.json scritto nella forma standard (un elemento per riga)")
        doc = [k for k in repo if k.startswith("documenti/") and k.endswith(".txt")]
        controlla(len(doc) == 1 and repo[doc[0]] == b"contenuto del documento di prova", "documento caricato nel repository identico all'originale")
        controlla(not any(TOKEN.encode() in v for v in repo.values()), "il token non finisce mai nel repository")
        busta = await A.evaluate("kvLeggi('busta').then(b => JSON.stringify(b))")
        controlla(TOKEN not in busta and "Conto prova" not in busta, "sul dispositivo token e dati sono cifrati")

        # --- modifica fatta da Claude direttamente nel repository
        R = json.loads(repo["archivio.json"])
        R["voci"].append({"id": "m-claude", "area": "salute", "tipo": "misura", "persona": "mario", "data": "2026-10-05", "categoria": "Lipidi", "parametro": "Colesterolo LDL", "valore": 120, "unita": "mg/dL", "rif_max": 115, "creato": "2099-01-01T00:00:00.000Z", "agg": "2099-01-01T00:00:00.000Z"})
        repo["archivio.json"] = serializza(R).encode()
        repo["rapporti/2026-10.md"] = b"# Rapporto di ottobre 2026\n\nNuovo."
        await sincronizza(A)
        controlla(await A.evaluate("!!voce('m-claude')"), "la pagina riceve le modifiche fatte da Claude")
        controlla(await A.evaluate("rapporti()[0][0]") == "2026-10.md", "la pagina riceve i nuovi rapporti")

        # --- dispositivo B (telefono) e modifiche contemporanee
        B = await dispositivo(390, 800)
        await collega(B)
        await B.wait_for_selector("#vista")
        await B.wait_for_function("S.sync.stato === 'ok'")
        controlla(await B.evaluate("S.A.voci.filter(v=>!v.canc).length") == N0 + 2, "il telefono vede gli stessi dati")
        await B.evaluate("metti({area:'salute',tipo:'corpo',persona:'mario',data:'2026-10-07',metrica:'Pressione sistolica',valore:120,unita:'mmHg'})")
        await A.evaluate("metti({area:'viaggi',tipo:'viaggio',persona:'mario',data:'2027-04-01',titolo:'Tokyo'})")
        await A.evaluate("togli('voci','o-1')")
        await A.wait_for_timeout(400)
        await B.wait_for_timeout(400)
        await asyncio.gather(sincronizza(A), sincronizza(B))
        for pg in (A, B, A):
            await sincronizza(pg)
        stato_ = "({n: S.A.voci.filter(v=>!v.canc).length, tokyo: S.A.voci.some(v=>v.titolo==='Tokyo'), press: S.A.voci.some(v=>v.metrica==='Pressione sistolica'), o1: !!voce('o-1')})"
        sa, sb = await A.evaluate(stato_), await B.evaluate(stato_)
        controlla(sa == sb and sa["tokyo"] and sa["press"] and not sa["o1"], f"modifiche contemporanee unite su entrambi i dispositivi {sa}")
        for r, n in [("#/", "10-telefono-quadro"), ("#/a/salute", "11-telefono-salute"), ("#/a/finanze", "15-telefono-finanze"), ("#/a/organizzazione", "16-telefono-organizzazione"), ("#/task", "18-telefono-task"), ("#/mail", "19-telefono-mail"), ("#/siti", "21-telefono-siti"), ("#/passioni", "23-telefono-passioni"), ("#/a/sport", "17-telefono-sport"), ("#/rapporti", "12-telefono-rapporti"), ("#/documenti", "13-telefono-documenti"), ("#/impostazioni", "14-telefono-impostazioni")]:
            await B.goto(URL + r)
            await B.wait_for_timeout(300)
            await scatta(B, n)
            controlla(await B.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 0, f"nessuno scorrimento orizzontale sul telefono in {r}")

        # --- blocco, frase sbagliata, frase dimenticata
        await A.click("text=Blocca")
        await A.wait_for_selector(".blocco")
        controlla(await A.evaluate("S.A === null && S.chiave === null"), "dopo il blocco la memoria è svuotata")
        await A.fill("input[name=segreto]", "sbagliata")
        await A.click("button[type=submit]")
        await A.wait_for_function("document.querySelector('.errore') && document.querySelector('.errore').textContent.length > 0")
        await A.fill("input[name=segreto]", FRASE)
        await A.click("button[type=submit]")
        await A.wait_for_selector("#vista")
        controlla(True, "frase sbagliata rifiutata, frase giusta accettata")
        await A.click("text=Blocca")
        await A.click("text=Ho dimenticato la frase")
        await A.get_by_role("button", name="Ricollega il dispositivo").click()
        await A.fill("[name=proprietario]", UTENTE); await A.fill("[name=token]", TOKEN)
        await A.fill("[name=frase]", "frase nuova lunga abbastanza"); await A.fill("[name=ripeti]", "frase nuova lunga abbastanza")
        await A.click("text=Collega e apri")
        await A.wait_for_function("document.querySelector('.errore') && document.querySelector('.errore').textContent.includes('non esiste')")
        controlla(True, "nome del repository sbagliato: messaggio chiaro")
        await A.fill("[name=repo]", REPO)
        await A.click("text=Collega e apri")
        await A.wait_for_selector("#vista")
        await A.wait_for_function("S.sync.stato === 'ok'")
        controlla(await A.evaluate("S.A.voci.some(v=>v.titolo==='Tokyo')"), "frase dimenticata: ricollegato senza perdere dati")
        await A.goto(URL + "#/impostazioni")
        await scatta(A, "20-impostazioni")
        await b.close()

    controlla(not errori_console, f"nessun errore nella console {errori_console}")
    print("\nTUTTO OK" if not fallimenti else f"\n{len(fallimenti)} CONTROLLI FALLITI")
    sys.exit(1 if fallimenti else 0)


asyncio.run(main())
