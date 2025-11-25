// js/interactions.js (Final: Dead Drop / Jatuh Tegak Lurus)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab (Dead Drop Release)...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI ---
    const MOVE_FORCE = 40;     
    const ROTATE_FORCE = 10;   
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

        // 1. POSISI
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

        // 2. ROTASI
        if (targetRotationQuat && mesh.rotationQuaternion) {
            const qDiff = targetRotationQuat.multiply(BABYLON.Quaternion.Inverse(mesh.rotationQuaternion));
            const { x, y, z } = qDiff.toEulerAngles();

            const fixAngle = (angle) => {
                if (angle > Math.PI) return angle - 2 * Math.PI;
                if (angle < -Math.PI) return angle + 2 * Math.PI;
                return angle;
            };

            const angVel = new BABYLON.Vector3(fixAngle(x), fixAngle(y), fixAngle(z));
            mesh.physicsImpostor.setAngularVelocity(angVel.scale(ROTATE_FORCE));
        }
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
                    
                    // --- MATIKAN KECEPATAN (MOUSE) ---
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

                    // 1. CEK UI (Raycast Filter)
                    const ray = controller.getForwardRay(5); 
                    const hitInfo = scene.pickWithRay(ray, (mesh) => {
                        return mesh.name.startsWith("btn_plane_") || mesh.name.startsWith("btn_gui_");
                    });

                    if (hitInfo && hitInfo.hit) {
                        return; 
                    }

                    // 2. Logika Jarak
                    let closestMesh = null;
                    let minDistance = 0.25; 

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
                                    hand.rotationQuaternion 
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

                            // --- BAGIAN INI YANG DIPERBAIKI (DEAD DROP) ---
                            // Paksa kecepatan menjadi NOL (Berhenti total di udara lalu jatuh karena gravitasi)
                            grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            
                            // Paksa putaran berhenti juga
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }

                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });

    console.log("✅ Logika grab Dead Drop (Jatuh Tegak) diinisialisasi.");
}
