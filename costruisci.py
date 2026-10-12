#!/usr/bin/env python3
"""Unisce i sorgenti in un solo index.html senza dipendenze esterne."""
import pathlib, datetime
qui = pathlib.Path(__file__).parent
js = "\n".join(p.read_text(encoding="utf-8") for p in sorted((qui / "src").glob("*.js")))
css = (qui / "src" / "stile.css").read_text(encoding="utf-8")
icona = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230d5c57'/%3E%3Cpath d='M18 46V22a4 4 0 0 1 4-4h8l4 5h8a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z' fill='%23fff'/%3E%3C/svg%3E"
html = f"""<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#0d5c57">
<title>Archivio</title>
<link rel="icon" href="{icona}">
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
print("index.html:", len(html.encode()) // 1024, "kB")
