// js/grab.js (Versi Raycast Blocking: Solusi Akhir Anti-Tembus)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab dengan Raycast Blocker...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI ---
    const RESPONSE_SPEED = 20; // Kecepatan respon
    const MAX_VELOCITY = 4;    // Batas kecepatan maksimal (jangan terlalu tinggi)
    const MAX_DISTANCE = 0.5;  // [PENTING] Batas jarak tarikan efektif.
                               // Walau mouse 10 meter jauhnya, benda mengira mouse cuma 0.5 meter jauhnya.
                               // Ini mencegah "ledakan" kecepatan saat mouse digeser jauh.

    // Helper: Raycast untuk mencegah target tembus dinding
    // Mengembalikan posisi baru yang aman (tidak di balik dinding)
    const getSafeTarget = (currentPos, targetPos, selfMesh) => {
        const direction = targetPos.subtract(currentPos);
        const length = direction.length();
        
        // Normalisasi arah
        direction.normalize();

        // Buat Ray dari pusat benda ke arah target
        const ray = new BABYLON.Ray(currentPos, direction, length);

        // Tembakkan Ray (Abaikan diri sendiri dan UI)
        const hit = scene.pickWithRay(ray, (mesh) => {
            return mesh !== selfMesh && 
                   mesh.name !== "ground" && // Opsional: abaikan lantai jika ingin sliding lancar
                   !mesh.name.startsWith("btn_"); // Abaikan tombol UI
        });

        if (hit.hit && hit.pickedPoint) {
            // Jika kena dinding, targetnya adalah TITIK DI DINDING (dikurangi sedikit biar gak nempel banget)
            // Mundur 5cm dari dinding
            return hit.pickedPoint.subtract(direction.scale(0.05)); 
        }

        return targetPos; // Jika tidak ada halangan, target tetap posisi mouse
    };

    // Helper: Hitung Velocity Aman
    const calculateSafeVelocity = (currentPos, rawTargetPos, physicsImpostor) => {
        // 1. Cek Tabrakan Dinding (Raycast)
        const safeTarget = getSafeTarget(currentPos, rawTargetPos, physicsImpostor.object);

        // 2. Hitung Vector Arah
        let directionVector = safeTarget.subtract(currentPos);
        let dist = directionVector.length();

        // 3. [PENTING] CLAMP DISTANCE (Batas Jarak Tarikan)
        // Jika jarak > MAX_DISTANCE, anggap jaraknya cuma MAX_DISTANCE.
        // Ini mencegah tarikan "super kuat" saat mouse jauh banget.
        if (dist > MAX_DISTANCE) {
            directionVector = directionVector.normalize().scale(MAX_DISTANCE);
        }

        // 4. Hitung Velocity
        let velocity = directionVector.scale(RESPONSE_SPEED);

        // 5. Speed Limiter Terakhir (Hard Cap)
        if (velocity.length() > MAX_VELOCITY) {
            velocity = velocity.normalize().scale(MAX_VELOCITY);
        }

        return velocity;
    };

    // ============================================================
    // 1. MOUSE DRAG (Desktop - Raycast Safe)
    // ============================================================

    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];

            const dragBehavior = new BABYLON.PointerDragBehavior({
                dragPlaneNormal: new BABYLON.Vector3(0, 1, 0)
            });
            dragBehavior.moveAttached = false; 

            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add(() => {
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.wakeUp();
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

                // --- GUNAKAN FUNGSI HELPER BARU ---
                const safeVelocity = calculateSafeVelocity(currentPos, rawTargetPos, wrapper.physicsImpostor);

                wrapper.physicsImpostor.setLinearVelocity(safeVelocity);
                wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
            });

            dragBehavior.onDragEndObservable.add(() => {
                hlMouse.removeAllMeshes();
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
            });
        }
    });

    // ============================================================
    // 2. VR GRAB (VR - Raycast Safe)
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
                        
                        const child = grabbedMesh.getChildren()[0];
                        if (child) child.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));

                        // Loop Update Fisika
                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (!grabbedMesh || !grabbedMesh.physicsImpostor) return;

                            const currentPos = grabbedMesh.getAbsolutePosition();
                            const rawTargetPos = hand.getAbsolutePosition();
                            
                            // --- GUNAKAN FUNGSI HELPER BARU ---
                            const safeVelocity = calculateSafeVelocity(currentPos, rawTargetPos, grabbedMesh.physicsImpostor);

                            grabbedMesh.physicsImpostor.setLinearVelocity(safeVelocity);
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        });
                    }
                } else {
                    if (grabbedMesh) {
                        scene.onBeforeRenderObservable.remove(grabObserver);
                        grabObserver = null;
                        
                        if (grabbedMesh.physicsImpostor) {
                             grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                        }

                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });

    console.log("✅ Interaksi Raycast-Safe Siap.");
}
