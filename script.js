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

// --- AUTHENTICATION LOGIC ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const statusEl = document.getElementById('status');

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        userInfo.innerText = `Logged in as: ${user.displayName}`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        statusEl.innerText = "Ready to play!";
    } else {
        currentUserId = null;
        userInfo.innerText = 'Not logged in';
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        statusEl.innerText = "Please log in to save.";
    }
});

loginBtn.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { statusEl.innerText = "Login failed!"; }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- 3D SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 15, 10);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(40, 40, 0x888888, 0x444444);
scene.add(gridHelper);

// --- LOAD 3D CHARACTER ---
let player = new THREE.Group(); 
scene.add(player);

let currentModel = null;
let mixer = null; 
let idleAction = null;
let walkAction = null;
const clock = new THREE.Clock(); 
const loader = new GLTFLoader();

let currentModelPath = "Casual_Male.gltf";

function loadCharacter(modelPath, spawnPosition = {x: 0, y: 0, z: 0}) {
    if (currentModel) {
        player.remove(currentModel);
    }

    statusEl.innerText = "Loading character...";
    currentModelPath = modelPath;
    document.getElementById('char-select').value = modelPath;

    loader.load(modelPath, (gltf) => {
        currentModel = gltf.scene;
        player.add(currentModel);
        player.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

        if (gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(currentModel);
            idleAction = null;
            walkAction = null;
            
            console.log(`--- Animations for ${modelPath} ---`);
            
            gltf.animations.forEach((clip) => {
                console.log("Found animation:", clip.name); // Check F12 Console to see these!
                const name = clip.name.toLowerCase();
                
                if (name.includes('idle')) idleAction = mixer.clipAction(clip);
                if (name.includes('walk') || name.includes('run')) walkAction = mixer.clipAction(clip);
            });
            
            // If it couldn't find an exact "Idle", pick the first animation that IS NOT falling or dying
            if (!idleAction) {
                const safeClip = gltf.animations.find(c => {
                    const n = c.name.toLowerCase();
                    return !n.includes('death') && !n.includes('defeat') && !n.includes('fall');
                }) || gltf.animations[0]; // Absolute last resort fallback
                
                idleAction = mixer.clipAction(safeClip);
            }
            
            if (idleAction) idleAction.play();
        }
        
        statusEl.innerText = "Character ready!";
    }, undefined, (error) => {
        console.error("Error loading model:", error);
        statusEl.innerText = "Error loading character.";
    });
}

loadCharacter(currentModelPath);

document.getElementById('char-select').addEventListener('change', (e) => {
    const currentPos = player ? player.position : {x: 0, y: 0, z: 0};
    loadCharacter(e.target.value, currentPos);
});

// --- CONTROLS & MOVEMENT ---
const keys = {};
let isMoving = false;
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function updatePlayer() {
    if (!currentModel) return;

    const speed = 0.08;
    isMoving = false;

    if (keys['w'] || keys['arrowup']) { player.position.z -= speed; player.rotation.y = Math.PI; isMoving = true; }
    if (keys['s'] || keys['arrowdown']) { player.position.z += speed; player.rotation.y = 0; isMoving = true; }
    if (keys['a'] || keys['arrowleft']) { player.position.x -= speed; player.rotation.y = -Math.PI / 2; isMoving = true; }
    if (keys['d'] || keys['arrowright']) { player.position.x += speed; player.rotation.y = Math.PI / 2; isMoving = true; }

    if (isMoving && walkAction && !walkAction.isRunning()) {
        if (idleAction) idleAction.stop();
        walkAction.play();
    } else if (!isMoving && idleAction && !idleAction.isRunning()) {
        if (walkAction) walkAction.stop();
        idleAction.play();
    }
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    
    updatePlayer();

    // Isometric Camera Follow
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 10; 
    camera.position.y = player.position.y + 8;
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- FIREBASE SAVE & LOAD ---
document.getElementById('save-btn').addEventListener('click', async () => {
    if (!currentUserId || !currentModel) return;
    
    statusEl.innerText = "Saving to Firebase...";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        await setDoc(saveRef, {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            model: currentModelPath, 
            lastUpdated: new Date().toISOString()
        }, { merge: true });
        
        statusEl.innerText = `Saved Progress & Character!`;
    } catch (error) { 
        console.error(error); 
        statusEl.innerText = "Save failed.";
    }
});

document.getElementById('load-btn').addEventListener('click', async () => {
    if (!currentUserId) return;
    
    statusEl.innerText = "Loading checkpoint...";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        const docSnap = await getDoc(saveRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            loadCharacter(data.model || "Casual_Male.gltf", {x: data.x, y: data.y, z: data.z});
        } else {
            statusEl.innerText = "No save found.";
        }
    } catch (error) { 
        console.error(error); 
        statusEl.innerText = "Load failed.";
    }
});
