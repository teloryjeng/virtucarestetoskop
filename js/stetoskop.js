// js/stetoskop.js

class StethoscopeManager {
    constructor(scene, camera, positionTable) {
        this.scene = scene;
        this.camera = camera;
        this.startPos = positionTable;
        this.isEquipped = false;
        
        // Container utama (kotak transparan) saat ditaruh di meja
        this.rootWrapper = BABYLON.MeshBuilder.CreateBox("stethoRoot", { width: 0.5, height: 0.2, depth: 0.3 }, scene);
        this.rootWrapper.position = new BABYLON.Vector3(positionTable.x, positionTable.y, positionTable.z);
        this.rootWrapper.isVisible = false; // Kotak fisik tidak terlihat
        
        // Node khusus untuk bagian yang dipegang tangan (Chestpiece + Tali)
        this.handheldNode = new BABYLON.TransformNode("stethoHandheld", scene);
        
        // Metadata agar bisa diklik
        this.rootWrapper.metadata = { 
            isGrabbable: true, 
            itemData: { title: "Stethoscope" }
        };

        // Variabel Mesh Part
        this.meshEarpieceL = null;
        this.meshEarpieceR = null;
        this.meshTube = null;
        this.meshChest = null;
        this.dragMesh = null; // Bola transparan untuk drag

        // Physics untuk wrapper (agar jatuh ke meja)
        this.rootWrapper.physicsImpostor = new BABYLON.PhysicsImpostor(
            this.rootWrapper, 
            BABYLON.PhysicsImpostor.BoxImpostor, 
            { mass: 0.1, restitution: 0.0 }, 
            scene
        );
    }

    async loadAssets() {
        const scaleFactor = new BABYLON.Vector3(0.04, 0.04, 0.04); 

        // 1. Load Earpiece Kiri
        const earL = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "earpiece_left.glb", this.scene);
        this.meshEarpieceL = earL.meshes[0];
        this.meshEarpieceL.scaling = scaleFactor;
        this.meshEarpieceL.setParent(this.rootWrapper);
        this.meshEarpieceL.position = new BABYLON.Vector3(0, 0, 0);

        // 2. Load Earpiece Kanan
        const earR = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "earpiece_right.glb", this.scene);
        this.meshEarpieceR = earR.meshes[0];
        this.meshEarpieceR.scaling = scaleFactor;
        this.meshEarpieceR.setParent(this.rootWrapper);
        this.meshEarpieceR.position = new BABYLON.Vector3(0, 0, 0);

        // 3. Load Tube (Tali)
        const tube = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "tube_single.glb", this.scene);
        this.meshTube = tube.meshes[0];
        this.meshTube.scaling = scaleFactor;
        this.meshTube.setParent(this.rootWrapper);
        this.meshTube.position = new BABYLON.Vector3(0, 0, 0);

        // 4. Load Chestpiece (Ujung)
        const chest = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "chestpiece.glb", this.scene);
        this.meshChest = chest.meshes[0];
        this.meshChest.scaling = scaleFactor;
        this.meshChest.setParent(this.rootWrapper);
        this.meshChest.position = new BABYLON.Vector3(0, 0, 0);
        
        // Matikan collision mesh anak agar tidak bentrok dengan wrapper fisika
        [this.meshEarpieceL, this.meshEarpieceR, this.meshTube, this.meshChest].forEach(m => {
            if(m) {
                m.getChildMeshes().forEach(c => c.checkCollisions = false);
                m.isPickable = false; // Agar tidak menghalangi klik wrapper
            }
        });
    }

    toggleEquip() {
        if (this.isEquipped) {
            this.unequip();
        } else {
            this.equip();
        }
    }

    equip() {
        if (this.isEquipped) return;
        
        // 1. Matikan Fisika Wrapper Meja & Sembunyikan Wrapper
        this.rootWrapper.physicsImpostor.sleep();
        this.rootWrapper.position.y = -100; // Pindahkan jauh ke bawah agar tidak terlihat/terklik
        
        // 2. Tempel Earpiece ke Kamera (Seolah dipakai di telinga)
        // Kita taruh sedikit di belakang kamera agar tidak menghalangi pandangan
        this.meshEarpieceL.setParent(this.camera);
        this.meshEarpieceL.position = new BABYLON.Vector3(-0.2, -0.1, -0.2); 
        this.meshEarpieceL.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
        
        this.meshEarpieceR.setParent(this.camera);
        this.meshEarpieceR.position = new BABYLON.Vector3(0.2, -0.1, -0.2); 
        this.meshEarpieceR.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
        
        // 3. Siapkan Bagian Tangan (Chestpiece + Tube)
        // Kita tempelkan HandheldNode ke Kamera dulu agar muncul di depan wajah
        this.handheldNode.setParent(this.camera);
        this.handheldNode.position = new BABYLON.Vector3(0, -0.3, 0.5); // Di depan bawah kamera
        this.handheldNode.rotation = new BABYLON.Vector3(0, 0, 0);

        // Pindahkan Tube dan Chestpiece ke Handheld Node
        this.meshTube.setParent(this.handheldNode);
        this.meshTube.position = new BABYLON.Vector3(0, 0.1, 0); 
        this.meshTube.rotation = new BABYLON.Vector3(Math.PI / 4, 0, 0); // Sedikit miring

        this.meshChest.setParent(this.handheldNode);
        this.meshChest.position = new BABYLON.Vector3(0, 0, 0);
        this.meshChest.rotation = new BABYLON.Vector3(0, 0, 0);

        // 4. Buat Drag Mesh (Bola Transparan) agar user bisa menggeser chestpiece
        if (!this.dragMesh) {
            this.dragMesh = BABYLON.MeshBuilder.CreateSphere("stethoDrag", {diameter: 0.15}, this.scene);
            this.dragMesh.visibility = 0; // Transparan
            this.dragMesh.isPickable = true;
            
            const dragBehavior = new BABYLON.PointerDragBehavior({dragPlaneNormal: new BABYLON.Vector3(0,1,0)});
            this.dragMesh.addBehavior(dragBehavior);
            
            // Saat bola digeser, handheldNode ikut
            dragBehavior.onDragObservable.add(() => {
                // Kita update posisi handheldNode mengikuti dragMesh (secara visual)
                // Namun karena dragMesh adalah anak handheldNode, kita perlu melepas parent dulu
            });
        }

        // Setup Parenting Drag
        this.dragMesh.setParent(this.handheldNode);
        this.dragMesh.position = new BABYLON.Vector3(0, 0, 0);

        // Lepas handheldNode dari kamera agar tidak 'terkunci' gerakannya oleh kepala
        // Tapi posisinya tetap di depan mata saat awal equip
        this.handheldNode.setParent(null);
        
        // Tambahkan behavior drag ke HandheldNode itu sendiri (lebih mudah)
        if(!this.handheldNode.behaviors || this.handheldNode.behaviors.length === 0) {
             const dragBehavior = new BABYLON.PointerDragBehavior({dragPlaneNormal: new BABYLON.Vector3(0,0,1)});
             this.dragMesh.addBehavior(dragBehavior);
             
             // Sinkronisasi: Saat dragMesh digeser, update posisi Chestpiece & Tube
             // Trik: Kita drag bola transparan, bola itu parent dari chestpiece
             this.meshChest.setParent(this.dragMesh);
             this.meshTube.setParent(this.dragMesh);
        }

        this.isEquipped = true;
        console.log("Stetoskop Dipakai.");
    }

    unequip() {
        if (!this.isEquipped) return;

        // 1. Kembalikan Parent ke Root Wrapper (Meja)
        this.meshEarpieceL.setParent(this.rootWrapper);
        this.meshEarpieceR.setParent(this.rootWrapper);
        this.meshTube.setParent(this.rootWrapper);
        this.meshChest.setParent(this.rootWrapper);

        // 2. Reset Posisi Lokal (Relatif terhadap Wrapper)
        this.meshEarpieceL.position = new BABYLON.Vector3(-0.1, 0, 0);
        this.meshEarpieceL.rotation = new BABYLON.Vector3(0, 0, 0);
        
        this.meshEarpieceR.position = new BABYLON.Vector3(0.1, 0, 0);
        this.meshEarpieceR.rotation = new BABYLON.Vector3(0, 0, 0);

        this.meshTube.position = new BABYLON.Vector3(0, 0, -0.1);
        this.meshTube.rotation = new BABYLON.Vector3(0, 0, 0);

        this.meshChest.position = new BABYLON.Vector3(0, 0, -0.2);
        this.meshChest.rotation = new BABYLON.Vector3(0, 0, 0);

        // 3. Kembalikan Wrapper ke Meja
        this.rootWrapper.position = new BABYLON.Vector3(this.startPos.x, this.startPos.y, this.startPos.z);
        this.rootWrapper.rotation = new BABYLON.Vector3(0, 0, 0);
        
        // Aktifkan Fisika kembali
        this.rootWrapper.physicsImpostor.wakeUp();
        this.rootWrapper.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0,0,0));
        this.rootWrapper.physicsImpostor.setAngularVelocity(new BABYLON.Vector3(0,0,0));

        if(this.dragMesh) {
            // Kembalikan anak dragMesh ke handheldNode sementara
            this.dragMesh.dispose();
            this.dragMesh = null;
        }

        this.isEquipped = false;
        console.log("Stetoskop dikembalikan ke meja.");
    }
}