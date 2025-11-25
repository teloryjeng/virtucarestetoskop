// js/grab.js (Versi Velocity Cap: Gerak Lancar & Anti-Tembus)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab dengan Speed Limiter...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- PENGATURAN FISIKA ---
    const RESPONSE_SPEED = 15; // Seberapa cepat bereaksi (makin tinggi makin responsif)
    const MAX_VELOCITY = 5;    // [KUNCI ANTI-TEMBUS] Batas kecepatan maks (meter/detik)
                               // Jika > 10, risiko tembus dinding meningkat.
                               // Jika < 3, benda terasa sangat berat/lambat.

    // ============================================================
    // 1. MOUSE DRAG (Desktop - Velocity Based + Limiter)
    // ============================================================

    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];

            // Setup Drag Behavior
            const dragBehavior = new BABYLON.PointerDragBehavior({
                dragPlaneNormal: new BABYLON.Vector3(0, 1, 0) // Drag di bidang horizontal
            });
            
            // Matikan gerakan otomatis (kita gerakkan manual via fisika)
            dragBehavior.moveAttached = false; 

            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add(() => {
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.wakeUp();
                    // Reset kecepatan saat mulai grab agar tidak "loncat"
                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
                if (childModel) {
                    childModel.getChildMeshes(false).forEach(m => hlMouse.addMesh(m, highlightColor));
                }
            });

            dragBehavior.onDragObservable.add((event) => {
                if (!wrapper.physicsImpostor) return;

                // 1. Ambil posisi target (Mouse) dan posisi benda
                const targetPos = event.dragPlanePoint;
                const currentPos = wrapper.getAbsolutePosition();

                // 2. Hitung vektor arah (Target - Benda)
                const direction = targetPos.subtract(currentPos);
                
                // 3. Hitung kecepatan berdasarkan jarak (Semakin jauh, semakin cepat ingin mengejar)
                let velocity = direction.scale(RESPONSE_SPEED);

                // --- LOGIKA ANTI-TEMBUS (SPEED LIMITER) ---
                // Jika kecepatan yang diminta melebihi batas aman, potong kecepatannya.
                const currentSpeed = velocity.length();
                if (currentSpeed > MAX_VELOCITY) {
                    // Normalisasi vektor (jadikan panjang 1) lalu kalikan dengan MAX
                    velocity = velocity.normalize().scale(MAX_VELOCITY);
                }
                
                // 4. Terapkan kecepatan ke benda
                wrapper.physicsImpostor.setLinearVelocity(velocity);
                
                // 5. Kunci Rotasi (Agar benda tidak berputar liar saat nabrak dinding)
                wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                // Opsional: Reset rotasi ke tegak lurus jika miring
                // wrapper.rotationQuaternion = new BABYLON.Quaternion(); 
            });

            dragBehavior.onDragEndObservable.add(() => {
                hlMouse.removeAllMeshes();
                if (wrapper.physicsImpostor) {
                    // Rem benda saat dilepas agar langsung berhenti (tidak meluncur)
                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
            });
        }
    });

    // ============================================================
    // 2. VR GRAB (VR - Velocity Based + Limiter)
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
                        
                        // Highlight
                        const child = grabbedMesh.getChildren()[0];
                        if (child) child.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));

                        // Loop Update Fisika
                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (!grabbedMesh || !grabbedMesh.physicsImpostor) return;

                            const targetPos = hand.getAbsolutePosition();
                            const currentPos = grabbedMesh.getAbsolutePosition();
                            const direction = targetPos.subtract(currentPos);
                            
                            // Hitung kecepatan
                            let velocity = direction.scale(RESPONSE_SPEED);

                            // --- VR SPEED LIMITER ---
                            const speed = velocity.length();
                            if (speed > MAX_VELOCITY) {
                                velocity = velocity.normalize().scale(MAX_VELOCITY);
                            }

                            // Matikan gravitasi SEMENTARA saat dipegang agar ringan
                            // (Opsional, tapi membantu kontrol di VR)
                            // grabbedMesh.physicsImpostor.mass = 0.1; 

                            grabbedMesh.physicsImpostor.setLinearVelocity(velocity);
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        });
                    }
                } else {
                    if (grabbedMesh) {
                        scene.onBeforeRenderObservable.remove(grabObserver);
                        grabObserver = null;
                        
                        // Kembalikan massa asli jika diubah
                        // grabbedMesh.physicsImpostor.mass = 1;

                        // Rem saat dilepas
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

    console.log("✅ Interaksi Grab Velocity-Cap Siap.");
}
