// scene_showcase.js

// 1. Bungkus semua dalam fungsi ini
async function createShowcaseScene(scene, engine, xr,onStartSimulationCallback,onExitToMenuCallback) {
    
    // 5. Buat array aset
    const assets = [];

    // HAPUS: const canvas = ...
    // HAPUS: const engine = ...
    // HAPUS: const createScene = ...
    // (scene, engine, xr sekarang adalah parameter)
    
    scene.clearColor = new BABYLON.Color3(0.9, 0.9, 0.95);
    try {
        await enablePhysics(scene); // Pastikan fungsi ini mengembalikan promise
        console.log("✅ Physics engine berhasil diinisialisasi");
    } catch (error) {
        console.error("❌ Gagal menginisialisasi physics engine:", error);
        // Fallback: Coba inisialisasi physics manual
        try {
            const gravityVector = new BABYLON.Vector3(0, -9.81, 0);
            const physicsPlugin = new BABYLON.CannonJSPlugin();
            scene.enablePhysics(gravityVector, physicsPlugin);
            console.log("✅ Physics engine diinisialisasi manual");
        } catch (fallbackError) {
            console.warn("⚠️ Physics engine tidak tersedia, melanjutkan tanpa physics");
        }
    }

    scene.gravity = new BABYLON.Vector3(0, -9.81, 0); // Pastikan gravitasi di-set jika enablePhysics tidak melakukannya

    // ================================
    // Buat ground (lantai dunia)
    // ================================
    const groundThickness = 5; // Ketebalan lantai 5 meter ke bawah
    const groundLevel = 0.12;  // Tinggi permukaan lantai yang diinginkan
    
    // Gunakan CreateBox, bukan CreateGround
    const ground = BABYLON.MeshBuilder.CreateBox("ground", { 
        width: 100, 
        height: groundThickness, // Tebal!
        depth: 100 
    }, scene);

    ground.checkCollisions = true;
    
    // Posisikan agar PERMUKAAN ATAS-nya ada di 0.12
    // Rumusnya: LevelInginkan - (SetengahKetebalan)
    ground.position.y = groundLevel - (groundThickness / 2); 
    
    ground.isVisible = false; // Set true jika ingin debug melihat ketebalannya
    assets.push(ground); 

    if (scene.getPhysicsEngine()) {
        ground.physicsImpostor = new BABYLON.PhysicsImpostor(
            ground,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 0, restitution: 0.5, friction: 0.8 }, // Tambah friction agar barang tidak licin
            scene
        );
        console.log("✅ Physics impostor ground (TEBAL) dibuat");
    }
    // ================================
    // Cahaya dan Arah
    // ================================
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    assets.push(light); // Lacak

    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.intensity = 1;
    assets.push(dirLight); // Lacak

    // ================================
    // 4. HAPUS 'const camera = ...'
    // ================================
    
    // ================================
    // Tambahkan Model Ruangan + Collision
    // ================================
    BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "ruang_periksa.glb", scene 
    ).then((result) => {
        if (result.meshes.length > 0) {
            result.meshes[0].position = new BABYLON.Vector3(-7, 0, 8);
            result.meshes[0].scaling = new BABYLON.Vector3(-0.5, 0.5, 0.5);
            
            // --- MODIFIKASI MULAI ---
            result.meshes[0].getChildMeshes().forEach(mesh => { 
                // 1. Tetap aktifkan collision untuk kamera
                mesh.checkCollisions = true; 

                // 2. TAMBAHKAN PHYSICS IMPOSTOR agar benda mental saat kena dinding
                // Gunakan MeshImpostor agar bentuknya pas sesuai model 3D
                mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
                    mesh, 
                    BABYLON.PhysicsImpostor.MeshImpostor, 
                    { mass: 0, restitution: 0.1, friction: 0.5 }, // Mass 0 = Diam/Tembok
                    scene
                );
            });
            // --- MODIFIKASI SELESAI ---

            assets.push(result.meshes[0]); 
        }
    }).catch((error) => { console.error("Gagal memuat model:", error); });
    function createInvisibleWall(name, width, height, depth, position) {
        const wall = BABYLON.MeshBuilder.CreateBox(name, {width, height, depth}, scene);
        wall.position = position;
        wall.isVisible = false; // Ubah ke TRUE jika ingin melihat temboknya untuk debug
        
        // Gunakan BoxImpostor (Paling Stabil)
        wall.physicsImpostor = new BABYLON.PhysicsImpostor(
            wall, 
            BABYLON.PhysicsImpostor.BoxImpostor, 
            { mass: 0, restitution: 0.1, friction: 0.5 }, 
            scene
        );
        return wall;
    }

    // Sesuaikan posisi ini dengan bentuk ruangan Anda
    // Dinding Kiri
    createInvisibleWall("wallLeft", 1, 5, 20, new BABYLON.Vector3(-2.42, 2.5, 10.8));
    
    // Dinding Kanan
    createInvisibleWall("wallRight", 1, 5, 20, new BABYLON.Vector3(3.46, 2.5, 8));

    // Dinding Depan (Jauh)
    createInvisibleWall("wallFront", 10, 5, 1, new BABYLON.Vector3(0, 2.5, 18.4));

    // Dinding Belakang (Pintu Masuk)
    createInvisibleWall("wallBack", 10, 5, 1, new BABYLON.Vector3(-2, 2.5, -2.3));
    // === KODE COLLISION BOX ASLI ===
    const mejaCollision1 = BABYLON.MeshBuilder.CreateBox("mejaCollision", {height: 1.6, width: 0.7, depth: 10}, scene);
    mejaCollision1.position = new BABYLON.Vector3(-1.5, 0.47, 12);
    mejaCollision1.isVisible = false;
    mejaCollision1.physicsImpostor = new BABYLON.PhysicsImpostor(mejaCollision1, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.2 }, scene);
    assets.push(mejaCollision1); // Lacak

    const mejaCollision2 = BABYLON.MeshBuilder.CreateBox("mejaCollision", {height: 1.6, width: 0.7, depth: 10}, scene);
    mejaCollision2.position = new BABYLON.Vector3(2.5, 0.47, 12);
    mejaCollision2.isVisible = false;
    mejaCollision2.physicsImpostor = new BABYLON.PhysicsImpostor(mejaCollision2, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.2 }, scene);
    assets.push(mejaCollision2); // Lacak

    const infuscollision = BABYLON.MeshBuilder.CreateBox("infuscollision", {height: 5, width: 1.4, depth: 1}, scene);
    infuscollision.position = new BABYLON.Vector3(2.6, 0, 5.5);
    infuscollision.isVisible = false;
    infuscollision.checkCollisions = true;
    assets.push(infuscollision); // Lacak
    // ================================
    // 3. HAPUS 'let xr = null;'
    // 3. HAPUS 'try { xr = await scene.createDefaultXRExperienceAsync(... }'
    // 'xr' sudah disediakan oleh main.js
    // ================================
    
    // Cek jika tidak di XR, pastikan kamera desktop punya gravitasi
    if (!xr || xr.baseExperience.state === BABYLON.WebXRState.NOT_IN_XR) {
        if (scene.activeCamera.getClassName() === "UniversalCamera") {
             scene.activeCamera.applyGravity = true;
             scene.activeCamera.checkCollisions = true;
        }
    }

    // ================================================================
    // === MULAI KODE BARU: PEMUATAN ITEM & UI ===
    // ================================================================

    // 1. Database Item (Tidak berubah)
     const itemDatabase = [
          {
              id: "meshPerban",
              file: "perban.glb",
              title: "Perban",
              description: "Perban adalah bahan kain atau elastis yang digunakan untuk membalut dan menahan pembalut luka, memberikan dukungan, atau memberikan tekanan pada area tubuh. Cara pakainya adalah dengan melilitkannya secara rapi di sekitar area yang membutuhkan perlindungan atau penahanan setelah luka dibersihkan dan ditutup. Perban membantu melindungi luka dari infeksi dan mempercepat proses penyembuhan.",
              pos: new BABYLON.Vector3(-1.5, 2, 7.8),
              scale: new BABYLON.Vector3(0.03, 0.03, 0.03),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.4, height: 0.4, depth: 0.4 },
              visualOffset: { x: 0, y: -0.2, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Mengapa perban harus dililit dengan tekanan yang pas, tidak terlalu kuat atau lemah?", 
                      a: "Tekanan yang pas menjaga luka agar tetap tertutup dan stabil. Jika terlalu kuat bisa menghambat aliran darah, sedangkan terlalu lemah tidak memberikan perlindungan yang cukup." 
                  },
                  { 
                      q: "Bagaimana perban bisa membantu mengurangi pembengkakan pada bagian tubuh tertentu?", 
                      a: "Perban yang dililit dengan tekanan ringan dapat membantu mengontrol aliran darah dan cairan di area cedera. Supaya dapat membantu mengurangi pembengkakan sehingga rasa nyeri berangsur membaik." 
                  },
                  { 
                      q: "Kenapa arah lilitan perban dapat memengaruhi stabilitas dan kenyamanan pada area yang cedera?", 
                      a: "Arah lilitan menentukan bagaimana tekanan dan dukungan diberikan pada bagian tubuh yang terluka. Dengan arah lilitan yang benar, tenaga medis bisa menjaga perban tetap stabil tanpa membatasi gerakan seseorang atau menekan area yang sensitif." 
                  }
            ]
            },
          {
              id: "meshOximeter",
              file: "oximeter.glb",
              title: "Pulse Oximeter",
              description: "Oximeter digunakan untuk mengukur saturasi oksigen dalam darah (SpO2) dan denyut nadi. Alat ini dipakai dengan menjepitkan sensor kecil pada ujung jari pasien, di mana sensor akan memancarkan cahaya melalui kulit dan mengukur persentase hemoglobin yang membawa oksigen. Pengukuran SpO2 memberikan informasi penting tentang fungsi pernapasan dan sirkulasi pasien.",
              pos: new BABYLON.Vector3(-1.5, 2, 9.7),
              scale: new BABYLON.Vector3(0.13, 0.13, 0.13),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.28, height: 0.37, depth: 0.5 },
              visualOffset: { x: 0, y: -0.15, z: 0 }, // y = -height / 2 (Sesuaikan!)
              qa:[
                { 
                      q: "Kenapa oximeter sering digunakan untuk memastikan apakah tubuh mendapat cukup oksigen?", 
                      a: "Karena oximeter membantu tenaga medis melihat seberapa baik oksigen yang  dihirup dan benar-benar tersalurkan ke dalam darah. Angka saturasi yang terlihat di layar memberi gambaran cepat apakah tubuh pasien bekerja optimal atau membutuhkan perhatian lebih." 
                  },
                  { 
                      q: "Mengapa hasil oximeter bisa berubah ketika pasien bergerak atau gelisah?", 
                      a: "Pergerakan membuat cahaya sensor sulit membaca aliran darah dengan stabil. Itulah sebabnya Dokter biasanya meminta pasien untuk diam supaya hasil yang didapatkan benar-benar akurat dan tidak terganggu oleh gerakan." 
                  },
                  { 
                      q: "Apa pentingnya memeriksa saturasi oksigen secara berkala pada pasien yang sedang sakit?", 
                      a: "Pemantauan berkala membuat dokter dapat mengetahui lebih cepat jika kadar oksigen mulai turun. Kadang tubuh tidak langsung menunjukkan gejala, jadi angka dari oximeter membantu saya memastikan Anda tetap berada dalam kondisi aman" 
                  }
            ]
          },
          {
              id: "meshGunting",
              file: "gunting medis.glb",
              title: "Gunting Medis",
              description: "Gunting medis berfungsi khusus untuk memotong perban, kasa, pakaian pasien, atau bahan medis lainnya dengan aman tanpa melukai pasien. Gunting ini sering memiliki ujung tumpul pada salah satu bilahnya untuk mempermudah memotong dekat kulit. Alat ini memastikan bahan penutup luka dapat disesuaikan dengan ukuran yang tepat.",
              pos: new BABYLON.Vector3(-1.5, 2, 11.7),
              scale: new BABYLON.Vector3(0.015, 0.015, 0.015),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.2, height: 0.1, depth: 0.5 },
              visualOffset: { x: 0, y: -0.05, z: 0 }, // y = -height / 2 (Sesuaikan!)
              qa:[
                { 
                      q: "Mengapa gunting medis memiliki ujung tumpul, bukan tajam?", 
                      a: "Ujung tumpul dirancang agar saya dapat menyelipkannya di antara perban atau pakaian tanpa melukai kulit. Bentuk ini memberi perlindungan tambahan, terutama saat area luka sensitif atau sulit terlihat." 
                  },
                  { 
                      q: "Mengapa gunting medis harus memiliki material khusus agar tetap aman digunakan pada pasien?", 
                      a: "Gunting medis dibuat dari material antikarat dan mudah disterilkan. Dengan bahan seperti ini, tenaga medis dapat memastikan alat tetap bersih, kuat, dan tidak membawa kuman yang bisa menginfeksi luka pasien selama tindakan." 
                  },
                  { 
                      q: "Bagaimana cara gunting medis membantu tenaga kesehatan bekerja lebih cepat saat keadaan darurat?", 
                      a: "Desain gunting medis memungkinkan saya memotong perban, pakaian, atau penghalang lain dengan cepat tanpa risiko mencederai kulit. Kecepatan ini sangat penting agar penanganan darurat dapat dilakukan segera tanpa hambatan." 
                  }
            ]
          },
          {
              id: "meshReflexHammer",
              file: "reflex hammer.glb",
              title: "Palu Refleks (Reflex Hammer)",
              description: "Alat medis yang digunakan untuk memeriksa refleks saraf pada pasien. Dengan mengetuk area tertentu seperti lutut atau pergelangan, alat ini membantu tenaga kesehatan menilai fungsi sistem saraf, mendeteksi gangguan neurologis, serta memastikan jalur saraf bekerja sebagaimana mestinya. Bentuknya yang ringan dan ujungnya yang empuk memungkinkan pemeriksaan dilakukan dengan aman dan presisi tanpa menimbulkan cedera.",
              pos: new BABYLON.Vector3(-1.5, 2, 13.8),
              scale: new BABYLON.Vector3(3, 3, 3),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.2, height: 0.1, depth: 0.6 },
              visualOffset: { x: 0, y: -0.05, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Mengapa pemeriksaan refleks penting dalam mendeteksi masalah pada sistem saraf?", 
                      a: "Saat tenaga medis mengetuk area tertentu dengan Reflex Hammer, mereka akan melihat bagaimana tubuh Anda merespons secara otomatis. Jika responsnya lambat, terlalu cepat, atau bahkan tidak muncul, itu memberi petunjuk bahwa jalur saraf seseorang mungkin sedang mengalami gangguan. Pemeriksaan sederhana ini membantu saya mengetahui apakah otak, sumsum tulang belakang, dan saraf bekerja dengan baik." 
                  },
                  { 
                      q: "Apa perbedaan hasil yang terlihat ketika refleks pasien terlalu kuat atau terlalu lemah?", 
                      a: "Ketika refleks seseorang terlalu kuat, itu bisa menandakan adanya masalah pada sistem saraf pusat, seperti ketegangan berlebih atau gangguan pada otak dan sumsum tulang belakang. Sebaliknya, kalau refleksnya terlalu lemah atau tidak muncul, dapat dicurigai ada gangguan pada saraf tepi atau otot." 
                  },
                  { 
                      q: "Kenapa setiap jenis reflex hammer memiliki bentuk yang berbeda, seperti Taylor, Queen Square, atau Tromner?", 
                      a: "Setiap Reflex Hammer dirancang untuk situasi tertentu. Ada yang lebih ringan untuk mengetuk area kecil, ada yang lebih besar agar saya bisa menilai refleks yang lebih dalam. Bentuknya berbeda supaya saya bisa memilih alat yang paling tepat untuk kondisi pasien dan jenis refleks yang ingin diperiksa. Dengan begitu, hasil pemeriksaannya bisa lebih akurat." 
                  }
            ]
            },
          {
              id: "meshStethoscope",
              file: "stethoscope.glb",
              title: "Stetoskop",
              description: "Stetoskop berfungsi untuk mendengarkan suara di dalam tubuh, seperti detak jantung, pernapasan, dan suara perut (bising usus). Cara pakainya adalah menempelkan diafragma atau bel stetoskop pada kulit pasien di area yang ingin diperiksa, sementara petugas medis mendengarkan melalui earpiece. Alat ini sangat penting untuk pemeriksaan fisik rutin dan diagnosis awal berbagai kondisi.",
              pos: new BABYLON.Vector3(-1.5, 2, 15.6),
              scale: new BABYLON.Vector3(0.0015, 0.0015, 0.0015),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.4, height: 0.35, depth: 0.4 },
              visualOffset: { x: 0, y: -0.15, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Bagaimana tenaga medis bisa mengenali kondisi jantung hanya dari suara detak yang terdengar saat diperiksa?", 
                      a: "Saat tenaga medis mendengarkan detak jantung seorang pasien, mereka memperhatikan kekuatan, ritme, dan keteraturannya. Bunyi yang kuat dan teratur biasanya menandakan aliran darah yang baik. Namun, jika terdengar lemah atau tidak beraturan, itu bisa menjadi petunjuk bahwa tubuh pasien sedang mengalami gangguan seperti kelelahan, dehidrasi, atau penurunan tekanan darah." 
                  },
                  { 
                      q: "Kenapa posisi stetoskop di dada sangat mempengaruhi hasil yang terdengar?", 
                      a: "Karena setiap posisi di dada mengarah ke bagian jantung dan paru yang berbeda. Dengan menempatkan stetoskop di lokasi yang tepat, tenaga medis dapat mendengar bunyi yang lebih jelas dan spesifik. Hal ini membantu mereka  menilai kondisi jantung dan pernapasan Anda secara lebih akurat" 
                  },
                  { 
                      q: "Kenapa detak jantung bisa terdengar lebih cepat atau lebih lambat saat diperiksa?", 
                      a: "Karena jantung itu mengikuti kondisi tubuh, kalau orang cemas, baru berdiri, atau kelelahan, detaknya bisa jadi lebih cepat. Tapi kalau tubuh sedang lemas atau kekurangan cairan, detaknya bisa melambat. Jadi perubahan bunyi detak itu membantu membaca apa yang sedang dialami pasien." 
                  }
            ]
            },
          {
              id: "meshKasa",
              file: "kasa.glb",
              title: "Kain Kasa",
              description: "Kasa adalah kain tipis steril yang digunakan untuk membersihkan luka, menyerap cairan, atau sebagai lapisan kontak langsung pada luka sebelum dipasang perban. Kasa umumnya digunakan dengan cairan antiseptik untuk membersihkan luka atau dilipat untuk menutup luka terbuka. Sifatnya yang menyerap menjadikannya esensial dalam perawatan dan penutupan luka.",
              pos: new BABYLON.Vector3(2.5, 2, 7.8),
              scale: new BABYLON.Vector3(5, 5, 5),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.4, height: 0.6, depth: 0.2 },
              visualOffset: { x: 0, y: -0.2, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Mengapa kasa sangat baik untuk membersihkan atau menutup luka?",
                      a: "Kasa memiliki struktur berpori yang mampu menyerap darah atau cairan luka dengan efektif. Saat  digunakan untuk membersihkan atau menutup luka, bahannya yang lembut membantu melindungi jaringan yang sensitif tanpa menempel terlalu kuat, sehingga proses pergantian balutan tetap nyaman dan aman." 
                  },
                  { 
                      q: "Kenapa beberapa luka harus tetap “kering”, sementara yang lain perlu lembap?", 
                      a: "Setiap luka memiliki karakteristik penyembuhan yang berbeda. Ada luka yang membaik lebih cepat saat dijaga tetap kering untuk mencegah pertumbuhan bakteri, namun ada juga luka yang membutuhkan sedikit kelembapan agar kulit baru dapat tumbuh dengan lebih optimal. Jadi, tenaga medis umumnya menyesuaikan perawatannya agar kondisi luka pasien didukung proses penyembuhan yang paling efektif" 
                  },
                  { 
                      q: "Bagaimana cara kerja kasa dalam mencegah kotoran atau bakteri masuk ke luka?", 
                      a: "Kasa memiliki lapisan berpori yang cukup rapat untuk menahan debu, kotoran, dan bakteri dari lingkungan luar. Dengan menutup luka menggunakan kasa, dapat membantu menjaga area tetap bersih sehingga bakteri tidak mudah masuk dan mengganggu proses penyembuhan luka." 
                  }
            ]
            },
          {
              id: "meshSuntik",
              file: "suntik.glb",
              title: "Alat Suntik (Syringe)",
              description: "Suntik atau spuit adalah alat yang terdiri dari tabung dan pendorong, digunakan untuk menyuntikkan cairan (obat atau vaksin) ke dalam tubuh atau mengambil sampel cairan. Jarum steril dipasang pada ujungnya, kemudian cairan ditarik atau didorong dengan pendorong ke tempat yang dituju. Alat ini krusial untuk pemberian obat secara efektif dan tindakan diagnostik invasif minimal.",
              pos: new BABYLON.Vector3(2.5, 2, 9.9),
              scale: new BABYLON.Vector3(0.001, 0.001, 0.001),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.2, height: 0.28, depth: 0.7 },
              visualOffset: { x: 0, y: -0.2, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Mengapa penyuntikan harus dilakukan di area tertentu, bukan sembarang tempat??", 
                      a: "Karena setiap area memiliki jaringan otot, pembuluh, dan saraf yang berbeda. Dengan memilih lokasi yang tepat, dokter dapat memastikan obat bekerja optimal tanpa menimbulkan cedera atau rasa nyeri berlebih." 
                  },
                  { 
                      q: "Apa pengaruh ukuran jarum terhadap rasa nyeri saat disuntik?", 
                      a: "Jarum yang lebih kecil menimbulkan sensasi tusukan yang lebih ringan. Namun ukuran jarum dipilih berdasarkan jenis cairan dan kedalaman jaringan yang harus dicapai agar obat dapat terserap dengan benar." 
                  },
                  { 
                      q: "Kenapa udara di dalam suntikan harus dibuang sebelum digunakan?", 
                      a: "Gelembung udara bisa masuk ke aliran darah dan mengganggu sirkulasi. Dengan mengeluarkan udara terlebih dahulu, sehingga tenaga medis dapat memastikan cairan masuk secara aman dan konsisten." 
                  }
            ]
            },
          {
              id: "meshThermometer",
              file: "thermometer.glb",
              title: "Termometer Digital",
              description: "Termometer digital berfungsi untuk mengukur suhu tubuh, yang penting untuk mendeteksi demam atau hipotermia. Untuk menggunakannya, arahkan sensor kearah dahi pasien, dan alat akan menampilkan pembacaan suhu dalam hitungan detik. Ini adalah cara yang cepat dan higienis untuk memonitor suhu tubuh pasien.",
              pos: new BABYLON.Vector3(2.5, 2, 11.7),
              scale: new BABYLON.Vector3(0.25, 0.25, 0.25),
              rotation: new BABYLON.Vector3(80, 160, 0),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.2, height: 0.15, depth: 0.5 },
              visualOffset: { x: 0, y: -0.05, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Mengapa kita perlu mengukur suhu tubuh saat merasa tidak enak badan?", 
                      a: "Suhu tubuh memberi tenaga medis gambaran awal tentang bagaimana kondisi tubuh seseorang. Ketika tubuh melawan infeksi atau mengalami peradangan, suhu dapat meningkat. Dengan mengukur suhu, tenaga medis dapat membantu menentukan apakah keluhan pasien disebabkan oleh demam atau oleh faktor lain yang tidak berkaitan dengan suhu." 
                  },
                  { 
                      q: "Apa yang membuat hasil pengukuran suhu bisa berbeda dari waktu ke waktu?", 
                      a: "Suhu tubuh orang-orang berubah secara alami sepanjang hari. Aktivitas fisik, emosi, makanan, minuman, bahkan lingkungan sekitar dapat memengaruhi hasil pengukuran. Itulah sebabnya penggunaan termometer dilakukan di kondisi yang tenang dan konsisten agar hasilnya lebih akurat." 
                  },
                  { 
                      q: "Mengapa suhu tubuh normal tidak selalu menandakan bahwa tubuh benar-benar sehat?", 
                      a: "Tidak semua masalah kesehatan menyebabkan kenaikan suhu. Kondisi seperti kelelahan, stres, dehidrasi ringan, atau tekanan darah rendah tidak selalu mempengaruhi suhu tubuh. Karena itu, suhu normal tidak menjamin tubuh sedang dalam kondisi prima, tetap perlu melihat gejala lain." 
                  }
            ]
            },
          {
              id: "meshTensimeter",
              file: "tensimeter.glb",
              title: "Tensimeter Digital",
              description: "Tensimeter digital digunakan untuk mengukur tekanan darah, yang merupakan indikator vital kesehatan kardiovaskular. Alat ini bekerja dengan melingkarkan manset pada lengan atas pasien, kemudian manset dipompa dan tekanan darah sistolik dan diastolik akan ditampilkan secara otomatis pada layar digital. Penggunaannya mudah dan cepat, memudahkan proses pemeriksaan.",
              pos: new BABYLON.Vector3(2.5, 2, 13.8),
              scale: new BABYLON.Vector3(0.3, 0.3, 0.3),
              rotation: new BABYLON.Vector3(-75, -35, -80),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.4, height: 0.3, depth: 0.4 },
              visualOffset: { x: 0, y: -0.15, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Mengapa tekanan darah bisa berubah hanya karena kita berdiri atau duduk?", 
                      a: "Tekanan darah berubah karena posisi tubuh memengaruhi bagaimana darah mengalir. Saat Anda berdiri, gravitasi menarik darah ke bawah sehingga jantung perlu menyesuaikan kerja pompanya. Ketika Anda duduk atau berbaring, aliran darah lebih stabil sehingga tekanannya cenderung lebih teratur." 
                  },
                  { 
                      q: "Mengapa tekanan darah perlu diperiksa secara berkala, bahkan saat kita merasa sehat?", 
                      a: "Karena tekanan darah dapat berubah tanpa menimbulkan gejala apa pun. Banyak orang memiliki tekanan darah tinggi atau rendah tanpa disadari. Pemeriksaan berkala membantu tenaga medis memastikan bahwa tubuh pasien tetap berada dalam kondisi aman sebelum muncul keluhan yang lebih serius." 
                  },
                  { 
                      q: "Kenapa pengukuran tekanan darah sering dilakukan dua kali untuk memastikan hasil?", 
                      a: "Satu kali pengukuran bisa dipengaruhi banyak hal, misalnya sedang tegang, sedikit bergerak, atau posisi lengan kurang tepat. Dengan melakukan pemeriksaan dua kali, tenaga medis memastikan hasilnya stabil dan benar-benar menggambarkan kondisi tekanan darah pasien yang sebenarnya." 
                  }
            ]
            },
          {
              id: "meshTiangInfus",
              file: "tiang_infus.glb",
              title: "Tiang Infus",
              description: "Tiang untuk menggantung kantung infus.",
              pos: new BABYLON.Vector3(2.5, 0.1, 5.4),
              scale: new BABYLON.Vector3(0.04, 0.04, 0.04),
              physics: null, 
              physicsBox: null,
              visualOffset: { x: 0, y: 0, z: 0 }, // Tidak perlu offset
            },
          {
              id: "meshInfus",
              file: "cairan_infus1.glb",
              title: "Kantung Infus",
              description: "Set infus digunakan untuk memberikan cairan, obat-obatan, atau nutrisi langsung ke dalam aliran darah pasien secara perlahan melalui pembuluh vena. Alat ini terdiri dari kantong cairan, selang, dan jarum (kateter) yang dimasukkan ke vena pasien. Infus penting untuk rehidrasi, koreksi elektrolit, dan pemberian obat jangka panjang",
              pos: new BABYLON.Vector3(2.5, 2, 15.6),
              scale: new BABYLON.Vector3(.05, .05, .05),
              rotation: new BABYLON.Vector3(90, 0, -10),
              physics: { mass: 1, restitution: 0.4 },
              physicsBox: { width: 0.4, height: 0.3, depth: 0.4 },
              visualOffset: { x: 0, y: -0.15, z: 0 }, // y = -height / 2 (Sesuaikan!)
            qa:[
                { 
                      q: "Mengapa cairan infus bisa membantu pasien yang lemas atau dehidrasi?", 
                      a: "Cairan infus langsung menggantikan air dan elektrolit yang hilang. Ini membuat volume darah meningkat kembali sehingga energi, kesadaran, dan tekanan darah pasien membaik." 
                  },
                  { 
                      q: "Kenapa beberapa jenis cairan infus tidak boleh diberikan terlalu cepat?", 
                      a: "Pemberian yang terlalu cepat bisa membuat jantung dan ginjal bekerja terlalu keras, atau mengganggu keseimbangan garam tubuh yang penting untuk fungsi saraf dan otot." 
                  },
                  { 
                      q: "Mengapa aliran infus harus diatur kecepatannya?", 
                      a: "Setiap pasien membutuhkan jumlah cairan yang berbeda. Mengatur aliran memastikan tubuh menerima cairan dengan ritme yang tepat sesuai kondisi klinisnya." 
                  }
            ]
            }
      ];

    // 2. Fungsi Helper untuk Memuat Model (Tidak berubah)
    // 2. Fungsi Helper untuk Memuat Model (Versi Perbaikan)
  async function loadItem(itemData) {
    const isGrabbable = itemData.id !== "meshTiangInfus";

    // --- Logika untuk Item NON-FISIKA (seperti Tiang Infus) ---
    if (!itemData.physics || !itemData.physicsBox) {
      
      // 1. Buat Wrapper (TransformNode) dengan skala 1.0
      const wrapper = new BABYLON.Mesh(itemData.id, scene);
      wrapper.position = itemData.pos;
      wrapper.name = itemData.id; // Nama ID ditaruh di Wrapper

      try {
        // 2. Muat model GLB
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", itemData.file, scene);
        const rootMesh = result.meshes[0]; // Deklarasikan model visual
  
        // 3. Tautkan model visual ke wrapper
        rootMesh.parent = wrapper;

        // 4. Atur skala HANYA pada model visual
        rootMesh.scaling = itemData.scale; 

        // 5. Atur posisi visual RELATIF ke wrapper (offset)
        rootMesh.position = new BABYLON.Vector3(
          itemData.visualOffset.x,
          itemData.visualOffset.y,
          itemData.visualOffset.z
        );
  
        // 6. Atur 'grabbable' pada WRAPPER (jika perlu)
        if (isGrabbable){
          wrapper.isPickable = true; 
          wrapper.metadata = { isGrabbable: true, itemData: itemData };
        }
  
        // 7. Atur rotasi HANYA pada model visual
        if (itemData.rotation) {
          rootMesh.rotation = new BABYLON.Vector3(
            BABYLON.Tools.ToRadians(itemData.rotation.x),
            BABYLON.Tools.ToRadians(itemData.rotation.y),
            BABYLON.Tools.ToRadians(itemData.rotation.z)
          );
        }
        
        // 8. Kembalikan WRAPPER
        return wrapper;

      } catch (e) {
        console.error(`Gagal memuat item (non-fisika) ${itemData.file}:`, e);
        
        return null;
      }
    }

    // --- Proses untuk Item DENGAN Fisika (Tidak Berubah) ---

    // 1. Buat Kotak Fisika (Wrapper)
    const physicsWrapper = BABYLON.MeshBuilder.CreateBox(`wrapper_${itemData.id}`, {
      width: itemData.physicsBox.width,
      height: itemData.physicsBox.height,
      depth: itemData.physicsBox.depth
    }, scene);

    // 2. Atur posisi Wrapper (TANPA ROTASI)
    physicsWrapper.position = itemData.pos;
    
    // Atur 'true' untuk melihat kotak fisika saat debugging
    physicsWrapper.isVisible = false; 

    // 3. Beri nama ID ke Wrapper (untuk UI link)
    physicsWrapper.name = itemData.id;

    if (isGrabbable){
      physicsWrapper.isPickable=true;
      physicsWrapper.metadata={
       isGrabbable:true,
       itemData:itemData
      };
    }

    // 4. Terapkan Fisika ke Wrapper
    physicsWrapper.physicsImpostor = new BABYLON.PhysicsImpostor(
      physicsWrapper,
      BABYLON.PhysicsImpostor.BoxImpostor, 
      itemData.physics, 
      scene
    );
    // === TAMBAHAN BARU: AKTIFKAN CCD (ANTI TEMBUS LANTAI) ===
    // Khusus untuk barang kecil yang mudah tembus
    if (physicsWrapper.physicsImpostor.physicsBody) {
        // ccdSpeedThreshold: Batas kecepatan minimal untuk mengaktifkan CCD (0 = selalu aktif)
        // ccdIterations: Seberapa teliti pengecekannya
        
        // CannonJS native properties:
        physicsWrapper.physicsImpostor.physicsBody.ccdSpeedThreshold = 0; 
        physicsWrapper.physicsImpostor.physicsBody.ccdIterations = 10; 
        
        // Opsional: Naikkan linear damping (rem udara) sedikit agar jatuhnya tidak secepat peluru
        physicsWrapper.physicsImpostor.linearDamping = 0.1; 
    }
    // 5. Muat Model GLB
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", itemData.file, scene);
      const rootMesh = result.meshes[0]; // Deklarasikan model visual

      // 6. Jadikan GLB sebagai anak dari Wrapper
      rootMesh.parent = physicsWrapper;
      
      // 7. Atur skala GLB
      rootMesh.scaling = itemData.scale;
      
      // 8. Atur posisi GLB *RELATIF* terhadap wrapper menggunakan offset manual
      rootMesh.position = new BABYLON.Vector3(
        itemData.visualOffset.x,
        itemData.visualOffset.y,
        itemData.visualOffset.z
      );

      // 9. Terapkan rotasi ke model visual, BUKAN ke wrapper
      if (itemData.rotation) {
        rootMesh.rotation = new BABYLON.Vector3(
          BABYLON.Tools.ToRadians(itemData.rotation.x),
          BABYLON.Tools.ToRadians(itemData.rotation.y),
          BABYLON.Tools.ToRadians(itemData.rotation.z)
        );
      }
      
    } catch (e) {
      console.error(`Gagal memuat item (fisika) ${itemData.file}:`, e);
      // Tidak perlu dispose wrapper, biarkan kotak fisika kosong saja
    }

    // 10. Kembalikan Wrapper
    return physicsWrapper;
  }

    // 3. Jalankan Pemuatan (await)
    console.log("Memulai memuat semua item...");
    const loadPromises = itemDatabase.map(async (item) => {
        const loadedItem = await loadItem(item);
        if (loadedItem) {
            assets.push(loadedItem); // Lacak setiap item yang dimuat
        }
    });
    await Promise.all(loadPromises);
    console.log("✅ Semua 10 item berhasil dimuat.");
    
    const infoPlane = BABYLON.MeshBuilder.CreatePlane("infoPlane", {width: 1, height: 1}, scene);
  infoPlane.position = new BABYLON.Vector3(0, 0, 1.5); // ATAS
  infoPlane.isVisible = false; 
  assets.push(infoPlane);

  // Plane 2: Tombol Q&A (Pertanyaan)
  const qaPlane = BABYLON.MeshBuilder.CreatePlane("qaPlane", {width: 1, height: 0.4}, scene);
  qaPlane.position = new BABYLON.Vector3(0, 0, 1.45); // TENGAH
  qaPlane.isVisible = false; 
  assets.push(qaPlane);

  // Plane 3: Tombol Aksi (Lanjut, Tanya Lagi, Tutup)
  const actionPlane = BABYLON.MeshBuilder.CreatePlane("actionPlane", {width: 1, height: 0.25}, scene);
  actionPlane.position = new BABYLON.Vector3(0, -0.28, 1.45); // BAWAH
  actionPlane.isVisible = false; 
  assets.push(actionPlane);
  
  // Variabel global untuk UI
  let infoTitle;
  let infoDesc;
  let qaButtonContainer; // (Container untuk ADT 2)
  let actionButtonContainer; // (Container untuk ADT 3)
  
  // Tautkan KETIGA panel ke kamera
  if (xr && xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
    infoPlane.parent = xr.input.xrCamera;
    qaPlane.parent = xr.input.xrCamera; // <-- BARU
    actionPlane.parent = xr.input.xrCamera; // <-- BARU
  } else {
    infoPlane.parent = scene.activeCamera;
    qaPlane.parent = scene.activeCamera; // <-- BARU
    actionPlane.parent = scene.activeCamera; // <-- BARU
  }
  
  // --- KODE TATA LETAK (Panel 1: Info / ADT 1) ---
  // ... (Tidak ada perubahan di sini: adtPanel, infoPanel, contentStack, infoTitle, infoDesc) ...
  const adtPanel = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(infoPlane);
  const infoPanel = new BABYLON.GUI.Rectangle("infoPanel");
  infoPanel.widthInPixels = 1000;
  infoPanel.heightInPixels = 800; 
  infoPanel.cornerRadius = 50;
  infoPanel.color = "white";
  infoPanel.thickness = 10;
  infoPanel.background = "rgba(0, 0, 0, 0.8)";
  adtPanel.addControl(infoPanel);

  const contentStack = new BABYLON.GUI.StackPanel("contentStack");
  contentStack.width = "100%";
  contentStack.paddingLeftInPixels = 40;
  contentStack.paddingRightInPixels = 40;
  contentStack.paddingTopInPixels =0;
  contentStack.paddingBottomInPixels = 260;
  contentStack.spacing = 15;
  infoPanel.addControl(contentStack);

  infoTitle = new BABYLON.GUI.TextBlock("infoTitle", "Judul Benda");
  infoTitle.color = "white";
  infoTitle.fontSize = 50;
  infoTitle.fontWeight = "bold";
  infoTitle.heightInPixels = 70;
  infoTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  contentStack.addControl(infoTitle);

  infoDesc = new BABYLON.GUI.TextBlock("infoDesc", "Deskripsi...");
  infoDesc.color = "white";
  infoDesc.fontSize = 36; 
  infoDesc.textWrapping = true;
  infoDesc.heightInPixels = 380; 
  infoDesc.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  infoDesc.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  contentStack.addControl(infoDesc);


  // --- KODE TATA LETAK (Panel 2: Tombol Q&A / ADT 2) ---
  const adtQaButtons = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(qaPlane, 1000, 400);
  
  // Container ini diisi oleh State 2
  qaButtonContainer = new BABYLON.GUI.StackPanel("qaButtonContainer");
  qaButtonContainer.width = "100%";
  qaButtonContainer.widthInPixels = 850; 
  qaButtonContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  qaButtonContainer.isVertical = true;
  qaButtonContainer.spacing = 10;
  adtQaButtons.addControl(qaButtonContainer);

  // --- KODE TATA LETAK (Panel 3: Tombol Aksi / ADT 3) ---
  const adtActionButtons = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(actionPlane, 1000, 250);

  // Container ini diisi oleh semua state
  actionButtonContainer = new BABYLON.GUI.StackPanel("actionButtonContainer");
  actionButtonContainer.width = "40%";
  actionButtonContainer.widthInPixels = 850; 
  actionButtonContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  actionButtonContainer.isVertical = true;
  actionButtonContainer.spacing = 10;
  adtActionButtons.addControl(actionButtonContainer);

  // --- AKHIR TATA LETAK PANEL BARU ---

  // 5. Fungsi Helper untuk Tampilkan Info (VERSI STATE MACHINE)

  // Fungsi untuk membuat tombol standar (Tidak berubah)
  function createInfoButton(id, text, color, onClick, heightInPixels = 45, wrapText = false,widthInPixels = 850) {
    const button = BABYLON.GUI.Button.CreateSimpleButton(id, text);
    button.width = "100%";
    button.heightInPixels = heightInPixels;
    button.fontSize = 30;
    button.color = "white";
    button.background = color;
    button.cornerRadius = 10;
    if (wrapText && button.textBlock) {
    button.textBlock.textWrapping = true;
    // (Opsional: beri padding internal agar teks tidak mepet tepi)
    button.textBlock.paddingTopInPixels = 5;
    button.textBlock.paddingBottomInPixels = 5;
    button.textBlock.paddingLeftInPixels = 10;
    button.textBlock.paddingRightInPixels = 10;
  }
    button.widthInPixels = widthInPixels;
    button.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    button.onPointerClickObservable.addOnce(() => {
      onClick();
    });
    return button;
  }

  // Fungsi untuk menutup panel
  function closeInfoPanel() {
    infoPlane.isVisible = false;
    qaPlane.isVisible = false; // <-- MODIFIKASI
    actionPlane.isVisible = false; // <-- MODIFIKASI
  }

  // STATE 1: Menampilkan Deskripsi Awal
  function buildState_Description(itemData) {
    // 1. Bersihkan kedua container tombol
    qaButtonContainer.clearControls();
    actionButtonContainer.clearControls();
    
    // 2. Set teks deskripsi
    infoDesc.text = itemData.description;
    infoDesc.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    
    // 3. Buat tombol "Lanjut" (jika ada Q&A) -> ke ADT 3 (Aksi)
    if (itemData.qa && itemData.qa.length > 0) {
      const lanjutButton = createInfoButton("btnLanjut", "Tanya", "#5CB85C", () => {
        buildState_Questions(itemData); // Pindah ke State 2
      });
      actionButtonContainer.addControl(lanjutButton);
    }

    // 4. Buat tombol "Tutup" -> ke ADT 3 (Aksi)
    const tutupButton = createInfoButton("btnTutup", "Tutup", "grey", () => {
      closeInfoPanel();
    });
    actionButtonContainer.addControl(tutupButton);
    
    // 5. Pastikan ADT 2 (Q&A) tidak terlihat
    qaPlane.isVisible = false;
  }

  // STATE 2: Menampilkan 3 Pertanyaan
  function buildState_Questions(itemData) {
    // 1. Bersihkan kedua container tombol
    qaButtonContainer.clearControls();
    actionButtonContainer.clearControls();
    
    // 2. Set teks prompt
    infoDesc.text = "Silakan pilih pertanyaan di bawah ini:";

    // 3. Loop data 'qa' dan buat tombol pertanyaan -> ke ADT 2 (Q&A)
    itemData.qa.forEach((qaPair) => {
      const qButton = createInfoButton(`btnQ_${qaPair.q}`, qaPair.q, "#428BCA", () => {
      buildState_Answer(itemData, qaPair); // Pindah ke State 3
    }, 90, true);
      qaButtonContainer.addControl(qButton);
    });
    
    // 4. Buat tombol "Tutup" -> ke ADT 3 (Aksi)
    const tutupButton = createInfoButton("btnTutup", "Tutup", "grey", () => {
      closeInfoPanel();
    });
    actionButtonContainer.addControl(tutupButton);
    
    // 5. Pastikan ADT 2 (Q&A) SEKARANG terlihat
    qaPlane.isVisible = true;
  }

  // STATE 3: Menampilkan Jawaban dan Opsi
  function buildState_Answer(itemData, qaPair) {
    // 1. Bersihkan kedua container tombol
    qaButtonContainer.clearControls();
    actionButtonContainer.clearControls();
    
    // 2. Set teks jawaban
    infoDesc.text = qaPair.a; // Tampilkan jawaban

    // 3. Buat tombol "Tanya Lagi"
    const tanyaLagiButton = createInfoButton("btnTanyaLagi", "Tanya Lagi", "#428BCA", () => {
   buildState_Questions(itemData); // Kembali ke State 2
  }, 45, false, 415); // (Tinggi=45, Wrap=false, Lebar=415)

  // 4. Buat tombol "Tutup" (dengan lebar 415)
  const tutupButton = createInfoButton("btnTutup", "Tutup", "grey", () => {
   closeInfoPanel();
  }, 45, false, 415)

    // 5. Kontainer horizontal (agar "Tanya Lagi" dan "Tutup" berdampingan)
   const horizontalContainer = new BABYLON.GUI.StackPanel("hContainer");
    horizontalContainer.isVertical = false;
    horizontalContainer.spacing = 20;
    horizontalContainer.heightInPixels = 80;

    horizontalContainer.addControl(tanyaLagiButton);
    horizontalContainer.addControl(tutupButton);
    
    // 6. Tambahkan container horizontal ini -> ke ADT 3 (Aksi)
    actionButtonContainer.addControl(horizontalContainer);
    
    // 7. Pastikan ADT 2 (Q&A) tidak terlihat
    qaPlane.isVisible = false;
  }


  // FUNGSI UTAMA YANG DIPANGGIL SAAT TOMBOL 'i' DIKLIK
  function showInfo(itemData) {
    // 1. Set judul
    infoTitle.text = itemData.title;
    
    // 2. Masuk ke state awal (Deskripsi)
    // (buildState_Description akan mengatur visibilitas plane tombol)
    buildState_Description(itemData);
    
    // 3. Tampilkan KETIGA panel
    // (Visibilitas plane Q&A diatur oleh state, tapi plane Aksi dan Info selalu nyala)
    infoPlane.isVisible = true;
    // qaPlane.isVisible = false; (Diaturoleh state 1)
    actionPlane.isVisible = true; 
  }

    // 6. Loop untuk Membuat Tombol Tautan 3D
    console.log("Memulai pembuatan UI tombol 3D...");
    itemDatabase.forEach(item => {
     // 1. Dapatkan NODE INDUK (WAJIB GANTI KE GETNODEBYNAME)
     const targetNode = scene.getNodeByName(item.id); // <-- INI DIA BIANG KEROKNYA

     // 2. Cek node (SEKARANG AKAN SUKSES UNTUK TIANG INFUS)
     if (targetNode) {
       
       // 3. Buat Tombol "i" 3D (sebagai plane kecil)
       const buttonPlane = BABYLON.MeshBuilder.CreatePlane(`btn_plane_${item.id}`, {size: 0.15}, scene);
        if (item.id === "meshTiangInfus") {
       console.log("--- DEBUG BAGIAN 6 ---");
       console.log("Mencari node dgn nama:", item.id);
       console.log("Hasil pencarian (targetNode):", targetNode);
     }
       // 4. Tautkan tombol ke 'targetNode'
       buttonPlane.parent = targetNode;

       // 5. Posisikan di atas PUSAT Bounding Box (Lebih Akurat)
       const boundingBox = targetNode.getHierarchyBoundingVectors(true); 
       const parentWorldPos = targetNode.getAbsolutePosition();

       const center_X_world = (boundingBox.min.x + boundingBox.max.x) / 2;
       const center_Z_world = (boundingBox.min.z + boundingBox.max.z) / 2;
       const top_Y_world = boundingBox.max.y;

       const relative_X = center_X_world - parentWorldPos.x;
       const relative_Y = top_Y_world - parentWorldPos.y;
       const relative_Z = center_Z_world - parentWorldPos.z;

       buttonPlane.position = new BABYLON.Vector3(
         relative_X,
         relative_Y + 0.3, // 0.3 meter di atas titik tertinggi
         relative_Z
       );

       // 6. Buat tombol "i" 3D
       let adtButton = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(buttonPlane);
       let btn = BABYLON.GUI.Button.CreateSimpleButton(`btn_gui_${item.id}`, "i");
       btn.widthInPixels = 800;
       btn.heightInPixels = 800;
       btn.cornerRadius = 500;
       btn.color = "white";
       btn.thickness = 8;
       btn.background = "blue";
       btn.fontSize = 400;
       adtButton.addControl(btn);
       
       // 7. Buat tombol selalu menghadap kamera
       buttonPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

       // 8. Tambahkan aksi klik
       btn.onPointerClickObservable.add(() => {
         showInfo(item);
       });
     } else {
       console.warn(`!!! GAGAL MENEMUKAN NODE UNTUK UI: "${item.id}" !!!`);
     }
   });

    

    setupVRInput(xr, scene); // Fungsi ini dari interactions.js
    const maskotPivot = await initMaskotAI(scene); // Fungsi ini dari mascotAI.js
    if (maskotPivot) {
        assets.push(maskotPivot); // Lacak pivot maskot
    }
    console.log("Maskot pivot berhasil dimuat:", maskotPivot);

    // --- (Sisa kode UI maskot, typewriter, panel konfirmasi, dll.)
    // ... (Semua variabel ini: currentState, dialogTitle, dll. disalin ke sini)
    let currentState=1;
    let dialogTitle; // Judul terpisah (Halo, Calon Dokter!)
    let dialogBody; // Teks isi
    let lanjutButton;
    let finalButtonsContainer;
    let charIndex = 0;
    let isTyping = false;
    let currentTextTarget = "";
    let typeObserver=null;
    const TYPING_SPEED=3;

    // --- DATA TEKS DIPISAH ---
   const TAHAP_1_JUDUL = "Selamat Datang di Showcase VirtuCare!";
    const TAHAP_1_BODY = "Di sepanjang perjalanan, Anda akan menemukan berbagai alat medis yang menampilkan informasi dari setiap alat. Gunakan kesempatan ini untuk mengamati dan mengenali setiap alat yang dipamerkan.";
    const TAHAP_2_BODY = "Setelah kamu mengenal alat-alat ini, bersiaplah untuk memasuki simulasi praktik.Di sana, kamu akan diuji untuk menerapkan apa yang telah kamu pelajari dalam situasi yang menyerupai dunia nyata. Jika ada yang ditanyakan, jangan ragu untuk bertanya kepada aku ya!!";
    const TAHAP_3_TEXT_FULL = "Siap melakukan simulasi?";
    const TAHAP_4_BODY = "Baik, karena anda belum siap melakukan simulasi, maka anda belum bisa berpindah dan melanjutkan ke ruang berikutnya. Silakan anda berkeliling kembali di Showcase Room guna membantu anda untuk lebih siap melakukan simulasi!";
    const TAHAP_5_BODY = "Baik, karena kamu sudah siap untuk melakukan simulasi, akan saya antarkan ke ruang pemeriksaan!";
    
    // --- FUNGSI TYPEWRITER EFFECT (TETAP SAMA) ---
    function typeWriterEffect(targetText, textBlock, scene, onComplete = () => {}) {
    // ... (Tidak ada perubahan di sini, sama seperti kode Anda)
    if (isTyping) {
        if (typeObserver) {
            scene.onBeforeRenderObservable.remove(typeObserver);
        }
    }
    isTyping = true;
    charIndex = 0;
    currentTextTarget = targetText;
    textBlock.text = ""; 
    if (lanjutButton) {
        lanjutButton.isHitTestVisible = false;
    }
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
    // --- PEMBUATAN UI ---
    const uiPlane = BABYLON.MeshBuilder.CreatePlane("uiPlane", scene);
    uiPlane.parent = maskotPivot;
    // ... (properti uiPlane)
    uiPlane.position = new BABYLON.Vector3(0, 2.2, 0); 
    uiPlane.rotation.x = -.5;
    uiPlane.rotation.y = -3.2;
    uiPlane.scaling.scaleInPlace(3);
    uiPlane.isVisible = true; 
    assets.push(uiPlane); // Lacak
    
    // ... (Sisa kode pembuatan ADT, mainPanel, stackPanel, dialogTitle, dialogBody, lanjutButton)
    const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(uiPlane, 3000, 3000);
    // ...
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

// 5A. Text Block untuk Judul
dialogTitle = new BABYLON.GUI.TextBlock("dialogTitle", "");
dialogTitle.color = "#FFD700"; 
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
    // --- MEMBUAT PLANE DAN ADT KEDUA UNTUK KONFIRMASI ---
    const uiPlaneConfirmation = BABYLON.MeshBuilder.CreatePlane("uiPlaneConfirmation", scene);
    // ... (properti uiPlaneConfirmation)
    uiPlaneConfirmation.position = new BABYLON.Vector3(.5, 2, 17.8); 
    uiPlaneConfirmation.scaling.scaleInPlace(3);
    uiPlaneConfirmation.isVisible = false; 
    assets.push(uiPlaneConfirmation); // Lacak
    
    // ... (Sisa kode pembuatan adtConfirmation, confirmationPanel, confirmationStack, confirmationTitle, finalButtonsContainer)
    const adtConfirmation = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(uiPlaneConfirmation, 3000, 3000);
    // ...
    const confirmationPanel = new BABYLON.GUI.Rectangle("confirmationPanel");
confirmationPanel.widthInPixels = 1800; // Sedikit lebih ramping
confirmationPanel.heightInPixels = 700; // Lebih pendek
confirmationPanel.background = "rgba(50, 20, 130, 0.6)"; // Warna sedikit beda
confirmationPanel.cornerRadius = 50;
confirmationPanel.thickness = 10;
confirmationPanel.color = "white";
// --- DIMODIFIKASI --- Tambahkan ke ADT KEDUA
adtConfirmation.addControl(confirmationPanel);

// Buat StackPanel untuk confirmationPanel
const confirmationStack = new BABYLON.GUI.StackPanel("confirmationStack");
confirmationStack.widthInPixels = 1600;
confirmationStack.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
confirmationPanel.addControl(confirmationStack);

// TextBlock untuk pertanyaan konfirmasi
const confirmationTitle = new BABYLON.GUI.TextBlock("confirmationTitle", "");
confirmationTitle.color = "white";
confirmationTitle.heightInPixels = 300;
confirmationTitle.fontSizeInPixels = 90;
confirmationTitle.paddingBottomInPixels = 50;
confirmationTitle.textWrapping = true;
confirmationTitle.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
confirmationTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
confirmationStack.addControl(confirmationTitle);

// 7. Buat Container Tombol Akhir
finalButtonsContainer = new BABYLON.GUI.StackPanel("finalButtonsContainer");
finalButtonsContainer.isVertical = false;
finalButtonsContainer.heightInPixels = 150;
finalButtonsContainer.isVisible = true; 
finalButtonsContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
finalButtonsContainer.spacing = 50;
confirmationStack.addControl(finalButtonsContainer);
    // --- FUNGSI HELPER TOMBOL (Tidak Berubah) ---
    const createFinalButton = (name, text, color, onClickHandler) => {
        // ... (Salin fungsi createFinalButton)
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

    // HAPUS: const goToShowcase = () => { ... };
    
    // BARU: Fungsi 'goToSimulasi' sekarang memuat scene lain... tapi file 'simulasi.html'
    // tidak ada. Kita asumsikan ini akan memuat 'menu' lagi sebagai contoh.
    const goToSimulasi = () => {
        // INI JUGA HARUS DIUBAH
        // Seharusnya ini memanggil fungsi dari main.js
        // Untuk saat ini, kita biarkan, tapi ini akan menyebabkan 'freeze' lagi.
        window.location.href = "simulasi.html"; 
        
        // REKOMENDASI: Seharusnya ini memanggil fungsi callback
        // seperti 'onStartCallback' di menu, misalnya:
        // onStartSimulasiCallback(); 
    };

    // --- HANDLER TOMBOL AKHIR (Logika Diperbarui) ---
    const onSiapClick = () => { 
        // ... (Salin fungsi onSiapClick)
        // Perhatikan 'goToSimulasi()' di dalamnya.
        console.log("Memulai Simulasi..."); 
        currentState = 5;
        finalButtonsContainer.isVisible = false;
        confirmationTitle.heightInPixels = 500; // Beri ruang lebih
        confirmationTitle.fontSizeInPixels = 70; // Samakan font-size dgn dialogBody
        confirmationTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;

        typeWriterEffect(TAHAP_5_BODY, confirmationTitle, scene, () => {
            setTimeout(() => {
                goToSimulasi(); // <-- INI MASALAH BERIKUTNYA
            }, 1000);
        });   
    };
    
    const onBelumSiapClick = () => { 
        console.log("Belum siap diklik!"); 
        currentState = 4;
        // 1. Sembunyikan container tombol
        finalButtonsContainer.isVisible = false; 
        
        // 2. Ubah style teks agar muat untuk pesan panjang
        confirmationTitle.heightInPixels = 500;
        confirmationTitle.fontSizeInPixels = 70;
        confirmationTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        
        // 3. Ketik pesan TAHAP_4_BODY ("Baik, karena belum siap...")
        typeWriterEffect(TAHAP_4_BODY, confirmationTitle, scene, () => {
            
            // 4. (CALLBACK 1) Setelah pesan TAHAP 4 selesai:
            //    Tunggu 2 detik agar pesan bisa dibaca
            setTimeout(() => {
                
                // 5. Kembalikan style teks ke style pertanyaan awal
                confirmationTitle.heightInPixels = 300;
                confirmationTitle.fontSizeInPixels = 90;
                confirmationTitle.paddingBottomInPixels = 50; // Kembalikan padding
                confirmationTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;

                // 6. Ketik ulang pertanyaan TAHAP_3_TEXT_FULL ("Siap simulasi?")
                typeWriterEffect(TAHAP_3_TEXT_FULL, confirmationTitle, scene, () => {
                    
                    // 7. (CALLBACK 2) Setelah pertanyaan selesai diketik ulang:
                    currentState = 3; // Kembalikan state ke 3 (tahap konfirmasi)
                    finalButtonsContainer.isVisible = true; // Munculkan lagi tombolnya
                });

            }, 2000);
        });
    };
        
    const onKeluarClick = () => { 
        console.log("Keluar diklik!");
        if (onExitToMenuCallback) {
        // Panggil callback untuk kembali ke menu
        onExitToMenuCallback();
    } else {
        console.error("onExitToMenuCallback tidak terdefinisi! Tidak bisa kembali ke menu.");
    }
    };

    // ... (Kode pembuatan startButton, toolsButton, exitButton)
    const startButton = createFinalButton("start", "Siap!!", "#5CB85C", onSiapClick);
    const toolsButton = createFinalButton("tools", "Belum siap", "#428BCA", onBelumSiapClick);
    const exitButton = createFinalButton("exit", "Keluar", "#D9534F", onKeluarClick);
    finalButtonsContainer.addControl(startButton);
    finalButtonsContainer.addControl(toolsButton);
    finalButtonsContainer.addControl(exitButton);


    // --- FUNGSI LOGIKA PERGANTIAN TAHAP (HANDLE KLIK) ---
    function handleLanjutClick() {
        if (isTyping) return;
    currentState++;
    
    if (currentState === 2) {
        // TAHAP 2: (Logika tetap sama, masih di mainPanel)
        dialogTitle.text = ""; 
        dialogBody.heightInPixels = 700;
        dialogBody.fontSizeInPixels = 70;
        
        typeWriterEffect(TAHAP_2_BODY, dialogBody, scene, () => {
            lanjutButton.isHitTestVisible = true; 
        });

    } else if (currentState === 3) {
        // TAHAP 3: Tampilkan panel konfirmasi
        
        // 1. --- DIMODIFIKASI --- Sembunyikan MESH utama
        uiPlane.isVisible = false;
        
        // 2. --- DIMODIFIKASI --- Tampilkan MESH konfirmasi
        uiPlaneConfirmation.isVisible = true;
        
        // 3. Jalankan typewriter di textblock konfirmasi (confirmationTitle)
        typeWriterEffect(TAHAP_3_TEXT_FULL, confirmationTitle, scene, () => {
            // Selesai
        });
    }
    }
    
    // --- Membuat UI Dapat Di-"Grab" (Digeser) ---
    const grabBehavior = new BABYLON.PointerDragBehavior();
    grabBehavior.allowMultiPointer = false;
    uiPlane.addBehavior(grabBehavior);

    const grabBehavior2 = new BABYLON.SixDofDragBehavior();
    grabBehavior2.allowMultiPointer = true;
    uiPlaneConfirmation.addBehavior(grabBehavior2);

    
    // === MULAI ANIMASI PERTAMA DI SINI (TAHAP 1) ===
    typeWriterEffect(TAHAP_1_JUDUL, dialogTitle, scene, () => {
         typeWriterEffect(TAHAP_1_BODY, dialogBody, scene, () => {
        lanjutButton.isHitTestVisible = true;
    });
    });      
      
    // HAPUS: return scene;
    
    // 7. Kembalikan array aset
    return assets;
    
    // HAPUS: // <-- Akhir dari createScene
    // HAPUS: createScene().then(...)
    // HAPUS: engine.runRenderLoop(...)
    // HAPUS: window.addEventListener("resize", ...)
}
