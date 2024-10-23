function generoiRaportti() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;

    const projektiInput = document.querySelector('#projektin_nimi')
    const projekti = projektiInput.value; // Projektin nimi
    const today = new Date();
    const dateString = today.toLocaleDateString('fi-FI'); // Muotoile päivämäärä suomalaiseen muotoon

    // Define copyright text and font settings
    const copyrightText = "Copyright \u00A9 Murata Manufacturing Co., Ltd. All rights reserved.";
    const copyrightFontSize = 6;

    // Define thresholds and texts for each osio
    const osioThresholds = [
        { 
            thresholdEasy: 1.5,
            thresholdMedium: 2,
            thresholdHard: 3.5,
            texts: { // Tekstit haetaan otak_texts.js filestä
                easy: osio1easy,
                medium: osio1medium, 
                hard: osio1hard, 
                default: osio1default
            }
        },
        { 
            thresholdEasy: 1.5,
            thresholdMedium: 2,
            thresholdHard: 3.5,
            texts: {
                easy: osio2easy, 
                medium: osio2medium, 
                hard: osio2hard,
                default: osio2default
            }
        },
        { 
            thresholdEasy: 1.5,
            thresholdMedium: 2,
            thresholdHard: 3.5,
            texts: {
                easy: osio3easy, 
                medium: osio3medium, 
                hard: osio3hard,
                default: osio3default
            }
        },
        { 
            thresholdEasy: 1.5,
            thresholdMedium: 2.5,
            thresholdHard: 3.5,
            texts: {
                easy: osio4easy, 
                medium: osio4medium, 
                hard: osio4hard,
                default: osio4default
            }
        },
        { 
            thresholdEasy: 2,
            thresholdMedium: 3,
            thresholdHard: 4,
            texts: {
                easy: osio5easy, 
                medium: osio5medium, 
                hard: osio5hard,
                default: osio5default
            }
        }
    ];

    y += 10;
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold').text("Ohjelmiston tarpeellisuusarviointi", 10, y).setFont(undefined, 'normal');
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor('#00647d');
    doc.setFont(undefined, 'bold').text(`${projekti.toUpperCase()}`, 10, y).setFont(undefined, 'normal');
    doc.setTextColor('black');
    y += 20;

    // Hae kaikki osiot
    const osiot = document.querySelectorAll('.osio');

    // Käy läpi kaikki osiot
    osiot.forEach((osio, index) => {
        
        const osionNimi = osio.querySelector('h2').textContent;
        const osionPisteet = parseInt(osio.querySelector('.osio-yhteispisteet span').textContent);
        // Tarkista, onko tilaa nykyisellä sivulla
        if (y + 20 > doc.internal.pageSize.height) {
            doc.addPage(); // Lisää uusi sivu
            y = 10; // Palauta y-koordinaatti
        }
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold').text(osionNimi, 10, y).setFont(undefined, 'normal');
        y += 8;
        const vastaukset = osio.querySelectorAll('.kysymys');
        vastaukset.forEach(vastaus => {
            const kysymys = vastaus.querySelector('label').textContent;
            const pisteet = vastaus.querySelector('input[type="radio"]:checked')?.value || 0;
            const title = vastaus.querySelector('input[type="radio"]:checked')?.title || ''; // Retrieve the title attribute
            const kommentti = vastaus.querySelector('textarea')?.value || ''; // Hae kommentti
            doc.setFontSize(12);

            // Tarkista, onko tilaa nykyisellä sivulla
            if (y + 20 > doc.internal.pageSize.height) {
                doc.addPage(); // Lisää uusi sivu
                y = 10; // Palauta y-koordinaatti
            }

            doc.text(`${kysymys}`, 10, y);
            y += 6;
            doc.setFontSize(10);
            doc.setTextColor('#00647d');
            doc.text(`Pisteytys: ${pisteet} - ${title}`, 10, y);
            doc.setTextColor('black');
            doc.setFontSize(12);
            if (kommentti) {
                const kommenttiLines = kommentti.split('\n'); // Split by newline character
                for (let i = 0; i < kommenttiLines.length; i++) {
                    const line = kommenttiLines[i];
                    const words = line.split(' '); // Further split into words for wrapping
                    let wrappedLine = '';
                    for (let j = 0; j < words.length; j++) {
                        const testLine = wrappedLine + '' + words[j];
                        const metrics = doc.getTextDimensions(testLine);
                        const maxWidth = doc.internal.pageSize.width - 20; // Maximum width for the text
                        if (metrics.w > maxWidth) { // If the text exceeds the maximum width
                            // Print the current wrapped line and reset it
                            y += 6; // Line spacing
                            doc.setFont(undefined, 'italic').text(wrappedLine, 10, y).setFont(undefined, 'normal');
                            wrappedLine = words[j]; // Start a new wrapped line with the current word
                        } else {
                            if (wrappedLine) wrappedLine += ' '; // Add space if not the first word
                            wrappedLine += words[j]; // Add the word to the wrapped line
                        }
                    }
                    // Print the last wrapped line of the original line
                    if (wrappedLine) {
                        y += 6; // Line spacing
                        doc.setFont(undefined, 'italic').text(wrappedLine, 10, y).setFont(undefined, 'normal');
                    }
                }
                y += 6; // Extra space after kommentti
            
                // Check if the text has exceeded the page height and add a new page if necessary
                if (y > doc.internal.pageSize.height) {
                    doc.addPage();
                    y = 10; // Reset y position for the new page
                }
            } else {
                y += 6; // Maintain spacing consistency
            }
            y += 6;
        });
        y += 5;

        // Tarkista, onko tilaa nykyisellä sivulla
        if (y + 20 > doc.internal.pageSize.height) {
            doc.addPage(); // Lisää uusi sivu
            y = 10; // Palauta y-koordinaatti
        }

        // Laske maksimipisteet dynaamisesti osiolle
        const osionKysymystenMäärä = vastaukset.length;
        const osionMaksimipisteet = osionKysymystenMäärä * 5;

        doc.setFont(undefined, 'bold').text(`Osion (${osionNimi}) yhteispisteet: ${osionPisteet} / ${osionMaksimipisteet}`, 10, y).setFont(undefined, 'normal');
        y += 6;

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
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold').text(`${textLines[i]}`, 10, y).setFont(undefined, 'normal');
            y += 4; // Increment y position after each line
        }
        doc.setFontSize(14);
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