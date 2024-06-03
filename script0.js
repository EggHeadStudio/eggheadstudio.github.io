document.addEventListener("DOMContentLoaded", function() {
    const logo = document.querySelector('.logo');
    const body = document.body;
    const buttons = document.querySelector('.button-container');
    let toggled = false;
  
    logo.addEventListener('click', function() {
      if (!toggled) {
        // Rotate and change size to smaller
        logo.style.width = '150px'; // Smaller fixed size
        logo.style.transform = 'rotate(360deg) ease-in-out'; // Rotate

        // Change background and show buttons
        body.style.backgroundColor = '#fafafa';
        buttons.classList.add('visible'); // Make buttons visible
        toggled = true;
      } else {
        // Rotate back and change size to larger
        logo.style.width = '300px'; // Larger fixed size
        logo.style.transform = 'rotate(0deg) ease-in-out'; // Rotate back

        // Revert background and hide buttons
        body.style.backgroundColor = '#050505';
        buttons.classList.remove('visible'); // Make buttons hidden
        toggled = false;
      }
    });
});
