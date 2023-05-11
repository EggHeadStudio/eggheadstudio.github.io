$(document).ready(function () {
    $("#makeRoyaltyRecipe").click(function () {
        const payer = $("#payer").val();
        const amount = parseFloat($("#amount").val());
        const vatPercentage = parseFloat($("#vat").val());
        const perPlay = parseFloat($("#perPlay").val());
        const recipient = $("#recipient").val();

        if (!payer || !amount || !vatPercentage || !perPlay || !recipient) {
            alert("Täytä kaikki syöttökentät.");
            return;
        }

        const vatAmount = amount * (vatPercentage / 100);
        const listeningTimes = amount / perPlay;

        const royaltyContent = `
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <div style="font-size: 14px; text-align: center;">${payer}</div>
          <div style="font-size: 14px; text-align: center;">Royalty payd: ${amount.toFixed(2)}€</div>
          <div style="font-size: 14px; text-align: center;">VAT: ${vatAmount.toFixed(2)}€</div>
          <div style="font-size: 14px; text-align: center;">Listening times: ${listeningTimes.toFixed(0)}</div>
          <div style="font-size: 14px; text-align: center;">Payd to: ${recipient}</div>
        </div>
        `;

        const royaltyElement = document.createElement('div');
        royaltyElement.innerHTML = royaltyContent;

        html2canvas(royaltyElement, { scale: 2 }).then(function (canvas) {
            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdf = new jsPDF({
                unit: 'in',
                format: 'a4',
                orientation: 'portrait'
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('royalty-recipe.pdf');
        });

        $("#payer").val("");
        $("#amount").val("");
        $("#vat").val("");
        $("#perPlay").val("0.0005");
        $("#recipient").val("");
    });
});
