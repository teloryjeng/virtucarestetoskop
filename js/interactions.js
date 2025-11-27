// js/interactions.js (Final: Strict Input Mapping)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi VR (Grip = Grab, Trigger = UI)...");

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

    // --- MOUSE DRAG (Desktop) ---
    // (Biarkan kode mouse drag seperti sebelumnya, tidak diubah)
    // ...

    // --- VR GRAB (LOGIKA BARU) ---
    if (!xr) return;

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            
            // KITA HANYA MENDENGARKAN TOMBOL SQUEEZE (GRIP) UNTUK GRAB
            const squeezeComponent = motionController.getComponent("squeeze");
            
            // Fallback: Jika controller tidak punya Squeeze (misal Cardboard), baru pakai Trigger
            const triggerComponent = motionController.getComponent("trigger");
            let grabComponent = squeezeComponent; 
            
            // Variabel penanda apakah kita terpaksa pakai trigger
            let forcedTrigger = false;

            if (!grabComponent) {
                console.log("Controller tanpa Grip terdeteksi. Menggunakan Trigger untuk Grab.");
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

                    // 1. JIKA TERPAKSA PAKAI TRIGGER (Controller Lama):
                    // Cek dulu apakah laser kena UI? Jika ya, jangan Grab.
                    if (forcedTrigger) {
                        const ray = controller.getForwardRay(10);
                        const uiHit = scene.pickWithRay(ray, (m) => m.name && m.name.startsWith("btn_plane_"));
                        if (uiHit && uiHit.hit) return; // Prioritas UI
                    }

                    // 2. LOGIKA GRAB
                    // (Karena Squeeze tombolnya beda dengan Trigger, tidak akan konflik dengan UI)
                    if (grabbedMesh) return;

                    let closestMesh = null;
                    let minDistance = 0.20; // Jarak 20cm

                    scene.meshes.forEach((mesh) => {
                        // Cek metadata grabbable
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
                        
                        // Highlight
                        const childModel = grabbedMesh.getChildren()[0];
                        if (childModel) childModel.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));

                        // Physics
                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.wakeUp();
                            originalDamping.linear = grabbedMesh.physicsImpostor.linearDamping;
                            originalDamping.angular = grabbedMesh.physicsImpostor.angularDamping;
                            
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
