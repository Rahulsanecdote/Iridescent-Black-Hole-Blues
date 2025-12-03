import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

// --- CONFIGURATION ---
const params = {
    metamorphosis: 0.0, // Start at 0 to show the butterfly clearly
    mass: 1.5,          // Scale of disk/gravity
    spin: 0.8,          // Rotation speed / distortion
    iridescence: 3.0,   // Intensity of color shift
    distance: 14,       // Camera distance (closer to see details)
    opacity: 1.0,       // Butterfly opacity
    autoOrbit: true,    // Camera auto-rotation
    lensing: true       // Toggle lensing
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = params.distance;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);

// --- TEXTURE LOADER (Custom Chroma Key) ---
const butterflyUniforms = {
    map: { value: null },
    time: { value: 0 },
    metamorphosis: { value: params.metamorphosis },
    iridescence: { value: params.iridescence },
    opacity: { value: params.opacity }
};

function loadButterflyTexture() {
    const loader = new THREE.TextureLoader();
    loader.load('assets/butterfly_transparent.png', (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.premultiplyAlpha = true;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        butterflyUniforms.map.value = texture;
        butterflyMaterial.needsUpdate = true;
    });
}

loadButterflyTexture();

// --- OBJECTS ---

// 1. STARFIELD (Background with Lensing Shader)
const starCount = 5000;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);

for (let i = 0; i < starCount; i++) {
    const r = 40 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);

    starSizes[i] = Math.random() * 2.0;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

const starUniforms = {
    mass: { value: params.mass },
    lensingEnabled: { value: 1.0 },
    cameraPositionUniform: { value: camera.position }
};

const starMaterial = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    vertexShader: `
        uniform float mass;
        uniform float lensingEnabled;
        uniform vec3 cameraPositionUniform;
        attribute float size;
        varying float vAlpha;

        void main() {
            vec3 vPos = position;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vec4 bhViewPos = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            
            vec3 screenPos = mvPosition.xyz;
            float dist = length(screenPos.xy);
            float einsteinRadius = 3.0 * sqrt(mass); // Larger radius for more dramatic lensing
            
            if (lensingEnabled > 0.5 && dist < einsteinRadius * 5.0 && mvPosition.z < bhViewPos.z) {
                float distortion = (einsteinRadius * einsteinRadius) / dist;
                distortion = min(distortion, 4.0); 
                vec2 offset = normalize(screenPos.xy) * distortion;
                mvPosition.xy += offset;
            }
            
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = size * (300.0 / -mvPosition.z);
            vAlpha = 0.8 + 0.2 * sin(position.x * 10.0);
        }
    `,
    fragmentShader: `
        varying float vAlpha;
        void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            if(length(coord) > 0.5) discard;
            gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const starField = new THREE.Points(starGeo, starMaterial);
scene.add(starField);


// 2. BUTTERFLY (Textured Plane with Structural Color)
const butterflyGroup = new THREE.Group();
scene.add(butterflyGroup);

const butterflyGeometry = new THREE.PlaneGeometry(10, 10);

const butterflyMaterial = new THREE.ShaderMaterial({
    uniforms: butterflyUniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false, // Fix z-fighting/transparency issues
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float time;
        uniform float metamorphosis;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;

            // Gentle floating
            vec3 pos = position;
            pos.z += sin(time * 0.3) * 0.1;
            
            // Warp wings slightly at edges to blend with disk
            float distFromCenter = length(vUv - 0.5);
            float warp = pow(distFromCenter, 2.0) * metamorphosis * 2.0;
            pos.z -= warp;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D map;
        uniform float metamorphosis;
        uniform float iridescence;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
            vec4 texColor = texture2D(map, vUv);

            // 1. Alpha Check (from PNG)
            if (texColor.a < 0.05) discard;
            // 2. Premultiply color to avoid a white fringe from the export
            texColor.rgb *= texColor.a;

            // Structural Color / Iridescence
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);
            float viewAngle = dot(viewDir, normal);
            float fresnel = pow(1.0 - abs(viewAngle), 2.0);
            
            // Electric Blue Iridescence
            vec3 iridescentColor = vec3(0.0, 0.6, 1.0) * fresnel * iridescence;
            
            // Mix iridescence with base texture
            vec3 finalColor = texColor.rgb + iridescentColor * 0.5;
            
            // Metamorphosis: Blend edges into Red/Orange (Disk Color)
            float dist = length(vUv - 0.5);
            float edgeBlend = smoothstep(0.3, 0.5, dist);
            
            vec3 diskColor = vec3(1.0, 0.3, 0.0); // Orange/Red
            
            // As metamorphosis increases, wings turn into accretion disk fire
            finalColor = mix(finalColor, diskColor, edgeBlend * metamorphosis);
            
            // Add "inner glow"
            finalColor += vec3(0.1, 0.1, 0.3) * (1.0 - edgeBlend);

            gl_FragColor = vec4(finalColor, texColor.a * opacity);
        }
    `
});

const butterflyMesh = new THREE.Mesh(butterflyGeometry, butterflyMaterial);
butterflyMesh.position.z = 0.1; // Slightly in front
butterflyGroup.add(butterflyMesh);


// 3. ACCRETION DISK (Shader Based - Fiery Red/Orange)
const diskCount = 20000; // High density for "painted" look
const diskGeo = new THREE.BufferGeometry();
const diskPos = new Float32Array(diskCount * 3);
const diskInfo = new Float32Array(diskCount * 2);

for (let i = 0; i < diskCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Distribution: Tighter inner ring, fading out
    const r = 2.0 + Math.pow(Math.random(), 2.0) * 9.0;

    diskPos[i * 3] = Math.cos(angle) * r;
    diskPos[i * 3 + 1] = (Math.random() - 0.5) * 0.15 * (r / 4.0);
    diskPos[i * 3 + 2] = Math.sin(angle) * r;

    diskInfo[i * 2] = r;
    diskInfo[i * 2 + 1] = angle;
}
diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
diskGeo.setAttribute('diskInfo', new THREE.BufferAttribute(diskInfo, 2));

const diskUniforms = {
    time: { value: 0 },
    mass: { value: params.mass },
    spin: { value: params.spin },
    metamorphosis: { value: params.metamorphosis }
};

const diskShaderMaterial = new THREE.ShaderMaterial({
    uniforms: diskUniforms,
    vertexShader: `
        uniform float time;
        uniform float mass;
        uniform float spin;
        attribute vec2 diskInfo;
        varying float vRadius;
        varying float vTemp;

        void main() {
            vRadius = diskInfo.x;
            float angleOffset = diskInfo.y;
            
            float speed = (4.0 / sqrt(vRadius)) * spin * 0.5;
            float currentAngle = angleOffset + time * speed;
            
            // Warping logic for "black hole" look
            float x = cos(currentAngle) * vRadius * mass;
            float z = sin(currentAngle) * vRadius * mass;
            float y = position.y * mass;
            
            // Simple visual warping (bending the back of the disk up/down)
            // This mimics the lensing effect seen in Interstellar/simulations
            float dist = length(vec2(x, z));
            if (z < 0.0) {
                 y += (pow(dist, -1.0) * 2.0) * mass; // Bend up behind
            }
            
            vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            gl_PointSize = (60.0 / -mvPosition.z);
            
            vTemp = 1.0 - (vRadius - 2.0) / 9.0; 
        }
    `,
    fragmentShader: `
        varying float vRadius;
        varying float vTemp;
        uniform float metamorphosis;
        
        void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            if(length(coord) > 0.5) discard;
            
            // Fiery Palette: Deep Red -> Bright Orange -> White Hot
            vec3 white = vec3(1.0, 1.0, 0.9);
            vec3 orange = vec3(1.0, 0.5, 0.0);
            vec3 red = vec3(0.8, 0.0, 0.0);
            vec3 dark = vec3(0.1, 0.0, 0.0);
            
            vec3 color = mix(dark, red, smoothstep(0.0, 0.3, vTemp));
            color = mix(color, orange, smoothstep(0.3, 0.7, vTemp));
            color = mix(color, white, smoothstep(0.7, 1.0, vTemp));
            
            float brightness = 0.8 + 0.2 * metamorphosis;
            
            gl_FragColor = vec4(color * brightness, 0.95);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const accretionDisk = new THREE.Points(diskGeo, diskShaderMaterial);
scene.add(accretionDisk);


// --- GUI SETUP ---
const gui = new GUI();
const f1 = gui.addFolder('Metaphor');
f1.add(params, 'metamorphosis', 0, 1).name('Stage').onChange(updateParams);
f1.open();

const f2 = gui.addFolder('Physics');
f2.add(params, 'mass', 0.5, 3).name('Mass').onChange(updateParams);
f2.add(params, 'spin', 0, 5).name('Spin').onChange(updateParams);
f2.add(params, 'lensing').name('Lensing');
f2.open();

const f3 = gui.addFolder('Visuals');
f3.add(params, 'iridescence', 0, 5).name('Iridescence');
f3.add(params, 'opacity', 0, 1).name('Butterfly Opacity'); // New Slider
f3.add(params, 'distance', 5, 50).name('Zoom').onChange(val => {
    camera.position.z = val;
});
f3.add(params, 'autoOrbit').name('Auto Orbit');
f3.open();

function updateParams() {
    butterflyUniforms.metamorphosis.value = params.metamorphosis;
    diskUniforms.mass.value = params.mass;
    diskUniforms.spin.value = params.spin;
    diskUniforms.metamorphosis.value = params.metamorphosis;
    starUniforms.mass.value = params.mass;
    starUniforms.lensingEnabled.value = params.lensing ? 1.0 : 0.0;
}

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    butterflyUniforms.time.value = time;
    butterflyUniforms.iridescence.value = params.iridescence;
    butterflyUniforms.opacity.value = params.opacity; // Update uniform
    diskUniforms.time.value = time;

    starUniforms.cameraPositionUniform.value.copy(camera.position);

    if (params.autoOrbit) {
        camera.position.x = Math.sin(time * 0.1) * params.distance;
        camera.position.z = Math.cos(time * 0.1) * params.distance;
        camera.lookAt(0, 0, 0);
    } else {
        controls.update();
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
