import * as THREE from 'three';
import { GAMEPLAY, PALETTE, WORLD } from './config.js';

const skyVertexShader = `
  varying vec3 vSkyPosition;
  void main() {
    vSkyPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  varying vec3 vSkyPosition;
  void main() {
    float height = normalize(vSkyPosition).y;
    vec3 color = height > 0.0
      ? mix(horizonColor, topColor, pow(height, 0.48))
      : mix(horizonColor, bottomColor, pow(-height, 0.55));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const phases = [
  { hour: 0, top: 0x050913, horizon: 0x101a2c, bottom: 0x020407, sun: 0x334455, light: 0.17, fog: 0x0a1119, fogDensity: 0.0011 },
  { hour: 5.5, top: 0x253757, horizon: 0xb55f47, bottom: 0x161c29, sun: 0xff9a62, light: 0.36, fog: 0x635047, fogDensity: 0.0012 },
  { hour: 7, top: 0x4c8fd2, horizon: 0xffd5a2, bottom: 0x596870, sun: 0xffd7a5, light: 0.95, fog: 0xbccbd6, fogDensity: 0.00062 },
  { hour: 12, top: 0x2f78c8, horizon: 0xa9d9ee, bottom: 0x7b868d, sun: 0xfff4dc, light: 1.25, fog: 0xa9c8d8, fogDensity: 0.0005 },
  { hour: 17.5, top: 0x4879a8, horizon: 0xffb066, bottom: 0x77665c, sun: 0xffb265, light: 0.98, fog: 0xc79a6e, fogDensity: 0.0008 },
  { hour: 19.3, top: 0x1c2a4b, horizon: 0xd06066, bottom: 0x1d212c, sun: 0xff7b4f, light: 0.38, fog: 0x5c4045, fogDensity: 0.0011 },
  { hour: 24, top: 0x050913, horizon: 0x101a2c, bottom: 0x020407, sun: 0x334455, light: 0.17, fog: 0x0a1119, fogDensity: 0.0011 },
];

const temporaryColorA = new THREE.Color();
const temporaryColorB = new THREE.Color();
const temporaryColor = new THREE.Color();

function samplePalette(hour) {
  const wrappedHour = ((hour % 24) + 24) % 24;
  let current = phases[0];
  let next = phases[phases.length - 1];
  let blend = 0;
  for (let index = 0; index < phases.length - 1; index += 1) {
    if (wrappedHour >= phases[index].hour && wrappedHour <= phases[index + 1].hour) {
      current = phases[index];
      next = phases[index + 1];
      blend = (wrappedHour - current.hour) / (next.hour - current.hour);
      break;
    }
  }
  const mixColor = (key) => temporaryColorA.setHex(current[key]).lerp(temporaryColorB.setHex(next[key]), blend).clone();
  return {
    top: mixColor('top'),
    horizon: mixColor('horizon'),
    bottom: mixColor('bottom'),
    sun: mixColor('sun'),
    fog: mixColor('fog'),
    light: THREE.MathUtils.lerp(current.light, next.light, blend),
    fogDensity: THREE.MathUtils.lerp(current.fogDensity, next.fogDensity, blend),
  };
}

function makeOceanTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#2fb3cc';
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 620; index += 1) {
    const y = Math.random() * 256;
    const width = 6 + Math.random() * 30;
    context.fillStyle = Math.random() > 0.72 ? 'rgba(220,250,255,.34)' : 'rgba(64,190,215,.28)';
    context.fillRect(Math.random() * 256, y, width, 1 + Math.random() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(22, 22);
  return texture;
}

function applyNightMaterials(environment, glow) {
  for (const material of environment.nightMaterials) {
    if (!material) continue;
    if (material.emissive) {
      if (material.userData.isNeon) material.emissiveIntensity = glow;
      material.emissiveIntensity = glow * (material.userData.baseGlow ?? 1);
    } else if (material.opacity !== undefined) {
      material.opacity = 0.62 + glow * 0.33;
    }
  }
}

export function createEnvironment(scene, nightMaterials = []) {
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x2f78c8) },
    horizonColor: { value: new THREE.Color(0xa9d9ee) },
    bottomColor: { value: new THREE.Color(0x7b868d) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1900, 32, 18),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff4dc, 1.25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 920;
  sun.shadow.camera.left = -190;
  sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190;
  sun.shadow.camera.bottom = -190;
  sun.shadow.bias = -0.00075;
  scene.add(sun, sun.target);

  const hemisphere = new THREE.HemisphereLight(0xb7d7ee, 0x465343, 0.75);
  scene.add(hemisphere);
  const moon = new THREE.DirectionalLight(0x8ea7c8, 0.12);
  scene.add(moon);

  const oceanTexture = makeOceanTexture();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(7600, 7600, 1, 1),
    new THREE.MeshStandardMaterial({
      color: PALETTE.water,
      map: oceanTexture,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.5;
  scene.add(ocean);

  scene.fog = new THREE.FogExp2(0xa9c8d8, 0.0005);
  const environment = {
    scene,
    sky,
    skyUniforms,
    sun,
    moon,
    hemisphere,
    ocean,
    oceanTexture,
    nightMaterials,
    timeOfDay: GAMEPLAY.time.startingHour,
    elapsed: 0,
  };
  updateEnvironment(environment, 0, new THREE.Vector3());
  return environment;
}

export function updateEnvironment(environment, deltaTime, focus) {
  const secondsPerHour = 132;
  environment.elapsed += deltaTime;
  environment.timeOfDay = (environment.timeOfDay + deltaTime / secondsPerHour) % 24;
  environment.oceanTexture.offset.set(environment.elapsed * 0.008, environment.elapsed * 0.004);
  environment.oceanTexture.needsUpdate = true;

  const palette = samplePalette(environment.timeOfDay);
  environment.skyUniforms.topColor.value.copy(palette.top);
  environment.skyUniforms.horizonColor.value.copy(palette.horizon);
  environment.skyUniforms.bottomColor.value.copy(palette.bottom);
  environment.sun.color.copy(palette.sun);
  environment.sun.intensity = palette.light;
  environment.hemisphere.intensity = 0.58 + palette.light * 0.5;
  environment.hemisphere.color.copy(palette.horizon).lerp(temporaryColor.setHex(0xd8ecff), 0.45);
  environment.moon.intensity = THREE.MathUtils.clamp(0.52 - palette.light * 0.3, 0.03, 0.5);
  environment.scene.fog.color.copy(palette.fog);
  environment.scene.fog.density = palette.fogDensity;
  environment.ocean.material.color.copy(temporaryColor.setHex(PALETTE.water)).lerp(palette.horizon, 0.18);

  const dayAngle = ((environment.timeOfDay - 6) / 24) * Math.PI * 2;
  const sunHeight = Math.sin(dayAngle);
  const sunRadius = 1050;
  environment.sun.position.set(
    focus.x + Math.cos(dayAngle) * sunRadius,
    Math.max(24, sunHeight * 850),
    focus.z + 330,
  );
  environment.sun.target.position.copy(focus);
  environment.moon.position.set(focus.x - 600, 420, focus.z - 300);
  environment.sky.position.copy(focus);
  environment.ocean.position.x = focus.x;
  environment.ocean.position.z = focus.z;

  const glow = THREE.MathUtils.clamp(1 - (sunHeight + 0.16) * 3.5, 0, 1);
  applyNightMaterials(environment, glow);
  return glow;
}

export function setTimeOfDay(environment, hours) {
  environment.timeOfDay = ((hours % 24) + 24) % 24;
  updateEnvironment(environment, 0, new THREE.Vector3(WORLD.halfIsland * 0.2, 0, WORLD.halfIsland * 0.3));
}
