$(document).ready(function () {
  function isMobileDevice() {
      return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
  };

  $("#makeRoyaltyRecipe").click(function () {
      const payer = $("#payer").val();
      const year = $("#year").val();
      const monthPaid = $("#monthPaid").val();
      const period = $("#period").val();
      let amount = parseFloat($("#amount").val());
      //const originalAmount = amount;  // Säilytetään alkuperäinen summa
      const comission = parseFloat($("#comission").val());
      const vatPercentage = parseFloat($("#vat").val());
      const perPlay = parseFloat($("#perPlay").val());
      const recipient = $("#recipient").val();
      const commissionSwitch = $("#commissionSwitch").is(":checked");

      let originalAmount = 0;  // Alustetaan alkuperäinen summa

      if (!commissionSwitch) {  // Jos checkboxia ei ole valittu
          originalAmount = amount / (1 - comission / 100);
      } else {  // Jos checkbox on valittu
          originalAmount = amount;
      }

      const yearPattern = /^\d{4}$/; // Regex for four digits, representing a year
      const periodPattern = /^[a-zA-Z]+ - [a-zA-Z]+$/; // Regex for 'month - month' format

      if (!payer || !monthPaid || !comission || !amount || !vatPercentage || !perPlay || !recipient) {
          alert("Täytä kaikki syöttökentät.");
          return;
      }

      if (!yearPattern.test(year)) {
          alert("Vuoden pitää olla nelinumeroinen luku.");
          return;
      }

      if (!periodPattern.test(period)) {
          alert("Aikajakson pitää olla muodossa 'kuukausi - kuukausi'.");
          return;
      }

      if (commissionSwitch) {
          amount = amount * (1 - comission / 100);
      }
        
      const vatAmount = amount * (vatPercentage / 100);
      const listeningTimes = originalAmount / perPlay;
      const comissionAmount = originalAmount * (comission / 100);

      const royaltyContent = `
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
        <h1 style="font-size: 18px; font-weight: bold;">Royalty Revenue Recipe</h1>
        <div style="display: flex; flex-direction: column; align-items: center; width: 80%; margin: auto;">
        <div style="font-size: 18px; text-align: center; margin-bottom: 20px;">${payer}</div>
      <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">Year:</span>
          <span style="font-size: 14px; text-align: right;">${year}</span>
      </div>
      <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">Month in revenue is paid:</span>
          <span style="font-size: 14px; text-align: right;">${monthPaid}</span>
      </div>
      <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">Period:</span>
          <span style="font-size: 14px; text-align: right;">${period}</span>
      </div>
      <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">Royalty payd:</span>
          <span style="font-size: 14px; text-align: right;">${amount.toFixed(2)}€</span>
      </div>
      <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">Comission on sales:</span>
          <span style="font-size: 14px; text-align: right;">(${comissionAmount.toFixed(2)}€)   ${comission}%</span>
      </div>
      <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">VAT from Royalty payd:</span>
          <span style="font-size: 14px; text-align: right;">(${vatAmount.toFixed(2)}€)   ${vatPercentage}%</span>
      </div>
      <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">Estimated streaming times:</span>
          <span style="font-size: 14px; text-align: right;">${listeningTimes.toFixed(0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
          <span style="font-size: 14px;">Payd (${amount.toFixed(2)}€) to:</span>
          <span style="font-size: 14px; text-align: right;">${recipient}</span>
        </div>
        <hr style="width: 100%;"> <!-- Uusi rivi: lisää viiva -->
          <div style="display: flex; justify-content: flex-end; width: 100%; margin-bottom: 10px;"> <!-- Uusi rivi: total amount -->
              <span style="font-size: 14px; text-align: right;">Total amount: ${amount.toFixed(2)}€</span>
          </div>
          <div style="display: flex; justify-content: flex-end; width: 100%; margin-bottom: 10px;"> <!-- Uusi rivi: VAT -->
              <span style="font-size: 14px; text-align: right;">VAT: ${vatAmount.toFixed(2)}€</span>
          </div>
        </div>
        `;

      const royaltyElement = document.createElement('div');
      royaltyElement.innerHTML = royaltyContent;

      const opt = {
        margin: 1,
        filename: 'royalty-recipe.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      };

      if (isMobileDevice()) {
          html2pdf().set(opt).from(royaltyElement).toPdf().get('pdf').output('arraybuffer').then(function (pdfBuffer) {
              const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
              saveAs(pdfBlob, 'royalty-recipe.pdf');
          });
      } else {
          html2pdf().set(opt).from(royaltyElement).toPdf().get('pdf').then(function (pdf) {
              const totalPages = pdf.internal.getNumberOfPages();
              for (let i = 1; i <= totalPages; i++) {
                  pdf.setPage(i);
                  pdf.setFontSize(12);
                  pdf.setTextColor(150);
              }
              window.open(pdf.output('bloburl'), '_blank');
          });
      }

      // Resetting the fields
      $("#payer").val("");
      $("#year").val("");
      $("#monthPaid").val("");
      $("#period").val("");
      $("#amount").val("");
      $("#comission").val("");
      $("#vat").val("");
      $("#perPlay").val("0.0042");
      $("#recipient").val("");
      $("#commissionSwitch").prop("checked", false);
  });
});
