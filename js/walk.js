// walk.js
// Usage:
//   // in your index.html script after creating scene, camera, ground:
//   import initXRMovement from './xr-movement.js';
//   initXRMovement(scene, camera, ground);
// OR (if not using modules) include this file with a <script> tag and call window.initXRMovement(...)

async function initXRMovement(scene, camera, ground) {
  // Pastikan parameter valid
  if (!scene) {
    console.error("initXRMovement: scene is required");
    return null;
  }
  if (!camera) {
    console.warn("initXRMovement: camera not provided, creating a default UniversalCamera");
    camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, 1.6, -3), scene);
    camera.attachControl(true);
  }

  // Siapkan variabel xr
  let xr = null;

  try {
    // Buat experience XR. cameraOptions akan diterapkan ke XR camera (base experience camera)
    xr = await scene.createDefaultXRExperienceAsync({
      floorMeshes: [ground],
      // Kamera opsi saat XR dibuat; ini akan menjadi baseExperience.camera
      cameraOptions: {
        checkCollisions: true,
        applyGravity: true,
        // ellipsoid mendeklarasikan radius collision (x, y, z)
        ellipsoid: new BABYLON.Vector3(0.5, 1, 0.5)
      }
    });

    console.log("✅ WebXR base experience dibuat");

    // Ambil XR camera (rig)
    const xrCamera = xr.baseExperience.camera;

    // Pastikan posisi dan property kamera
    if (xrCamera) {
      xrCamera.position.y = 1;
      xrCamera.applyGravity = true;
      xrCamera.checkCollisions = true;
      // Jika scene memiliki physics/collision aktif, pastikan juga collider
      if (typeof xrCamera.ellipsoid !== "undefined") {
        // already configured by cameraOptions, log saja
        console.log("XR camera ellipsoid:", xrCamera.ellipsoid);
      }
    }

    // Aktifkan fitur MOVEMENT (smooth locomotion) jika tersedia
    // NOTE: fitur ini membutuhkan browser mendukung WebXR dan controller dengan thumbstick
    if (xr.baseExperience && xr.baseExperience.featuresManager) {
      try {
        xr.baseExperience.featuresManager.enableFeature(
          // gunakan konstanta nama fitur
          BABYLON.WebXRFeatureName.MOVEMENT,
          "latest", // versi (atau nomor versi)
          {
            xrInput: xr.input,
            // movement
            movementSpeed: 0.1,          // kecepatan translasi
            rotationSpeed: 0.06,         // kecepatan rotasi (smooth turn)
            // kontroler mana untuk movement / rotation
            // format: "<hand>-<componentType>" atau hanya "<componentType>"
            // contoh: "right-xr-standard-thumbstick" atau "left-xr-standard-thumbstick"
            movementControls: ["right-xr-standard-thumbstick"],    // joystick kanan untuk jalan
            rotationControls: ["left-xr-standard-thumbstick"],     // joystick kiri untuk rotasi
            useThumbstickForMovement: true,
            disableTeleportOnThumbstick: true,
            // collision & gravity agar movement menghormati physics/collision
            checkCollisions: true,
            applyGravity: true,
            // gunakan ellipsoid yang sama agar cocok dengan cameraOptions
            ellipsoid: new BABYLON.Vector3(0.5, 1, 0.5)
          }
        );
        console.log("🎮 WebXR Movement feature di-enable");
      } catch (featErr) {
        console.warn("⚠️ Gagal meng-enable movement feature:", featErr);
      }
    } else {
      console.warn("⚠️ featuresManager tidak tersedia pada baseExperience (movement tidak diaktifkan)");
    }
  } catch (e) {
    // Jika WebXR gagal (mis. HTTP non-HTTPS atau browser tidak mendukung),
    // lakukan fallback ke kamera non-XR dan aktifkan collision & gravity di kamera biasa
    console.warn("⚠️ WebXR tidak tersedia atau gagal inisialisasi - fallback ke mode biasa:", e);

    // Pastikan kamera biasa aktif
    scene.activeCamera = camera;
    if (camera) {
      camera.applyGravity = true;
      camera.checkCollisions = true;
      // atur ellipsoid bila camera mendukung property ini
      if (camera.ellipsoid) {
        camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
      }
    }

    xr = null;
  }

  // Setelah percobaan inisialisasi, safe-check sebelum read xr properties
  if (xr) {
    try {
      console.log("WebXR state: ", xr.baseExperience.state);
      console.log("Current Camera (XR): ", scene.activeCamera ? scene.activeCamera.name : "none");
    } catch (logErr) {
      console.warn("Gagal baca state XR:", logErr);
    }
  } else {
    console.log("WebXR tidak aktif — memakai kamera biasa:", scene.activeCamera ? scene.activeCamera.name : camera.name);
  }

  // Return xr instance (atau null) agar caller dapat pakai
  return xr;
}

// Export untuk modul environment (ES module)
if (typeof exports !== "undefined") {
  // CommonJS (node) style
  exports.default = initXRMovement;
}
if (typeof window !== "undefined") {
  // expose ke window agar bisa dipanggil jika tidak menggunakan module import
  window.initXRMovement = initXRMovement;
}
export default initXRMovement;