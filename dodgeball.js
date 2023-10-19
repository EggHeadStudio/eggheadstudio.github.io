//initialization-------------------------------------------------------------------------------------------------------------------------------
const gameArea = document.getElementById('game');
const player = document.createElement('div');
player.className = 'ball player';
gameArea.appendChild(player);

let playerSize = parseFloat(getComputedStyle(player).width);
let enemySize = playerSize * 0.7;  // Since enemies are 70% the size of the player

const enemies = [];
let isGameOver = false;
let enemySpawnInterval = null;  // Initialize to null
let startTime;
let endTime;
let highScore = localStorage.getItem('highScore') || 0;
document.getElementById('highscore').innerText = `High Score: ${highScore} seconds`;

let currentGameTime = 0;
let targetX = player.offsetLeft;
let targetY = player.offsetTop;
let isMoving = false;
let isPlayerMovingFunctionActive = false;

let joystickSpeed = { x: 0, y: 0 }; // to store speed values for joystick

const spawnPoints = [];  // Array to store the 4 spawn points

//playerMovement-------------------------------------------------------------------------------------------------------------------------------
//for mouse movement
gameArea.addEventListener('mousedown', (e) => {
    if (isGameOver) {
        startGame();
    } else {
        isMoving = true;
        targetX = e.clientX - gameArea.getBoundingClientRect().left;
        targetY = e.clientY - gameArea.getBoundingClientRect().top;
    }
});

gameArea.addEventListener('mousemove', (e) => {
    if (isMoving) {
        targetX = e.clientX - gameArea.getBoundingClientRect().left;
        targetY = e.clientY - gameArea.getBoundingClientRect().top;
    }
});

gameArea.addEventListener('mouseup', () => {
    isMoving = false;
});

//for touch movement
gameArea.addEventListener('touchstart', (e) => {
    if (isGameOver) {
        startGame();
    } else {
        isMoving = true;
        targetX = e.touches[0].clientX - gameArea.getBoundingClientRect().left;
        targetY = e.touches[0].clientY - gameArea.getBoundingClientRect().top;
    }
    e.preventDefault();  // Prevent the default behavior like scrolling
});

gameArea.addEventListener('touchmove', (e) => {
    if (isMoving) {
        targetX = e.touches[0].clientX - gameArea.getBoundingClientRect().left;
        targetY = e.touches[0].clientY - gameArea.getBoundingClientRect().top;
    }
    e.preventDefault();
});

gameArea.addEventListener('touchend', () => {
    isMoving = false;
});

function movePlayerTo() {
    if (isMoving) {
        let moveX, moveY;

        if (isJoystickActive) {
            moveX = joystickSpeed.x;
            moveY = joystickSpeed.y;
        } else {
            const dx = targetX - player.offsetLeft - (playerSize / 2);
            const dy = targetY - player.offsetTop - (playerSize / 2);
            const distance = Math.sqrt(dx*dx + dy*dy);
            moveX = 6 * (dx / distance); // speed is constant 3
            moveY = 6 * (dy / distance);
        }

        const nextLeft = player.offsetLeft + moveX;
        const nextTop = player.offsetTop + moveY;

        player.style.left = `${Math.min(Math.max(0, nextLeft), gameArea.clientWidth - playerSize)}px`;
        player.style.top = `${Math.min(Math.max(0, nextTop), gameArea.clientHeight - playerSize)}px`;

        if (!isPlayerMovingFunctionActive) {
            isPlayerMovingFunctionActive = true;
            requestAnimationFrame(movePlayerTo);
        }
    } else {
        isPlayerMovingFunctionActive = false;
    }
}

//Joystick movement
// Variables
const joystick = document.getElementById('joystick');
const joystickHandle = joystick.querySelector('.joystick-handle');
let isJoystickActive = false;
let joystickStart = { x: 0, y: 0 };

// Determine if we are on mobile
if ('ontouchstart' in window) {
    joystick.style.display = 'block';  // Show the joystick for mobile devices
}

joystick.addEventListener('touchstart', (e) => {
    isJoystickActive = true;
    isMoving = true;  // Set isMoving to true
    joystickStart.x = e.touches[0].clientX;
    joystickStart.y = e.touches[0].clientY;
    e.preventDefault();

    // Check if movePlayerTo should be called
    if (isMoving && !isPlayerMovingFunctionActive) {
        requestAnimationFrame(movePlayerTo);
    }
});

joystick.addEventListener('touchmove', (e) => {
    if (isJoystickActive) {
        const dx = e.touches[0].clientX - joystickStart.x;
        const dy = e.touches[0].clientY - joystickStart.y;
        
        const maxDistance = joystick.offsetWidth / 2;
        const distance = Math.min(maxDistance, Math.sqrt(dx*dx + dy*dy));
        const angle = Math.atan2(dy, dx);
        
        // Set speed based on joystick's displacement
        const proportion = distance / maxDistance;
        const calculatedSpeed = 6 * proportion; // max speed is 3

        joystickSpeed.x = calculatedSpeed * Math.cos(angle);
        joystickSpeed.y = calculatedSpeed * Math.sin(angle);
        
        // Update joystick handle position
        joystickHandle.style.left = `${50 + distance * Math.cos(angle)}%`;
        joystickHandle.style.top = `${50 + distance * Math.sin(angle)}%`;
    }
    e.preventDefault();
});

joystick.addEventListener('touchend', () => {
    isJoystickActive = false;
    isMoving = false;  // Set isMoving to false
    joystickHandle.style.left = '50%';  // Reset joystick handle to the center
    joystickHandle.style.top = '50%';
});

//enemies-----------------------------------------------------------------------------------------------------------------------------------
function initializeSpawnPoints() {
    for (let i = 0; i < 4; i++) {
        const spawnX = Math.random() * (gameArea.clientWidth - 20);
        const spawnY = Math.random() * (gameArea.clientHeight - 20);
        spawnPoints.push({ x: spawnX, y: spawnY });

        // Create cross-like marker for the spawn point
        const crossSize = 10;  // size of each line of the cross

        // Vertical line of the cross
        const verticalLine = document.createElement('div');
        verticalLine.className = 'spawn-marker-vertical';
        verticalLine.style.left = `${spawnX - 1}px`;  // -1 to center the 2px wide line
        verticalLine.style.top = `${spawnY - crossSize/2}px`;
        gameArea.appendChild(verticalLine);

        // Horizontal line of the cross
        const horizontalLine = document.createElement('div');
        horizontalLine.className = 'spawn-marker-horizontal';
        horizontalLine.style.left = `${spawnX - crossSize/2}px`;
        horizontalLine.style.top = `${spawnY - 1}px`;  // -1 to center the 2px high line
        gameArea.appendChild(horizontalLine);
    }
}

initializeSpawnPoints();

function spawnEnemy() {
    const enemy = document.createElement('div');
    enemy.className = 'ball enemy';

    // Pick a random spawn point
    const randomSpawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    enemy.style.left = `${randomSpawnPoint.x}px`;
    enemy.style.top = `${randomSpawnPoint.y}px`;

    // Random velocity but also ensure it's not too slow (i.e., > 0.5 in either direction)
    do {
        enemy.dx = (Math.random() * 8) - 2; 
    } while (Math.abs(enemy.dx) < 0.5);
    
    do {
        enemy.dy = (Math.random() * 8) - 2;
    } while (Math.abs(enemy.dy) < 0.5);
    
    gameArea.appendChild(enemy);
    enemies.push(enemy);
}

const MAX_SPEED = 8;  // Adjust this value as per your requirements

function moveEnemies() {
    const enemyComputedSize = enemies.length > 0 ? parseInt(getComputedStyle(enemies[0]).width, 10) : 20; // default to 20
    enemies.forEach((enemy, index) => {
        let x = enemy.offsetLeft + enemy.dx;
        let y = enemy.offsetTop + enemy.dy;

        // Correctly account for enemy's size
        if (x < 0 || x > gameArea.clientWidth - enemyComputedSize) {
            enemy.dx = -enemy.dx;
            x = x < 0 ? 0 : gameArea.clientWidth - enemyComputedSize;
        }
        if (y < 0 || y > gameArea.clientHeight - enemyComputedSize) {
            enemy.dy = -enemy.dy;
            y = y < 0 ? 0 : gameArea.clientHeight - enemyComputedSize;
        }

        // Check for collision with other enemies
        enemies.forEach((otherEnemy, otherIndex) => {
            if(index !== otherIndex) { 
                const dx = otherEnemy.offsetLeft - x;
                const dy = otherEnemy.offsetTop - y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < enemyComputedSize) { 
                    // Separate them
                    const overlap = enemyComputedSize - distance;
                    const angle = Math.atan2(dy, dx);

                    x -= overlap * Math.cos(angle) / 2;
                    y -= overlap * Math.sin(angle) / 2;

                    // Inverse directions
                    enemy.dx = -enemy.dx;
                    enemy.dy = -enemy.dy;

                    otherEnemy.dx = -otherEnemy.dx;
                    otherEnemy.dy = -otherEnemy.dy;
                }
            }
        });

        enemy.style.left = `${x}px`;
        enemy.style.top = `${y}px`;

        // Check for collision with player
        const dx = player.offsetLeft - x;
        const dy = player.offsetTop - y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance < (playerSize / 2 + enemySize / 2)) {
            gameOver();
        }
    });
}

//gameControl-----------------------------------------------------------------------------------------------------------------------------------
function gameOver() {
    isGameOver = true;
    if (enemySpawnInterval) {   // Clear the interval if it exists
        clearInterval(enemySpawnInterval);
        enemySpawnInterval = null;  // Set to null after clearing
    }
    endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // time in seconds
    if (duration > highScore) {
        highScore = duration;
        localStorage.setItem('highScore', highScore.toFixed(2));
        document.getElementById('highscore').innerText = `High Score: ${highScore.toFixed(2)} seconds`;
    }

    // Cleanup
    enemies.forEach(enemy => gameArea.removeChild(enemy));
    enemies.length = 0;

    // Show the custom game over modal
    document.getElementById('gameOverModal').style.display = 'block';
}
document.getElementById('playAgainButton').addEventListener('click', function() {
    document.getElementById('gameOverModal').style.display = 'none';
    window.location.reload();
});

document.getElementById('clearHighScoreButton').addEventListener('click', function() {
    localStorage.removeItem('highScore');
    document.getElementById('highscore').innerText = 'High Score: 0 seconds';
    document.getElementById('gameOverModal').style.display = 'none';
    window.location.reload();
});


function gameLoop() {
    if (!isGameOver) {
        movePlayerTo(); 
        moveEnemies();

        // Update game time and display
        const now = Date.now();
        currentGameTime = (now - startTime) / 1000;
        document.getElementById('current-time').innerText = `Time: ${currentGameTime.toFixed(2)} seconds`;

        requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    isGameOver = false;
    startTime = Date.now();
    gameLoop();

    if (enemySpawnInterval) {   // If there's an existing interval, clear it
        clearInterval(enemySpawnInterval);
    }

    enemySpawnInterval = setInterval(spawnEnemy, 2000);
}

//startGame();

//Ui----------------------------------------------------------------------------------------------------------------------------------------
// For background and character image swapping, you might want a more advanced setup.
// Here's a basic way:
function changePlayerImage(url) {
    player.style.backgroundImage = `url(${url})`;
    player.style.backgroundSize = 'cover';
    playerSize = parseFloat(getComputedStyle(player).width);  // Recalculate the size
    enemySize = playerSize * 0.7;  // Recalculate the enemy's size too
}
//changePlayerImage('/static/cloud.png');

function changeBackgroundImage(url) {
    gameArea.style.backgroundImage = `url(${url})`;
    gameArea.style.backgroundSize = 'cover';
}

// Example usage:
// changePlayerImage('path_to_your_image.png');
// changeBackgroundImage('path_to_your_bg_image.png');
startGame();
