// ==========================================================
// Maskot AI 3D - versi final (by ChatGPT)
// ==========================================================
// Pastikan HTML kamu punya:
// <script src="https://cdn.babylonjs.com/babylon.js"></script>
// <script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
// ==========================================================

async function initMaskotAI(scene) {
  if (!BABYLON.GUI) {
    console.error("BABYLON.GUI belum dimuat! Tambahkan babylon.gui.min.js di HTML kamu.");
    return;
  }

  return new Promise((resolve, reject) => {
    BABYLON.SceneLoader.ImportMesh("", "assets/", "Avatar_Virtucare.glb", scene, function (meshes) {
      const maskot = meshes[0];

      // Bungkus maskot dalam transform node agar rotasi bisa dikontrol
      const maskotPivot = new BABYLON.TransformNode("maskotPivot", scene);

      globalMaskotPivot = maskotPivot;
      maskot.parent = maskotPivot;

      // Ukuran & posisi dasar
      maskot.scaling = new BABYLON.Vector3(0.3, 0.3, 0.3);
      maskot.position = BABYLON.Vector3.Zero();

      // Koreksi arah depan model (atur sesuai model kamu)
      maskot.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);

      // Atur posisi awal relatif ke kamera
      maskotPivot.position = scene.activeCamera.position.add(new BABYLON.Vector3(-1.6, -1.5, 1.2));

      // ==========================================================
      // Gerak mengikuti player
      // ==========================================================
      scene.onBeforeRenderObservable.add(() => {
        // Selalu gunakan kamera yang sedang aktif (desktop atau VR)
  const activeCam = scene.activeCamera;

  const targetPos = activeCam.position.add(new BABYLON.Vector3(-1.6, -1.5, 1.2));
  maskotPivot.position = BABYLON.Vector3.Lerp(maskotPivot.position, targetPos, 0.05);

  // Buat target lookAt hanya di sumbu XZ (horizontal)
  const lookTarget = new BABYLON.Vector3(activeCam.position.x, maskotPivot.position.y, activeCam.position.z);
  maskotPivot.lookAt(lookTarget);
      });

      

      // ==========================================================
      // UI input di layar
      // ==========================================================
      const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
      const input = new BABYLON.GUI.InputText();
      input.width = "60%";
      input.height = "50px";
      input.color = "white";
      input.background = "#222";
      input.placeholderText = "Tanya sesuatu ke Maskot AI...";
      input.fontSize = 24;
      input.top = "40%";
      input.isVisible = false;
      ui.addControl(input);

      // ==========================================================
      // Klik maskot -> aktifkan input chat
      // ==========================================================
      maskot.actionManager = new BABYLON.ActionManager(scene);
      maskot.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
          input.isVisible = true;
          input.focus();
        })
      );

      // ==========================================================
      // Tekan ENTER -> kirim pertanyaan ke AI
      // ==========================================================
      input.onKeyboardEventProcessedObservable.add((kbInfo) => {
        if (kbInfo.event.key === "Enter" && input.text.trim() !== "") {
          const userQuestion = input.text.trim();
          chatText.text = "⏳ Sedang berpikir...";
          input.text = "";
          input.isVisible = false;

          getAIResponse(userQuestion)
            .then(answer => {
              chatText.text = answer;
            })
            .catch(err => {
              chatText.text = "⚠️ Gagal menjawab, coba lagi ya.";
              console.error(err);
            });
        }
      });

      console.log("🤖 CARE-U aktif dan siap diajak ngobrol!");
      resolve(maskotPivot);
    }, null, (err) => reject(err));
  });
}

// ==========================================================
// Fungsi AI Chat (dummy lokal - bisa ganti ke API GPT nanti)
// ==========================================================
async function getAIResponse(question) {
  console.log("🧠 Pertanyaan:", question);

  const responses = [
    "Menarik banget pertanyaannya 😄",
    "Hmm... aku rasa itu butuh penelitian lebih lanjut 🧠",
    "Menurutku, itu ide yang keren banget!",
    "Wah, pertanyaan bagus! Aku akan pelajari itu 📘"
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

