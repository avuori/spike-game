// Game constants - will be scaled based on canvas size
let CANVAS_WIDTH = 800;
let CANVAS_HEIGHT = 600;
const BASE_CHARACTER_SIZE = 50;
const BASE_CHARACTER_COLLISION_SIZE = 35;
const BASE_OBSTACLE_WIDTH = 25;
const BASE_OBSTACLE_HEIGHT = 70;
const BASE_HEART_SIZE = 30;
const GRAVITY = 0.3;
const JUMP_FORCE = -8;
const BASE_GAME_SPEED = 3;
const MAX_GAME_SPEED = 25; // Higher maximum speed cap for continuous progression
const SPEED_INCREASE_RATE = 0.1; // How quickly speed increases with score

// Scale factors based on actual canvas size
let SCALE_X = 1;
let SCALE_Y = 1;
let CHARACTER_SIZE = BASE_CHARACTER_SIZE;
let CHARACTER_COLLISION_SIZE = BASE_CHARACTER_COLLISION_SIZE;
let OBSTACLE_WIDTH = BASE_OBSTACLE_WIDTH;
let OBSTACLE_HEIGHT = BASE_OBSTACLE_HEIGHT;
let HEART_SIZE = BASE_HEART_SIZE;

// Game state
let gameState = 'menu'; // menu, playing, gameOver
let selectedCharacter = null;
let score = 0;

// Game objects
let character = {
    x: 100,
    y: CANVAS_HEIGHT / 2,
    velocityY: 0,
    image: null
};

let obstacles = [];
let hearts = [];
let hurricanes = [];

// Sun object
let sun = {
    x: CANVAS_WIDTH - 120,
    y: 80,
    radius: 40
};

// DOM elements (initialized in init() function)
let canvas, ctx, menuScreen, gameUI, gameOver;
let scoreElement, finalScoreElement, restartBtn, musicToggleBtn, speedDisplayElement;

// Audio context for sound effects
let audioContext = null;
let backgroundMusicInterval = null;
let isMusicPlaying = false;
let musicEnabled = true;
let lastMusicSpeed = BASE_GAME_SPEED; // Track last speed for tempo changes

// Calculate dynamic game speed based on score
function getGameSpeed() {
    // Simple linear scaling: 0.1 speed increase per point for more noticeable effect
    const speedMultiplier = 1 + (score * 0.1);
    const currentSpeed = BASE_GAME_SPEED * speedMultiplier;

    // Cap the maximum speed to prevent it from becoming unplayable
    return Math.min(currentSpeed, MAX_GAME_SPEED);
}

// Update speed display in UI
function updateSpeedDisplay() {
    if (!speedDisplayElement) {
        console.error('Speed display element not found!');
        return;
    }

    const currentSpeed = getGameSpeed();
    const speedMultiplier = (currentSpeed / BASE_GAME_SPEED).toFixed(1);
    speedDisplayElement.textContent = speedMultiplier + 'x';
}

// Resize canvas and update game constants
function resizeCanvas() {
    const container = document.getElementById('game-container');
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Set canvas display size
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    // Set canvas actual size (for rendering)
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Update scale factors
    SCALE_X = containerWidth / 800;
    SCALE_Y = containerHeight / 600;

    // Update game constants based on scale
    CHARACTER_SIZE = BASE_CHARACTER_SIZE * Math.min(SCALE_X, SCALE_Y);
    CHARACTER_COLLISION_SIZE = BASE_CHARACTER_COLLISION_SIZE * Math.min(SCALE_X, SCALE_Y);
    OBSTACLE_WIDTH = BASE_OBSTACLE_WIDTH * SCALE_X;
    OBSTACLE_HEIGHT = BASE_OBSTACLE_HEIGHT * SCALE_Y;
    HEART_SIZE = BASE_HEART_SIZE * Math.min(SCALE_X, SCALE_Y);

    // Update canvas dimensions for game logic
    CANVAS_WIDTH = containerWidth;
    CANVAS_HEIGHT = containerHeight;

    // Update sun position
    sun.x = CANVAS_WIDTH - 120 * SCALE_X;
    sun.y = 80 * SCALE_Y;
    sun.radius = 40 * Math.min(SCALE_X, SCALE_Y);

    // Update character position if needed
    if (character.x > CANVAS_WIDTH - CHARACTER_SIZE) {
        character.x = CANVAS_WIDTH - CHARACTER_SIZE;
    }
    if (character.y > CANVAS_HEIGHT - CHARACTER_SIZE) {
        character.y = CANVAS_HEIGHT - CHARACTER_SIZE;
    }
    if (character.y < 0) {
        character.y = 0;
    }
}

// Initialize game
function init() {
    // Initialize DOM elements
    canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context!');
        return;
    }
    menuScreen = document.getElementById('menu-screen');
    gameUI = document.getElementById('game-ui');
    gameOver = document.getElementById('game-over');
    scoreElement = document.getElementById('score');
    finalScoreElement = document.getElementById('final-score');
    restartBtn = document.getElementById('restart-btn');
    musicToggleBtn = document.getElementById('music-toggle');
    speedDisplayElement = document.getElementById('speed-display');

    // Resize canvas initially
    resizeCanvas();

    // Set up event listeners
    document.getElementById('cow-option').addEventListener('click', () => selectCharacter('cow'));
    document.getElementById('snow-white-option').addEventListener('click', () => selectCharacter('snow_white'));
    document.addEventListener('keydown', handleKeyPress);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleCanvasClick); // Fallback for mobile

    // Backup touch listeners on document (for some mobile browsers)
    document.addEventListener('touchstart', handleDocumentTouchStart, { passive: false });
    restartBtn.addEventListener('click', restartGame);
    //musicToggleBtn.addEventListener('click', toggleMusic);
    window.addEventListener('resize', resizeCanvas);

    // Initialize audio context
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported');
    }

    // Load character images
    loadCharacterImages();

    // Start game loop
    gameLoop();
}

// Character selection
function selectCharacter(characterType) {
    selectedCharacter = characterType;
    const image = new Image();
    image.src = `assets/${characterType}.png`;
    image.onload = () => {
        character.image = image;
        gameState = 'playing';
        menuScreen.style.display = 'none';
        gameUI.style.display = 'block';
        // Start background music when game begins (if enabled)
        if (musicEnabled) {
            startBackgroundMusic();
        }
        // Initialize speed display
        updateSpeedDisplay();
    };
}

// Load character images
function loadCharacterImages() {
    // Images are loaded when character is selected
}

// Handle keyboard input
function handleKeyPress(event) {
    if (gameState === 'playing') {
        if (event.code === 'Space' || event.code === 'ArrowUp') {
            event.preventDefault();
            character.velocityY = JUMP_FORCE;
            playJumpSound();
        }
    } else if (gameState === 'gameOver' && event.code === 'Enter') {
        restartGame();
    }
}

// Handle touch start events
function handleTouchStart(event) {
    event.preventDefault();
    event.stopPropagation();
    if (gameState === 'playing') {
        character.velocityY = JUMP_FORCE;
        playJumpSound();
    }
}

// Handle touch end events (for potential future features)
function handleTouchEnd(event) {
    event.preventDefault();
    event.stopPropagation();
    // Currently no action needed on touch end, but prevents default behavior
}

// Handle mouse down events (for desktop click support)
function handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (gameState === 'playing') {
        character.velocityY = JUMP_FORCE;
        playJumpSound();
    }
}

// Handle mouse up events (for potential future features)
function handleMouseUp(event) {
    event.preventDefault();
    event.stopPropagation();
    // Currently no action needed on mouse up, but prevents default behavior
}

// Handle canvas click events (fallback for mobile)
function handleCanvasClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (gameState === 'playing') {
        character.velocityY = JUMP_FORCE;
        playJumpSound();
    }
}

// Handle document touch events (backup for mobile browsers)
function handleDocumentTouchStart(event) {
    // Only handle if the target is the canvas or game container and game is playing
    if (gameState === 'playing' && (event.target === canvas || event.target.id === 'game-container')) {
        event.preventDefault();
        character.velocityY = JUMP_FORCE;
        playJumpSound();
    }
}

// Play jump sound effect
function playJumpSound() {
    if (audioContext) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }
}

// Play heart collection sound
function playHeartSound() {
    if (audioContext) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Pleasant "blim" sound - rising then falling tone
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(500, audioContext.currentTime + 0.05);
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }
}

// Toggle music on/off
function toggleMusic() {
    musicEnabled = !musicEnabled;

    if (musicEnabled) {
        if (musicToggleBtn) {
            musicToggleBtn.textContent = '🔊 Music: ON';
            musicToggleBtn.classList.remove('music-off');
        }
        // Start music if we're currently playing the game
        if (gameState === 'playing') {
            startBackgroundMusic();
        }
    } else {
        if (musicToggleBtn) {
            musicToggleBtn.textContent = '🔇 Music: OFF';
            musicToggleBtn.classList.add('music-off');
        }
        // Stop music
        stopBackgroundMusic();
    }
}

// Start continuous background music with dynamic tempo
function startBackgroundMusic() {
    if (!audioContext || isMusicPlaying || !musicEnabled) return;

    isMusicPlaying = true;

    // Melodic sequence for background music
    const melody = [
        { note: 261.63, duration: 0.4 }, // C4
        { note: 293.66, duration: 0.4 }, // D4
        { note: 329.63, duration: 0.4 }, // E4
        { note: 349.23, duration: 0.4 }, // F4
        { note: 392.00, duration: 0.4 }, // G4
        { note: 440.00, duration: 0.4 }, // A4
        { note: 493.88, duration: 0.4 }, // B4
        { note: 523.25, duration: 0.8 }, // C5
        // Descending
        { note: 493.88, duration: 0.3 }, // B4
        { note: 440.00, duration: 0.3 }, // A4
        { note: 392.00, duration: 0.3 }, // G4
        { note: 349.23, duration: 0.3 }, // F4
        { note: 329.63, duration: 0.3 }, // E4
        { note: 293.66, duration: 0.3 }, // D4
        { note: 261.63, duration: 0.6 }, // C4
    ];

    let currentNoteIndex = 0;

    // Function to play the next note with current tempo
    const playNextNote = () => {
        if (!isMusicPlaying || !audioContext) {
            stopBackgroundMusic();
            return;
        }

        const currentNote = melody[currentNoteIndex];
        playMusicNote(currentNote.note, currentNote.duration);

        currentNoteIndex = (currentNoteIndex + 1) % melody.length;

        // Add some variation every few cycles
        if (currentNoteIndex === 0 && Math.random() < 0.3) {
            // Occasionally play a higher harmony note
            setTimeout(() => {
                if (isMusicPlaying) {
                    playMusicNote(523.25 * 1.5, 0.2); // Higher harmony
                }
            }, 100);
        }

        // Schedule next note based on current game speed
        const baseInterval = 400; // Base interval in milliseconds
        const currentSpeed = getGameSpeed();
        const speedMultiplier = currentSpeed / BASE_GAME_SPEED;
        const dynamicInterval = baseInterval / speedMultiplier;

        // Store current speed for next comparison
        lastMusicSpeed = currentSpeed;

        backgroundMusicInterval = setTimeout(playNextNote, dynamicInterval);
    };

    // Start the music sequence
    playNextNote();
}

// Play individual music note
function playMusicNote(frequency, duration) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Add some reverb-like effect with a filter
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioContext.currentTime);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // Create a nice envelope for the note
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime + duration - 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Stop background music
function stopBackgroundMusic() {
    isMusicPlaying = false;
    if (backgroundMusicInterval) {
        clearTimeout(backgroundMusicInterval);
        backgroundMusicInterval = null;
    }
}

// Play hurricane sound effect
function playHurricaneSound() {
    if (audioContext) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Low frequency rumble with noise-like quality
        oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(60, audioContext.currentTime + 0.2);

        // Low-pass filter for windy effect
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, audioContext.currentTime);
        filter.Q.setValueAtTime(10, audioContext.currentTime);

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}

// Update game objects
function update() {
    // Allow hurricanes to move during all game states to prevent them from appearing frozen
    // Update hurricanes with realistic movement
    for (let i = hurricanes.length - 1; i >= 0; i--) {
        const hurricane = hurricanes[i];

        // Horizontal movement with speed variation
        hurricane.x -= hurricane.horizontalSpeed;

        // Vertical oscillation (up and down movement like real hurricanes)
        const time = Date.now() * hurricane.verticalSpeed + hurricane.oscillationOffset;
        hurricane.y = hurricane.originalY + Math.sin(time) * hurricane.oscillationAmplitude;

        // Ensure hurricane stays within screen bounds
        if (hurricane.y < 0) {
            hurricane.y = 0;
            hurricane.originalY = hurricane.y; // Reset oscillation center
        } else if (hurricane.y + hurricane.size > CANVAS_HEIGHT) {
            hurricane.y = CANVAS_HEIGHT - hurricane.size;
            hurricane.originalY = hurricane.y; // Reset oscillation center
        }

        // Update rotation
        hurricane.rotation += hurricane.rotationSpeed;

        // Remove when off-screen
        if (hurricane.x + hurricane.size < 0) {
            hurricanes.splice(i, 1);
        }
    }

    if (gameState !== 'playing') return;

    // Update character
    character.velocityY += GRAVITY;
    character.y += character.velocityY;

    // Keep character in bounds
    if (character.y < 0) {
        character.y = 0;
        character.velocityY = 0;
    }
    if (character.y > CANVAS_HEIGHT - CHARACTER_SIZE) {
        character.y = CANVAS_HEIGHT - CHARACTER_SIZE;
        character.velocityY = 0;
    }

    // Spawn obstacles (reduced frequency for easier gameplay)
    if (Math.random() < 0.008) {
        spawnObstacle();
    }

    // Spawn hearts (slightly increased for better reward balance)
    if (Math.random() < 0.018) {
        spawnHeart();
    }

    // Spawn hurricanes (rare but dangerous) - only one at a time
    if (Math.random() < 0.005 && hurricanes.length === 0) {
        spawnHurricane();
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= getGameSpeed();
        if (obstacles[i].x + OBSTACLE_WIDTH < 0) {
            obstacles.splice(i, 1);
        }
    }

    // Update hearts
    for (let i = hearts.length - 1; i >= 0; i--) {
        hearts[i].x -= getGameSpeed();
        if (hearts[i].x + HEART_SIZE < 0) {
            hearts.splice(i, 1);
        }
    }

    // Check collisions
    checkCollisions();
}

// Spawn obstacle (spike)
function spawnObstacle() {
    const y = Math.random() * (CANVAS_HEIGHT - OBSTACLE_HEIGHT);
    obstacles.push({
        x: CANVAS_WIDTH,
        y: y,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT
    });
}

// Spawn heart
function spawnHeart() {
    const y = Math.random() * (CANVAS_HEIGHT - HEART_SIZE);
    hearts.push({
        x: CANVAS_WIDTH,
        y: y,
        width: HEART_SIZE,
        height: HEART_SIZE
    });
}

// Spawn hurricane
function spawnHurricane() {
    const size = 80 + Math.random() * 40; // Random size between 80-120px
    const y = Math.random() * (CANVAS_HEIGHT - size);
    hurricanes.push({
        x: CANVAS_WIDTH,
        y: y,
        originalY: y, // Store original Y position for oscillation
        size: size,
        rotation: 0,
        rotationSpeed: 0.05 + Math.random() * 0.1, // Random rotation speed
        horizontalSpeed: getGameSpeed() * (0.8 + Math.random() * 0.4), // 80%-120% of current game speed
        verticalSpeed: 0.02 + Math.random() * 0.04, // Vertical oscillation speed
        oscillationAmplitude: 20 + Math.random() * 30, // How far it moves up/down
        oscillationOffset: Math.random() * Math.PI * 2 // Random starting phase
    });

    // Play hurricane sound effect
    playHurricaneSound();
}

// Check collisions
function checkCollisions() {
    // Check obstacle collisions
    // Use smaller collision box centered on character
    const collisionOffset = (CHARACTER_SIZE - CHARACTER_COLLISION_SIZE) / 2;
    const charLeft = character.x + collisionOffset;
    const charRight = character.x + collisionOffset + CHARACTER_COLLISION_SIZE;
    const charTop = character.y + collisionOffset;
    const charBottom = character.y + collisionOffset + CHARACTER_COLLISION_SIZE;

    for (let obstacle of obstacles) {
        if (charLeft < obstacle.x + obstacle.width &&
            charRight > obstacle.x &&
            charTop < obstacle.y + obstacle.height &&
            charBottom > obstacle.y) {
            gameOverFunction();
            return;
        }
    }

    // Check heart collisions
    for (let i = hearts.length - 1; i >= 0; i--) {
        const heart = hearts[i];
        if (charLeft < heart.x + heart.width &&
            charRight > heart.x &&
            charTop < heart.y + heart.height &&
            charBottom > heart.y) {
            // Collect heart
            hearts.splice(i, 1);
            score += 1;
            if (scoreElement) scoreElement.textContent = score;
            updateSpeedDisplay();
            playHeartSound();
        }
    }

    // Check hurricane collisions (dangerous!)
    for (let hurricane of hurricanes) {
        if (charLeft < hurricane.x + hurricane.size &&
            charRight > hurricane.x &&
            charTop < hurricane.y + hurricane.size &&
            charBottom > hurricane.y) {
            gameOverFunction();
            return;
        }
    }
}

// Game over
function gameOverFunction() {
    gameState = 'gameOver';
    if (finalScoreElement) finalScoreElement.textContent = score;
    gameOver.style.display = 'block';
    gameUI.style.display = 'none';

    // Stop background music
    stopBackgroundMusic();

    // Close audio context to clean up
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

// Restart game
function restartGame() {
    gameState = 'menu';
    score = 0;
    if (scoreElement) scoreElement.textContent = score;
    if (finalScoreElement) finalScoreElement.textContent = score;
    updateSpeedDisplay(); // Reset speed display
    lastMusicSpeed = BASE_GAME_SPEED; // Reset music speed tracking

    // Reset character
    character.x = 100 * SCALE_X; // Scale initial X position
    character.y = CANVAS_HEIGHT / 2;
    character.velocityY = 0;
    character.image = null;

    // Clear objects
    obstacles = [];
    hearts = [];
    hurricanes = [];

    // Stop background music when returning to menu
    stopBackgroundMusic();

    // Reset UI
    menuScreen.style.display = 'flex';
    gameUI.style.display = 'none';
    gameOver.style.display = 'none';

    // Reinitialize audio
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported');
    }
}

// Draw sun
function drawSun() {
    // Main sun body
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        const rayLength = sun.radius + 15;
        const innerLength = sun.radius + 5;

        ctx.beginPath();
        ctx.moveTo(
            sun.x + Math.cos(angle) * innerLength,
            sun.y + Math.sin(angle) * innerLength
        );
        ctx.lineTo(
            sun.x + Math.cos(angle) * rayLength,
            sun.y + Math.sin(angle) * rayLength
        );
        ctx.stroke();
    }

    // Sun glow effect
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.radius + 10, 0, Math.PI * 2);
    ctx.fill();
}

// Draw hurricane with enhanced visual effects
function drawHurricane(hurricane) {
    const centerX = hurricane.x + hurricane.size / 2;
    const centerY = hurricane.y + hurricane.size / 2;

    // Calculate movement intensity for visual effects
    const movementIntensity = Math.abs(Math.sin(Date.now() * hurricane.verticalSpeed + hurricane.oscillationOffset));

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(hurricane.rotation);

    // Outer storm clouds (dark gray) - opacity varies with movement
    const outerOpacity = 0.6 + movementIntensity * 0.3;
    ctx.fillStyle = `rgba(47, 79, 79, ${outerOpacity})`;
    ctx.beginPath();
    ctx.arc(0, 0, hurricane.size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Inner swirling clouds (lighter gray) - more dynamic
    ctx.fillStyle = 'rgba(105, 105, 105, 0.7)';
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + hurricane.rotation;
        const distance = hurricane.size / 4 + Math.sin(Date.now() * 0.01 + i) * 5;
        ctx.beginPath();
        ctx.arc(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            hurricane.size / 6 + Math.sin(Date.now() * 0.005 + i) * 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    // Eye of the storm (lighter center) - pulsing effect
    const eyeOpacity = 0.3 + movementIntensity * 0.4;
    ctx.fillStyle = `rgba(169, 169, 169, ${eyeOpacity})`;
    ctx.beginPath();
    ctx.arc(0, 0, hurricane.size / 8, 0, Math.PI * 2);
    ctx.fill();

    // Lightning effects (more frequent and varied)
    if (Math.random() < 0.4 || movementIntensity > 0.8) {
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 2 + movementIntensity * 2;
        ctx.beginPath();

        // Random lightning pattern
        const lightningType = Math.floor(Math.random() * 3);
        if (lightningType === 0) {
            // Diagonal lightning
            ctx.moveTo(-hurricane.size / 4, -hurricane.size / 4);
            ctx.lineTo(hurricane.size / 4, hurricane.size / 4);
        } else if (lightningType === 1) {
            // Vertical lightning
            ctx.moveTo(0, -hurricane.size / 3);
            ctx.lineTo(0, hurricane.size / 3);
        } else {
            // Horizontal lightning
            ctx.moveTo(-hurricane.size / 3, 0);
            ctx.lineTo(hurricane.size / 3, 0);
        }
        ctx.stroke();
    }

    ctx.restore();

    // Enhanced wind effect lines - more dynamic
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1 + movementIntensity;
    for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 + hurricane.rotation * 2 + movementIntensity * Math.PI;
        const startDistance = hurricane.size / 2 + 10;
        const endDistance = hurricane.size / 2 + 30 + movementIntensity * 20;

        ctx.beginPath();
        ctx.moveTo(
            centerX + Math.cos(angle) * startDistance,
            centerY + Math.sin(angle) * startDistance
        );
        ctx.lineTo(
            centerX + Math.cos(angle) * endDistance,
            centerY + Math.sin(angle) * endDistance
        );
        ctx.stroke();
    }

    // Add trailing effect for movement visibility
    if (hurricane.horizontalSpeed > getGameSpeed() * 0.9) {
        ctx.fillStyle = 'rgba(47, 79, 79, 0.2)';
        ctx.beginPath();
        ctx.arc(centerX + 20, centerY, hurricane.size / 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Render game
function render() {
    if (!ctx) return; // Don't render if canvas context is not available

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw sun
    drawSun();

    // Draw clouds or simple background elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 5; i++) {
        const x = (i * 200) % CANVAS_WIDTH;
        const y = 50 + i * 30;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 40, y, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 20, y - 15, 20, 0, Math.PI * 2);
        ctx.fill();
    }

    if (gameState === 'playing') {
        // Draw character
        if (character.image) {
            ctx.drawImage(character.image, character.x, character.y, CHARACTER_SIZE, CHARACTER_SIZE);
        }

        // Draw obstacles (spikes)
        ctx.fillStyle = '#0066CC';
        for (let obstacle of obstacles) {
            ctx.beginPath();
            ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
            ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
            ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
            ctx.closePath();
            ctx.fill();
        }

        // Draw hearts
        ctx.fillStyle = '#FF69B4';
        for (let heart of hearts) {
            ctx.beginPath();
            ctx.arc(heart.x + heart.width / 2, heart.y + heart.height / 2, heart.width / 2, 0, Math.PI * 2);
            ctx.fill();
            // Simple heart shape
            ctx.fillStyle = '#DC143C';
            ctx.beginPath();
            ctx.arc(heart.x + heart.width * 0.3, heart.y + heart.height * 0.3, heart.width * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(heart.x + heart.width * 0.7, heart.y + heart.height * 0.3, heart.width * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(heart.x + heart.width * 0.25, heart.y + heart.height * 0.4, heart.width * 0.5, heart.height * 0.3);
        }
    }

    // Draw hurricanes (visible during all game states)
    for (let hurricane of hurricanes) {
        drawHurricane(hurricane);
    }
}

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Start the game when page loads
window.addEventListener('load', init);
