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

// Power-up system
let activePowerUps = [];
let powerUpSpawnTimer = 0;

// Game objects
let character = {
    x: 100,
    y: CANVAS_HEIGHT / 2,
    velocityY: 0,
    image: null,
    trail: [],
    glowIntensity: 0,
    shield: false,
    speedBoost: false,
    magnet: false,
    rainbow: false
};

let obstacles = [];
let hearts = [];
let hurricanes = [];
let particles = []; // Particle system for effects
let powerUps = []; // Power-up system

// Sun object with enhanced properties
let sun = {
    x: CANVAS_WIDTH - 120,
    y: 80,
    radius: 40,
    glowRadius: 60,
    pulseOffset: 0
};

// Background elements
let stars = [];
let backgroundElements = [];

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

    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // Use device pixel ratio for crisp rendering on high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Set canvas display size to full screen
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    // Set canvas actual size (for rendering) - account for device pixel ratio
    const renderWidth = Math.floor(containerWidth * devicePixelRatio);
    const renderHeight = Math.floor(containerHeight * devicePixelRatio);

    canvas.width = renderWidth;
    canvas.height = renderHeight;

    // Scale the drawing context for crisp rendering
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Update scale factors (based on display size, not render size)
    SCALE_X = containerWidth / 800;
    SCALE_Y = containerHeight / 600;

    // Update game constants based on scale
    CHARACTER_SIZE = BASE_CHARACTER_SIZE * Math.min(SCALE_X, SCALE_Y);
    CHARACTER_COLLISION_SIZE = BASE_CHARACTER_COLLISION_SIZE * Math.min(SCALE_X, SCALE_Y);
    OBSTACLE_WIDTH = BASE_OBSTACLE_WIDTH * SCALE_X;
    OBSTACLE_HEIGHT = BASE_OBSTACLE_HEIGHT * SCALE_Y;

    // Make hearts scale relative to height, especially in portrait mode
    const aspectRatio = containerWidth / containerHeight;
    const isPortrait = aspectRatio < 1; // Height > Width

    if (isPortrait) {
        // In portrait mode, use height-based scaling for better visibility
        HEART_SIZE = BASE_HEART_SIZE * SCALE_Y * 0.9;
    } else {
        // In landscape mode, use the standard scaling
        HEART_SIZE = BASE_HEART_SIZE * Math.min(SCALE_X, SCALE_Y);
    }

    // Update canvas dimensions for game logic (use display size)
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
    window.addEventListener('orientationchange', () => {
        // Delay resize to allow for orientation change to complete
        setTimeout(resizeCanvas, 100);
    });

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

// Initialize particle system and background elements
function initializeEffects() {
    // Initialize stars for background
    for (let i = 0; i < 50; i++) {
        stars.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT * 0.6,
            size: Math.random() * 2 + 1,
            opacity: Math.random() * 0.8 + 0.2,
            twinkleSpeed: Math.random() * 0.02 + 0.01
        });
    }

    // Initialize floating background elements
    for (let i = 0; i < 8; i++) {
        backgroundElements.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            size: Math.random() * 40 + 20,
            speed: Math.random() * 0.5 + 0.2,
            opacity: Math.random() * 0.3 + 0.1,
            color: `hsl(${Math.random() * 60 + 200}, 70%, ${Math.random() * 30 + 50}%)`
        });
    }
}

// Particle system for effects
function createParticle(x, y, vx, vy, color, size, life, type = 'spark') {
    particles.push({
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        color: color,
        size: size,
        life: life,
        maxLife: life,
        type: type,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2
    });
}

// Create particle trail for character
function createCharacterTrail() {
    if (character.image && gameState === 'playing') {
        character.trail.push({
            x: character.x + CHARACTER_SIZE / 2,
            y: character.y + CHARACTER_SIZE / 2,
            life: 20,
            maxLife: 20,
            size: CHARACTER_SIZE * 0.3
        });

        // Limit trail length
        if (character.trail.length > 15) {
            character.trail.shift();
        }
    }
}

// Create jump particles
function createJumpParticles() {
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = Math.random() * 3 + 2;
        createParticle(
            character.x + CHARACTER_SIZE / 2,
            character.y + CHARACTER_SIZE,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 1,
            '#FFD700',
            Math.random() * 4 + 2,
            Math.random() * 30 + 20,
            'spark'
        );
    }
}

// Create heart collection particles
function createHeartParticles(x, y) {
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        createParticle(
            x,
            y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            '#FF69B4',
            Math.random() * 6 + 3,
            Math.random() * 40 + 30,
            'heart'
        );
    }
}

// Create power-up particles
function createPowerUpParticles(x, y, type) {
    const colors = {
        shield: '#00FF00',
        speed: '#FFFF00',
        magnet: '#FF00FF',
        rainbow: '#FF6B35'
    };

    const color = colors[type] || '#FFFFFF';

    for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        createParticle(
            x,
            y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            color,
            Math.random() * 8 + 4,
            Math.random() * 45 + 35,
            'powerup'
        );
    }
}

// Activate power-up
function activatePowerUp(type) {
    const powerUp = {
        type: type,
        duration: 500, // frames
        startTime: Date.now()
    };

    activePowerUps.push(powerUp);

    // Visual feedback
    if (type === 'shield') {
        character.shield = true;
    } else if (type === 'speed') {
        character.speedBoost = true;
    } else if (type === 'magnet') {
        character.magnet = true;
    } else if (type === 'rainbow') {
        character.rainbow = true;
    }

    // Sound effect
    playPowerUpSound();
}

// Spawn power-up
function spawnPowerUp() {
    const types = ['shield', 'speed', 'magnet', 'rainbow'];
    const type = types[Math.floor(Math.random() * types.length)];

    const y = Math.random() * (CANVAS_HEIGHT - 40);
    powerUps.push({
        x: CANVAS_WIDTH,
        y: y,
        width: 40,
        height: 40,
        type: type,
        rotation: 0,
        glowIntensity: 0
    });
}

// Play power-up sound
function playPowerUpSound() {
    if (audioContext) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Rising power-up sound
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

// Load character images
function loadCharacterImages() {
    // Images are loaded when character is selected
    initializeEffects();
}

// Handle keyboard input
function handleKeyPress(event) {
    if (gameState === 'playing') {
        if (event.code === 'Space' || event.code === 'ArrowUp') {
            event.preventDefault();
            const jumpPower = character.speedBoost ? JUMP_FORCE * 1.3 : JUMP_FORCE;
            character.velocityY = jumpPower;
            playJumpSound();
            createJumpParticles();
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
        const jumpPower = character.speedBoost ? JUMP_FORCE * 1.3 : JUMP_FORCE;
        character.velocityY = jumpPower;
        playJumpSound();
        createJumpParticles();
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
        const jumpPower = character.speedBoost ? JUMP_FORCE * 1.3 : JUMP_FORCE;
        character.velocityY = jumpPower;
        playJumpSound();
        createJumpParticles();
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
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1; // Gravity effect
        particle.life--;
        particle.rotation += particle.rotationSpeed;

        // Remove dead particles
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Update character trail
    for (let i = character.trail.length - 1; i >= 0; i--) {
        const trail = character.trail[i];
        trail.life--;
        if (trail.life <= 0) {
            character.trail.splice(i, 1);
        }
    }

    // Update character glow based on speed
    character.glowIntensity = Math.abs(character.velocityY) * 0.1;

    // Update sun pulsing
    sun.pulseOffset += 0.05;

    // Update power-ups
    for (let i = activePowerUps.length - 1; i >= 0; i--) {
        const powerUp = activePowerUps[i];
        powerUp.duration--;

        if (powerUp.duration <= 0) {
            // Deactivate power-up
            if (powerUp.type === 'shield') {
                character.shield = false;
            } else if (powerUp.type === 'speed') {
                character.speedBoost = false;
            } else if (powerUp.type === 'magnet') {
                character.magnet = false;
            } else if (powerUp.type === 'rainbow') {
                character.rainbow = false;
            }
            activePowerUps.splice(i, 1);
        }
    }

    // Update power-up objects
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.x -= getGameSpeed() * 0.8; // Slightly slower than obstacles
        powerUp.rotation += 0.1;
        powerUp.glowIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;

        if (powerUp.x + powerUp.width < 0) {
            powerUps.splice(i, 1);
        }
    }

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

    // Create character trail
    createCharacterTrail();

    // Spawn obstacles (reduced frequency for easier gameplay)
    if (Math.random() < 0.008) {
        spawnObstacle();
    }

    // Spawn hearts (slightly increased for better reward balance)
    if (Math.random() < 0.018) {
        spawnHeart();
    }

    // Spawn power-ups (rarer than hearts)
    powerUpSpawnTimer++;
    if (powerUpSpawnTimer > 800 && Math.random() < 0.006) { // Every ~800 frames with 0.6% chance
        spawnPowerUp();
        powerUpSpawnTimer = 0;
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
            const heartX = heart.x + heart.width / 2;
            const heartY = heart.y + heart.height / 2;
            hearts.splice(i, 1);
            score += 1;
            if (scoreElement) scoreElement.textContent = score;
            updateSpeedDisplay();
            playHeartSound();
            createHeartParticles(heartX, heartY);
        }
    }

    // Check power-up collisions
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (charLeft < powerUp.x + powerUp.width &&
            charRight > powerUp.x &&
            charTop < powerUp.y + powerUp.height &&
            charBottom > powerUp.y) {
            // Collect power-up
            const powerUpX = powerUp.x + powerUp.width / 2;
            const powerUpY = powerUp.y + powerUp.height / 2;
            activatePowerUp(powerUp.type);
            powerUps.splice(i, 1);
            score += 5; // Power-ups worth more points
            if (scoreElement) scoreElement.textContent = score;
            updateSpeedDisplay();
            createPowerUpParticles(powerUpX, powerUpY, powerUp.type);
        }
    }

    // Check hurricane collisions (dangerous!) - but respect shield
    for (let hurricane of hurricanes) {
        if (charLeft < hurricane.x + hurricane.size &&
            charRight > hurricane.x &&
            charTop < hurricane.y + hurricane.size &&
            charBottom > hurricane.y) {
            if (!character.shield) {
                gameOverFunction();
                return;
            } else {
                // Shield protects against hurricane
                character.shield = false; // Consume shield
                // Remove hurricane after hitting shield
                hurricanes.splice(hurricanes.indexOf(hurricane), 1);
                // Create shield break particles
                createParticle(character.x + CHARACTER_SIZE / 2, character.y + CHARACTER_SIZE / 2,
                              0, 0, '#00FF00', 20, 30, 'spark');
            }
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
    character.shield = false;
    character.speedBoost = false;
    character.magnet = false;
    character.rainbow = false;

    // Clear objects
    obstacles = [];
    hearts = [];
    hurricanes = [];
    powerUps = [];
    particles = [];

    // Reset power-up system
    activePowerUps = [];
    powerUpSpawnTimer = 0;

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
    const pulse = Math.sin(sun.pulseOffset) * 0.2 + 0.8;

    // Sun glow effect (outer)
    const gradient1 = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.glowRadius * pulse);
    gradient1.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    gradient1.addColorStop(0.5, 'rgba(255, 215, 0, 0.4)');
    gradient1.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient1;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.glowRadius * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Main sun body with gradient
    const gradient2 = ctx.createRadialGradient(sun.x - sun.radius * 0.3, sun.y - sun.radius * 0.3, 0, sun.x, sun.y, sun.radius);
    gradient2.addColorStop(0, '#FFF8DC');
    gradient2.addColorStop(0.7, '#FFD700');
    gradient2.addColorStop(1, '#FFA500');
    ctx.fillStyle = gradient2;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays with animation
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    const time = Date.now() * 0.001;
    for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 + time * 0.5;
        const rayLength = sun.radius + 15 + Math.sin(time * 2 + i) * 5;
        const innerLength = sun.radius + 3;

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

    // Inner glow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
}

// Draw particles
function drawParticles() {
    for (const particle of particles) {
        const alpha = particle.life / particle.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);

        if (particle.type === 'spark') {
            // Spark particles
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
            ctx.fill();

            // Add glow
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = particle.size * 2;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (particle.type === 'heart') {
            // Heart-shaped particles
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(-particle.size * 0.3, -particle.size * 0.3, particle.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(particle.size * 0.3, -particle.size * 0.3, particle.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-particle.size * 0.6, -particle.size * 0.1, particle.size * 1.2, particle.size * 0.8);
        } else if (particle.type === 'powerup') {
            // Power-up particles - star shapes
            ctx.fillStyle = particle.color;
            const spikes = 5;
            const outerRadius = particle.size;
            const innerRadius = particle.size * 0.5;

            ctx.beginPath();
            for (let i = 0; i < spikes * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / spikes;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();

            // Add glow
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = particle.size * 2;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }
}

// Draw character trail
function drawCharacterTrail() {
    for (const trail of character.trail) {
        const alpha = trail.life / trail.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Draw stars
function drawStars() {
    for (const star of stars) {
        const twinkle = Math.sin(Date.now() * star.twinkleSpeed) * 0.3 + 0.7;
        ctx.save();
        ctx.globalAlpha = star.opacity * twinkle;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Draw background elements
function drawBackgroundElements() {
    for (const element of backgroundElements) {
        ctx.save();
        ctx.globalAlpha = element.opacity;
        ctx.fillStyle = element.color;
        ctx.beginPath();
        ctx.arc(element.x, element.y, element.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Update position for floating effect
        element.x -= element.speed * 0.5;
        if (element.x < -element.size) {
            element.x = CANVAS_WIDTH + element.size;
            element.y = Math.random() * CANVAS_HEIGHT;
        }
    }
}

// Draw character with glow effect
function drawCharacter() {
    if (!character.image) return;

    ctx.save();

    // Add glow effect based on character speed
    if (character.glowIntensity > 0.1) {
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = character.glowIntensity * 10;
    }

    ctx.drawImage(character.image, character.x, character.y, CHARACTER_SIZE, CHARACTER_SIZE);

    ctx.restore();
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

    // Clear canvas with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#87CEEB');
    bgGradient.addColorStop(0.7, '#98FB98');
    bgGradient.addColorStop(1, '#90EE90');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw stars
    drawStars();

    // Draw background elements
    drawBackgroundElements();

    // Draw sun
    drawSun();

    // Draw enhanced clouds
    drawEnhancedClouds();

    if (gameState === 'playing') {
        // Draw character trail first (behind character)
        drawCharacterTrail();

        // Draw character with glow effect
        drawCharacter();

        // Draw obstacles with enhanced visuals
        drawEnhancedObstacles();

        // Draw hearts with enhanced visuals
        drawEnhancedHearts();

        // Draw power-ups
        drawPowerUps();
    }

    // Draw hurricanes (visible during all game states)
    for (let hurricane of hurricanes) {
        drawHurricane(hurricane);
    }

    // Draw particles on top of everything
    drawParticles();
}

// Draw enhanced clouds
function drawEnhancedClouds() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 10;

    for (let i = 0; i < 5; i++) {
        const baseX = (i * 200 + Date.now() * 0.02) % (CANVAS_WIDTH + 100) - 50;
        const y = 50 + i * 30 + Math.sin(Date.now() * 0.001 + i) * 10;

        // Main cloud body
        ctx.beginPath();
        ctx.arc(baseX, y, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(baseX + 45, y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(baseX + 25, y - 15, 25, 0, Math.PI * 2);
        ctx.fill();

        // Cloud puffs
        ctx.beginPath();
        ctx.arc(baseX - 20, y + 5, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(baseX + 65, y + 5, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
}

// Draw power-ups
function drawPowerUps() {
    for (const powerUp of powerUps) {
        ctx.save();
        ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
        ctx.rotate(powerUp.rotation);

        // Power-up colors and symbols
        const colors = {
            shield: '#00FF00',
            speed: '#FFFF00',
            magnet: '#FF00FF',
            rainbow: '#FF6B35'
        };

        const color = colors[powerUp.type] || '#FFFFFF';

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 20 * powerUp.glowIntensity;

        // Outer ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, powerUp.width / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glow
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3 * powerUp.glowIntensity;
        ctx.beginPath();
        ctx.arc(0, 0, powerUp.width / 2 - 3, 0, Math.PI * 2);
        ctx.fill();

        // Power-up symbol
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${powerUp.width * 0.4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const symbols = {
            shield: '🛡️',
            speed: '⚡',
            magnet: '🧲',
            rainbow: '🌈'
        };

        ctx.fillText(symbols[powerUp.type] || '⭐', 0, 0);

        ctx.restore();
    }
}

// Draw character with power-up effects
function drawCharacter() {
    if (!character.image) return;

    ctx.save();

    // Shield effect
    if (character.shield) {
        const shieldPulse = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
        ctx.strokeStyle = `rgba(0, 255, 0, ${shieldPulse})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00FF00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(character.x + CHARACTER_SIZE / 2, character.y + CHARACTER_SIZE / 2,
                CHARACTER_SIZE / 2 + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Rainbow effect
    if (character.rainbow) {
        const hue = (Date.now() * 0.1) % 360;
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 15;
    }

    // Speed boost glow
    if (character.speedBoost) {
        ctx.shadowColor = '#FFFF00';
        ctx.shadowBlur = 20;
    }

    // Magnet effect
    if (character.magnet) {
        const magnetPulse = Math.sin(Date.now() * 0.02) * 5 + 5;
        ctx.strokeStyle = `rgba(255, 0, 255, 0.6)`;
        ctx.lineWidth = magnetPulse;
        ctx.beginPath();
        ctx.arc(character.x + CHARACTER_SIZE / 2, character.y + CHARACTER_SIZE / 2,
                CHARACTER_SIZE / 2 + 15, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw the character image
    ctx.drawImage(character.image, character.x, character.y, CHARACTER_SIZE, CHARACTER_SIZE);

    ctx.restore();
}

// Draw enhanced obstacles
function drawEnhancedObstacles() {
    for (let obstacle of obstacles) {
        // Shadow
        ctx.fillStyle = 'rgba(0, 102, 204, 0.3)';
        ctx.beginPath();
        ctx.moveTo(obstacle.x + 2, obstacle.y + obstacle.height + 3);
        ctx.lineTo(obstacle.x + obstacle.width / 2 + 2, obstacle.y + 3);
        ctx.lineTo(obstacle.x + obstacle.width + 2, obstacle.y + obstacle.height + 3);
        ctx.closePath();
        ctx.fill();

        // Main obstacle with gradient
        const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.height);
        gradient.addColorStop(0, '#0080FF');
        gradient.addColorStop(1, '#004080');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
        ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obstacle.x + obstacle.width / 2, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.width / 2 + 5, obstacle.y + 10);
        ctx.stroke();
    }
}

// Draw enhanced hearts
function drawEnhancedHearts() {
    for (let heart of hearts) {
        const time = Date.now() * 0.005;
        const pulse = Math.sin(time + heart.x * 0.01) * 0.1 + 0.9;

        // Glow effect
        ctx.shadowColor = '#FF69B4';
        ctx.shadowBlur = 15 * pulse;
        ctx.fillStyle = `rgba(255, 105, 180, ${0.8 * pulse})`;
        ctx.beginPath();
        ctx.arc(heart.x + heart.width / 2, heart.y + heart.height / 2, heart.width / 2 + 5, 0, Math.PI * 2);
        ctx.fill();

        // Main heart with gradient
        const gradient = ctx.createRadialGradient(
            heart.x + heart.width * 0.4, heart.y + heart.height * 0.3, 0,
            heart.x + heart.width / 2, heart.y + heart.height / 2, heart.width / 2
        );
        gradient.addColorStop(0, '#FFB6C1');
        gradient.addColorStop(0.7, '#FF69B4');
        gradient.addColorStop(1, '#DC143C');
        ctx.fillStyle = gradient;

        // Draw heart shape
        ctx.beginPath();
        ctx.arc(heart.x + heart.width * 0.3, heart.y + heart.height * 0.3, heart.width * 0.25 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(heart.x + heart.width * 0.7, heart.y + heart.height * 0.3, heart.width * 0.25 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(heart.x + heart.width * 0.2, heart.y + heart.height * 0.35, heart.width * 0.6, heart.height * 0.4);

        // Heart highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(heart.x + heart.width * 0.4, heart.y + heart.height * 0.4, heart.width * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
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

