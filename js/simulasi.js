// js/simulasi.js

// ================================
// Inisialisasi Engine & Canvas
// ================================
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// ================================
// Definisikan Posisi Awal Item & Rotasi Awal
// ================================
const START_Y = 1.65; // Ketinggian awal item
const DEG_TO_RAD = Math.PI / 180; // Konversi Derajat ke Radian

const ITEM_POSITIONS = {
    stethoscope: {
        pos: new BABYLON.Vector3(-17, START_Y, 27.5),
        rot: new BABYLON.Vector3(0, Math.PI, 0) // Rotasi awal Stethoscope
    },
    thermometer: {
    pos: new BABYLON.Vector3(-16.3, START_Y, 27.5),
    // Rotasi 90 derajat (Math.PI / 2) pada sumbu X.
    // Sumbu Y dan Z dikembalikan ke 0.
    rot: new BABYLON.Vector3(Math.PI/2,Math.PI,0)
},
    tensimeter: {
        pos: new BABYLON.Vector3(-17.5, START_Y, 27.5),
        // Konversi dari (-110, 160, 100) derajat ke radian
        rot: new BABYLON.Vector3(0, Math.PI, 2)
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
    let chestpieceMesh = null; // Mesh chestpiece yang terpisah
    // VARIABEL BARU UNTUK ATTACH STETOSKOP
    let isStethoscopeAttached = false; // Status apakah stetoskop sedang terpasang ke kamera
    let rightVRController = null; // Untuk menyimpan controller kanan
    let stethoscopeTube = null;   // Mesh tali stetoskop
    let tubeUpdateObserver = null;
    let isThermometerAttached = false; // Status termometer
    let isTensimeterAttached = false;
    // Aktifkan Fisika (CannonJS)
    const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
    // Pastikan library CannonJS sudah dimuat di HTML
    const physicsPlugin = new BABYLON.CannonJSPlugin();
    scene.enablePhysics(gravityVector, physicsPlugin);


    
    // ================================
    // Buat ground (lantai dunia)
    // ================================
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 1000, height: 1000 }, scene);
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
    const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(-17, 2, 22), scene);
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

            BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "kasur.glb", scene
    ).then((result) => {
        if (result.meshes.length > 0) {
            result.meshes[0].position = new BABYLON.Vector3(-21.9, 0, 9.7);
            result.meshes[0].scaling = new BABYLON.Vector3(-0.46, 0.46, 0.46);
            result.meshes[0].getChildMeshes().forEach(mesh => {
                mesh.checkCollisions = false;
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
                                    // Logic release hanya dijalankan saat interaksi selesai atau jika user melepaskannya sebelum interaksi
                                }
                                 
                                // Cek Termometer (TAMBAHAN BARU)
                                if (isThermometerAttached) {
                                    releaseThermometer();
                                }
                                if (isTensimeterAttached) {
                                    releaseTensimeter();
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

    const mejaCollision1= BABYLON.MeshBuilder.CreateBox("mejaCollision", {height: 0.4, width: 0.7, depth: 0.7}, scene);
    mejaCollision1.position = new BABYLON.Vector3(-17, 1, 27.5);
    mejaCollision1.isVisible = false;
    mejaCollision1.physicsImpostor = new BABYLON.PhysicsImpostor(
        mejaCollision1,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );
    const mejaCollision2= BABYLON.MeshBuilder.CreateBox("mejaCollision", {height: 0.6, width: 0.7, depth: 0.7}, scene);
    mejaCollision2.position = new BABYLON.Vector3(-17.7, 1, 27.5);
    mejaCollision2.isVisible = false;
    mejaCollision2.physicsImpostor = new BABYLON.PhysicsImpostor(
        mejaCollision2,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );
    const mejaCollision3= BABYLON.MeshBuilder.CreateBox("mejaCollision", {height: 0.6, width: 0.7, depth: 0.7}, scene);
    mejaCollision3.position = new BABYLON.Vector3(-16.3, 1, 27.5);
    mejaCollision3.isVisible = false;
    mejaCollision3.physicsImpostor = new BABYLON.PhysicsImpostor(
        mejaCollision3,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );

     const dindingCollision1= BABYLON.MeshBuilder.CreateBox("dindingCollision", {height: 10, width: 0.2, depth: 19}, scene);
    dindingCollision1.position = new BABYLON.Vector3(-22.6, 1, 27.5);
    dindingCollision1.isVisible = false;
    dindingCollision1.physicsImpostor = new BABYLON.PhysicsImpostor(
        dindingCollision1,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );

    const dindingCollision2= BABYLON.MeshBuilder.CreateBox("dindingCollision", {height: 10, width: 0.2, depth: 19}, scene);
    dindingCollision2.position = new BABYLON.Vector3(-12.5, 1, 27.5);
    dindingCollision2.isVisible = false;
    dindingCollision2.physicsImpostor = new BABYLON.PhysicsImpostor(
        dindingCollision2,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );


    const kasurCollision1= BABYLON.MeshBuilder.CreateBox("kasurCollision", {height: .4, width: 1, depth: 4}, scene);
    kasurCollision1.position = new BABYLON.Vector3(-14.57, 0.8, 27.5);
    kasurCollision1.isVisible = false;
    kasurCollision1.checkCollisions=true;
    kasurCollision1.physicsImpostor = new BABYLON.PhysicsImpostor(
        kasurCollision1,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );

    const lantaiCollision= BABYLON.MeshBuilder.CreateBox("lantaiCollision", {height: 0.4, width: 16, depth: 19}, scene);
    lantaiCollision.position = new BABYLON.Vector3(-14.57, 0, 27.5);
    lantaiCollision.isVisible = false;
    lantaiCollision.checkCollisions=true;
    lantaiCollision.physicsImpostor = new BABYLON.PhysicsImpostor(
        lantaiCollision,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.2 },
        scene
    );

    // Pasien
    BABYLON.SceneLoader.ImportMesh("", "assets/", "pasien.glb", scene, function (meshes) {
        const rootMesh = meshes[0];
        rootMesh.position = new BABYLON.Vector3(-14.7, 1.1, 25.5);
        rootMesh.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
        rootMesh.rotation = new BABYLON.Vector3(3 * Math.PI / 2, 0, 3.2);
        rootMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
            rootMesh,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 0, restitution: 0.4 },
            scene
        );
    });

    // --- GUI, SOUND, TARGET ---
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
    const chestTarget = BABYLON.MeshBuilder.CreateSphere("tChest", { diameter: 0.5 }, scene);
    chestTarget.position = new BABYLON.Vector3(-14.6, 1.2, 27);
    chestTarget.isVisible = false; // Set ke false agar tidak terlihat

    const headTarget = BABYLON.MeshBuilder.CreateSphere("tHead", { diameter: 0.5 }, scene);
    headTarget.position = new BABYLON.Vector3(-14.6, 1.15, 27.5);
    headTarget.isVisible = false; // Set ke false agar tidak terlihat

    const armTarget = BABYLON.MeshBuilder.CreateSphere("tArm", { diameter: 0.5 }, scene);
    armTarget.position = new BABYLON.Vector3(-14.25, 1.1, 27);
    armTarget.isVisible = false; // Set ke false agar tidak terlihat

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
    const itemPhysicsMass = 0.5; // Massa ringan

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
        new BABYLON.Vector3(0.0009, 0.0009, 0.0009),
        ITEM_POSITIONS.stethoscope.rot,
        false
    );
     
    thermometerMesh = createGrabbableItem("thermometer", "thermometer.glb", 
        ITEM_POSITIONS.thermometer.pos, 
        new BABYLON.Vector3(-0.25, -0.25, -0.25),
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
if (tensimeterMesh.dragBehavior) {
        tensimeterMesh.dragBehavior.onDragStartObservable.add(() => {
            console.log("Tensimeter didrag pertama kali...");
            attachTensimeterToController();
        });
    }

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
    // Muat Chestpiece (Mesh Terpisah)
    // =====================================
    BABYLON.SceneLoader.ImportMesh("", "assets/", "chestpiece.glb", scene, function (meshes) {
        chestpieceMesh = meshes[0];
         
        // Atur skala agar sesuai (mungkin perlu disesuaikan dengan model aslinya)
        chestpieceMesh.scaling = new BABYLON.Vector3(0.04, 0.04, 0.04); 
         
        // Pastikan collision mati agar tidak mengganggu grab
        chestpieceMesh.getChildMeshes().forEach(m => m.checkCollisions = false);
         
        // SEMBUNYIKAN DI AWAL (Hanya muncul saat dipegang)
        findAllMeshesAndSetVisibility(chestpieceMesh, false);
        
        // >>> LOGIKA INTERAKSI STETOSKOP DENGAN SNAPPING BARU <<<
        chestTarget.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
                { trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger, parameter: chestpieceMesh },  
                function () {
                    if (!isProcessing && !isHeartbeatPlaying && isStethoscopeAttached) {
                        
                        // 1. SNAP: Lepas dari controller dan tempel ke target (mempertahankan tali)
                        // stopTubeSimulation(); // Baris ini DIHAPUS agar tali tetap jalan
                        chestpieceMesh.setParent(null); // Detach dari Controller
                        chestpieceMesh.setParent(chestTarget); // SNAP ke Target
                        
                        // Reset posisi dan rotasi lokal agar pas di tengah target
                        chestpieceMesh.position = new BABYLON.Vector3(0, 0, 0); 
                        chestpieceMesh.rotationQuaternion = null;
                        // Rotasi agar chestpiece menghadap ke atas/depan
                        chestpieceMesh.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); 
                        
                        // Nonaktifkan pickable saat sudah snap
                        setHierarchicalPickable(chestpieceMesh, false); 
                        
                        isProcessing = true;
                        
                        // Jeda 1 detik sebelum suara dimulai
                        setTimeout(() => {
                            const BPM = (50).toFixed(1);
                            StethoText.text = `${BPM} BPM`;
                            StethoText.isVisible = true;
                            // Tambahkan gambar 2
                            createPngBillboard(
                                "image2", 
                                "DetakJantung.png", 
                                new BABYLON.Vector3(-17.5, 2.5, 28.15), // Posisi y sedikit dinaikkan
                                1, 
                                scene
                            );

                            setTimeout(() => {
                                StethoText.isVisible = false;
                                isProcessing = false;
                                
                                // 2. UN-SNAP: Lepas dari target dan kembalikan ke meja
                                chestpieceMesh.setParent(null); // Lepas dari target
                                releaseStethoscopeInPlace(); // Panggil fungsi yang mengembalikan stetoskop ke posisi semula
                            }, 2000);
                        }, 1000);
                    }
                }
            )
        );
        // <<< AKHIR LOGIKA INTERAKSI STETOSKOP DENGAN SNAPPING BARU >>>
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

    // Titik Akhir: Ke Chestpiece (baik di tangan maupun di dada pasien)
    let endPoint;
    if (chestpieceMesh && chestpieceMesh.isVisible) {
        // Menggunakan absolutePosition agar tali selalu mengikuti chestpiece
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

        // Ambil posisi terakhir tangan/dada
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
             
            // --- [PASANG LISTENER GRAB BARU] ---
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
    
    // 3. ATUR POSISI SNAP
    // Posisi sedikit disesuaikan agar tidak tenggelam dalam controller
    thermometerMesh.position = new BABYLON.Vector3(0, 0.05, 0); 
    
    thermometerMesh.rotationQuaternion = null;

    // --- MODIFIKASI: Menggunakan IF untuk rotasi tegak ---
    if (thermometerMesh.parent) {
        // (0, Math.PI, 0) membuat objek tegak lurus dan menghadap ke belakang (ke arah user)
        thermometerMesh.rotation = new BABYLON.Vector3(0, -Math.PI/2, 0);
    }
    // -----------------------------------------------------

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
     
    // Reset rotasi agar jatuh wajar (teguk lurus gravitasi)
    thermometerMesh.rotationQuaternion = null;
    thermometerMesh.rotation = new BABYLON.Vector3(0, 0, 0);

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
function attachTensimeterToController() {
    if (!tensimeterMesh || isTensimeterAttached || isProcessing) return;

    // Cari Controller Kanan atau Camera
    let parentTarget = null;
    if (rightVRController) {
        parentTarget = rightVRController.grip || rightVRController.pointer;
    } else {
        parentTarget = getActiveCamera(); 
    }
    if (!parentTarget) return;

    console.log("GRAB TENSIMETER: Snap ke tangan.");

    // 1. Matikan Fisika & Behavior Lama
    if (tensimeterMesh.physicsImpostor) {
        tensimeterMesh.physicsImpostor.dispose();
        tensimeterMesh.physicsImpostor = null;
    }
    if (tensimeterMesh.dragBehavior) {
        tensimeterMesh.dragBehavior.detach();
    }

    // 2. Tempel ke Tangan
    tensimeterMesh.setParent(parentTarget);
    
    // 3. ATUR POSISI SNAP (Sesuaikan angka ini agar pas di tangan)
    tensimeterMesh.position = new BABYLON.Vector3(0, -0.05, 0.15); 
    
    // Atur Rotasi agar menghadap ke arah yang benar
    tensimeterMesh.rotationQuaternion = null;
    // Ubah nilai ini jika arah tensimeter terbalik di tangan
    tensimeterMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0); 

    // 4. Pastikan Terlihat & Matikan Billboard
    findAllMeshesAndSetVisibility(tensimeterMesh, true);
    tensimeterMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;

    isTensimeterAttached = true;
}
function releaseTensimeter() {
    if (!tensimeterMesh || !isTensimeterAttached) return;

    console.log("RELEASE TENSIMETER: Jatuh fisika.");

    // 1. Hapus Behavior Lama
    if (tensimeterMesh.dragBehavior) {
        tensimeterMesh.dragBehavior.detach();
        tensimeterMesh.removeBehavior(tensimeterMesh.dragBehavior);
        tensimeterMesh.dragBehavior = null;
    }

    // 2. Matikan Raycast Sementara
    setHierarchicalPickable(tensimeterMesh, false);

    // 3. Lepas dari Tangan (Unparent)
    const dropPosition = tensimeterMesh.absolutePosition.clone();
    tensimeterMesh.setParent(null);
    tensimeterMesh.position.copyFrom(dropPosition);
    
    // Reset rotasi agar jatuh wajar
    tensimeterMesh.rotationQuaternion = null;
    tensimeterMesh.rotation = new BABYLON.Vector3(0, 0, 0);

    // 4. Aktifkan Fisika (Jatuh)
    tensimeterMesh.checkCollisions = true;
    if (tensimeterMesh.physicsImpostor) {
        tensimeterMesh.physicsImpostor.dispose();
    }
    // Massa tensimeter mungkin lebih berat dari termometer
    tensimeterMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
        tensimeterMesh,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 2.0, restitution: 0.1, friction: 0.6 }, 
        scene
    );

    isTensimeterAttached = false;

    // 5. COOLDOWN: Pasang kembali Grab setelah 1.5 detik
    setTimeout(() => {
        if (tensimeterMesh) {
            console.log("Tensimeter siap diambil lagi.");
            
            // a. Hidupkan sensor sentuh
            setHierarchicalPickable(tensimeterMesh, true);

            // b. Buat Behavior Baru
            const newDragBehavior = new BABYLON.SixDofDragBehavior();
            newDragBehavior.dragDeltaRatio = 1;
            newDragBehavior.zDragFactor = 1;
            newDragBehavior.detachCameraControls = true;
            
            // c. Pasang Listener GRAB
            newDragBehavior.onDragStartObservable.add(() => {
                attachTensimeterToController(); // Panggil fungsi snap saat di-grab
            });

            tensimeterMesh.addBehavior(newDragBehavior);
            tensimeterMesh.dragBehavior = newDragBehavior;
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
        // Logika re-arming dilakukan di dalam releaseInPlace() / releaseThermometer()
    }
     
    function resetAllItems() {
        // 1. Detach stetoskop dulu jika terpasang
        if (isStethoscopeAttached) {
            // Gunakan releaseInPlace agar fisikanya bekerja (jatuh) dan re-arming
            releaseStethoscopeInPlace(); 
        } 
        if (isThermometerAttached) {
             releaseThermometer();
        }
        if (isTensimeterAttached) {
             releaseTensimeter();
        }
        // 2. Reset semua item lainnya (HANYA jika tidak sedang di-detach In Place)
        // Kita panggil resetItem secara eksplisit untuk item yang tidak dipegang saat reset
        resetItem(thermometerMesh, ITEM_POSITIONS.thermometer.pos, ITEM_POSITIONS.thermometer.rot);
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
    // Buat Tombol KEMBALI KE LOBBY (index.html) 3D
    // =====================================
    // 1. Buat Material Biru Solid (Untuk tombol Lobby)
    const solidBlueMat = new BABYLON.StandardMaterial("solidBlueMat", scene);
    solidBlueMat.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.8); 
    solidBlueMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.4); 
    solidBlueMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); 
    solidBlueMat.backFaceCulling = false; 

    // 2. Buat Mesh Tombol Utama (Kotak Biru Solid)
    const lobbyButton = BABYLON.MeshBuilder.CreateBox("lobbyButton", { height: 0.3, width: 0.3, depth: 0.1 }, scene);
     
    // Atur Posisi & Rotasi Tombol (Diletakkan di samping tombol Reset)
    lobbyButton.position = new BABYLON.Vector3(-13.5, 1.8, 28.2); // Geser sedikit ke kanan dari tombol reset
     
    // Terapkan Material Biru Solid
    lobbyButton.material = solidBlueMat; 
    lobbyButton.checkCollisions = false; 
     
    // Jadikan tombol statis (mass 0)
    lobbyButton.physicsImpostor = new BABYLON.PhysicsImpostor(
        lobbyButton,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.0 },
        scene
    );
     
    // 3. Buat Mesh Plane Terpisah untuk Menampilkan Teks
    const lobbyTextPlane = BABYLON.MeshBuilder.CreatePlane("lobbyTextPlane", { width: 0.3, height: 0.3 }, scene);
     
    lobbyTextPlane.position = new BABYLON.Vector3(0, 0.3, -0.06); 
    lobbyTextPlane.parent = lobbyButton; 
    lobbyTextPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE; 

    // 4. Buat ADT dan Terapkan ke Plane Teks
    const adtLobby = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        lobbyTextPlane, 
        800, 
        300, 
        false 
    ); 
     
    // Tambahkan Label Teks
    const lobbyLabel = new BABYLON.GUI.TextBlock();
    lobbyLabel.text = "KE LOBBY";
    lobbyLabel.color = "white"; 
    lobbyLabel.fontSize = 100; 
    adtLobby.addControl(lobbyLabel);

    // 5. Tambahkan Logika Klik ke Tombol Utama (Kotak Biru)
    lobbyButton.actionManager = new BABYLON.ActionManager(scene);
    lobbyButton.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
            console.log("Tombol Kembali ke Lobby Ditekan!");
            // Fungsi untuk kembali ke index.html
            window.location.href = "index.html"; 
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
    // // (Kode ini dihapus untuk menghindari duplikasi logic grab)

    // =====================================
    // Logic Interaksi (Termometer dan Tensimeter)
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
                            new BABYLON.Vector3(-16.5, 2.5, 28.15), // Posisi di samping meja
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
     
    // 2. Stetoskop ke Dada (Heartbeat Sound) - LOGIKA SUDAH DIPINDAHKAN KE CALLBACK chestpiece.glb

    // 3. Tensimeter ke Lengan Kanan (Tekanan Darah)
    armTarget.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            { trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger, parameter: tensimeterMesh }, 
            function () {
                // Hanya jalankan jika:
                // 1. Tidak sedang ada proses lain (isProcessing false)
                // 2. Tensimeter sedang dipegang/attached (isTensimeterAttached true)
                if (!isProcessing && isTensimeterAttached) {
                    isProcessing = true;
                    console.log("Mengukur Tekanan Darah...");

                    // A. SNAP LOGIC: Lepas dari Controller, Tempel ke Target
                    tensimeterMesh.setParent(null); // Lepas dari tangan
                    tensimeterMesh.setParent(armTarget); // Tempel ke Lengan (Target)

                    // B. Atur Posisi & Rotasi Visual di Lengan
                    // Reset posisi lokal ke 0,0,0 (tepat di tengah sphere target)
                    tensimeterMesh.position = new BABYLON.Vector3(0, 0, 0); 
                    
                    // Reset Rotasi (Sesuaikan nilai Vector3 ini agar manset terlihat melingkar di lengan)
                    tensimeterMesh.rotationQuaternion = null;
                    tensimeterMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0); 

                    // Matikan sensor sentuh agar tidak bisa diambil paksa saat mengukur
                    setHierarchicalPickable(tensimeterMesh, false);

                    // C. Jeda Waktu Pengukuran (Misal 1 detik seolah memompa)
                    setTimeout(() => {
                        // Tampilkan Hasil Teks
                        const systolic = 110; // Contoh hasil
                        const diastolic = 70;
                        tensiText.text = `${systolic}/${diastolic} mmHg`;
                        tensiText.isVisible = true;

                        // Tampilkan Gambar/Billboard
                        createPngBillboard(
                            "image3", 
                            "TekananDarah.png", 
                            new BABYLON.Vector3(-17, 2, 28.15), 
                            1, 
                            scene
                        );

                        // D. Selesai & Release (Setelah 2 detik hasil muncul)
                        setTimeout(() => {
                            tensiText.isVisible = false;
                            isProcessing = false;

                            // Lepas parent dari armTarget
                            tensimeterMesh.setParent(null);

                            // Panggil fungsi releaseTensimeter() yang sudah ada
                            // Fungsi ini akan mengaktifkan fisika (jatuh ke lantai/kasur) 
                            // dan mengaktifkan kembali fitur grab setelah cooldown
                            releaseTensimeter(); 

                        }, 2000); // Durasi hasil terlihat
                    }, 1000); // Durasi proses pengukuran
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
  } // Penutup fungsi handleLanjutClick() yang sudah diperiksa

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



