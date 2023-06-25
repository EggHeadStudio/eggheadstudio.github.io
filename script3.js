function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
};
function calculateReferenceNumber(number) {
    const weights = [7, 3, 1];
    let sum = 0;
  
    for (let i = number.length - 1, j = 0; i >= 0; i--, j++) {
      sum += Number(number.charAt(i)) * weights[j % 3];
    }
  
    const checkDigit = (10 - (sum % 10)) % 10;
    return number + checkDigit;
  }
  
  function updateInputPlaceholder(isFocused) {
    const inputField = document.getElementById('inputField');
    if (isFocused) {
      inputField.placeholder = 'Asiakasnumero tai laskun numero';
    } else {
      if (!inputField.value) {
        inputField.placeholder = 'Syötä runkonumero';
      }
    }
  }
  
  function updateQuantityPlaceholder(isFocused) {
    const quantityField = document.getElementById('quantityField');
    if (isFocused) {
      if (!quantityField.value) {
        quantityField.value = 1;
      }
    } else {
      if (!quantityField.value) {
        quantityField.placeholder = 'Syötä haluttu kpl määrä';
      }
    }
  }
  
  function generateUniqueReferenceNumbers(base, count) {
    const referenceNumbers = [];
    const baseNumber = parseInt(base, 10);
    for (let i = 0; i < count; i++) {
      const number = String(baseNumber + i).padStart(base.length, '0');
      const referenceNumber = calculateReferenceNumber(number);
      referenceNumbers.push(referenceNumber);
    }
    return referenceNumbers;
  }
  
  function formatReferenceNumber(number) {
    return number.replace(/(\d)(?=(\d{5})+$)/g, '$1 ');
  }
  
  document.getElementById('inputField').addEventListener('focus', () => {
    updateInputPlaceholder(true);
  });
  
  document.getElementById('inputField').addEventListener('blur', () => {
    updateInputPlaceholder(false);
  });
  
  document.getElementById('quantityField').addEventListener('focus', () => {
    updateQuantityPlaceholder(true);
  });
  
  document.getElementById('quantityField').addEventListener('blur', () => {
    updateQuantityPlaceholder(false);
  });
  
  document.getElementById('calculateBtn').addEventListener('click', () => {
    const inputField = document.getElementById('inputField');
    const quantityField = document.getElementById('quantityField');
    const resultField = document.getElementById('resultField');
    const inputValue = inputField.value.trim();
    const quantityValue = parseInt(quantityField.value, 10);
  
    if (inputValue.length >= 3 && parseInt(inputValue, 10) >= 0) {
      const referenceNumbers = generateUniqueReferenceNumbers(inputValue, quantityValue);
      const formattedReferenceNumbers = referenceNumbers.map(formatReferenceNumber);
      resultField.innerHTML = formattedReferenceNumbers.join('<br>');
  
      // Add the 'wide' class to apply the bounce effect
      resultField.classList.add("wide");
    } else {
      alert('Syötä minimissään kolminumeroinen luku (ei etunollia). Asiakasnumero + laskun numero erotettuna nollalla. Esimerkiksi: 101');
      inputField.value = '';
      quantityField.value = '';
      resultField.textContent = '';
  
      // Remove the 'wide' class if the result field is empty
      resultField.classList.remove("wide");
    }
  });
  
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('inputField').value = '';
    document.getElementById('quantityField').value = '';
    document.getElementById('resultField').textContent = '';
  
    // Remove the 'wide' class when the reset button is clicked
    document.getElementById('resultField').classList.remove("wide");
  
    // Update the placeholder texts after resetting the fields
    updateInputPlaceholder(false);
    updateQuantityPlaceholder(false);
  });
  
  // Set the initial placeholder and value for the quantity field when the page loads
  document.addEventListener('DOMContentLoaded', () => {
    updateInputPlaceholder(false);
    updateQuantityPlaceholder(false);
  });
