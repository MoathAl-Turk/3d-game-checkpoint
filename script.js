import * as THREE from 'three';

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add simple lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 2. Create a Player Object (a colorful 3D Cube)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.2 });
const player = new THREE.Mesh(geometry, material);
scene.add(player);

// Add a floor grid so we have depth perception
const gridHelper = new THREE.GridHelper(20, 20, 0x00ff88, 0x444444);
scene.add(gridHelper);

// 3. Simple Keyboard Movement Controls
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

// 4. Game Loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    
    // Slight idle spin if not moving
    player.rotation.y += 0.005;
    
    renderer.render(scene, camera);
}
animate();

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 5. Firebase Integration Placeholders
document.getElementById('save-btn').addEventListener('click', () => {
    const statusEl = document.getElementById('status');
    statusEl.innerText = "Saving position: X=" + player.position.x.toFixed(2) + ", Z=" + player.position.z.toFixed(2);
    // We will wire this to Firestore next!
});

document.getElementById('load-btn').addEventListener('click', () => {
    const statusEl = document.getElementById('status');
    statusEl.innerText = "Loading checkpoint from Firebase...";
    // We will wire this to Firestore next!
});
