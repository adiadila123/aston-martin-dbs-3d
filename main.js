import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ==========================================
// 1. SETUP LENIS (Ultra-Smooth Momentum Scroll)
// ==========================================
const lenis = new Lenis({
    duration: 1.25,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 2
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// ==========================================
// 2. THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById('webgl-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08080a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.85, 4.15);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// HD PBR Environment reflections (RoomEnvironment)
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

// ==========================================
// 3. CINEMATIC LIGHTING RIG
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// Key sunlight from top-right
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(6, 9, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 25;
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

// Cool blue rim light
const rimLight = new THREE.DirectionalLight(0x4080ff, 2.2);
rimLight.position.set(-6, 3, -4);
scene.add(rimLight);

// British Racing warm accent light
const warmAccentLight = new THREE.PointLight(0xd4af37, 2.0, 12);
warmAccentLight.position.set(-3, 2, 3);
scene.add(warmAccentLight);

// Subtle floor shadow receiver
const shadowPlaneGeo = new THREE.PlaneGeometry(35, 35);
const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.38 });
const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = 0;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// ==========================================
// 4. LOAD 3D MODEL WITH DRACO
// ==========================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const loaderOverlay = document.getElementById('loader-overlay');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');

let carModel = null;
let carBaseY = 0;
const paintMeshes = [];
const wheelMeshes = [];
const frontWheelMeshes = [];
const rearWheelMeshes = [];
const caliperMeshes = [];
const interiorMeshes = [];
const carbonMeshes = [];
const headlightMeshes = [];
const taillightMeshes = [];

let isDriveMode = false;
let isHighwayMode = false;
let currentLivery = 'none';
let currentDriveMode = 'gt';

const defaultPaintColor = new THREE.Color('#141416');
let originalPaintColor = new THREE.Color(0x141416);

// Dynamic Headlights and Taillights Rig
const headlightsRig = new THREE.Group();
const leftHeadlight = new THREE.SpotLight(0xffffff, 0, 22, Math.PI / 5.5, 0.45, 1.2);
leftHeadlight.position.set(-0.65, 0.58, 1.85);
leftHeadlight.target.position.set(-0.65, 0.05, 9.0);
scene.add(leftHeadlight.target);
headlightsRig.add(leftHeadlight);

const rightHeadlight = new THREE.SpotLight(0xffffff, 0, 22, Math.PI / 5.5, 0.45, 1.2);
rightHeadlight.position.set(0.65, 0.58, 1.85);
rightHeadlight.target.position.set(0.65, 0.05, 9.0);
scene.add(rightHeadlight.target);
headlightsRig.add(rightHeadlight);

const leftTaillight = new THREE.PointLight(0xff1a1a, 0, 7, 2);
leftTaillight.position.set(-0.62, 0.68, -1.95);
headlightsRig.add(leftTaillight);

const rightTaillight = new THREE.PointLight(0xff1a1a, 0, 7, 2);
rightTaillight.position.set(0.62, 0.68, -1.95);
headlightsRig.add(rightTaillight);

scene.add(headlightsRig);

let isHeadlightsOn = false;

function setHeadlights(on) {
    isHeadlightsOn = on;
    const targetFront = on ? 4.8 : 0;
    const targetRear = on ? 2.5 : 0;

    gsap.to(leftHeadlight, { intensity: targetFront, duration: 0.3 });
    gsap.to(rightHeadlight, { intensity: targetFront, duration: 0.3 });
    gsap.to(leftTaillight, { intensity: targetRear, duration: 0.3 });
    gsap.to(rightTaillight, { intensity: targetRear, duration: 0.3 });

    headlightMeshes.forEach(mesh => {
        if (mesh.material) {
            mesh.material.emissive = mesh.material.emissive || new THREE.Color();
            mesh.material.emissive.set(on ? 0xffffff : 0x000000);
            mesh.material.emissiveIntensity = on ? 3.5 : 0;
            mesh.material.needsUpdate = true;
        }
    });

    taillightMeshes.forEach(mesh => {
        if (mesh.material) {
            mesh.material.emissive = mesh.material.emissive || new THREE.Color();
            mesh.material.emissive.set(on ? 0xff2200 : 0x000000);
            mesh.material.emissiveIntensity = on ? 2.8 : 0;
            mesh.material.needsUpdate = true;
        }
    });

    const toggleBtn = document.getElementById('btn-toggle-headlights');
    if (toggleBtn) {
        if (on) {
            toggleBtn.classList.add('active');
            toggleBtn.querySelector('.system-text').innerHTML = 'LED Lights: <strong>ON</strong>';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.querySelector('.system-text').innerHTML = 'LED Lights: <strong>OFF</strong>';
        }
    }
}

gltfLoader.load(
    'assets/scene-v5.glb',
    (gltf) => {
        carModel = gltf.scene;

        carModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.envMapIntensity = 1.35;
                    const matName = (child.material.name || '').toLowerCase();
                    const meshName = (child.name || '').toLowerCase();

                    if (matName.includes('paint')) {
                        paintMeshes.push(child);
                        // Apply default stealth Obsidian Black Satin Matte
                        child.material.color.copy(defaultPaintColor);
                        child.material.roughness = 0.52;
                        child.material.metalness = 0.35;
                        child.material.clearcoat = 0.0;
                        child.material.needsUpdate = true;
                    } else if (matName.includes('wheel') || meshName.includes('wheel')) {
                        wheelMeshes.push(child);
                        child.material.color.set('#101012');
                        child.material.roughness = 0.18;
                        child.material.metalness = 0.9;
                        child.material.needsUpdate = true;
                    } else if (matName.includes('calliper') || matName.includes('caliper') || meshName.includes('calliper')) {
                        caliperMeshes.push(child);
                        child.material.color.set('#cbe432'); // Default Aston Lime
                        child.material.roughness = 0.22;
                        child.material.metalness = 0.5;
                        child.material.needsUpdate = true;
                    } else if (matName.includes('interiortillingcolourzone') || matName.includes('color_int') || (matName.includes('interior') && !matName.includes('window'))) {
                        interiorMeshes.push(child);
                        child.material.color.set('#935d37'); // Oxford Tan
                        child.material.roughness = 0.48;
                        child.material.needsUpdate = true;
                    } else if (matName.includes('carbon')) {
                        carbonMeshes.push(child);
                        child.material.roughness = 0.32;
                        child.material.metalness = 0.65;
                        child.material.needsUpdate = true;
                    } else if (matName.includes('lighta') || matName.includes('glass_light')) {
                        headlightMeshes.push(child);
                    } else if (matName.includes('red_glass')) {
                        taillightMeshes.push(child);
                    }
                }
            }
        });

        // Center model
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        carModel.position.sub(center);

        // Ground the wheels exactly on the floor plane
        const updatedBox = new THREE.Box3().setFromObject(carModel);
        carModel.position.y -= updatedBox.min.y;

        // Proportional scale
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 4.35 / maxDim;
        carModel.scale.setScalar(targetScale);

        scene.add(carModel);

        // Store baseline ground Y
        carBaseY = carModel.position.y;

        // Categorize front vs rear wheels for dynamic steering lock
        wheelMeshes.forEach((wheel) => {
            const wBox = new THREE.Box3().setFromObject(wheel);
            const wCenter = wBox.getCenter(new THREE.Vector3());
            if (wCenter.z > 0) {
                frontWheelMeshes.push(wheel);
            } else {
                rearWheelMeshes.push(wheel);
            }
        });

        // Fade loading screen
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.innerText = '100%';
        setTimeout(() => {
            if (loaderOverlay) loaderOverlay.classList.add('hidden');
            playHeroEntrance();
        }, 300);
    },
    (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressPercent) progressPercent.innerText = `${percent}%`;
        }
    },
    (error) => {
        console.error('Error loading 3D model:', error);
        if (loaderOverlay) {
            loaderOverlay.innerHTML = `
                <p style="color:#e50914; font-weight:700;">Could not load 3D asset</p>
                <p style="color:#888; font-size:0.85rem; margin-top:8px;">Please check your connection.</p>
            `;
        }
    }
);

// ==========================================
// 5. CINEMATIC CAMERA SCROLL TIMELINE
// ==========================================
gsap.registerPlugin(ScrollTrigger);

const isMobilePortrait = (window.innerWidth / window.innerHeight) < 0.75;
const heroBaseDistance = isMobilePortrait ? 4.30 : 4.15;
const cameraCoords = {
    x: 0,
    y: isMobilePortrait ? 0.96 : 0.85,
    z: heroBaseDistance,
    lookX: 0,
    lookY: isMobilePortrait ? 0.28 : 0.18,
    lookZ: 0,
    carRotY: 0
};

// Hero direct 3D interaction state (Rotate 360°, Zoom In/Out)
let heroRotY = 0;
let heroPitchY = 0;
let heroCurrentZoom = heroBaseDistance;
let heroTargetZoom = heroBaseDistance;
let isHeroDragging = false;
let heroPrevX = 0;
let heroPrevY = 0;
const heroPointers = new Map();
let heroPinchStartDist = 0;
let heroPinchStartZoom = heroBaseDistance;

// Orchestrate camera and car movements across the 5 landing page sections
const mainTimeline = gsap.timeline({
    scrollTrigger: {
        trigger: ".content",
        start: "top top",
        end: "bottom bottom",
        scrub: 1.2
    }
});

mainTimeline
    // 1 -> 2: Transition to Aerodynamics (Side profile & front wing vents)
    .to(cameraCoords, {
        x: 3.5,
        y: 1.1,
        z: 2.8,
        lookX: 0,
        lookY: 0.35,
        lookZ: 0,
        carRotY: Math.PI * 0.4,
        ease: "power1.inOut"
    })
    // 2 -> 3: Transition to Performance (Front 3/4 stance)
    .to(cameraCoords, {
        x: -2.6,
        y: 0.95,
        z: 3.6,
        lookX: 0,
        lookY: 0.35,
        lookZ: 0.2,
        carRotY: Math.PI * 0.95,
        ease: "power1.inOut"
    })
    // 3 -> 4: Transition to Craftsmanship (Rear 3/4 view)
    .to(cameraCoords, {
        x: 3.4,
        y: 1.45,
        z: -4.0,
        lookX: 0,
        lookY: 0.3,
        lookZ: 0,
        carRotY: Math.PI * 1.5,
        ease: "power1.inOut"
    })
    // 4 -> 5: Transition to Specifications (Cinematic high-angle overview)
    .to(cameraCoords, {
        x: 0,
        y: 2.7,
        z: 4.2,
        lookX: 0,
        lookY: 0.3,
        lookZ: 0,
        carRotY: Math.PI * 2.0,
        ease: "power1.inOut"
    });

// ==========================================
// 6. SNAPPY SCROLL-TRIGGERED ENTRANCE ANIMATIONS FOR CARDS
// ==========================================

// --- Section 1: Grand Hero Home Page ---
let heroEntrancePlayed = false;

function showHeroContent(animate = true) {
    const heroSection = document.querySelector('.section-home') || document.querySelector('.section-overview');
    if (!heroSection) return;
    const heroElements = heroSection.querySelectorAll('.hero-header-block .british-badge, .hero-header-block h1, .hero-header-block .hero-desc, .hero-header-block .hero-cta, .hero-bottom-block .hero-specs-bar, .hero-bottom-block .scroll-indicator');

    if (animate) {
        gsap.to(heroElements, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.08,
            ease: "power2.out",
            overwrite: "auto"
        });
    } else {
        gsap.set(heroElements, { opacity: 1, y: 0, overwrite: "auto" });
    }
}

function hideHeroContent() {
    const heroSection = document.querySelector('.section-home') || document.querySelector('.section-overview');
    if (!heroSection) return;
    const heroElements = heroSection.querySelectorAll('.hero-header-block .british-badge, .hero-header-block h1, .hero-header-block .hero-desc, .hero-header-block .hero-cta, .hero-bottom-block .hero-specs-bar, .hero-bottom-block .scroll-indicator');

    gsap.to(heroElements, {
        opacity: 0,
        y: 30,
        duration: 0.45,
        ease: "power2.in",
        overwrite: "auto"
    });
}

function playHeroEntrance() {
    if (heroEntrancePlayed) return;
    heroEntrancePlayed = true;

    const heroSection = document.querySelector('.section-home') || document.querySelector('.section-overview');
    if (!heroSection) return;

    const heroElements = heroSection.querySelectorAll('.hero-header-block .british-badge, .hero-header-block h1, .hero-header-block .hero-desc, .hero-header-block .hero-cta, .hero-bottom-block .hero-specs-bar, .hero-bottom-block .scroll-indicator');

    // Automatic grand entrance for title, description, buttons and specs
    gsap.fromTo(heroElements,
        { opacity: 0, y: 35 },
        { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, ease: "power3.out", delay: 0.1 }
    );

    // Dynamic number counters
    const specCounters = [
        { el: heroSection.querySelectorAll('.hero-spec-val')[0], target: 715, suffix: ' BHP', decimals: 0 },
        { el: heroSection.querySelectorAll('.hero-spec-val')[1], target: 900, suffix: ' Nm', decimals: 0 },
        { el: heroSection.querySelectorAll('.hero-spec-val')[2], target: 3.4, suffix: ' sec', decimals: 1 },
        { el: heroSection.querySelectorAll('.hero-spec-val')[3], target: 211, suffix: ' MPH', decimals: 0 }
    ];

    specCounters.forEach(item => {
        if (!item.el) return;
        const countObj = { val: 0 };
        gsap.to(countObj, {
            val: item.target,
            duration: 2.2,
            delay: 0.35,
            ease: "power2.out",
            onUpdate: () => {
                item.el.textContent = (item.decimals ? countObj.val.toFixed(item.decimals) : Math.round(countObj.val)) + item.suffix;
            }
        });
    });

    // Bidirectional scroll trigger: hides smoothly on scroll down, restores automatically on scroll back up to Home!
    ScrollTrigger.create({
        trigger: heroSection,
        start: "top 20%",
        end: "bottom 35%",
        onEnter: () => showHeroContent(true),
        onEnterBack: () => showHeroContent(true),
        onLeave: () => hideHeroContent()
    });
}

// Fallback: trigger automatic entrance if not already triggered within 1.2s
setTimeout(playHeroEntrance, 1200);

// --- Section 2: Aerodynamics Cards Entrance ---
const aeroSection = document.querySelector('.section-aerodynamics');
if (aeroSection) {
    const aeroCards = aeroSection.querySelectorAll('.feature-card');
    const aeroHeader = aeroSection.querySelectorAll('.british-badge, h2, .section-desc');

    gsap.fromTo(aeroHeader,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
                trigger: aeroSection,
                start: "top 75%",
                toggleActions: "play reverse play reverse"
            }
        }
    );

    const aeroGrid = aeroSection.querySelector('.cards-grid-3');
    const aeroTl = gsap.timeline({
        scrollTrigger: {
            trigger: aeroGrid || aeroSection,
            start: "top 78%",
            toggleActions: "play reverse play reverse"
        }
    });

    aeroTl
        .fromTo(aeroCards[0],
            { opacity: 0, x: -100, y: 50, scale: 0.9, rotateY: 15 },
            { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0, duration: 0.85, ease: "power3.out" }
        )
        .fromTo(aeroCards[1],
            { opacity: 0, y: 90, scale: 0.88 },
            { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: "power3.out" },
            "-=0.6"
        )
        .fromTo(aeroCards[2],
            { opacity: 0, x: 100, y: 50, scale: 0.9, rotateY: -15 },
            { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0, duration: 0.85, ease: "power3.out" },
            "-=0.6"
        );

    gsap.to(aeroSection.querySelector('.section-inner'), {
        opacity: 0,
        y: -50,
        ease: "none",
        scrollTrigger: {
            trigger: aeroSection,
            start: "bottom 40%",
            end: "bottom top",
            scrub: 0.8
        }
    });
}

// --- Section 3: Performance Matrix Entrance ---
const perfSection = document.querySelector('.section-performance');
if (perfSection) {
    const perfBoxes = perfSection.querySelectorAll('.spec-box');
    const perfHeader = perfSection.querySelectorAll('.british-badge, h2, .section-desc');

    gsap.fromTo(perfHeader,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
                trigger: perfSection,
                start: "top 75%",
                toggleActions: "play reverse play reverse"
            }
        }
    );

    const perfMatrix = perfSection.querySelector('.specs-matrix');
    gsap.fromTo(perfBoxes,
        { opacity: 0, y: 70, scale: 0.88, rotateX: 15 },
        {
            opacity: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            duration: 0.75,
            stagger: 0.08,
            ease: "back.out(1.2)",
            scrollTrigger: {
                trigger: perfMatrix || perfSection,
                start: "top 78%",
                toggleActions: "play reverse play reverse"
            }
        }
    );

    gsap.to(perfSection.querySelector('.section-inner'), {
        opacity: 0,
        y: -50,
        ease: "none",
        scrollTrigger: {
            trigger: perfSection,
            start: "bottom 40%",
            end: "bottom top",
            scrub: 0.8
        }
    });
}

// --- Section 4: Craftsmanship Showcase Entrance ---
const craftSection = document.querySelector('.section-craftsmanship');
if (craftSection) {
    const craftCards = craftSection.querySelectorAll('.craft-card');
    const craftHeader = craftSection.querySelectorAll('.british-badge, h2, .section-desc');
    const craftTags = craftSection.querySelectorAll('.pill-tag');

    gsap.fromTo(craftHeader,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
                trigger: craftSection,
                start: "top 75%",
                toggleActions: "play reverse play reverse"
            }
        }
    );

    const craftShowcase = craftSection.querySelector('.craft-showcase');
    const craftTl = gsap.timeline({
        scrollTrigger: {
            trigger: craftShowcase || craftSection,
            start: "top 78%",
            toggleActions: "play reverse play reverse"
        }
    });

    craftTl
        .fromTo(craftCards[0],
            { opacity: 0, x: -140, scale: 0.9 },
            { opacity: 1, x: 0, scale: 1, duration: 0.9, ease: "power3.out" }
        )
        .fromTo(craftCards[1],
            { opacity: 0, x: 140, scale: 0.9 },
            { opacity: 1, x: 0, scale: 1, duration: 0.9, ease: "power3.out" },
            "-=0.7"
        )
        .fromTo(craftTags,
            { opacity: 0, scale: 0.5, y: 15 },
            { opacity: 1, scale: 1, y: 0, stagger: 0.04, duration: 0.5, ease: "back.out(1.5)" },
            "-=0.3"
        );

    gsap.to(craftSection.querySelector('.section-inner'), {
        opacity: 0,
        y: -50,
        ease: "none",
        scrollTrigger: {
            trigger: craftSection,
            start: "bottom 40%",
            end: "bottom top",
            scrub: 0.8
        }
    });
}

// --- Section 5: Specifications Table & Commission Entrance ---
const specsSection = document.querySelector('.section-specifications');
if (specsSection) {
    const specsHeader = specsSection.querySelectorAll('.british-badge, h2, .section-desc');
    const specsTableRows = specsSection.querySelectorAll('.specs-table tr');
    const specsTablePanel = specsSection.querySelector('.specs-table-panel');
    const commissionCard = specsSection.querySelector('.commission-card');

    gsap.fromTo(specsHeader,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
                trigger: specsSection,
                start: "top 75%",
                toggleActions: "play reverse play reverse"
            }
        }
    );

    const specsTl = gsap.timeline({
        scrollTrigger: {
            trigger: specsTablePanel || specsSection,
            start: "top 78%",
            toggleActions: "play reverse play reverse"
        }
    });

    specsTl
        .fromTo(specsTablePanel,
            { opacity: 0, y: 70, scale: 0.94 },
            { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" }
        )
        .fromTo(specsTableRows,
            { opacity: 0, x: -35 },
            { opacity: 1, x: 0, stagger: 0.04, duration: 0.5, ease: "power2.out" },
            "-=0.4"
        );

    gsap.fromTo(commissionCard,
        { opacity: 0, y: 70, scale: 0.9 },
        {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.85,
            ease: "back.out(1.2)",
            scrollTrigger: {
                trigger: commissionCard,
                start: "top 85%",
                toggleActions: "play reverse play reverse"
            }
        }
    );

    gsap.to(specsSection.querySelector('.section-inner'), {
        opacity: 0,
        y: -40,
        ease: "none",
        scrollTrigger: {
            trigger: specsSection,
            start: "bottom 35%",
            end: "bottom top",
            scrub: 0.8
        }
    });
}

// ==========================================
// 7. SCROLLSPY & TOP HEADER BEHAVIOUR
// ==========================================
const header = document.getElementById('top-header');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');

// Mobile Navigation Elements
const btnMobileToggle = document.getElementById('btn-mobile-toggle');
const mobileNavOverlay = document.getElementById('mobile-nav');
const btnMobileClose = document.getElementById('btn-mobile-close');
const mobileNavBackdrop = document.getElementById('mobile-nav-backdrop');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

function openMobileNav() {
    if (!mobileNavOverlay) return;
    mobileNavOverlay.classList.add('active');
    mobileNavOverlay.setAttribute('aria-hidden', 'false');
    if (btnMobileToggle) {
        btnMobileToggle.classList.add('active');
        btnMobileToggle.setAttribute('aria-expanded', 'true');
    }
    lenis.stop();
}

function closeMobileNav() {
    if (!mobileNavOverlay) return;
    mobileNavOverlay.classList.remove('active');
    mobileNavOverlay.setAttribute('aria-hidden', 'true');
    if (btnMobileToggle) {
        btnMobileToggle.classList.remove('active');
        btnMobileToggle.setAttribute('aria-expanded', 'false');
    }
    lenis.start();
}

if (btnMobileToggle) {
    btnMobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mobileNavOverlay && mobileNavOverlay.classList.contains('active')) {
            closeMobileNav();
        } else {
            openMobileNav();
        }
    });
}

if (btnMobileClose) {
    btnMobileClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMobileNav();
    });
}

if (mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener('click', closeMobileNav);
}

mobileNavLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileNav();
        const targetId = link.getAttribute('href');
        if (targetId === '#home' || targetId === '#overview') {
            lenis.scrollTo(0, {
                duration: 1.3,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
            });
            setActiveNav('home');
            showHeroContent(true);
            return;
        }
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            lenis.scrollTo(targetElement, {
                offset: -40,
                duration: 1.3,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
            });
        }
    });
});

window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
        showHeroContent(false);
    }
});

// Update active navigation link on scroll
sections.forEach((section) => {
    ScrollTrigger.create({
        trigger: section,
        start: "top 45%",
        end: "bottom 45%",
        onEnter: () => setActiveNav(section.id),
        onEnterBack: () => setActiveNav(section.id)
    });
});

function setActiveNav(id) {
    navLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href === `#${id}` || ((id === 'home' || id === 'overview') && (href === '#home' || href === '#overview'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    mobileNavLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href === `#${id}` || ((id === 'home' || id === 'overview') && (href === '#home' || href === '#overview'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Smooth scroll on clicking top menu links
navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        if (targetId === '#home' || targetId === '#overview') {
            lenis.scrollTo(0, {
                duration: 1.4,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
            });
            setActiveNav('home');
            showHeroContent(true);
            return;
        }
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            lenis.scrollTo(targetElement, {
                offset: -40,
                duration: 1.4,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
            });
        }
    });
});

// Click logo to go home (scroll smoothly to absolute top)
document.querySelectorAll('.nav-brand-group').forEach((brandLogo) => {
    brandLogo.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileNav();
        lenis.scrollTo(0, {
            duration: 1.4,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        });
        setActiveNav('home');
        showHeroContent(true);
    });
});

// All other anchor links with smooth scroll
document.querySelectorAll('a[href^="#"]:not(.nav-brand-group):not(.nav-link)').forEach((anchor) => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                lenis.scrollTo(target, { offset: -40, duration: 1.4 });
            }
        }
    });
});

// ==========================================
// 7. ENQUIRY MODAL LOGIC
// ==========================================
const enquiryModal = document.getElementById('enquiry-modal');
const modalClose = document.getElementById('modal-close');
const openModalButtons = document.querySelectorAll('.btn-open-modal');

openModalButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileNav();
        if (enquiryModal) {
            enquiryModal.classList.add('active');
            enquiryModal.setAttribute('aria-hidden', 'false');
        }
    });
});

if (modalClose) {
    modalClose.addEventListener('click', () => {
        if (enquiryModal) {
            enquiryModal.classList.remove('active');
            enquiryModal.setAttribute('aria-hidden', 'true');
        }
    });
}

// Close modal when clicking on overlay background
if (enquiryModal) {
    enquiryModal.addEventListener('click', (e) => {
        if (e.target === enquiryModal) {
            enquiryModal.classList.remove('active');
            enquiryModal.setAttribute('aria-hidden', 'true');
        }
    });
}

// ==========================================
// 8. INTERACTIVE MOUSE PARALLAX
// ==========================================
let targetMouseX = 0;
let targetMouseY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

window.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 0.15;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 0.08;
});

// ==========================================
// 8B. PROCEDURAL V12 AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================
class V12SoundSystem {
    constructor() {
        this.ctx = null;
        this.isRunning = false;
        this.isMuted = false;
        this.currentRpm = 850;
        this.targetRpm = 850;
        this.idleRpm = 850;
        this.maxRpm = 7200;
        this.masterGain = null;
        this.v12Oscs = [];
        this.filter = null;
        this.turboOsc = null;
        this.turboGain = null;
        this.isRevving = false;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Warm exhaust lowpass filter
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(260, this.ctx.currentTime);
        this.filter.Q.setValueAtTime(4.0, this.ctx.currentTime);
        this.filter.connect(this.masterGain);

        // V12 firing order harmonic oscillators
        const harmonicMultipliers = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0];
        harmonicMultipliers.forEach((mult, idx) => {
            const osc = this.ctx.createOscillator();
            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime((this.idleRpm / 60) * mult * 6, this.ctx.currentTime);
            
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.18 / (idx + 1), this.ctx.currentTime);
            osc.connect(g);
            g.connect(this.filter);
            osc.start();
            this.v12Oscs.push({ osc, gain: g, mult });
        });

        // Twin turbocharger spooling whistle
        this.turboOsc = this.ctx.createOscillator();
        this.turboOsc.type = 'sine';
        this.turboOsc.frequency.setValueAtTime(1400, this.ctx.currentTime);
        this.turboGain = this.ctx.createGain();
        this.turboGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.turboOsc.connect(this.turboGain);
        this.turboGain.connect(this.masterGain);
        this.turboOsc.start();
    }

    start() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.isRunning = true;
        
        // Ignition crank-up sequence
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        const targetVol = this.isMuted ? 0.0001 : 0.38;
        this.masterGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 0.2);

        this.currentRpm = 2100; // Starter flare
        gsap.to(this, {
            currentRpm: 850,
            duration: 1.0,
            ease: "power2.out"
        });

        updateEngineUI(true);
    }

    toggleMute() {
        this.setMute(!this.isMuted);
    }

    setMute(mute) {
        this.isMuted = !!mute;
        if (this.ctx && this.masterGain && this.isRunning) {
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            const targetVol = this.isMuted ? 0.0001 : 0.38;
            this.masterGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 0.15);
        }
        if (typeof updateSoundMuteUI === 'function') {
            updateSoundMuteUI(this.isMuted);
        }
    }

    stop() {
        if (!this.ctx || !this.isRunning) return;
        this.isRunning = false;
        this.isRevving = false;
        this.masterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
        updateEngineUI(false);
    }

    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
    }

    setThrottle(active) {
        if (!this.isRunning && active) {
            this.start();
        }
        this.isRevving = active;
        this.targetRpm = active ? 6900 : this.idleRpm;
    }

    update() {
        if (!this.isRunning || !this.ctx) return 850;

        const lerpFactor = this.isRevving ? 0.08 : 0.035;
        this.currentRpm += (this.targetRpm - this.currentRpm) * lerpFactor;
        
        // Subtle RPM idle flutter
        const jitter = Math.sin(Date.now() * 0.02) * (this.isRevving ? 35 : 12);
        const effectiveRpm = Math.max(800, this.currentRpm + jitter);

        // Update audio frequencies
        const baseFreq = (effectiveRpm / 60) * 3;
        this.v12Oscs.forEach(({ osc, mult }) => {
            osc.frequency.setValueAtTime(baseFreq * mult, this.ctx.currentTime);
        });

        // Filter sweeps up with RPM
        const filterFreq = 200 + (effectiveRpm / this.maxRpm) * 2800;
        this.filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);

        // Turbo whistle spools up
        const turboFreq = 1200 + (effectiveRpm / this.maxRpm) * 4200;
        this.turboOsc.frequency.setValueAtTime(turboFreq, this.ctx.currentTime);
        const turboVol = (effectiveRpm / this.maxRpm) * 0.09;
        this.turboGain.gain.setValueAtTime(turboVol, this.ctx.currentTime);

        return effectiveRpm;
    }

    playGearshiftPop() {
        if (!this.ctx || !this.isRunning || this.isMuted) return;
        this.masterGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0.38, this.ctx.currentTime + 0.1);
        
        try {
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.07);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
            noiseFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noise.start();
        } catch (err) {}
    }
}

const engineSystem = new V12SoundSystem();

// Engine UI synchronization
const btnHeroEngine = document.getElementById('btn-hero-engine');
const btnToggleEngine = document.getElementById('btn-toggle-engine');
const btnStopEngine = document.getElementById('btn-engine-cut');
const btnRevThrottle = document.getElementById('btn-rev-throttle');
const tachoHud = document.getElementById('tachometer-hud');
const tachoFill = document.getElementById('tacho-fill');
const tachoRpmVal = document.getElementById('tacho-rpm-val');
const tachoStatus = document.getElementById('tacho-status');

function updateEngineUI(running) {
    if (btnHeroEngine) {
        if (running) {
            btnHeroEngine.classList.add('engine-on');
            btnHeroEngine.querySelector('.engine-btn-label').textContent = 'V12 Running • Stop';
        } else {
            btnHeroEngine.classList.remove('engine-on');
            btnHeroEngine.querySelector('.engine-btn-label').textContent = 'Start V12 Engine';
        }
    }
    if (btnToggleEngine) {
        if (running) {
            btnToggleEngine.classList.add('active');
            btnToggleEngine.querySelector('.system-text').innerHTML = 'V12 Sound: <strong>ON</strong>';
        } else {
            btnToggleEngine.classList.remove('active');
            btnToggleEngine.querySelector('.system-text').innerHTML = 'V12 Sound: <strong>OFF</strong>';
        }
    }
    if (tachoHud) {
        if (running || isHighwayMode) {
            tachoHud.classList.add('active');
            tachoHud.setAttribute('aria-hidden', 'false');
        } else {
            tachoHud.classList.remove('active');
            tachoHud.setAttribute('aria-hidden', 'true');
        }
    }
}

if (btnHeroEngine) {
    btnHeroEngine.addEventListener('click', (e) => {
        e.preventDefault();
        engineSystem.toggle();
    });
}

if (btnToggleEngine) {
    btnToggleEngine.addEventListener('click', (e) => {
        e.preventDefault();
        engineSystem.toggle();
    });
}

if (btnStopEngine) {
    btnStopEngine.addEventListener('click', (e) => {
        e.preventDefault();
        if (isHighwayMode) {
            if (targetHighwaySpeed > 0 || currentHighwaySpeed > 5) {
                // Decelerate smoothly down to 0 KM/H
                targetHighwaySpeed = 0;
                if (isHighwayBoost) disengageHighwayBoost();
                btnStopEngine.textContent = 'START';
                btnStopEngine.classList.add('engine-stopped');
            } else {
                // Accelerate back up to 300 KM/H
                targetHighwaySpeed = 300;
                if (!engineSystem.isRunning) {
                    engineSystem.start();
                }
                btnStopEngine.textContent = 'STOP';
                btnStopEngine.classList.remove('engine-stopped');
            }
            if (tachoHud) {
                tachoHud.classList.add('active');
                tachoHud.setAttribute('aria-hidden', 'false');
            }
            return;
        }
        engineSystem.stop();
    });
}

// Throttle events for "HOLD TO REV V12"
if (btnRevThrottle) {
    const startThrottle = (e) => {
        e.preventDefault();
        btnRevThrottle.classList.add('throttling');
        engineSystem.setThrottle(true);
    };
    const stopThrottle = (e) => {
        e.preventDefault();
        btnRevThrottle.classList.remove('throttling');
        engineSystem.setThrottle(false);
    };

    btnRevThrottle.addEventListener('pointerdown', startThrottle);
    window.addEventListener('pointerup', stopThrottle);
    btnRevThrottle.addEventListener('pointercancel', stopThrottle);
    btnRevThrottle.addEventListener('mouseleave', stopThrottle);
}

// Sound Mute Synchronization
const btnTachoMute = document.getElementById('btn-tacho-mute');
const hwToggleSound = document.getElementById('hw-toggle-sound');

function updateSoundMuteUI(isMuted) {
    const hwSoundIcon = document.getElementById('hw-sound-icon');
    const hwSoundText = document.getElementById('hw-sound-text');
    const tachoMuteIcon = document.getElementById('tacho-mute-icon');
    const tachoMuteLbl = document.querySelector('.tacho-mute-lbl');

    if (hwToggleSound) {
        hwToggleSound.classList.toggle('sound-muted', isMuted);
    }
    if (hwSoundIcon) {
        hwSoundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
    if (hwSoundText) {
        hwSoundText.textContent = isMuted ? 'Sound: OFF' : 'Sound: ON';
    }

    if (btnTachoMute) {
        btnTachoMute.classList.toggle('muted', isMuted);
        btnTachoMute.setAttribute('title', isMuted ? 'Unmute V12 Sound (Press M)' : 'Mute V12 Sound (Press M)');
    }
    if (tachoMuteIcon) {
        tachoMuteIcon.textContent = isMuted ? '🔇' : '🔊';
    }
    if (tachoMuteLbl) {
        tachoMuteLbl.textContent = isMuted ? 'UNMUTE' : 'MUTE';
    }
}

if (btnTachoMute) {
    btnTachoMute.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        engineSystem.toggleMute();
    });
}

if (hwToggleSound) {
    hwToggleSound.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        engineSystem.toggleMute();
    });
}


// ==========================================
// 8C. INTERACTIVE 3D HOTSPOTS ENGINE
// ==========================================
const HOTSPOTS_DATA = {
    v12: {
        pos: new THREE.Vector3(0, 0.45, 1.25),
        cam: { x: 0, y: 1.35, z: 2.3, lookX: 0, lookY: 0.55, lookZ: 1.1 },
        tag: 'POWERTRAIN ARCHITECTURE',
        title: '5.2L Bi-Turbo V12 Engine',
        desc: 'Hand-assembled in Gaydon, this front-mid-mounted 5.2-litre quad-cam twin-turbo monster delivers 715 BHP and 900 Nm across an astonishingly wide rev band.',
        specs: [
            { val: '715 BHP', lbl: 'Peak Output' },
            { val: '900 Nm', lbl: 'Torque @1800' },
            { val: '3.4s', lbl: '0–62 MPH' }
        ]
    },
    brakes: {
        pos: new THREE.Vector3(0.96, 0.36, 1.2),
        cam: { x: 1.85, y: 0.65, z: 1.6, lookX: 0.9, lookY: 0.35, lookZ: 1.2 },
        tag: 'CHASSIS DYNAMICS',
        title: 'Carbon Ceramic Brakes',
        desc: 'Massive 410mm ventilated front carbon-ceramic discs with 6-piston alloy monobloc callipers, shedding 27 kg of unsprung mass for uncompromising stopping power.',
        specs: [
            { val: '410 mm', lbl: 'Front Rotors' },
            { val: '6-Piston', lbl: 'Monobloc Callipers' },
            { val: '-27 kg', lbl: 'Unsprung Mass' }
        ]
    },
    aero: {
        pos: new THREE.Vector3(0, 0.76, -1.65),
        cam: { x: 1.4, y: 1.25, z: -2.5, lookX: 0, lookY: 0.7, lookZ: -1.6 },
        tag: 'AERODYNAMIC INNOVATION',
        title: 'Aeroblade II™ Ducting',
        desc: 'Patented Aston Martin aerodynamic system ducting high-velocity airflow through discreet C-pillar intakes directly across the rear deck lid for 180 kg true downforce.',
        specs: [
            { val: '180 kg', lbl: 'True Downforce' },
            { val: '211 MPH', lbl: 'V-Max Composure' },
            { val: 'Active', lbl: 'Decklid Flow' }
        ]
    },
    exhaust: {
        pos: new THREE.Vector3(0.42, 0.3, -2.15),
        cam: { x: 0.9, y: 0.55, z: -2.95, lookX: 0.35, lookY: 0.32, lookZ: -2.0 },
        tag: 'ACOUSTIC ENGINEERING',
        title: 'Active Quad Exhaust System',
        desc: 'Four bespoke matte-black exhaust pipes paired with electronic bypass valves and a formula-grade double diffuser, unleashing an orchestral British V12 roar.',
        specs: [
            { val: 'Quad', lbl: 'Tailpipes' },
            { val: 'Active', lbl: 'Bypass Valves' },
            { val: 'Titanium', lbl: 'Construction' }
        ]
    }
};

let isHotspotsVisible = true;
let activeHotspotKey = null;
let prevHotspotCamera = null;
let isHotspotTransitioning = false;

const hotspotsLayer = document.getElementById('hotspots-layer');
const hotspotCard = document.getElementById('hotspot-detail-card');
const btnHotspotClose = document.getElementById('btn-hotspot-close');
const btnToggleHotspots = document.getElementById('btn-toggle-hotspots');

function focusHotspot(key) {
    const data = HOTSPOTS_DATA[key];
    if (!data) return;

    // Save initial camera state before any hotspot transition
    if (!activeHotspotKey && !prevHotspotCamera) {
        prevHotspotCamera = {
            x: cameraCoords.x,
            y: cameraCoords.y,
            z: cameraCoords.z,
            lookX: cameraCoords.lookX,
            lookY: cameraCoords.lookY,
            lookZ: cameraCoords.lookZ,
            carRotY: (carModel ? carModel.rotation.y : cameraCoords.carRotY),
            studioDistance: studioDistance
        };
    }

    activeHotspotKey = key;
    isHotspotTransitioning = true;

    gsap.killTweensOf(cameraCoords);
    gsap.to(cameraCoords, {
        x: data.cam.x,
        y: data.cam.y,
        z: data.cam.z,
        lookX: data.cam.lookX,
        lookY: data.cam.lookY,
        lookZ: data.cam.lookZ,
        duration: 1.2,
        ease: "power2.inOut",
        onComplete: () => {
            isHotspotTransitioning = false;
        }
    });

    document.getElementById('hotspot-tag').textContent = data.tag;
    document.getElementById('hotspot-title').textContent = data.title;
    document.getElementById('hotspot-desc').textContent = data.desc;
    document.getElementById('spec-val-1').textContent = data.specs[0].val;
    document.getElementById('spec-lbl-1').textContent = data.specs[0].lbl;
    document.getElementById('spec-val-2').textContent = data.specs[1].val;
    document.getElementById('spec-lbl-2').textContent = data.specs[1].lbl;
    document.getElementById('spec-val-3').textContent = data.specs[2].val;
    document.getElementById('spec-lbl-3').textContent = data.specs[2].lbl;

    if (hotspotCard) {
        hotspotCard.classList.add('active');
        hotspotCard.setAttribute('aria-hidden', 'false');
    }
}

function closeHotspotDetail() {
    if (!activeHotspotKey && !prevHotspotCamera) return;
    activeHotspotKey = null;

    if (hotspotCard) {
        hotspotCard.classList.remove('active');
        hotspotCard.setAttribute('aria-hidden', 'true');
    }

    document.querySelectorAll('.hotspot-pin').forEach(pin => {
        pin.classList.remove('is-active', 'is-dimmed');
    });

    if (prevHotspotCamera) {
        const target = { ...prevHotspotCamera };
        prevHotspotCamera = null;
        isHotspotTransitioning = true;

        gsap.killTweensOf(cameraCoords);
        gsap.to(cameraCoords, {
            x: target.x,
            y: target.y,
            z: target.z,
            lookX: target.lookX,
            lookY: target.lookY,
            lookZ: target.lookZ,
            duration: 1.2,
            ease: "power2.inOut",
            onComplete: () => {
                isHotspotTransitioning = false;
                if (isStudioOpen) {
                    setStudioDistance(target.studioDistance, false);
                } else if (mainTimeline && mainTimeline.scrollTrigger) {
                    ScrollTrigger.update();
                }
            }
        });

        if (isStudioOpen && carModel && target.carRotY !== undefined) {
            gsap.to(carModel.rotation, {
                y: target.carRotY,
                duration: 1.2,
                ease: "power2.inOut"
            });
        }
    } else if (isStudioOpen) {
        gsap.to(cameraCoords, {
            x: 0,
            y: 0.95,
            z: studioDistance,
            lookX: 0,
            lookY: 0.35,
            lookZ: 0,
            duration: 1.1,
            ease: "power2.inOut"
        });
    }
}

if (btnHotspotClose) {
    btnHotspotClose.addEventListener('click', closeHotspotDetail);
}

document.querySelectorAll('.hotspot-pin').forEach(pin => {
    pin.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = pin.getAttribute('data-hotspot');
        focusHotspot(key);
    });
});

if (btnToggleHotspots) {
    btnToggleHotspots.addEventListener('click', (e) => {
        e.preventDefault();
        isHotspotsVisible = !isHotspotsVisible;
        if (isHotspotsVisible) {
            btnToggleHotspots.classList.add('active');
            btnToggleHotspots.querySelector('.system-text').innerHTML = 'Hotspots: <strong>ON</strong>';
            if (hotspotsLayer) hotspotsLayer.classList.remove('hidden');
        } else {
            btnToggleHotspots.classList.remove('active');
            btnToggleHotspots.querySelector('.system-text').innerHTML = 'Hotspots: <strong>OFF</strong>';
            if (hotspotsLayer) hotspotsLayer.classList.add('hidden');
            closeHotspotDetail();
        }
    });
}

// 3D coordinates projector
const hotspotWorldPos = new THREE.Vector3();
const camDir = new THREE.Vector3();

function updateHotspotsProjection() {
    if (!isHotspotsVisible || !carModel || !hotspotsLayer) return;

    camera.getWorldDirection(camDir);

    for (const [key, data] of Object.entries(HOTSPOTS_DATA)) {
        const pin = document.getElementById(`pin-${key}`);
        if (!pin) continue;

        hotspotWorldPos.copy(data.pos).applyMatrix4(carModel.matrixWorld);
        
        // Calculate visibility: behind camera test
        const toPin = hotspotWorldPos.clone().sub(camera.position);
        const isFacing = toPin.dot(camDir) > 0;

        if (!isFacing) {
            pin.style.opacity = '0';
            pin.style.pointerEvents = 'none';
            continue;
        }

        hotspotWorldPos.project(camera);
        const screenX = (hotspotWorldPos.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-(hotspotWorldPos.y * 0.5) + 0.5) * window.innerHeight;

        pin.style.left = `${screenX}px`;
        pin.style.top = `${screenY}px`;

        if (activeHotspotKey) {
            if (key === activeHotspotKey) {
                pin.classList.add('is-active');
                pin.classList.remove('is-dimmed');
            } else {
                pin.classList.remove('is-active');
                pin.classList.add('is-dimmed');
            }
        } else {
            pin.classList.remove('is-active', 'is-dimmed');
        }

        pin.style.opacity = '1';
        pin.style.pointerEvents = 'auto';
    }
}

// ==========================================
// 8D. CINEMATIC DRONE SHOWCASE & 4K SNAPSHOT EXPORT
// ==========================================
let isShowcaseTour = false;
let droneAngle = 0;
const btnShowcaseTour = document.getElementById('btn-showcase-tour');
const btnStudioSnapshot = document.getElementById('btn-studio-snapshot');

function toggleShowcaseTour() {
    isShowcaseTour = !isShowcaseTour;
    if (btnShowcaseTour) {
        if (isShowcaseTour) {
            btnShowcaseTour.classList.add('active');
            isAutoRotate = false; // Tour controls camera directly
            closeHotspotDetail();
        } else {
            btnShowcaseTour.classList.remove('active');
            isAutoRotate = true;
        }
    }
}

if (btnShowcaseTour) {
    btnShowcaseTour.addEventListener('click', (e) => {
        e.preventDefault();
        toggleShowcaseTour();
    });
}

function export4KSnapshot() {
    if (!carModel || !renderer) return;

    // Save previous states
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    const origAspect = camera.aspect;

    // Render offscreen at Full HD / 4K composite canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1920;
    exportCanvas.height = 1080;
    const ctx = exportCanvas.getContext('2d');

    camera.aspect = 1920 / 1080;
    camera.updateProjectionMatrix();
    renderer.setSize(1920, 1080, false);
    renderer.render(scene, camera);

    // Draw WebGL scene
    ctx.drawImage(renderer.domElement, 0, 0, 1920, 1080);

    // Restore screen render size
    camera.aspect = origAspect;
    camera.updateProjectionMatrix();
    renderer.setSize(origW, origH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Bottom gradient overlay
    const grad = ctx.createLinearGradient(0, 720, 0, 1080);
    grad.addColorStop(0, 'rgba(8, 8, 10, 0)');
    grad.addColorStop(0.4, 'rgba(8, 8, 10, 0.85)');
    grad.addColorStop(1, 'rgba(8, 8, 10, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 700, 1920, 380);

    // Top watermark
    ctx.font = '700 24px Outfit, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.fillText('ASTON MARTIN', 64, 72);

    ctx.font = '500 13px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('Q BY ASTON MARTIN • BESPOKE COMMISSION SPECIFICATION', 64, 96);

    // Bottom specs
    ctx.font = '800 38px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('DBS SUPERLEGGERA', 64, 950);

    const paintName = document.getElementById('active-colour-name')?.textContent || 'Obsidian Black';
    const wheelName = document.getElementById('active-wheel-name')?.textContent || 'Gloss Black';
    const caliperName = document.getElementById('active-caliper-name')?.textContent || 'Aston Lime';
    const interiorName = document.getElementById('active-interior-name')?.textContent || 'Oxford Tan';

    ctx.font = '500 16px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(`Exterior: ${paintName}  •  Wheels: ${wheelName}  •  Calipers: ${caliperName}  •  Interior: ${interiorName}`, 64, 988);

    // Right performance stats
    ctx.textAlign = 'right';
    ctx.font = '800 34px Outfit, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.fillText('715 BHP  •  900 Nm  •  211 MPH', 1856, 950);

    ctx.font = '500 15px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('5.2L TWIN-TURBO V12  •  GAYDON, ENGLAND', 1856, 988);

    // Trigger instant download
    const link = document.createElement('a');
    link.download = `Aston-Martin-DBS-${paintName.replace(/\s+/g, '-')}-Custom-Spec.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

if (btnStudioSnapshot) {
    btnStudioSnapshot.addEventListener('click', (e) => {
        e.preventDefault();
        export4KSnapshot();
    });
}

// ==========================================
// 8E. WIND TUNNEL AERO STREAMLINES & PARTICLES
// ==========================================
const AERO_COUNT = 900;
const aeroGeo = new THREE.BufferGeometry();
const aeroPos = new Float32Array(AERO_COUNT * 3);
const aeroVels = new Float32Array(AERO_COUNT);

for (let i = 0; i < AERO_COUNT; i++) {
    const i3 = i * 3;
    aeroPos[i3] = (Math.random() - 0.5) * 2.4;
    aeroPos[i3 + 1] = 0.12 + Math.random() * 1.35;
    aeroPos[i3 + 2] = -3.2 + Math.random() * 7.5;
    aeroVels[i] = 0.08 + Math.random() * 0.08;
}

aeroGeo.setAttribute('position', new THREE.BufferAttribute(aeroPos, 3));
const aeroMat = new THREE.PointsMaterial({
    color: 0x00f0ff,
    size: 0.045,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const aeroParticles = new THREE.Points(aeroGeo, aeroMat);
scene.add(aeroParticles);

let isAeroFlowActive = false;

function toggleAeroFlow(active) {
    if (active === undefined) active = !isAeroFlowActive;
    isAeroFlowActive = active;

    gsap.to(aeroMat, {
        opacity: active ? 0.8 : 0,
        duration: 0.4
    });

    const secBtn = document.getElementById('btn-section-aeroflow');
    const studioBtn = document.getElementById('btn-toggle-aeroflow');

    if (secBtn) {
        if (active) secBtn.classList.add('active');
        else secBtn.classList.remove('active');
    }
    if (studioBtn) {
        if (active) {
            studioBtn.classList.add('active');
            studioBtn.querySelector('.system-text').innerHTML = 'Aero Flow: <strong>ON</strong>';
        } else {
            studioBtn.classList.remove('active');
            studioBtn.querySelector('.system-text').innerHTML = 'Aero Flow: <strong>OFF</strong>';
        }
    }
}

const btnSectionAero = document.getElementById('btn-section-aeroflow');
const btnToggleAero = document.getElementById('btn-toggle-aeroflow');

if (btnSectionAero) {
    btnSectionAero.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAeroFlow();
    });
}
if (btnToggleAero) {
    btnToggleAero.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAeroFlow();
    });
}

// ==========================================
// 8F. SILVERSTONE RAIN PARTICLE SYSTEM
// ==========================================
// Rain is built from real elongated billboard quads (not round point-sprites)
// so each drop reads as a proper streak with correct width:height aspect at
// any zoom/distance — a Points sprite would squash a tall texture into a
// square and just look like a dot.
const rainVertexShader = `
    attribute vec3 instancePosition;
    attribute vec2 instanceScale;
    attribute float instanceAlpha;
    varying vec2 vUv;
    varying float vAlpha;
    void main() {
        vUv = uv;
        vAlpha = instanceAlpha;
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 worldPos = instancePosition
            + camRight * position.x * instanceScale.x
            + vec3(0.0, 1.0, 0.0) * position.y * instanceScale.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
`;
const rainFragmentShader = `
    uniform sampler2D uMap;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    varying float vAlpha;
    void main() {
        vec4 tex = texture2D(uMap, vUv);
        gl_FragColor = vec4(uColor, tex.a * uOpacity * vAlpha);
    }
`;

// Procedural raindrop streak: bright, sharp leading edge (direction of fall)
// trailing into a soft motion-blurred tail — reads as a real falling drop
// instead of a flat round dot.
function createRainStreakTexture() {
    const w = 16, h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const cx = (w - 1) / 2;
    for (let y = 0; y < h; y++) {
        const t = y / (h - 1);
        // Head (bottom, t=1) is bright and sharp; tail (top, t=0) fades out
        let vAlpha = Math.pow(t, 1.5);
        if (t > 0.93) vAlpha *= 1 - (t - 0.93) / 0.07 * 0.25;
        for (let x = 0; x < w; x++) {
            const dx = (x - cx) / cx;
            const hAlpha = Math.exp(-dx * dx * 3.4);
            const a = Math.max(0, Math.min(1, vAlpha * hAlpha));
            const idx = (y * w + x) * 4;
            img.data[idx] = 255;
            img.data[idx + 1] = 255;
            img.data[idx + 2] = 255;
            img.data[idx + 3] = Math.round(a * 255);
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

const RAIN_COUNT = 2400;

// Shared quad: pivot (0,0) sits at the drop's head, extends upward to (0,1)
// where uv.y=0 samples the bright head and uv.y=1 samples the faint tail.
const rainQuadGeo = new THREE.InstancedBufferGeometry();
rainQuadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5, 0, 0,
     0.5, 0, 0,
     0.5, 1, 0,
    -0.5, 1, 0
]), 3));
rainQuadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
rainQuadGeo.setIndex([0, 1, 2, 0, 2, 3]);

const rainInstancePos = new Float32Array(RAIN_COUNT * 3);
const rainInstanceScale = new Float32Array(RAIN_COUNT * 2);
const rainInstanceAlpha = new Float32Array(RAIN_COUNT);
const rainSpeed = new Float32Array(RAIN_COUNT);
const rainDrift = new Float32Array(RAIN_COUNT);

for (let i = 0; i < RAIN_COUNT; i++) {
    const i3 = i * 3;
    rainInstancePos[i3] = (Math.random() - 0.5) * 22;
    rainInstancePos[i3 + 1] = Math.random() * 14;
    rainInstancePos[i3 + 2] = (Math.random() - 0.5) * 22;
    // Depth-linked size/speed: bigger drops fall faster, like real rain
    const depth = 0.5 + Math.random() * 1.1;
    rainInstanceScale[i * 2] = 0.017 * depth;
    rainInstanceScale[i * 2 + 1] = 0.62 * depth;
    rainInstanceAlpha[i] = 0.55 + Math.random() * 0.45;
    rainSpeed[i] = 0.26 * depth + Math.random() * 0.08;
    rainDrift[i] = (Math.random() - 0.5) * 0.02;
}

rainQuadGeo.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(rainInstancePos, 3));
rainQuadGeo.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(rainInstanceScale, 2));
rainQuadGeo.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(rainInstanceAlpha, 1));
rainQuadGeo.instanceCount = RAIN_COUNT;

const rainTex = createRainStreakTexture();
const rainMat = new THREE.ShaderMaterial({
    uniforms: {
        uMap: { value: rainTex },
        uColor: { value: new THREE.Color(0x9fc4ff) },
        uOpacity: { value: 0 }
    },
    vertexShader: rainVertexShader,
    fragmentShader: rainFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const rainParticles = new THREE.Mesh(rainQuadGeo, rainMat);
// Instances span a 22-unit box around the car; the base quad's own tiny
// bounds would otherwise get the whole field frustum-culled incorrectly.
rainParticles.frustumCulled = false;
scene.add(rainParticles);
let isRainActive = false;

// ==========================================
// 8F-2. ALPINE SNOW PARTICLE SYSTEM
// ==========================================
// Snow flakes are round, so a Points sprite (always a camera-facing square)
// works fine here — unlike rain, there's no aspect ratio to preserve.
// The "size" attribute still gives per-flake depth variation.
const snowVertexShader = `
    attribute float size;
    uniform float uScale;
    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (uScale / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;
const snowFragmentShader = `
    uniform sampler2D uMap;
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(uColor, tex.a * uOpacity);
    }
`;

const SNOW_COUNT = 2200;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(SNOW_COUNT * 3);
const snowVels = new Float32Array(SNOW_COUNT * 3);
const snowSize = new Float32Array(SNOW_COUNT);

for (let i = 0; i < SNOW_COUNT; i++) {
    const i3 = i * 3;
    snowPos[i3] = (Math.random() - 0.5) * 22;
    snowPos[i3 + 1] = Math.random() * 14;
    snowPos[i3 + 2] = (Math.random() - 0.5) * 22;
    snowVels[i3] = (Math.random() - 0.5) * 0.01;
    snowVels[i3 + 1] = 0.02 + Math.random() * 0.035;
    snowVels[i3 + 2] = (Math.random() - 0.5) * 0.01;
    // Real snow reads as a mix of small distant flakes and a few large near ones
    snowSize[i] = Math.random() < 0.15 ? 0.11 + Math.random() * 0.07 : 0.045 + Math.random() * 0.045;
}

snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
snowGeo.setAttribute('size', new THREE.BufferAttribute(snowSize, 1));

const snowCanvas = document.createElement('canvas');
snowCanvas.width = 64;
snowCanvas.height = 64;
const snowCtx = snowCanvas.getContext('2d');
const sGrad = snowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
sGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
sGrad.addColorStop(0.5, 'rgba(230, 245, 255, 0.6)');
sGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
snowCtx.fillStyle = sGrad;
snowCtx.fillRect(0, 0, 64, 64);
const snowTex = new THREE.CanvasTexture(snowCanvas);

const snowMat = new THREE.ShaderMaterial({
    uniforms: {
        uMap: { value: snowTex },
        uColor: { value: new THREE.Color(0xffffff) },
        uOpacity: { value: 0 },
        uScale: { value: 900.0 }
    },
    vertexShader: snowVertexShader,
    fragmentShader: snowFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const snowParticles = new THREE.Points(snowGeo, snowMat);
scene.add(snowParticles);
let isSnowActive = false;

// ==========================================
// 8G. X-RAY / HOLOGRAPHIC CHASSIS MODE
// ==========================================
let isXRayActive = false;

function toggleXRay(active) {
    if (active === undefined) active = !isXRayActive;
    isXRayActive = active;

    paintMeshes.forEach(mesh => {
        if (mesh.material) {
            if (active) {
                mesh.material.wireframe = true;
                mesh.material.transparent = true;
                mesh.material.opacity = 0.22;
            } else {
                mesh.material.wireframe = false;
                mesh.material.transparent = false;
                mesh.material.opacity = 1.0;
            }
            mesh.material.needsUpdate = true;
        }
    });

    const btn = document.getElementById('btn-toggle-xray');
    if (btn) {
        if (active) {
            btn.classList.add('active');
            btn.querySelector('.system-text').innerHTML = 'X-Ray: <strong>ON</strong>';
        } else {
            btn.classList.remove('active');
            btn.querySelector('.system-text').innerHTML = 'X-Ray: <strong>OFF</strong>';
        }
    }
}

const btnToggleXRay = document.getElementById('btn-toggle-xray');
if (btnToggleXRay) {
    btnToggleXRay.addEventListener('click', (e) => {
        e.preventDefault();
        toggleXRay();
    });
}

// ==========================================
// 9. ANIMATION & RENDER LOOP
// ==========================================
const lookTarget = new THREE.Vector3();
const animClock = new THREE.Clock();

let isStudioOpen = false;
let isAutoRotate = true;
let isStudioDragging = false;
let prevPointerX = 0;
let prevPointerY = 0;

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(animClock.getDelta(), 0.1);

    // Update V12 audio engine & cockpit tachometer
    const rpm = engineSystem.update();
    if ((engineSystem.isRunning || isHighwayMode) && tachoFill && tachoRpmVal) {
        tachoRpmVal.textContent = Math.round(rpm);
        const dashOffset = Math.max(0, 390 - (390 * (rpm - 800) / 6400));
        tachoFill.style.strokeDashoffset = dashOffset;
        if (tachoStatus) {
            if (engineSystem.isRevving) {
                tachoStatus.textContent = '715 BHP • BOOST';
            } else if (isHighwayMode && currentHighwaySpeed < 2) {
                tachoStatus.textContent = 'V12 • IDLE';
            } else if (isHighwayMode) {
                tachoStatus.textContent = isHighwayBoost ? 'V-MAX 340 KM/H' : 'CRUISE 300 KM/H';
            } else {
                tachoStatus.textContent = 'V12 • IDLE';
            }
        }
    }

    // Update Wind Tunnel Aero Particles
    if (isAeroFlowActive) {
        const pos = aeroGeo.attributes.position.array;
        for (let i = 0; i < AERO_COUNT; i++) {
            const i3 = i * 3;
            pos[i3 + 2] -= aeroVels[i];
            const z = pos[i3 + 2];
            if (z < 1.6 && z > -1.8) {
                const hoodHeight = 0.35 + (1.6 - z) * 0.18;
                if (pos[i3 + 1] < hoodHeight) {
                    pos[i3 + 1] += 0.012;
                }
            }
            if (pos[i3 + 2] < -3.4) {
                pos[i3 + 2] = 3.6;
                pos[i3] = (Math.random() - 0.5) * 2.4;
                pos[i3 + 1] = 0.12 + Math.random() * 1.35;
            }
        }
        aeroGeo.attributes.position.needsUpdate = true;
    }

    // Keep snow's point-size correct as camera FOV/viewport change (matches
    // Three.js's own perspective size-attenuation formula). Rain uses real
    // world-space quads, so it needs no such correction.
    if (isSnowActive) {
        snowMat.uniforms.uScale.value = (renderer.domElement.clientHeight * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    }

    // Update Rain Particles (per-drop speed + gentle wind drift for realism)
    if (isRainActive) {
        const rPos = rainQuadGeo.attributes.instancePosition.array;
        for (let i = 0; i < RAIN_COUNT; i++) {
            const i3 = i * 3;
            rPos[i3 + 1] -= rainSpeed[i];
            rPos[i3] += rainDrift[i];
            if (rPos[i3 + 1] < 0) {
                rPos[i3 + 1] = 14;
                rPos[i3] = (Math.random() - 0.5) * 22;
                rPos[i3 + 2] = (Math.random() - 0.5) * 22;
            }
        }
        rainQuadGeo.attributes.instancePosition.needsUpdate = true;
    }

    // Update Snow Particles (drifting with turbulent wind)
    if (isSnowActive) {
        const sPos = snowGeo.attributes.position.array;
        const sTime = performance.now() * 0.001;
        for (let i = 0; i < SNOW_COUNT; i++) {
            const i3 = i * 3;
            sPos[i3 + 1] -= snowVels[i3 + 1];
            sPos[i3] += Math.sin(sTime * 1.6 + i) * 0.012;
            sPos[i3 + 2] += Math.cos(sTime * 1.2 + i * 0.5) * 0.008;
            if (sPos[i3 + 1] < 0) {
                sPos[i3 + 1] = 14;
                sPos[i3] = (Math.random() - 0.5) * 22;
                sPos[i3 + 2] = (Math.random() - 0.5) * 22;
            }
        }
        snowGeo.attributes.position.needsUpdate = true;
    }

    if (isDriveMode) {
        if (typeof updateDriveSimulator === 'function') updateDriveSimulator(dt);
    } else if (isHighwayMode) {
        if (typeof updateHighwayCruise === 'function') updateHighwayCruise(dt);
    } else if (isShowcaseTour) {
        // Continuous 360 cinematic drone trajectory
        droneAngle += 0.006;
        cameraCoords.x = Math.sin(droneAngle) * studioDistance;
        cameraCoords.z = Math.cos(droneAngle) * studioDistance;
        cameraCoords.y = 1.05 + Math.sin(droneAngle * 1.6) * 0.4;
        cameraCoords.lookY = 0.35 + Math.sin(droneAngle * 0.8) * 0.08;

        camera.position.x = cameraCoords.x;
        camera.position.y = cameraCoords.y;
        camera.position.z = cameraCoords.z;
    } else if (isStudioOpen) {
        // In Studio mode: continuous turntable rotation if enabled and not dragging or viewing hotspot
        if (isAutoRotate && !isStudioDragging && carModel && !activeHotspotKey && !isHotspotTransitioning) {
            carModel.rotation.y += 0.0035;
        }
        camera.position.x = cameraCoords.x;
        camera.position.y = cameraCoords.y;
        camera.position.z = cameraCoords.z;
    } else {
        // In normal scroll mode: subtle camera parallax, hero direct 3D interaction & scroll-driven car rotation
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;

        // Smoothly interpolate hero zoom distance
        heroCurrentZoom += (heroTargetZoom - heroCurrentZoom) * 0.1;

        // Calculate blend factor: 1 in Hero, smoothly fading to 0 as user scrolls down towards Section 2
        const heroBlend = Math.max(0, 1 - (window.scrollY / (window.innerHeight * 0.55)));

        const zoomOffset = (heroCurrentZoom - heroBaseDistance) * heroBlend;
        const rotOffset = heroRotY * heroBlend;
        const pitchOffset = heroPitchY * heroBlend;

        if (activeHotspotKey || isHotspotTransitioning) {
            camera.position.x = cameraCoords.x;
            camera.position.y = cameraCoords.y;
            camera.position.z = cameraCoords.z;
        } else {
            camera.position.x = cameraCoords.x + currentMouseX;
            camera.position.y = cameraCoords.y + pitchOffset - currentMouseY;
            camera.position.z = cameraCoords.z + zoomOffset;
        }

        if (carModel && !activeHotspotKey && !isHotspotTransitioning) {
            carModel.rotation.y = cameraCoords.carRotY + rotOffset;
        }
    }

    if (!isDriveMode && !isHighwayMode) {
        lookTarget.set(cameraCoords.lookX, cameraCoords.lookY, cameraCoords.lookZ);
        camera.lookAt(lookTarget);

        // Update 3D Hotspot positions
        updateHotspotsProjection();
    }

    renderer.render(scene, camera);
}
animate();

// ==========================================
// 10. DYNAMIC RESPONSIVE CAMERA & RESIZE HANDLER
// ==========================================
function updateResponsiveCamera() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    camera.aspect = aspect;

    // Adapt vertical FOV based on aspect ratio so car is never cropped horizontally on mobile/tablets
    if (aspect < 0.65) {
        // Narrow smartphone portrait (e.g. iPhone portrait 9:19.5)
        camera.fov = 58;
    } else if (aspect < 0.95) {
        // Standard tablet portrait / foldable
        camera.fov = 52;
    } else if (aspect < 1.35) {
        // Square or 4:3 screen
        camera.fov = 48;
    } else {
        // Widescreen monitor
        camera.fov = 45;
    }
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (window.ScrollTrigger) {
        ScrollTrigger.refresh();
    }
}

window.addEventListener('resize', updateResponsiveCamera);
window.addEventListener('orientationchange', () => {
    setTimeout(updateResponsiveCamera, 150);
});
updateResponsiveCamera();

// ==========================================
// 10.5 HERO 3D DIRECT INTERACTION (ROTATE, ZOOM IN/OUT)
// ==========================================
const sectionHome = document.getElementById('home');
const heroInteractionHint = document.getElementById('hero-interaction-hint');
const btnHeroZoomIn = document.getElementById('btn-hero-zoom-in');
const btnHeroZoomOut = document.getElementById('btn-hero-zoom-out');
const btnHeroViewReset = document.getElementById('btn-hero-view-reset');

if (sectionHome) {
    sectionHome.addEventListener('pointerdown', (e) => {
        // Only trigger when in Hero section and not clicking interactive buttons/links
        if (window.scrollY > window.innerHeight * 0.4 || isStudioOpen) return;
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('select') || e.target.closest('input')) return;

        heroPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (heroPointers.size === 1) {
            isHeroDragging = true;
            heroPrevX = e.clientX;
            heroPrevY = e.clientY;
            sectionHome.classList.add('dragging');
        } else if (heroPointers.size === 2) {
            isHeroDragging = false;
            const pts = Array.from(heroPointers.values());
            heroPinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            heroPinchStartZoom = heroTargetZoom;
        }

        if (heroInteractionHint) heroInteractionHint.classList.add('hidden');
    });

    window.addEventListener('pointermove', (e) => {
        if (!isHeroDragging && heroPointers.size < 2) return;
        if (window.scrollY > window.innerHeight * 0.4 || isStudioOpen) return;

        if (heroPointers.has(e.pointerId)) {
            heroPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        // Two-finger pinch to zoom in Hero on mobile
        if (heroPointers.size === 2 && heroPinchStartDist > 0) {
            const pts = Array.from(heroPointers.values());
            const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const scaleFactor = heroPinchStartDist / (currentDist || 1);
            heroTargetZoom = Math.max(2.2, Math.min(5.4, heroPinchStartZoom * scaleFactor));
            return;
        }

        // Single-pointer drag to rotate 360° and tilt pitch
        if (!isHeroDragging) return;
        const deltaX = e.clientX - heroPrevX;
        const deltaY = e.clientY - heroPrevY;
        heroPrevX = e.clientX;
        heroPrevY = e.clientY;

        heroRotY += deltaX * 0.008;
        heroPitchY = Math.max(-0.25, Math.min(0.4, heroPitchY - deltaY * 0.003));
    });

    const endHeroPointer = (e) => {
        heroPointers.delete(e.pointerId);
        if (heroPointers.size === 0) {
            isHeroDragging = false;
            heroPinchStartDist = 0;
            if (sectionHome) sectionHome.classList.remove('dragging');
        } else if (heroPointers.size === 1) {
            const pt = Array.from(heroPointers.values())[0];
            heroPrevX = pt.x;
            heroPrevY = pt.y;
            isHeroDragging = true;
        }
    };

    window.addEventListener('pointerup', endHeroPointer);
    window.addEventListener('pointercancel', endHeroPointer);

    // Mouse wheel zoom in Hero (zooms in/out, and when zoomed out continues normal page scroll)
    sectionHome.addEventListener('wheel', (e) => {
        if (window.scrollY > 25 || isStudioOpen) return;

        if (e.deltaY < 0) {
            // Zoom in towards Aston Martin DBS
            if (heroTargetZoom > 2.3) {
                e.preventDefault();
                heroTargetZoom = Math.max(2.2, heroTargetZoom - 0.22);
                if (heroInteractionHint) heroInteractionHint.classList.add('hidden');
            }
        } else if (e.deltaY > 0) {
            // Zoom out
            if (heroTargetZoom < 4.8) {
                e.preventDefault();
                heroTargetZoom = Math.min(5.2, heroTargetZoom + 0.22);
                if (heroInteractionHint) heroInteractionHint.classList.add('hidden');
            }
        }
    }, { passive: false });
}

// Hero 3D Micro-Control Buttons
if (btnHeroZoomIn) {
    btnHeroZoomIn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        heroTargetZoom = Math.max(2.2, heroTargetZoom - 0.45);
        if (heroInteractionHint) heroInteractionHint.classList.add('hidden');
    });
}

if (btnHeroZoomOut) {
    btnHeroZoomOut.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        heroTargetZoom = Math.min(5.2, heroTargetZoom + 0.45);
        if (heroInteractionHint) heroInteractionHint.classList.add('hidden');
    });
}

if (btnHeroViewReset) {
    btnHeroViewReset.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        gsap.to({ rot: heroRotY, pitch: heroPitchY, zoom: heroTargetZoom }, {
            rot: 0,
            pitch: 0,
            zoom: heroBaseDistance,
            duration: 0.8,
            ease: "power2.out",
            onUpdate: function() {
                heroRotY = this.targets()[0].rot;
                heroPitchY = this.targets()[0].pitch;
                heroTargetZoom = this.targets()[0].zoom;
            }
        });
        if (heroInteractionHint) heroInteractionHint.classList.remove('hidden');
    });
}

// ==========================================
// 11. MINIMALIST GO TO TOP BUTTON
// ==========================================
const btnGoTop = document.getElementById('btn-go-top');
if (btnGoTop) {
    // Use both Lenis and native scroll for maximum compatibility
    const checkGoTop = (scrollY) => {
        if (scrollY > window.innerHeight * 0.4) {
            btnGoTop.classList.add('visible');
        } else {
            btnGoTop.classList.remove('visible');
        }
    };
    // Lenis scroll event
    lenis.on('scroll', ({ scroll }) => checkGoTop(scroll));
    // Native fallback
    window.addEventListener('scroll', () => checkGoTop(window.scrollY), { passive: true });

    btnGoTop.addEventListener('click', (e) => {
        e.preventDefault();
        lenis.scrollTo(0, {
            duration: 1.4,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        });
        setActiveNav('home');
        showHeroContent(true);
    });
}

// ==========================================
// 12. FULL-SCREEN STUDIO & SETTINGS CONTROLLER
// ==========================================
const studioModal = document.getElementById('studio-modal');
const btnStudioClose = document.getElementById('btn-studio-close');
const btnStudioReset = document.getElementById('btn-studio-reset');
const openStudioButtons = document.querySelectorAll('.btn-open-studio');
const activeColourNameEl = document.getElementById('active-colour-name');
const toggleAutoRotate = document.getElementById('toggle-autorotate');
const colourSwatches = document.querySelectorAll('.colour-swatch');
const finishButtons = document.querySelectorAll('.pill-btn[data-finish]');
const lightButtons = document.querySelectorAll('.pill-btn[data-light]');
const angleButtons = document.querySelectorAll('.angle-btn');

// Collapsible Sidebar & Camera Distance Elements
const studioSidebar = document.getElementById('studio-sidebar');
const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
const btnExpandSidebar = document.getElementById('btn-expand-sidebar');
const studioZoomRange = document.getElementById('studio-zoom-range');
const activeZoomNameEl = document.getElementById('active-zoom-name');
const zoomPresetButtons = document.querySelectorAll('.zoom-presets .pill-btn');
let studioDistance = 4.15;

function openStudioModal() {
    isStudioOpen = true;
    closeMobileNav();
    document.body.classList.add('studio-open');
    if (studioModal) {
        studioModal.classList.add('active');
        studioModal.setAttribute('aria-hidden', 'false');
    }
    // Always expand sidebar when studio opens
    if (studioSidebar) studioSidebar.classList.remove('collapsed');
    if (btnExpandSidebar) btnExpandSidebar.classList.remove('visible');
    lenis.stop();

    // Smoothly position camera in Studio Front 3/4 pose honoring distance
    setStudioDistance(studioDistance, false);
    gsap.to(cameraCoords, {
        x: 0,
        y: 0.95,
        z: studioDistance,
        lookX: 0,
        lookY: 0.35,
        lookZ: 0,
        duration: 1.0,
        ease: "power2.inOut"
    });
}

function closeStudioModal() {
    isStudioOpen = false;
    document.body.classList.remove('studio-open');
    if (studioModal) {
        studioModal.classList.remove('active');
        studioModal.setAttribute('aria-hidden', 'true');
    }
    if (studioDropdown) {
        studioDropdown.classList.remove('active');
        if (btnStudioDropdown) btnStudioDropdown.setAttribute('aria-expanded', 'false');
    }
    lenis.start();
    if (mainTimeline && mainTimeline.scrollTrigger) {
        const progress = mainTimeline.scrollTrigger.progress;
        mainTimeline.progress(progress);
    }
    ScrollTrigger.update();
}

openStudioButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        openStudioModal();
    });
});

if (btnStudioClose) {
    btnStudioClose.addEventListener('click', (e) => {
        e.preventDefault();
        closeStudioModal();
    });
}

// Minimalist Studio Experience Dropdown Controller
const studioDropdown = document.getElementById('studio-dropdown');
const btnStudioDropdown = document.getElementById('btn-studio-dropdown');
const studioDropdownMenu = document.getElementById('studio-dropdown-menu');

if (btnStudioDropdown && studioDropdown && studioDropdownMenu) {
    btnStudioDropdown.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = studioDropdown.classList.toggle('active');
        btnStudioDropdown.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close dropdown when clicking anywhere outside
    document.addEventListener('click', (e) => {
        if (studioDropdown.classList.contains('active')) {
            if (!studioDropdown.contains(e.target)) {
                studioDropdown.classList.remove('active');
                btnStudioDropdown.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Close dropdown on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && studioDropdown.classList.contains('active')) {
            studioDropdown.classList.remove('active');
            btnStudioDropdown.setAttribute('aria-expanded', 'false');
        }
    });

    // Close dropdown when clicking a regular item (not weather parent)
    const dropdownItems = studioDropdownMenu.querySelectorAll('.dropdown-item:not(.dropdown-item--has-sub)');
    dropdownItems.forEach((item) => {
        item.addEventListener('click', () => {
            studioDropdown.classList.remove('active');
            btnStudioDropdown.setAttribute('aria-expanded', 'false');
        });
    });

    // ── Weather Sub-Dropdown Toggle ──
    const weatherParent = document.getElementById('dropdown-weather-parent');
    const weatherSubItems = document.querySelectorAll('.dropdown-sub-item[data-weather]');

    if (weatherParent) {
        weatherParent.addEventListener('click', (e) => {
            // If clicking a sub-item, handle weather change — don't toggle parent
            const subItem = e.target.closest('.dropdown-sub-item[data-weather]');
            if (subItem) {
                const weather = subItem.dataset.weather;
                if (typeof setWeather === 'function') setWeather(weather);

                // Update active state on sub-items
                weatherSubItems.forEach(b => b.classList.remove('active'));
                subItem.classList.add('active');

                // Update active state on sidebar weather cards too
                document.querySelectorAll('.weather-card[data-weather]').forEach(c => {
                    c.classList.toggle('active', c.dataset.weather === weather);
                });

                // Update label in sidebar
                const nameEl = document.getElementById('active-weather-name');
                const names = { sun: 'Golden Sun', rain: 'Wet Track', fog: 'London Fog', snow: 'Alpine Snow' };
                if (nameEl) nameEl.textContent = names[weather] || weather;

                // Close main dropdown after selecting
                studioDropdown.classList.remove('active');
                btnStudioDropdown.setAttribute('aria-expanded', 'false');
                return;
            }

            // Otherwise toggle the sub-dropdown open/close
            e.stopPropagation();
            const isOpen = weatherParent.classList.toggle('open');
            weatherParent.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }
}

// Close modals, simulators, or mobile nav with Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (activeHotspotKey && typeof closeHotspotDetail === 'function') {
            closeHotspotDetail();
            return;
        }
        // exitSimulatorMode()/exitHighwayMode() land back in the Studio
        // modal on their own — don't let the closeStudioModal() below
        // immediately close it again in this same keypress.
        const wasLeavingToStudio = isDriveMode || isHighwayMode;
        if (isDriveMode && typeof exitSimulatorMode === 'function') exitSimulatorMode();
        if (isHighwayMode && typeof exitHighwayMode === 'function') exitHighwayMode();
        if (typeof closeBenchmarkModal === 'function') closeBenchmarkModal();
        if (isStudioOpen && !wasLeavingToStudio) closeStudioModal();
        if (enquiryModal && enquiryModal.classList.contains('active')) {
            enquiryModal.classList.remove('active');
            enquiryModal.setAttribute('aria-hidden', 'true');
        }
        closeMobileNav();
    }
});

// Interactive 360° Drag & Multi-Touch Pinch-to-Zoom in Studio Mode
const activePointers = new Map();
let initialPinchDistance = 0;
let pinchStartZoom = 3.65;

if (studioModal) {
    // Dynamic mobile touch hint
    const studioHint = document.getElementById('studio-hint');
    if (studioHint && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
        studioHint.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>Touch &amp; drag 360&deg; &bull; Pinch to zoom</span>
        `;
    }

    studioModal.addEventListener('pointerdown', (e) => {
        // Do not trigger drag when clicking inside settings sidebar, topbar or expand button
        if (e.target.closest('.studio-sidebar') || e.target.closest('.studio-topbar') || e.target.closest('.studio-expand-btn')) return;
        
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 1) {
            isStudioDragging = true;
            prevPointerX = e.clientX;
            prevPointerY = e.clientY;
        } else if (activePointers.size === 2) {
            isStudioDragging = false;
            const pts = Array.from(activePointers.values());
            initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            pinchStartZoom = studioDistance;
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (!isStudioOpen) return;
        if (activePointers.has(e.pointerId)) {
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        // 2 fingers pinch to zoom on touch screens
        if (activePointers.size === 2 && initialPinchDistance > 0) {
            const pts = Array.from(activePointers.values());
            const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const scale = initialPinchDistance / (currentDist || 1);
            const newZoom = Math.max(2.2, Math.min(5.6, pinchStartZoom * scale));
            setStudioDistance(newZoom, false);
            return;
        }

        // Single finger / mouse 360 drag
        if (!isStudioDragging || !carModel) return;
        const deltaX = e.clientX - prevPointerX;
        const deltaY = e.clientY - prevPointerY;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;

        carModel.rotation.y += deltaX * 0.008;
        cameraCoords.y = Math.max(0.4, Math.min(2.4, cameraCoords.y - deltaY * 0.004));
    });

    const finishPointer = (e) => {
        activePointers.delete(e.pointerId);
        if (activePointers.size === 0) {
            isStudioDragging = false;
            initialPinchDistance = 0;
        } else if (activePointers.size === 1) {
            const pt = Array.from(activePointers.values())[0];
            prevPointerX = pt.x;
            prevPointerY = pt.y;
            isStudioDragging = true;
        }
    };

    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);
}

// Collapsible Studio Sidebar
if (btnCollapseSidebar && studioSidebar && btnExpandSidebar) {
    btnCollapseSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        studioSidebar.classList.add('collapsed');
        btnExpandSidebar.classList.add('visible');
    });

    btnExpandSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        studioSidebar.classList.remove('collapsed');
        btnExpandSidebar.classList.remove('visible');
    });
}

const sheetDragHandle = document.getElementById('sheet-drag-handle');
if (sheetDragHandle && studioSidebar && btnExpandSidebar) {
    sheetDragHandle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        studioSidebar.classList.add('collapsed');
        btnExpandSidebar.classList.add('visible');
    });
}

// Camera Distance / Perspective Zoom Logic (Plan Apropiat / Îndepărtat)
function setStudioDistance(dist, animate = false) {
    dist = Math.max(2.2, Math.min(5.6, dist));
    studioDistance = dist;

    if (studioZoomRange) {
        studioZoomRange.value = dist.toFixed(2);
    }

    if (activeZoomNameEl) {
        if (dist <= 2.8) {
            activeZoomNameEl.textContent = 'Apropiat';
        } else if (dist >= 4.5) {
            activeZoomNameEl.textContent = 'Îndepărtat';
        } else {
            activeZoomNameEl.textContent = 'Standard';
        }
    }

    zoomPresetButtons.forEach(btn => {
        const btnZoom = parseFloat(btn.getAttribute('data-zoom'));
        if (Math.abs(btnZoom - dist) < 0.35) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Scale current camera distance along viewing ray relative to lookTarget
    const dx = cameraCoords.x - cameraCoords.lookX;
    const dy = cameraCoords.y - cameraCoords.lookY;
    const dz = cameraCoords.z - cameraCoords.lookZ;
    const currentLen = Math.sqrt(dx * dx + dy * dy + dz * dz) || 3.65;
    const factor = dist / currentLen;

    const targetX = cameraCoords.lookX + dx * factor;
    const targetY = cameraCoords.lookY + dy * factor;
    const targetZ = cameraCoords.lookZ + dz * factor;

    if (animate) {
        gsap.to(cameraCoords, {
            x: targetX,
            y: targetY,
            z: targetZ,
            duration: 0.6,
            ease: "power2.out"
        });
    } else {
        cameraCoords.x = targetX;
        cameraCoords.y = targetY;
        cameraCoords.z = targetZ;
    }
}

if (studioZoomRange) {
    studioZoomRange.addEventListener('input', () => {
        setStudioDistance(parseFloat(studioZoomRange.value), false);
    });
}

zoomPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetZoom = parseFloat(btn.getAttribute('data-zoom'));
        setStudioDistance(targetZoom, true);
    });
});

// Interactive Mouse Wheel Zoom when in Studio Modal
if (studioModal) {
    studioModal.addEventListener('wheel', (e) => {
        if (!isStudioOpen) return;
        if (e.target.closest('.sidebar-scrollable')) return;
        e.preventDefault();

        const zoomStep = e.deltaY * 0.0025;
        setStudioDistance(studioDistance + zoomStep, false);
    }, { passive: false });
}

// Turntable Auto-Rotate Toggle
if (toggleAutoRotate) {
    toggleAutoRotate.addEventListener('change', () => {
        isAutoRotate = toggleAutoRotate.checked;
    });
}

// Paint Colour Customisation
colourSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        colourSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        const hexColor = swatch.getAttribute('data-color');
        const colorName = swatch.getAttribute('data-name');
        if (activeColourNameEl) activeColourNameEl.textContent = colorName;

        const newThreeColor = new THREE.Color(hexColor);
        paintMeshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.color.copy(newThreeColor);
                mesh.material.needsUpdate = true;
            }
        });
    });
});

// Paint Finish Toggle (Gloss vs Matte)
finishButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        finishButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const finishType = btn.getAttribute('data-finish');
        paintMeshes.forEach(mesh => {
            if (mesh.material) {
                if (finishType === 'matte') {
                    mesh.material.roughness = 0.52;
                    mesh.material.metalness = 0.35;
                    mesh.material.clearcoat = 0.0;
                } else {
                    mesh.material.roughness = 0.15;
                    mesh.material.metalness = 0.85;
                    mesh.material.clearcoat = 1.0;
                }
                mesh.material.needsUpdate = true;
            }
        });
    });
});

// Atmosphere & Lighting Presets (including Silverstone Wet Track)
lightButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        lightButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const lightMode = btn.getAttribute('data-light');
        if (lightMode === 'golden') {
            isRainActive = false;
            gsap.to(rainMat.uniforms.uOpacity, { value: 0, duration: 0.3 });
            keyLight.color.set(0xffd59e);
            keyLight.intensity = 3.6;
            rimLight.color.set(0xff9900);
            rimLight.intensity = 2.4;
            warmAccentLight.color.set(0xffe082);
            scene.background.set(0x0e0c08);
        } else if (lightMode === 'cyber') {
            isRainActive = false;
            gsap.to(rainMat.uniforms.uOpacity, { value: 0, duration: 0.3 });
            keyLight.color.set(0x00f0ff);
            keyLight.intensity = 2.8;
            rimLight.color.set(0xff0066);
            rimLight.intensity = 3.2;
            warmAccentLight.color.set(0x7c4dff);
            scene.background.set(0x06060c);
        } else if (lightMode === 'rain') {
            isRainActive = true;
            gsap.to(rainMat.uniforms.uOpacity, { value: 0.75, duration: 0.5 });
            keyLight.color.set(0x8cb0f0);
            keyLight.intensity = 2.2;
            rimLight.color.set(0x3880ff);
            rimLight.intensity = 3.8;
            warmAccentLight.color.set(0x205090);
            scene.background.set(0x030508);
        } else {
            // Showroom default
            isRainActive = false;
            gsap.to(rainMat.uniforms.uOpacity, { value: 0, duration: 0.3 });
            keyLight.color.set(0xffffff);
            keyLight.intensity = 3.2;
            rimLight.color.set(0x4080ff);
            rimLight.intensity = 2.2;
            warmAccentLight.color.set(0xd4af37);
            scene.background.set(0x08080a);
        }
    });
});

// Headlights Toggle Button in Studio
const btnToggleHeadlights = document.getElementById('btn-toggle-headlights');
if (btnToggleHeadlights) {
    btnToggleHeadlights.addEventListener('click', (e) => {
        e.preventDefault();
        setHeadlights(!isHeadlightsOn);
    });
}

// Wheels Finish Swatches
const wheelSwatches = document.querySelectorAll('.wheel-swatch');
const activeWheelNameEl = document.getElementById('active-wheel-name');

wheelSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        wheelSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        const hexColor = swatch.getAttribute('data-wheel-color');
        const metal = parseFloat(swatch.getAttribute('data-wheel-metal') || '0.9');
        const rough = parseFloat(swatch.getAttribute('data-wheel-rough') || '0.18');
        const name = swatch.getAttribute('data-wheel-name');
        if (activeWheelNameEl) activeWheelNameEl.textContent = name;

        const newCol = new THREE.Color(hexColor);
        wheelMeshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.color.copy(newCol);
                mesh.material.metalness = metal;
                mesh.material.roughness = rough;
                mesh.material.needsUpdate = true;
            }
        });
        syncUrlHash();
    });
});

// Brake Calipers Swatches
const caliperSwatches = document.querySelectorAll('.caliper-swatch');
const activeCaliperNameEl = document.getElementById('active-caliper-name');

caliperSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        caliperSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        const hexColor = swatch.getAttribute('data-caliper-color');
        const name = swatch.getAttribute('data-caliper-name');
        if (activeCaliperNameEl) activeCaliperNameEl.textContent = name;

        const newCol = new THREE.Color(hexColor);
        caliperMeshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.color.copy(newCol);
                mesh.material.roughness = 0.22;
                mesh.material.metalness = 0.5;
                mesh.material.needsUpdate = true;
            }
        });
        syncUrlHash();
    });
});

// Interior Leather Swatches
const interiorSwatches = document.querySelectorAll('.interior-swatch');
const activeInteriorNameEl = document.getElementById('active-interior-name');

interiorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        interiorSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');

        const hexColor = swatch.getAttribute('data-interior-color');
        const name = swatch.getAttribute('data-interior-name');
        if (activeInteriorNameEl) activeInteriorNameEl.textContent = name;

        const newCol = new THREE.Color(hexColor);
        interiorMeshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.color.copy(newCol);
                mesh.material.roughness = 0.48;
                mesh.material.needsUpdate = true;
            }
        });
        syncUrlHash();
    });
});

// Carbon Fibre Aero Pack Toggle
const carbonButtons = document.querySelectorAll('.carbon-pack-group .pill-btn');
carbonButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        carbonButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const type = btn.getAttribute('data-carbon');
        carbonMeshes.forEach(mesh => {
            if (mesh.material) {
                if (type === 'gloss') {
                    mesh.material.roughness = 0.2;
                    mesh.material.metalness = 0.7;
                    mesh.material.clearcoat = 1.0;
                } else {
                    mesh.material.roughness = 0.52;
                    mesh.material.metalness = 0.35;
                    mesh.material.clearcoat = 0.0;
                }
                mesh.material.needsUpdate = true;
            }
        });
        syncUrlHash();
    });
});

// Bang & Olufsen Cabin Bar Element
const boSoundBar = document.getElementById('bo-sound-bar');
const btnBoToggle = document.getElementById('btn-bo-toggle');
let isBoMuted = false;

if (btnBoToggle) {
    btnBoToggle.addEventListener('click', () => {
        isBoMuted = !isBoMuted;
        btnBoToggle.querySelector('span').textContent = isBoMuted ? 'Unmute Cabin Hi-Fi' : 'Mute Cabin Hi-Fi';
    });
}

// Camera Perspective Angle Presets (including Cockpit View & B&O Sound Dock)
angleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        angleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const angleType = btn.getAttribute('data-angle');

        if (angleType === 'cockpit') {
            // Smoothly fly inside driver cockpit view
            if (boSoundBar) boSoundBar.classList.add('active');
            gsap.to(cameraCoords, {
                x: 0.26,
                y: 0.72,
                z: 0.12,
                lookX: 0.26,
                lookY: 0.72,
                lookZ: 1.4,
                duration: 1.2,
                ease: "power2.inOut"
            });
            return;
        }

        // Hide B&O player when stepping outside vehicle
        if (boSoundBar) boSoundBar.classList.remove('active');

        let baseDirX = 0, baseDirY = 0.6, baseDirZ = 3.65;

        if (angleType === 'side') {
            baseDirX = 3.6; baseDirY = 0.55; baseDirZ = 0.4;
        } else if (angleType === 'rear') {
            baseDirX = 2.6; baseDirY = 1.05; baseDirZ = -3.7;
        } else if (angleType === 'top') {
            baseDirX = 0; baseDirY = 3.25; baseDirZ = 2.0;
        }

        const baseLen = Math.sqrt(baseDirX * baseDirX + baseDirY * baseDirY + baseDirZ * baseDirZ) || 3.65;
        const scale = studioDistance / baseLen;

        const targetX = cameraCoords.lookX + baseDirX * scale;
        const targetY = cameraCoords.lookY + baseDirY * scale;
        const targetZ = cameraCoords.lookZ + baseDirZ * scale;

        gsap.to(cameraCoords, {
            x: targetX,
            y: targetY,
            z: targetZ,
            duration: 0.9,
            ease: "power2.inOut"
        });
    });
});

// ==========================================
// 15. 0-100 KM/H LAUNCH CONTROL SIMULATOR
// ==========================================
const launchModal = document.getElementById('launch-control-modal');
const btnCloseLaunch = document.getElementById('btn-close-launch');
const btnHeroLaunch = document.getElementById('btn-hero-launch');
const btnStudioLaunch = document.getElementById('btn-studio-launch');

const btnPedalBrake = document.getElementById('btn-pedal-brake');
const btnPedalThrottle = document.getElementById('btn-pedal-throttle');

const lightPrestage = document.getElementById('light-prestage');
const lightStage = document.getElementById('light-stage');
const lightAmber1 = document.getElementById('light-amber-1');
const lightAmber2 = document.getElementById('light-amber-2');
const lightAmber3 = document.getElementById('light-amber-3');
const lightGreen = document.getElementById('light-green');

const phaseText = document.getElementById('launch-phase-text');
const hintText = document.getElementById('launch-hint-text');

const speedVal = document.getElementById('launch-speed-val');
const timerVal = document.getElementById('launch-timer-val');
const boostVal = document.getElementById('launch-boost-val');
const gearVal = document.getElementById('launch-gear-val');

const resultsCard = document.getElementById('launch-results-card');
const pedalsDeck = document.getElementById('launch-pedals-deck');
const btnLaunchAgain = document.getElementById('btn-launch-again');
const btnLaunchExit = document.getElementById('btn-launch-exit');

let isLaunchActive = false;
let isBrakeHeld = false;
let isThrottleHeld = false;
let launchTimerInterval = null;
let launchCountdownTimeout = null;

function openLaunchModal() {
    isLaunchActive = true;
    closeMobileNav();
    if (launchModal) {
        launchModal.classList.add('active');
        launchModal.setAttribute('aria-hidden', 'false');
    }
    lenis.stop();
    resetLaunchState();

    // Position camera low behind car
    gsap.to(cameraCoords, {
        x: 0.35,
        y: 0.45,
        z: -3.8,
        lookX: 0,
        lookY: 0.38,
        lookZ: 0,
        duration: 1.0,
        ease: "power2.inOut"
    });
}

function closeLaunchModal() {
    isLaunchActive = false;
    resetLaunchState();
    if (launchModal) {
        launchModal.classList.remove('active');
        launchModal.setAttribute('aria-hidden', 'true');
    }
    if (!isStudioOpen) lenis.start();
    else setStudioDistance(studioDistance, true);
}

function resetLaunchState() {
    isBrakeHeld = false;
    isThrottleHeld = false;
    if (launchTimerInterval) clearInterval(launchTimerInterval);
    if (launchCountdownTimeout) clearTimeout(launchCountdownTimeout);

    [lightPrestage, lightStage, lightAmber1, lightAmber2, lightAmber3, lightGreen].forEach(el => {
        if (el) el.classList.remove('active');
    });

    if (phaseText) phaseText.textContent = 'SYSTEM ARMED';
    if (hintText) hintText.textContent = 'Step 1: Press and hold BRAKE pedal firmly';

    if (speedVal) speedVal.textContent = '0';
    if (timerVal) timerVal.textContent = '0.00';
    if (boostVal) boostVal.textContent = '0.0';
    if (gearVal) gearVal.textContent = '1';

    if (resultsCard) resultsCard.classList.remove('active');
    if (pedalsDeck) pedalsDeck.classList.remove('hidden');

    if (btnPedalBrake) btnPedalBrake.classList.remove('pressed');
    if (btnPedalThrottle) btnPedalThrottle.classList.remove('pressed');
}

if (btnHeroLaunch) btnHeroLaunch.addEventListener('click', openLaunchModal);
if (btnStudioLaunch) btnStudioLaunch.addEventListener('click', openLaunchModal);
if (btnCloseLaunch) btnCloseLaunch.addEventListener('click', closeLaunchModal);
if (btnLaunchExit) btnLaunchExit.addEventListener('click', closeLaunchModal);
if (btnLaunchAgain) btnLaunchAgain.addEventListener('click', resetLaunchState);

// Pedal Actions
if (btnPedalBrake) {
    const handleBrakeDown = (e) => {
        e.preventDefault();
        isBrakeHeld = true;
        btnPedalBrake.classList.add('pressed');

        if (lightPrestage) lightPrestage.classList.add('active');
        if (lightStage) lightStage.classList.add('active');

        if (!isThrottleHeld) {
            if (phaseText) phaseText.textContent = 'STAGED • BRAKE LOCKED';
            if (hintText) hintText.textContent = 'Step 2: Floor THROTTLE to build twin-turbo boost';
        }
    };

    const handleBrakeUp = (e) => {
        e.preventDefault();
        if (!isBrakeHeld) return;
        isBrakeHeld = false;
        btnPedalBrake.classList.remove('pressed');

        // If Green light was active -> Launch!
        if (lightGreen && lightGreen.classList.contains('active')) {
            executeLaunchSprint();
        } else {
            // Premature release -> false start reset
            resetLaunchState();
        }
    };

    btnPedalBrake.addEventListener('pointerdown', handleBrakeDown);
    window.addEventListener('pointerup', (e) => {
        if (isLaunchActive && isBrakeHeld && e.target !== btnPedalBrake) {
            handleBrakeUp(e);
        }
    });
    btnPedalBrake.addEventListener('pointerup', handleBrakeUp);
}

if (btnPedalThrottle) {
    const handleThrottleDown = (e) => {
        e.preventDefault();
        if (!isBrakeHeld) return; // Must hold brake first
        isThrottleHeld = true;
        btnPedalThrottle.classList.add('pressed');

        if (phaseText) phaseText.textContent = 'BUILDING TWIN-TURBO BOOST';
        if (hintText) hintText.textContent = 'Stand by... Building 4,000 RPM Launch Lock!';

        engineSystem.start();
        engineSystem.currentRpm = 3900;
        engineSystem.targetRpm = 4100;

        // Boost sweep 0 -> 1.8 bar
        gsap.to({ b: 0 }, {
            b: 1.8,
            duration: 0.6,
            onUpdate: function() {
                if (boostVal) boostVal.textContent = this.targets()[0].b.toFixed(1);
            }
        });

        // Tree Amber sequence
        launchCountdownTimeout = setTimeout(() => {
            if (!isBrakeHeld || !isThrottleHeld) return;
            if (lightAmber1) lightAmber1.classList.add('active');

            setTimeout(() => {
                if (!isBrakeHeld || !isThrottleHeld) return;
                if (lightAmber2) lightAmber2.classList.add('active');

                setTimeout(() => {
                    if (!isBrakeHeld || !isThrottleHeld) return;
                    if (lightAmber3) lightAmber3.classList.add('active');

                    setTimeout(() => {
                        if (!isBrakeHeld || !isThrottleHeld) return;
                        if (lightGreen) lightGreen.classList.add('active');
                        if (phaseText) phaseText.textContent = 'GREEN LIGHT! LAUNCH!';
                        if (hintText) hintText.textContent = 'RELEASE BRAKE PEDAL NOW!';
                    }, 350);
                }, 350);
            }, 350);
        }, 300);
    };

    const handleThrottleUp = (e) => {
        e.preventDefault();
        isThrottleHeld = false;
        btnPedalThrottle.classList.remove('pressed');
    };

    btnPedalThrottle.addEventListener('pointerdown', handleThrottleDown);
    btnPedalThrottle.addEventListener('pointerup', handleThrottleUp);
}

function executeLaunchSprint() {
    if (pedalsDeck) pedalsDeck.classList.add('hidden');
    if (phaseText) phaseText.textContent = 'FULL SPRINT ACCELERATION';
    if (hintText) hintText.textContent = '0–100 km/h: 3.4 seconds';

    const startTime = performance.now();
    launchTimerInterval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (timerVal) timerVal.textContent = elapsed.toFixed(2);
    }, 30);

    // Speed count-up from 0 to 100 in 3.4 seconds
    const speedObj = { spd: 0 };
    gsap.to(speedObj, {
        spd: 100,
        duration: 3.4,
        ease: "power1.in",
        onUpdate: () => {
            const current = Math.round(speedObj.spd);
            if (speedVal) speedVal.textContent = current;

            // Gearshifts at 56 and 92 km/h
            if (current >= 56 && current < 92) {
                if (gearVal && gearVal.textContent !== '2') {
                    gearVal.textContent = '2';
                    engineSystem.playGearshiftPop();
                }
            } else if (current >= 92) {
                if (gearVal && gearVal.textContent !== '3') {
                    gearVal.textContent = '3';
                    engineSystem.playGearshiftPop();
                }
            }
        },
        onComplete: () => {
            clearInterval(launchTimerInterval);
            if (timerVal) timerVal.textContent = '3.40';
            if (phaseText) phaseText.textContent = 'RECORD SPRINT COMPLETED';
            if (hintText) hintText.textContent = 'Official Gaydon Certified Performance Slip';
            if (resultsCard) resultsCard.classList.add('active');
        }
    });
}

// ==========================================
// 16. QR CODE SHARING & URL HASH SYNCHRONIZATION
// ==========================================
const qrModal = document.getElementById('qr-share-modal');
const btnCloseQr = document.getElementById('modal-qr-close');
const btnStudioShare = document.getElementById('btn-studio-share');
const btnCopyUrl = document.getElementById('btn-copy-url');
const qrShareUrl = document.getElementById('qr-share-url');
const copyToast = document.getElementById('copy-toast');

// Renders a real, standards-compliant QR code (via the qrcode-generator
// library) so it actually scans on a phone camera — not a decorative
// pattern. Falls back to a plain link message if the library failed to load.
function drawQRCodeToCanvas(canvasId, text) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    if (typeof qrcode !== 'function') {
        ctx.fillStyle = '#08080a';
        ctx.font = '600 11px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('QR unavailable — copy link below', size / 2, size / 2);
        return;
    }

    const qr = qrcode(0, 'M'); // type 0 = auto-sized, level M error correction
    qr.addData(text);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const quietZone = 2; // modules of white margin, per QR spec minimum
    const cell = size / (moduleCount + quietZone * 2);

    ctx.fillStyle = '#08080a';
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect((col + quietZone) * cell, (row + quietZone) * cell, cell, cell);
            }
        }
    }
}

function syncUrlHash() {
    const paint = document.getElementById('active-colour-name')?.textContent || 'Obsidian Black';
    const wheels = document.getElementById('active-wheel-name')?.textContent || 'Gloss Black';
    const calipers = document.getElementById('active-caliper-name')?.textContent || 'Aston Lime';
    const interior = document.getElementById('active-interior-name')?.textContent || 'Oxford Tan';

    const p = new URLSearchParams();
    p.set('paint', paint.replace(/\s+/g, '-').toLowerCase());
    p.set('wheels', wheels.replace(/\s+/g, '-').toLowerCase());
    p.set('calipers', calipers.replace(/\s+/g, '-').toLowerCase());
    p.set('interior', interior.replace(/\s+/g, '-').toLowerCase());

    window.history.replaceState(null, '', `#spec=${p.toString()}`);
    if (qrShareUrl) qrShareUrl.value = window.location.href;
}

if (btnStudioShare) {
    btnStudioShare.addEventListener('click', (e) => {
        e.preventDefault();
        syncUrlHash();

        const paint = document.getElementById('active-colour-name')?.textContent || 'Obsidian Black';
        const wheels = document.getElementById('active-wheel-name')?.textContent || 'Gloss Black';
        const calipers = document.getElementById('active-caliper-name')?.textContent || 'Aston Lime';
        const interior = document.getElementById('active-interior-name')?.textContent || 'Oxford Tan';

        if (document.getElementById('qr-pill-paint')) document.getElementById('qr-pill-paint').textContent = paint;
        if (document.getElementById('qr-pill-wheels')) document.getElementById('qr-pill-wheels').textContent = wheels;
        if (document.getElementById('qr-pill-calipers')) document.getElementById('qr-pill-calipers').textContent = calipers;
        if (document.getElementById('qr-pill-interior')) document.getElementById('qr-pill-interior').textContent = interior;

        drawQRCodeToCanvas('qr-canvas', window.location.href);

        if (qrModal) {
            qrModal.classList.add('active');
            qrModal.setAttribute('aria-hidden', 'false');
        }
    });
}

if (btnCloseQr) {
    btnCloseQr.addEventListener('click', () => {
        if (qrModal) {
            qrModal.classList.remove('active');
            qrModal.setAttribute('aria-hidden', 'true');
        }
    });
}

if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
        if (qrShareUrl) {
            navigator.clipboard.writeText(qrShareUrl.value).then(() => {
                if (copyToast) {
                    copyToast.classList.add('visible');
                    setTimeout(() => copyToast.classList.remove('visible'), 2400);
                }
            });
        }
    });
}

// ==========================================
// 17. AUGMENTED REALITY (AR) MODAL
// ==========================================
const arModal = document.getElementById('ar-modal');
const btnCloseAr = document.getElementById('modal-ar-close');
const btnStudioAr = document.getElementById('btn-studio-ar');

if (btnStudioAr) {
    btnStudioAr.addEventListener('click', (e) => {
        e.preventDefault();
        // Points at the real AR viewer page (model-viewer + Android Scene
        // Viewer / WebXR), not the raw .glb — a phone opening a bare model
        // file has nothing to render it with.
        drawQRCodeToCanvas('ar-qr-canvas', window.location.origin + window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') + '/ar.html');
        if (arModal) {
            arModal.classList.add('active');
            arModal.setAttribute('aria-hidden', 'false');
        }
    });
}

if (btnCloseAr) {
    btnCloseAr.addEventListener('click', () => {
        if (arModal) {
            arModal.classList.remove('active');
            arModal.setAttribute('aria-hidden', 'true');
        }
    });
}

// ==========================================
// 18. RESTORE SPEC FROM URL HASH ON LOAD
// ==========================================
function restoreSpecFromHash() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('spec=')) return;

    try {
        const queryStr = hash.replace('#spec=', '');
        const p = new URLSearchParams(queryStr);

        const paintParam = p.get('paint');
        const wheelsParam = p.get('wheels');
        const calipersParam = p.get('calipers');
        const interiorParam = p.get('interior');

        if (paintParam) {
            const swatch = Array.from(colourSwatches).find(s => (s.getAttribute('data-name') || '').toLowerCase().replace(/\s+/g, '-') === paintParam);
            if (swatch) swatch.click();
        }
        if (wheelsParam) {
            const swatch = Array.from(wheelSwatches).find(s => (s.getAttribute('data-wheel-name') || '').toLowerCase().replace(/\s+/g, '-') === wheelsParam);
            if (swatch) swatch.click();
        }
        if (calipersParam) {
            const swatch = Array.from(caliperSwatches).find(s => (s.getAttribute('data-caliper-name') || '').toLowerCase().replace(/\s+/g, '-') === calipersParam);
            if (swatch) swatch.click();
        }
        if (interiorParam) {
            const swatch = Array.from(interiorSwatches).find(s => (s.getAttribute('data-interior-name') || '').toLowerCase().replace(/\s+/g, '-') === interiorParam);
            if (swatch) swatch.click();
        }
    } catch (e) {
        console.error('Could not restore spec from hash:', e);
    }
}

// Check on load
setTimeout(restoreSpecFromHash, 600);

// Reset Studio Spec
if (btnStudioReset) {
    btnStudioReset.addEventListener('click', () => {
        // Reset distance to Standard
        setStudioDistance(4.15, true);

        // Turn off showcase tour if active
        if (isShowcaseTour) toggleShowcaseTour();

        // Turn off aero flow & x-ray
        toggleAeroFlow(false);
        toggleXRay(false);

        // Turn off headlights
        setHeadlights(false);

        // Close any active hotspot
        closeHotspotDetail();

        // Expand sidebar if collapsed
        if (studioSidebar) studioSidebar.classList.remove('collapsed');
        if (btnExpandSidebar) btnExpandSidebar.classList.remove('visible');

        // Reset colour to Obsidian Black
        const blackSwatch = document.querySelector('.colour-swatch[data-name="Obsidian Black"]') || colourSwatches[2];
        if (blackSwatch) blackSwatch.click();

        // Reset wheels to Gloss Black
        if (wheelSwatches[0]) wheelSwatches[0].click();

        // Reset calipers to Aston Lime
        if (caliperSwatches[0]) caliperSwatches[0].click();

        // Reset interior to Oxford Tan
        if (interiorSwatches[0]) interiorSwatches[0].click();

        // Reset carbon to Gloss 2x2
        if (carbonButtons[0]) carbonButtons[0].click();

        // Reset finish to Satin Matte
        const matteFinish = document.querySelector('.pill-btn[data-finish="matte"]');
        if (matteFinish) matteFinish.click();

        // Reset light to Showroom
        const firstLight = lightButtons[0];
        if (firstLight) firstLight.click();

        // Reset angle to Front
        const firstAngle = angleButtons[0];
        if (firstAngle) firstAngle.click();

        // Reset autorotate
        if (toggleAutoRotate) {
            toggleAutoRotate.checked = true;
            isAutoRotate = true;
        }

        // Reset Livery to None
        if (typeof applyLivery === 'function') {
            applyLivery('none');
        }

        // Reset Drive Mode to GT
        if (typeof setDriveMode === 'function') {
            setDriveMode('gt');
        }

        // Reset Weather to Sun
        if (typeof setWeather === 'function') {
            setWeather('sun');
        }

        // Reset sidebar panel dock position
        if (btnResetDock) {
            btnResetDock.click();
        }

        // Reset URL Hash
        syncUrlHash();
    });
}

// ==========================================
// 19. SILVERSTONE TRACK TEST DRIVE SIMULATOR
// ==========================================
let silverstoneTrackGroup = null;
let smokeParticles = null;
let smokeGeo = null;
const SMOKE_COUNT = 60;
const smokePositions = new Float32Array(SMOKE_COUNT * 3);
const smokeVelocities = new Float32Array(SMOKE_COUNT * 3);
const smokeAges = new Float32Array(SMOKE_COUNT);
const smokeLifespans = new Float32Array(SMOKE_COUNT);
let smokeIndex = 0;

let simSpeed = 0; // km/h
let simSteer = 0; // -1 to 1
let targetSteer = 0;
let simHeading = 0; // radians
let simLapStartTime = 0;
let currentGear = 'N';

const driveKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

const driveSimulatorHud = document.getElementById('drive-simulator-hud');
const btnStudioSimulator = document.getElementById('btn-studio-simulator');
const btnExitDrive = document.getElementById('btn-exit-drive');
const driveHudSpeed = document.getElementById('drive-speed-val');
const driveHudGear = document.getElementById('drive-gear-val');
const driveHudGforce = document.getElementById('drive-gforce-val');
const driveHudLap = document.getElementById('drive-lap-val');

const touchSteerLeft = document.getElementById('touch-steer-left');
const touchSteerRight = document.getElementById('touch-steer-right');
const touchPedalBrake = document.getElementById('touch-pedal-brake');
const touchPedalGas = document.getElementById('touch-pedal-gas');

function initSilverstoneTrack() {
    if (silverstoneTrackGroup) return;
    silverstoneTrackGroup = new THREE.Group();
    silverstoneTrackGroup.name = 'silverstoneTrack';

    // 1. Asphalt circuit ground
    const groundGeo = new THREE.PlaneGeometry(600, 600, 16, 16);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x141518,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    silverstoneTrackGroup.add(ground);

    // 2. Track Circuit Ribbon
    const curbGroup = new THREE.Group();
    const innerRadius = 75;
    const outerRadius = 115;
    
    const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0x1d1e22,
        roughness: 0.82,
        metalness: 0.18
    });
    const trackRing = new THREE.Mesh(ringGeo, ringMat);
    trackRing.position.y = 0.005;
    trackRing.receiveShadow = true;
    curbGroup.add(trackRing);

    // Red & White Curbs
    const curbMatRed = new THREE.MeshBasicMaterial({ color: 0xcc1111 });
    const curbMatWhite = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const curbBoxGeo = new THREE.BoxGeometry(1.6, 0.08, 0.9);

    for (let i = 0; i < 96; i++) {
        const angle = (i / 96) * Math.PI * 2;
        const mat = (i % 2 === 0) ? curbMatRed : curbMatWhite;
        
        // Inner curb
        const innerCurb = new THREE.Mesh(curbBoxGeo, mat);
        innerCurb.position.set(Math.cos(angle) * (innerRadius - 0.45), 0.04, Math.sin(angle) * (innerRadius - 0.45));
        innerCurb.rotation.y = -angle + Math.PI / 2;
        curbGroup.add(innerCurb);

        // Outer curb
        const outerCurb = new THREE.Mesh(curbBoxGeo, mat);
        outerCurb.position.set(Math.cos(angle) * (outerRadius + 0.45), 0.04, Math.sin(angle) * (outerRadius + 0.45));
        outerCurb.rotation.y = -angle + Math.PI / 2;
        curbGroup.add(outerCurb);
    }

    // Starting grid lines & checkered finish line
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let g = 0; g < 12; g++) {
        const gridBox = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.4), gridMat);
        gridBox.rotateX(-Math.PI / 2);
        const gAngle = (g * 0.035);
        const r = 85 + (g % 2 === 0 ? 8 : -8);
        gridBox.position.set(Math.cos(gAngle) * r, 0.012, Math.sin(gAngle) * r);
        gridBox.rotation.y = -gAngle;
        curbGroup.add(gridBox);
    }

    silverstoneTrackGroup.add(curbGroup);

    // 3. Tyre smoke particle system
    smokeGeo = new THREE.BufferGeometry();
    for (let i = 0; i < SMOKE_COUNT; i++) {
        smokePositions[i * 3] = 0;
        smokePositions[i * 3 + 1] = -100;
        smokePositions[i * 3 + 2] = 0;
        smokeAges[i] = 999;
        smokeLifespans[i] = 1.0;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    
    // Canvas smoke texture for circular soft particle
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 64;
    smokeCanvas.height = 64;
    const sctx = smokeCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(230, 230, 235, 0.75)');
    grad.addColorStop(0.5, 'rgba(210, 210, 220, 0.35)');
    grad.addColorStop(1, 'rgba(180, 180, 190, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const smokeTex = new THREE.CanvasTexture(smokeCanvas);

    const smokeMat = new THREE.PointsMaterial({
        size: 0.95,
        map: smokeTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.NormalBlending
    });
    smokeParticles = new THREE.Points(smokeGeo, smokeMat);
    silverstoneTrackGroup.add(smokeParticles);

    scene.add(silverstoneTrackGroup);
    silverstoneTrackGroup.visible = false;
}

function emitTyreSmoke(x, y, z) {
    if (!smokeGeo) return;
    const i = smokeIndex % SMOKE_COUNT;
    smokeIndex++;
    smokePositions[i * 3] = x + (Math.random() - 0.5) * 0.25;
    smokePositions[i * 3 + 1] = y + 0.08;
    smokePositions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.25;
    smokeVelocities[i * 3] = (Math.random() - 0.5) * 0.8;
    smokeVelocities[i * 3 + 1] = 0.5 + Math.random() * 0.5;
    smokeVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    smokeAges[i] = 0;
    smokeLifespans[i] = 0.6 + Math.random() * 0.4;
}

function updateTyreSmoke(dt) {
    if (!smokeGeo) return;
    let hasActive = false;
    for (let i = 0; i < SMOKE_COUNT; i++) {
        if (smokeAges[i] < smokeLifespans[i]) {
            smokeAges[i] += dt;
            smokePositions[i * 3] += smokeVelocities[i * 3] * dt;
            smokePositions[i * 3 + 1] += smokeVelocities[i * 3 + 1] * dt;
            smokePositions[i * 3 + 2] += smokeVelocities[i * 3 + 2] * dt;
            hasActive = true;
        } else {
            smokePositions[i * 3 + 1] = -100;
        }
    }
    if (hasActive) {
        smokeGeo.attributes.position.needsUpdate = true;
    }
}

function updateDriveSimulator(dt) {
    if (!carModel) return;

    // 1. Steering target from keys or touch
    targetSteer = 0;
    if (driveKeys.left) targetSteer += 1;
    if (driveKeys.right) targetSteer -= 1;

    // Smooth steering input
    simSteer += (targetSteer - simSteer) * Math.min(1, 12 * dt);

    // Front wheels steering turn
    frontWheelMeshes.forEach(wheel => {
        wheel.rotation.y = -simSteer * 0.44;
    });

    // 2. Throttle & Braking
    const prevSpeed = simSpeed;
    let isBraking = false;

    if (driveKeys.forward) {
        // Aston Martin DBS Superleggera 5.2L Twin-Turbo V12 acceleration curve
        const powerCurve = Math.max(0.18, 1 - (simSpeed / 345));
        const accelRate = 29.5 * powerCurve;
        simSpeed += accelRate * dt;
    } else if (driveKeys.backward) {
        if (simSpeed > 4) {
            // Brembo Carbon Ceramic brakes
            simSpeed -= 58.0 * dt;
            isBraking = true;
        } else {
            // Reverse gear
            simSpeed -= 16.0 * dt;
            if (simSpeed < -42) simSpeed = -42;
        }
    } else {
        // Engine braking & aerodynamic drag
        const drag = (0.00062 * simSpeed * simSpeed) + 3.8;
        if (simSpeed > 0) {
            simSpeed = Math.max(0, simSpeed - drag * dt);
        } else if (simSpeed < 0) {
            simSpeed = Math.min(0, simSpeed + drag * dt);
        }
    }

    // Top speed clamp
    if (simSpeed > 340) simSpeed = 340;

    // 3. Dynamic Yaw / Turning Heading
    if (Math.abs(simSpeed) > 0.5) {
        const turnSpeed = (simSpeed / 48) * simSteer * 1.55 * dt;
        simHeading += (simSpeed >= 0 ? turnSpeed : -turnSpeed);
        carModel.rotation.y = simHeading;
    }

    // 4. Position movement
    const distMeters = (simSpeed / 3.6) * dt;
    carModel.position.x += Math.sin(simHeading) * distMeters;
    carModel.position.z += Math.cos(simHeading) * distMeters;

    // 5. Wheel Spin
    const spinFactor = (simSpeed / 3.6) * dt * 3.6;
    wheelMeshes.forEach(wheel => {
        wheel.rotation.x += spinFactor;
    });

    // 6. Tyre Smoke triggering
    const isHardLaunch = driveKeys.forward && Math.abs(simSpeed) < 70;
    const isSlide = Math.abs(simSteer) > 0.35 && simSpeed > 55;
    if (isHardLaunch || (isBraking && simSpeed > 60) || isSlide) {
        rearWheelMeshes.forEach(w => {
            const wPos = new THREE.Vector3();
            w.getWorldPosition(wPos);
            emitTyreSmoke(wPos.x, wPos.y, wPos.z);
        });
    }
    updateTyreSmoke(dt);

    // 7. Dynamic G-Force & Gear calculation
    const accelOrDecel = (simSpeed - prevSpeed) / Math.max(0.001, dt);
    const longG = accelOrDecel / 30;
    const latG = (simSteer * (simSpeed / 100)) * 1.15;
    const resultantG = Math.min(1.85, 1.0 + Math.sqrt(latG * latG + longG * longG));

    // ZF 8-Speed Touchtronic III
    let gear = '1';
    const absSpd = Math.abs(simSpeed);
    if (simSpeed < -1) gear = 'R';
    else if (absSpd < 1) gear = 'N';
    else if (absSpd < 62) gear = '1';
    else if (absSpd < 104) gear = '2';
    else if (absSpd < 148) gear = '3';
    else if (absSpd < 196) gear = '4';
    else if (absSpd < 246) gear = '5';
    else if (absSpd < 290) gear = '6';
    else if (absSpd < 322) gear = '7';
    else gear = '8';

    if (gear !== currentGear) {
        if (currentGear !== 'N' && gear !== 'R' && gear !== 'N') {
            engineSystem.playGearshiftPop();
        }
        currentGear = gear;
    }

    // RPM mapping for V12 sound
    if (engineSystem) {
        if (!engineSystem.isRunning) engineSystem.start();
        let targetRpm = 850;
        if (typeof gear === 'string' && gear !== 'N' && gear !== 'R') {
            const gearNum = parseInt(gear);
            const gearMins = [0, 0, 62, 104, 148, 196, 246, 290, 322];
            const gearMaxs = [0, 62, 104, 148, 196, 246, 290, 322, 340];
            const minS = gearMins[gearNum];
            const maxS = gearMaxs[gearNum];
            const ratio = Math.max(0, Math.min(1, (absSpd - minS) / (maxS - minS)));
            targetRpm = 2200 + ratio * 4700;
        } else if (gear === 'R') {
            targetRpm = 1800 + (absSpd / 42) * 2800;
        }
        engineSystem.targetRpm = targetRpm;
    }

    // 8. Third-person Chase Camera
    const camDist = 5.4 + (absSpd / 340) * 1.8;
    const camHeight = 1.65 - (absSpd / 340) * 0.35;
    const targetCamX = carModel.position.x - Math.sin(simHeading) * camDist;
    const targetCamZ = carModel.position.z - Math.cos(simHeading) * camDist;
    const targetCamY = carModel.position.y + camHeight;

    camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.14);
    camera.lookAt(carModel.position.x, carModel.position.y + 0.6, carModel.position.z);

    // 9. Update HUD elements
    if (driveHudSpeed) driveHudSpeed.textContent = Math.round(absSpd);
    if (driveHudGear) driveHudGear.textContent = currentGear;
    if (driveHudGforce) driveHudGforce.textContent = resultantG.toFixed(2) + ' G';

    // Lap timer
    if (driveHudLap && simLapStartTime > 0) {
        const elapsed = (performance.now() - simLapStartTime) / 1000;
        const mins = Math.floor(elapsed / 60);
        const secs = Math.floor(elapsed % 60);
        const millis = Math.floor((elapsed % 1) * 100);
        driveHudLap.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
    }
}

function openSimulatorMode() {
    isDriveMode = true;
    isHighwayMode = false;
    isStudioOpen = false;
    if (isShowcaseTour) toggleShowcaseTour();

    if (studioDropdown) studioDropdown.classList.remove('active');
    if (studioModal) studioModal.classList.remove('active');
    closeMobileNav();
    lenis.stop();

    if (driveSimulatorHud) {
        driveSimulatorHud.classList.add('active');
        driveSimulatorHud.setAttribute('aria-hidden', 'false');
    }

    initSilverstoneTrack();
    if (silverstoneTrackGroup) silverstoneTrackGroup.visible = true;

    if (carModel) {
        carModel.position.set(0, carBaseY, 0);
        carModel.rotation.set(0, 0, 0);
    }
    simSpeed = 0;
    simSteer = 0;
    simHeading = 0;
    simLapStartTime = performance.now();
    currentGear = 'N';

    camera.position.set(0, carBaseY + 1.65, -5.4);
    camera.lookAt(0, carBaseY + 0.6, 0);

    engineSystem.start();
}

function exitSimulatorMode() {
    isDriveMode = false;
    if (driveSimulatorHud) {
        driveSimulatorHud.classList.remove('active');
        driveSimulatorHud.setAttribute('aria-hidden', 'true');
    }
    if (silverstoneTrackGroup) {
        silverstoneTrackGroup.visible = false;
    }

    frontWheelMeshes.forEach(w => w.rotation.y = 0);

    if (carModel) {
        carModel.position.set(0, carBaseY, 0);
        carModel.rotation.set(0, 0, 0);
    }

    openStudioModal();
}

// Keyboard controls for Silverstone Simulator
window.addEventListener('keydown', (e) => {
    if (!isDriveMode) return;
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') driveKeys.forward = true;
    if (key === 's' || key === 'arrowdown') driveKeys.backward = true;
    if (key === 'a' || key === 'arrowleft') driveKeys.left = true;
    if (key === 'd' || key === 'arrowright') driveKeys.right = true;
});

window.addEventListener('keyup', (e) => {
    if (!isDriveMode) return;
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') driveKeys.forward = false;
    if (key === 's' || key === 'arrowdown') driveKeys.backward = false;
    if (key === 'a' || key === 'arrowleft') driveKeys.left = false;
    if (key === 'd' || key === 'arrowright') driveKeys.right = false;
});

// Touch controls for mobile / tablet
function setupTouchButton(el, onPress, onRelease) {
    if (!el) return;
    const startHandler = (e) => {
        e.preventDefault();
        el.classList.add('pressed');
        onPress();
    };
    const endHandler = (e) => {
        e.preventDefault();
        el.classList.remove('pressed');
        onRelease();
    };
    el.addEventListener('pointerdown', startHandler);
    el.addEventListener('pointerup', endHandler);
    el.addEventListener('pointercancel', endHandler);
    el.addEventListener('pointerleave', endHandler);
}

setupTouchButton(touchSteerLeft, () => { driveKeys.left = true; }, () => { driveKeys.left = false; });
setupTouchButton(touchSteerRight, () => { driveKeys.right = true; }, () => { driveKeys.right = false; });
setupTouchButton(touchPedalBrake, () => { driveKeys.backward = true; }, () => { driveKeys.backward = false; });
setupTouchButton(touchPedalGas, () => { driveKeys.forward = true; }, () => { driveKeys.forward = false; });

if (btnStudioSimulator) {
    btnStudioSimulator.addEventListener('click', (e) => {
        e.preventDefault();
        openSimulatorMode();
    });
}
if (btnExitDrive) {
    btnExitDrive.addEventListener('click', (e) => {
        e.preventDefault();
        exitSimulatorMode();
    });
}

// ==========================================
// 20. MIDNIGHT HIGHWAY CRUISE: MINIMALIST & SPECTACULAR
// ==========================================
let highwayGroup = null;
let highwayRoadTex = null;
const highwayLampPosts = [];
let currentHighwaySpeed = 300;
let targetHighwaySpeed = 300;
let isHighwayBoost = false;
let highwayCameraMode = 'chase'; // 'chase', 'hood', 'drone'
let isHighwayAeroActive = true;
const defaultHighwayCameraFov = 45;

// Aero slipstream lines & particles
let highwayAeroLines = null;
let highwayAeroPositions = null;
let highwayAeroData = [];
const AERO_STREAK_COUNT = 140;

// Peripheral speed warp lines
let highwayWarpLines = null;
let highwayWarpPositions = null;
let highwayWarpData = [];
const WARP_LINE_COUNT = 60;

// Environment memory
let prevHighwayFog = null;
let prevHighwayBg = null;

const highwayCruiseHud = document.getElementById('highway-cruise-hud');
const highwayVignette = document.getElementById('highway-vignette');
const btnStudioHighway = document.getElementById('btn-studio-highway');
const btnExitHighway = document.getElementById('btn-exit-highway');

// Telemetry & Control Elements
const hwSpeedVal = document.getElementById('hw-speed-val');
const hwTachoFill = document.getElementById('hw-tacho-fill');
const hwGearVal = document.getElementById('hw-gear-val');
const hwRpmVal = document.getElementById('hw-rpm-val');
const hwBoostVal = document.getElementById('hw-boost-val');
const hwDownforceVal = document.getElementById('hw-downforce-val');
const hwBoostTag = document.getElementById('hw-boost-tag');
const hwStabilityVal = document.getElementById('hw-stability-val');
const hwToggleAeroBtn = document.getElementById('hw-toggle-aero');
const hwAeroText = document.getElementById('hw-aero-text');
const hwBtnBoost = document.getElementById('hw-btn-boost');
const hwBoostBtnText = document.getElementById('hw-boost-btn-text');
const hwCamButtons = document.querySelectorAll('.hw-cam-btn');

function initHighwayEnvironment() {
    if (highwayGroup) return;
    highwayGroup = new THREE.Group();
    highwayGroup.name = 'midnightHighway';

    // 1. Procedural 4-lane Highway Road Texture with Reflective Asphalt
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 1024;
    const rctx = roadCanvas.getContext('2d');

    rctx.fillStyle = '#080a0f';
    rctx.fillRect(0, 0, 512, 1024);

    // Asphalt surface noise
    for (let i = 0; i < 22000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 1024;
        const c = 12 + Math.floor(Math.random() * 16);
        rctx.fillStyle = `rgb(${c},${c},${c})`;
        rctx.fillRect(x, y, 2, 2);
    }

    // Outer solid golden-amber lines with glow
    rctx.fillStyle = '#ffb330';
    rctx.fillRect(16, 0, 8, 1024);
    rctx.fillRect(488, 0, 8, 1024);

    // Inner dashed lines (reflective crystal white)
    rctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const dashLanes = [134, 256, 378];
    dashLanes.forEach(laneX => {
        for (let y = 0; y < 1024; y += 96) {
            rctx.fillRect(laneX - 3, y, 6, 48);
        }
    });

    highwayRoadTex = new THREE.CanvasTexture(roadCanvas);
    highwayRoadTex.wrapS = THREE.RepeatWrapping;
    highwayRoadTex.wrapT = THREE.RepeatWrapping;
    highwayRoadTex.repeat.set(1, 14);

    const roadGeo = new THREE.PlaneGeometry(26, 400);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
        map: highwayRoadTex,
        roughness: 0.52,
        metalness: 0.48
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, -0.01, 40);
    roadMesh.receiveShadow = true;
    highwayGroup.add(roadMesh);

    // Guardrails with specular dark chrome finish
    const railMat = new THREE.MeshStandardMaterial({ color: 0x363b46, metalness: 0.92, roughness: 0.18 });
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 400), railMat);
    leftRail.position.set(-13.1, 0.35, 40);
    const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 400), railMat);
    rightRail.position.set(13.1, 0.35, 40);
    highwayGroup.add(leftRail);
    highwayGroup.add(rightRail);

    // Overhead Streetlights
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x1f2229, metalness: 0.9, roughness: 0.2 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffeaad });

    for (let i = 0; i < 14; i++) {
        const postGroup = new THREE.Group();
        const z = -70 + i * 32;

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 6.8, 8), lampMat);
        pole.position.set(-13.8, 3.4, 0);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.12), lampMat);
        arm.position.set(-12.0, 6.6, 0);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.38), lampGlowMat);
        bulb.position.set(-10.2, 6.5, 0);

        postGroup.add(pole);
        postGroup.add(arm);
        postGroup.add(bulb);
        postGroup.position.z = z;

        highwayGroup.add(postGroup);
        highwayLampPosts.push(postGroup);
    }

    // 2. Supersonic Aerodynamic Slipstream Flow System (Aero Run)
    const aeroGeo = new THREE.BufferGeometry();
    const aeroPos = new Float32Array(AERO_STREAK_COUNT * 2 * 3);
    const aeroCols = new Float32Array(AERO_STREAK_COUNT * 2 * 3);

    highwayAeroData = [];
    for (let i = 0; i < AERO_STREAK_COUNT; i++) {
        const lane = (Math.random() - 0.5) * 1.85;
        const heightZone = Math.random();
        let startY = 0.5;
        if (heightZone < 0.25) startY = 0.22 + Math.random() * 0.18; // Splitter & rocker
        else if (heightZone < 0.7) startY = 0.55 + Math.random() * 0.35; // Hood & flank
        else startY = 0.95 + Math.random() * 0.38; // Roof & Aeroblade

        const startZ = -4.0 + Math.random() * 7.5;
        const length = 0.8 + Math.random() * 1.8;
        const speedMultiplier = 0.95 + Math.random() * 0.45;

        // Palette: ice cyan, gold, or bright laser white
        const colRand = Math.random();
        let r = 0, g = 0.94, b = 1.0; // Cyan
        if (colRand < 0.3) {
            r = 0.83; g = 0.69; b = 0.22; // Aston Gold
        } else if (colRand > 0.75) {
            r = 1.0; g = 1.0; b = 1.0; // White
        }

        highwayAeroData.push({
            x: lane,
            baseY: startY,
            z: startZ,
            len: length,
            speed: speedMultiplier,
            r, g, b
        });

        const idx = i * 6;
        aeroCols[idx] = r; aeroCols[idx + 1] = g; aeroCols[idx + 2] = b;
        aeroCols[idx + 3] = r * 0.2; aeroCols[idx + 4] = g * 0.2; aeroCols[idx + 5] = b * 0.2;
    }

    aeroGeo.setAttribute('position', new THREE.BufferAttribute(aeroPos, 3));
    aeroGeo.setAttribute('color', new THREE.BufferAttribute(aeroCols, 3));

    const aeroMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    highwayAeroLines = new THREE.LineSegments(aeroGeo, aeroMat);
    highwayAeroPositions = aeroPos;
    highwayAeroLines.position.x = 2.8;
    highwayGroup.add(highwayAeroLines);

    // 3. Peripheral Roadside Speed Warp Streaks
    const warpGeo = new THREE.BufferGeometry();
    const warpPos = new Float32Array(WARP_LINE_COUNT * 2 * 3);
    const warpCols = new Float32Array(WARP_LINE_COUNT * 2 * 3);

    highwayWarpData = [];
    for (let i = 0; i < WARP_LINE_COUNT; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (12.0 + Math.random() * 1.8);
        const y = 0.2 + Math.random() * 2.5;
        const z = -60 + Math.random() * 320;
        const len = 8.0 + Math.random() * 18.0;

        let r = 1.0, g = 0.8, b = 0.3; // Warm streetlight reflection
        if (side > 0) {
            r = 0.9; g = 0.15; b = 0.2; // Red guardrail reflector
        }

        highwayWarpData.push({ x, y, z, len, side });

        const idx = i * 6;
        warpCols[idx] = r; warpCols[idx + 1] = g; warpCols[idx + 2] = b;
        warpCols[idx + 3] = r * 0.05; warpCols[idx + 4] = g * 0.05; warpCols[idx + 5] = b * 0.05;
    }

    warpGeo.setAttribute('position', new THREE.BufferAttribute(warpPos, 3));
    warpGeo.setAttribute('color', new THREE.BufferAttribute(warpCols, 3));

    const warpMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    highwayWarpLines = new THREE.LineSegments(warpGeo, warpMat);
    highwayWarpPositions = warpPos;
    highwayGroup.add(highwayWarpLines);

    // 4. Headlight Projector Cones onto Highway
    const beamGeo = new THREE.ConeGeometry(3.2, 28, 16, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, 14);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x99ddff,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const leftBeam = new THREE.Mesh(beamGeo, beamMat);
    leftBeam.position.set(2.8 - 0.72, 0.45, 1.8);
    const rightBeam = new THREE.Mesh(beamGeo, beamMat);
    rightBeam.position.set(2.8 + 0.72, 0.45, 1.8);
    highwayGroup.add(leftBeam);
    highwayGroup.add(rightBeam);

    // 5. Taillight Red Glow Quad
    const tailGlowGeo = new THREE.PlaneGeometry(2.4, 1.2);
    const tailGlowMat = new THREE.MeshBasicMaterial({
        color: 0xff0028,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const tailGlow = new THREE.Mesh(tailGlowGeo, tailGlowMat);
    tailGlow.rotation.x = -Math.PI / 2;
    tailGlow.position.set(2.8, 0.05, -2.4);
    highwayGroup.add(tailGlow);

    scene.add(highwayGroup);
    highwayGroup.visible = false;
}

function openHighwayMode() {
    isHighwayMode = true;
    isDriveMode = false;
    isStudioOpen = false;
    if (isShowcaseTour) toggleShowcaseTour();

    if (studioDropdown) studioDropdown.classList.remove('active');
    if (studioModal) studioModal.classList.remove('active');
    closeMobileNav();
    lenis.stop();

    if (highwayCruiseHud) {
        highwayCruiseHud.classList.add('active');
        highwayCruiseHud.setAttribute('aria-hidden', 'false');
    }

    initHighwayEnvironment();
    if (highwayGroup) highwayGroup.visible = true;

    // Save prior environment
    prevHighwayFog = scene.fog;
    prevHighwayBg = scene.background ? scene.background.clone() : null;

    // Deep midnight atmosphere with wet reflective road glow
    scene.background = new THREE.Color(0x04060b);
    scene.fog = new THREE.FogExp2(0x05070e, 0.012);

    if (carModel) {
        carModel.position.set(2.8, carBaseY, 0);
        carModel.rotation.set(0, 0, 0);
    }

    currentHighwaySpeed = 300;
    targetHighwaySpeed = 300;
    isHighwayBoost = false;
    highwayCameraMode = 'chase';

    // Update active camera button
    hwCamButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cam === 'chase');
    });

    if (engineSystem) {
        engineSystem.start();
        engineSystem.targetRpm = 5400;
    }
    if (btnStopEngine) {
        btnStopEngine.textContent = 'STOP';
        btnStopEngine.classList.remove('engine-stopped');
    }
    if (tachoHud) {
        tachoHud.classList.add('active');
        tachoHud.setAttribute('aria-hidden', 'false');
    }
    setHeadlights(true);
}

// Full exit back to the Studio configurator (DISENGAGE button / ESC).
function exitHighwayMode() {
    isHighwayMode = false;
    isHighwayBoost = false;
    targetHighwaySpeed = 300;
    if (btnStopEngine) {
        btnStopEngine.textContent = 'STOP';
        btnStopEngine.classList.remove('engine-stopped');
    }

    if (highwayCruiseHud) {
        highwayCruiseHud.classList.remove('active');
        highwayCruiseHud.setAttribute('aria-hidden', 'true');
    }
    if (highwayGroup) {
        highwayGroup.visible = false;
    }

    // Restore prior environment
    if (prevHighwayBg) scene.background = prevHighwayBg;
    if (prevHighwayFog) scene.fog = prevHighwayFog;

    // Reset camera FOV
    camera.fov = defaultHighwayCameraFov;
    camera.updateProjectionMatrix();

    if (carModel) {
        carModel.position.set(0, carBaseY, 0);
        carModel.rotation.set(0, 0, 0);
    }

    if (engineSystem && engineSystem.isRunning) {
        engineSystem.stop();
    }

    if (tachoHud) {
        tachoHud.classList.remove('active');
        tachoHud.setAttribute('aria-hidden', 'true');
    }

    openStudioModal();
}

function engageHighwayBoost() {
    if (!isHighwayMode) return;
    isHighwayBoost = true;
    targetHighwaySpeed = 340;
    if (btnStopEngine) {
        btnStopEngine.textContent = 'STOP';
        btnStopEngine.classList.remove('engine-stopped');
    }
    if (hwBtnBoost) {
        hwBtnBoost.classList.add('active');
        if (hwBoostBtnText) hwBoostBtnText.textContent = '340 KM/H V-MAX ACTIVE';
    }
    if (hwBoostTag) hwBoostTag.classList.add('active');
    if (hwStabilityVal) hwStabilityVal.textContent = 'V-MAX OVERBOOST';

    if (engineSystem) {
        engineSystem.targetRpm = 6500;
        engineSystem.playGearshiftPop();
    }
}

function disengageHighwayBoost() {
    if (!isHighwayMode) return;
    isHighwayBoost = false;
    if (targetHighwaySpeed > 0) {
        targetHighwaySpeed = 300;
    }
    if (hwBtnBoost) {
        hwBtnBoost.classList.remove('active');
        if (hwBoostBtnText) hwBoostBtnText.textContent = 'V-MAX BOOST 340 KM/H';
    }
    if (hwBoostTag) hwBoostTag.classList.remove('active');
    if (hwStabilityVal) hwStabilityVal.textContent = 'ACTIVE AERO';

    if (engineSystem && targetHighwaySpeed > 0) {
        engineSystem.targetRpm = 5400;
    }
}

function updateHighwayCruise(dt) {
    if (!carModel) return;

    // Interpolate speed towards target: confident carbon ceramic braking deceleration
    const isBraking = targetHighwaySpeed < currentHighwaySpeed;
    const speedLerp = isBraking ? 2.6 : (isHighwayBoost ? 4.0 : 3.0);
    currentHighwaySpeed += (targetHighwaySpeed - currentHighwaySpeed) * Math.min(1.0, dt * speedLerp);
    if (targetHighwaySpeed === 0 && currentHighwaySpeed < 0.4) {
        currentHighwaySpeed = 0;
    }
    const speed = currentHighwaySpeed;
    const isStopped = speed < 1.0;
    const streamDist = (speed / 3.6) * dt;

    // Sync V12 audio engine RPM with cruising speed when not manually revving
    if (engineSystem && engineSystem.isRunning && !engineSystem.isRevving) {
        if (isStopped) {
            engineSystem.targetRpm = 850;
        } else {
            const cruiseTargetRpm = 850 + (speed / 300) * (isHighwayBoost ? 5650 : 4550);
            engineSystem.targetRpm = cruiseTargetRpm;
        }
    }

    // 1. Stream road texture offset
    if (highwayRoadTex && speed > 0.05) {
        highwayRoadTex.offset.y -= streamDist * 0.035;
    }

    // 2. Stream streetlight posts backwards
    if (speed > 0.05) {
        highwayLampPosts.forEach(post => {
            post.position.z -= streamDist;
            if (post.position.z < -70) {
                post.position.z += 14 * 32;
            }
        });
    }

    // 3. Fast spinning wheels
    if (speed > 0.05) {
        const wheelRotSpeed = (speed / 300) * 28.0;
        wheelMeshes.forEach(w => {
            w.rotation.x += wheelRotSpeed * dt;
        });
    }

    // 4. Subtle suspension float and high speed downforce squat
    const t = performance.now() * 0.001;
    const squat = Math.max(0, (speed - 300) / 40 * 0.012); // -12mm aero downforce squat only at speed
    const idleVib = isStopped ? 0.0008 : 0.0025;
    carModel.position.y = carBaseY - squat + Math.sin(t * 19) * idleVib;

    // 5. Update Aero Slipstream Streamlines
    if (highwayAeroLines && highwayAeroPositions) {
        highwayAeroLines.visible = isHighwayAeroActive && speed > 15;
        if (highwayAeroLines.visible) {
            const aeroSpeed = streamDist * 1.35;
            for (let i = 0; i < AERO_STREAK_COUNT; i++) {
                const item = highwayAeroData[i];
                item.z -= aeroSpeed * item.speed;

                // Loop back to front
                if (item.z < -5.5) {
                    item.z = 2.4 + Math.random() * 1.2;
                    item.x = (Math.random() - 0.5) * 1.85;
                }

                // Contour Y coordinate dynamically based on DBS Superleggera profile
                let y = item.baseY;
                if (item.z > 0.8) {
                    y = Math.min(y, 0.35 + (item.z - 0.8) * 0.15);
                } else if (item.z > -0.8) {
                    y = Math.min(y + 0.1, 1.22);
                } else if (item.z > -2.0) {
                    y = Math.max(0.45, y - (item.z + 0.8) * 0.2);
                } else {
                    y += Math.sin(t * 12 + i) * 0.02;
                }

                const headZ = item.z;
                const tailZ = item.z + item.len * (speed / 300);

                const idx = i * 6;
                highwayAeroPositions[idx] = item.x;
                highwayAeroPositions[idx + 1] = y;
                highwayAeroPositions[idx + 2] = headZ;

                highwayAeroPositions[idx + 3] = item.x;
                highwayAeroPositions[idx + 4] = y + 0.02;
                highwayAeroPositions[idx + 5] = tailZ;
            }
            highwayAeroLines.geometry.attributes.position.needsUpdate = true;
        }
    }

    // 6. Update Peripheral Warp Lines
    if (highwayWarpLines && highwayWarpPositions) {
        highwayWarpLines.visible = speed > 35;
        if (highwayWarpLines.visible) {
            const warpSpeed = streamDist;
            for (let i = 0; i < WARP_LINE_COUNT; i++) {
                const item = highwayWarpData[i];
                item.z -= warpSpeed * 1.05;
                if (item.z < -70) {
                    item.z = 300 + Math.random() * 50;
                }

                const idx = i * 6;
                highwayWarpPositions[idx] = item.x;
                highwayWarpPositions[idx + 1] = item.y;
                highwayWarpPositions[idx + 2] = item.z;

                highwayWarpPositions[idx + 3] = item.x;
                highwayWarpPositions[idx + 4] = item.y;
                highwayWarpPositions[idx + 5] = item.z + item.len * (speed / 300);
            }
            highwayWarpLines.geometry.attributes.position.needsUpdate = true;
        }
    }

    // 7. Dynamic Camera Views
    const shakeAmount = 0.006 * (speed / 300);
    const shakeX = (Math.random() - 0.5) * shakeAmount;
    const shakeY = (Math.random() - 0.5) * shakeAmount;

    if (highwayCameraMode === 'chase') {
        const orbitAngle = Math.sin(t * 0.35) * 0.22;
        camera.position.x = 2.8 + Math.sin(-0.45 + orbitAngle) * 5.4 + shakeX;
        camera.position.y = 1.08 + shakeY;
        camera.position.z = -4.9;
        camera.lookAt(2.8, carBaseY + 0.55, 1.5);

    } else if (highwayCameraMode === 'hood') {
        // Pilot POV looking out over twin bonnet extractors
        camera.position.x = 2.8 - 0.35 + shakeX * 0.4;
        camera.position.y = 1.16 + shakeY * 0.4;
        camera.position.z = 0.32;
        camera.lookAt(2.8, 1.02, 35);

    } else if (highwayCameraMode === 'drone') {
        // Fixed elevated cinematic 3/4 angle — holds position, doesn't orbit
        const angle = -0.6;
        const dist = 5.6;
        camera.position.x = 2.8 + Math.cos(angle) * dist + shakeX;
        camera.position.y = 1.35 + shakeY;
        camera.position.z = Math.sin(angle) * dist;
        camera.lookAt(2.8, carBaseY + 0.55, 0);
    }

    // Camera FOV dynamic stretch during V-Max Boost
    const targetFov = isHighwayBoost ? 53 : defaultHighwayCameraFov;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1.0, dt * 5.0);
        camera.updateProjectionMatrix();
    }

    // 8. Update HUD Telemetry
    if (hwSpeedVal) {
        hwSpeedVal.textContent = Math.round(speed);
        hwSpeedVal.classList.toggle('is-boosting', isHighwayBoost);
    }
    if (hwTachoFill) {
        const pct = isStopped ? 0 : Math.min(100, Math.max(8, ((speed - 50) / 290) * 100));
        hwTachoFill.style.width = `${pct}%`;
    }
    if (hwRpmVal) {
        const displayRpm = isStopped 
            ? (engineSystem ? engineSystem.currentRpm : 850) 
            : (isHighwayBoost ? (6100 + (speed - 300) * 12) : (1200 + (speed / 300) * 4200));
        hwRpmVal.textContent = Math.round(displayRpm).toLocaleString();
    }
    if (hwGearVal) {
        let gear = '7TH';
        if (isStopped) gear = 'N';
        else if (speed < 45) gear = '1ST';
        else if (speed < 90) gear = '2ND';
        else if (speed < 140) gear = '3RD';
        else if (speed < 190) gear = '4TH';
        else if (speed < 240) gear = '5TH';
        else if (speed < 285) gear = '6TH';
        else if (speed > 325) gear = '8TH';
        hwGearVal.textContent = gear;
    }
    if (hwBoostVal) {
        const boost = isStopped ? 0 : Math.max(0, 1.45 * (speed / 300) + (isHighwayBoost ? 0.35 : 0));
        hwBoostVal.textContent = boost.toFixed(2);
    }
    if (hwDownforceVal) {
        const df = isStopped ? 0 : Math.round(180 * Math.pow(Math.min(1.2, speed / 300), 2));
        hwDownforceVal.textContent = `${df} KG DOWNFORCE`;
    }
    const hwBadgeSub = document.getElementById('hw-badge-sub') || document.querySelector('.hw-badge-sub');
    if (hwBadgeSub) {
        if (isStopped) {
            hwBadgeSub.textContent = 'STANDBY // 0 KM/H';
        } else if (isHighwayBoost) {
            hwBadgeSub.textContent = '340 KM/H V-MAX OVERBOOST';
        } else {
            hwBadgeSub.textContent = '300 KM/H AERO RUN';
        }
    }
    if (highwayVignette) {
        highwayVignette.classList.toggle('boost-active', isHighwayBoost);
    }
}

// Camera selectors
hwCamButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cam = btn.dataset.cam;
        if (!cam) return;
        highwayCameraMode = cam;
        hwCamButtons.forEach(b => b.classList.toggle('active', b === btn));
    });
});

// Toggle Aero Slipstream
if (hwToggleAeroBtn) {
    hwToggleAeroBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isHighwayAeroActive = !isHighwayAeroActive;
        hwToggleAeroBtn.classList.toggle('active', isHighwayAeroActive);
        if (hwAeroText) {
            hwAeroText.textContent = isHighwayAeroActive ? 'Aero Flow: ON' : 'Aero Flow: OFF';
        }
    });
}

// Boost button interactions (click or hold)
if (hwBtnBoost) {
    hwBtnBoost.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        engageHighwayBoost();
    });
    window.addEventListener('pointerup', () => {
        if (isHighwayBoost) disengageHighwayBoost();
    });
}

// Keyboard shortcuts for Highway Mode (Space / W / Esc)
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        engineSystem.toggleMute();
    }
    if (!isHighwayMode) return;
    if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.key === 'ArrowUp') {
        if (!isHighwayBoost) engageHighwayBoost();
    }
});

window.addEventListener('keyup', (e) => {
    if (!isHighwayMode) return;
    if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.key === 'ArrowUp') {
        if (isHighwayBoost) disengageHighwayBoost();
    }
});

if (btnStudioHighway) {
    btnStudioHighway.addEventListener('click', (e) => {
        e.preventDefault();
        openHighwayMode();
    });
}
const btnSidebarHighwayLaunch = document.getElementById('btn-sidebar-highway-launch');
if (btnSidebarHighwayLaunch) {
    btnSidebarHighwayLaunch.addEventListener('click', (e) => {
        e.preventDefault();
        openHighwayMode();
    });
}
if (btnExitHighway) {
    btnExitHighway.addEventListener('click', (e) => {
        e.preventDefault();
        exitHighwayMode();
    });
}

// ==========================================
// 21. AMR RACING LIVERIES & STRIPES
// ==========================================
const liveryCards = document.querySelectorAll('.livery-card');
const liveryTextureCache = new Map();

function generateLiveryTexture(type) {
    if (type === 'none') return null;
    if (liveryTextureCache.has(type)) return liveryTextureCache.get(type);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (type === 'amr-lime') {
        // AMR Le Mans Lime Racing Stripe
        ctx.clearRect(0, 0, 1024, 1024);
        
        ctx.fillStyle = '#cbe432';
        ctx.fillRect(462, 0, 100, 1024);

        ctx.fillStyle = '#111215';
        ctx.fillRect(458, 0, 4, 1024);
        ctx.fillRect(562, 0, 4, 1024);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(444, 0, 6, 1024);
        ctx.fillRect(574, 0, 6, 1024);

    } else if (type === 'heritage-white') {
        // British Heritage Twin Le Mans Stripes
        ctx.clearRect(0, 0, 1024, 1024);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(424, 0, 72, 1024);
        ctx.fillRect(528, 0, 72, 1024);

        ctx.fillStyle = '#d4af37';
        ctx.fillRect(412, 0, 5, 1024);
        ctx.fillRect(607, 0, 5, 1024);

    } else if (type === 'gulf-racing') {
        // Iconic Gulf Heritage Livery
        ctx.clearRect(0, 0, 1024, 1024);

        ctx.fillStyle = '#ff7800';
        ctx.fillRect(452, 0, 120, 1024);

        ctx.fillStyle = '#8bc3eb';
        ctx.fillRect(396, 0, 50, 1024);
        ctx.fillRect(578, 0, 50, 1024);

        ctx.fillStyle = '#0a1e3f';
        ctx.fillRect(390, 0, 6, 1024);
        ctx.fillRect(446, 0, 6, 1024);
        ctx.fillRect(572, 0, 6, 1024);
        ctx.fillRect(628, 0, 6, 1024);

    } else if (type === 'stealth-roof') {
        // Stealth Blackout Two-Tone Roof Wrap
        ctx.clearRect(0, 0, 1024, 1024);
        
        ctx.fillStyle = '#08080a';
        ctx.fillRect(350, 120, 324, 780);

        ctx.strokeStyle = '#cbe432';
        ctx.lineWidth = 8;
        ctx.strokeRect(350, 120, 324, 780);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    liveryTextureCache.set(type, tex);
    return tex;
}

function applyLivery(type) {
    currentLivery = type;
    const tex = generateLiveryTexture(type);

    paintMeshes.forEach(mesh => {
        if (mesh.material) {
            mesh.material.map = tex;
            mesh.material.needsUpdate = true;
        }
    });

    liveryCards.forEach(card => {
        if (card.getAttribute('data-livery') === type) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    const activeLiveryNameEl = document.getElementById('active-livery-name');
    if (activeLiveryNameEl) {
        const liveryNames = {
            clean: 'Factory Clean',
            none: 'Factory Clean',
            amr_lime: 'AMR Lime',
            'amr-lime': 'AMR Lime',
            heritage_white: 'Heritage',
            'heritage-white': 'Heritage',
            gulf: 'Gulf Pack',
            stealth: 'Blackout'
        };
        activeLiveryNameEl.textContent = liveryNames[type] || type;
    }
}

liveryCards.forEach(card => {
    card.addEventListener('click', () => {
        const liveryType = card.getAttribute('data-livery');
        applyLivery(liveryType);
    });
});

// ==========================================
// 22. ASTON MARTIN DYNAMIC DRIVE MODE SELECTOR
// ==========================================
const driveModeTabs = document.querySelectorAll('.drive-mode-tab');

function setDriveMode(mode) {
    currentDriveMode = mode;

    driveModeTabs.forEach(tab => {
        if (tab.getAttribute('data-mode') === mode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const activeDriveModeNameEl = document.getElementById('active-drive-mode-name');
    if (activeDriveModeNameEl) {
        const modeNames = { gt: 'GT Mode', sport: 'Sport Mode', track: 'Track Mode' };
        activeDriveModeNameEl.textContent = modeNames[mode] || mode.toUpperCase();
    }

    if (!carModel) return;

    let targetY = carBaseY;
    let tachoColor = '#d4af37';

    if (mode === 'gt') {
        targetY = carBaseY;
        tachoColor = '#d4af37';
    } else if (mode === 'sport') {
        targetY = carBaseY - 0.02; // -8mm lowered
        tachoColor = '#00e5ff';
        engineSystem.playGearshiftPop();
    } else if (mode === 'track') {
        targetY = carBaseY - 0.038; // -15mm lowered
        tachoColor = '#e50914';
        engineSystem.playGearshiftPop();
    }

    gsap.to(carModel.position, {
        y: targetY,
        duration: 0.6,
        ease: "power2.out"
    });

    if (tachoFill) {
        tachoFill.style.stroke = tachoColor;
    }
}

driveModeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        setDriveMode(mode);
    });
});

// ==========================================
// 23. TECHNICAL BENCHMARK COMPARATOR
// ==========================================
const benchmarkModal = document.getElementById('benchmark-modal');
const btnStudioBenchmark = document.getElementById('btn-studio-benchmark');
const modalBenchmarkClose = document.getElementById('modal-benchmark-close');
const benchCols = document.querySelectorAll('.benchmark-col');
const metricPowerVal = document.getElementById('metric-power-val');
const metricSprintVal = document.getElementById('metric-sprint-val');
const metricAeroVal = document.getElementById('metric-aero-val');

const benchmarkData = {
    'bench-col-dbs': {
        power: '715 BHP (Baseline)',
        sprint: '3.40s 0–100 km/h',
        aero: '180 kg Downforce at V-Max',
        bars: ['93%', '94%', '72%', '100%']
    },
    'bench-col-770': {
        power: '770 BHP (+55 BHP Delta)',
        sprint: '3.20s (-0.20s Delta)',
        aero: '250 kg Enhanced Downforce',
        bars: ['100%', '100%', '100%', '100%']
    },
    'bench-col-vantage': {
        power: '700 BHP (-15 BHP Delta)',
        sprint: '3.50s (+0.10s Delta)',
        aero: '150 kg Agile Downforce',
        bars: ['91%', '91%', '60%', '95%']
    }
};

function openBenchmarkModal() {
    if (!benchmarkModal) return;
    if (studioDropdown) studioDropdown.classList.remove('active');
    benchmarkModal.classList.add('active');
    benchmarkModal.setAttribute('aria-hidden', 'false');

    const fills = benchmarkModal.querySelectorAll('.metric-bar-fill');
    fills.forEach(fill => {
        const targetW = fill.style.width || '90%';
        fill.style.width = '0%';
        setTimeout(() => {
            fill.style.transition = 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
            fill.style.width = targetW;
        }, 80);
    });
}

function closeBenchmarkModal() {
    if (!benchmarkModal) return;
    benchmarkModal.classList.remove('active');
    benchmarkModal.setAttribute('aria-hidden', 'true');
}

if (btnStudioBenchmark) {
    btnStudioBenchmark.addEventListener('click', (e) => {
        e.preventDefault();
        openBenchmarkModal();
    });
}
if (modalBenchmarkClose) {
    modalBenchmarkClose.addEventListener('click', (e) => {
        e.preventDefault();
        closeBenchmarkModal();
    });
}
if (benchmarkModal) {
    benchmarkModal.addEventListener('click', (e) => {
        if (e.target === benchmarkModal) closeBenchmarkModal();
    });
}

benchCols.forEach(col => {
    col.addEventListener('click', () => {
        benchCols.forEach(c => c.classList.remove('active'));
        col.classList.add('active');

        const colId = col.id;
        const data = benchmarkData[colId];
        if (data) {
            if (metricPowerVal) metricPowerVal.textContent = data.power;
            if (metricSprintVal) metricSprintVal.textContent = data.sprint;
            if (metricAeroVal) metricAeroVal.textContent = data.aero;

            const fills = benchmarkModal.querySelectorAll('.metric-bar-fill');
            fills.forEach((fill, idx) => {
                if (data.bars[idx]) {
                    fill.style.width = data.bars[idx];
                }
            });
        }
    });
});

// ==========================================
// 24. DRAGGABLE STUDIO SETTINGS PANEL
// ==========================================
const studioSidebarPanel = document.getElementById('studio-sidebar');
const sidebarDragHandle = document.getElementById('sidebar-drag-handle');
const btnResetDock = document.getElementById('btn-reset-dock');

let isDraggingSidebar = false;
let sidebarStartX = 0;
let sidebarStartY = 0;
let sidebarInitLeft = 0;
let sidebarInitTop = 0;

if (sidebarDragHandle && studioSidebarPanel) {
    sidebarDragHandle.addEventListener('pointerdown', (e) => {
        // Ignore drag when clicking action buttons inside the header
        if (e.target.closest('button')) return;

        isDraggingSidebar = true;
        sidebarDragHandle.classList.add('is-dragging');
        studioSidebarPanel.classList.add('is-floating');

        const rect = studioSidebarPanel.getBoundingClientRect();
        sidebarInitLeft = rect.left;
        sidebarInitTop = rect.top;
        sidebarStartX = e.clientX;
        sidebarStartY = e.clientY;

        // Convert positioning to absolute left/top
        studioSidebarPanel.style.left = `${sidebarInitLeft}px`;
        studioSidebarPanel.style.top = `${sidebarInitTop}px`;
        studioSidebarPanel.style.right = 'auto';
        studioSidebarPanel.style.bottom = 'auto';

        try {
            sidebarDragHandle.setPointerCapture(e.pointerId);
        } catch (err) {}
    });

    sidebarDragHandle.addEventListener('pointermove', (e) => {
        if (!isDraggingSidebar) return;

        const deltaX = e.clientX - sidebarStartX;
        const deltaY = e.clientY - sidebarStartY;

        let nextX = sidebarInitLeft + deltaX;
        let nextY = sidebarInitTop + deltaY;

        // Viewport constraint so panel never gets lost offscreen
        const panelWidth = studioSidebarPanel.offsetWidth;
        const panelHeight = studioSidebarPanel.offsetHeight;
        const minX = 6;
        const maxX = Math.max(6, window.innerWidth - panelWidth - 6);
        const minY = 54;
        const maxY = Math.max(54, window.innerHeight - panelHeight - 6);

        nextX = Math.max(minX, Math.min(maxX, nextX));
        nextY = Math.max(minY, Math.min(maxY, nextY));

        studioSidebarPanel.style.left = `${nextX}px`;
        studioSidebarPanel.style.top = `${nextY}px`;
    });

    const stopDraggingSidebar = (e) => {
        if (!isDraggingSidebar) return;
        isDraggingSidebar = false;
        sidebarDragHandle.classList.remove('is-dragging');
        try {
            sidebarDragHandle.releasePointerCapture(e.pointerId);
        } catch (err) {}
    };

    sidebarDragHandle.addEventListener('pointerup', stopDraggingSidebar);
    sidebarDragHandle.addEventListener('pointercancel', stopDraggingSidebar);
}

// Reset Docking Position to default right floating / mobile bottom sheet
if (btnResetDock && studioSidebarPanel) {
    btnResetDock.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        studioSidebarPanel.style.left = '';
        studioSidebarPanel.style.top = '';
        studioSidebarPanel.style.right = '';
        studioSidebarPanel.style.bottom = '';
        studioSidebarPanel.classList.remove('is-floating');
    });
}

// ==========================================
// 25. DYNAMIC WEATHER & ATMOSPHERE ENGINE
// ==========================================
const weatherCards = document.querySelectorAll('.weather-card');
const activeWeatherNameEl = document.getElementById('active-weather-name');
let currentWeather = 'sun';

function setWeather(weatherType) {
    currentWeather = weatherType;

    // Update active weather card styles
    weatherCards.forEach(card => {
        if (card.getAttribute('data-weather') === weatherType) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    if (weatherType === 'sun') {
        if (activeWeatherNameEl) activeWeatherNameEl.textContent = 'Golden Sun';
        isRainActive = false;
        isSnowActive = false;
        gsap.to(rainMat.uniforms.uOpacity, { value: 0, duration: 0.4 });
        gsap.to(snowMat.uniforms.uOpacity, { value: 0, duration: 0.4 });
        scene.fog = null;

        // Bright Warm Directional Sunlight
        gsap.to(keyLight.color, { r: 1.0, g: 0.95, b: 0.88, duration: 0.6 });
        keyLight.intensity = 3.6;
        gsap.to(rimLight.color, { r: 1.0, g: 0.66, b: 0.2, duration: 0.6 });
        rimLight.intensity = 2.4;
        warmAccentLight.color.set(0xffe082);
        warmAccentLight.intensity = 2.2;
        scene.background.set(0x0c0b0a);

        // Dry glossy finish
        paintMeshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.clearcoat = 0.0;
                mesh.material.needsUpdate = true;
            }
        });

    } else if (weatherType === 'rain') {
        if (activeWeatherNameEl) activeWeatherNameEl.textContent = 'Silverstone Rain';
        isRainActive = true;
        isSnowActive = false;
        gsap.to(rainMat.uniforms.uOpacity, { value: 0.75, duration: 0.5 });
        gsap.to(snowMat.uniforms.uOpacity, { value: 0, duration: 0.4 });

        // Wet track fog
        scene.fog = new THREE.FogExp2(0x06080d, 0.016);

        // Storm Mood Lighting
        gsap.to(keyLight.color, { r: 0.55, g: 0.69, b: 0.94, duration: 0.6 });
        keyLight.intensity = 2.4;
        gsap.to(rimLight.color, { r: 0.22, g: 0.5, b: 1.0, duration: 0.6 });
        rimLight.intensity = 3.6;
        warmAccentLight.color.set(0x205090);
        warmAccentLight.intensity = 1.4;
        scene.background.set(0x040609);

        // Wet paint clearcoat boost
        paintMeshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.clearcoat = 1.0;
                mesh.material.clearcoatRoughness = 0.08;
                mesh.material.needsUpdate = true;
            }
        });

    } else if (weatherType === 'fog') {
        if (activeWeatherNameEl) activeWeatherNameEl.textContent = 'London Fog';
        isRainActive = false;
        isSnowActive = false;
        gsap.to(rainMat.uniforms.uOpacity, { value: 0, duration: 0.4 });
        gsap.to(snowMat.uniforms.uOpacity, { value: 0, duration: 0.4 });

        // Dense Volumetric Atmospheric Fog
        scene.fog = new THREE.FogExp2(0x10141c, 0.046);

        // Moody Diffused Lighting
        gsap.to(keyLight.color, { r: 0.43, g: 0.53, b: 0.63, duration: 0.6 });
        keyLight.intensity = 1.9;
        gsap.to(rimLight.color, { r: 0.56, g: 0.63, b: 0.71, duration: 0.6 });
        rimLight.intensity = 2.8;
        warmAccentLight.color.set(0x4a627a);
        warmAccentLight.intensity = 1.6;
        scene.background.set(0x0e1219);

        // Turn on headlights to illuminate fog
        setHeadlights(true);

    } else if (weatherType === 'snow') {
        if (activeWeatherNameEl) activeWeatherNameEl.textContent = 'Alpine Snow';
        isRainActive = false;
        isSnowActive = true;
        gsap.to(rainMat.uniforms.uOpacity, { value: 0, duration: 0.4 });
        gsap.to(snowMat.uniforms.uOpacity, { value: 0.85, duration: 0.5 });

        // Frosty Ambient Fog
        scene.fog = new THREE.FogExp2(0x101824, 0.022);

        // Crisp Cold Alpine Lighting
        gsap.to(keyLight.color, { r: 0.85, g: 0.91, b: 1.0, duration: 0.6 });
        keyLight.intensity = 3.0;
        gsap.to(rimLight.color, { r: 0.0, g: 0.9, b: 1.0, duration: 0.6 });
        rimLight.intensity = 3.2;
        warmAccentLight.color.set(0x5c7fa3);
        warmAccentLight.intensity = 1.8;
        scene.background.set(0x090e16);
    }
}

weatherCards.forEach(card => {
    card.addEventListener('click', () => {
        const wType = card.getAttribute('data-weather');
        setWeather(wType);
    });
});

// ==========================================
// 26. MINIMALIST STUDIO ACCORDION CONTROLLER
// ==========================================
const studioAccordionHeaders = document.querySelectorAll('.accordion-header');
studioAccordionHeaders.forEach(header => {
    header.addEventListener('click', (e) => {
        e.preventDefault();
        const currentItem = header.closest('.accordion-item');
        if (!currentItem) return;

        const isCurrentlyOpen = currentItem.classList.contains('open');

        // Accordion mode: close other open sections to maintain zero-scroll compact layout
        document.querySelectorAll('.accordion-item').forEach(item => {
            if (item !== currentItem && item.classList.contains('open')) {
                item.classList.remove('open');
                const btn = item.querySelector('.accordion-header');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        });

        // Toggle clicked section
        if (isCurrentlyOpen) {
            currentItem.classList.remove('open');
            header.setAttribute('aria-expanded', 'false');
        } else {
            currentItem.classList.add('open');
            header.setAttribute('aria-expanded', 'true');
            // Scroll the opened section into view — on mobile the sidebar is
            // short enough that a section further down the list can expand
            // entirely below the visible area otherwise. Runs once now (header)
            // and again after the expand transition (body fully grown).
            requestAnimationFrame(() => {
                currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            setTimeout(() => {
                currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 380);
        }
    });
});

// ==========================================
// 27. MOBILE TEXT DENSITY: TAP-TO-REVEAL SPECS
// ==========================================
// Below 641px the spec boxes and the full specs table hide their
// secondary text by default (see CSS) so the page doesn't read as a wall
// of text; these handlers just flip the "expanded" state on tap/keypress.
// Above that breakpoint CSS forces everything visible and these classes
// have no visual effect, so no width check is needed here.
document.querySelectorAll('.spec-box').forEach((box) => {
    const toggle = () => {
        const isExpanded = box.classList.toggle('expanded');
        box.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    };
    box.addEventListener('click', toggle);
    box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    });
});

const btnSpecsToggle = document.getElementById('btn-specs-toggle');
const specsTablePanel = document.getElementById('specs-table-panel');
if (btnSpecsToggle && specsTablePanel) {
    btnSpecsToggle.addEventListener('click', () => {
        const isExpanded = specsTablePanel.classList.toggle('expanded');
        btnSpecsToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        const label = btnSpecsToggle.querySelector('.btn-specs-toggle-label');
        if (label) label.textContent = isExpanded ? 'Ascunde specificațiile' : 'Vezi specificațiile complete';
    });
}