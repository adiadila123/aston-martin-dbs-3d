# Aston Martin DBS Superleggera — Interactive 3D Experience & Studio

An ultra-luxury, high-performance 3D WebGL landing page and interactive customisation studio for the **Aston Martin DBS Superleggera**, crafted with Three.js (r160), Google Draco mesh compression, GSAP ScrollTrigger, and Lenis smooth scrolling.

![Aston Martin DBS Superleggera](https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80)

## Features

- **Cinematic 3D WebGL Background**: Seamlessly integrated 3D grand tourer model with physical clearcoat and metallic shader materials that persists across all sections.
- **Bi-directional Scroll-Driven Camera**: Smoothly orchestrates camera perspective angles and reveals key engineering chapters:
  - **Home (Hero)**: Full-screen overview with dynamic counter stats (715 BHP, 900 Nm, 3.4s 0-62 MPH, 211 MPH).
  - **Aerodynamics**: Curlicue venting, Aeroblade II™, and double diffuser with entrance animations.
  - **Performance**: 5.2L Twin-Turbo V12 specs matrix and transmission details.
  - **Craftsmanship**: Scottish leather and chopped carbon showcase.
  - **Specifications**: Technical dossier and VIP commission booking.
- **Interactive 3D Studio & Configurator (Full-Screen Modal)**:
  - **360° Drag-to-Rotate**: Free turntable rotation and orbital manipulation.
  - **Live Exterior Paint Palette**: Hyper Red, Aston Racing Green, Obsidian Black, Quantum Silver, Midnight Sapphire, Solar Gold, Morning Frost White.
  - **Finish Toggle**: High Gloss vs. Satin Matte clearcoat and roughness controls.
  - **Camera Distance (Perspective Zoom)**: Slider and presets (Close-up, Standard, Wide) + mouse wheel zoom.
  - **Atmosphere & Studio Lighting**: Showroom, Golden Hour, and Night Neon lighting presets.
  - **Collapsible Minimalist Side Panel**: Slide panel off-screen for an uninterrupted full-screen showcase.
- **Ultra-Minimalist Glassmorphic Topbar**: Frosted glass navigation with discreet micro-dot active indicators and quick studio access.
- **Smooth Inertial Scroll**: Powered by Lenis with custom easing.

## Tech Stack

- **Three.js (r160)** via ES Modules Import Map
- **DRACOLoader** for 3D model compression
- **GSAP 3.12** & **ScrollTrigger**
- **Lenis 1.1** for smooth scrolling
- **Vanilla CSS** with modern glassmorphism design system

## Getting Started

Simply serve the project folder using any static HTTP server:

```bash
# Using Python
python3 -m http.server 8080

# Or using Node.js / npx
npx serve .
```

Open [http://localhost:8080/](http://localhost:8080/) in your browser.

## License

MIT
