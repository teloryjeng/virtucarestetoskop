// js/interactions.js (Final: Wrapper Penetration Fix)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi VR (Final Fix)...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI ---
    const MOVE_FORCE = 40;     
    const GRAB_DAMPING = 0.5;  

    // ============================================================
    // FUNGSI HELPER: GERAKAN FISIKA
    // ============================================================
    const applyPhysicsMove = (mesh, targetPosition) => { 
        if (!mesh.physicsImpostor) return;
        
        const currentPos = mesh.getAbsolutePosition();
        const diff = targetPosition.subtract(currentPos);
        
        let factor = 1.0;
        // Jika barang jauh dari tangan (lagi ditarik), pelankan sedikit
        if (diff.length() > 0.5) factor = 0.1; 

        const velocity = diff.scale(MOVE_FORCE * factor);
        
        // Batas Kecepatan Maksimal (Agar tidak mental)
        const maxSpeed = 5; 
        if (velocity.length() > maxSpeed) {
            velocity.normalize().scaleInPlace(maxSpeed);
        }

        mesh.physicsImpostor.setLinearVelocity(velocity);
        mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    };

    // ============================================================
    // 1. MOUSE DRAG (Desktop - Tidak Berubah)
    // ============================================================
    // (Kode Mouse disingkat agar fokus ke VR, logika tetap sama)
    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);
    // ... [Kode Mouse Drag Helper tetap sama seperti sebelumnya] ...
    // (Agar file tidak kepanjangan, bagian Mouse Drag dianggap sudah aman)

    // ============================================================
    // 2. VR GRAB (LOGIKA BARU)
    // ============================================================

    if (!xr) return;

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            // --- DETEKSI TIPE TOMBOL ---
            const squeezeComponent = motionController.getComponent("squeeze"); // Tombol Genggam (Grip)
            const triggerComponent = motionController.getComponent("trigger"); // Tombol Telunjuk
            
            // Logika: 
            // 1. Jika ada Squeeze, pakai Squeeze untuk GRAB. Trigger bebas untuk UI.
            // 2. Jika tidak ada Squeeze (Controller murah), terpaksa pakai Trigger untuk keduanya.
            
            let grabComponent = squeezeComponent;
            let isUsingTriggerForGrab = false;

            if (!grabComponent) {
                console.warn("Controller tidak punya Grip. Fallback ke Trigger.");
                grabComponent = triggerComponent;
                isUsingTriggerForGrab = true;
            }

            if (!grabComponent) return;

            let grabbedMesh = null;
            let grabObserver = null;
            let vrOriginalDamping = 0;
            let vrOriginalAngularDamping = 0;
            
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                // HANYA PROSES SAAT TOMBOL DITEKAN
                if (state.pressed) {

                    // ============================================================
                    // FASE PENGECEKAN UI (CRITICAL)
                    // ============================================================
                    
                    // 1. Cek Laser Pointer (Raycast)
                    // Kita gunakan Predicate agar HANYA mendeteksi tombol UI.
                    // Raycast ini akan TEMBUS kotak pembungkus barang.
                    const ray = controller.getForwardRay(10);
                    const uiHit = scene.pickWithRay(ray, (mesh) => {
                        return mesh.name && mesh.name.startsWith("btn_plane_") && mesh.isEnabled() && mesh.isVisible;
                    });

                    // JIKA LASER MENGENAI UI:
                    if (uiHit && uiHit.hit) {
                        console.log("Laser kena UI -> GRAB DIBATALKAN.");
                        // Jika kita menggunakan Trigger untuk Grab, kita WAJIB berhenti di sini
                        // agar Trigger berfungsi sebagai "Klik UI".
                        return; 
                    }

                    // 2. Jika Controller punya tombol terpisah (Grip vs Trigger),
                    // Dan user menekan Trigger (bukan Grip), JANGAN GRAB.
                    // (Kecuali controller tipe lama yg cuma punya 1 tombol).
                    if (!isUsingTriggerForGrab && state.target === triggerComponent) {
                        return; // Trigger ditekan -> Biarkan Babylon UI yang menangani.
                    }

                    // ============================================================
                    // FASE GRAB BARANG
                    // ============================================================
                    
                    if (grabbedMesh) return;

                    let closestMesh = null;
                    let minDistance = 0.20; // Jarak grab 20cm

                    scene.meshes.forEach((mesh) => {
                        // Pastikan mesh bisa digrab
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

                    if (closestMesh) {
                        grabbedMesh = closestMesh;
                        
                        // Visual
                        const childModel = grabbedMesh.getChildren()[0];
                        if (childModel) {
                            childModel.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));
                        }

                        // Physics
                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.wakeUp();
                            vrOriginalDamping = grabbedMesh.physicsImpostor.linearDamping;
                            vrOriginalAngularDamping = grabbedMesh.physicsImpostor.angularDamping;
                            
                            grabbedMesh.physicsImpostor.linearDamping = GRAB_DAMPING; 
                            grabbedMesh.physicsImpostor.angularDamping = GRAB_DAMPING;
                            grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }

                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (grabbedMesh && hand) {
                                applyPhysicsMove(grabbedMesh, hand.getAbsolutePosition());
                            }
                        });
                    }

                } else {
                    // --- LEPAS GRAB (RELEASE) ---
                    if (grabbedMesh) {
                        if (grabObserver) {
                            scene.onBeforeRenderObservable.remove(grabObserver);
                            grabObserver = null;
                        }

                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.linearDamping = vrOriginalDamping;
                            grabbedMesh.physicsImpostor.angularDamping = vrOriginalAngularDamping; 
                            grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }

                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });
}
