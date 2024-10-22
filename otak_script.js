function laskePisteet(osio) {
    let osionPisteet = 0;
    // Hae kaikki tämän osion kysymykset
    const kysymykset = osio.querySelectorAll('.kysymys');
    // Käy läpi kaikki kysymykset
    kysymykset.forEach(kysymys => {
        // Hae valittu radiobutton
        const valittuVastaus = kysymys.querySelector('input[type="radio"]:checked');

        // Jos vastaus on valittu, lisää sen arvo yhteispisteisiin
        if (valittuVastaus) {
            osionPisteet += parseInt(valittuVastaus.value);
        }
    });
    // Päivitä osion yhteispisteet
    osio.querySelector('.osio-yhteispisteet span').textContent = osionPisteet;
    laskeKokonaispisteet(); // Päivitä kokonaispisteet
    // lisää kaikkiin kaavoihin html puolelle painoarvot
}

// pLasketaan osioiden pisteet ja kokonaispisteet sivun latauksen yhteydessä
document.addEventListener('DOMContentLoaded', () => {
    const osiot = document.querySelectorAll('.osio');
    osiot.forEach(osio => {
        const vastaukset = osio.querySelectorAll('.kysymys');
        let kokonaispisteet = 0;
        let osionPisteet = 0; 

        vastaukset.forEach(vastaus => {
            const pisteet = vastaus.querySelector('input[type="radio"]:checked')?.value || 0;
            osionPisteet += parseInt(pisteet); 
        });
        osiot.forEach(osio => {
            kokonaispisteet += parseInt(osio.querySelector('.osio-yhteispisteet span').textContent);
        });

        osio.querySelector('.osio-yhteispisteet span').textContent = osionPisteet.toString();
        document.getElementById('kokonaispisteet').textContent = kokonaispisteet;
    });
});

function laskeKokonaispisteet() {
    let kokonaispisteet = 0;
    const osiot = document.querySelectorAll('.osio');
    osiot.forEach(osio => {
        kokonaispisteet += parseInt(osio.querySelector('.osio-yhteispisteet span').textContent);
    });
    document.getElementById('kokonaispisteet').textContent = kokonaispisteet;
}

//autoresize textareas:
// Select all textareas on the page
const textareas = document.querySelectorAll('textarea');

// Add event listener to each textarea
textareas.forEach(textarea => {
    textarea.addEventListener('input', autoResize, false);
});

function autoResize() {
    this.style.height = 'auto'; // Reset height to auto to shrink if needed
    this.style.height = this.scrollHeight + 'px'; // Set height to scrollHeight
}