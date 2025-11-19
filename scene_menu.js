// scene_menu.js

// 1. Bungkus semua dalam fungsi ini
async function createMenuScene(scene, engine, xr, onStartCallback) {
    
    // 2. Buat array untuk melacak aset
    const assets = [];

    // HAPUS: const canvas = document.getElementById("renderCanvas");
    // HAPUS: const engine = new BABYLON.Engine(canvas, true);
    // HAPUS: const createScene = async function () { ... }
    // (scene dan engine sekarang adalah parameter)

    scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
    scene.collisionsEnabled = true;
    
    const colliderMat = new BABYLON.StandardMaterial("colliderMat", scene);
    colliderMat.diffuseColor = new BABYLON.Color3(0.3, 0.6, 1);
    colliderMat.alpha = 0; 
    assets.push(colliderMat); // Lacak material
            
    const ground = BABYLON.MeshBuilder.CreateGround("ground1", { width: 8.5, height: 50 }, scene);
    ground.position = new BABYLON.Vector3(1.8, 0.09, 0.5);
    ground.checkCollisions = true;
    ground.material = colliderMat;
    assets.push(ground); // Lacak ground

    // Kamera ini HANYA untuk mode desktop, karena main.js sudah membuat kamera utama
    // Kita tetap membuatnya agar kode asli tidak error, tapi main.js akan mengontrol kamera aktif
    // (Catatan: Sebaiknya kamera non-XR dibuat di main.js, tapi kita ikuti dulu)
    const camera = new BABYLON.UniversalCamera("menu_desktop_camera", new BABYLON.Vector3(0, 2, 0), scene);
    camera.attachControl(engine.getRenderingCanvas(), true);
    camera.applyGravity = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.checkCollisions = true;
    camera.speed = 0.2;
    camera.keysUp.push(87); camera.keysDown.push(83); camera.keysLeft.push(65); camera.keysRight.push(68); 
    assets.push(camera); // Lacak kamera

    // 3. HAPUS 'let xr = null;'
    // HAPUS 'try { xr = await scene.createDefaultXRExperienceAsync(... }'
    // 'xr' sudah disediakan sebagai parameter.
    
    // Cek jika XR tidak ada (mode desktop), gunakan kamera desktop
    if (!xr || xr.baseExperience.state === BABYLON.WebXRState.NOT_IN_XR) {
         scene.activeCamera = camera;
         camera.applyGravity = true;
         camera.checkCollisions = true;
    }
    
    // Loading Model (Kode disederhanakan)
    // (Kita asumsikan model ini akan dihapus, jadi tidak perlu melacaknya)
    BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "ruang_periksa.glb", scene 
    ).then((result) => {
        if (result.meshes.length > 0) {
            result.meshes[0].position = new BABYLON.Vector3(-2, 0, 7.5);
            result.meshes[0].scaling = new BABYLON.Vector3(-0.43, 0.43, 0.43);
            result.meshes[0].getChildMeshes().forEach(mesh => { 
                mesh.checkCollisions = true;
                });
            assets.push(result.meshes[0]); // Lacak model
        }
    }).catch((error) => { console.error("Gagal memuat model:", error); });
    
    BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "Avatar_Virtucare.glb", scene 
    ).then((result) => {
        if (result.meshes.length > 0) {
            result.meshes[0].position = new BABYLON.Vector3(0, .7, 2.4);
            result.meshes[0].scaling = new BABYLON.Vector3(.3, .3, .3);
            result.meshes[0].rotation = new BABYLON.Vector3(0, Math.PI/2, 0);
            result.meshes[0].getChildMeshes().forEach(mesh => { 
                mesh.checkCollisions = true;
                });
            assets.push(result.meshes[0]); // Lacak model
        }
    }).catch((error) => { console.error("Gagal memuat model:", error); });
    
    
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.8;
    assets.push(light); // Lacak cahaya

    // --- VARIABEL KONTROL UI DAN ANIMASI ---
    // (Kode ini tetap sama)
    let currentState=1;
    let dialogTitle; // Judul terpisah (Halo, Calon Dokter!)
    let dialogBody; // Teks isi
    let lanjutButton;
    let finalButtonsContainer;
    let charIndex = 0;
    let isTyping = false;
    let currentTextTarget = "";
    let typeObserver=null;
    const TYPING_SPEED=1;

    // --- DATA TEKS DIPISAH ---
    const TAHAP_1_JUDUL = "Halo, Calon Dokter!";
    const TAHAP_1_BODY = "Kenalkan! aku MEDIBOT! Selamat datang di VirtuCare, sebuah dunia virtual yang dirancang untuk membawa lebih dekat dengan pengalaman medis yang sesungguhnya.";
    const TAHAP_2_BODY = "Saat ini, Anda berada di lobi VirtuCare, titik awal sebelum memulai pelatihan. Setiap interaksi dan setiap langkah yang diambil akan membawa anda semakin dekat menuju profesionalisme seorang tenaga medis.";
    const TAHAP_3_TEXT_FULL = "Siap melakukan simulasi?";
    const TAHAP_4_BODY = "Baik, Sebelum kita melakukan simulasi, Anda akan diarahkan ke Ruang Showcase Alat Medis. Di ruangan ini, Anda dapat melihat dan mempelajari berbagai peralatan medis yang akan digunakan selama praktik. Setiap alat akan disertai penjelasan singkat agar Anda memahami fungsi dan cara kerjanya dengan lebih jelas sebelum memulai simulasi";
    
    // --- FUNGSI TYPEWRITER EFFECT DENGAN CALLBACK ---
    function typeWriterEffect(targetText, textBlock, scene, onComplete = () => {}) {
        // (Seluruh fungsi typeWriterEffect disalin ke sini, tidak berubah)
        if (isTyping) {
            if (typeObserver) {
                scene.onBeforeRenderObservable.remove(typeObserver);
            }
        }
        
        isTyping = true;
        charIndex = 0;
        currentTextTarget = targetText;
        textBlock.text = ""; 

        // Nonaktifkan tombol Lanjut saat mengetik
        lanjutButton.isHitTestVisible = false;

        typeObserver = scene.onBeforeRenderObservable.add(() => {
            if (isTyping && charIndex <= currentTextTarget.length) {
                if (scene.getEngine().frameId % TYPING_SPEED === 0) { 
                        textBlock.text = currentTextTarget.substring(0, charIndex);
                        charIndex++;
                }
            } else if (isTyping) {
                textBlock.text = currentTextTarget;
                isTyping = false;
                
                scene.onBeforeRenderObservable.remove(typeObserver);
                typeObserver = null;
                
                onComplete(); 
            }
        });
    }

    // --- PEMBUATAN UI (PANEL UTAMA) ---
    const uiPlane = BABYLON.MeshBuilder.CreatePlane("uiPlane", scene);
    uiPlane.position = new BABYLON.Vector3(0, 2.8, 2.5);
    uiPlane.rotation.x = -.2;
    uiPlane.scaling.scaleInPlace(3);
    assets.push(uiPlane); // Lacak UI Panel
    
    // (Kode pembuatan ADT, mainPanel, stackPanel, dialogTitle, dialogBody, lanjutButton, finalButtonsContainer)
    // ... (Semua kode ini disalin, tidak berubah) ...
    // ...
    // 2. Buat AdvancedDynamicTexture
    const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(uiPlane, 3000, 3000);
            
    // 3. Buat Panel Utama
    const mainPanel = new BABYLON.GUI.Rectangle("mainPanel");
    mainPanel.widthInPixels = 2000;
    mainPanel.heightInPixels = 1300;
    mainPanel.background = "rgba(20, 50, 130, 0.5)";
    mainPanel.cornerRadius = 50;
    mainPanel.thickness = 10;
    mainPanel.color = "white";
    adt.addControl(mainPanel);
    
    // 5. Buat StackPanel
    const stackPanel = new BABYLON.GUI.StackPanel("buttonStack");
    stackPanel.widthInPixels = 1800;
    stackPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    mainPanel.addControl(stackPanel);

    // 5A. Text Block untuk Judul (Dibuat Bold dan Kuning)
    dialogTitle = new BABYLON.GUI.TextBlock("dialogTitle", "");
    dialogTitle.color = "#FFD700"; // Kuning Emas
    dialogTitle.heightInPixels = 150;
    dialogTitle.fontSizeInPixels = 90;
    dialogTitle.fontStyle = "bold"; 
    dialogTitle.textWrapping = true;
    dialogTitle.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    dialogTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    stackPanel.addControl(dialogTitle);

    // 5B. Text Block untuk Isi
    dialogBody = new BABYLON.GUI.TextBlock("dialogBody", "");
    dialogBody.color = "white";
    dialogBody.heightInPixels = 500; 
    dialogBody.fontSizeInPixels = 70;
    dialogBody.paddingBottomInPixels = 10;
    dialogBody.textWrapping = true;
    dialogBody.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    dialogBody.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    stackPanel.addControl(dialogBody); 
    
    // 6. Buat Tombol "Lanjut"
    lanjutButton = BABYLON.GUI.Button.CreateSimpleButton("lanjut", "Lanjut");
    lanjutButton.widthInPixels = 500;
    lanjutButton.heightInPixels = 150;
    lanjutButton.background = "#5CB85C";
    lanjutButton.color = "white";
    lanjutButton.fontSizeInPixels = 50;
    lanjutButton.cornerRadius = 20;
    lanjutButton.paddingTopInPixels = 20;
    lanjutButton.thickness = 3;
    lanjutButton.onPointerClickObservable.add(handleLanjutClick);
    stackPanel.addControl(lanjutButton);

    // 7. Buat Container Tombol Akhir (Sembunyikan di awal)
    finalButtonsContainer = new BABYLON.GUI.StackPanel("finalButtonsContainer");
    finalButtonsContainer.isVertical = false;
    finalButtonsContainer.heightInPixels = 150;
    finalButtonsContainer.isVisible = false; 
    finalButtonsContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    finalButtonsContainer.spacing = 50;
    stackPanel.addControl(finalButtonsContainer);

    // Fungsi helper untuk membuat tombol
    const createFinalButton = (name, text, color, onClickHandler) => {
        const button = BABYLON.GUI.Button.CreateSimpleButton(name, text);
        button.widthInPixels = 500;
        button.heightInPixels = 100;
        button.background = color;
        button.color = "white";
        button.fontSizeInPixels = 40;
        button.cornerRadius = 20;
        button.thickness = 3;
        button.onPointerClickObservable.add(onClickHandler);
        return button;
    };
    
    // HAPUS: const goToShowcase = () => { ... }
    
    // Handler untuk tombol di Tahap 3
    const onSiapClick = () => { 
        console.log("Memulai Simulasi..."); 
        currentState = 5;
        finalButtonsContainer.isVisible = false; 
    
        dialogTitle.text = ""; 
        dialogTitle.heightInPixels = 0; 
        dialogBody.heightInPixels = 700;
        dialogBody.fontSizeInPixels = 70;
    
        // 6. *** PERUBAHAN KRITIS ***
        typeWriterEffect(TAHAP_4_BODY, dialogBody, scene, () => {
            // Callback: Setelah TAHAP 4 selesai diketik, panggil callback utama
            setTimeout(() => {
                // HAPUS: goToShowcase();
                onStartCallback(); // Panggil fungsi yang diberikan oleh main.js
            },1000)
            
        }); 
    };
    const onKeluarClick = () => { 
        console.log("Keluar diklik!"); 
        if (xr && xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            xr.baseExperience.exitXRAsync(); 
        }
    };

    // Buat dan tambahkan tombol akhir ke container
    const startButton = createFinalButton("start", "Siap!!", "#5CB85C", onSiapClick);
    const exitButton = createFinalButton("exit", "Keluar", "#D9534F", onKeluarClick);

    finalButtonsContainer.addControl(startButton);
    finalButtonsContainer.addControl(exitButton);


    // --- FUNGSI LOGIKA PERGANTIAN TAHAP (HANDLE KLIK) ---
    // (Kode handleLanjutClick tetap sama)
    function handleLanjutClick() {
        if (isTyping) return;
        currentState++;
        
        if (currentState === 2) {
            // TAHAP 2: Ganti teks di dialogBody dan animasikan
            dialogTitle.text = ""; // Kosongkan Judul
            dialogBody.heightInPixels = 700; // Beri ruang penuh pada Body
            dialogBody.fontSizeInPixels = 70;
            
            typeWriterEffect(TAHAP_2_BODY, dialogBody, scene, () => {
                lanjutButton.isHitTestVisible = true; // Aktifkan tombol setelah Body selesai
            });

        } else if (currentState === 3) {
            // TAHAP 3: Teks simulasi
            dialogBody.heightInPixels = 300;
            dialogBody.paddingBottomInPixels = 50;
            dialogBody.fontSizeInPixels = 90;
            
            typeWriterEffect(TAHAP_3_TEXT_FULL, dialogBody, scene, () => {
                // Setelah Tahap 3 selesai, ganti tombol
                lanjutButton.isVisible = false;
                finalButtonsContainer.isVisible = true;
                // Tombol akhir sudah aktif secara default
            });
        }
    }
    
    // --- Membuat UI Dapat Di-"Grab" (Digeser) ---
    const grabBehavior = new BABYLON.SixDofDragBehavior();
    grabBehavior.allowMultiPointer = true;
    uiPlane.addBehavior(grabBehavior);
    
    // === MULAI ANIMASI PERTAMA DI SINI (TAHAP 1) ===
    // (Kode ini tetap sama)
    typeWriterEffect(TAHAP_1_JUDUL, dialogTitle, scene, () => {
        typeWriterEffect(TAHAP_1_BODY, dialogBody, scene, () => {
            lanjutButton.isHitTestVisible = true;
        });
    }); 
    
    // --- PEMBUATAN PANEL KREDIT (BARU DAN TERPISAH) ---
    const creditsPlane = BABYLON.MeshBuilder.CreatePlane("creditsPlane", scene);
    creditsPlane.position = new BABYLON.Vector3(1.4, 1.5, .8); 
    creditsPlane.rotation.x = 0;
    creditsPlane.rotation.y = 1;
    creditsPlane.rotation.z = 0;
    creditsPlane.scaling.scaleInPlace(3);
    creditsPlane.isVisible = false; 
    assets.push(creditsPlane); // Lacak UI Panel
    
    // (Sisa kode panel kredit disalin ke sini, tidak berubah)
    // ...
    // 2. Buat ADT (Texture) BARU untuk plane kredit
    const adtCredits = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(creditsPlane, 3000, 3000);

    // 3. Buat Panel Kredit (Rectangle)
    const creditsPanel = new BABYLON.GUI.Rectangle("creditsPanel");
    creditsPanel.widthInPixels = 2000;
    creditsPanel.heightInPixels = 1500;
    creditsPanel.background = "rgba(10, 20, 70, 0.7)"; 
    creditsPanel.cornerRadius = 50;
    creditsPanel.thickness = 10;
    creditsPanel.color = "white";
    adtCredits.addControl(creditsPanel);


    // --- ISI KONTEN PANEL KREDIT (BARU) ---
    const creditsTitle = new BABYLON.GUI.TextBlock("creditsTitle", "Credits");
    creditsTitle.color = "#FFD700";
    creditsTitle.fontSizeInPixels = 100;
    creditsTitle.fontStyle = "bold";
    creditsTitle.heightInPixels = 150;
    creditsTitle.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    creditsTitle.paddingTopInPixels = 30;
    creditsPanel.addControl(creditsTitle);

    const closeCreditsButton = BABYLON.GUI.Button.CreateSimpleButton("closeCredits", "Tutup");
    closeCreditsButton.widthInPixels = 300;
    closeCreditsButton.heightInPixels = 100;
    closeCreditsButton.background = "#D9534F"; // Merah
    closeCreditsButton.color = "white";
    closeCreditsButton.fontSizeInPixels = 40;
    closeCreditsButton.cornerRadius = 20;
    closeCreditsButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeCreditsButton.paddingBottomInPixels = 30;
    creditsPanel.addControl(closeCreditsButton);

    const creditsScrollViewer = new BABYLON.GUI.ScrollViewer("creditsScroll");
    creditsScrollViewer.widthInPixels = 1800;
    creditsScrollViewer.heightInPixels = 1000; 
    creditsScrollViewer.topInPixels = 100; 
    creditsScrollViewer.barSize = 30;
    creditsScrollViewer.barColor = "grey";
    creditsScrollViewer.thumbColor = "white";
    creditsPanel.addControl(creditsScrollViewer);

    const creditsContent = new BABYLON.GUI.TextBlock("creditsContent");
    creditsContent.text = `
    Project Manager
    ULFATUN NADA

    Concept Developer
    ULFATUN NADA
    NAYLA RISMA HARUMI

    Report Writer
    PUTRI SYNTIA NARLITA RACHMADANI
    
    Programmer
    PANDU WINATA KRISNA PUTRA
    MUHAMMAD SURURI ARDAN

    3D Artist
    MUHAMMAD HAIDAR ALLAMSYAH

    Assets
    - Model Ruang Periksa oleh MUHAMMAD HAIDAR ALLAMSYAH
    - Model Avatar oleh NATHAN YUDHISTIRA SIAHAAN

    Special Thanks
    - Tim Babylon.js
    - Dosen Pembimbing Bapak Sritrusta Sukaridhoto ST, Ph.D
    - Asisten Dosen Faris Saifullah (D4 IT)
    
    VirtuCare © 2025
    `;
    creditsContent.widthInPixels = 1750; 
    creditsContent.textWrapping = true;
    creditsContent.color = "white";
    creditsContent.fontSizeInPixels = 50;
    creditsContent.paddingTopInPixels = 20;
    creditsContent.paddingLeftInPixels = 20;
    creditsContent.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    creditsContent.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    creditsContent.resizeToFit = true; 
    creditsScrollViewer.addControl(creditsContent);


    // --- TOMBOL UNTUK MEMBUKA KREDIT (BARU) ---
    const openCreditsButton = BABYLON.GUI.Button.CreateSimpleButton("openCredits", "Credits");
    // (properti tombol lainnya)
    // ...
    openCreditsButton.rotation.y = 0;
    openCreditsButton.widthInPixels = 400;
    openCreditsButton.heightInPixels = 200;
    openCreditsButton.background = "rgb(100, 100, 100)";
    openCreditsButton.color = "white";
    openCreditsButton.fontSizeInPixels = 65;
    openCreditsButton.cornerRadius = 20;
    openCreditsButton.thickness = 2;
    openCreditsButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    openCreditsButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    openCreditsButton.paddingTopInPixels = 30;
    openCreditsButton.paddingRightInPixels = 30;
    adt.addControl(openCreditsButton);

    // --- LOGIKA BUKA/TUTUP PANEL KREDIT (BARU) ---
    openCreditsButton.onPointerClickObservable.add(() => {
        creditsPlane.isVisible = true;
    });

    closeCreditsButton.onPointerClickObservable.add(() => {
        creditsPlane.isVisible = false;
    });

    // HAPUS: return scene;
    
    // 7. Kembalikan array aset
    return assets;
    
    // HAPUS: (Semua kode di bawah 'return scene;'
    // HAPUS: createScene().then(...);
    // HAPUS: engine.runRenderLoop(...);
    // HAPUS: window.addEventListener("resize", ...);
}