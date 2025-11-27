// js/interactions.js (Final: Tombol A untuk Info, Trigger untuk Grab)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi: A=Info, Trigger=Grab...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI ---
    const MOVE_FORCE = 40;     
    const GRAB_DAMPING = 0.5;  

    // Variabel helper
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
        
        // Kunci Rotasi (Jatuh tegak)
        mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());

        // Gerakan Posisi
        const currentPos = mesh.getAbsolutePosition();
        const diff = targetPosition.subtract(currentPos);
        const distance = diff.length();
        
        let factor = 1.0;
        if (distance > 0.5) factor = 0.1; 

        const velocity = diff.scale(MOVE_FORCE * factor);
        const maxSpeed = 5; 
        if (velocity.length() > maxSpeed) {
            velocity.normalize().scaleInPlace(maxSpeed);
        }
        mesh.physicsImpostor.setLinearVelocity(velocity);
    };

    // ============================================================
    // 1. MOUSE DRAG (Desktop - Tidak Berubah)
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
                scene.onBeforeRenderObservable.remove(mouseObserver);
                mouseObserver = null;
                currentMouseDragTarget = null;
                currentMouseDragMesh = null;
                hlMouse.removeAllMeshes();
            });
        }
    });

    // ============================================================
    // 2. VR INPUT (Virtual Reality)
    // ============================================================

    if (!xr) return;

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            const hand = controller.grip || controller.pointer;
            const isRightHand = controller.inputSource.handedness === 'right';

            // ------------------------------------------------------
            // A. FITUR TOMBOL 'A' (KHUSUS KANAN) - UNTUK INFO UI
            // ------------------------------------------------------
            if (isRightHand) {
                // Cari tombol 'a-button'
                const aButton = motionController.getComponent("a-button");
                
                if (aButton) {
                    aButton.onButtonStateChangedObservable.add((state) => {
                        // Hanya bereaksi saat ditekan (pressed)
                        if (state.pressed) {
                            console.log("Tombol A ditekan! Mencari target UI...");

                            // 1. Cek Raycast (Laser)
                            const ray = controller.getForwardRay(10); // Laser panjang 10m
                            const hitInfo = scene.pickWithRay(ray, (mesh) => {
                                // Cari mesh yang punya metadata isInfoButton
                                return mesh.metadata && mesh.metadata.isInfoButton;
                            });

                            if (hitInfo && hitInfo.hit) {
                                console.log("Laser mengenai UI:", hitInfo.pickedMesh.name);
                                // Panggil aksi yang disimpan di metadata
                                if (hitInfo.pickedMesh.metadata.action) {
                                    hitInfo.pickedMesh.metadata.action(); 
                                }
                                return; // Selesai, jangan cek jarak lagi
                            }

                            // 2. Cek Proximity (Jarak Dekat) - Cadangan jika laser meleset
                            // Berguna jika tangan menembus tombol
                            let closestBtn = null;
                            let closestDist = 0.3; // Jarak toleransi 30cm

                            scene.meshes.forEach((m) => {
                                if (m.metadata && m.metadata.isInfoButton && m.isEnabled()) {
                                    const d = BABYLON.Vector3.Distance(m.getAbsolutePosition(), hand.getAbsolutePosition());
                                    if (d < closestDist) {
                                        closestDist = d;
                                        closestBtn = m;
                                    }
                                }
                            });

                            if (closestBtn) {
                                console.log("Tangan dekat dengan UI:", closestBtn.name);
                                closestBtn.metadata.action();
                            }
                        }
                    });
                }
            }

            // ------------------------------------------------------
            // B. FITUR GRAB (TRIGGER / SQUEEZE) - UNTUK BARANG
            // ------------------------------------------------------
            const triggerComponent = motionController.getComponent("trigger");
            const squeezeComponent = motionController.getComponent("squeeze");
            const grabComponent = triggerComponent || squeezeComponent;
            
            if (grabComponent) {
                let grabbedMesh = null;
                let grabObserver = null;
                let vrOriginalDamping = 0;
                let vrOriginalAngularDamping = 0;

                grabComponent.onButtonStateChangedObservable.add((state) => {
                    if (state.pressed) {
                        // --- GRAB START ---
                        if (grabbedMesh) return;

                        // Cari barang terdekat (Logika Grab Biasa)
                        let closestMesh = null;
                        let minDistance = 0.25; 

                        scene.meshes.forEach((mesh) => {
                            if (mesh.metadata && mesh.metadata.isGrabbable) {
                                const dist = BABYLON.Vector3.Distance(mesh.getAbsolutePosition(), hand.getAbsolutePosition());
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    closestMesh = mesh;
                                }
                            }
                        });

                        if (closestMesh) {
                            grabbedMesh = closestMesh;
                            const childModel = grabbedMesh.getChildren()[0];
                            if (childModel) childModel.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));

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
                        // --- GRAB RELEASE ---
                        if (grabbedMesh) {
                            scene.onBeforeRenderObservable.remove(grabObserver);
                            grabObserver = null;

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
            }
        });
    });

    console.log("✅ Logika Input VR Siap.");
}
