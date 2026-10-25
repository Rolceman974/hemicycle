<?xml version="1.0" encoding="UTF-8"?>
<!-- Mise en page des flux RSS quand on les ouvre dans un navigateur (au lieu du code XML brut).
     Les lecteurs de flux ignorent ce fichier. -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title><xsl:value-of select="rss/channel/title"/></title>
<style>
@font-face { font-family: Manrope; font-weight: 400; src: url(/fonts/manrope-latin-400-normal.woff2) format("woff2"); }
@font-face { font-family: Manrope; font-weight: 700; src: url(/fonts/manrope-latin-700-normal.woff2) format("woff2"); }
:root { --ink: #121417; --muted: #616975; --rule: #e2e6ea; --soft: #f4f6f8; --accent: #1f43c8; --navy: #0B1F4D; --gold: #F5C400; }
@media (prefers-color-scheme: dark) { :root { --ink: #eceef1; --muted: #a3aab4; --rule: #2a2f36; --soft: #181b20; --accent: #8fa6ff; } body { background: #0f1114; } }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.55 Manrope, system-ui, sans-serif; color: var(--ink); background: #fff; }
.bar { background: var(--navy); color: #fff; padding: 16px 20px; }
.bar a { color: #fff; font-weight: 700; font-size: 20px; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; }
main { max-width: 820px; margin: 0 auto; padding: 28px 20px 48px; }
.note { background: var(--soft); border-radius: 8px; padding: 16px 18px; margin: 0 0 28px; }
.note b { display: block; margin-bottom: 4px; }
.note p { margin: 0; color: var(--muted); }
h1 { font-size: 28px; line-height: 1.2; margin: 0 0 6px; }
.sub { color: var(--muted); margin: 0 0 18px; }
ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
li { padding: 14px 0; border-bottom: 1px solid var(--rule); }
li a { color: var(--ink); font-weight: 700; text-decoration: none; }
li a:hover { color: var(--accent); text-decoration: underline; }
.d { font-size: 13px; color: var(--muted); margin-top: 2px; }
.desc { margin: 4px 0 0; color: var(--muted); font-size: 15px; }
.back { display: inline-block; margin-top: 24px; color: var(--accent); font-weight: 700; }
</style>
</head>
<body>
<div class="bar"><a href="/"><img src="/favicon.svg" width="28" height="28" alt=""/>Hemicycle</a></div>
<main>
<div class="note">
<b>Ceci est un flux RSS.</b>
<p>Copiez l’adresse de cette page dans une application de lecture de flux (Feedly, Inoreader, NetNewsWire…) pour être prévenu de chaque nouveau vote. Ci-dessous, un aperçu de son contenu (en anglais).</p>
</div>
<h1><xsl:value-of select="rss/channel/title"/></h1>
<p class="sub"><xsl:value-of select="rss/channel/description"/></p>
<ol>
<xsl:for-each select="rss/channel/item">
<li>
<a href="{link}"><xsl:value-of select="title"/></a>
<div class="d"><xsl:value-of select="substring(pubDate, 1, 16)"/></div>
<p class="desc"><xsl:value-of select="description"/></p>
</li>
</xsl:for-each>
</ol>
<a class="back" href="{rss/channel/link}">← Retour sur Hemicycle</a>
</main>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
