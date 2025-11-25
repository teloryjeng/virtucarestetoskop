// js/grab.js (Versi Physics-Based: Tidak Tembus Dinding)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab Fisika (Anti-Tembus)...");

    const highlightColor = new BABYLON.Color3.Green();
    // Kecepatan respon tarik (semakin besar semakin kencang menempel ke tangan)
    const MOVE_SPEED = 10; 
    const ROTATE_SPEED = 10;

    // ============================================================
    // 1. MOUSE DRAG (Desktop - Physics Based)
    // ============================================================

    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];

            // Gunakan PointerDragBehavior tapi matikan gerakan otomatisnya
            const dragBehavior = new BABYLON.PointerDragBehavior({
                dragPlaneNormal: new BABYLON.Vector3(0, 1, 0) // Drag di bidang datar (meja)
            });
            
            // PENTING: Matikan moveAttached agar posisi tidak dipaksa paksa (teleport)
            dragBehavior.moveAttached = false; 

            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add(() => {
                // Jangan setMass(0), biarkan tetap punya massa agar bisa tabrakan
                // Tapi kita bisa kurangi friksi agar licin saat ditarik
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.wakeUp();
                    // Reset kecepatan awal
                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }
                if (childModel) {
                    childModel.getChildMeshes(false).forEach(m => hlMouse.addMesh(m, highlightColor));
                }
            });

            dragBehavior.onDragObservable.add((event) => {
                if (!wrapper.physicsImpostor) return;

                // --- LOGIKA UTAMA: TARIK MENGGUNAKAN VELOCITY ---
                // 1. Ambil posisi target (posisi mouse di dunia 3D)
                const targetPos = event.dragPlanePoint;
                const currentPos = wrapper.getAbsolutePosition();

                // 2. Hitung arah vector: Target - PosisiSekarang
                const direction = targetPos.subtract(currentPos);
                
                // 3. Terapkan kecepatan (Semakin jauh mouse, semakin cepat benda mengejar)
                const velocity = direction.scale(MOVE_SPEED);
                
                // 4. Masukkan ke physics engine
                wrapper.physicsImpostor.setLinearVelocity(velocity);
                
                // (Opsional) Kurangi putaran liar
                wrapper.physicsImpostor.setAngularVelocity(wrapper.physicsImpostor.getAngularVelocity().scale(0.5));
            });

            dragBehavior.onDragEndObservable.add(() => {
                hlMouse.removeAllMeshes();
                // Rem benda saat dilepas
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.setLinearVelocity(wrapper.physicsImpostor.getLinearVelocity().scale(0.1));
                }
            });
        }
    });

    // ============================================================
    // 2. VR GRAB (Virtual Reality - Physics Based)
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
            let grabObserver = null; // Observer untuk loop update fisika per frame
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                if (state.pressed) {
                    if (grabbedMesh) return; 

                    // --- Cek UI (Agar tidak grab tombol 'i') ---
                    if (xr.pointerSelection) {
                        const meshUnderPointer = xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
                        if (meshUnderPointer && meshUnderPointer.name.startsWith("btn_plane_")) {
                            return; 
                        }
                    }

                    // --- Cari Mesh Terdekat ---
                    let closestMesh = null;
                    let minDistance = 0.25; // Jarak grab sedikit diperbesar

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
                        
                        // Highlight
                        const childModel = grabbedMesh.getChildren()[0];
                        if (childModel) {
                            childModel.getChildMeshes(false).forEach(m => hlVR.addMesh(m, highlightColor));
                        }

                        // JANGAN gunakan setParent(hand).
                        // JANGAN setMass(0).
                        // Gunakan Observer untuk update Velocity setiap frame.

                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (!grabbedMesh || !grabbedMesh.physicsImpostor) return;

                            // 1. Posisi Tangan
                            const targetPos = hand.getAbsolutePosition();
                            const currentPos = grabbedMesh.getAbsolutePosition();

                            // 2. Hitung Jarak
                            const direction = targetPos.subtract(currentPos);
                            const distance = direction.length();

                            // 3. Terapkan Velocity Linear (Tarik ke tangan)
                            // Jika jarak < 1 meter, tarik elastis. Jika jauh (bug), jangan tarik terlalu kencang
                            if (distance > 0.01) {
                                const velocity = direction.scale(MOVE_SPEED);
                                grabbedMesh.physicsImpostor.setLinearVelocity(velocity);
                            } else {
                                grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            }

                            // 4. (Opsional) Rotasi mengikuti tangan (Agak kompleks dengan Physics)
                            // Untuk sekarang, kita redam rotasi liar saja
                            grabbedMesh.physicsImpostor.setAngularVelocity(
                                grabbedMesh.physicsImpostor.getAngularVelocity().scale(0.1)
                            );
                        });
                    }

                } else {
                    // --- LEPAS GRAB ---
                    if (grabbedMesh) {
                        // Hentikan loop fisika
                        if (grabObserver) {
                            scene.onBeforeRenderObservable.remove(grabObserver);
                            grabObserver = null;
                        }

                        // Lempar benda (Momentum)
                        // Kita ambil velocity terakhir, physics engine akan melanjutkannya
                        if (grabbedMesh.physicsImpostor) {
                             // Opsional: Beri dorongan sedikit jika dilempar
                             // grabbedMesh.physicsImpostor.applyImpulse(...)
                        }

                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });

    console.log("✅ Logika grab Fisika (Anti-Tembus) berhasil diinisialisasi.");
}
