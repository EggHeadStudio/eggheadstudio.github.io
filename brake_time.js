const timerButton = document.getElementById('timerButton');
const minusButton = document.getElementById('minusButton');
const plusButton = document.getElementById('plusButton');
const headLabel = document.getElementById('headLabel');
const timerDisplay = document.getElementById('timer');
const counterLabel = document.getElementById('counterLabel');
const audio = new Audio('brake1.mp3');
let countdownInterval;
let remainingSeconds = 0;
let running = false;

// Initialize counter value to 0
let counterValue = 0;
counterLabel.textContent = counterValue + " Items";

document.addEventListener('keypress', function(event) {
    if (event.key === 's') {
        timerButton.click();
    }
});

timerButton.addEventListener('click', () => {
    if (timerButton.textContent === 'Start') {
        const hours = parseInt(prompt("Enter hours:")) || 0;
        const minutes = parseInt(prompt("Enter minutes:")) || 0;
        const seconds = parseInt(prompt("Enter seconds:")) || 0;
        remainingSeconds = hours * 3600 + minutes * 60 + seconds;
        running = true;
        updateTimer();
        timerButton.textContent = 'Reset';
        headLabel.textContent = '';
        timerButton.style.backgroundColor = '#dc3545'; // Red color for Reset
    } else {
        clearTimeout(countdownInterval);
        running = false;
        remainingSeconds = 0;
        timerDisplay.textContent = "00:00:00";
        timerButton.textContent = 'Start';
        headLabel.textContent = 'Brake Time Countdown';
        timerButton.style.backgroundColor = '#28a745'; // Green color for Start
        incrementCounter();
        audio.pause();  // Pause audio when reset button is pressed
        audio.currentTime = 0;  // Reset audio to the beginning
    }
});

minusButton.addEventListener('click', () => {
    if (counterValue > 0) {
        counterValue--;
        counterLabel.textContent = counterValue + " Items";
    }
});

plusButton.addEventListener('click', () => {
    counterValue++;
    counterLabel.textContent = counterValue + " Items";
});

function updateTimer() {
    if (remainingSeconds > 0 && running) {
        const hours = Math.floor(remainingSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
        remainingSeconds--;
        countdownInterval = setTimeout(updateTimer, 1000);
    } else if (remainingSeconds === 0) {
        timerDisplay.textContent = "NOW IT IS TIME FOR A BRAKE!";
        audio.play();
    }
}

function incrementCounter() {
    counterValue++;
    counterLabel.textContent = counterValue + " Items";
}