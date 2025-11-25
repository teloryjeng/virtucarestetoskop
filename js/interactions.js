// js/interactions.js (Versi Smooth & Stable Physics)

function setupVRInput(xr, scene) {
    console.log("Menginisialisasi interaksi grab (Smooth Physics)...");

    const highlightColor = new BABYLON.Color3.Green();
    
    // --- KONFIGURASI KHALUSAN ---
    // MOVE_FORCE: Seberapa cepat benda mengejar tangan (Lebih rendah = lebih lambat/halus)
    const MOVE_FORCE = 20;     
    // ROTATE_FORCE: Kekuatan putaran (Lebih rendah = tidak tersentak saat tangan diputar)
    const ROTATE_FORCE = 10;   
    // GRAB_DAMPING: "Rem" saat dipegang (0 = licin, 1 = seperti dalam madu). 
    // Nilai tinggi (0.8) penting untuk mencegah getaran liar.
    const GRAB_DAMPING = 0.8;  
    
    // Variabel state Mouse
    let currentMouseDragTarget = null;
    let currentMouseDragMesh = null;
    let mouseObserver = null;
    let originalDamping = 0; // Untuk menyimpan damping asli benda

    // ============================================================
    // FUNGSI HELPER: GERAKAN FISIKA (UNTUK VR & MOUSE)
    // ============================================================
    const applyPhysicsMove = (mesh, targetPosition, targetRotationQuat) => {
        if (!mesh.physicsImpostor) return;

        const body = mesh.physicsImpostor.physicsBody;
        if (!body) return;

        // 1. POSISI
        const currentPos = mesh.getAbsolutePosition();
        const diff = targetPosition.subtract(currentPos);
        const distance = diff.length();

        // Jika jarak terlalu jauh (misal: tangan tembus tembok, benda tertinggal),
        // Jangan paksa benda mengejar dengan kekuatan penuh agar tidak "teleport".
        // Jika jarak > 1 meter, kita anggap stuck, kurangi gaya tarik.
        let factor = 1.0;
        if (distance > 0.5) factor = 0.1; 

        // Hitung Velocity
        // Gunakan move force yang sedikit lebih rendah untuk benda kecil
        const currentForce = MOVE_FORCE * factor;
        const velocity = diff.scale(currentForce);
        
        // --- PERBAIKAN UTAMA: CLAMP VELOCITY LEBIH KETAT ---
        // Sebelumnya maxSpeed = 5. Ini terlalu cepat untuk benda kecil.
        // Kita turunkan jadi 2.5. Benda akan terasa sedikit lebih "berat/lambat" 
        // tapi ini menjamin ia tidak akan melompati dinding tipis.
        const maxSpeed = 2.5; 
        
        if (velocity.length() > maxSpeed) {
            velocity.normalize().scaleInPlace(maxSpeed);
        }

        mesh.physicsImpostor.setLinearVelocity(velocity);

        // 2. ROTASI (Tetap sama)
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
    // 1. MOUSE DRAG (Desktop - Smooth)
    // ============================================================
    const hlMouse = new BABYLON.HighlightLayer("HL_MOUSE_PHYSICS", scene);

    scene.meshes.forEach((mesh) => {
        if (mesh.metadata && mesh.metadata.isGrabbable) {
            const wrapper = mesh;
            const childModel = wrapper.getChildren()[0];

            const dragBehavior = new BABYLON.PointerDragBehavior({});
            dragBehavior.moveAttached = false; // Matikan gerakan otomatis
            
            wrapper.addBehavior(dragBehavior);

            dragBehavior.onDragStartObservable.add((event) => {
                currentMouseDragMesh = wrapper;
                
                if (childModel) {
                    childModel.getChildMeshes(false).forEach(m => hlMouse.addMesh(m, highlightColor));
                }

                if (wrapper.physicsImpostor) {
                    wrapper.physicsImpostor.wakeUp();
                    // SIMPAN DAMPING ASLI
                    originalDamping = wrapper.physicsImpostor.linearDamping;
                    // BERIKAN DAMPING TINGGI (Agar gerakan halus tidak liar)
                    wrapper.physicsImpostor.linearDamping = GRAB_DAMPING; 
                    wrapper.physicsImpostor.angularDamping = 0.5;

                    wrapper.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                    wrapper.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                }

                mouseObserver = scene.onBeforeRenderObservable.add(() => {
                    if (currentMouseDragMesh && currentMouseDragTarget) {
                        // Mouse tidak mengatur rotasi, hanya posisi
                        applyPhysicsMove(currentMouseDragMesh, currentMouseDragTarget, null);
                    }
                });
            });

            dragBehavior.onDragObservable.add((event) => {
                currentMouseDragTarget = event.dragPlanePoint;
            });

            dragBehavior.onDragEndObservable.add(() => {
                if (currentMouseDragMesh && currentMouseDragMesh.physicsImpostor) {
                    // KEMBALIKAN DAMPING KE ASAL (Agar saat dilempar bisa melayang natural)
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
    // 2. VR GRAB (Virtual Reality - Smooth)
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

                    // Cek UI
                    if (xr.pointerSelection) {
                        const meshUnderPointer = xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
                        if (meshUnderPointer && meshUnderPointer.name.startsWith("btn_plane_")) {
                            return; 
                        }
                    }

                    // Logika Jarak
                    let closestMesh = null;
                    let minDistance = 0.25; // Sedikit diperbesar agar mudah diambil

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

                        // SETUP FISIKA SMOOTH
                        if (grabbedMesh.physicsImpostor) {
                            grabbedMesh.physicsImpostor.wakeUp();
                            
                            // Simpan & Ubah Damping
                            vrOriginalDamping = grabbedMesh.physicsImpostor.linearDamping;
                            grabbedMesh.physicsImpostor.linearDamping = GRAB_DAMPING; // KUNCI KHALUSAN
                            grabbedMesh.physicsImpostor.angularDamping = 0.5;

                            // Reset momentum
                            grabbedMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
                            grabbedMesh.physicsImpostor.setAngularVelocity(BABYLON.Vector3.Zero());
                        }

                        // LOOP FISIKA
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

                        // Kembalikan sifat fisik asli saat dilepas
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

    console.log("✅ Logika grab Smooth Physics berhasil diinisialisasi.");
}
