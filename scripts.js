$(document).ready(function () {
  function isMobileDevice() {
      return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
  };

  $("#makeRoyaltyRecipe").click(function () {
      const payer = $("#payer").val();
      const year = $("#year").val();
      const period = $("#period").val();
      const amount = parseFloat($("#amount").val());
      const vatPercentage = parseFloat($("#vat").val());
      const perPlay = parseFloat($("#perPlay").val());
      const recipient = $("#recipient").val();

      const yearPattern = /^\d{4}$/; // Regex for four digits, representing a year
      const periodPattern = /^[a-zA-Z]+ - [a-zA-Z]+$/; // Regex for 'month - month' format

      if (!payer || !amount || !vatPercentage || !perPlay || !recipient) {
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

      const vatAmount = amount * (vatPercentage / 100);
      const listeningTimes = amount / perPlay;

      const royaltyContent = `
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
        <div style="font-size: 14px; text-align: center;">${payer}</div>
        <div style="font-size: 14px; text-align: center;">Year: ${year}</div>
        <div style="font-size: 14px; text-align: center;">Period: ${period}</div>
        <div style="font-size: 14px; text-align: center;">Royalty payd: ${amount.toFixed(2)}€</div>
        <div style="font-size: 14px; text-align: center;">VAT: ${vatAmount.toFixed(2)}€</div>
        <div style="font-size: 14px; text-align: center;">Listening times: ${listeningTimes.toFixed(0)}</div>
        <div style="font-size: 14px; text-align: center;">Payd to: ${recipient}</div>
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

      $("#payer").val("");
      $("#year").val("");
      $("#period").val("");
      $("#amount").val("");
      $("#vat").val("");
      $("#perPlay").val("0.005");
      $("#recipient").val("");
  });
});
