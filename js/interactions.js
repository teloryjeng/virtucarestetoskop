// js/interactions.js (Versi Physics-Based Collision Fix)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab (Physics-Based)...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // Parameter Fisika (Sesuaikan jika benda terlalu lambat/cepat)
    const MOVE_FORCE = 40;     // Kecepatan mengejar posisi tangan
    const ROTATE_FORCE = 80;   // Kecepatan mengejar rotasi tangan
    const DAMPING = 0.5;       // Meredam getaran

    // Variabel untuk melacak item yang sedang dipegang via Mouse
    let currentMouseDragTarget = null;
    let currentMouseDragMesh = null;
    let mouseObserver = null;

    // ============================================================
    // FUNGSI HELPER: GERAKAN FISIKA (UNTUK VR & MOUSE)
    // ============================================================
    // Fungsi ini menghitung gaya yang diperlukan agar objek mengejar target
    // tanpa menembus dinding.
    const applyPhysicsMove = (mesh, targetPosition, targetRotationQuat) => {
        if (!mesh.physicsImpostor) return;

        const body = mesh.physicsImpostor.physicsBody;
        if (!body) return;

        // 1. POSISI: Hitung vektor arah dari Benda ke Target
        const currentPos = mesh.getAbsolutePosition();
        const diff = targetPosition.subtract(currentPos);
        
        // Terapkan kecepatan linear (Velocity)
        // V = Jarak * Kekuatan
        const velocity = diff.scale(MOVE_FORCE);
        mesh.physicsImpostor.setLinearVelocity(velocity);

        // 2. ROTASI: (Opsional, agar benda memutar mengikuti tangan)
        if (targetRotationQuat && mesh.rotationQuaternion) {
            // Hitung perbedaan rotasi (Quaternion)
            // Target * Inverse(Current)
            const qDiff = targetRotationQuat.multiply(BABYLON.Quaternion.Inverse(mesh.rotationQuaternion));
            
            // Konversi Quaternion ke Euler (Pitch, Yaw, Roll)
            const { x, y, z } = qDiff.toEulerAngles();

            // Sederhanakan kalkulasi angular velocity (pendekatan sederhana)
            // Jika sudut > 180 derajat, putar balik agar lebih dekat
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
    // 1. MOUSE DRAG (Desktop - Physics Based)
    // ============================================================

    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];

            // Gunakan PointerDragBehavior tapi matikan gerakan otomatisnya
            const dragBehavior = new BABYLON.PointerDragBehavior({});
            dragBehavior.moveAttached = false; // PENTING: Jangan biarkan behavior menggerakkan mesh langsung!
            
            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add((event) => {
                currentMouseDragMesh = wrapper;
                
                // Aktifkan highlight
                if (childModel) {
                    childModel.getChildMeshes(false).forEach(m => hlMouse.addMesh(m, highlightColor));
                }

                // Reset Velocity awal agar tidak terpental
                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.wakeUp(); // Bangunkan fisika
                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                    // JANGAN setMass(0)! Biarkan tetap punya massa agar bisa tabrakan.
                }

                // Mulai Loop Fisika untuk Mouse
                mouseObserver = scene.onBeforeRenderObservable.add(() => {
                    if (currentMouseDragMesh && currentMouseDragTarget) {
                        // Mouse hanya mengontrol Posisi, Rotasi dibiarkan natural (atau tegak)
                        // Kita set targetRotation null agar rotasi bebas/mengikuti gravitasi
                        applyPhysicsMove(currentMouseDragMesh, currentMouseDragTarget, null);
                    }
                });
            });

            dragBehavior.onDragObservable.add((event) => {
                // Simpan posisi target mouse saat ini
                currentMouseDragTarget = event.dragPlanePoint;
            });

            dragBehavior.onDragEndObservable.add(() => {
                // Hentikan Loop
                scene.onBeforeRenderObservable.remove(mouseObserver);
                mouseObserver = null;
                currentMouseDragTarget = null;
                currentMouseDragMesh = null;

                // Matikan highlight
                hlMouse.removeAllMeshes();
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

            // Variabel lokal per kontroler
            let grabbedMesh = null;
            let grabObserver = null; // Observer khusus untuk kontroler ini
            const hand = controller.grip || controller.pointer; 

            grabComponent.onButtonStateChangedObservable.add((state) => {
                
                if (state.pressed) {
                    // --- GRAB START ---
                    if (grabbedMesh) return; 

                    // Cek UI (Tombol i) - Agar tidak grab saat tekan tombol
                    if (xr.pointerSelection) {
                        const meshUnderPointer = xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
                        if (meshUnderPointer && meshUnderPointer.name.startsWith("btn_plane_")) {
                            return; 
                        }
                    }

                    // Cari Mesh Terdekat
                    let closestMesh = null;
                    let minDistance = 0.2; // Jarak grab

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

                        // SETUP FISIKA
                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.wakeUp();
                            // Reset momentum awal
                            grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                            
                            // PENTING: Kita TIDAK melakukan setParent(hand)
                            // PENTING: Kita TIDAK melakukan setMass(0)
                        }

                        // MULAI LOOP UPDATE FISIKA
                        // Setiap frame, dorong benda ke arah tangan
                        grabObserver = scene.onBeforeRenderObservable.add(() => {
                            if (grabbedMesh && hand) {
                                applyPhysicsMove(
                                    grabbedMesh, 
                                    hand.getAbsolutePosition(), 
                                    hand.rotationQuaternion // Ikuti rotasi tangan juga
                                );
                            }
                        });
                    }

                } else {
                    // --- GRAB RELEASE ---
                    if (grabbedMesh) {
                        
                        // Hentikan Loop Fisika
                        scene.onBeforeRenderObservable.remove(grabObserver);
                        grabObserver = null;

                        if (grabbedMesh.physicsImpostor) {
                            // Lempar Benda (Opsional)
                            // Ambil momentum terakhir tangan (jika ada) atau biarkan inersia fisika bekerja
                            // Karena kita menggunakan force tiap frame, benda otomatis punya momentum saat dilepas.
                        }

                        hlVR.removeAllMeshes();
                        grabbedMesh = null;
                    }
                }
            });
        });
    });

    console.log("✅ Logika grab Physics-Based berhasil diinisialisasi.");
}
