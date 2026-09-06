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
const paintMeshes = [];
let originalPaintColor = new THREE.Color(0x9a0a0a);

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
                    if (child.material.name && (child.material.name.includes('Paint') || child.material.name.includes('paint'))) {
                        paintMeshes.push(child);
                        if (child.material.color) {
                            originalPaintColor.copy(child.material.color);
                        }
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

const cameraCoords = {
    x: 0,
    y: 0.85,
    z: 4.15,
    lookX: 0,
    lookY: 0.18,
    lookZ: 0,
    carRotY: 0
};

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
const brandLogo = document.querySelector('.nav-brand-group');
if (brandLogo) {
    brandLogo.addEventListener('click', (e) => {
        e.preventDefault();
        lenis.scrollTo(0, {
            duration: 1.5,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        });
        setActiveNav('home');
        showHeroContent(true);
    });
}

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
// 9. ANIMATION & RENDER LOOP
// ==========================================
const lookTarget = new THREE.Vector3();

let isStudioOpen = false;
let isAutoRotate = true;
let isStudioDragging = false;
let prevPointerX = 0;
let prevPointerY = 0;

function animate() {
    requestAnimationFrame(animate);

    if (isStudioOpen) {
        // In Studio mode: continuous turntable rotation if enabled and not dragging
        if (isAutoRotate && !isStudioDragging && carModel) {
            carModel.rotation.y += 0.0035;
        }
        camera.position.x = cameraCoords.x;
        camera.position.y = cameraCoords.y;
        camera.position.z = cameraCoords.z;
    } else {
        // In normal scroll mode: subtle camera parallax & scroll-driven car rotation
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;

        camera.position.x = cameraCoords.x + currentMouseX;
        camera.position.y = cameraCoords.y - currentMouseY;
        camera.position.z = cameraCoords.z;

        if (carModel) {
            carModel.rotation.y = cameraCoords.carRotY;
        }
    }

    lookTarget.set(cameraCoords.lookX, cameraCoords.lookY, cameraCoords.lookZ);
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
}
animate();

// ==========================================
// 10. RESIZE HANDLER
// ==========================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ==========================================
// 11. MINIMALIST GO TO TOP BUTTON
// ==========================================
const btnGoTop = document.getElementById('btn-go-top');
if (btnGoTop) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > window.innerHeight * 0.4) {
            btnGoTop.classList.add('visible');
        } else {
            btnGoTop.classList.remove('visible');
        }
    });

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
    document.body.classList.add('studio-open');
    if (studioModal) {
        studioModal.classList.add('active');
        studioModal.setAttribute('aria-hidden', 'false');
    }
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

// Close studio with Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isStudioOpen) {
        closeStudioModal();
    }
});

// Interactive 360° Drag to Spin Car in Studio Mode
if (studioModal) {
    studioModal.addEventListener('pointerdown', (e) => {
        // Do not trigger drag when clicking inside settings sidebar, topbar or expand button
        if (e.target.closest('.studio-sidebar') || e.target.closest('.studio-topbar') || e.target.closest('.studio-expand-btn')) return;
        isStudioDragging = true;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
        if (!isStudioDragging || !isStudioOpen || !carModel) return;
        const deltaX = e.clientX - prevPointerX;
        const deltaY = e.clientY - prevPointerY;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;

        carModel.rotation.y += deltaX * 0.008;
        cameraCoords.y = Math.max(0.4, Math.min(2.4, cameraCoords.y - deltaY * 0.004));
    });

    window.addEventListener('pointerup', () => {
        isStudioDragging = false;
    });
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

// Atmosphere & Lighting Presets
lightButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        lightButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const lightMode = btn.getAttribute('data-light');
        if (lightMode === 'golden') {
            keyLight.color.set(0xffd59e);
            keyLight.intensity = 3.6;
            rimLight.color.set(0xff9900);
            rimLight.intensity = 2.4;
            warmAccentLight.color.set(0xffe082);
            scene.background.set(0x0e0c08);
        } else if (lightMode === 'cyber') {
            keyLight.color.set(0x00f0ff);
            keyLight.intensity = 2.8;
            rimLight.color.set(0xff0066);
            rimLight.intensity = 3.2;
            warmAccentLight.color.set(0x7c4dff);
            scene.background.set(0x06060c);
        } else {
            // Showroom default
            keyLight.color.set(0xffffff);
            keyLight.intensity = 3.2;
            rimLight.color.set(0x4080ff);
            rimLight.intensity = 2.2;
            warmAccentLight.color.set(0xd4af37);
            scene.background.set(0x08080a);
        }
    });
});

// Camera Perspective Angle Presets
angleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        angleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const angleType = btn.getAttribute('data-angle');
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

// Reset Studio Spec
if (btnStudioReset) {
    btnStudioReset.addEventListener('click', () => {
        // Reset distance to Standard
        setStudioDistance(4.15, true);

        // Expand sidebar if collapsed
        if (studioSidebar) studioSidebar.classList.remove('collapsed');
        if (btnExpandSidebar) btnExpandSidebar.classList.remove('visible');

        // Reset colour to Hyper Red
        const firstSwatch = colourSwatches[0];
        if (firstSwatch) firstSwatch.click();

        // Reset finish to High Gloss
        const firstFinish = finishButtons[0];
        if (firstFinish) firstFinish.click();

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
    });
}