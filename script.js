import * as THREE from 'three';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCe3tkeCGCaxg6P5YAWtyuPFTGt02a6QZQ",
  authDomain: "d-game-checkpoints.firebaseapp.com",
  projectId: "d-game-checkpoints",
  storageBucket: "d-game-checkpoints.firebasestorage.app",
  messagingSenderId: "68575491787",
  appId: "1:68575491787:web:1811cbf860460b55ddcd4e"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Static user save ID for testing checkpoints
const userId = "test_player_moath";

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 2. Player Object (Green Cube)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.2 });
const player = new THREE.Mesh(geometry, material);
scene.add(player);

// Floor grid
const gridHelper = new THREE.GridHelper(20, 20, 0x00ff88, 0x444444);
scene.add(gridHelper);

// 3. Keyboard Controls
const keys = {};
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function updatePlayer() {
    const speed = 0.05;
    if (keys['w'] || keys['arrowup']) player.position.z -= speed;
    if (keys['s'] || keys['arrowdown']) player.position.z += speed;
    if (keys['a'] || keys['arrowleft']) player.position.x -= speed;
    if (keys['d'] || keys['arrowright']) player.position.x += speed;
}

// 4. Game Animation Loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    renderer.render(scene, camera);
}
animate();

// Handle Window Resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 5. Firebase Save Checkpoint
document.getElementById('save-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.innerText = "Saving to Firebase...";

    try {
        const saveRef = doc(db, "game_saves", userId);
        await setDoc(saveRef, {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            lastUpdated: new Date().toISOString()
        }, { merge: true });

        statusEl.innerText = `Saved! X: ${player.position.x.toFixed(1)}, Z: ${player.position.z.toFixed(1)}`;
    } catch (error) {
        console.error("Save error:", error);
        statusEl.innerText = "Error saving progress!";
    }
});

// 6. Firebase Load Checkpoint
document.getElementById('load-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.innerText = "Loading checkpoint...";

    try {
        const saveRef = doc(db, "game_saves", userId);
        const docSnap = await getDoc(saveRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            player.position.set(data.x, data.y, data.z);
            statusEl.innerText = `Loaded! X: ${data.x.toFixed(1)}, Z: ${data.z.toFixed(1)}`;
        } else {
            statusEl.innerText = "No save data found yet.";
        }
    } catch (error) {
        console.error("Load error:", error);
        statusEl.innerText = "Error loading progress!";
    }
});
