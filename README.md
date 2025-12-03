# Iridescent Black Hole Blues

An interactive web-based visualization exploring the metaphor between a Blue Morpho butterfly and a Black Hole.

## Overview
This project visualizes the concept of "Structural Color" (butterfly wings) and "Gravitational Lensing" (black holes) as parallel phenomena of light manipulation. It allows the user to transition the system from a biological entity (Caterpillar/Butterfly) to a cosmic entity (Black Hole) via a "Metamorphosis" slider.

## How to Run
This project uses standard web technologies (HTML, CSS, JavaScript) and ES modules. Because it loads modules, it requires a local server to run (browsers block file:// protocol for modules).

### Option 1: Python (Recommended)
If you have Python installed:
1. Open a terminal in this folder.
2. Run: `python3 -m http.server`
3. Open `http://localhost:8000` in your browser.

### Option 2: Node.js
If you have Node.js installed:
1. Run: `npx serve .`
2. Open the URL shown in the terminal.

## Controls
The control panel (top right) allows you to manipulate the simulation:

### Metaphor
- **Stage (Metamorphosis)**:
    - `0.0`: **Caterpillar/Butterfly**. The wings are solid, flapping. The accretion disk is faint (like dust).
    - `0.5`: **Chrysalis**. The system is in transition.
    - `1.0`: **Black Hole**. The wings become the shimmering event horizon. The accretion disk is bright and hot.

### Physics
- **Mass**: Controls the size of the accretion disk and the strength of the gravitational lensing.
- **Spin**: Controls the rotation speed of the disk and the "energy" of the system.
- **Lensing**: Toggles the gravitational distortion of background stars.

### Visuals
- **Iridescence**: Adjusts the intensity of the color shift on the wings/horizon.
- **Zoom**: Moves the camera.
- **Auto Orbit**: Toggles the automatic camera rotation.

## Design Notes
- **The Butterfly**: Represents the singularity. Its wings use a shader that mimics structural color (interference), changing color based on viewing angle.
- **The Disk**: Represents the accretion disk. It uses a gradient from hot (white/blue) to cold (red) and follows Keplerian-like orbital mechanics.
- **The Lensing**: Background stars are pushed away from the center, simulating the bending of light by intense gravity. Only stars *behind* the black hole are distorted.
