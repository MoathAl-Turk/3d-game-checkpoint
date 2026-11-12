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

// --- AUTHENTICATION LOGIC ---
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

// --- 3D SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 20, 100); // Adds atmospheric distance fading

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// --- PARKOUR LEVEL BUILDER ---
const platforms = [];

function createPlatform(x, y, z, width, depth, color = 0x22aa55) {
    const geom = new THREE.BoxGeometry(width, 1, depth);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    
    // Store the exact bounding box for collision detection
    mesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(mesh);
    platforms.push(box);
}

// Build the map!
createPlatform(0, -1, 0, 10, 10);              // Start platform
createPlatform(0, 0, -12, 6, 6, 0xaa5522);     // Jump 1 (higher)
createPlatform(6, 1, -20, 4, 4, 0x5522aa);     // Jump 2 (right)
createPlatform(0, 2, -28, 4, 4, 0xaa2255);     // Jump 3 (left)
createPlatform(0, 3, -40, 8, 8, 0xffaa00);     // Checkpoint platform!

// --- PLAYER PHYSICS VARIABLES ---
let player = new THREE.Group(); 
scene.add(player);

let currentSpawn = { x: 0, y: 0, z: 0 }; // Where they respawn if they fall
let velocityY = 0;
let isGrounded = false;
const gravity = -0.018;
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
        velocityY = 0; // Reset falling speed when loading

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
window.addEventListener('keydown', (e) => keys[e.code] = true); // Using e.code for better Spacebar support
window.addEventListener('keyup', (e) => keys[e.code] = false);

function updatePhysics() {
    if (!currentModel) return;
    let isMoving = false;

    // 1. Horizontal Movement
    if (keys['KeyW'] || keys['ArrowUp']) { player.position.z -= moveSpeed; player.rotation.y = Math.PI; isMoving = true; }
    if (keys['KeyS'] || keys['ArrowDown']) { player.position.z += moveSpeed; player.rotation.y = 0; isMoving = true; }
    if (keys['KeyA'] || keys['ArrowLeft']) { player.position.x -= moveSpeed; player.rotation.y = -Math.PI / 2; isMoving = true; }
    if (keys['KeyD'] || keys['ArrowRight']) { player.position.x += moveSpeed; player.rotation.y = Math.PI / 2; isMoving = true; }

    // 2. Determine floor height directly under player
    let floorY = -Infinity;
    for (const box of platforms) {
        // Simple bounding box check (X and Z)
        if (player.position.x > box.min.x && player.position.x < box.max.x &&
            player.position.z > box.min.z && player.position.z < box.max.z) {
            // If the platform is below the player's feet (allowing for current fall speed)
            if (box.max.y > floorY && player.position.y >= box.max.y - Math.abs(velocityY) - 0.2) {
                floorY = box.max.y;
            }
        }
    }

    // 3. Apply Gravity
    velocityY += gravity;
    player.position.y += velocityY;

    // 4. Ground Collision & Jumping
    if (player.position.y <= floorY) {
        player.position.y = floorY;
        velocityY = 0;
        isGrounded = true;
    } else {
        isGrounded = false;
    }

    if (keys['Space'] && isGrounded) {
        velocityY = jumpForce;
        isGrounded = false;
    }

    // 5. Void Death / Respawn Checkpoint
    if (player.position.y < -15) {
        player.position.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
        velocityY = 0;
        statusEl.innerText = "Respawned at checkpoint!";
    }

    // 6. Handle Animations
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
    
    updatePhysics();

    // Camera smoothly follows player
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

// --- FIREBASE SAVE & LOAD (CHECKPOINTS) ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!currentUserId || !currentModel) return;
    statusEl.innerText = "Saving checkpoint...";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        await setDoc(saveRef, {
            x: player.position.x, y: player.position.y, z: player.position.z,
            model: currentModelPath, lastUpdated: new Date().toISOString()
        }, { merge: true });
        
        // Update the respawn point to this save!
        currentSpawn = { x: player.position.x, y: player.position.y, z: player.position.z };
        statusEl.innerText = `Checkpoint saved!`;
    } catch (error) { statusEl.innerText = "Save failed."; }
});

document.getElementById('load-btn').addEventListener('click', async () => {
    if (!currentUserId) return;
    statusEl.innerText = "Loading checkpoint...";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        const docSnap = await getDoc(saveRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentSpawn = { x: data.x, y: data.y, z: data.z }; // Update respawn point
            loadCharacter(data.model || "Casual_Male.gltf", currentSpawn);
            statusEl.innerText = "Loaded saved checkpoint!";
        } else {
            statusEl.innerText = "No save found.";
        }
    } catch (error) { statusEl.innerText = "Load failed."; }
});
