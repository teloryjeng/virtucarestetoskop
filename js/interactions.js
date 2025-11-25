// js/interactions.js (Versi UI Priority & Smooth Physics)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab (UI Priority Fix)...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI RESPONSIVITAS ---
    const MOVE_FORCE = 40;     
    const ROTATE_FORCE = 10;   
    const GRAB_DAMPING = 0.5;  
    
    // Variabel state Mouse
    let currentMouseDragTarget = null;
    let currentMouseDragMesh = null;
    let mouseObserver = null;
    let originalDamping = 0;

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
        if (distance > 0.5) factor = 0.1; // Jika stuck jauh, kurangi tenaga

        const velocity = diff.scale(MOVE_FORCE * factor);
        
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
    // (Bagian Mouse tidak berubah karena pakai pointer terpisah)
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
                    wrapper.physicsImpostor.linearDamping = GRAB_DAMPING; 
                    wrapper.physicsImpostor.angularDamping = 0.5;
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
                    currentMouseDragMesh.physicsImpostor.angularDamping = 0;
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
    // 2. VR GRAB (Virtual Reality - UI Priority Fix)
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
            let grabObserver = null;
            let vrOriginalDamping = 0;
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                if (state.pressed) {
                    // --- GRAB START ---
                    if (grabbedMesh) return; 

                    // ===========================================================
                    // FIX UI: CEK LASER POINTER TERLEBIH DAHULU
                    // ===========================================================
                    // Kita menembakkan sinar (Ray) dari kontroler.
                    // Kita mencari HANYA mesh yang namanya diawali "btn_plane_"
                    // Jika kena, maka BERHENTI (return), jangan jalankan logika Grab.
                    
                    const ray = controller.getForwardRay(5); // Panjang sinar 5 meter
                    const hitInfo = scene.pickWithRay(ray, (mesh) => {
                        // Filter: Hanya cek mesh yang namanya tombol UI
                        return mesh.name.startsWith("btn_plane_") || mesh.name.startsWith("btn_gui_");
                    });

                    if (hitInfo && hitInfo.hit) {
                        console.log("Pointer mengenai UI: " + hitInfo.pickedMesh.name + ". Grab dibatalkan.");
                        return; // <--- INI KUNCINYA. Hentikan Grab.
                    }
                    // ===========================================================

                    // --- Logika Grab Normal ---
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
                            grabbedMesh.physicsImpostor.linearDamping = GRAB_DAMPING; 
                            grabbedMesh.physicsImpostor.angularDamping = 0.5;
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
                            grabbedMesh.physicsImpostor.linearDamping = vrOriginalDamping;
                            grabbedMesh.physicsImpostor.angularDamping = 0; 
                        }
                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });

    console.log("✅ Logika grab UI Priority & Smooth Physics berhasil diinisialisasi.");
}


