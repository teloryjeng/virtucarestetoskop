// js/interactions.js (Final: Intersection Fix)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi VR (Mode: Grip & Touch)...");

    const highlightColor = new BABYLON.Color3.Green();
    const GRAB_DAMPING = 0.5;  

    // Helper Gerakan
    const applyPhysicsMove = (mesh, targetPosition) => { 
        if (!mesh.physicsImpostor) return;
        const currentPos = mesh.getAbsolutePosition();
        const diff = targetPosition.subtract(currentPos);
        let factor = (diff.length() > 0.5) ? 0.1 : 1.0; 
        const velocity = diff.scale(40 * factor);
        if (velocity.length() > 5) velocity.normalize().scaleInPlace(5);
        mesh.physicsImpostor.setLinearVelocity(velocity);
        mesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
    };

    // --- MOUSE DRAG (Desktop - Tetap) ---
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
            dragBehavior.onDragObservable.add((event) => currentMouseDragTarget = event.dragPlanePoint);
            dragBehavior.onDragEndObservable.add(() => {
                if (currentMouseDragMesh && currentMouseDragMesh.physicsImpostor) {
                    currentMouseDragMesh.physicsImpostor.linearDamping = 0; // Reset damping
                    currentMouseDragMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                }
                if (mouseObserver) { scene.onBeforeRenderObservable.remove(mouseObserver); mouseObserver = null; }
                currentMouseDragTarget = null; currentMouseDragMesh = null; hlMouse.removeAllMeshes();
            });
        }
    });

    // --- VR GRAB (LOGIKA UTAMA) ---
    if (!xr) return;

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            const squeezeComponent = motionController.getComponent("squeeze");
            const triggerComponent = motionController.getComponent("trigger");
            
            // Prioritas: Grip (Squeeze). Jika tidak ada, pakai Trigger.
            let grabComponent = squeezeComponent; 
            let forcedTrigger = false;

            if (!grabComponent) {
                grabComponent = triggerComponent;
                forcedTrigger = true;
            }

            if (!grabComponent) return;

            let grabbedMesh = null;
            let grabObserver = null;
            let originalDamping = { linear: 0, angular: 0 };
            
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                // JIKA DITEKAN
                if (state.pressed) {

                    // 1. CEK KONFLIK UI (Hanya jika pakai Trigger)
                    if (forcedTrigger) {
                        const ray = controller.getForwardRay(10);
                        const uiHit = scene.pickWithRay(ray, (m) => m.name && m.name.startsWith("btn_plane_") && m.isEnabled() && m.isVisible);
                        if (uiHit && uiHit.hit) return; 
                    }

                    // 2. CARI BARANG TERDEKAT (METODE BARU: Intersection & Distance)
                    if (grabbedMesh) return;

                    let closestMesh = null;
                    // Jarak toleransi diperbesar jadi 0.4 (40cm) agar lebih mudah kena
                    let minDistance = 0.4; 

                    scene.meshes.forEach((mesh) => {
                        if (mesh.metadata && mesh.metadata.isGrabbable) {
                            const handPos = hand.getAbsolutePosition();
                            
                            // A. Cek Jarak ke Pusat (Backup)
                            let dist = BABYLON.Vector3.Distance(mesh.getAbsolutePosition(), handPos);
                            
                            // B. Cek Apakah Tangan ADA DI DALAM Kotak (Lebih Akurat)
                            // Walaupun isPickable=false, BoundingBox tetap ada.
                            if (mesh.getBoundingInfo().boundingBox.intersectsPoint(handPos)) {
                                dist = 0; // Prioritas utama: Tangan di dalam barang
                            }

                            if (dist < minDistance) {
                                minDistance = dist;
                                closestMesh = mesh;
                            }
                        }
                    });

                    if (closestMesh) {
                        grabbedMesh = closestMesh;
                        
                        // Highlight Visual
                        const childModel = grabbedMesh.getChildren()[0];
                        if (childModel) childModel.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));

                        // Physics Setup
                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.wakeUp();
                            originalDamping.linear = grabbedMesh.physicsImpostor.linearDamping;
                            originalDamping.angular = grabbedMesh.physicsImpostor.angularDamping;
                            
                            // Rem kuat agar tidak melayang
                            grabbedMesh.physicsImpostor.linearDamping = GRAB_DAMPING; 
                            grabbedMesh.physicsImpostor.angularDamping = GRAB_DAMPING;
                            grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }

                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (grabbedMesh && hand) applyPhysicsMove(grabbedMesh, hand.getAbsolutePosition());
                        });
                    }

                } else {
                    // JIKA DILEPAS
                    if (grabbedMesh) {
                        if (grabObserver) {
                            scene.onBeforeRenderObservable.remove(grabObserver);
                            grabObserver = null;
                        }
                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.linearDamping = originalDamping.linear;
                            grabbedMesh.physicsImpostor.angularDamping = originalDamping.angular; 
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
