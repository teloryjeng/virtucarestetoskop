// physics.js
// --------------------------------------------------
// Modul untuk mengaktifkan sistem fisika di Babylon.js
// --------------------------------------------------
// Tips:
// - Pastikan kamu sudah memuat https://cdn.babylonjs.com/ammo.js di HTML
// - Fungsi ini akan memuat Ammo secara asynchronous, lalu mengaktifkan fisika
// --------------------------------------------------

async function enablePhysics(scene) {
  console.log("🧩 Memulai inisialisasi physics (Ammo.js)...");

  // Pastikan Ammo sudah siap
  await Ammo(); // <- inisialisasi global object dari ammo.js

  // Buat plugin fisika Babylon berbasis Ammo.js
  const ammoPlugin = new BABYLON.AmmoJSPlugin(true, Ammo);

  // Aktifkan physics di scene
  scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), ammoPlugin);
  scene.collisionsEnabled = true;

  console.log("✅ Physics berhasil diaktifkan dengan Ammo.js!");

  // Tambahkan contoh collision: buat box jatuh ke ground

  const ground = scene.getMeshByName("ground");
  if (ground) {
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
      ground,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0, restitution: 0.9 },
      scene
    );
  }

  // Tips tambahan:
  // - Semua objek yang memiliki physicsImpostor bisa berinteraksi fisik (jatuh, mantul, dll)
  // - Kamu bisa ubah "mass" agar benda ringan/berat
  // - Kamu bisa tambahkan "friction" untuk permukaan licin/kesat
}

