// main.js

// Tunggu hingga seluruh halaman HTML dimuat
window.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. Inisialisasi Inti (Hanya Sekali) ---
    const canvas = document.getElementById("renderCanvas");
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    
    // Array untuk melacak aset apa yang sedang aktif di scene
    let currentAssets = [];
    
    // Kamera Desktop (akan diganti oleh XR jika masuk VR)
    const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 2, 0), scene);
    camera.attachControl(canvas, true);
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = 0.2;
    camera.keysUp.push(87); camera.keysDown.push(83); camera.keysLeft.push(65); camera.keysRight.push(68);
    
    scene.activeCamera = camera; // Mulai dengan kamera desktop

    // --- 2. Setup WebXR (Hanya Sekali) ---
    let xr = null;
    try {
        const ground = BABYLON.MeshBuilder.CreateGround("mainGround", { width: 100, height: 100 }, scene);
        ground.isVisible = false; // Ground ini hanya untuk referensi XR

        xr = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [ground],
            disableTeleportation: true,
            cameraOptions: {
                checkCollisions: true,
                applyGravity: true,
                ellipsoid: new BABYLON.Vector3(0.5, 1, 0.5)
            }
        });

        // Pastikan kamera XR juga memiliki gravitasi dan kolisi
        const xrCamera = xr.baseExperience.camera;
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
                checkCollisions: true,
                applyGravity: true,
                ellipsoid: new BABYLON.Vector3(0.5, 1, 0.5)
            }
        );
        
        console.log("✅ WebXR UTAMA berhasil diinisialisasi.");

    } catch (e) {
        console.warn("⚠️ WebXR tidak didukung, menggunakan mode desktop:", e);
        scene.activeCamera.applyGravity = true;
        scene.activeCamera.checkCollisions = true;
    }


    // --- 3. Fungsi Manajemen Scene ---

    /**
     * Membersihkan semua aset dari scene saat ini (mesh, light, UI, dll)
     */
    function clearCurrentScene() {
        console.log(`Membersihkan ${currentAssets.length} aset...`);
        // Matikan observable agar tidak ada sisa "typewriter"
        scene.onBeforeRenderObservable.clear();

        currentAssets.forEach(asset => {
            if (asset && typeof asset.dispose === 'function') {
                asset.dispose();
            }
        });
        currentAssets = []; // Kosongkan array
        
        // Reset fisika jika ada
        if (scene.getPhysicsEngine()) {
            scene.getPhysicsEngine().dispose();
            console.log("Physics engine disposed.");
        }
        
        // Reset warna scene
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
        scene.gravity = new BABYLON.Vector3(0, 0, 0); // Reset gravitasi
    }

    /**
     * Memuat Scene Menu
     */
    async function loadMenuScene() {
        clearCurrentScene();
        console.log("Memuat Menu Scene...");
        
        // Tampilkan loading screen
        engine.displayLoadingUI();
        
        // Panggil fungsi dari 'scene_menu.js'
        // Fungsi ini akan mengembalikan array berisi semua aset yang dibuatnya
        // Kita juga memberinya 'callback' (fungsi) untuk dipanggil saat tombol "Siap" ditekan
        currentAssets = await createMenuScene(scene, engine, xr, () => {
            // Ini adalah fungsi yang akan dieksekusi
            // saat 'onStartCallback' dipanggil dari dalam scene_menu.js
            console.log("Callback 'Mulai Showcase' diterima!");
            loadShowcaseScene(); // Memuat scene showcase
        });
        
        // Sembunyikan loading screen
        engine.hideLoadingUI();
        console.log("Menu Scene berhasil dimuat.");
    }

    /**
     * Memuat Scene Showcase
     */
    async function loadShowcaseScene() {
        clearCurrentScene();
        console.log("Memuat Showcase Scene...");
        
        // Tampilkan loading screen
        engine.displayLoadingUI();
        
        // Panggil fungsi dari 'scene_showcase.js'
        // Fungsi ini juga mengembalikan array aset yang dibuatnya
        currentAssets = await createShowcaseScene(scene, engine, xr);
        
        // Sembunyikan loading screen
        engine.hideLoadingUI();
        console.log("Showcase Scene berhasil dimuat.");
    }

    // --- 4. Render Loop Utama (Hanya Sekali) ---
    engine.runRenderLoop(function () {
        if (scene) {
            scene.render();
        }
    });

    // Resize (Hanya Sekali)
    window.addEventListener("resize", function () {
        engine.resize();
    });

    // --- 5. Mulai Aplikasi ---
    // Muat scene menu sebagai scene pertama
    loadMenuScene();

});