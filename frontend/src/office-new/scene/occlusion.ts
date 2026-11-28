// Tembus pandang seperti game pada umumnya: semua yang berada di antara kamera dan pemain (dinding, atap, rak,
// orang lain) dibolongi dengan pola dither di sekitar garis pandang, sehingga pemain selalu terlihat.
// Dikerjakan di shader (bukan per objek), jadi tetap jalan untuk mesh hasil StaticBatch & karakter SkinnedMesh.
import * as THREE from 'three';

export const OCC = {
  uOccCam: { value: new THREE.Vector3() },
  uOccTarget: { value: new THREE.Vector3() },
  uOccOn: { value: 0 },
  /** jari-jari "terowongan" pandang (meter) */
  uOccR: { value: 1.05 },
};

const VERT_HEAD = 'varying vec3 vOccWorld;\n';
const VERT_BODY = `#include <project_vertex>
#ifdef USE_INSTANCING
  vOccWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vOccWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`;
const FRAG_HEAD = `varying vec3 vOccWorld;
uniform vec3 uOccCam;
uniform vec3 uOccTarget;
uniform float uOccOn;
uniform float uOccR;
float occBayer(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return (m[k] + 0.5) / 16.0;
}
`;
const FRAG_BODY = `#include <clipping_planes_fragment>
if (uOccOn > 0.5) {
  vec3 ab = uOccTarget - uOccCam;
  float L2 = max(dot(ab, ab), 1e-4);
  float t = dot(vOccWorld - uOccCam, ab) / L2;
  // hanya di depan pemain (berhenti ±0.55 m sebelum kepala), bukan di belakangnya
  float tEnd = 1.0 - 0.55 / sqrt(L2);
  if (t > 0.0 && t < tEnd) {
    float d = length(vOccWorld - (uOccCam + ab * t));
    // kerucut: sempit di dekat kamera (kanopi/atap di atas kamera tidak ikut bolong), lebar di sekitar pemain
    float r = uOccR * mix(0.22, 1.0, smoothstep(0.0, 1.0, t / max(tEnd, 1e-3)));
    float fade = 1.0 - smoothstep(r * 0.55, r, d);
    if (fade > 0.0 && occBayer(gl_FragCoord.xy) < fade * 0.85) discard;
  }
}`;

const patched = new WeakSet<THREE.Material>();
/** Material yang tidak pernah dibolongi: lantai, bayangan kontak, kaca, langit. */
const skip = (m: THREE.Material) => m.name === 'Floor' || m.name === 'Blob' || m.transparent || (m as THREE.MeshBasicMaterial).isMeshBasicMaterial && !(m as THREE.MeshBasicMaterial).map;

export function patchOccluder(m: THREE.Material) {
  if (patched.has(m) || skip(m)) return;
  patched.add(m);
  const prev = m.onBeforeCompile.bind(m);
  const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    Object.assign(shader.uniforms, OCC);
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <project_vertex>', VERT_BODY);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <clipping_planes_fragment>', FRAG_BODY);
  };
  m.customProgramCacheKey = () => `${prevKey()}|occ`;
  m.needsUpdate = true;
}

/** Tambal semua material di scene yang belum ditambal (dipanggil berkala: objek baru ikut tertambal). */
export function patchScene(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) patchOccluder(m);
  });
}
