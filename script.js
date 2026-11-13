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

// --- ECONOMY & SHOP SYSTEM ---
let playerCash = 0;
let unlockedCharacters = ["Casual_Male.gltf"]; 

const characterRoster = [
    { path: "Casual_Male.gltf", name: "Casual Male", cost: 0 },
    { path: "Casual_Female.gltf", name: "Casual Female", cost: 200 },
    { path: "Pirate_Male.gltf", name: "Pirate Male", cost: 300 },
    { path: "Pirate_Female.gltf", name: "Pirate Female", cost: 400 },
    { path: "Zombie_Male.gltf", name: "Zombie Male", cost: 500 }
];

function updateShopUI() {
    document.getElementById('cash-display').innerText = `Cash: $${playerCash}`;
    const select = document.getElementById('char-select');
    select.innerHTML = ''; 
    
    characterRoster.forEach(char => {
        const option = document.createElement('option');
        option.value = char.path;
        if (unlockedCharacters.includes(char.path)) {
            option.innerText = `${char.name} (Owned)`;
        } else {
            option.innerText = `${char.name} ($${char.cost})`;
        }
        select.appendChild(option);
    });
    select.value = currentModelPath; 
}

// --- COMBAT UI ---
const combatUI = document.createElement('div');
combatUI.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); color:#ff4444; font-size:24px; font-weight:bold; text-shadow: 2px 2px 0 #000; display:none; text-align:center; z-index:5; pointer-events:none; width: 90%;";
document.body.appendChild(combatUI);

// --- UI SLIDE MENU LOGIC ---
document.getElementById('settings-toggle').addEventListener('click', () => document.getElementById('ui-container').classList.toggle('open'));
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

// --- STARTUP / CONTROL SELECTION LOGIC ---
const startupPrompt = document.getElementById('startup-prompt');
const mobileControls = document.getElementById('mobile-controls');
if (document.getElementById('choose-pc')) {
    document.getElementById('choose-pc').addEventListener('click', () => {
        startupPrompt.style.display = 'none';
        mobileControls.style.display = 'none';
    });
}
if (document.getElementById('choose-mobile')) {
    document.getElementById('choose-mobile').addEventListener('click', () => {
        startupPrompt.style.display = 'none';
        mobileControls.style.display = 'block';
    });
}

// --- 3D SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffaa55, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffdcb4, 1.5);
dirLight.position.set(20, 20, -50);
scene.add(dirLight);

const sunGeom = new THREE.SphereGeometry(15, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xff3300 }); 
const sun = new THREE.Mesh(sunGeom, sunMat);
scene.add(sun);

// --- LEVEL MANAGEMENT ---
let currentLevel = 1;
const platforms = [];
let platformCounter = 0;

function createPlatform(x, y, z, width, depth, color = 0x22aa55, isGoal = false) {
    const geom = new THREE.BoxGeometry(width, 1, depth);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
    if (isGoal) mat.emissive.setHex(0x555500); 
    
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    mesh.updateMatrixWorld();
    
    const box = new THREE.Box3().setFromObject(mesh);
    platforms.push({
        id: platformCounter++, mesh: mesh, bounds: box,
        centerX: x, topY: box.max.y, centerZ: z, isGoal: isGoal
    });
}

function buildParkourLevel() {
    currentLevel = 1;
    combatUI.style.display = "none";
    scene.background = new THREE.Color(0xff8c00); 
    scene.fog = new THREE.FogExp2(0xff8c00, 0.015);
    sun.material.color.setHex(0xff3300);
    sun.scale.set(1, 1, 1);
    sun.position.set(0, 15, -100);
    ambientLight.color.setHex(0xffaa55);
    dirLight.color.setHex(0xffdcb4);

    platforms.forEach(p => scene.remove(p.mesh));
    platforms.length = 0;

    createPlatform(0, -1, 0, 10, 10, 0x555555);          
    createPlatform(0, 0, -12, 6, 6, 0xaa5522);           
    createPlatform(6, 1, -20, 4, 4, 0x5522aa);           
    createPlatform(0, 2, -28, 4, 4, 0xaa2255);           
    createPlatform(0, 3, -40, 8, 8, 0xffaa00);           
    createPlatform(-8, 4, -48, 4, 4, 0x2255aa);          
    createPlatform(0, 4, -60, 8, 8, 0xffff00, true); 
}

// --- BOSS COMBAT VARIABLES ---
let boss = null;
let bossHP = 5;
let playerHP = 3;
let meteors = [];
let lastMeteorTime = 0;

function buildBossLevel() {
    currentLevel = 2;
    statusEl.innerText = "Entered the Red Moon Arena!";
    statusEl.style.color = "#00ff88";
    isDead = false;
    isPunching = false;
    
    platforms.forEach(p => scene.remove(p.mesh));
    platforms.length = 0;
    
    scene.background = new THREE.Color(0x1a0505); 
    scene.fog = new THREE.FogExp2(0x1a0505, 0.015);
    sun.material.color.setHex(0xff0000); 
    sun.scale.set(2.5, 2.5, 2.5); 
    sun.position.set(0, 40, -150);
    ambientLight.color.setHex(0x440000); 
    dirLight.color.setHex(0xff4444); 

    createPlatform(0, -1, 0, 300, 300, 0x221111);

    if (boss) scene.remove(boss);
    const bossGeom = new THREE.BoxGeometry(5, 5, 5);
    const bossMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0x330000 });
    boss = new THREE.Mesh(bossGeom, bossMat);
    boss.position.set(0, 2.5, -20);
    scene.add(boss);

    bossHP = 5;
    playerHP = 3;
    lastMeteorTime = clock.getElapsedTime();
    updateCombatUI();
    
    meteors.forEach(m => scene.remove(m));
    meteors.length = 0;

    player.position.set(0, 1, 0);
    currentSpawn = { x: 0, y: 1, z: 0 };
    
    if (idleAction) {
        if (deathAction) deathAction.stop();
        if (mixer) mixer.stopAllAction();
        idleAction.reset();
        idleAction.play();
    }
}

function updateCombatUI() {
    combatUI.style.display = "block";
    combatUI.innerHTML = `HP: ${'❤️'.repeat(playerHP)} <br> Boss Cube: ${bossHP} / 5<br><span style="font-size:14px; color:#ccc;">Press E (or Punch) to Attack!</span>`;
}

function spawnMeteors() {
    if (isDead) return; 
    statusEl.innerText = "WARNING: METEORS INCOMING!";
    statusEl.style.color = "#ff4444";
    for (let i = 0; i < 15; i++) {
        const geom = new THREE.SphereGeometry(0.8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff1100 }); 
        const meteor = new THREE.Mesh(geom, mat);
        
        meteor.position.set(
            player.position.x + (Math.random() - 0.5) * 40,
            player.position.y + 30 + (Math.random() * 15),
            player.position.z + (Math.random() - 0.5) * 40
        );
        scene.add(meteor);
        meteors.push(meteor);
    }
}

// --- PLAYER STATE VARIABLES ---
let player = new THREE.Group(); 
scene.add(player);
let currentSpawn = { x: 0, y: 0, z: 0 }; 
let currentPlatformId = -1; 
let velocityY = 0;
let isGrounded = false;
let isPunching = false;
let isDead = false;

const gravity = -0.015; 
const jumpForce = 0.35;
const moveSpeed = 0.12;

// --- LOAD CHARACTER & ANIMATIONS ---
let currentModel = null, mixer = null;
let idleAction = null, walkAction = null, punchAction = null, deathAction = null;
const clock = new THREE.Clock(); 
const loader = new GLTFLoader();
let currentModelPath = "Casual_Male.gltf";

function loadCharacter(modelPath, spawnPos = currentSpawn) {
    if (currentModel) {
        player.remove(currentModel);
        currentModel = null;
    }
    
    currentModelPath = modelPath;
    statusEl.innerText = "Loading " + modelPath + "...";
    statusEl.style.color = "#ffff00"; 
    
    loader.load(modelPath, (gltf) => {
        currentModel = gltf.scene;
        player.add(currentModel);
        player.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
        velocityY = 0;
        
        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(currentModel);
            idleAction = null; walkAction = null; punchAction = null; deathAction = null;
            
            gltf.animations.forEach((clip) => {
                const n = clip.name.toLowerCase().trim();
                if (n === 'idle') idleAction = mixer.clipAction(clip);
                if (n === 'walk' || n === 'run') walkAction = mixer.clipAction(clip);
                if (n === 'punch' || n === 'attack') punchAction = mixer.clipAction(clip);
                if (n === 'death' || n === 'defeat') deathAction = mixer.clipAction(clip);
            });
            
            if (!idleAction) idleAction = mixer.clipAction(gltf.animations[0]);
            
            if (punchAction) punchAction.setLoop(THREE.LoopOnce, 1);
            if (deathAction) {
                deathAction.setLoop(THREE.LoopOnce, 1);
                deathAction.clampWhenFinished = true; 
            }
            
            idleAction.play();
        }
        statusEl.innerText = "Character Ready!";
        statusEl.style.color = "#00ff88"; 
        
    }, undefined, (error) => {
        console.error("3D MODEL LOAD ERROR:", error);
        statusEl.innerText = `❌ ERROR: Cannot load ${modelPath}!`;
        statusEl.style.color = "#ff4444"; 
    });
}

updateShopUI(); 
loadCharacter(currentModelPath);

// --- SHOP LOGIC ---
document.getElementById('char-select').addEventListener('change', (e) => {
    const selectedPath = e.target.value;
    const charData = characterRoster.find(c => c.path === selectedPath);

    if (unlockedCharacters.includes(selectedPath)) {
        loadCharacter(selectedPath, player.position);
    } else {
        if (playerCash >= charData.cost) {
            playerCash -= charData.cost;
            unlockedCharacters.push(selectedPath);
            updateShopUI(); 
            loadCharacter(selectedPath, player.position);
            statusEl.innerText = `Bought ${charData.name}!`;
            statusEl.style.color = "#00ff88";
            saveGameData(); 
        } else {
            statusEl.innerText = `Need $${charData.cost - playerCash} more to buy!`;
            statusEl.style.color = "#ff4444";
            e.target.value = currentModelPath; 
        }
    }
});

// --- ACTION TRIGGERS ---
function attemptPunch() {
    if (isDead || isPunching) return; 
    
    if (punchAction && mixer) {
        isPunching = true;
        if (walkAction) walkAction.stop();
        if (idleAction) idleAction.stop();
        
        punchAction.reset();
        punchAction.play();
        
        setTimeout(() => { 
            isPunching = false; 
            if (!isDead && idleAction) {
                punchAction.stop();
                idleAction.play();
            }
        }, 800); 
    }

    if (currentLevel === 2 && boss) {
        if (player.position.distanceTo(boss.position) < 7) {
            bossHP--;
            
            boss.material.color.setHex(0xffffff);
            setTimeout(() => { if(boss) boss.material.color.setHex(0xaa0000); }, 150);
            
            if (bossHP <= 0) {
                scene.remove(boss);
                boss = null;
                meteors.forEach(m => scene.remove(m)); 
                meteors.length = 0;
                
                playerCash += 100;
                updateShopUI();
                saveGameData(); 
                
                combatUI.innerHTML = "<span style='color:#00ff88; font-size:30px;'>BOSS DEFEATED! +$100</span>";
            } else {
                updateCombatUI();
            }
        } else {
            statusEl.innerText = "Too far to punch!";
            statusEl.style.color = "#ffaa00";
        }
    }
}

function triggerDeath() {
    if (isDead) return;
    isDead = true;
    statusEl.innerText = "You died! Restarting arena...";
    statusEl.style.color = "#ff4444";
    
    if (mixer) mixer.stopAllAction(); 
    
    if (deathAction) {
        deathAction.reset();
        deathAction.play();
        setTimeout(() => { 
            if (currentLevel === 2) buildBossLevel(); 
            else {
                isDead = false; 
                if (idleAction) { deathAction.stop(); idleAction.play(); }
                statusEl.innerText = "Character Ready!";
                statusEl.style.color = "#00ff88";
            }
        }, 3000);
    } else {
        if (currentLevel === 2) buildBossLevel(); 
    }
}

// --- CONTROLS & INPUT LOOP ---
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyE') attemptPunch();
    if (e.code === 'KeyK') triggerDeath(); 
}); 
window.addEventListener('keyup', (e) => keys[e.code] = false);

function bindTouch(btnId, keyId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    const press = (e) => {
        e.preventDefault(); 
        keys[keyId] = true;
        if (keyId === 'KeyE') attemptPunch();
    };
    
    const release = (e) => {
        e.preventDefault();
        keys[keyId] = false;
    };

    btn.addEventListener('touchstart', press, {passive: false});
    btn.addEventListener('touchend', release, {passive: false});
    btn.addEventListener('touchcancel', release, {passive: false});
    
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
}

bindTouch('btn-up', 'KeyW');
bindTouch('btn-down', 'KeyS');
bindTouch('btn-left', 'KeyA');
bindTouch('btn-right', 'KeyD');
bindTouch('btn-jump', 'Space');
bindTouch('btn-punch', 'KeyE');

// --- PHYSICS ENGINE ---
function updatePhysics() {
    if (!currentModel) return;
    let isMoving = false;

    if (!isDead && !isPunching) {
        if (keys['KeyW'] || keys['ArrowUp']) { player.position.z -= moveSpeed; player.rotation.y = Math.PI; isMoving = true; }
        if (keys['KeyS'] || keys['ArrowDown']) { player.position.z += moveSpeed; player.rotation.y = 0; isMoving = true; }
        if (keys['KeyA'] || keys['ArrowLeft']) { player.position.x -= moveSpeed; player.rotation.y = -Math.PI / 2; isMoving = true; }
        if (keys['KeyD'] || keys['ArrowRight']) { player.position.x += moveSpeed; player.rotation.y = Math.PI / 2; isMoving = true; }
    }

    let floorY = -Infinity;
    let landedPlatform = null;
    const pX = player.position.x;
    const pZ = player.position.z;

    for (const plat of platforms) {
        if (pX + 0.6 > plat.bounds.min.x && pX - 0.6 < plat.bounds.max.x &&
            pZ + 0.6 > plat.bounds.min.z && pZ - 0.6 < plat.bounds.max.z) {
            if (plat.topY > floorY && player.position.y >= plat.topY - Math.abs(velocityY) - 0.2) {
                floorY = plat.topY;
                landedPlatform = plat;
            }
        }
    }

    velocityY += gravity;
    player.position.y += velocityY;

    if (player.position.y <= floorY) {
        player.position.y = floorY;
        velocityY = 0;
        isGrounded = true;
        
        if (landedPlatform && currentPlatformId !== landedPlatform.id) {
            currentPlatformId = landedPlatform.id;
            if (landedPlatform.isGoal) {
                playerCash += 50;
                updateShopUI();
                statusEl.innerText = "Reached the Arena! +$50";
                statusEl.style.color = "#00ff88";
                saveGameData();
                
                buildBossLevel();
                return; 
            } else {
                currentSpawn = { x: landedPlatform.centerX, y: landedPlatform.topY, z: landedPlatform.centerZ };
            }
        }
    } else {
        isGrounded = false;
    }

    if (!isDead && !isPunching && keys['Space'] && isGrounded) { 
        velocityY = jumpForce; 
        isGrounded = false; 
    }

    if (player.position.y < -15) {
        if (currentLevel === 2 && !isDead) {
            playerHP--;
            updateCombatUI();
            if (playerHP <= 0) {
                player.position.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
                velocityY = 0;
                triggerDeath();
            } else {
                player.position.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
                velocityY = 0;
            }
        } else if (currentLevel === 1) {
            player.position.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
            velocityY = 0;
        }
    }

    if (!isDead && !isPunching) {
        if (isMoving && isGrounded && walkAction && !walkAction.isRunning()) {
            if (idleAction) idleAction.stop(); 
            walkAction.play();
        } else if ((!isMoving || !isGrounded) && idleAction && !idleAction.isRunning()) {
            if (walkAction) walkAction.stop(); 
            idleAction.play();
        }
    }
}

function updateCombatLogic(time) {
    if (currentLevel !== 2) return;
    
    if (boss && !isDead && time - lastMeteorTime > 10) {
        lastMeteorTime = time;
        spawnMeteors();
    }
    
    for (let i = meteors.length - 1; i >= 0; i--) {
        let m = meteors[i];
        m.position.y -= 0.35; 
        
        if (m.position.y < 0) {
            scene.remove(m);
            meteors.splice(i, 1);
            continue;
        }
        
        if (!isDead && m.position.distanceTo(player.position) < 2.0) {
            scene.remove(m);
            meteors.splice(i, 1);
            playerHP--;
            updateCombatUI();
            
            if (playerHP <= 0) {
                triggerDeath();
            } else {
                player.position.y += 2;
                velocityY = 0;
                statusEl.innerText = "OUCH! Hit by a meteor!";
                statusEl.style.color = "#ffaa00";
            }
        }
    }
    
    // Boss Floating & Body Collision
    if (boss) {
        boss.position.y = 2.5 + Math.sin(time * 2) * 0.5;
        boss.rotation.y += 0.01;

        // Check if player is touching/inside the boss cube
        if (!isDead && player.position.distanceTo(boss.position) < 3.5) {
            playerHP--;
            updateCombatUI();
            
            if (playerHP <= 0) {
                triggerDeath();
            } else {
                // Knockback Math: Push the player away from the center of the boss
                const dx = player.position.x - boss.position.x;
                const dz = player.position.z - boss.position.z;
                const length = Math.sqrt(dx * dx + dz * dz) || 1; // Prevent divide by zero
                
                player.position.x += (dx / length) * 4; // Push back 4 units
                player.position.z += (dz / length) * 4;
                player.position.y += 2; // Pop them up into the air
                velocityY = 0;
                
                statusEl.innerText = "OUCH! Don't touch the Boss!";
                statusEl.style.color = "#ff4444";
            }
        }
    }
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    if (mixer) mixer.update(clock.getDelta());
    
    sun.position.x = Math.sin(Date.now() * 0.0005) * 50;

    updatePhysics();
    updateCombatLogic(time);

    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 12; 
    camera.position.y = player.position.y + 6;
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}

buildParkourLevel();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- FIREBASE SAVE & LOAD CORE ---
async function saveGameData() {
    if (!currentUserId || !currentModel) return;
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        await setDoc(saveRef, {
            x: player.position.x, y: player.position.y, z: player.position.z,
            model: currentModelPath, 
            level: currentLevel,
            cash: playerCash,
            unlocked: unlockedCharacters,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch (error) { console.error("Save failed:", error); }
}

document.getElementById('save-btn').addEventListener('click', async () => {
    statusEl.innerText = "Saving to cloud...";
    statusEl.style.color = "#ffff00";
    await saveGameData();
    statusEl.innerText = `Saved Checkpoint!`;
    statusEl.style.color = "#00ff88";
});

document.getElementById('load-btn').addEventListener('click', async () => {
    if (!currentUserId) return;
    statusEl.innerText = "Loading cloud checkpoint...";
    statusEl.style.color = "#ffff00";
    try {
        const saveRef = doc(db, "game_saves", currentUserId);
        const docSnap = await getDoc(saveRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            playerCash = data.cash || 0;
            unlockedCharacters = data.unlocked || ["Casual_Male.gltf"];
            updateShopUI();
            
            if (data.level === 2) buildBossLevel();
            else buildParkourLevel();
            
            currentSpawn = { x: data.x, y: data.y, z: data.z }; 
            currentPlatformId = -1; 
            loadCharacter(data.model || "Casual_Male.gltf", currentSpawn);
            
            statusEl.innerText = "Loaded cloud checkpoint!";
            statusEl.style.color = "#00ff88";
        } else {
            statusEl.innerText = "No save found.";
            statusEl.style.color = "#ff4444";
        }
    } catch (error) { 
        statusEl.innerText = "Load failed.";
        statusEl.style.color = "#ff4444";
    }
});
