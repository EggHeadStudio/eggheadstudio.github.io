function generoiRaportti() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;

    const today = new Date();
    const dateString = today.toLocaleDateString('fi-FI'); // Muotoile päivämäärä suomalaiseen muotoon

    // Define copyright text and font settings
    const copyrightText = "Copyright \u00A9 Murata Manufacturing Co., Ltd. All rights reserved.";
    const copyrightFontSize = 6;

    // Define thresholds and texts for each osio
    const osioThresholds = [
        { 
            thresholdEasy: 1.5,
            thresholdMedium: 2.5,
            thresholdHard: 3.5,
            texts: {
                easy: "Käyttäjien tarpeet ovat erittäin hyvin ymmärretty ja ohjelmisto tulee vastaamaan \nniihin erinomaisesti.",
                medium: "Käyttäjien tarpeet on huomioitu ja ohjelmisto tulee vastaamaan niihin tyydyttävästi.", 
                hard: "Käyttäjien tarpeissa on vielä kehittämisen varaa, jotta ohjelmisto vastaisi niihin \nparhaalla mahdollisella tavalla.", 
                default: "Käyttäjien tarpeita ei ole vielä riittävästi kartoitettu."
            }
        },
        { 
            thresholdEasy: 2,
            thresholdMedium: 3,
            thresholdHard: 4,
            texts: {
                easy: "Ohjelmisto tulee olemaan erittäin tärkeä yrityksen toiminnan kannalta ja sillä on \nmerkittävä vaikutus sen tavoitteiden saavuttamiseen.", 
                medium: "Ohjelmisto tulee olemaan hyödyllinen yrityksen toiminnalle ja sillä on positiivinen \nvaikutus sen tavoitteisiin.", 
                hard: "Ohjelmiston hyödyt yrityksen toiminnalle ovat olemassa, mutta ne eivät ole kriittisiä.",
                default: "Ohjelmiston hyödyt yrityksen toiminnalle ovat vähäiset tai epäselvät."
            }
        },
        { 
            thresholdEasy: 1,
            thresholdMedium: 2,
            thresholdHard: 3,
            texts: {
                easy: "Ohjelmiston tekninen toteutus on erittäin helppoa ja nopeaa, ja se integroituu \nsaumattomasti nykyisiin järjestelmiin.", 
                medium: "Ohjelmiston tekninen toteutus on mahdollista, mutta se voi vaatia jonkin verran \ntyötä ja resursseja.", 
                hard: "Ohjelmiston tekninen toteutus on haastavaa ja voi vaatia merkittäviä resursseja.", 
                default: "Ohjelmiston tekninen toteutus on erittäin haastavaa tai jopa mahdotonta \nnykyisillä resursseilla."
            }
        },
        { 
            thresholdEasy: 1.5,
            thresholdMedium: 2.5,
            thresholdHard: 3.5,
            texts: {
                easy: "Ohjelmiston kehittäminen onnistuu helposti ja nopeasti, eikä se vaadi suuria \nkustannuksia tai resursseja.", 
                medium: "Ohjelmiston kehittäminen on mahdollista, mutta se vaatii jonkin verran aikaa, \nresursseja ja kustannuksia.", 
                hard: "Ohjelmiston kehittäminen on haastavaa ja aikaa vievää, ja se vaatii merkittäviä \nresursseja ja kustannuksia.", 
                default: "Ohjelmiston kehittäminen on erittäin haastavaa ja kallista, ja se voi vaatia \nhuomattavia resursseja."
            }
        },
        { 
            thresholdEasy: 2,
            thresholdMedium: 3,
            thresholdHard: 4,
            texts: {
                easy: "Ohjelmiston kehittämiseen ja käyttöönottoon liittyy erittäin vähän riskejä.", 
                medium: "Ohjelmiston kehittämiseen ja käyttöönottoon liittyy joitakin riskejä, jotka \non kuitenkin hallittavissa.", 
                hard: "Ohjelmiston kehittämiseen ja käyttöönottoon liittyy merkittäviä riskejä, jotka \nvoivat vaikuttaa projektin onnistumiseen.", 
                default: "Ohjelmiston kehittämiseen ja käyttöönottoon liittyy erittäin suuria riskejä, \njotka voivat vaarantaa koko projektin."
            }
        }
    ];

    y += 10;
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold').text("Ohjelmiston tarpeellisuusarviointi", 10, y).setFont(undefined, 'normal');
    y += 20;

    // Hae kaikki osiot
    const osiot = document.querySelectorAll('.osio');

    // Käy läpi kaikki osiot
    osiot.forEach((osio, index) => {
        
        const osionNimi = osio.querySelector('h2').textContent;
        const osionPisteet = parseInt(osio.querySelector('.osio-yhteispisteet span').textContent);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold').text(osionNimi, 10, y).setFont(undefined, 'normal');
        y += 8;
        const vastaukset = osio.querySelectorAll('.kysymys');
        vastaukset.forEach(vastaus => {
            const kysymys = vastaus.querySelector('label').textContent;
            const pisteet = vastaus.querySelector('input[type="radio"]:checked')?.value || 0;
            const kommentti = vastaus.querySelector('textarea')?.value || ''; // Hae kommentti
            doc.setFontSize(12);

            // Tarkista, onko tilaa nykyisellä sivulla
            if (y + 20 > doc.internal.pageSize.height) {
                doc.addPage(); // Lisää uusi sivu
                y = 10; // Palauta y-koordinaatti
            }

            doc.text(`${kysymys}`, 10, y);
            y += 6;
            doc.text(`Pisteytys: ${pisteet}`, 10, y);
            if (kommentti) {
                const kommenttiLines = kommentti.split('\n'); // Split by newline character
                for (let i = 0; i < kommenttiLines.length; i++) {
                    y += 6; // Line spacing
                    doc.setFont(undefined, 'italic').text(`${kommenttiLines[i]}`, 10, y).setFont(undefined, 'normal');
                }
                y += 6; // Extra space after kommentti
            } else {
                y += 6; // Maintain spacing consistency
            }
            y += 6;
        });
        y += 5;

        // Tarkista, onko tilaa nykyisellä sivulla
        if (y + 15 > doc.internal.pageSize.height) {
            doc.addPage(); // Lisää uusi sivu
            y = 10; // Palauta y-koordinaatti
        }

        doc.setFont(undefined, 'bold').text(`Osion (${osionNimi}) yhteispisteet: ${osionPisteet}`, 10, y).setFont(undefined, 'normal');
        y += 6;

        // Laske maksimipisteet dynaamisesti osiolle
        const osionKysymystenMäärä = vastaukset.length;
        const osionMaksimipisteet = osionKysymystenMäärä * 5;

        let osioText = '';
        let osioColor = '';

        if (osionPisteet >= osionMaksimipisteet / osioThresholds[index].thresholdEasy) {
            osioText = osioThresholds[index].texts.easy;
            osioColor = 'green';
        } else if (osionPisteet >= osionMaksimipisteet / osioThresholds[index].thresholdMedium) {
            osioText = osioThresholds[index].texts.medium;
            osioColor = 'orange';
        } else if (osionPisteet >= osionMaksimipisteet / osioThresholds[index].thresholdHard) {
            osioText = osioThresholds[index].texts.hard;
            osioColor ='red';
        } else {
            osioText = osioThresholds[index].texts.default;
            osioColor = 'black'; // or any default color
        }

        // Print osioText with embedded newlines and increment y position
        doc.setTextColor(osioColor);
        const textLines = osioText.split('\n');
        for (let i = 0; i < textLines.length; i++) {
            doc.setFont(undefined, 'bold').text(`${textLines[i]}`, 10, y).setFont(undefined, 'normal');
            y += 6; // Increment y position after each line
        }
        doc.setTextColor('black'); // Reset text color
        y += 8;
    });

    // Tarkista, onko tilaa nykyisellä sivulla
    if (y + 20 > doc.internal.pageSize.height) {
        doc.addPage(); // Lisää uusi sivu
        y = 10; // Palauta y-koordinaatti
    }

    const kokonaispisteet = parseInt(document.getElementById('kokonaispisteet').textContent);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold').text(`Kokonaispisteet: ${kokonaispisteet}`, 10, y).setFont(undefined, 'normal');
    y += 8;

    // Laske maksimipisteet dynaamisesti
    const kysymystenMäärä = document.querySelectorAll('.kysymys').length;
    const maksimipisteet = kysymystenMäärä * 5;
    const hyväksytty = kokonaispisteet >= maksimipisteet / 2;
    doc.setTextColor(hyväksytty? 'green' :'orange');
    doc.setFont(undefined, 'bold').text(hyväksytty? 'Hyväksytty toteutettavaksi' : 'Toteutettava harkinnanvaraisesti', 10, y).setFont(undefined, 'normal');
    doc.setTextColor('black');

    // Lisää copyright-teksti jokaiselle sivulle
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Lisää taustakuva
        const imgData = 'murata_logo_kuvio2.png'; // Korvaa tämä taustakuvan data-URI:lla
        const imgWidth = 549 / 5; // Kuvan leveys
        const imgHeight = 289 / 5; // Kuvan korkeus
        const imagex = (doc.internal.pageSize.width - imgWidth) / 2; // Kuvan x-koordinaatti (keskitetty)
        const imagey = (doc.internal.pageSize.height - imgHeight) / 2; // Kuvan y-koordinaatti (keskitetty)
        doc.setGState(new doc.GState({ opacity: 0.2 })); // Aseta läpinäkyvyys 50%
        doc.addImage(imgData, 'PNG', imagex, imagey, imgWidth, imgHeight, null, null, 'CENTER');
        // Lisää sivun alalogo
        const imgData2 = 'murata_logo_red.png'; // Korvaa tämä taustakuvan data-URI:lla
        const imgWidth2 = 96 / 4; // Kuvan leveys
        const imgHeight2 = 26 / 4; // Kuvan korkeus
        const imagex2 = (doc.internal.pageSize.width - 25) / 2; // Kuvan x-koordinaatti (keskitetty)
        const imagey2 = (doc.internal.pageSize.height + 277) / 2; // Kuvan y-koordinaatti (keskitetty)
        doc.addImage(imgData2, 'PNG', imagex2, imagey2, imgWidth2, imgHeight2, null, null, 'CENTER');
        doc.setGState(new doc.GState({ opacity: 1 })); // Palauta läpinäkyvyys normaaliksi

        doc.setFontSize(copyrightFontSize);
        doc.text(copyrightText, doc.internal.pageSize.width - 4, doc.internal.pageSize.height - 3, null, null, 'right');
        doc.text(`Arviointi suoritettu: ${dateString}`, doc.internal.pageSize.width - 206, doc.internal.pageSize.height - 3, null, null, 'left');
        doc.setFontSize(14);
    }

    // Avaa PDF uudessa välilehdessä
    window.open(doc.output('bloburl'), '_blank');
    
}

// Lisää tapahtumankuuntelijat
const pisteytykset = document.querySelectorAll('.pisteytys');
pisteytykset.forEach(pisteytys => {
    const osio = pisteytys.closest('.osio'); // Hae osio
    pisteytys.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => laskePisteet(osio));
    });
});