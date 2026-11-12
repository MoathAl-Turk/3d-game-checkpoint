import * as THREE from 'three';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const firebaseConfig = {
  apiKey: "AIzaSyCe3tkeCGCaxg6P5YAWtyuPFTGt02a6QZQ",
  authDomain: "d-game-checkpoints.firebaseapp.com",
  projectId: "d-game-checkpoints",
  storageBucket: "d-game-checkpoints.firebasestorage.app",
  messagingSenderId: "68575491787",
  appId: "1:68575491787:web:1811cbf860460b55ddcd4e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
let currentUserId = null;

// --- UI SLIDE MENU LOGIC ---
document.getElementById('settings-toggle').addEventListener('click', () => {
    document.getElementById('ui-container').classList.toggle('open');
});

const statusEl = document.getElementById('status');
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        document.getElementById('user-info').innerText = `Logged in as: ${user.displayName}`;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'block';
    } else {
        currentUserId = null;
        document.getElementById('user-info').innerText = 'Not logged in';
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'none';
    }
});
document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- 3D SCENE & SUNSET SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff8c00); // Sunset Orange
scene.fog = new THREE.FogExp2(0xff8c00, 0.015); // Hides the edge of the world with orange fog

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting adapted for sunset
const ambientLight = new THREE.AmbientLight(0xffaa55, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffdcb4, 1.5);
dirLight.position.set(20, 20, -50);
scene.add(dirLight);

// The Sun Sphere
const sunGeom = new THREE.SphereGeometry(15, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xff3300 }); // Glowing red-orange
const sun = new THREE.Mesh(sunGeom, sunMat);
sun.position.set(0, 15, -100);
scene.add(sun);

// --- PARKOUR LEVEL BUILDER ---
const platforms = [];
let platformCounter = 0;

function createPlatform(x, y, z, width, depth, color = 0x22aa55) {
    const geom = new THREE.BoxGeometry(width, 1, depth);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    
    mesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(mesh);
    
    // Store extra data for auto-checkpoints
    platforms.push({
        id: platformCounter++,
        bounds: box,
        centerX: x,
        topY: box.max.y,
        centerZ: z
    });
}

createPlatform(0, -1, 0, 10, 10, 0x555555);              // Start platform
createPlatform(0, 0, -12, 6, 6, 0xaa5522);     // Jump 1
createPlatform(6, 1, -20, 4, 4, 0x5522aa);     // Jump 2 (right)
createPlatform(0, 2, -28, 4, 4, 0xaa2255);     // Jump 3 (left)
createPlatform(0, 3, -40, 8, 8, 0xffaa00);     // Checkpoint platform!

// --- PLAYER PHYSICS VARIABLES ---
let player = new THREE.Group(); 
scene.add(player);

let currentSpawn = { x: 0, y: 0, z: 0 }; 
let currentPlatformId = -1; // Tracks which block you are on
let velocityY = 0;
let isGrounded = false;
const gravity = -0.015; // Slightly floaty gravity for easier parkour
const jumpForce = 0.35;
const moveSpeed = 0.12;

// --- LOAD CHARACTER ---
let currentModel = null, mixer = null, idleAction = null, walkAction = null;
const clock = new THREE.Clock(); 
const loader = new GLTFLoader();
let currentModelPath = "Casual_Male.gltf";

function loadCharacter(modelPath, spawnPos = currentSpawn) {
    if (currentModel) player.remove(currentModel);
    currentModelPath = modelPath;
    
    loader.load(modelPath, (gltf) => {
        currentModel = gltf.scene;
        player.add(currentModel);
        player.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
        velocityY = 0;

        if (gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(currentModel);
            idleAction = null; walkAction = null;
            gltf.animations.forEach((clip) => {
                const name = clip.name.toLowerCase();
                if (name.includes('idle')) idleAction = mixer.clipAction(clip);
                if (name.includes('walk') || name.includes('run')) walkAction = mixer.clipAction(clip);
            });
            if (!idleAction) idleAction = mixer.clipAction(gltf.animations[0]);
            if (idleAction) idleAction.play();
        }
    });
}
loadCharacter(currentModelPath);
document.getElementById('char-select').addEventListener('change', (e) => loadCharacter(e.target.value, player.position));

// --- CONTROLS & PHYSICS LOOP ---
const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true); 
window.addEventListener('keyup', (e) => keys[e.code] = false);

function updatePhysics() {
    if (!currentModel) return;
    let isMoving = false;

    // Movement
    if (keys['KeyW'] || keys['ArrowUp']) { player.position.z -= moveSpeed; player.rotation.y = Math.PI; isMoving = true; }
    if (keys['KeyS'] || keys['ArrowDown']) { player.position.z += moveSpeed; player.rotation.y = 0; isMoving = true; }
    if (keys['KeyA'] || keys['ArrowLeft']) { player.position.x -= moveSpeed; player.rotation.y = -Math.PI / 2; isMoving = true; }
    if (keys['KeyD'] || keys['ArrowRight']) { player.position.x += moveSpeed; player.rotation.y = Math.PI / 2; isMoving = true; }

    // Improved Collision Detection (Padded Hitbox)
    let floorY = -Infinity;
    let landedPlatform = null;
    const pX = player.position.x;
    const pZ = player.position.z;
    const hitboxPadding = 0.6; // Expands the platform catch area so you don't slip off the very edge

    for (const plat of platforms) {
        if (pX + hitboxPadding > plat.bounds.min.x && pX - hitboxPadding < plat.bounds.max.x &&
            pZ + hitboxPadding > plat.bounds.min.z && pZ - hitboxPadding < plat.bounds.max.z) {
            
            if (plat.topY > floorY && player.position.y >= plat.topY - Math.abs(velocityY) - 0.2) {
                floorY = plat.topY;
                landedPlatform = plat;
            }
        }
    }

    // Apply Gravity
    velocityY += gravity;
    player.position.y += velocityY;

    // Ground Collision & Auto Checkpoints
    if (player.position.y <= floorY) {
        player.position.y = floorY;
        velocityY = 0;
        isGrounded = true;
        
        // Auto-save local checkpoint to the center of the block you just landed on
        if (landedPlatform && currentPlatformId !== landedPlatform.id) {
            currentPlatformId = landedPlatform.id;
            currentSpawn = { x: landedPlatform.centerX, y: landedPlatform.topY, z: landedPlatform.centerZ };
        }
    } else {
        isGrounded = false;
    }

    // Jumping
    if (keys['Space'] && isGrounded) {
        velocityY = jumpForce;
        isGrounded = false;
    }

    // Void Death / Respawn at local checkpoint
    if (player.position.y < -15) {
        player.position.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
        velocityY = 0;
        statusEl.innerText = "Respawned at block!";
    }

    // Handle Animations
    if (isMoving && isGrounded && walkAction && !walkAction.isRunning()) {
        if (idleAction) idleAction.stop();
        walkAction.play();
    } else if ((!isMoving || !isGrounded) && idleAction && !idleAction.isRunning()) {
        if (walkAction) walkAction.stop();
        idleAction.play();
    }
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    
    // Slowly rotate the sun in the background
    sun.position.x = Math.sin(Date.now() * 0.0005) * 50;

    updatePhysics();

    // Camera follows player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 12; 
    camera.position.y = player.position.y + 6;
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- FIREBASE SAVE & LOAD (CLOUD CHECKPOINTS) ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!currentUserId || !currentModel) return;
    statusEl.innerText = "Saving to cloud...";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        await setDoc(saveRef, {
            x: player.position.x, y: player.position.y, z: player.position.z,
            model: currentModelPath, lastUpdated: new Date().toISOString()
        }, { merge: true });
        statusEl.innerText = `Cloud Checkpoint saved!`;
    } catch (error) { statusEl.innerText = "Save failed."; }
});

document.getElementById('load-btn').addEventListener('click', async () => {
    if (!currentUserId) return;
    statusEl.innerText = "Loading cloud checkpoint...";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        const docSnap = await getDoc(saveRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentSpawn = { x: data.x, y: data.y, z: data.z }; 
            currentPlatformId = -1; // Reset block tracker
            loadCharacter(data.model || "Casual_Male.gltf", currentSpawn);
            statusEl.innerText = "Loaded cloud checkpoint!";
        } else {
            statusEl.innerText = "No save found.";
        }
    } catch (error) { statusEl.innerText = "Load failed."; }
});
