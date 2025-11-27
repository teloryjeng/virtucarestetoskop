// js/interactions.js (Final: UI Priority Fix)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab (Prioritas UI)...");

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
    // FUNGSI HELPER: GERAKAN FISIKA (HANYA ATUR POSISI, KUNCI ROTASI)
    // ============================================================
    const applyPhysicsMove = (mesh, targetPosition, targetRotationQuat) => { 
        if (!mesh.physicsImpostor) return;

        const body = mesh.physicsImpostor.physicsBody;
        if (!body) return;

        // 1. POSISI (Mengikuti posisi target)
        const currentPos = mesh.getAbsolutePosition();
        const diff = targetPosition.subtract(currentPos);
        const distance = diff.length();
        
        let factor = 1.0;
        if (distance > 0.5) factor = 0.1; 

        const velocity = diff.scale(MOVE_FORCE * factor);
        
        // Batas Kecepatan (Safety)
        const maxSpeed = 5; 
        if (velocity.length() > maxSpeed) {
            velocity.normalize().scaleInPlace(maxSpeed);
        }

        mesh.physicsImpostor.setLinearVelocity(velocity);

        // 2. ROTASI: KUNCI (Pastikan tidak ada momentum putar dari gerakan tangan)
        mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    };


    // ============================================================
    // 1. MOUSE DRAG (Desktop) - Tidak berubah
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
                    
                    // --- MATIKAN KECEPATAN ---
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
    // 2. VR GRAB (Virtual Reality)
    // ============================================================

    if (!xr) { return; }

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            const triggerComponent = motionController.getComponent("trigger");
            const squeezeComponent = motionController.getComponent("squeeze");
            const grabComponent = triggerComponent || squeezeComponent;
            
            if (!grabComponent) return;

            let grabbedMesh = null;
            let grabObserver = null;
            let vrOriginalDamping = 0;
            let vrOriginalAngularDamping = 0;
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                if (state.pressed) {
                    // --- GRAB START ---
                    if (grabbedMesh) return; 

                    // ==================================================
                    // 1. PENGECEKAN UI (PRIORITAS UTAMA)
                    // ==================================================
                    let isInteractingWithUI = false;

                    // A. Cek Raycast (Sinar Laser)
                    const ray = controller.getForwardRay(5); 
                    const hitInfo = scene.pickWithRay(ray, (mesh) => {
                        // Cek apakah mesh adalah tombol UI (nama dimulai dengan btn_plane_)
                        return mesh.name && mesh.name.startsWith("btn_plane_");
                    });

                    if (hitInfo && hitInfo.hit) {
                        console.log("UI Hit (Raycast) - Grab dibatalkan");
                        isInteractingWithUI = true;
                    }

                    // B. Cek Jarak Proximity ke Tombol UI (PENTING!)
                    // Jika raycast meleset sedikit, tapi tangan sangat dekat dengan tombol,
                    // kita anggap user ingin menekan tombol, bukan mengambil barang di belakangnya.
                    if (!isInteractingWithUI) {
                        // Cari tombol terdekat
                        let closestUiDist = 999;
                        scene.meshes.forEach((m) => {
                            if (m.name && m.name.startsWith("btn_plane_") && m.isEnabled()) {
                                const dist = BABYLON.Vector3.Distance(m.getAbsolutePosition(), hand.getAbsolutePosition());
                                if (dist < closestUiDist) closestUiDist = dist;
                            }
                        });

                        // Jika tangan berada dalam radius 20cm dari tombol mana pun
                        if (closestUiDist < 0.20) {
                            console.log("UI Proximity (Dekat Tombol) - Grab dibatalkan");
                            isInteractingWithUI = true;
                        }
                    }

                    // JIKA SEDANG INTERAKSI DENGAN UI, JANGAN GRAB!
                    if (isInteractingWithUI) {
                        return; 
                    }
                    // ==================================================


                    // 2. Logika Grab Barang (Jika lolos cek UI)
                    let closestMesh = null;
                    let minDistance = 0.25; // Jarak grab barang

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

                            // Matikan kecepatan awal
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
                        scene.onBeforeRenderObservable.remove(grabObserver);
                        grabObserver = null;

                        if (grabbedMesh.physicsImpostor) {
                            // Kembalikan Damping Asli
                            grabbedMesh.physicsImpostor.linearDamping = vrOriginalDamping;
                            grabbedMesh.physicsImpostor.angularDamping = vrOriginalAngularDamping; 

                            // Paksa kecepatan menjadi NOL (Jatuh tegak lurus)
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

    console.log("✅ Logika grab Rotasi Terkunci (Priority UI) diinisialisasi.");
}
