// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBc6Vv0c77J3pktRuqgDQdXtfrwXkW06Lg",
  authDomain: "edushear-92b44.firebaseapp.com",
  projectId: "edushear-92b44",
  storageBucket: "edushear-92b44.appspot.com",   // ✅ fixed
  messagingSenderId: "493000206733",
  appId: "1:493000206733:web:b5067827f0706b292cb5c4",
  measurementId: "G-D1WLLZT7LQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// ==== Upload File ====
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const storageRef = ref(storage, "uploads/" + file.name);
  await uploadBytes(storageRef, file);

  alert("✅ File uploaded: " + file.name);
  loadFiles(); // refresh file list
});

// ==== List & Show Files ====
async function loadFiles() {
  const listRef = ref(storage, "uploads/");
  const res = await listAll(listRef);

  const filesGrid = document.getElementById("filesGrid");
  filesGrid.innerHTML = "";

  for (let item of res.items) {
    const url = await getDownloadURL(item);

    const card = document.createElement("div");
    card.className = "file-card";
    card.innerHTML = `
      <div class="file-icon"><i class="fas fa-file"></i></div>
      <div class="file-name">${item.name}</div>
      <div class="file-actions">
        <a href="${url}" target="_blank" class="action-btn download-btn">
          <i class="fas fa-download"></i> Download
        </a>
      </div>
    `;
    filesGrid.appendChild(card);
  }
}

// Load files on page load
document.addEventListener("DOMContentLoaded", loadFiles);
