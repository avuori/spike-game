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

// Bomb system
let bombExplosion = null;
let bombCount = 0; // Number of bombs collected

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
let scoreElement, finalScoreElement, restartBtn, musicToggleBtn, speedDisplayElement, bombBtn;

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
    bombBtn = document.getElementById('bomb-btn');

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
    bombBtn.addEventListener('click', launchBomb);
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
        // Show bomb button during gameplay
        if (document.getElementById('bomb-container')) {
            document.getElementById('bomb-container').style.display = 'block';
        }
        // Start background music when game begins (if enabled)
        if (musicEnabled) {
            startBackgroundMusic();
        }
        // Initialize speed display
        updateSpeedDisplay();
        updateBombButton();
    };
}

// Initialize particle system and background elements (optimized for mobile)
function initializeEffects() {
    // Initialize stars for background - reduced count for performance
    for (let i = 0; i < 20; i++) {
        stars.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT * 0.6,
            size: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.6 + 0.3,
            twinkleSpeed: Math.random() * 0.015 + 0.005
        });
    }

    // Initialize floating background elements - reduced count
    for (let i = 0; i < 4; i++) {
        backgroundElements.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            size: Math.random() * 25 + 15,
            speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random() * 0.2 + 0.05,
            color: `hsl(${Math.random() * 40 + 210}, 60%, ${Math.random() * 20 + 60}%)`
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
        // Only create trail every few frames to reduce performance impact
        if (Math.random() < 0.6) { // 60% chance to create trail particle
            character.trail.push({
                x: character.x + CHARACTER_SIZE / 2,
                y: character.y + CHARACTER_SIZE / 2,
                life: 15, // Shorter lifetime
                maxLife: 15,
                size: CHARACTER_SIZE * 0.25 // Smaller size
            });

            // Limit trail length - reduced for performance
            if (character.trail.length > 10) {
                character.trail.shift();
            }
        }
    }
}

// Create jump particles (optimized for mobile)
function createJumpParticles() {
    // Reduced particle count for better performance
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const speed = Math.random() * 2 + 1.5;
        createParticle(
            character.x + CHARACTER_SIZE / 2,
            character.y + CHARACTER_SIZE,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 0.5,
            '#FFD700',
            Math.random() * 3 + 1.5,
            Math.random() * 20 + 15, // Shorter lifetime
            'spark'
        );
    }
}

// Create heart collection particles (optimized for mobile)
function createHeartParticles(x, y) {
    // Reduced particle count and simplified physics
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = Math.random() * 2.5 + 1.5;
        createParticle(
            x,
            y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 0.3,
            '#FF69B4',
            Math.random() * 4 + 2,
            Math.random() * 25 + 15, // Shorter lifetime
            'heart'
        );
    }
}

// Create power-up particles (optimized for mobile)
function createPowerUpParticles(x, y, type) {
    const colors = {
        shield: '#00FF00',
        speed: '#FFFF00',
        magnet: '#FF00FF',
        rainbow: '#FF6B35',
        bomb: '#FF4500'
    };

    const color = colors[type] || '#FFFFFF';

    // Reduced particle count for better performance
    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const speed = Math.random() * 3 + 1.5;
        createParticle(
            x,
            y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 0.2,
            color,
            Math.random() * 5 + 2,
            Math.random() * 30 + 20, // Shorter lifetime
            'powerup'
        );
    }
}

// Activate power-up
function activatePowerUp(type) {
    if (type === 'bomb') {
        // Add bomb to inventory instead of activating immediately
        bombCount++;
        updateBombButton();
        playPowerUpSound();
        return;
    }

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
    const types = ['shield', 'speed', 'magnet', 'rainbow', 'bomb'];
    const type = types[Math.floor(Math.random() * types.length)];

    let attempts = 0;
    let y;
    
    do {
        y = Math.random() * (CANVAS_HEIGHT - 40);
        attempts++;
    } while (checkSpawnCollision(CANVAS_WIDTH, y, 40, 40) && attempts < 10);
    
    // If we couldn't find a good spot after 10 attempts, spawn anyway
    if (attempts >= 10) {
        y = Math.random() * (CANVAS_HEIGHT - 40);
    }

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

// Launch bomb function
function launchBomb() {
    if (gameState !== 'playing' || bombCount <= 0) return;
    
    // Use one bomb from inventory
    bombCount--;
    updateBombButton();
    
    bombExplosion = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        radius: 0,
        maxRadius: Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.8,
        life: 60, // frames
        maxLife: 60
    };
    
    playBombSound();
    
    // Create initial explosion particles
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const speed = Math.random() * 15 + 10;
        createParticle(
            bombExplosion.x,
            bombExplosion.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            '#FF4500',
            Math.random() * 8 + 4,
            Math.random() * 40 + 30,
            'explosion'
        );
    }
}

// Play bomb explosion sound
function playBombSound() {
    if (audioContext) {
        // Low frequency explosion rumble
        const oscillator1 = audioContext.createOscillator();
        const gainNode1 = audioContext.createGain();
        const filter1 = audioContext.createBiquadFilter();

        oscillator1.connect(filter1);
        filter1.connect(gainNode1);
        gainNode1.connect(audioContext.destination);

        oscillator1.frequency.setValueAtTime(60, audioContext.currentTime);
        oscillator1.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.5);

        filter1.type = 'lowpass';
        filter1.frequency.setValueAtTime(200, audioContext.currentTime);

        gainNode1.gain.setValueAtTime(0.6, audioContext.currentTime);
        gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);

        oscillator1.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 1.0);

        // High frequency crack sound
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();

        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);

        oscillator2.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator2.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.2);

        gainNode2.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 0.3);
    }
}

// Update bomb button appearance based on bomb count
function updateBombButton() {
    if (!bombBtn) return;
    
    if (bombCount > 0) {
        bombBtn.style.display = 'flex';
        bombBtn.style.opacity = '1';
        bombBtn.style.filter = 'none';
        bombBtn.textContent = `💣 ${bombCount}`;
        bombBtn.disabled = false;
    } else {
        bombBtn.style.display = 'none';
    }
}

// Destroy objects within explosion radius
function destroyObjectsInExplosion() {
    if (!bombExplosion) return;
    
    // Destroy obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        const centerX = obstacle.x + obstacle.width / 2;
        const centerY = obstacle.y + obstacle.height / 2;
        const distance = Math.sqrt(
            Math.pow(centerX - bombExplosion.x, 2) + 
            Math.pow(centerY - bombExplosion.y, 2)
        );
        
        if (distance < bombExplosion.radius) {
            // Create destruction particles
            for (let j = 0; j < 8; j++) {
                const angle = (j / 8) * Math.PI * 2;
                const speed = Math.random() * 10 + 5;
                createParticle(
                    centerX,
                    centerY,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    '#808080',
                    Math.random() * 4 + 2,
                    Math.random() * 25 + 15,
                    'spark'
                );
            }
            obstacles.splice(i, 1);
        }
    }
    
    // Destroy hearts
    for (let i = hearts.length - 1; i >= 0; i--) {
        const heart = hearts[i];
        const centerX = heart.x + heart.width / 2;
        const centerY = heart.y + heart.height / 2;
        const distance = Math.sqrt(
            Math.pow(centerX - bombExplosion.x, 2) + 
            Math.pow(centerY - bombExplosion.y, 2)
        );
        
        if (distance < bombExplosion.radius) {
            // Create heart destruction particles
            createHeartParticles(centerX, centerY);
            hearts.splice(i, 1);
        }
    }
    
    // Destroy hurricanes
    for (let i = hurricanes.length - 1; i >= 0; i--) {
        const hurricane = hurricanes[i];
        const centerX = hurricane.x + hurricane.size / 2;
        const centerY = hurricane.y + hurricane.size / 2;
        const distance = Math.sqrt(
            Math.pow(centerX - bombExplosion.x, 2) + 
            Math.pow(centerY - bombExplosion.y, 2)
        );
        
        if (distance < bombExplosion.radius) {
            // Create massive hurricane destruction effect
            for (let j = 0; j < 20; j++) {
                const angle = (j / 20) * Math.PI * 2;
                const speed = Math.random() * 15 + 8;
                createParticle(
                    centerX,
                    centerY,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    '#2F4F4F',
                    Math.random() * 8 + 4,
                    Math.random() * 40 + 30,
                    'spark'
                );
            }
            hurricanes.splice(i, 1);
        }
    }
    
    // Destroy power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        const centerX = powerUp.x + powerUp.width / 2;
        const centerY = powerUp.y + powerUp.height / 2;
        const distance = Math.sqrt(
            Math.pow(centerX - bombExplosion.x, 2) + 
            Math.pow(centerY - bombExplosion.y, 2)
        );
        
        if (distance < bombExplosion.radius) {
            createPowerUpParticles(centerX, centerY, powerUp.type);
            powerUps.splice(i, 1);
        }
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
        if (event.code === 'Space') {
            event.preventDefault();
            // Space bar now launches bombs
            launchBomb();
        } else if (event.code === 'ArrowUp') {
            event.preventDefault();
            const jumpPower = character.speedBoost ? JUMP_FORCE * 1.3 : JUMP_FORCE;
            character.velocityY = jumpPower;
            playJumpSound();
            createJumpParticles();
        } else if (event.code === 'KeyB') {
            event.preventDefault();
            // B key also launches bombs (alternative)
            launchBomb();
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
    // Update particles (optimized for mobile)
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.05; // Reduced gravity for better performance
        particle.life--;
        particle.rotation += particle.rotationSpeed * 0.5; // Slower rotation

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

    // Update bomb system (no cooldown needed for collectible bombs)

    // Update bomb explosion
    if (bombExplosion) {
        bombExplosion.life--;
        bombExplosion.radius = (1 - (bombExplosion.life / bombExplosion.maxLife)) * bombExplosion.maxRadius;
        
        // Destroy all objects within explosion radius
        if (bombExplosion.life > bombExplosion.maxLife * 0.3) { // Only destroy during first 70% of explosion
            destroyObjectsInExplosion();
        }
        
        // Continue creating explosion particles
        if (bombExplosion.life > bombExplosion.maxLife * 0.5) {
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * bombExplosion.radius;
                const speed = Math.random() * 8 + 3;
                createParticle(
                    bombExplosion.x + Math.cos(angle) * distance,
                    bombExplosion.y + Math.sin(angle) * distance,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    Math.random() > 0.5 ? '#FF4500' : '#FFD700',
                    Math.random() * 6 + 2,
                    Math.random() * 30 + 20,
                    'explosion'
                );
            }
        }
        
        if (bombExplosion.life <= 0) {
            bombExplosion = null;
        }
    }

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
        const obstacle = obstacles[i];
        obstacle.x -= getGameSpeed();
        
        // Update spike animations
        obstacle.animationOffset += 0.05;
        
        // Update glow intensity for special spikes
        if (obstacle.type === 'fire') {
            obstacle.glowIntensity = Math.sin(obstacle.animationOffset * 2) * 0.3 + 0.7;
        } else if (obstacle.type === 'crystal') {
            obstacle.glowIntensity = Math.sin(obstacle.animationOffset) * 0.2 + 0.8;
        } else if (obstacle.type === 'ice') {
            obstacle.glowIntensity = Math.sin(obstacle.animationOffset * 0.5) * 0.15 + 0.6;
        }
        
        if (obstacle.x + OBSTACLE_WIDTH < 0) {
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

// Check if position overlaps with existing items
function checkSpawnCollision(x, y, width, height) {
    const margin = 20; // Minimum distance between items
    
    // Check against obstacles
    for (let obstacle of obstacles) {
        if (x < obstacle.x + obstacle.width + margin &&
            x + width + margin > obstacle.x &&
            y < obstacle.y + obstacle.height + margin &&
            y + height + margin > obstacle.y) {
            return true;
        }
    }
    
    // Check against hearts
    for (let heart of hearts) {
        if (x < heart.x + heart.width + margin &&
            x + width + margin > heart.x &&
            y < heart.y + heart.height + margin &&
            y + height + margin > heart.y) {
            return true;
        }
    }
    
    // Check against power-ups
    for (let powerUp of powerUps) {
        if (x < powerUp.x + powerUp.width + margin &&
            x + width + margin > powerUp.x &&
            y < powerUp.y + powerUp.height + margin &&
            y + height + margin > powerUp.y) {
            return true;
        }
    }
    
    return false;
}

// Spawn obstacle (spike)
function spawnObstacle() {
    let attempts = 0;
    let y;
    
    do {
        y = Math.random() * (CANVAS_HEIGHT - OBSTACLE_HEIGHT);
        attempts++;
    } while (checkSpawnCollision(CANVAS_WIDTH, y, OBSTACLE_WIDTH, OBSTACLE_HEIGHT) && attempts < 10);
    
    // If we couldn't find a good spot after 10 attempts, spawn anyway
    if (attempts >= 10) {
        y = Math.random() * (CANVAS_HEIGHT - OBSTACLE_HEIGHT);
    }
    
    // Add variety to spikes
    const spikeTypes = ['normal', 'crystal', 'fire', 'ice'];
    const spikeType = spikeTypes[Math.floor(Math.random() * spikeTypes.length)];
    
    obstacles.push({
        x: CANVAS_WIDTH,
        y: y,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT,
        type: spikeType,
        animationOffset: Math.random() * Math.PI * 2, // For animated effects
        glowIntensity: 0
    });
}

// Spawn heart
function spawnHeart() {
    let attempts = 0;
    let y;
    
    do {
        y = Math.random() * (CANVAS_HEIGHT - HEART_SIZE);
        attempts++;
    } while (checkSpawnCollision(CANVAS_WIDTH, y, HEART_SIZE, HEART_SIZE) && attempts < 10);
    
    // If we couldn't find a good spot after 10 attempts, spawn anyway
    if (attempts >= 10) {
        y = Math.random() * (CANVAS_HEIGHT - HEART_SIZE);
    }
    
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
    // Hide bomb button during game over
    if (document.getElementById('bomb-container')) {
        document.getElementById('bomb-container').style.display = 'none';
    }

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

    // Reset bomb system
    bombExplosion = null;
    bombCount = 0;
    updateBombButton();

    // Stop background music when returning to menu
    stopBackgroundMusic();

    // Reset UI
    menuScreen.style.display = 'flex';
    gameUI.style.display = 'none';
    gameOver.style.display = 'none';
    // Hide bomb button in menu
    if (document.getElementById('bomb-container')) {
        document.getElementById('bomb-container').style.display = 'none';
    }

    // Reinitialize audio
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported');
    }
}

// Draw sun (optimized for mobile)
function drawSun() {
    const pulse = Math.sin(sun.pulseOffset) * 0.15 + 0.85;

    // Simplified sun glow effect
    ctx.fillStyle = `rgba(255, 215, 0, ${0.3 * pulse})`;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.glowRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Main sun body with simpler gradient
    const gradient = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.radius);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(1, '#FFA500');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2);
    ctx.fill();

    // Simplified sun rays - reduced count for performance
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    const time = Date.now() * 0.001;
    for (let i = 0; i < 8; i++) { // Reduced from 12 to 8
        const angle = (i * Math.PI) / 4 + time * 0.3; // Slower animation
        const rayLength = sun.radius + 12;
        const innerLength = sun.radius + 2;

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
            // Perfect heart-shaped particles
            ctx.fillStyle = particle.color;
            
            // Use the same mathematical heart equation but smaller scale
            const scale = particle.size / 25;
            ctx.beginPath();
            
            for (let t = 0; t <= Math.PI * 2; t += 0.2) { // Slightly lower resolution for particles
                const x = 16 * Math.pow(Math.sin(t), 3);
                const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                
                const scaledX = x * scale;
                const scaledY = y * scale;
                
                if (t === 0) {
                    ctx.moveTo(scaledX, scaledY);
                } else {
                    ctx.lineTo(scaledX, scaledY);
                }
            }
            
            ctx.closePath();
            ctx.fill();
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
        } else if (particle.type === 'explosion') {
            // Explosion particles - bright orange/red bursts
            ctx.fillStyle = particle.color;
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = particle.size * 3;
            ctx.beginPath();
            ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
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

// Draw realistic hurricane with spiral patterns and enhanced effects
function drawHurricane(hurricane) {
    const centerX = hurricane.x + hurricane.size / 2;
    const centerY = hurricane.y + hurricane.size / 2;
    const time = Date.now() * 0.001;

    // Calculate movement intensity for visual effects
    const movementIntensity = Math.abs(Math.sin(time * hurricane.verticalSpeed + hurricane.oscillationOffset));
    const rotationSpeed = hurricane.rotation;

    ctx.save();

    // Outer atmospheric disturbance with gradient
    const outerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, hurricane.size * 0.8);
    outerGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    outerGradient.addColorStop(0.7, `rgba(47, 79, 79, ${0.2 + movementIntensity * 0.1})`);
    outerGradient.addColorStop(1, `rgba(47, 79, 79, ${0.4 + movementIntensity * 0.2})`);
    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, hurricane.size * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Main hurricane body with realistic spiral clouds
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationSpeed);

    // Draw multiple spiral arms like a real hurricane
    for (let arm = 0; arm < 4; arm++) {
        const armAngle = (arm * Math.PI) / 2;
        
        // Create spiral path
        ctx.beginPath();
        ctx.strokeStyle = `rgba(105, 105, 105, ${0.6 + movementIntensity * 0.3})`;
        ctx.lineWidth = hurricane.size / 8;
        ctx.lineCap = 'round';
        
        for (let t = 0; t <= 3; t += 0.1) {
            const spiralRadius = (hurricane.size / 2) * (1 - t / 3) * 0.8;
            const spiralAngle = armAngle + t * Math.PI * 1.5 + time * 0.5;
            const x = Math.cos(spiralAngle) * spiralRadius;
            const y = Math.sin(spiralAngle) * spiralRadius;
            
            if (t === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Add denser cloud clusters along spiral arms
        for (let cluster = 0; cluster < 3; cluster++) {
            const t = (cluster + 1) * 0.8;
            const spiralRadius = (hurricane.size / 2) * (1 - t / 3) * 0.8;
            const spiralAngle = armAngle + t * Math.PI * 1.5 + time * 0.5;
            const x = Math.cos(spiralAngle) * spiralRadius;
            const y = Math.sin(spiralAngle) * spiralRadius;
            
            ctx.fillStyle = `rgba(70, 70, 70, ${0.7 + Math.sin(time * 2 + cluster) * 0.2})`;
            ctx.beginPath();
            ctx.arc(x, y, hurricane.size / 12, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Dense inner storm wall
    const wallGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, hurricane.size / 3);
    wallGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    wallGradient.addColorStop(0.8, `rgba(40, 40, 40, ${0.8 + movementIntensity * 0.2})`);
    wallGradient.addColorStop(1, `rgba(20, 20, 20, ${0.9 + movementIntensity * 0.1})`);
    ctx.fillStyle = wallGradient;
    ctx.beginPath();
    ctx.arc(0, 0, hurricane.size / 3, 0, Math.PI * 2);
    ctx.fill();

    // Eye of the storm - realistic clear center
    const eyeGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, hurricane.size / 8);
    eyeGradient.addColorStop(0, `rgba(135, 206, 235, ${0.4 + movementIntensity * 0.3})`); // Sky blue center
    eyeGradient.addColorStop(0.7, `rgba(169, 169, 169, ${0.3 + movementIntensity * 0.2})`);
    eyeGradient.addColorStop(1, 'rgba(40, 40, 40, 0.8)');
    ctx.fillStyle = eyeGradient;
    ctx.beginPath();
    ctx.arc(0, 0, hurricane.size / 8, 0, Math.PI * 2);
    ctx.fill();

    // Enhanced lightning with branching patterns
    if (Math.random() < 0.5 || movementIntensity > 0.7) {
        ctx.save();
        ctx.shadowColor = '#FFFF00';
        ctx.shadowBlur = 15;
        
        // Main lightning bolt
        ctx.strokeStyle = `rgba(255, 255, 0, ${0.8 + movementIntensity * 0.2})`;
        ctx.lineWidth = 2 + movementIntensity * 3;
        ctx.lineCap = 'round';
        
        // Create realistic jagged lightning
        const lightningPoints = [];
        const startAngle = Math.random() * Math.PI * 2;
        const startRadius = hurricane.size / 6;
        const endRadius = hurricane.size / 2.5;
        
        lightningPoints.push({
            x: Math.cos(startAngle) * startRadius,
            y: Math.sin(startAngle) * startRadius
        });
        
        // Create jagged path
        for (let i = 1; i < 6; i++) {
            const progress = i / 5;
            const radius = startRadius + (endRadius - startRadius) * progress;
            const angle = startAngle + (Math.random() - 0.5) * 0.5;
            const jitter = (Math.random() - 0.5) * hurricane.size / 8;
            
            lightningPoints.push({
                x: Math.cos(angle) * radius + jitter,
                y: Math.sin(angle) * radius + jitter
            });
        }
        
        ctx.beginPath();
        ctx.moveTo(lightningPoints[0].x, lightningPoints[0].y);
        for (let i = 1; i < lightningPoints.length; i++) {
            ctx.lineTo(lightningPoints[i].x, lightningPoints[i].y);
        }
        ctx.stroke();
        
        // Add branching bolts
        if (Math.random() < 0.6) {
            const branchStart = Math.floor(Math.random() * (lightningPoints.length - 2)) + 1;
            const branchPoint = lightningPoints[branchStart];
            const branchAngle = Math.random() * Math.PI * 2;
            const branchLength = hurricane.size / 6;
            
            ctx.beginPath();
            ctx.moveTo(branchPoint.x, branchPoint.y);
            ctx.lineTo(
                branchPoint.x + Math.cos(branchAngle) * branchLength,
                branchPoint.y + Math.sin(branchAngle) * branchLength
            );
            ctx.stroke();
        }
        
        ctx.restore();
    }

    ctx.restore();

    // Swirling debris and wind effects
    ctx.save();
    for (let i = 0; i < 15; i++) {
        const debrisAngle = (i * Math.PI * 2) / 15 + rotationSpeed * 3 + time;
        const debrisRadius = hurricane.size / 2 + Math.sin(time * 2 + i) * 20;
        const debrisX = centerX + Math.cos(debrisAngle) * debrisRadius;
        const debrisY = centerY + Math.sin(debrisAngle) * debrisRadius;
        
        // Wind streak
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * 3 + i) * 0.2})`;
        ctx.lineWidth = 1 + movementIntensity;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        const streakLength = 15 + movementIntensity * 10;
        ctx.moveTo(debrisX, debrisY);
        ctx.lineTo(
            debrisX + Math.cos(debrisAngle + Math.PI) * streakLength,
            debrisY + Math.sin(debrisAngle + Math.PI) * streakLength
        );
        ctx.stroke();
        
        // Flying debris
        if (Math.random() < 0.4) {
            ctx.fillStyle = `rgba(139, 69, 19, ${0.6 + Math.random() * 0.4})`; // Brown debris
            ctx.beginPath();
            ctx.arc(debrisX, debrisY, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    // Pressure wave effect for powerful hurricanes
    if (movementIntensity > 0.6) {
        ctx.save();
        ctx.strokeStyle = `rgba(135, 206, 235, ${0.3 * movementIntensity})`;
        ctx.lineWidth = 2;
        const waveRadius = hurricane.size * 0.9 + Math.sin(time * 4) * 10;
        ctx.beginPath();
        ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Motion blur trail for fast-moving hurricanes
    if (hurricane.horizontalSpeed > getGameSpeed() * 0.8) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        const trailGradient = ctx.createRadialGradient(
            centerX + 25, centerY, 0,
            centerX + 25, centerY, hurricane.size / 2
        );
        trailGradient.addColorStop(0, 'rgba(47, 79, 79, 0.4)');
        trailGradient.addColorStop(1, 'rgba(47, 79, 79, 0)');
        ctx.fillStyle = trailGradient;
        ctx.beginPath();
        ctx.arc(centerX + 25, centerY, hurricane.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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

    // Draw bomb explosion
    if (bombExplosion) {
        drawBombExplosion();
    }

    // Draw particles on top of everything
    drawParticles();
}

// Draw bomb explosion effect
function drawBombExplosion() {
    if (!bombExplosion) return;
    
    const alpha = bombExplosion.life / bombExplosion.maxLife;
    
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    
    // Outer explosion ring
    const outerGradient = ctx.createRadialGradient(
        bombExplosion.x, bombExplosion.y, 0,
        bombExplosion.x, bombExplosion.y, bombExplosion.radius
    );
    outerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    outerGradient.addColorStop(0.3, 'rgba(255, 165, 0, 0.6)');
    outerGradient.addColorStop(0.7, 'rgba(255, 69, 0, 0.4)');
    outerGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    
    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(bombExplosion.x, bombExplosion.y, bombExplosion.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner core
    ctx.globalAlpha = alpha * 0.9;
    const coreGradient = ctx.createRadialGradient(
        bombExplosion.x, bombExplosion.y, 0,
        bombExplosion.x, bombExplosion.y, bombExplosion.radius * 0.3
    );
    coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    coreGradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.8)');
    coreGradient.addColorStop(1, 'rgba(255, 165, 0, 0.3)');
    
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(bombExplosion.x, bombExplosion.y, bombExplosion.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Shockwave ring
    if (bombExplosion.life > bombExplosion.maxLife * 0.8) {
        ctx.globalAlpha = (bombExplosion.life / bombExplosion.maxLife) * 0.8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bombExplosion.x, bombExplosion.y, bombExplosion.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.restore();
}

// Draw enhanced clouds (optimized for mobile)
function drawEnhancedClouds() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Reduced opacity

    for (let i = 0; i < 3; i++) { // Reduced from 5 to 3 clouds
        const baseX = (i * 250 + Date.now() * 0.01) % (CANVAS_WIDTH + 100) - 50; // Slower movement
        const y = 50 + i * 35;

        // Simplified cloud - fewer circles
        ctx.beginPath();
        ctx.arc(baseX, y, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(baseX + 35, y, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(baseX + 18, y - 12, 18, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw power-ups (optimized for mobile)
function drawPowerUps() {
    for (const powerUp of powerUps) {
        ctx.save();
        ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
        ctx.rotate(powerUp.rotation * 0.5); // Slower rotation for performance

        // Power-up colors and symbols
        const colors = {
            shield: '#00FF00',
            speed: '#FFFF00',
            magnet: '#FF00FF',
            rainbow: '#FF6B35',
            bomb: '#FF4500'
        };

        const color = colors[powerUp.type] || '#FFFFFF';

        // Simplified glow effect
        ctx.fillStyle = `rgba(${color.slice(1, 3)}, ${color.slice(3, 5)}, ${color.slice(5, 7)}, ${0.4 * powerUp.glowIntensity})`;
        ctx.beginPath();
        ctx.arc(0, 0, powerUp.width / 2 + 2, 0, Math.PI * 2);
        ctx.fill();

        // Outer ring - simplified
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, powerUp.width / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Inner fill
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, powerUp.width / 2 - 2, 0, Math.PI * 2);
        ctx.fill();

        // Power-up symbol - simplified
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${powerUp.width * 0.35}px Arial`; // Smaller font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const symbols = {
            shield: '🛡️',
            speed: '⚡',
            magnet: '🧲',
            rainbow: '🌈',
            bomb: '💣'
        };

        ctx.fillText(symbols[powerUp.type] || '⭐', 0, 0);

        ctx.restore();
    }
}

// Draw character with power-up effects (optimized for mobile)
function drawCharacter() {
    if (!character.image) return;

    ctx.save();

    // Only apply one effect at a time for better performance
    if (character.shield) {
        const shieldPulse = Math.sin(Date.now() * 0.005) * 0.1 + 0.9; // Slower pulse
        ctx.strokeStyle = `rgba(0, 255, 0, ${shieldPulse})`;
        ctx.lineWidth = 3; // Reduced line width
        ctx.beginPath();
        ctx.arc(character.x + CHARACTER_SIZE / 2, character.y + CHARACTER_SIZE / 2,
                CHARACTER_SIZE / 2 + 8, 0, Math.PI * 2); // Smaller radius
        ctx.stroke();
    } else if (character.speedBoost) {
        ctx.shadowColor = '#FFFF00';
        ctx.shadowBlur = 12; // Reduced blur
    } else if (character.rainbow) {
        const hue = (Date.now() * 0.05) % 360; // Slower color change
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 10;
    }
    // Magnet effect removed for performance - can be added back if needed

    // Draw the character image
    ctx.drawImage(character.image, character.x, character.y, CHARACTER_SIZE, CHARACTER_SIZE);

    ctx.restore();
}

// Draw beautiful 3D spikes with various types and effects
function drawEnhancedObstacles() {
    for (let obstacle of obstacles) {
        const centerX = obstacle.x + obstacle.width / 2;
        const topY = obstacle.y;
        const bottomY = obstacle.y + obstacle.height;
        const leftX = obstacle.x;
        const rightX = obstacle.x + obstacle.width;

        // Drop shadow for depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(leftX + 2, bottomY + 2);
        ctx.lineTo(centerX + 2, topY + 2);
        ctx.lineTo(rightX + 2, bottomY + 2);
        ctx.closePath();
        ctx.fill();

        // Different spike types with unique styles
        let gradient, glowColor, tipColor, shadowColor;
        
        switch (obstacle.type) {
            case 'fire':
                gradient = ctx.createLinearGradient(leftX, topY, rightX, bottomY);
                gradient.addColorStop(0, '#FFD700');  // Gold
                gradient.addColorStop(0.3, '#FF8C00'); // Dark orange
                gradient.addColorStop(0.7, '#FF4500'); // Red orange
                gradient.addColorStop(1, '#8B0000');   // Dark red
                glowColor = '#FF4500';
                tipColor = '#FFFF00';
                shadowColor = '#8B4513';
                break;
                
            case 'crystal':
                gradient = ctx.createLinearGradient(leftX, topY, rightX, bottomY);
                gradient.addColorStop(0, '#E6E6FA');  // Lavender
                gradient.addColorStop(0.3, '#9370DB'); // Medium purple
                gradient.addColorStop(0.7, '#663399'); // Rebecca purple
                gradient.addColorStop(1, '#4B0082');   // Indigo
                glowColor = '#9370DB';
                tipColor = '#FFFFFF';
                shadowColor = '#301934';
                break;
                
            case 'ice':
                gradient = ctx.createLinearGradient(leftX, topY, rightX, bottomY);
                gradient.addColorStop(0, '#F0F8FF');  // Alice blue
                gradient.addColorStop(0.3, '#87CEEB'); // Sky blue
                gradient.addColorStop(0.7, '#4682B4'); // Steel blue
                gradient.addColorStop(1, '#191970');   // Midnight blue
                glowColor = '#87CEEB';
                tipColor = '#FFFFFF';
                shadowColor = '#2F4F4F';
                break;
                
            default: // normal metallic
                gradient = ctx.createLinearGradient(leftX, topY, rightX, bottomY);
                gradient.addColorStop(0, '#C0C0C0');  // Silver light
                gradient.addColorStop(0.3, '#808080'); // Medium gray
                gradient.addColorStop(0.7, '#404040'); // Dark gray
                gradient.addColorStop(1, '#202020');   // Almost black
                glowColor = '#FF4444';
                tipColor = '#FFFFFF';
                shadowColor = '#404040';
                break;
        }
        
        // Main spike body with type-specific gradient
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(leftX, bottomY);
        ctx.lineTo(centerX, topY);
        ctx.lineTo(rightX, bottomY);
        ctx.closePath();
        ctx.fill();

        // Left edge highlight (3D effect)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftX, bottomY);
        ctx.lineTo(centerX, topY);
        ctx.stroke();

        // Right edge shadow (3D effect)
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX, topY);
        ctx.lineTo(rightX, bottomY);
        ctx.stroke();

        // Sharp tip highlight
        ctx.fillStyle = tipColor;
        ctx.beginPath();
        ctx.arc(centerX, topY, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Type-specific glow effects
        if (obstacle.glowIntensity > 0) {
            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 8 * obstacle.glowIntensity;
            ctx.strokeStyle = `rgba(${hexToRgb(glowColor).r}, ${hexToRgb(glowColor).g}, ${hexToRgb(glowColor).b}, ${0.4 * obstacle.glowIntensity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(leftX, bottomY);
            ctx.lineTo(centerX, topY);
            ctx.lineTo(rightX, bottomY);
            ctx.stroke();
            ctx.restore();
        }

        // Special effects for certain types
        if (obstacle.type === 'fire') {
            // Flickering particles around fire spikes
            if (Math.random() < 0.3) {
                for (let i = 0; i < 3; i++) {
                    const sparkX = centerX + (Math.random() - 0.5) * obstacle.width;
                    const sparkY = topY + Math.random() * obstacle.height * 0.3;
                    ctx.fillStyle = `rgba(255, ${100 + Math.random() * 155}, 0, ${Math.random()})`;
                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, Math.random() * 2 + 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (obstacle.type === 'crystal') {
            // Crystal facets
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(leftX + obstacle.width * 0.25, bottomY - obstacle.height * 0.3);
            ctx.lineTo(centerX, topY + obstacle.height * 0.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rightX - obstacle.width * 0.25, bottomY - obstacle.height * 0.3);
            ctx.lineTo(centerX, topY + obstacle.height * 0.2);
            ctx.stroke();
        } else if (obstacle.type === 'ice') {
            // Ice shards
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            for (let i = 0; i < 2; i++) {
                const shardX = centerX + (Math.random() - 0.5) * obstacle.width * 0.8;
                const shardY = topY + Math.random() * obstacle.height * 0.6;
                ctx.beginPath();
                ctx.arc(shardX, shardY, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Base platform (ground connection)
        ctx.fillStyle = '#606060';
        ctx.fillRect(leftX - 1, bottomY, obstacle.width + 2, 3);
        
        // Base platform highlight
        ctx.fillStyle = '#808080';
        ctx.fillRect(leftX - 1, bottomY, obstacle.width + 2, 1);
    }
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 68, b: 68 }; // Default to red if parsing fails
}

// Draw perfect heart shape using mathematical curve
function drawPerfectHeart(centerX, centerY, size, fillStyle, glowStyle = null) {
    ctx.save();
    
    // Add glow effect if provided
    if (glowStyle) {
        ctx.fillStyle = glowStyle;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    
    // Mathematical heart equation: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
    // Scale and position the heart
    const scale = size / 20;
    
    for (let t = 0; t <= Math.PI * 2; t += 0.1) {
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        
        const scaledX = centerX + x * scale;
        const scaledY = centerY + y * scale;
        
        if (t === 0) {
            ctx.moveTo(scaledX, scaledY);
        } else {
            ctx.lineTo(scaledX, scaledY);
        }
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// Draw enhanced hearts (optimized for mobile)
function drawEnhancedHearts() {
    for (let heart of hearts) {
        const time = Date.now() * 0.003; // Slower pulse for better performance
        const pulse = Math.sin(time + heart.x * 0.005) * 0.05 + 0.95; // Reduced pulse effect

        const centerX = heart.x + heart.width / 2;
        const centerY = heart.y + heart.height / 2;
        const heartSize = Math.min(heart.width, heart.height) * 0.4;

        // Draw perfect heart with glow
        const glowStyle = `rgba(255, 105, 180, ${0.3 * pulse})`;
        drawPerfectHeart(centerX, centerY, heartSize, '#FF69B4', glowStyle);

        // Simple highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(centerX - heartSize * 0.15, centerY - heartSize * 0.1, heartSize * 0.08, 0, Math.PI * 2);
        ctx.fill();
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

