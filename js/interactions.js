// js/grab.js (Versi FIX: Mass Tetap, 3D Movement, Anti-Tembus)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab FIX...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI ---
    const RESPONSE_SPEED = 20; // Responsif
    const MAX_VELOCITY = 5;    // Batas kecepatan (Anti-Jebol dinding)
    const MAX_DISTANCE = 1.0;  // Batas jarak tarikan efektif

    // --- HELPER 1: RAYCAST BLOCKER (Anti Tembus) ---
    const getSafeTarget = (currentPos, targetPos, selfMesh) => {
        const direction = targetPos.subtract(currentPos);
        const length = direction.length();
        
        // Deadzone kecil biar gak getar
        if (length < 0.1) return targetPos;

        direction.normalize();

        const ray = new BABYLON.Ray(currentPos, direction, length);

        // Filter: Abaikan diri sendiri, lantai, dan tombol UI
        const hit = scene.pickWithRay(ray, (mesh) => {
            return mesh !== selfMesh && 
                   mesh.name !== "ground" && 
                   !mesh.name.startsWith("btn_"); 
        });

        if (hit.hit && hit.pickedPoint) {
            // Mundur dikit dari dinding (0.1 meter) biar gak nempel tembok
            return hit.pickedPoint.subtract(direction.scale(0.1)); 
        }

        return targetPos; 
    };

    // --- HELPER 2: CALCULATE VELOCITY ---
    const calculateSafeVelocity = (currentPos, rawTargetPos, physicsImpostor) => {
        // 1. Cek Raycast (Dinding/Atap)
        const safeTarget = getSafeTarget(currentPos, rawTargetPos, physicsImpostor.object);

        // 2. Hitung Vektor Arah
        let directionVector = safeTarget.subtract(currentPos);
        let dist = directionVector.length();

        // 3. Batasi Jarak Tarikan (Supaya tidak "meledak" saat mouse jauh)
        if (dist > MAX_DISTANCE) {
            directionVector = directionVector.normalize().scale(MAX_DISTANCE);
        }

        // 4. Hitung Kecepatan
        let velocity = directionVector.scale(RESPONSE_SPEED);

        // 5. Hard Limit Kecepatan (Supaya physics engine sempat deteksi tabrakan)
        if (velocity.length() > MAX_VELOCITY) {
            velocity = velocity.normalize().scale(MAX_VELOCITY);
        }

        return velocity;
    };

    // ============================================================
    // 1. MOUSE DRAG (Desktop)
    // ============================================================

    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];

            // PENTING: Jangan set normal di constructor agar fleksibel
            const dragBehavior = new BABYLON.PointerDragBehavior();
            dragBehavior.moveAttached = false; // Kita gerakkan manual pakai fisika
            
            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add(() => {
                // 1. UPDATE DRAG PLANE KE ARAH KAMERA
                // Ini kuncinya agar bisa naik/turun mengikuti pandangan mata
                if (scene.activeCamera) {
                    dragBehavior.options.dragPlaneNormal = scene.activeCamera.getForwardRay().direction.scale(-1);
                }

                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.wakeUp();
                    
                    // --- JANGAN SET MASS JADI 0 ---
                    // Biarkan mass normal. Velocity kita akan melawan gravitasi.
                    
                    // Reset momentum
                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
                
                if (childModel) {
                    childModel.getChildMeshes(false).forEach(m => hlMouse.addMesh(m, highlightColor));
                }
            });

            dragBehavior.onDragObservable.add((event) => {
                if (!wrapper.physicsImpostor) return;

                const currentPos = wrapper.getAbsolutePosition();
                const rawTargetPos = event.dragPlanePoint;

                // Hitung velocity aman
                const safeVelocity = calculateSafeVelocity(currentPos, rawTargetPos, wrapper.physicsImpostor);

                // Terapkan gerak
                wrapper.physicsImpostor.setLinearVelocity(safeVelocity);
                
                // Matikan rotasi liar
                wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            });

            dragBehavior.onDragEndObservable.add(() => {
                hlMouse.removeAllMeshes();
                if (wrapper.physicsImpostor) {
                    // Rem sedikit saat dilepas
                    const currentVel = wrapper.physicsImpostor.getLinearVelocity();
                    wrapper.physicsImpostor.setLinearVelocity(currentVel.scale(0.1));
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
            });
        }
    });

    // ============================================================
    // 2. VR GRAB (Logic Sama)
    // ============================================================

    if (!xr) return;

    const hlVR = new BABYLON.HighlightLayer("HL_VR_PHYSICS", scene);

    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            const grabComponent = motionController.getComponent("trigger") || motionController.getComponent("squeeze");
            if (!grabComponent) return;

            let grabbedMesh = null;
            let grabObserver = null;
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                if (state.pressed) {
                    if (grabbedMesh) return; 

                    // Cek UI
                    if (xr.pointerSelection) {
                        const hit = xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
                        if (hit && hit.name.startsWith("btn_plane_")) return; 
                    }

                    // Cari Mesh Terdekat
                    let closest = null;
                    let minDst = 0.25;
                    scene.meshes.forEach((m) => {
                        if (m.metadata && m.metadata.isGrabbable) {
                            const d = BABYLON.Vector3.Distance(m.getAbsolutePosition(), hand.getAbsolutePosition());
                            if (d < minDst) { minDst = d; closest = m; }
                        }
                    });

                    if (closest) {
                        grabbedMesh = closest;
                        grabbedMesh.physicsImpostor.wakeUp();
                        // Jangan ubah mass jadi 0
                        
                        const child = grabbedMesh.getChildren()[0];
                        if (child) child.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));

                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (!grabbedMesh || !grabbedMesh.physicsImpostor) return;

                            const currentPos = grabbedMesh.getAbsolutePosition();
                            const rawTargetPos = hand.getAbsolutePosition();
                            
                            const safeVelocity = calculateSafeVelocity(currentPos, rawTargetPos, grabbedMesh.physicsImpostor);

                            grabbedMesh.physicsImpostor.setLinearVelocity(safeVelocity);
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        });
                    }
                } else {
                    if (grabbedMesh) {
                        scene.onBeforeRenderObservable.remove(grabObserver);
                        grabObserver = null;
                        
                        // Rem saat dilepas
                        if (grabbedMesh.physicsImpostor) {
                             const v = grabbedMesh.physicsImpostor.getLinearVelocity();
                             grabbedMesh.physicsImpostor.setLinearVelocity(v.scale(0.1));
                        }

                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });

    console.log("✅ Interaksi 3D Fix: Mass Normal + Auto-Plane.");
}
