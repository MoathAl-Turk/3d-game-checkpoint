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
camera.position.set(0, 8, 10);
camera.lookAt(0, 0, 0);

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
let player = null;
let mixer = null; 
const clock = new THREE.Clock(); 
const loader = new GLTFLoader();

let currentModelPath = "assets/Casual_Male.gltf"; // Default

function loadCharacter(modelPath, spawnPosition = {x: 0, y: 0, z: 0}) {
    if (player) {
        scene.remove(player); // Remove old character
    }

    statusEl.innerText = "Loading character...";
    currentModelPath = modelPath;
    document.getElementById('char-select').value = modelPath;

    loader.load(modelPath, (gltf) => {
        player = gltf.scene;
        player.scale.set(1, 1, 1); 
        player.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
        scene.add(player);

        if (gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(player);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
        }
        
        statusEl.innerText = "Character ready!";
    }, undefined, (error) => {
        console.error("Error loading model:", error);
        statusEl.innerText = "Error loading character.";
    });
}

// Load default character initially
loadCharacter(currentModelPath);

// Handle dropdown changes
document.getElementById('char-select').addEventListener('change', (e) => {
    const currentPos = player ? player.position : {x: 0, y: 0, z: 0};
    loadCharacter(e.target.value, currentPos);
});

// --- CONTROLS & MOVEMENT ---
const keys = {};
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function updatePlayer() {
    if (!player) return;

    const speed = 0.08;
    if (keys['w'] || keys['arrowup']) { player.position.z -= speed; player.rotation.y = Math.PI; }
    if (keys['s'] || keys['arrowdown']) { player.position.z += speed; player.rotation.y = 0; }
    if (keys['a'] || keys['arrowleft']) { player.position.x -= speed; player.rotation.y = -Math.PI / 2; }
    if (keys['d'] || keys['arrowright']) { player.position.x += speed; player.rotation.y = Math.PI / 2; }
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    updatePlayer();
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
    if (!currentUserId || !player) return;
    
    statusEl.innerText = "Saving to Firebase...";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        await setDoc(saveRef, {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            model: currentModelPath, // Save the selected character
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
            // Load the saved character at the saved position
            loadCharacter(data.model || "assets/Casual_Male.gltf", {x: data.x, y: data.y, z: data.z});
        } else {
            statusEl.innerText = "No save found.";
        }
    } catch (error) { 
        console.error(error); 
        statusEl.innerText = "Load failed.";
    }
});
