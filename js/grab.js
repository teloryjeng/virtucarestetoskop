// js/interactions.js

/**
 * Fungsi utama yang dipanggil oleh HTML untuk mengatur semua logika interaksi
 * (Mouse Drag dan VR Grab) untuk item berbasis fisika.
 */
function setupGrabLogic(scene, xr) {
  console.log("Menginisialisasi logika grab berbasis fisika...");

  const highlightColor = new BABYLON.Color3.Green();
  const massAsli = 0.01; // Harus sama dengan 'itemPhysicsMass' di HTML

  // ============================================================
  // 1. MOUSE DRAG (Desktop)
  // ============================================================

  const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

  // Iterasi semua mesh di scene untuk menemukan yang 'grabbable'
  scene.meshes.forEach((mesh) => {
    if (mesh.metadata && mesh.metadata.isGrabbable) {
      // 'mesh' di sini adalah 'wrapper' yang dibuat di HTML
      const wrapper = mesh;

      // Dapatkan model GLB di dalamnya (anak pertama) untuk di-highlight
      const childModel = wrapper.getChildren()[0];

      const dragBehavior = new BABYLON.PointerDragBehavior({});
      wrapper.addBehavior(dragBehavior);

      // Saat mulai di-drag
      dragBehavior.onDragStartObservable.add(() => {
        if (wrapper.physicsImpostor) {
          // Matikan fisika sementara agar bisa di-drag
          wrapper.physicsImpostor.setMass(0);
          wrapper.physicsImpostor.sleep();
        }
        if (childModel) {
          hlMouse.addMesh(childModel, highlightColor);
        }
      });

      // Saat selesai di-drag
      dragBehavior.onDragEndObservable.add(() => {
        if (wrapper.physicsImpostor) {
          // Kembalikan massa agar fisika aktif lagi
          wrapper.physicsImpostor.setMass(massAsli);
          wrapper.physicsImpostor.wakeUp();
        }
        hlMouse.removeAllMeshes();
      });
    }
  });

  // ============================================================
  // 2. VR GRAB (Virtual Reality)
  // ============================================================

  // Cek jika XR (VR) tidak aktif
  if (!xr) {
    console.warn("VR (xr) tidak aktif. VR Grab tidak diinisialisasi.");
    return; // Hentikan eksekusi jika tidak ada VR
  }

  const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

  xr.input.onControllerAddedObservable.add((controller) => {
    controller.onMotionControllerInitObservable.add((motionController) => {
      // Gunakan 'trigger' atau 'squeeze' untuk grab
      const triggerComponent = motionController.getComponent("trigger");
      const squeezeComponent = motionController.getComponent("squeeze");

      const grabComponent = triggerComponent || squeezeComponent;
      if (!grabComponent) return;

      let grabbedMesh = null;
      const hand = controller.grip || controller.pointer; // 'grip' lebih baik untuk posisi tangan

      grabComponent.onButtonStateChangedObservable.add((state) => {
        if (state.pressed) {
          // --- COBA GRAB ---
          if (grabbedMesh) return; // Sudah memegang sesuatu

          let closestMesh = null;
          let minDistance = 0.15; // Jarak maksimum grab (15cm)

          // Cek semua item grabbable di scene
          scene.meshes.forEach((mesh) => {
            if (mesh.metadata && mesh.metadata.isGrabbable) {
              const dist = BABYLON.Vector3.Distance(
                mesh.getAbsolutePosition(),
                hand.getAbsolutePosition()
              );
              if (dist < minDistance) {
                minDistance = dist;
                closestMesh = mesh;
              }
            }
          });

          // Jika ada item yang cukup dekat
          if (closestMesh) {
            grabbedMesh = closestMesh;

            // Matikan fisika
            if (grabbedMesh.physicsImpostor) {
              grabbedMesh.physicsImpostor.setMass(0);
              grabbedMesh.physicsImpostor.sleep();
            }

            // Parent-kan item ke tangan/controller
            grabbedMesh.setParent(hand);

            // Highlight model di dalamnya
            const childModel = grabbedMesh.getChildren()[0];
            if (childModel) {
              hlVR.addMesh(childModel, highlightColor);
            }
          }
        } else {
          // --- COBA RELEASE ---
          if (grabbedMesh) {
            // Lepas parent dari tangan
            grabbedMesh.setParent(null);

            // Aktifkan lagi fisika
            if (grabbedMesh.physicsImpostor) {
              grabbedMesh.physicsImpostor.setMass(massAsli);
              grabbedMesh.physicsImpostor.wakeUp();

              // Beri 'lemparan' (velocity) berdasarkan gerakan tangan
              const linearVelocity = hand.getLinearVelocity();
              if (linearVelocity) {
                grabbedMesh.physicsImpostor.setLinearVelocity(
                  linearVelocity.scale(1.5) // Sesuaikan pengali (1.5) jika lemparan terlalu kuat/lemah
                );
              }
            }

            // Hapus highlight
            hlVR.removeAllMeshes();
            grabbedMesh = null;
          }
        }
      });
    });
  });

  console.log("✅ Logika grab berbasis fisika berhasil diinisialisasi.");
}