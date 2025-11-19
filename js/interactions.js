// js/grab.js (Final - Termasuk UI Fix dan addMesh Fix)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab (VR & Mouse)...");

    const highlightColor = new BABYLON.Color3.Green();
    const originalMass = 1; // Massa asli item (sesuai itemDatabase)


    // ============================================================
    // 1. MOUSE DRAG (Desktop)
    // ============================================================

    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];
            const dragBehavior = new BABYLON.PointerDragBehavior({});
            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add(() => {
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.setMass(0);
                    wrapper.physicsImpostor.sleep();
                }
                if (childModel) {
                    // [FIX] Gunakan getChildMeshes
                    childModel.getChildMeshes(false).forEach(m => {
                        hlMouse.addMesh(m, highlightColor);
                    });
                }
            });

            dragBehavior.onDragEndObservable.add(() => {
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.setMass(originalMass);
                    wrapper.physicsImpostor.wakeUp();
                }
                hlMouse.removeAllMeshes();
            });
        }
    });

    // ============================================================
    // 2. VR GRAB (Virtual Reality)
    // ============================================================

    if (!xr) {
        console.warn("VR (xr) tidak aktif. VR Grab tidak diinisialisasi.");
        return;
    }

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            const triggerComponent = motionController.getComponent("trigger");
            const squeezeComponent = motionController.getComponent("squeeze");
            const grabComponent = triggerComponent || squeezeComponent;
            
            if (!grabComponent) return;

            let grabbedMesh = null;
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                if (state.pressed) {
                    // --- COBA GRAB ---
                    if (grabbedMesh) return; 

                    // =================================================
                    // === INI ADALAH BAGIAN PENTING UNTUK FIX UI ===
                    //
                    // Cek apakah pointer sedang di atas tombol "i"
                    if (xr.pointerSelection) {
                        const meshUnderPointer = xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
                        
                        // Jika pointer menunjuk ke "btn_plane_" (tombol 'i')
                        if (meshUnderPointer && meshUnderPointer.name.startsWith("btn_plane_")) {
                            // Batalkan grab. Biarkan UI (dari HTML) menangani klik.
                            console.log("Pointer di atas UI, grab dibatalkan.");
                            return; 
                        }
                    }
                    // =================================================


                    // --- Logika Grab (Jarak) ---
                    // Kode ini hanya akan berjalan jika pointer TIDAK di atas tombol 'i'
                    let closestMesh = null;
                    let minDistance = 0.2; 

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

                    if (closestMesh) {
                        grabbedMesh = closestMesh;

                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.setMass(0);
                            grabbedMesh.physicsImpostor.sleep();
                        }

                        grabbedMesh.setParent(hand);

                        const childModel = grabbedMesh.getChildren()[0];
                        if (childModel) {
                            // [FIX] Gunakan getChildMeshes
                            childModel.getChildMeshes(false).forEach(m => {
                                hlVR.addMesh(m, highlightColor);
                            });
                        }
                    }

                } else {
                    // --- COBA RELEASE ---
                    if (grabbedMesh) {
                        
                        grabbedMesh.setParent(null);

                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.setMass(originalMass);
                            grabbedMesh.physicsImpostor.wakeUp();

                            const linearVelocity = hand.getLinearVelocity();
                            const angularVelocity = hand.getAngularVelocity();

                            if (linearVelocity) {
                                grabbedMesh.physicsImpostor.setLinearVelocity(
                                    linearVelocity.scale(1.5)
                                );
                            }
                            if (angularVelocity) {
                                grabbedMesh.physicsImpostor.setAngularVelocity(
                                    angularVelocity.scale(1.5)
                                );
                            }
                        }

                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });

    console.log("✅ Logika grab (Mouse & VR) berhasil diinisialisasi.");
}