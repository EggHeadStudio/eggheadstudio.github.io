// Käyttäjien tarve
// Texts for export:-------------------------------------------------------------------------------------  -----------------------
const osio1easy = `Käyttäjätarpeet on erittäin hyvin kartoitettu ja ohjelmisto vastaa niihin erinomaisesti. Ohjelmiston odotetaan 
parantavan merkittävästi työtehtävien tehokkuutta, vähentävän virheitä ja parantavan käyttäjien välistä 
kommunikaatiota. Käyttäjät ovat erittäin tyytyväisiä ohjelmiston helppokäyttöisyyteen ja intuitiivisuuteen. 
Ohjelmistolla on suuri merkitys käyttäjien päivittäisessä työssä ja sillä on laaja käyttäjäkunta.`;

const osio1medium = `Käyttäjätarpeet on otettu hyvin huomioon ja ohjelmisto vastaa niihin pääosin hyvin. Ohjelmiston odotetaan 
parantavan työtehtävien tehokkuutta ja vähentävän virheitä. Käyttäjät ovat tyytyväisiä ohjelmiston 
helppokäyttöisyyteen. Ohjelmistolla on merkittävä rooli käyttäjien päivittäisessä työssä.`;

const osio1hard = `Käyttäjätarpeiden kartoituksessa on puutteita ja ohjelmisto vastaa niihin vain osittain. Ohjelmiston vaikutus 
työtehtävien tehokkuuteen ja virheiden vähentämiseen on epävarma. Käyttäjien kokemukset ohjelmiston 
helppokäyttöisyydestä vaihtelevat. Ohjelmiston merkitys käyttäjien päivittäisessä työssä on rajallinen.`;

const osio1default = `Käyttäjätarpeita ei ole riittävästi kartoitettu ja ohjelmisto ei vastaa niihin tyydyttävästi. Ohjelmiston 
vaikutus työtehtävien tehokkuuteen ja virheiden vähentämiseen on todennäköisesti vähäinen. Käyttäjät eivät 
ole tyytyväisiä ohjelmiston helppokäyttöisyyteen. Ohjelmistolla ei ole merkittävää roolia käyttäjien 
päivittäisessä työssä.`;

// Yrityksen tarve
// Texts for export:-------------------------------------------------------------------------------------  -----------------------
const osio2easy = `Ohjelmisto vastaa erinomaisesti yrityksen tarpeisiin ja sillä on merkittävä vaikutus sen tavoitteiden 
saavuttamiseen. Ohjelmiston odotetaan tuovan merkittäviä kustannussäästöjä, parantavan päätöksentekoprosessia 
ja tehostavan tuotantoa. Ohjelmisto korvaa tehokkaasti vanhentuneet järjestelmät ja tukee erinomaisesti 
yrityksen ydintoimintaa ja tulevaisuuden strategiatarpeita.`;

const osio2medium = `Ohjelmisto vastaa hyvin yrityksen tarpeisiin ja sillä on positiivinen vaikutus sen tavoitteisiin. Ohjelmiston 
odotetaan parantavan työprosessin tehokkuutta ja vähentävän manuaalista työtä. Ohjelmisto tukee yrityksen 
ydintoimintaa.`;

const osio2hard = `Ohjelmiston hyödyt yrityksen toiminnalle ovat olemassa, mutta ne eivät ole kriittisiä. Ohjelmiston vaikutus 
kustannussäästöihin ja tuotannon tehostamiseen on epävarma. Ohjelmisto korvaa osittain vanhentuneet 
järjestelmät.`;

const osio2default = `Ohjelmiston hyödyt yrityksen toiminnalle ovat vähäiset tai epäselvät. Ohjelmiston vaikutus yrityksen 
tavoitteiden saavuttamiseen on todennäköisesti vähäinen. Ohjelmisto ei tue riittävästi yrityksen 
ydintoimintaa.`;

// Tekninen toteutettavuus
// Texts for export:-------------------------------------------------------------------------------------  -----------------------
const osio3easy = `Ohjelmiston tekninen toteutus on erittäin helppoa ja nopeaa. Kehittämiseen tarvittava teknologia on saatavilla 
ja hallussa. Ohjelmisto integroituu saumattomasti nykyisiin järjestelmiin ja skaalautuu hyvin tulevaisuuden 
tarpeisiin. Ohjelmiston tekninen ylläpito on vaivatonta ja tietoturva on erinomaisella tasolla.`;

const osio3medium = `Ohjelmiston tekninen toteutus on mahdollista, mutta se voi vaatia jonkin verran työtä ja resursseja. 
Ohjelmisto on integroitavissa nykyisiin järjestelmiin ja skaalautuu kohtalaisesti tulevaisuuden tarpeisiin. 
Ohjelmiston tekninen ylläpito onnistuu.`;

const osio3hard = `Ohjelmiston tekninen toteutus on haastavaa ja voi vaatia merkittäviä resursseja. Ohjelmiston integrointi 
nykyisiin järjestelmiin voi olla monimutkaista. Ohjelmiston skaalautuvuus ja tietoturva vaativat erityistä 
huomiota.`;

const osio3default = `Ohjelmiston tekninen toteutus on erittäin haastavaa tai jopa mahdotonta nykyisillä resursseilla. Ohjelmiston 
integrointi nykyisiin järjestelmiin on erittäin vaikeaa tai mahdotonta. Ohjelmiston skaalautuvuus ja tietoturva 
ovat merkittäviä riskejä.`;

// Kustannus / Resurssit / Aikataulutus
// Texts for export:-------------------------------------------------------------------------------------  -----------------------
const osio4easy = `Ohjelmiston kehittäminen onnistuu helposti ja nopeasti, eikä se vaadi suuria kustannuksia tai resursseja. 
Käyttöönotto onnistuu vaivattomasti ja se voidaan toteuttaa vaiheittain. Ohjelmiston vaatima hardware on 
edullista.`;

const osio4medium = `Ohjelmiston kehittäminen on mahdollista, mutta se vaatii jonkin verran aikaa, resursseja ja kustannuksia. 
Käyttöönotto onnistuu kohtuullisessa ajassa. Hardware-kustannukset ovat kohtuulliset.`;

const osio4hard = `Ohjelmiston kehittäminen on haastavaa ja aikaa vievää, ja se vaatii merkittäviä resursseja ja kustannuksia. 
Käyttöönotto on kriittinen ja voi olla viivästynyt. Hardware-kustannukset ovat korkeat.`;

const osio4default = `Ohjelmiston kehittäminen on erittäin haastavaa ja kallista, ja se voi vaatia huomattavia resursseja. 
Käyttöönotto on erittäin kriittinen ja voi olla mahdotonta toteuttaa aikataulussa. Hardware-kustannukset ovat 
erittäin korkeat.`;

// Riskit
// Texts for export:-------------------------------------------------------------------------------------  -----------------------
const osio5easy = `Ohjelmiston kehittämiseen ja käyttöönottoon liittyy erittäin vähän riskejä. Kehitysprosessi on hallittavissa 
ja mahdolliset ongelmat on helppo ratkaista. Ohjelmiston käyttöönotto ei muuta merkittävästi toimintatapoja 
ja vanhaan toimintatapaan on helppo palata tarvittaessa.`;

const osio5medium = `Ohjelmiston kehittämiseen ja käyttöönottoon liittyy joitakin riskejä, jotka on kuitenkin hallittavissa. 
Kehitysprosessissa on otettu huomioon mahdolliset ongelmat ja niihin on varauduttu. Ohjelmiston käyttöönotto 
muuttaa toimintatapoja jonkin verran, mutta vanhaan toimintatapaan on mahdollista palata.`;

const osio5hard = `Ohjelmiston kehittämiseen ja käyttöönottoon liittyy merkittäviä riskejä, jotka voivat vaikuttaa projektin 
onnistumiseen. Kehitysprosessissa on haasteita ja ongelmien ratkaiseminen voi olla vaikeaa. Ohjelmiston 
käyttöönotto muuttaa toimintatapoja merkittävästi ja vanhaan toimintatapaan palaaminen voi olla vaikeaa.`;

const osio5default = `Ohjelmiston kehittämiseen ja käyttöönottoon liittyy erittäin suuria riskejä, jotka voivat vaarantaa koko 
projektin. Kehitysprosessissa on merkittäviä haasteita ja ongelmien ratkaiseminen voi olla erittäin vaikeaa 
tai mahdotonta. Ohjelmiston käyttöönotto muuttaa toimintatapoja radikaalisti ja vanhaan toimintatapaan 
palaaminen on erittäin vaikeaa tai mahdotonta.`;