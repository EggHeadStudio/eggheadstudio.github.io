document.getElementById('vat').addEventListener('input', updateTotalPrice);
document.getElementById('price').addEventListener('input', updateTotalPrice);

function updateTotalPrice() {
  const price = parseFloat(document.getElementById('price').value) || 0;
  const vat = parseFloat(document.getElementById('vat').value) || 0;
  const totalPrice = price + (price * vat / 100);
  document.getElementById('totalPrice').value = totalPrice.toFixed(2);
}

function generatePDF() {
  const { jsPDF } = window.jspdf;
  const title = document.getElementById('contractTitle').value;
  const additionalTerms = document.getElementById('additionalTerms').value;
  const equipment = document.getElementById('equipment').value;
  const renterName = document.getElementById('renterName').value;
  const contactPerson = document.getElementById('contactPerson').value;
  const phoneNumber = document.getElementById('phoneNumber').value;
  const email = document.getElementById('email').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const price = document.getElementById('price').value;
  const vat = document.getElementById('vat').value;
  const totalPrice = document.getElementById('totalPrice').value;
  const rentalTerms = document.getElementById('rentalTerms').innerText;

  const logoInput = document.getElementById('logo');
  const backgroundInput = document.getElementById('background');

  if (backgroundInput.files.length > 0) {
    const backgroundFile = backgroundInput.files[0];
    if (backgroundFile.size > 5000000) { // Limit size to 5MB
      alert("Background image is too large. Please select a file smaller than 5MB.");
      return;
    }
    const backgroundReader = new FileReader();
    backgroundReader.onload = function(event) {
      const backgroundDataURL = event.target.result;
      if (logoInput.files.length > 0) {
        const logoFile = logoInput.files[0];
        if (logoFile.size > 5000000) { // Limit size to 5MB
          alert("Logo image is too large. Please select a file smaller than 5MB.");
          return;
        }
        const logoReader = new FileReader();
        logoReader.onload = function(event) {
          const logoDataURL = event.target.result;
          createPDFWithLogoAndBackground(logoDataURL, backgroundDataURL);
        };
        logoReader.onerror = function(event) {
          console.error("Error reading logo file", event);
          createPDFWithLogoAndBackground(null, backgroundDataURL); // Create PDF with only background image in case of error
        };
        logoReader.readAsDataURL(logoFile);
      } else {
        createPDFWithLogoAndBackground(null, backgroundDataURL);
      }
    };
    backgroundReader.onerror = function(event) {
      console.error("Error reading background file", event);
      createPDFWithLogoAndBackground(null, null); // Create PDF without the background image in case of error
    };
    backgroundReader.readAsDataURL(backgroundFile);
  } else if (logoInput.files.length > 0) {
    const logoFile = logoInput.files[0];
    if (logoFile.size > 5000000) { // Limit size to 5MB
      alert("Logo image is too large. Please select a file smaller than 5MB.");
      return;
    }
    const logoReader = new FileReader();
    logoReader.onload = function(event) {
      const logoDataURL = event.target.result;
      createPDFWithLogoAndBackground(logoDataURL, null);
    };
    logoReader.onerror = function(event) {
      console.error("Error reading logo file", event);
      createPDFWithLogoAndBackground(null, null); // Create PDF without the logo in case of error
    };
    logoReader.readAsDataURL(logoFile);
  } else {
    createPDFWithLogoAndBackground(null, null);
  }

  function createPDFWithLogoAndBackground(logoDataURL, backgroundDataURL) {
    const doc = new jsPDF();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - 2 * margin;

    if (backgroundDataURL) {
      // Add the background image with 0.05 opacity
      doc.setGState(new doc.GState({ opacity: 0.05 }));
      doc.addImage(backgroundDataURL, 'PNG', 0, 0, pageWidth, pageHeight);
      doc.setGState(new doc.GState({ opacity: 1.0 }));
    }

    if (logoDataURL) {
      // Set opacity to 50%
      doc.setGState(new doc.GState({ opacity: 0.5 }));
      doc.addImage(logoDataURL, 'PNG', pageWidth - 40, margin, 30, 30);
      // Reset opacity to default
      doc.setGState(new doc.GState({ opacity: 1.0 }));
    }

    doc.setFontSize(12);
    doc.text(title, margin, margin + 10);

    doc.setFontSize(10);
    doc.text('Yleiset vuokrausehdot:', margin, margin + 20);
    doc.setFontSize(8);
    const splitTerms = doc.splitTextToSize(rentalTerms, usableWidth);
    doc.text(splitTerms, margin, margin + 30);

    const termsHeight = splitTerms.length * 8 / 2;

    let currentY = margin + 40 + termsHeight;
    doc.setFontSize(10);

    doc.text('Lisäehdot:', margin, currentY);
    currentY += 10;
    doc.setFontSize(8);
    const splitAdditionalTerms = doc.splitTextToSize(additionalTerms, usableWidth);
    doc.text(splitAdditionalTerms, margin, currentY);

    const additionalTermsHeight = splitAdditionalTerms.length * 8 / 2;

    currentY += additionalTermsHeight + 10;
    doc.setFontSize(10);
    doc.text('Vuokrattavat laitteet:', margin, currentY);
    currentY += 10;
    doc.setFontSize(8);
    const splitEquipment = doc.splitTextToSize(equipment, usableWidth);
    doc.text(splitEquipment, margin, currentY);

    const equipmentHeight = splitEquipment.length * 8 / 2;

    currentY += equipmentHeight + 10;
    doc.setFontSize(10);
    doc.text(`Vuokraajan nimi tai yritys: ${renterName}`, margin, currentY);
    currentY += 5;
    doc.text(`Vastuuhenkilö: ${contactPerson}`, margin, currentY);
    currentY += 5;
    doc.text(`Puhelinnumero: ${phoneNumber}`, margin, currentY);
    currentY += 5;
    doc.text(`Sähköposti: ${email}`, margin, currentY);
    currentY += 10;
    doc.text(`Vuokra-aika alkaen: ${startDate}`, margin, currentY);
    currentY += 5;
    doc.text(`Vuokra-aika päättyen: ${endDate}`, margin, currentY);
    currentY += 10;
    doc.text(`Vuokran hinta (ilman ALV): ${price} €`, margin, currentY);
    currentY += 5;
    doc.text(`ALV%: ${vat}`, margin, currentY);
    currentY += 10;
    doc.text(`Vuokran kokonaishinta (sis. ALV): ${totalPrice} €`, margin, currentY);

    doc.save('vuokrasopimus.pdf');
  }
}
