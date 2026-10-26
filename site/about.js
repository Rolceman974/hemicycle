/* Hemicycle — page « À propos » : le projet, la méthode, les sources, la vie privée et les mentions légales (FR, EN, NL).
   Adresse de contact affichée sur la page : à renseigner ci-dessous (laisser vide pour ne rien afficher). */
window.HEMI_CONTACT = 'contact@hemicycle.be';
/* Compteur de visites GoatCounter (sans cookie) : indiquer le code du compte, par exemple 'hemicycle'
   pour https://hemicycle.goatcounter.com. Laisser vide pour ne rien mesurer : la page Vie privée s'adapte toute seule. */
window.HEMI_STATS = 'hemicycle';
/* Version « application » (installation sur l'écran d'accueil, hors connexion, barre d'onglets) :
   désactivée pour le lancement du site web. Mettre true (et remettre le lien manifest dans index.html) pour la réactiver. */
window.HEMI_APP = false;

window.HEMI_ABOUT = {
  fr: {
    title: 'À propos de Hemicycle',
    lede: 'Ce que fait le site, comment les chiffres sont calculés, d’où viennent les données et ce que nous faisons (ou pas) de vos informations.',
    contact: 'Contact',
    sections: [
      { id: 'projet', t: 'Le projet', h: `
        <p>Hemicycle rend lisibles les votes du Parlement européen. Chaque vote nominatif est présenté en langage courant, avec le détail de ce qu’ont voté les 720 eurodéputés, les groupes politiques, les pays et les partis nationaux.</p>
        <p>Le site est un projet indépendant, créé par Semih Biondolillo, étudiant en sciences politiques à Liège. Il est gratuit, sans publicité et ne demande aucun compte. Site indépendant, non affilié au Parlement européen ni à aucun parti politique.</p>` },
      { id: 'methode', t: 'Méthode', h: `
        <dl class="glossary">
          <dt>Votes couverts</dt><dd>Les votes par appel nominal, les seuls où le choix de chaque eurodéputé est enregistré. Les votes à main levée n’y figurent pas.</dd>
          <dt>Présence</dt><dd>La part des votes nominatifs auxquels l’eurodéputé a pris part (pour, contre ou abstention), sur la durée de son mandat. Une absence peut être justifiée : maladie, congé parental, mission officielle.</dd>
          <dt>Fidélité au groupe</dt><dd>La part de ses votes identiques à la position majoritaire de son groupe. Elle n’est pas calculée pour les non-inscrits, qui ne forment pas un groupe.</dd>
          <dt>Cohésion</dt><dd>Pour un groupe ou un parti : la part moyenne de ses membres qui votent comme sa majorité. 100 % signifie un vote toujours unanime.</dd>
          <dt>Qui vote avec qui</dt><dd>La part des votes finaux où deux groupes ont adopté la même position majoritaire.</dd>
          <dt>Majorité gagnante</dt><dd>Les groupes dont la position majoritaire correspond au résultat du vote.</dd>
          <dt>Thèmes</dt><dd>Un vote est rattaché à un thème selon la commission parlementaire qui l’a préparé et des mots-clés de son titre. Ce classement automatique peut parfois se tromper.</dd>
          <dt>Explications</dt><dd>Le paragraphe « En bref » est généré automatiquement à partir des données officielles du vote (type de texte, procédure, résultat). Le sujet de chaque texte en langage courant a été rédigé pour le site.</dd>
          <dt>Mises à jour</dt><dd>Les votes sont actualisés chaque semaine, l’agenda des sessions chaque jour.</dd>
        </dl>` },
      { id: 'sources', t: 'Sources et licences', h: `
        <ul>
          <li><b>Votes</b> : <a href="https://howtheyvote.eu" target="_blank" rel="noopener">HowTheyVote.eu</a>, d’après les procès-verbaux officiels du Parlement européen, sous licence Open Database License (ODbL 1.0).</li>
          <li><b>Agenda des sessions</b> : données ouvertes du Parlement européen et calendrier de HowTheyVote.eu.</li>
          <li><b>Photos des eurodéputés</b> : © Union européenne, source : Parlement européen.</li>
          <li><b>Biographies et présentation des partis</b> : Wikipédia (CC BY-SA 4.0) et Wikidata (CC0).</li>
          <li><b>Législatures 1979–2019</b> : jeu de données « meps » d’E. Persson et al. (licence MIT).</li>
          <li><b>Carte</b> : Natural Earth (domaine public). <b>Polices</b> : Manrope et Newsreader (SIL Open Font License).</li>
        </ul>` },
      { id: 'limites', t: 'Limites', h: `
        <p>Hemicycle n’est pas une source officielle. Malgré le soin apporté, les données peuvent contenir des erreurs ou des retards, et les explications automatiques simplifient forcément des textes complexes. Les intitulés des votes sont publiés en anglais par le Parlement ; leurs traductions en français et en néerlandais sont réalisées par Hemicycle et n’ont pas de valeur officielle (l’intitulé anglais reste indiqué sur chaque page de vote). Pour toute référence officielle, consultez le site du Parlement européen, dont chaque page de vote donne le lien.</p>` },
      { id: 'vie-privee', t: 'Vie privée', h: `
        <p>Le site n’utilise <b>aucun cookie</b>, aucun traceur publicitaire<span class="no-stats"> et aucun outil de mesure d’audience</span>. La langue et le thème (clair ou sombre) que vous choisissez sont enregistrés uniquement dans votre navigateur.</p>
        <p class="stats-only">Pour connaître la fréquentation du site, nous utilisons <a href="https://www.goatcounter.com" target="_blank" rel="noopener">GoatCounter</a>, un compteur de visites sans cookie, qui ne suit pas les personnes d’une page à l’autre et ne garde ni adresse IP ni identifiant. Seuls des totaux anonymes sont conservés (pages vues, pays, type d’appareil).</p>
        <p>Pour afficher les photos, les biographies et la présentation des partis, votre navigateur contacte directement les sites du Parlement européen, de Wikipédia et de Wikidata, qui reçoivent alors votre adresse IP selon leurs propres règles. Le site est hébergé par GitHub Pages, qui peut conserver des journaux techniques.</p>` },
      { id: 'mentions', t: 'Mentions légales', h: `
        <p><b>Éditeur</b> : Semih Biondolillo, Liège (Belgique).<br>
        <b>Hébergeur</b> : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</p>` },
    ],
  },
  en: {
    title: 'About Hemicycle',
    lede: 'What the site does, how the figures are calculated, where the data comes from and what we do (or don’t do) with your information.',
    contact: 'Contact',
    sections: [
      { id: 'projet', t: 'The project', h: `
        <p>Hemicycle makes European Parliament votes readable. Every roll-call vote is presented in plain language, with how the 720 MEPs, the political groups, the countries and the national parties voted.</p>
        <p>The site is an independent project created by Semih Biondolillo, a political science student in Liège. It is free, ad-free and needs no account. Independent site, not affiliated with the European Parliament or with any political party.</p>` },
      { id: 'methode', t: 'Method', h: `
        <dl class="glossary">
          <dt>Votes covered</dt><dd>Roll-call votes, the only ones in which each MEP’s choice is recorded. Votes by show of hands are not included.</dd>
          <dt>Attendance</dt><dd>The share of roll-call votes in which the MEP took part (for, against or abstention) during their term. An absence may be justified: illness, parental leave, official mission.</dd>
          <dt>Group loyalty</dt><dd>The share of their votes matching their group’s majority position. It is not calculated for non-attached members, who do not form a group.</dd>
          <dt>Cohesion</dt><dd>For a group or a party: the average share of its members voting with its majority. 100% means a vote that is always unanimous.</dd>
          <dt>Who votes with whom</dt><dd>The share of final votes in which two groups took the same majority position.</dd>
          <dt>Winning majority</dt><dd>The groups whose majority position matched the result of the vote.</dd>
          <dt>Topics</dt><dd>A vote is linked to a topic based on the parliamentary committee that prepared it and keywords in its title. This automatic classification can sometimes be wrong.</dd>
          <dt>Explanations</dt><dd>The “In short” paragraph is generated automatically from the official vote data (type of text, procedure, result). The plain-language subject of each text was written for the site.</dd>
          <dt>Updates</dt><dd>Votes are updated every week, the session agenda every day.</dd>
        </dl>` },
      { id: 'sources', t: 'Sources and licences', h: `
        <ul>
          <li><b>Votes</b>: <a href="https://howtheyvote.eu" target="_blank" rel="noopener">HowTheyVote.eu</a>, based on the European Parliament’s official minutes, under the Open Database License (ODbL 1.0).</li>
          <li><b>Session agenda</b>: European Parliament open data and the HowTheyVote.eu calendar.</li>
          <li><b>MEP photos</b>: © European Union, source: European Parliament.</li>
          <li><b>Biographies and party profiles</b>: Wikipedia (CC BY-SA 4.0) and Wikidata (CC0).</li>
          <li><b>1979–2019 terms</b>: the “meps” dataset by E. Persson et al. (MIT licence).</li>
          <li><b>Map</b>: Natural Earth (public domain). <b>Typefaces</b>: Manrope and Newsreader (SIL Open Font License).</li>
        </ul>` },
      { id: 'limites', t: 'Limitations', h: `
        <p>Hemicycle is not an official source. Despite our care, the data may contain errors or delays, and automatic explanations necessarily simplify complex texts. Vote titles are published in English by Parliament; the French and Dutch translations are made by Hemicycle and have no official value. For any official reference, see the European Parliament website, linked from every vote page.</p>` },
      { id: 'vie-privee', t: 'Privacy', h: `
        <p>The site uses <b>no cookies</b>, no advertising trackers<span class="no-stats"> and no audience measurement</span>. The language and theme (light or dark) you choose are stored only in your browser.</p>
        <p class="stats-only">To know how many people visit the site, we use <a href="https://www.goatcounter.com" target="_blank" rel="noopener">GoatCounter</a>, a cookie-free visit counter that does not track people from page to page and keeps no IP address or identifier. Only anonymous totals are kept (page views, countries, device types).</p>
        <p>To display photos, biographies and party profiles, your browser contacts the European Parliament, Wikipedia and Wikidata websites directly, which then receive your IP address under their own policies. The site is hosted on GitHub Pages, which may keep technical logs.</p>` },
      { id: 'mentions', t: 'Legal notice', h: `
        <p><b>Publisher</b>: Semih Biondolillo, Liège (Belgium).<br>
        <b>Host</b>: GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, United States.</p>` },
    ],
  },
  nl: {
    title: 'Over Hemicycle',
    lede: 'Wat de site doet, hoe de cijfers berekend worden, waar de gegevens vandaan komen en wat we (niet) met uw gegevens doen.',
    contact: 'Contact',
    sections: [
      { id: 'projet', t: 'Het project', h: `
        <p>Hemicycle maakt de stemmingen van het Europees Parlement leesbaar. Elke hoofdelijke stemming wordt in gewone taal voorgesteld, met hoe de 720 Europarlementsleden, de fracties, de landen en de nationale partijen stemden.</p>
        <p>De site is een onafhankelijk project van Semih Biondolillo, student politieke wetenschappen in Luik. Ze is gratis, zonder reclame en vraagt geen account. Onafhankelijke site, niet verbonden aan het Europees Parlement of aan een politieke partij.</p>` },
      { id: 'methode', t: 'Methode', h: `
        <dl class="glossary">
          <dt>Behandelde stemmingen</dt><dd>Hoofdelijke stemmingen, de enige waarbij de keuze van elk lid wordt geregistreerd. Stemmingen bij handopsteking zijn niet opgenomen.</dd>
          <dt>Aanwezigheid</dt><dd>Het aandeel hoofdelijke stemmingen waaraan het lid deelnam (voor, tegen of onthouding) tijdens het mandaat. Een afwezigheid kan gerechtvaardigd zijn: ziekte, ouderschapsverlof, officiële opdracht.</dd>
          <dt>Fractietrouw</dt><dd>Het aandeel stemmen dat overeenkomt met het meerderheidsstandpunt van de fractie. Niet berekend voor niet-ingeschreven leden, die geen fractie vormen.</dd>
          <dt>Cohesie</dt><dd>Voor een fractie of partij: het gemiddelde aandeel leden dat met de meerderheid stemt. 100 % betekent een altijd eensgezinde stemming.</dd>
          <dt>Wie stemt met wie</dt><dd>Het aandeel eindstemmingen waarbij twee fracties hetzelfde meerderheidsstandpunt innamen.</dd>
          <dt>Winnende meerderheid</dt><dd>De fracties waarvan het meerderheidsstandpunt overeenkwam met de uitslag.</dd>
          <dt>Thema’s</dt><dd>Een stemming wordt aan een thema gekoppeld op basis van de parlementaire commissie die ze voorbereidde en trefwoorden in de titel. Deze automatische indeling kan soms fout zijn.</dd>
          <dt>Uitleg</dt><dd>De alinea “In het kort” wordt automatisch opgesteld op basis van de officiële gegevens (soort tekst, procedure, uitslag). Het onderwerp van elke tekst in gewone taal werd voor de site geschreven.</dd>
          <dt>Updates</dt><dd>De stemmingen worden elke week bijgewerkt, de agenda van de vergaderingen elke dag.</dd>
        </dl>` },
      { id: 'sources', t: 'Bronnen en licenties', h: `
        <ul>
          <li><b>Stemmingen</b>: <a href="https://howtheyvote.eu" target="_blank" rel="noopener">HowTheyVote.eu</a>, op basis van de officiële notulen van het Europees Parlement, onder de Open Database License (ODbL 1.0).</li>
          <li><b>Agenda</b>: open data van het Europees Parlement en de kalender van HowTheyVote.eu.</li>
          <li><b>Foto’s</b>: © Europese Unie, bron: Europees Parlement.</li>
          <li><b>Biografieën en partijprofielen</b>: Wikipedia (CC BY-SA 4.0) en Wikidata (CC0).</li>
          <li><b>Zittingsperiodes 1979–2019</b>: dataset “meps” van E. Persson e.a. (MIT-licentie).</li>
          <li><b>Kaart</b>: Natural Earth (publiek domein). <b>Lettertypes</b>: Manrope en Newsreader (SIL Open Font License).</li>
        </ul>` },
      { id: 'limites', t: 'Beperkingen', h: `
        <p>Hemicycle is geen officiële bron. Ondanks alle zorg kunnen de gegevens fouten of vertraging bevatten, en automatische uitleg vereenvoudigt noodzakelijkerwijs complexe teksten. Het Parlement publiceert de titels van de stemmingen in het Engels; de Nederlandse en Franse vertalingen zijn van Hemicycle en hebben geen officiële waarde (de Engelse titel blijft op elke stemmingspagina vermeld). Voor een officiële referentie: de website van het Europees Parlement, gelinkt op elke stemmingspagina.</p>` },
      { id: 'vie-privee', t: 'Privacy', h: `
        <p>De site gebruikt <b>geen cookies</b>, geen advertentietrackers<span class="no-stats"> en geen bezoekersmeting</span>. De taal en het thema (licht of donker) die u kiest, worden alleen in uw browser bewaard.</p>
        <p class="stats-only">Om te weten hoeveel mensen de site bezoeken, gebruiken we <a href="https://www.goatcounter.com" target="_blank" rel="noopener">GoatCounter</a>, een bezoekersteller zonder cookies die mensen niet van pagina tot pagina volgt en geen IP-adres of identificatie bewaart. Alleen anonieme totalen worden bewaard (bekeken pagina’s, landen, soort toestel).</p>
        <p>Om foto’s, biografieën en partijprofielen te tonen, neemt uw browser rechtstreeks contact op met de websites van het Europees Parlement, Wikipedia en Wikidata, die dan uw IP-adres ontvangen volgens hun eigen regels. De site wordt gehost door GitHub Pages, dat technische logbestanden kan bijhouden.</p>` },
      { id: 'mentions', t: 'Wettelijke vermeldingen', h: `
        <p><b>Uitgever</b>: Semih Biondolillo, Luik (België).<br>
        <b>Host</b>: GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, Verenigde Staten.</p>` },
    ],
  },
};
