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
        rot: new BABYLON.Vector3(80 * DEG_TO_RAD, 160 * DEG_TO_RAD, 0 * DEG_TO_RAD)
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
    // VARIABEL BARU UNTUK ATTACH STETOSKOP
    let isStethoscopeAttached = false; // Status apakah stetoskop sedang terpasang ke kamera

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
    function createGrabbableItem(name, glbFile, position, scaling, wrapperRotation) {
        // 1. Buat Wrapper Box (yang akan kena fisika)
        const wrapper = BABYLON.MeshBuilder.CreateBox(name + "Wrapper", {
            size: itemPhysicsSize 
        }, scene);
        wrapper.position = position; 
        wrapper.isVisible = false; // Sembunyikan box fisika
        
        wrapper.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE; 

        // **FIX: Terapkan Rotasi Awal ke Wrapper**
        if (wrapperRotation) {
            wrapper.rotation.copyFrom(wrapperRotation); 
        }

        // 2. Tambahkan metadata ke WRAPPER
        wrapper.metadata = {
            isGrabbable: true,
            itemData: { title: name }
        };

        // 3. Tambahkan fisika ke WRAPPER
        wrapper.physicsImpostor = new BABYLON.PhysicsImpostor(
            wrapper,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: itemPhysicsMass, restitution: 0.4 },
            scene
        );
        
        // 4. Muat model GLB
        BABYLON.SceneLoader.ImportMesh("", "assets/", glbFile, scene, function (meshes) {
            const rootMesh = meshes[0];
            
            // 5. Parent-kan GLB ke WRAPPER
            rootMesh.setParent(wrapper);
            
            // 6. Atur posisi/skala/rotasi GLB RELATIF ke wrapper
            rootMesh.position = new BABYLON.Vector3(0, 0, 0); 
            rootMesh.scaling = scaling;
        });
        
        return wrapper; 
    }
    
    // --- Gunakan helper untuk memuat dan menangkap semua item ---
    stethoscopeMesh = createGrabbableItem("stethoscope", "STETOSKOP.glb", 
        ITEM_POSITIONS.stethoscope.pos, 
        new BABYLON.Vector3(0.04, 0.04, 0.04),
        ITEM_POSITIONS.stethoscope.rot
    );
    
    thermometerMesh = createGrabbableItem("thermometer", "thermometer.glb", 
        ITEM_POSITIONS.thermometer.pos, 
        new BABYLON.Vector3(0.25, 0.25, 0.25),
        ITEM_POSITIONS.thermometer.rot
    );

    tensimeterMesh = createGrabbableItem("tensimeter", "tensimeter.glb", 
        ITEM_POSITIONS.tensimeter.pos, 
        new BABYLON.Vector3(0.3, 0.3, 0.3),
        ITEM_POSITIONS.tensimeter.rot
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

    function attachStethoscopeToCamera() {
        if (!stethoscopeMesh || isStethoscopeAttached || isProcessing) return;

        // LANGKAH PENTING 1: Dispatch event kustom untuk melepas item dari sistem grabbing (di grab.js)
        // Ini memastikan item dilepas dari tangan VR jika sedang dipegang.
        const customEvent = new CustomEvent('releaseStethoscope', { detail: { mesh: stethoscopeMesh } });
        window.dispatchEvent(customEvent);
        
        const activeCamera = getActiveCamera();
        if (!activeCamera) return;

        // Nonaktifkan fisika sementara
        if (stethoscopeMesh.physicsImpostor) {
            stethoscopeMesh.physicsImpostor.dispose();
            stethoscopeMesh.physicsImpostor = null;
        }

        stethoscopeMesh.checkCollisions = false;

        // Parent-kan stetoskop ke kamera
        stethoscopeMesh.setParent(activeCamera);
        
        // Atur posisi relatif ke kamera (di depan kamera)
        stethoscopeMesh.position = new BABYLON.Vector3(0, -0.3, 0.5);
        
        // Set isVisible = false untuk SEMUA mesh dalam hierarki (Membuatnya menghilang)
        findAllMeshesAndSetVisibility(stethoscopeMesh, false);
        
        isStethoscopeAttached = true;
        console.log("Stetoskop terpasang ke kamera (tidak terlihat).");
    }
    
    function detachStethoscopeFromCamera() {
        if (!stethoscopeMesh || !isStethoscopeAttached) return;

        // Set isVisible = true untuk SEMUA mesh dalam hierarki (Membuatnya muncul kembali)
        findAllMeshesAndSetVisibility(stethoscopeMesh, true);
        
        // Hapus parenting
        stethoscopeMesh.setParent(null);
        
        // Panggil fungsi reset untuk mengembalikannya ke meja dengan fisika aktif
        resetItem(stethoscopeMesh, ITEM_POSITIONS.stethoscope.pos, ITEM_POSITIONS.stethoscope.rot);

        isStethoscopeAttached = false;
        console.log("Stetoskop dilepaskan dari kamera dan di-reset (terlihat kembali).");
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
    // SIMPLE GRAB SYSTEM UNTUK STETOSKOP
    // =====================================
    let isStethoscopeGrabbed = false;
    
    // Action Manager untuk grab dengan mouse
    stethoscopeMesh.actionManager = new BABYLON.ActionManager(scene);
    stethoscopeMesh.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
            if (isProcessing) return;
            
            if (!isStethoscopeGrabbed && !isStethoscopeAttached) {
                // Grab stetoskop
                attachStethoscopeToCamera();
                isStethoscopeGrabbed = true;
            }
        })
    );
    
    // Untuk VR, gunakan approach yang lebih sederhana
    if (xr) {
        // Setup VR grab dengan approach yang lebih aman
        const originalStethoscopePosition = stethoscopeMesh.position.clone();
        const originalStethoscopeRotation = stethoscopeMesh.rotation.clone();
        
        // Observer untuk mendeteksi ketika stetoskop di-grab di VR
        scene.onBeforeRenderObservable.add(() => {
            if (xr && xr.input && !isStethoscopeGrabbed && !isStethoscopeAttached) {
                // Cek jarak stetoskop dengan controller VR
                xr.input.controllers.forEach(controller => {
                    if (controller.grip) {
                        const distance = BABYLON.Vector3.Distance(controller.grip.position, stethoscopeMesh.position);
                        if (distance < 0.5) { // Jarak threshold untuk grab
                            attachStethoscopeToCamera();
                            isStethoscopeGrabbed = true;
                        }
                    }
                });
            }
        });
    }

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
                    isStethoscopeGrabbed = false;
                    
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
    // Drag Behavior untuk Item Lainnya (Thermometer & Tensimeter)
    // =====================================
    function setupStandardDragBehavior(mesh) {
        const dragBehavior = new BABYLON.SixDofDragBehavior();
        dragBehavior.dragDeltaRatio = 1;
        dragBehavior.zDragFactor = 1;
        dragBehavior.detachCameraControls = true;

        mesh.addBehavior(dragBehavior);

        // Observer untuk mengatur billboard mode
        scene.onBeforeRenderObservable.add(() => {
            if (dragBehavior.currentDraggingPointerId !== -1) {
                // KONDISI: SEDANG DIPEGANG (GRAB)
                if (mesh.billboardMode !== BABYLON.Mesh.BILLBOARDMODE_Y) {
                    mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
                }
            } else {
                // KONDISI: TIDAK DIPEGANG (DIAM/DI MEJA)
                if (mesh.billboardMode !== BABYLON.Mesh.BILLBOARDMODE_NONE) {
                    mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
                    
                    // Hentikan sisa momentum putaran fisika agar tidak 'melintir' di meja
                    if (mesh.physicsImpostor) {
                        mesh.physicsImpostor.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
                    }
                }
            }
        });
    }

    // Terapkan drag behavior standar untuk thermometer dan tensimeter
    setupStandardDragBehavior(thermometerMesh);
    setupStandardDragBehavior(tensimeterMesh);
    
    // =====================================
    // UI & TYPEWRITER 
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
    const TAHAP_7_BODY = "Baik, setelah anda melakukan pemeriksaan terhadap pasien, dapat disimpulkan bahwa diagnosis awal dari pasien adalah pasien kemungkinan mengalami hipotensi ringan akibat dari kelelahan dan kurangnya asupan gizi. Maka tindakan yang dapat dilakukan adalah memberikan cairan infus elektrolit guna membantu menstabilkan tekanan darah pasien.";
    const TAHAP_8_BODY = "Simulasi telah selesai! Selamat, anda telah berhasil melakukan pemeriksaan terhadap pasien dengan menggunakan alat medis dasar.";

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
    
    // Pemanggilan fungsi grabLogic (didefinisikan di grab.js)
    if (typeof setupGrabLogic !== 'undefined') {
        setupGrabLogic(scene, xr);
    }

    return scene;
};

// ================================
// Jalankan Scene
// ================================
createScene().then(scene => {
    engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => engine.resize());
