// js/interactions.js (Final: Input Separation Fix)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab (Separated Input)...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI ---
    const MOVE_FORCE = 40;     
    const GRAB_DAMPING = 0.5;  

    // Variabel state Mouse
    let currentMouseDragTarget = null;
    let currentMouseDragMesh = null;
    let mouseObserver = null;
    let originalDamping = 0;
    let originalAngularDamping = 0;

    // ============================================================
    // FUNGSI HELPER: GERAKAN FISIKA
    // ============================================================
    const applyPhysicsMove = (mesh, targetPosition, targetRotationQuat) => { 
        if (!mesh.physicsImpostor) return;
        const body = mesh.physicsImpostor.physicsBody;
        if (!body) return;

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
        mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    };


    // ============================================================
    // 1. MOUSE DRAG (Desktop)
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
                if (childModel) {
                    childModel.getChildMeshes(false).forEach(m => hlMouse.addMesh(m, highlightColor));
                }
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
                        applyPhysicsMove(currentMouseDragMesh, currentMouseDragTarget, null); 
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
    // 2. VR GRAB (Virtual Reality) - DIPERBAIKI
    // ============================================================

    if (!xr) { return; }

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            const triggerComponent = motionController.getComponent("trigger");
            const squeezeComponent = motionController.getComponent("squeeze");

            // --- PERUBAHAN UTAMA DI SINI ---
            // Kita pisahkan tombol:
            // Squeeze (Grip) -> GRAB BARANG (Fisika)
            // Trigger (Telunjuk) -> INTERAKSI UI (Bawaan Babylon)
            
            // Jika controller punya tombol Squeeze (seperti Oculus Quest/Pico), gunakan itu.
            // Jika tidak (controller jadul), baru fallback ke trigger.
            let grabComponent = squeezeComponent; 
            let isUsingTriggerFallback = false;

            if (!grabComponent) {
                grabComponent = triggerComponent;
                isUsingTriggerFallback = true;
                console.log("Controller tidak memiliki Grip, menggunakan Trigger untuk Grab (Risiko konflik UI tinggi).");
            }

            if (!grabComponent) return;

            let grabbedMesh = null;
            let grabObserver = null;
            let vrOriginalDamping = 0;
            let vrOriginalAngularDamping = 0;
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                if (state.pressed) {
                    // --- GRAB START ---
                    
                    // 1. SAFETY CHECK: UI PROTECTION
                    // Meskipun kita sudah memisah tombol, kita tetap pasang pengaman.
                    // Jika user menekan Grip tapi raycast-nya menunjuk ke tombol UI, batalkan grab.
                    
                    let isInteractingWithUI = false;

                    // A. Cek Raycast Khusus Tombol UI
                    const ray = controller.getForwardRay(5); 
                    const hitInfo = scene.pickWithRay(ray, (mesh) => {
                        // Hanya return true jika mesh adalah TOMBOL UI
                        return mesh.name && mesh.name.startsWith("btn_plane_") && mesh.isEnabled();
                    });

                    if (hitInfo && hitInfo.hit) {
                        console.log("Grab dibatalkan: Raycast mengenai UI");
                        isInteractingWithUI = true;
                    }

                    // B. Cek Proximity (Jarak Dekat)
                    if (!isInteractingWithUI) {
                        let closestUiDist = 999;
                        scene.meshes.forEach((m) => {
                            if (m.name && m.name.startsWith("btn_plane_") && m.isEnabled()) {
                                const dist = BABYLON.Vector3.Distance(m.getAbsolutePosition(), hand.getAbsolutePosition());
                                if (dist < closestUiDist) closestUiDist = dist;
                            }
                        });
                        // Jika tangan sangat dekat dengan tombol (20cm), jangan grab barang
                        if (closestUiDist < 0.20) {
                            console.log("Grab dibatalkan: Tangan terlalu dekat dengan UI");
                            isInteractingWithUI = true;
                        }
                    }

                    // JIKA TERDETEKSI UI, JANGAN PROSES GRAB FISIKA
                    if (isInteractingWithUI) {
                        return; 
                    }

                    // 2. LOGIKA GRAB BARANG
                    if (grabbedMesh) return; 

                    let closestMesh = null;
                    let minDistance = 0.20; // Perkecil sedikit jarak grab agar lebih presisi (20cm)

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

                        const childModel = grabbedMesh.getChildren()[0];
                        if (childModel) {
                            childModel.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));
                        }

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
                                applyPhysicsMove(
                                    grabbedMesh, 
                                    hand.getAbsolutePosition(), 
                                    null 
                                );
                            }
                        });
                    }

                } else {
                    // --- GRAB RELEASE ---
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

    console.log("✅ Logika grab VR (Prioritas Grip) diinisialisasi.");
}
