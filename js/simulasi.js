// js/simulasi.js

// ================================
// Inisialisasi Engine & Canvas
// ================================
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// ================================
// Definisikan Posisi Awal Item & Rotasi Awal
// ================================
const START_Y = 2.0; // Ketinggian awal item
const DEG_TO_RAD = Math.PI / 180; // Konversi Derajat ke Radian

const ITEM_POSITIONS = {
    stethoscope: {
        pos: new BABYLON.Vector3(-17, START_Y, 27.5),
        rot: new BABYLON.Vector3(0, Math.PI, 0) // Rotasi awal Stethoscope
    },
    thermometer: {
        pos: new BABYLON.Vector3(-16.3, START_Y, 27.5),
        // Konversi dari (80, 160, 0) derajat ke radian
        rot: new BABYLON.Vector3(0, 0, 0)
    },
    tensimeter: {
        pos: new BABYLON.Vector3(-17.5, START_Y, 27.5),
        // Konversi dari (-110, 160, 100) derajat ke radian
        rot: new BABYLON.Vector3(-110 * DEG_TO_RAD, 160 * DEG_TO_RAD, 100 * DEG_TO_RAD)
    }
};

// ================================
// Fungsi utama: Membuat Scene
// ================================
const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.9, 0.9, 0.95);

    // --- VARIABEL UNTUK ITEM INTERAKSI ---
    let thermometerMesh = null;
    let tensimeterMesh = null;
    let stethoscopeMesh = null;
    let chestpieceMesh = null;
    // VARIABEL BARU UNTUK ATTACH STETOSKOP
    let isStethoscopeAttached = false; // Status apakah stetoskop sedang terpasang ke kamera
    let rightVRController = null; // Untuk menyimpan controller kanan
let stethoscopeTube = null;   // Mesh tali stetoskop
let tubeUpdateObserver = null;
let isThermometerAttached = false; // Status termometer

    // Aktifkan Fisika (CannonJS)
    const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
    // Pastikan library CannonJS sudah dimuat di HTML
    const physicsPlugin = new BABYLON.CannonJSPlugin();
    scene.enablePhysics(gravityVector, physicsPlugin);

    // ================================
    // Buat ground (lantai dunia)
    // ================================
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    ground.checkCollisions = true;
    ground.position.y = 0;

    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
        ground,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.9 },
        scene
    );
    
    // (PENAMBAHAN CAHAYA DAN KAMERA)
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.intensity = 1;
    const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(-17, 2, 26), scene);
    camera.attachControl(canvas, true);
    camera.applyGravity = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.checkCollisions = true;
    camera.speed = 0.2;
    camera.keysUp.push(87); camera.keysDown.push(83);
    camera.keysLeft.push(65); camera.keysRight.push(68);

    let xr = null;
    // Helper untuk mematikan sensor sentuh pada seluruh bagian model
    function setHierarchicalPickable(rootMesh, isPickable) {
        if (!rootMesh) return;
        rootMesh.isPickable = isPickable;
        rootMesh.getChildMeshes().forEach(child => {
            child.isPickable = isPickable;
        });
    }
    // ... (FUNGSI createPngBillboard) ...
    function createPngBillboard(name, filename, position, size, scene) {
        // Cari dan hapus billboard lama jika ada
        const oldBillboard = scene.getMeshByName(name);
        if (oldBillboard) {
            oldBillboard.dispose();
        }

        const plane = BABYLON.MeshBuilder.CreatePlane(name, { width: size, height: size * 0.75 }, scene);
        plane.position = position;
        const material = new BABYLON.StandardMaterial(name + "Mat", scene);
        const texture = new BABYLON.Texture("assets/" + filename, scene);
        material.diffuseTexture = texture;
        material.diffuseTexture.hasAlpha = true;
        material.backFaceCulling = false;
        material.emissiveColor = new BABYLON.Color3(1, 1, 1);
        plane.material = material;
        return plane;
    }
    
    // ... (IMPORT MODEL RUANGAN, AVATAR, XR) ...
    BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "ruang_periksa.glb", scene
    ).then((result) => {
        if (result.meshes.length > 0) {
            result.meshes[0].position = new BABYLON.Vector3(-22.5, 0, 8);
            result.meshes[0].scaling = new BABYLON.Vector3(-0.5, 0.5, 0.5);
            result.meshes[0].getChildMeshes().forEach(mesh => {
                mesh.checkCollisions = true;
            });
        }
    }).catch((error) => { console.error("Gagal memuat model ruangan:", error); });

    BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "Avatar_Virtucare.glb", scene)
        .then((result) => {
            const root = result.meshes[0];
            root.position = new BABYLON.Vector3(-19, 0.5, 28);
            root.scaling = new BABYLON.Vector3(0.3, 0.3, 0.3);
            root.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
            root.getChildMeshes().forEach((m) => { m.checkCollisions = true; });
        })
        .catch((e) => console.error("Gagal load Avatar:", e));
    
    // Aktifkan VR / XR Mode
    try {
        xr = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [ground],
            disableTeleportation: true,
            cameraOptions:{
                checkCollisions: true,
                applyGravity: true,
                ellipsoid: new BABYLON.Vector3(0.5, 2, 0.5)
            }
            
        });
        console.log("✅ WebXR aktif");
        xr.input.onControllerAddedObservable.add((controller) => {
            // Cek apakah ini controller kanan
            if (controller.inputSource.handedness === 'right') {
                rightVRController = controller;
                console.log("Controller Kanan Terdeteksi!");

                // FUNGSI PEMBANTU: Pasang listener ke trigger setelah motionController siap
                const initTriggerListener = (motionController) => {
                    if (!motionController) return;
                    
                    // Cari komponen trigger (biasanya 'xr-standard-trigger' atau 'trigger')
                    const triggerComponent = motionController.getComponent("xr-standard-trigger");

                    if (triggerComponent) {
                        triggerComponent.onButtonStateChangedObservable.add((component) => {
                            // JIKA TRIGGER DILEPAS (pressed === false) & STETOSKOP SEDANG NEMPEL
                            if (component.pressed === false) {
            
                                // Cek Stetoskop
                                if (isStethoscopeAttached) {
                                    releaseStethoscopeInPlace(); 
                                }
                                
                                // Cek Termometer (TAMBAHAN BARU)
                                if (isThermometerAttached) {
                                    releaseThermometer();
                                }
                            }
                        });
                        console.log("Listener Trigger berhasil dipasang.");
                    } else {
                        console.warn("Komponen Trigger tidak ditemukan pada controller ini.");
                    }
                };

                // LOGIKA UTAMA: Cek ketersediaan motionController
                if (controller.motionController) {
                    // Jika sudah siap langsung pasang
                    initTriggerListener(controller.motionController);
                } else {
                    // Jika belum siap, tunggu event inisialisasi
                    controller.onMotionControllerInitObservable.add((motionController) => {
                        initTriggerListener(motionController);
                    });
                }
            }
        });
        const xrCamera = xr.baseExperience.camera;
        xrCamera.position.y = 4;
        xrCamera.applyGravity = true;
        xrCamera.checkCollisions = true;

        xr.baseExperience.featuresManager.enableFeature(
            BABYLON.WebXRFeatureName.MOVEMENT,
            "latest",
            {
                xrInput: xr.input,
                movementSpeed: 0.1,
                rotationSpeed: 0.2,
                movementControls: ["left-xr-standard-thumbstick"],
                rotationControls: ["right-xr-standard-thumbstick"],
                useThumbstickForMovement: true,
                disableTeleportOnThumbstick: true,
                checkCollisions: true,
                applyGravity: true,
                ellipsoid: new BABYLON.Vector3(0.5, 2, 0.5)
            }
        );
    } catch (e) {
        console.warn("⚠️ WebXR tidak didukung:", e);
        xr = null;
        scene.activeCamera = camera;
        camera.applyGravity = true;
        camera.checkCollisions = true;
    }

    const mejaCollision1= BABYLON.MeshBuilder.CreateBox("mejaCollision", {height: 0.5, width: 2, depth: 0.7}, scene);
    mejaCollision1.position = new BABYLON.Vector3(-17, 1, 27.5);
    mejaCollision1.isVisible = false;
    mejaCollision1.physicsImpostor = new BABYLON.PhysicsImpostor(
        mejaCollision1,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );

    // Pasien
    BABYLON.SceneLoader.ImportMesh("", "assets/", "pasien.glb", scene, function (meshes) {
        const rootMesh = meshes[0];
        rootMesh.position = new BABYLON.Vector3(-14.7, 1.2, 25.5);
        rootMesh.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
        rootMesh.rotation = new BABYLON.Vector3(3 * Math.PI / 2, 0, 3.2);
        rootMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
            rootMesh,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 0, restitution: 0.4 },
            scene
        );
    });
    BABYLON.SceneLoader.ImportMesh("", "assets/", "chestpiece.glb", scene, function (meshes) {
        chestpieceMesh = meshes[0];
        
        // Atur skala agar sesuai (mungkin perlu disesuaikan dengan model aslinya)
        // Sesuaikan angka ini jika model terlalu besar/kecil
        chestpieceMesh.scaling = new BABYLON.Vector3(0.04, 0.04, 0.04); 
        
        // Pastikan collision mati agar tidak mengganggu grab
        chestpieceMesh.getChildMeshes().forEach(m => m.checkCollisions = false);
        
        // SEMBUNYIKAN DI AWAL (Hanya muncul saat dipegang)
        findAllMeshesAndSetVisibility(chestpieceMesh, false);
    });
    // ... (GUI, SOUND, TARGET) ...
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const tempText = new BABYLON.GUI.TextBlock("tempText", "");
    tempText.fontSize = 40;
    tempText.color = "yellow";
    tempText.isVisible = false;
    advancedTexture.addControl(tempText);

    const StethoText = new BABYLON.GUI.TextBlock("StethoText", ""); 
    StethoText.fontSize = 40;
    StethoText.color = "maroon";
    StethoText.isVisible = false;
    advancedTexture.addControl(StethoText);

    const tensiText = new BABYLON.GUI.TextBlock("tensiText", ""); 
    tensiText.fontSize = 40;
    tensiText.color = "cyan";
    tensiText.isVisible = false;
    advancedTexture.addControl(tensiText);
    
    // --- Efek Suara ---
    const beepSound = new BABYLON.Sound("beep", "audio/beep.mp3", scene, null, { loop: false, volume: 1 }); 
    const heartbeatSound = new BABYLON.Sound("heartbeat", "audio/detak jantung.mp3", scene, null, { loop: true, volume: 1 });
    
    // Invisible interaction points
    const chestTarget = BABYLON.MeshBuilder.CreateSphere("tChest", { diameter: 0.2 }, scene);
    chestTarget.position = new BABYLON.Vector3(-14.6, 1.3, 27);
    chestTarget.isVisible = false;

    const headTarget = BABYLON.MeshBuilder.CreateSphere("tHead", { diameter: 0.2 }, scene);
    headTarget.position = new BABYLON.Vector3(-14.6, 1.25, 27.5);
    headTarget.isVisible = false;

    const armTarget = BABYLON.MeshBuilder.CreateSphere("tArm", { diameter: 0.2 }, scene);
    armTarget.position = new BABYLON.Vector3(-14.25, 1.2, 27);
    armTarget.isVisible = false;

    // Tautkan GUI ke Target
    tempText.linkWithMesh(headTarget);
    tempText.linkOffsetY = -100;
    tensiText.linkWithMesh(armTarget);
    tensiText.linkOffsetY = -100;
    StethoText.linkWithMesh(chestTarget);
    StethoText.linkOffsetY = -100;

    // Aktifkan Action Manager untuk semua target
    headTarget.actionManager = new BABYLON.ActionManager(scene);
    chestTarget.actionManager = new BABYLON.ActionManager(scene);
    armTarget.actionManager = new BABYLON.ActionManager(scene);
    
    let isProcessing = false;
    let isHeartbeatPlaying = false;
    
    // ===================================================
    // Muat GLB dengan "Wrapper" Fisika
    // ===================================================

    const itemPhysicsSize = 0.2; // 20cm
    const itemPhysicsMass = 0.01; // Massa ringan

    /**
     * Fungsi Helper untuk memuat item grabbable dengan wrapper fisika
     */
    /**
     * Helper: Memuat item dengan opsi rotasi otomatis (billboard).
     * allowBillboard = false berarti item akan DIAM (statis) saat dipegang, tidak muter-muter.
     */
    function createGrabbableItem(name, glbFile, position, scaling, wrapperRotation, allowBillboard = true) {
        // 1. Buat Wrapper
        const wrapper = BABYLON.MeshBuilder.CreateBox(name + "Wrapper", { size: itemPhysicsSize }, scene);
        wrapper.position = position; 
        wrapper.isVisible = false; 
        // PAKSA MATI BILLBOARD DARI AWAL
        wrapper.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE; 

        if (wrapperRotation) {
            wrapper.rotation.copyFrom(wrapperRotation); 
        }

        wrapper.metadata = { isGrabbable: true, itemData: { title: name } };
        
        // 2. Fisika
        wrapper.physicsImpostor = new BABYLON.PhysicsImpostor(
            wrapper,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: itemPhysicsMass, restitution: 0.4 },
            scene
        );
        
        // 3. Drag Behavior
        const dragBehavior = new BABYLON.SixDofDragBehavior();
        dragBehavior.dragDeltaRatio = 1;
        dragBehavior.zDragFactor = 1;
        dragBehavior.detachCameraControls = true;
        
        wrapper.addBehavior(dragBehavior);
        wrapper.dragBehavior = dragBehavior; // Simpan referensi

        // 4. Observer: HANYA JALANKAN JIKA allowBillboard = TRUE
        // Jika false (stetoskop), observer ini tidak akan pernah menyentuh rotasi/billboard
        if (allowBillboard) {
            scene.onBeforeRenderObservable.add(() => {
                if (dragBehavior.currentDraggingPointerId !== -1) {
                    if (wrapper.billboardMode !== BABYLON.Mesh.BILLBOARDMODE_Y) {
                        wrapper.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
                    }
                } else {
                    if (wrapper.billboardMode !== BABYLON.Mesh.BILLBOARDMODE_NONE) {
                        wrapper.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
                        // Reset momentum putaran saat dilepas
                        if (wrapper.physicsImpostor) {
                            wrapper.physicsImpostor.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
                        }
                    }
                }
            });
        } 
        // Jika allowBillboard = false, wrapper.billboardMode akan SELALU NONE.

        // 5. Load Model
        BABYLON.SceneLoader.ImportMesh("", "assets/", glbFile, scene, function (meshes) {
            const rootMesh = meshes[0];
            rootMesh.setParent(wrapper);
            rootMesh.position = new BABYLON.Vector3(0, 0, 0); 
            rootMesh.scaling = scaling;
        });
        
        return wrapper; 
    }
    
    // --- Gunakan helper untuk memuat dan menangkap semua item ---
    stethoscopeMesh = createGrabbableItem("stethoscope", "STETOSKOP.glb", 
        ITEM_POSITIONS.stethoscope.pos, 
        new BABYLON.Vector3(0.04, 0.04, 0.04),
        ITEM_POSITIONS.stethoscope.rot,
        false
    );
    
    thermometerMesh = createGrabbableItem("thermometer", "thermometer.glb", 
        ITEM_POSITIONS.thermometer.pos, 
        new BABYLON.Vector3(0.25, 0.25, 0.25),
        ITEM_POSITIONS.thermometer.rot,
        false
    );
    if (thermometerMesh.dragBehavior) {
        thermometerMesh.dragBehavior.onDragStartObservable.add(() => {
            attachThermometerToController();
        });
    }

    tensimeterMesh = createGrabbableItem("tensimeter", "tensimeter.glb", 
        ITEM_POSITIONS.tensimeter.pos, 
        new BABYLON.Vector3(0.3, 0.3, 0.3),
        ITEM_POSITIONS.tensimeter.rot,
        false
    );

    // Infus (Static, mass 0)
    BABYLON.SceneLoader.ImportMesh("", "assets/", "infus.glb", scene, function (meshes) {
        const rootMesh = meshes[0];
        rootMesh.position = new BABYLON.Vector3(-11, 0.1, 27.5);
        rootMesh.scaling = new BABYLON.Vector3(0.04, 0.04, 0.04);
        rootMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
            rootMesh,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 0, restitution: 0.4 },
            scene
        );
    });

    // =====================================
    // FUNGSI UTILITY BARU UNTUK VISIBILITAS
    // =====================================
    /**
     * Mencari semua mesh yang terlihat di bawah rootMesh (rekursif) dan mengatur properti isVisible mereka.
     */
    function findAllMeshesAndSetVisibility(rootMesh, isVisible) {
        // Mendapatkan SEMUA mesh anak (rekursif)
        const allChildren = rootMesh.getChildMeshes(true); 
        
        // Iterasi melalui semua anak dan setel visibilitas
        allChildren.forEach(child => {
            if (child instanceof BABYLON.Mesh || child instanceof BABYLON.TransformNode) {
                child.isVisible = isVisible;
            }
        });
    }

    // =====================================
    // FUNGSI UTAMA: ATTACH/DETACH STETOSKOP
    // =====================================
    function getActiveCamera() {
        // Gunakan kamera XR jika ada, atau kamera universal default
        return xr && xr.baseExperience.state === BABYLON.WebXRState.IN_XR ? xr.baseExperience.camera : camera;
    }
    function updateTubeLogic() {
    if (!isStethoscopeAttached) return; 

    const activeCam = getActiveCamera();
    // Titik Awal: Sedikit di bawah kamera (leher)
    const startPoint = activeCam.position.add(new BABYLON.Vector3(0, -0.3, 0)); 

    // Titik Akhir: Ke Chestpiece yang ada di tangan
    let endPoint;
    if (chestpieceMesh && chestpieceMesh.isVisible) {
        endPoint = chestpieceMesh.absolutePosition;
    } else {
        // Fallback jika chestpiece error
        endPoint = stethoscopeMesh.absolutePosition;
    }

    // Buat jalur (path) sederhana lurus atau sedikit melengkung (Bezier bisa ditambahkan jika ingin lebih advance)
    const path = [startPoint, endPoint];
    
    if (!stethoscopeTube) {
        stethoscopeTube = BABYLON.MeshBuilder.CreateTube("stethoTube", {
            path: path, radius: 0.015, updatable: true
        }, scene);
        const rubberMat = new BABYLON.StandardMaterial("rubberMat", scene);
        rubberMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        stethoscopeTube.material = rubberMat;
    } else {
        BABYLON.MeshBuilder.CreateTube("stethoTube", {
            path: path, radius: 0.015, instance: stethoscopeTube 
        });
    }
}

function startTubeSimulation() {
    if (tubeUpdateObserver) return; // Sudah jalan
    // Jalankan update setiap frame
    tubeUpdateObserver = scene.onBeforeRenderObservable.add(updateTubeLogic);
}

function stopTubeSimulation() {
    if (tubeUpdateObserver) {
        scene.onBeforeRenderObservable.remove(tubeUpdateObserver);
        tubeUpdateObserver = null;
    }
    if (stethoscopeTube) {
        stethoscopeTube.dispose();
        stethoscopeTube = null;
    }
}
    function attachStethoscopeToController() {
    if (!stethoscopeMesh || isStethoscopeAttached || isProcessing) return;

    let parentTarget = null;
    if (rightVRController) {
        parentTarget = rightVRController.grip || rightVRController.pointer; 
    } else {
        parentTarget = getActiveCamera();
    }
    if (!parentTarget) return;

    console.log("GRAB DETECTED: Swap ke Chestpiece.");

    // 1. Matikan Model Utuh
    stethoscopeMesh.setEnabled(false); 
    
    if (stethoscopeMesh.physicsImpostor) {
        stethoscopeMesh.physicsImpostor.dispose();
        stethoscopeMesh.physicsImpostor = null;
    }
    
    // Detach behavior saat ini
    if (stethoscopeMesh.dragBehavior) {
        stethoscopeMesh.dragBehavior.detach();
    }

    // 2. Munculkan Chestpiece
    if (chestpieceMesh) {
        chestpieceMesh.setEnabled(true);
        findAllMeshesAndSetVisibility(chestpieceMesh, true);
        chestpieceMesh.setParent(parentTarget);
        chestpieceMesh.position = new BABYLON.Vector3(0, 0, 0.05); 
        chestpieceMesh.rotationQuaternion = null;
        chestpieceMesh.rotation = new BABYLON.Vector3(Math.PI/2, 0, 0); 
    }

    isStethoscopeAttached = true;
    startTubeSimulation();
}
    

    function detachStethoscopeFromCamera() { // Bisa direname jadi detachStethoscope
    if (!stethoscopeMesh || !isStethoscopeAttached) return;

    // HENTIKAN TALI
    stopTubeSimulation();

    findAllMeshesAndSetVisibility(stethoscopeMesh, true);
    stethoscopeMesh.setParent(null);
    
    // Reset ke meja
    resetItem(stethoscopeMesh, ITEM_POSITIONS.stethoscope.pos, ITEM_POSITIONS.stethoscope.rot);

    isStethoscopeAttached = false;
    console.log("Stetoskop dilepas.");
}
   function releaseStethoscopeInPlace() {
    if (!stethoscopeMesh || !isStethoscopeAttached) return;

    console.log("RELEASE: Melepas stetoskop (STATIS TOTAL).");

    // 1. Stop Tali
    stopTubeSimulation();

    // 2. HAPUS BEHAVIOR LAMA (Agar tidak lengket)
    if (stethoscopeMesh.dragBehavior) {
        stethoscopeMesh.dragBehavior.detach();
        stethoscopeMesh.removeBehavior(stethoscopeMesh.dragBehavior);
        stethoscopeMesh.dragBehavior = null; // Bersihkan referensi
    }
    
    // Matikan Pickable (Ghost Mode) sementara
    setHierarchicalPickable(stethoscopeMesh, false);

    // 3. SWAP VISUAL (Sembunyikan Chestpiece -> Munculkan Utuh)
    if (chestpieceMesh) {
        chestpieceMesh.setEnabled(false); 
        chestpieceMesh.setParent(null);

        // Ambil posisi terakhir tangan
        const dropPosition = chestpieceMesh.absolutePosition.clone();

        // Pindahkan model utuh ke sana
        stethoscopeMesh.position.copyFrom(dropPosition);
        
        // Reset Rotasi ke Tegak Lurus (0,0,0)
        stethoscopeMesh.rotationQuaternion = null;
        stethoscopeMesh.rotation = new BABYLON.Vector3(0, 0, 0); 
    }

    // 4. SETEL ULANG MODEL UTUH
    stethoscopeMesh.setEnabled(true); 
    findAllMeshesAndSetVisibility(stethoscopeMesh, true);
    
    // Putus hubungan parent & matikan billboard
    stethoscopeMesh.setParent(null);
    stethoscopeMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;

    // 5. FISIKA (Agar Jatuh Lurus ke Bawah)
    stethoscopeMesh.checkCollisions = true;
    if (stethoscopeMesh.physicsImpostor) {
        stethoscopeMesh.physicsImpostor.dispose();
    }
    
    // Massa Berat & Gesekan Tinggi agar tidak mental
    stethoscopeMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
        stethoscopeMesh,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 5.0, restitution: 0.0, friction: 100.0 }, 
        scene
    );
    
    // Hentikan sisa kecepatan
    stethoscopeMesh.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, -0.5, 0));
    stethoscopeMesh.physicsImpostor.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));

    isStethoscopeAttached = false;

    // 6. TIMEOUT: BUAT ULANG LOGIKA GRAB (RE-ARMING)
    setTimeout(() => {
        if (stethoscopeMesh) {
            console.log("COOLDOWN SELESAI: Memasang kembali logika Grab.");
            
            // a. Hidupkan sensor sentuh
            setHierarchicalPickable(stethoscopeMesh, true);

            // b. BUAT BEHAVIOR BARU
            const newDragBehavior = new BABYLON.SixDofDragBehavior();
            newDragBehavior.dragDeltaRatio = 1;
            newDragBehavior.zDragFactor = 1;
            newDragBehavior.detachCameraControls = true;
            
            // --- [BAGIAN PENTING YANG HILANG TADI] ---
            // Kita harus memasang lagi Listener: "Kalau di-grab, jalankan fungsi attach"
            newDragBehavior.onDragStartObservable.add(() => {
                console.log("Stetoskop di-grab lagi!");
                // Panggil fungsi attach yang sudah kita buat
                attachStethoscopeToController(); 
            });
            // -----------------------------------------

            // c. Pasang ke mesh
            stethoscopeMesh.addBehavior(newDragBehavior);
            stethoscopeMesh.dragBehavior = newDragBehavior; // Simpan referensi baru
        }
    }, 1500); // Jeda 1.5 detik
}
    function attachThermometerToController() {
    if (!thermometerMesh || isThermometerAttached || isProcessing) return;

    // Cari Controller Kanan
    let parentTarget = null;
    if (rightVRController) {
        parentTarget = rightVRController.grip || rightVRController.pointer;
    } else {
        parentTarget = getActiveCamera(); // Fallback PC
    }
    if (!parentTarget) return;

    console.log("GRAB THERMOMETER: Snap ke posisi scan.");

    // 1. Matikan Fisika & Behavior Lama
    if (thermometerMesh.physicsImpostor) {
        thermometerMesh.physicsImpostor.dispose();
        thermometerMesh.physicsImpostor = null;
    }
    if (thermometerMesh.dragBehavior) {
        thermometerMesh.dragBehavior.detach();
    }

    // 2. Tempel ke Tangan
    thermometerMesh.setParent(parentTarget);
    
    // 3. ATUR POSISI SNAP (POSISI SCAN SUHU)
    // Angka ini menentukan posisi 'enak' di tangan. Silakan tweak jika kurang pas.
    thermometerMesh.position = new BABYLON.Vector3(0, -0.05, 0.1); // Sedikit ke depan & bawah
    
    // Atur Rotasi agar moncong termometer menghadap depan
    thermometerMesh.rotationQuaternion = null;
    thermometerMesh.rotation = new BABYLON.Vector3(-1, -.5, -3);

    // 4. Pastikan Terlihat & Matikan Billboard
    findAllMeshesAndSetVisibility(thermometerMesh, true);
    thermometerMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;

    isThermometerAttached = true;
}

function releaseThermometer() {
    if (!thermometerMesh || !isThermometerAttached) return;

    console.log("RELEASE THERMOMETER: Jatuh fisika.");

    // 1. Hapus Behavior Lama (Agar tidak lengket)
    if (thermometerMesh.dragBehavior) {
        thermometerMesh.dragBehavior.detach();
        thermometerMesh.removeBehavior(thermometerMesh.dragBehavior);
        thermometerMesh.dragBehavior = null;
    }

    // 2. Matikan Raycast Sementara (Ghost Mode)
    setHierarchicalPickable(thermometerMesh, false);

    // 3. Lepas dari Tangan (Unparent)
    const dropPosition = thermometerMesh.absolutePosition.clone();
    thermometerMesh.setParent(null);
    thermometerMesh.position.copyFrom(dropPosition);
    
    // Reset rotasi agar jatuh wajar (tegak lurus gravitasi)
    thermometerMesh.rotationQuaternion = null;
    thermometerMesh.rotation = new BABYLON.Vector3(0, 90, 0);

    // 4. Aktifkan Fisika (Jatuh)
    thermometerMesh.checkCollisions = true;
    if (thermometerMesh.physicsImpostor) {
        thermometerMesh.physicsImpostor.dispose();
    }
    thermometerMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
        thermometerMesh,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 1.0, restitution: 0.2, friction: 0.6 }, 
        scene
    );

    isThermometerAttached = false;

    // 5. COOLDOWN: Pasang kembali Grab setelah 1.5 detik
    setTimeout(() => {
        if (thermometerMesh) {
            console.log("Thermometer siap diambil lagi.");
            
            // a. Hidupkan sensor sentuh
            setHierarchicalPickable(thermometerMesh, true);

            // b. Buat Behavior Baru
            const newDragBehavior = new BABYLON.SixDofDragBehavior();
            newDragBehavior.dragDeltaRatio = 1;
            newDragBehavior.zDragFactor = 1;
            newDragBehavior.detachCameraControls = true;
            
            // c. Pasang Listener GRAB
            newDragBehavior.onDragStartObservable.add(() => {
                attachThermometerToController(); // Panggil fungsi snap saat di-grab
            });

            thermometerMesh.addBehavior(newDragBehavior);
            thermometerMesh.dragBehavior = newDragBehavior;
        }
    }, 1500);
}
    // =====================================
    // Fungsi Reset Item
    // =====================================
    function resetItem(mesh, initialPosition, initialRotation) {
        if (!mesh) return;
        mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
        // Pastikan semua mesh terlihat saat di-reset
        findAllMeshesAndSetVisibility(mesh, true);
        
        // 1. Hapus impostor sementara 
        if (mesh.physicsImpostor) {
            mesh.physicsImpostor.dispose();
            mesh.physicsImpostor = null; 
        }
        
        // 2. Hapus parenting 
        mesh.setParent(null); 
        
        // 3. Atur ulang posisi dan rotasi mesh secara manual
        mesh.position.copyFrom(initialPosition);
        // Penting: Gunakan quaternion jika model dirotasi secara kompleks. Untuk saat ini, kita gunakan rotation.
        mesh.rotationQuaternion = null; 
        mesh.rotation.copyFrom(initialRotation); 
        
        mesh.checkCollisions = true;
        
        // 4. Buat ulang impostor dengan properti yang sama
        const mass = 0.01; 
        const restitution = 0.4; 
        
        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
            mesh,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: mass, restitution: restitution },
            mesh.getScene()
        );
        // --- PERBAIKAN: AKTIFKAN KEMBALI DRAG BEHAVIOR ---
        // Khusus untuk stetoskop, pasang lagi behavior-nya
        if (mesh.name === "stethoscopeWrapper" || mesh === stethoscopeMesh) {
            if (stethoscopeDragBehavior) {
                stethoscopeDragBehavior.attach(mesh);
            }
        }
        console.log(`[RESET] Item ${mesh.name} berhasil diatur ulang.`);
    }
    
    function resetAllItems() {
        // 1. Detach stetoskop dulu jika terpasang
        if (isStethoscopeAttached) {
            detachStethoscopeFromCamera(); // Ini akan memanggil resetItem
        } 
        
        // 2. Reset semua item lainnya 
        resetItem(thermometerMesh, ITEM_POSITIONS.thermometer.pos, ITEM_POSITIONS.thermometer.rot);
        // Panggil reset untuk stethoscope juga, untuk jaga-jaga jika sudah detached tapi belum reset sempurna
        resetItem(stethoscopeMesh, ITEM_POSITIONS.stethoscope.pos, ITEM_POSITIONS.stethoscope.rot); 
        resetItem(tensimeterMesh, ITEM_POSITIONS.tensimeter.pos, ITEM_POSITIONS.tensimeter.rot);
        
        // 3. Sembunyikan semua teks hasil pemeriksaan
        tempText.isVisible = false;
        StethoText.isVisible = false;
        tensiText.isVisible = false;
        
        // 4. Hapus billboard/gambar hasil pemeriksaan
        const image1 = scene.getMeshByName("image1");
        const image2 = scene.getMeshByName("image2");
        const image3 = scene.getMeshByName("image3");
        if (image1) image1.dispose();
        if (image2) image2.dispose();
        if (image3) image3.dispose();

        console.log("Semua item telah di-reset ke posisi awal.");
    }
    
    // =====================================
    // Buat Tombol Reset 3D
    // =====================================
    // 1. Buat Material Merah Solid
    const solidRedMat = new BABYLON.StandardMaterial("solidRedMat", scene);
    solidRedMat.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); 
    solidRedMat.emissiveColor = new BABYLON.Color3(0.4, 0.1, 0.1); 
    solidRedMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); 
    solidRedMat.backFaceCulling = false; 

    // 2. Buat Mesh Tombol Utama (Kotak Merah Solid)
    const resetButton = BABYLON.MeshBuilder.CreateBox("resetButton", { height: 0.3, width: 0.3, depth: 0.1 }, scene);
    
    // Atur Posisi & Rotasi Tombol
    resetButton.position = new BABYLON.Vector3(-15.5, 1.8, 28.2); 
    
    // Terapkan Material Merah Solid
    resetButton.material = solidRedMat; 
    resetButton.checkCollisions = false; 
    
    // Jadikan tombol statis (mass 0)
    resetButton.physicsImpostor = new BABYLON.PhysicsImpostor(
        resetButton,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.0 },
        scene
    );
    
    // 3. Buat Mesh Plane Terpisah untuk Menampilkan Teks
    const textPlane = BABYLON.MeshBuilder.CreatePlane("resetTextPlane", { width: 0.3, height: 0.3 }, scene);
    
    textPlane.position = new BABYLON.Vector3(0, 0.3, -0.06); 
    textPlane.parent = resetButton; 
    textPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE; 

    // 4. Buat ADT dan Terapkan ke Plane Teks
    const adtReset = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        textPlane, 
        800, 
        300, 
        false 
    ); 
    
    // Tambahkan Label Teks
    const label = new BABYLON.GUI.TextBlock();
    label.text = "RESET ITEM";
    label.color = "white"; 
    label.fontSize = 100; 
    adtReset.addControl(label);

    // 5. Tambahkan Logika Klik ke Tombol Utama (Kotak Merah)
    resetButton.actionManager = new BABYLON.ActionManager(scene);
    resetButton.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
            console.log("Tombol Reset Ditekan!");
            resetAllItems(); // Panggil fungsi reset
        })
    );
    
    // =====================================
    // CUSTOM GRAB LOGIC UNTUK STETOSKOP
    // =====================================
    
    // Simpan drag behavior asli stetoskop
    let stethoscopeDragBehavior = null;
    stethoscopeMesh.behaviors.forEach(behavior => {
        if (behavior instanceof BABYLON.SixDofDragBehavior) {
            stethoscopeDragBehavior = behavior;
        }
    });

    if (stethoscopeDragBehavior) {
    stethoscopeDragBehavior.onDragStartObservable.add(() => {
        console.log("Stetoskop di-grab...");
        setTimeout(() => {
            // GANTI PEMANGGILAN KE FUNGSI BARU
            attachStethoscopeToController(); 
        }, 10);
    });
}

    // // Backup: Action Manager untuk mouse click
    // stethoscopeMesh.actionManager = new BABYLON.ActionManager(scene);
    // stethoscopeMesh.actionManager.registerAction(
    //     new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
    //         if (isProcessing || isStethoscopeAttached) return;
    //         console.log("Stetoskop di-klik (mouse), langsung attach ke kamera");
    //         attachStethoscopeToCamera();
    //     })
    // );

    // =====================================
    // Logic Interaksi 
    // =====================================
    
    // 1. Termometer ke Kepala (Beep Suhu)
    headTarget.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            { trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger, parameter: thermometerMesh }, 
            function () {
                if (!isProcessing) {
                    isProcessing = true;
                    // Jeda 1 detik sebelum beep dan menampilkan hasil
                    setTimeout(() => {
                        beepSound.play(); // 🔊 SUARA BEEP
                        const temperature = (36.4).toFixed(1);
                        tempText.text = `${temperature}°C`;
                        tempText.isVisible = true;
                        // Tambahkan gambar 1
                        createPngBillboard(
                            "image1", 
                            "SuhuTubuh.png", 
                            new BABYLON.Vector3(-17.5, 2.5, 28.15), // Posisi di samping meja
                            1, // Ukuran lebar bidang
                            scene
                        );
                        setTimeout(() => {
                            tempText.isVisible = false;
                            isProcessing = false;
                        }, 2000);
                        
                    }, 1000);
                }
            }
        )
    );
    
    // 2. Stetoskop ke Dada (Heartbeat Sound) - MODIFIKASI
    chestTarget.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            { trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger, parameter: stethoscopeMesh }, 
            function () {
                if (!isProcessing && !isHeartbeatPlaying && isStethoscopeAttached) {
                    isProcessing = true;
                    
                    // Detach stetoskop dari kamera terlebih dahulu
                    detachStethoscopeFromCamera();
                    
                    // Jeda 1 detik sebelum suara dimulai
                    setTimeout(() => {
                        const BPM = (50).toFixed(1);
                        StethoText.text = `${BPM} BPM`;
                        StethoText.isVisible = true;
                        // Tambahkan gambar 2
                        createPngBillboard(
                            "image2", 
                            "DetakJantung.png", 
                            new BABYLON.Vector3(-17, 2, 28.15), 
                            1, 
                            scene
                        );

                        setTimeout(() => {
                            StethoText.isVisible = false;
                            isProcessing = false;
                        }, 2000);
                    }, 1000);
                }
            }
        )
    );

    // 3. Tensimeter ke Lengan Kanan (Tekanan Darah)
    armTarget.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            { trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger, parameter: tensimeterMesh }, 
            function () {
                if (!isProcessing) {
                    isProcessing = true;
                    setTimeout(() => {
                        const systolic = Math.floor(90);
                        const diastolic = Math.floor(60);
                        tensiText.text = `${systolic}/${diastolic} mmHg`;
                        tensiText.isVisible = true;
                        // Tambahkan gambar 3
                        createPngBillboard(
                            "image3", 
                            "TekananDarah.png", 
                            new BABYLON.Vector3(-16.5, 2.5, 28.15), 
                            1, 
                            scene
                        );

                        setTimeout(() => {
                            tensiText.isVisible = false;
                            isProcessing = false;
                        }, 2000);
                    }, 1000);
                }
            }
        )
    );
    // =====================================
  // UI & TYPEWRITER (TETAP SAMA)
  // =====================================
  let currentState = 1;
  let dialogTitle;
  let dialogBody;
  let lanjutButton;
  let finalButtonsContainer;
  let charIndex = 0;
  let isTyping = false;
  let currentTextTarget = "";
  let typeObserver = null;
  const TYPING_SPEED = 3;

  // TEKS
  const TAHAP_1_JUDUL = "Halo, Calon Dokter!";
  const TAHAP_1_BODY = "Selamat Datang di Simulasi Pemeriksaan Pasien";
  const TAHAP_2_BODY = "Pasien baru saja datang ke ruang pemeriksaan dengan keluhan pusing dan lemas setelah berdiri lama. Lakukan pemeriksaan dasar untuk mengetahui penyebab keluhan pasien.";
  const TAHAP_3_JUDUL = "SIMULASI";
  const TAHAP_3_BODY = "AYO SIMULASI!!!";
  const TAHAP_4_BODY = "Langkah 1: Periksa detak jantung dan paru pasien menggunakan stetoskop";
  const TAHAP_5_BODY = "Langkah 2: Lanjutkan pemeriksaan tekanan darah menggunakan tensimeter digital.";
  const TAHAP_6_BODY = "Langkah 3: Pastikan pasien tidak mengalami infeksi dengan memeriksa suhu tubuh menggunakan termometer digital.";
  const TAHAP_7_BODY = "Baik, setelah melakukan pemeriksaan terhadap pasien, dapat disimpulkan bahwa diagnosis awal dari pasien adalah pasien kemungkinan mengalami hipotensi ringan akibat dari kelelahan dan kurangnya asupan gizi. Maka tindakan yang dapat dilakukan adalah memberikan cairan infus elektrolit guna membantu menstabilkan tekanan darah pasien.";
  const TAHAP_8_BODY = "Simulasi telah selesai! Selamat, telah berhasil melakukan pemeriksaan terhadap pasien dengan menggunakan alat medis dasar.";

  // TYPEWRITER
  function typeWriterEffect(targetText, textBlock, scene, onComplete = () => {}) {
    if (isTyping && typeObserver) {
      scene.onBeforeRenderObservable.remove(typeObserver);
    }
    isTyping = true;
    charIndex = 0;
    currentTextTarget = targetText;
    textBlock.text = "";
    lanjutButton.isHitTestVisible = false;

    typeObserver = scene.onBeforeRenderObservable.add(() => {
      if (charIndex <= currentTextTarget.length) {
        if (scene.getEngine().frameId % TYPING_SPEED === 0) {
          textBlock.text = currentTextTarget.substring(0, charIndex);
          charIndex++;
        }
      } else {
        isTyping = false;
        scene.onBeforeRenderObservable.remove(typeObserver);
        typeObserver = null;
        onComplete();
      }
    });
  }

  // UI PLANE
  const uiPlane = BABYLON.MeshBuilder.CreatePlane("uiPlane", scene);
  uiPlane.position = new BABYLON.Vector3(-19, 3, 28);
  uiPlane.rotation.x = -0.2;
  uiPlane.scaling.scaleInPlace(4);

  const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
    uiPlane,
    3000,
    3000
  );

  // PANEL
  const mainPanel = new BABYLON.GUI.Rectangle("mainPanel");
  mainPanel.widthInPixels = 1920;
  mainPanel.heightInPixels = 1080;
  mainPanel.background = "rgba(20, 50, 130, 0.5)";
  mainPanel.cornerRadius = 50;
  mainPanel.thickness = 10;
  mainPanel.color = "white";
  adt.addControl(mainPanel);

  const stackPanel = new BABYLON.GUI.StackPanel();
  stackPanel.widthInPixels = 1800;
  mainPanel.addControl(stackPanel);

  dialogTitle = new BABYLON.GUI.TextBlock();
  dialogTitle.color = "#FFD700";
  dialogTitle.fontSizeInPixels = 90;
  dialogTitle.fontStyle = "bold";
  dialogTitle.heightInPixels = 150;
  dialogTitle.textWrapping = true;
  stackPanel.addControl(dialogTitle);

  dialogBody = new BABYLON.GUI.TextBlock();
  dialogBody.color = "white";
  dialogBody.fontSizeInPixels = 70;
  dialogBody.heightInPixels = 500;
  dialogBody.textWrapping = true;
  stackPanel.addControl(dialogBody);

  lanjutButton = BABYLON.GUI.Button.CreateSimpleButton("lanjut", "Lanjut");
  lanjutButton.widthInPixels = 500;
  lanjutButton.heightInPixels = 150;
  lanjutButton.background = "#5CB85C";
  lanjutButton.color = "white";
  lanjutButton.fontSizeInPixels = 50;
  lanjutButton.onPointerClickObservable.add(handleLanjutClick);
  stackPanel.addControl(lanjutButton);

  finalButtonsContainer = new BABYLON.GUI.StackPanel();
  finalButtonsContainer.isVertical = false;
  finalButtonsContainer.spacing = 50;
  finalButtonsContainer.isVisible = false;
  stackPanel.addControl(finalButtonsContainer);

  // STATE MACHINE
  function handleLanjutClick() {
    if (isTyping) return;
    
    // **PERBAIKAN SUARA:** Buka kunci Audio Context pada klik pertama
    if (currentState === 1) { 
      if (engine.audioEngine && !engine.audioEngine.isUnlocked) {
        engine.audioEngine.unlock();
        console.log("Audio Context unlocked on first click.");
      }
    }

    currentState++;

    if (currentState === 2) {
      dialogTitle.text = "";
      typeWriterEffect(TAHAP_2_BODY, dialogBody, scene, () => {
        lanjutButton.isHitTestVisible = true;
      });
    }
  
    if (currentState === 3) {
      dialogTitle.text = "";
      typeWriterEffect(TAHAP_3_JUDUL, dialogTitle, scene, () => {
        typeWriterEffect(TAHAP_3_BODY, dialogBody, scene, () => {
          lanjutButton.isHitTestVisible = true;
        });
      });
    }
    if (currentState === 4) {
      dialogTitle.text = "";
      typeWriterEffect(TAHAP_4_BODY, dialogBody, scene, () => {
        lanjutButton.isHitTestVisible = true;
      });
    }
    if (currentState === 5) {
      dialogTitle.text = "";
      typeWriterEffect(TAHAP_5_BODY, dialogBody, scene, () => {
        lanjutButton.isHitTestVisible = true;
      });
    }
    if (currentState === 6) {
      dialogTitle.text = "";
      typeWriterEffect(TAHAP_6_BODY, dialogBody, scene, () => {
        lanjutButton.isHitTestVisible = true;
      });
    }
    if (currentState === 7) {
      dialogTitle.text = "";
      typeWriterEffect(TAHAP_7_BODY, dialogBody, scene, () => {
        lanjutButton.isHitTestVisible = true;
      });
    }
    if (currentState === 8) {
      dialogTitle.text = "";
      typeWriterEffect(TAHAP_8_BODY, dialogBody, scene, () => {
         lanjutButton.textBlock.text = "Selesai";
        lanjutButton.isHitTestVisible = true;
        lanjutButton.onPointerClickObservable.clear(); // Hapus listener lama
        lanjutButton.onPointerClickObservable.add(() => {
          window.location.href = "index.html"; // Navigasi kembali
        });
      });
    }
  }

  const grabBehavior = new BABYLON.SixDofDragBehavior();
  grabBehavior.allowMultiPointer = true;
  uiPlane.addBehavior(grabBehavior);

  typeWriterEffect(TAHAP_1_JUDUL, dialogTitle, scene, () => {
    typeWriterEffect(TAHAP_1_BODY, dialogBody, scene, () => {
      lanjutButton.isHitTestVisible = true;
    });
  });

    return scene;
};

// ================================
// Jalankan Scene
// ================================
createScene().then(scene => {
    engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => engine.resize());





















































































