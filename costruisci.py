#!/usr/bin/env python3
"""Unisce i sorgenti in un solo index.html senza dipendenze esterne."""
import pathlib, datetime, urllib.parse, hashlib
qui = pathlib.Path(__file__).parent
js = "\n".join(p.read_text(encoding="utf-8") for p in sorted((qui / "src").glob("*.js")))
css = (qui / "src" / "stile.css").read_text(encoding="utf-8")
icona = "data:image/svg+xml," + urllib.parse.quote((qui / "icone" / "logo.svg").read_text(encoding="utf-8").strip(), safe=" =:/'")
# La versione è l'impronta dei sorgenti: la pagina la confronta con versione.txt e, se online ce n'è una nuova, si ricarica da sola.
versione = hashlib.sha256((js + css + icona).encode("utf-8")).hexdigest()[:12]
js = f"const VERSIONE_PAGINA = '{versione}';\n" + js
html = f"""<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#3f5b3a">
<meta name="apple-mobile-web-app-title" content="Life Planning">
<title>Life Planning</title>
<link rel="icon" href="{icona}">
<link rel="apple-touch-icon" href="icone/apple-touch-icon.png">
<!-- Versione costruita il {datetime.date.today().isoformat()}. Sorgenti e formato dei dati: vedi LEGGIMI.md -->
<style>
{css}</style>
</head>
<body>
<div id="app"></div>
<noscript>Questa pagina ha bisogno di JavaScript per decifrare i dati.</noscript>
<script>
{js}
</script>
</body>
</html>
"""
(qui / "index.html").write_text(html, encoding="utf-8")
(qui / "versione.txt").write_text(versione + "\n", encoding="utf-8")
print("index.html:", len(html.encode()) // 1024, "kB, versione", versione)
