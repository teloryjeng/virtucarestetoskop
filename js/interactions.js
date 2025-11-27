// js/interactions.js (Final: Strict UI Priority)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi VR (Strict UI Check)...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI ---
    const MOVE_FORCE = 40;     
    const GRAB_DAMPING = 0.5;  

    // Variabel state Mouse (Desktop)
    let currentMouseDragTarget = null;
    let currentMouseDragMesh = null;
    let mouseObserver = null;
    let originalDamping = 0;
    let originalAngularDamping = 0;

    // ============================================================
    // FUNGSI HELPER: GERAKAN FISIKA
    // ============================================================
    const applyPhysicsMove = (mesh, targetPosition) => { 
        if (!mesh.physicsImpostor) return;
        const body = mesh.physicsImpostor.physicsBody;
        if (!body) return;

        const currentPos = mesh.getAbsolutePosition();
        const diff = targetPosition.subtract(currentPos);
        
        let factor = 1.0;
        if (diff.length() > 0.5) factor = 0.1; 

        const velocity = diff.scale(MOVE_FORCE * factor);
        const maxSpeed = 5; 
        if (velocity.length() > maxSpeed) {
            velocity.normalize().scaleInPlace(maxSpeed);
        }

        mesh.physicsImpostor.setLinearVelocity(velocity);
        // KUNCI ROTASI: Agar barang tidak berputar liar saat dipegang
        mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    };

    // ============================================================
    // 1. MOUSE DRAG (Desktop - Tetap Sama)
    // ============================================================
    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);
    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];
            const dragBehavior = new BABYLON.PointerDragBehavior({});
            dragBehavior.moveAttached = false; 
            
            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add((event) => {
                currentMouseDragMesh = wrapper;
                if (childModel) childModel.getChildMeshes(false).forEach(m => hlMouse.addMesh(m, highlightColor));
                
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.wakeUp();
                    originalDamping = wrapper.physicsImpostor.linearDamping;
                    originalAngularDamping = wrapper.physicsImpostor.angularDamping;
                    wrapper.physicsImpostor.linearDamping = GRAB_DAMPING; 
                    wrapper.physicsImpostor.angularDamping = GRAB_DAMPING; 
                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
                mouseObserver = scene.onBeforeRenderObservable.add(() => {
                    if (currentMouseDragMesh && currentMouseDragTarget) {
                        applyPhysicsMove(currentMouseDragMesh, currentMouseDragTarget); 
                    }
                });
            });

            dragBehavior.onDragObservable.add((event) => {
                currentMouseDragTarget = event.dragPlanePoint;
            });

            dragBehavior.onDragEndObservable.add(() => {
                if (currentMouseDragMesh && currentMouseDragMesh.physicsImpostor) {
                    currentMouseDragMesh.physicsImpostor.linearDamping = originalDamping;
                    currentMouseDragMesh.physicsImpostor.angularDamping = originalAngularDamping;
                    currentMouseDragMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    currentMouseDragMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
                if (mouseObserver) {
                    scene.onBeforeRenderObservable.remove(mouseObserver);
                    mouseObserver = null;
                }
                currentMouseDragTarget = null;
                currentMouseDragMesh = null;
                hlMouse.removeAllMeshes();
            });
        }
    });

    // ============================================================
    // 2. VR GRAB (Virtual Reality - PERBAIKAN RAYCAST)
    // ============================================================

    if (!xr) return;

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            // Prioritas: Gunakan Grip (Squeeze) untuk Grab jika ada.
            // Jika tidak ada, baru pakai Trigger.
            const squeezeComponent = motionController.getComponent("squeeze");
            const triggerComponent = motionController.getComponent("trigger");
            
            let grabComponent = squeezeComponent || triggerComponent;
            
            if (!grabComponent) return;

            let grabbedMesh = null;
            let grabObserver = null;
            let vrOriginalDamping = 0;
            let vrOriginalAngularDamping = 0;
            
            // Hand node (posisi tangan/controller)
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                if (state.pressed) {
                    // --- FASE 1: CEK UI (PROTEKSI KETAT) ---
                    
                    // Kita gunakan RAYCAST DENGAN FILTER (PREDICATE).
                    // Filter ini menyuruh raycast untuk MENGABAIKAN semua mesh 
                    // KECUALI yang namanya diawali "btn_plane_".
                    // Ini membuat invisible box tidak akan menghalangi deteksi tombol UI.

                    const ray = controller.getForwardRay(10); // Panjang ray 10 meter
                    
                    const uiHit = scene.pickWithRay(ray, (mesh) => {
                        // HANYA cek jika mesh adalah tombol UI & sedang aktif
                        return mesh.name && mesh.name.startsWith("btn_plane_") && mesh.isEnabled() && mesh.isVisible;
                    });

                    // JIKA KENA TOMBOL UI -> BATALKAN GRAB!
                    if (uiHit && uiHit.hit) {
                        console.log("UI Hit Detected (Strict) - GRAB DIBATALKAN");
                        return; // Keluar dari fungsi, jangan jalankan logika grab
                    }
                    
                    // --- FASE 2: LOGIKA GRAB BARANG ---
                    
                    if (grabbedMesh) return; // Sudah megang barang? Skip.

                    let closestMesh = null;
                    let minDistance = 0.20; // Jarak 20cm

                    scene.meshes.forEach((mesh) => {
                        // Hanya cek mesh yang boleh digrab
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
                        // Mulai Grab
                        grabbedMesh = closestMesh;
                        console.log("Grabbing:", grabbedMesh.name);

                        // Visual Highlight
                        const childModel = grabbedMesh.getChildren()[0];
                        if (childModel) {
                            childModel.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));
                        }

                        // Physics Setup
                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.wakeUp();
                            
                            vrOriginalDamping = grabbedMesh.physicsImpostor.linearDamping;
                            vrOriginalAngularDamping = grabbedMesh.physicsImpostor.angularDamping;
                            
                            // Perberat damping agar barang tidak melayang terlalu cepat (seperti di air)
                            grabbedMesh.physicsImpostor.linearDamping = GRAB_DAMPING; 
                            grabbedMesh.physicsImpostor.angularDamping = GRAB_DAMPING;

                            // Reset momentum
                            grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }

                        // Loop Update Posisi
                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (grabbedMesh && hand) {
                                applyPhysicsMove(grabbedMesh, hand.getAbsolutePosition());
                            }
                        });
                    }

                } else {
                    // --- GRAB RELEASE (Lepas Barang) ---
                    if (grabbedMesh) {
                        if (grabObserver) {
                            scene.onBeforeRenderObservable.remove(grabObserver);
                            grabObserver = null;
                        }

                        if (grabbedMesh.physicsImpostor) {
                            // Kembalikan sifat fisik asli
                            grabbedMesh.physicsImpostor.linearDamping = vrOriginalDamping;
                            grabbedMesh.physicsImpostor.angularDamping = vrOriginalAngularDamping; 
                            
                            // Stop total saat dilepas (agar tidak mental)
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
