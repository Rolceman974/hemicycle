/* Hemicycle — guide « Comment ça marche ? » (FR, EN, NL).
   Chaque section : id (ancre), titre, contenu HTML simple. Les liens #/… mènent aux pages du site. */
window.HEMI_GUIDE = {
  fr: {
    title: 'Comment fonctionne le Parlement européen ?',
    lede: 'Tout ce qu’il faut savoir pour lire les votes de ce site, en quelques minutes.',
    sections: [
      { id: 'parlement', t: 'Le Parlement en bref', h: `
        <p>Le Parlement européen compte <b>720 eurodéputés</b>, élus tous les cinq ans au suffrage universel direct dans les 27 pays de l’Union. Le nombre de sièges de chaque pays dépend de sa population : de 6 pour Malte, Chypre ou le Luxembourg à 96 pour l’Allemagne.</p>
        <p>Il se réunit en séance plénière douze fois par an à Strasbourg, et quelques fois à Bruxelles. C’est là que se déroulent les votes que vous trouvez sur ce site.</p>
        <p>Le Parlement a trois grands rôles :</p>
        <ul>
          <li><b>Faire les lois</b> européennes, à égalité avec le Conseil, qui réunit les ministres des États membres ;</li>
          <li><b>Voter le budget</b> de l’Union et contrôler la façon dont il est dépensé ;</li>
          <li><b>Contrôler la Commission européenne</b> : il élit sa présidente ou son président, approuve l’équipe des commissaires et peut la renverser par une motion de censure.</li>
        </ul>` },
      { id: 'loi', t: 'Comment une loi européenne est adoptée', h: `
        <ol class="steps">
          <li><b>La Commission propose.</b> Elle seule peut déposer un projet de loi (règlement ou directive).</li>
          <li><b>Une commission parlementaire prépare la position du Parlement.</b> Un eurodéputé, le rapporteur, rédige un rapport ; les autres déposent des amendements.</li>
          <li><b>Le Parlement vote en séance plénière.</b> Il adopte sa position, éventuellement après avoir voté sur des dizaines d’amendements.</li>
          <li><b>Négociations avec le Conseil (« trilogues »).</b> Le Parlement, le Conseil et la Commission cherchent un compromis.</li>
          <li><b>Vote de l’accord.</b> Le Parlement puis le Conseil approuvent le texte négocié, qui est publié au Journal officiel et devient loi.</li>
        </ol>
        <p>Un <b>règlement</b> s’applique directement dans tous les pays. Une <b>directive</b> fixe des objectifs que chaque pays doit transposer dans sa propre loi.</p>` },
      { id: 'votes', t: 'Sur quoi votent les eurodéputés', h: `
        <dl class="glossary">
          <dt>Vote final</dt><dd>Le vote sur l’ensemble d’un texte. C’est lui qui décide si le texte est adopté. Sur ce site, l’onglet « Votes finaux » ne montre que ceux-là.</dd>
          <dt>Amendement</dt><dd>Une proposition de modification d’un passage, déposée par un groupe politique, une commission ou des eurodéputés. Il est voté avant le texte entier.</dd>
          <dt>Vote séparé, vote par division</dt><dd>Un groupe demande de voter à part sur un paragraphe, ou sur une partie de paragraphe, pour pouvoir s’y opposer sans rejeter tout le texte.</dd>
          <dt>Résolution, rapport d’initiative</dt><dd>Des textes politiques sans force de loi, par lesquels le Parlement prend position ou fait des demandes, par exemple sur les droits humains dans un pays.</dd>
          <dt>Approbation</dt><dd>Pour certains textes, comme les accords internationaux, le Parlement ne peut que dire oui ou non, sans les modifier.</dd>
          <dt>Objection</dt><dd>Le Parlement peut s’opposer à une mesure technique préparée par la Commission pour appliquer une loi existante (autorisation d’un OGM, d’un pesticide…).</dd>
          <dt>Décharge</dt><dd>Le contrôle, chaque année, de la façon dont le budget de l’Union et de ses agences a été dépensé.</dd>
          <dt>Motion de censure</dt><dd>Un vote pour renverser la Commission. Il faut les deux tiers des voix exprimées et la majorité des membres du Parlement.</dd>
        </dl>` },
      { id: 'appel-nominal', t: 'Les votes par appel nominal', h: `
        <p>Le Parlement vote de trois façons : à main levée, par vote électronique simple, ou par <b>appel nominal</b>. Seul ce dernier enregistre le vote de chaque eurodéputé, nom par nom. C’est le cas des votes finaux sur les lois et de la plupart des votes importants : ce sont ces votes que montre Hemicycle.</p>
        <p>La plupart des textes sont adoptés à la <b>majorité simple</b> des voix exprimées. Certains exigent la <b>majorité absolue</b> des membres du Parlement, soit 361 voix, quel que soit le nombre de présents : c’est pourquoi un texte peut être rejeté alors qu’il a recueilli plus de « pour » que de « contre ».</p>` },
      { id: 'groupes', t: 'Les groupes politiques', h: `
        <p>Au Parlement, les élus ne siègent pas par pays mais par <b>groupe politique</b>, qui rassemble des partis nationaux de même sensibilité. Pour former un groupe, il faut au moins 23 eurodéputés venant d’au moins sept pays. Les élus qui n’appartiennent à aucun groupe sont dits « non-inscrits ».</p>
        <p>Aucun groupe n’a la majorité à lui seul : chaque texte est adopté grâce à une <b>coalition</b> de groupes, qui change d’un vote à l’autre. La page <a href="#/groupes">Groupes</a> montre quelles coalitions l’emportent le plus souvent.</p>` },
      { id: 'chiffres', t: 'Comment lire les chiffres du site', h: `
        <dl class="glossary">
          <dt>Présence</dt><dd>La part des votes par appel nominal auxquels l’eurodéputé a participé, en votant pour, contre ou en s’abstenant.</dd>
          <dt>Fidélité au groupe</dt><dd>La part de ses votes identiques à la position majoritaire de son groupe.</dd>
          <dt>Cohésion d’un groupe</dt><dd>En moyenne, la part des membres d’un groupe qui votent comme la majorité de ce groupe. 100 % signifie que tout le groupe vote toujours de la même façon.</dd>
          <dt>Coalition gagnante</dt><dd>Les groupes dont la majorité des membres a voté du côté qui l’a emporté.</dd>
        </dl>
        <p>Les données viennent de <a href="https://howtheyvote.eu" target="_blank" rel="noopener">HowTheyVote.eu</a>, d’après les procès-verbaux officiels du Parlement, et sont mises à jour chaque semaine.</p>` },
    ],
  },
  en: {
    title: 'How does the European Parliament work?',
    lede: 'Everything you need to read the votes on this site, in a few minutes.',
    sections: [
      { id: 'parlement', t: 'Parliament in brief', h: `
        <p>The European Parliament has <b>720 MEPs</b>, directly elected every five years in the EU’s 27 countries. Each country’s number of seats depends on its population: from 6 for Malta, Cyprus or Luxembourg to 96 for Germany.</p>
        <p>It meets in plenary session twelve times a year in Strasbourg, and a few times in Brussels. That is where the votes on this site take place.</p>
        <p>Parliament has three main roles:</p>
        <ul>
          <li><b>Making EU laws</b>, on an equal footing with the Council, which brings together ministers from the member states;</li>
          <li><b>Adopting the EU budget</b> and checking how it is spent;</li>
          <li><b>Scrutinising the European Commission</b>: it elects its President, approves the team of Commissioners and can bring it down with a motion of censure.</li>
        </ul>` },
      { id: 'loi', t: 'How an EU law is adopted', h: `
        <ol class="steps">
          <li><b>The Commission proposes.</b> Only the Commission can table a draft law (a regulation or a directive).</li>
          <li><b>A parliamentary committee prepares Parliament’s position.</b> One MEP, the rapporteur, drafts a report; others table amendments.</li>
          <li><b>Parliament votes in plenary.</b> It adopts its position, sometimes after voting on dozens of amendments.</li>
          <li><b>Negotiations with the Council (“trilogues”).</b> Parliament, the Council and the Commission look for a compromise.</li>
          <li><b>Vote on the agreement.</b> Parliament and then the Council approve the negotiated text, which is published in the Official Journal and becomes law.</li>
        </ol>
        <p>A <b>regulation</b> applies directly in every country. A <b>directive</b> sets goals that each country must write into its own law.</p>` },
      { id: 'votes', t: 'What MEPs vote on', h: `
        <dl class="glossary">
          <dt>Final vote</dt><dd>The vote on a text as a whole. It decides whether the text is adopted. On this site, the “Final votes” tab shows only these.</dd>
          <dt>Amendment</dt><dd>A proposal to change a passage, tabled by a political group, a committee or MEPs. It is voted on before the whole text.</dd>
          <dt>Separate vote, split vote</dt><dd>A group asks for a paragraph, or part of one, to be voted on separately, so it can oppose it without rejecting the whole text.</dd>
          <dt>Resolution, own-initiative report</dt><dd>Political texts with no legal force, in which Parliament takes a position or makes requests, for example on human rights in a country.</dd>
          <dt>Consent</dt><dd>For some texts, such as international agreements, Parliament can only say yes or no, without amending them.</dd>
          <dt>Objection</dt><dd>Parliament can object to a technical measure drawn up by the Commission to implement an existing law (authorising a GMO, a pesticide…).</dd>
          <dt>Discharge</dt><dd>The yearly check on how the budget of the EU and its agencies was spent.</dd>
          <dt>Motion of censure</dt><dd>A vote to bring down the Commission. It needs two thirds of the votes cast and a majority of all MEPs.</dd>
        </dl>` },
      { id: 'appel-nominal', t: 'Roll-call votes', h: `
        <p>Parliament votes in three ways: by show of hands, by simple electronic vote, or by <b>roll call</b>. Only roll-call votes record how each MEP voted, name by name. That covers final votes on laws and most important votes: these are the votes Hemicycle shows.</p>
        <p>Most texts are adopted by a <b>simple majority</b> of the votes cast. Some require an <b>absolute majority</b> of all MEPs, 361 votes, however many are present: that is why a text can be rejected even with more votes for than against.</p>` },
      { id: 'groupes', t: 'Political groups', h: `
        <p>In Parliament, MEPs do not sit by country but by <b>political group</b>, bringing together national parties with similar views. A group needs at least 23 MEPs from at least seven countries. MEPs who belong to no group are called “non-attached”.</p>
        <p>No group has a majority on its own: every text is adopted thanks to a <b>coalition</b> of groups, which changes from one vote to the next. The <a href="#/groupes">Groups</a> page shows which coalitions win most often.</p>` },
      { id: 'chiffres', t: 'How to read the figures', h: `
        <dl class="glossary">
          <dt>Attendance</dt><dd>The share of roll-call votes in which the MEP took part, voting for, against or abstaining.</dd>
          <dt>Group loyalty</dt><dd>The share of their votes that matched their group’s majority position.</dd>
          <dt>Group cohesion</dt><dd>On average, the share of a group’s members who vote like the group’s majority. 100% means the whole group always votes the same way.</dd>
          <dt>Winning coalition</dt><dd>The groups whose majority voted on the winning side.</dd>
        </dl>
        <p>The data comes from <a href="https://howtheyvote.eu" target="_blank" rel="noopener">HowTheyVote.eu</a>, based on Parliament’s official minutes, and is updated every week.</p>` },
    ],
  },
  nl: {
    title: 'Hoe werkt het Europees Parlement?',
    lede: 'Alles wat u moet weten om de stemmingen op deze site te lezen, in een paar minuten.',
    sections: [
      { id: 'parlement', t: 'Het Parlement in het kort', h: `
        <p>Het Europees Parlement telt <b>720 leden</b>, die om de vijf jaar rechtstreeks worden verkozen in de 27 EU-landen. Het aantal zetels per land hangt af van de bevolking: van 6 voor Malta, Cyprus of Luxemburg tot 96 voor Duitsland.</p>
        <p>Het komt twaalf keer per jaar in plenaire vergadering bijeen in Straatsburg, en enkele keren in Brussel. Daar vinden de stemmingen op deze site plaats.</p>
        <p>Het Parlement heeft drie grote taken:</p>
        <ul>
          <li><b>Europese wetten maken</b>, op gelijke voet met de Raad, waarin de ministers van de lidstaten zitten;</li>
          <li><b>De EU-begroting goedkeuren</b> en controleren hoe ze wordt besteed;</li>
          <li><b>De Europese Commissie controleren</b>: het verkiest de voorzitter, keurt het team van commissarissen goed en kan de Commissie met een motie van afkeuring ten val brengen.</li>
        </ul>` },
      { id: 'loi', t: 'Hoe een Europese wet tot stand komt', h: `
        <ol class="steps">
          <li><b>De Commissie doet een voorstel.</b> Alleen zij kan een wetsontwerp indienen (verordening of richtlijn).</li>
          <li><b>Een parlementaire commissie bereidt het standpunt van het Parlement voor.</b> Eén lid, de rapporteur, schrijft een verslag; anderen dienen amendementen in.</li>
          <li><b>Het Parlement stemt in de plenaire vergadering.</b> Het neemt zijn standpunt aan, soms na stemmingen over tientallen amendementen.</li>
          <li><b>Onderhandelingen met de Raad (“triloog”).</b> Parlement, Raad en Commissie zoeken een compromis.</li>
          <li><b>Stemming over het akkoord.</b> Het Parlement en daarna de Raad keuren de onderhandelde tekst goed, die in het Publicatieblad verschijnt en wet wordt.</li>
        </ol>
        <p>Een <b>verordening</b> geldt rechtstreeks in alle landen. Een <b>richtlijn</b> legt doelen vast die elk land in zijn eigen wet moet omzetten.</p>` },
      { id: 'votes', t: 'Waarover de leden stemmen', h: `
        <dl class="glossary">
          <dt>Eindstemming</dt><dd>De stemming over een tekst als geheel. Die beslist of de tekst wordt aangenomen. Het tabblad “Eindstemmingen” op deze site toont alleen die.</dd>
          <dt>Amendement</dt><dd>Een voorstel om een passage te wijzigen, ingediend door een fractie, een commissie of leden. Er wordt over gestemd vóór de hele tekst.</dd>
          <dt>Afzonderlijke of opgesplitste stemming</dt><dd>Een fractie vraagt om apart over een paragraaf of een deel ervan te stemmen, zodat ze die kan afwijzen zonder de hele tekst te verwerpen.</dd>
          <dt>Resolutie, initiatiefverslag</dt><dd>Politieke teksten zonder rechtskracht, waarin het Parlement een standpunt inneemt of vragen stelt, bijvoorbeeld over de mensenrechten in een land.</dd>
          <dt>Goedkeuring</dt><dd>Voor sommige teksten, zoals internationale akkoorden, kan het Parlement alleen ja of nee zeggen, zonder ze te wijzigen.</dd>
          <dt>Bezwaar</dt><dd>Het Parlement kan bezwaar maken tegen een technische maatregel van de Commissie ter uitvoering van een bestaande wet (toelating van een ggo, een pesticide…).</dd>
          <dt>Kwijting</dt><dd>De jaarlijkse controle van hoe de begroting van de EU en haar agentschappen is besteed.</dd>
          <dt>Motie van afkeuring</dt><dd>Een stemming om de Commissie ten val te brengen. Daarvoor zijn twee derde van de uitgebrachte stemmen en een meerderheid van alle leden nodig.</dd>
        </dl>` },
      { id: 'appel-nominal', t: 'Hoofdelijke stemmingen', h: `
        <p>Het Parlement stemt op drie manieren: bij handopsteken, met een gewone elektronische stemming of <b>hoofdelijk</b>. Alleen een hoofdelijke stemming registreert de stem van elk lid, naam per naam. Dat geldt voor de eindstemmingen over wetten en de meeste belangrijke stemmingen: die toont Hemicycle.</p>
        <p>De meeste teksten worden aangenomen met een <b>gewone meerderheid</b> van de uitgebrachte stemmen. Sommige vereisen een <b>absolute meerderheid</b> van alle leden, 361 stemmen, ongeacht hoeveel leden aanwezig zijn: daarom kan een tekst worden verworpen terwijl er meer stemmen voor dan tegen waren.</p>` },
      { id: 'groupes', t: 'De fracties', h: `
        <p>In het Parlement zitten de leden niet per land maar per <b>fractie</b>, die nationale partijen met dezelfde politieke kleur samenbrengt. Een fractie telt minstens 23 leden uit minstens zeven landen. Leden die bij geen fractie horen, heten “niet-fractiegebonden”.</p>
        <p>Geen enkele fractie heeft alleen een meerderheid: elke tekst wordt aangenomen dankzij een <b>coalitie</b> van fracties, die van stemming tot stemming verandert. De pagina <a href="#/groupes">Fracties</a> toont welke coalities het vaakst winnen.</p>` },
      { id: 'chiffres', t: 'Hoe u de cijfers leest', h: `
        <dl class="glossary">
          <dt>Aanwezigheid</dt><dd>Het aandeel hoofdelijke stemmingen waaraan het lid deelnam, door voor, tegen of zich van stemming te onthouden.</dd>
          <dt>Fractietrouw</dt><dd>Het aandeel van zijn stemmen dat overeenkwam met het meerderheidsstandpunt van zijn fractie.</dd>
          <dt>Samenhang van een fractie</dt><dd>Gemiddeld het aandeel leden van een fractie dat stemt zoals de meerderheid van die fractie. 100% betekent dat de hele fractie altijd hetzelfde stemt.</dd>
          <dt>Winnende coalitie</dt><dd>De fracties waarvan de meerderheid aan de winnende kant stemde.</dd>
        </dl>
        <p>De gegevens komen van <a href="https://howtheyvote.eu" target="_blank" rel="noopener">HowTheyVote.eu</a>, op basis van de officiële notulen van het Parlement, en worden elke week bijgewerkt.</p>` },
    ],
  },
};
