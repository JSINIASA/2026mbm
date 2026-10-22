import * as THREE from "three";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DiceAudio } from "./dice-sound.js";

const EFRON_DICE = [
  { id: "A", faces: [4, 4, 4, 4, 0, 0], tint: 0xe8dcc8 },
  { id: "B", faces: [3, 3, 3, 3, 3, 3], tint: 0xc9ddf0 },
  { id: "C", faces: [6, 6, 2, 2, 2, 2], tint: 0xf0c9c9 },
  { id: "D", faces: [5, 5, 5, 1, 1, 1], tint: 0xd4f0c9 },
];

const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

const TABLE_Y = -0.5;
const HALF = 0.5;
/** 물리 충돌: 굴리는 주사위 ↔ 테이블·벽만 */
const COL_ENV = 1;
const COL_ROLLING = 2;
const COL_PARKED = 4;
const ROLL_CENTER = { x: 0, z: 0 };

function makeFaceTexture(value, tintHex) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const r = (tintHex >> 16) & 255;
  const g = (tintHex >> 8) & 255;
  const b = tintHex & 255;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(
    0,
    `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`,
  );
  grad.addColorStop(1, `rgb(${r}, ${g}, ${b})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(26, 18, 8, 0.35)";
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  ctx.fillStyle = "#1a1208";
  ctx.font = "bold 120px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), size / 2, size / 2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDieMesh(faces, tint) {
  const materials = faces.map(
    (v) =>
      new THREE.MeshStandardMaterial({
        map: makeFaceTexture(v, tint),
        roughness: 0.45,
        metalness: 0.08,
        emissive: new THREE.Color(0x000000),
      }),
  );
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function setDieHighlight(mesh, on) {
  mesh.material.forEach((mat) => {
    mat.emissive.setHex(on ? 0x3d2e0a : 0x000000);
    mat.emissiveIntensity = on ? 0.35 : 0;
  });
}

function getTopFaceValue(mesh, faces) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  const q = mesh.quaternion;
  for (let i = 0; i < 6; i++) {
    const n = FACE_NORMALS[i].clone().applyQuaternion(q);
    if (n.y > bestDot) {
      bestDot = n.y;
      bestIdx = i;
    }
  }
  return faces[bestIdx];
}

function homeTransform(index) {
  const x = (index - 1.5) * 2.35;
  const yaw = (index - 1.5) * 0.25;
  const quat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yaw,
  );
  return {
    position: new THREE.Vector3(x, 0, 0),
    quaternion: quat,
  };
}

function syncMeshFromBody(mesh, body) {
  mesh.position.set(body.position.x, body.position.y, body.position.z);
  mesh.quaternion.set(
    body.quaternion.x,
    body.quaternion.y,
    body.quaternion.z,
    body.quaternion.w,
  );
}

function applyHomeToBody(body, index) {
  const home = homeTransform(index);
  body.position.set(home.position.x, home.position.y, home.position.z);
  body.quaternion.set(
    home.quaternion.x,
    home.quaternion.y,
    home.quaternion.z,
    home.quaternion.w,
  );
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.sleep();
}

function setEnvCollision(body) {
  body.collisionFilterGroup = COL_ENV;
  body.collisionFilterMask = COL_ROLLING;
}

function parkDie(entry) {
  const { mesh, body, index } = entry;
  applyHomeToBody(body, index);
  body.type = CANNON.Body.STATIC;
  body.mass = 0;
  body.updateMassProperties();
  body.collisionFilterGroup = COL_PARKED;
  body.collisionFilterMask = 0;
  mesh.visible = true;
  syncMeshFromBody(mesh, body);
}

function prepareSoloRoll(entry, others) {
  others.forEach((other) => {
    parkDie(other);
    other.mesh.visible = false;
  });

  const { mesh, body } = entry;
  mesh.visible = true;
  body.type = CANNON.Body.DYNAMIC;
  body.mass = 1;
  body.updateMassProperties();
  body.collisionFilterGroup = COL_ROLLING;
  body.collisionFilterMask = COL_ENV;
}

function initScene(container, audio) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 5.5, 9);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.4, 0);

  scene.add(new THREE.AmbientLight(0xfff5e6, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(4, 10, 6);
  key.castShadow = true;
  scene.add(key);

  const table = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64),
    new THREE.MeshStandardMaterial({ color: 0x062419, roughness: 0.9 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = TABLE_Y;
  table.receiveShadow = true;
  scene.add(table);

  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -22, 0),
  });
  world.allowSleep = true;
  world.broadphase = new CANNON.SAPBroadphase(world);

  const matDie = new CANNON.Material("die");
  const matTable = new CANNON.Material("table");
  const matWall = new CANNON.Material("wall");
  world.addContactMaterial(
    new CANNON.ContactMaterial(matDie, matTable, {
      friction: 0.45,
      restitution: 0.35,
    }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(matDie, matDie, {
      friction: 0.4,
      restitution: 0.42,
    }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(matDie, matWall, {
      friction: 0.35,
      restitution: 0.25,
    }),
  );

  const tableBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    material: matTable,
    shape: new CANNON.Plane(),
  });
  tableBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  tableBody.position.set(0, TABLE_Y, 0);
  setEnvCollision(tableBody);
  world.addBody(tableBody);

  const wallH = 1.2;
  const wallY = TABLE_Y + wallH / 2;
  const wallDist = 4.2;
  [
    [wallDist, 0, 0, 0, Math.PI / 2, 0],
    [-wallDist, 0, 0, 0, -Math.PI / 2, 0],
    [0, 0, wallDist, 0, 0, 0],
    [0, 0, -wallDist, 0, Math.PI, 0],
  ].forEach(([x, y, z, rx, ry, rz]) => {
    const wall = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: matWall,
      shape: new CANNON.Box(new CANNON.Vec3(0.15, wallH, 4.5)),
    });
    wall.position.set(x, wallY + y, z);
    wall.quaternion.setFromEuler(rx, ry, rz);
    setEnvCollision(wall);
    world.addBody(wall);
  });

  const diceEntries = EFRON_DICE.map((spec, index) => {
    const mesh = createDieMesh(spec.faces, spec.tint);
    scene.add(mesh);

    const body = new CANNON.Body({
      mass: 1,
      material: matDie,
      shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
      sleepSpeedLimit: 0.35,
      sleepTimeLimit: 0.4,
    });
    body.linearDamping = 0.08;
    body.angularDamping = 0.12;
    parkDie({ mesh, body, index });
    world.addBody(body);

    body.addEventListener("collide", (event) => {
      const impact = Math.abs(event.contact.getImpactVelocityAlongNormal());
      audio.playImpact(Math.min(1, impact / 9));
    });

    return { spec, mesh, body, index };
  });

  let selectedIndex = null;
  let rolling = false;
  let settleSince = null;
  /** @type {((value: number) => void) | null} */
  let onRollComplete = null;

  const fixedStep = 1 / 60;
  let lastNow = performance.now();

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", resize);

  function stepPhysics() {
    const now = performance.now();
    const elapsed = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    world.step(fixedStep, elapsed, 5);
    diceEntries.forEach(({ mesh, body }) => {
      if (mesh.visible) syncMeshFromBody(mesh, body);
    });
  }

  function isSettled(body) {
    return (
      body.velocity.length() < 0.25 && body.angularVelocity.length() < 0.55
    );
  }

  function frame() {
    stepPhysics();

    if (rolling && selectedIndex != null) {
      const active = diceEntries[selectedIndex];
      if (isSettled(active.body)) {
        if (settleSince == null) settleSince = performance.now();
        else if (performance.now() - settleSince > 450) {
          rolling = false;
          settleSince = null;
          const value = getTopFaceValue(active.mesh, active.spec.faces);
          diceEntries.forEach((entry) => parkDie(entry));
          if (onRollComplete) {
            const cb = onRollComplete;
            onRollComplete = null;
            cb(value);
          }
        }
      } else {
        settleSince = null;
      }
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function setSelected(index) {
    selectedIndex = index;
    diceEntries.forEach(({ mesh }, i) => setDieHighlight(mesh, i === index));
  }

  function throwSelectedDie(onComplete) {
    if (selectedIndex == null || rolling) return false;
    onRollComplete = onComplete;

    const entry = diceEntries[selectedIndex];
    const others = diceEntries.filter((d) => d.index !== selectedIndex);
    prepareSoloRoll(entry, others);

    const body = entry.body;
    body.wakeUp();
    body.position.set(
      ROLL_CENTER.x + (Math.random() - 0.5) * 0.35,
      2.8 + Math.random() * 0.6,
      ROLL_CENTER.z + (Math.random() - 0.5) * 0.35,
    );
    body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    );
    body.velocity.set(
      (Math.random() - 0.5) * 3.5,
      -2 - Math.random() * 2,
      (Math.random() - 0.5) * 3.5,
    );
    body.angularVelocity.set(
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 28,
    );
    syncMeshFromBody(entry.mesh, body);

    rolling = true;
    settleSince = null;
    return true;
  }

  return {
    setSelected,
    throwSelectedDie,
    isRolling: () => rolling,
    getSelectedIndex: () => selectedIndex,
  };
}

function boot() {
  const container = document.getElementById("dice-viz");
  const rollBtn = document.getElementById("roll-btn");
  const resultEl = document.getElementById("roll-result");
  const selectBtns = document.querySelectorAll("[data-die-index]");
  if (!container || !rollBtn || !selectBtns.length) return;

  const audio = new DiceAudio();
  const sceneApi = initScene(container, audio);

  const setUiLocked = (locked) => {
    rollBtn.disabled = locked || sceneApi.getSelectedIndex() == null;
    selectBtns.forEach((b) => {
      b.disabled = locked;
    });
  };

  selectBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (sceneApi.isRolling()) return;
      await audio.ensure();
      const index = Number(btn.dataset.dieIndex);
      sceneApi.setSelected(index);
      selectBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-selected", active);
        b.setAttribute("aria-checked", active ? "true" : "false");
      });
      rollBtn.disabled = false;
      resultEl.textContent = `${EFRON_DICE[index].id} 선택됨 — 굴리기를 누르세요.`;
    });
  });

  rollBtn.addEventListener("click", async () => {
    if (sceneApi.getSelectedIndex() == null || sceneApi.isRolling()) return;
    await audio.ensure();
    audio.playRollStart();

    const idx = sceneApi.getSelectedIndex();
    const spec = EFRON_DICE[idx];
    setUiLocked(true);
    resultEl.textContent = `${spec.id} 굴리는 중…`;

    sceneApi.throwSelectedDie((value) => {
      resultEl.textContent = `결과 — ${spec.id}: ${value}`;
      setUiLocked(false);
    });
  });
}

boot();
