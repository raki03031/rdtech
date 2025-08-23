// ==== Firebase Config (replace with yours) ====
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_APP.firebaseapp.com",
  projectId: "YOUR_APP",
  storageBucket: "YOUR_APP.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const storage = firebase.storage();
const db = firebase.firestore();

// ==== DOM Elements ====
const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");
const filesGrid = document.getElementById("filesGrid");
const loginBtn = document.getElementById("loginBtn");
const guestBtn = document.getElementById("guestBtn");
const logoutBtn = document.getElementById("logoutBtn");
const showUploadBtn = document.getElementById("showUploadBtn");
const uploadModal = document.getElementById("uploadModal");
const closeModal = document.getElementById("closeModal");
const browseBtn = document.getElementById("browseBtn");
const fileInput = document.getElementById("fileInput");
const uploadList = document.getElementById("uploadList");
const startUploadBtn = document.getElementById("startUploadBtn");
const userDisplay = document.getElementById("userDisplay");

let selectedFiles = [];

// ==== Login ====
loginBtn.addEventListener("click", () => {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      showAppPage(user.user.email);
    })
    .catch(err => alert(err.message));
});

// Guest login
guestBtn.addEventListener("click", () => {
  auth.signInAnonymously()
    .then(() => showAppPage("Guest"))
    .catch(err => alert(err.message));
});

// Logout
logoutBtn.addEventListener("click", () => {
  auth.signOut().then(() => {
    appPage.style.display = "none";
    loginPage.style.display = "flex";
  });
});

// ==== Show Pages ====
function showAppPage(username) {
  loginPage.style.display = "none";
  appPage.style.display = "block";
  userDisplay.textContent = "Welcome, " + username;
  loadFiles();
}

// ==== Upload Modal ====
showUploadBtn.addEventListener("click", () => uploadModal.classList.add("active"));
closeModal.addEventListener("click", () => uploadModal.classList.remove("active"));
browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => {
  selectedFiles = e.target.files;
  renderUploadList();
});

// Render upload list
function renderUploadList() {
  uploadList.innerHTML = "";
  Array.from(selectedFiles).forEach(f => {
    let div = document.createElement("div");
    div.className = "upload-item";
    div.innerHTML = `<div>${f.name}</div><div>${(f.size/1024/1024).toFixed(2)} MB</div>`;
    uploadList.appendChild(div);
  });
}

// Start Upload
startUploadBtn.addEventListener("click", async () => {
  for (let f of selectedFiles) {
    const ref = storage.ref("uploads/" + f.name);
    await ref.put(f);
    const url = await ref.getDownloadURL();
    await db.collection("files").add({
      name: f.name,
      size: (f.size/1024/1024).toFixed(2) + " MB",
      url,
      date: new Date().toLocaleDateString()
    });
  }
  alert("Upload complete!");
  uploadModal.classList.remove("active");
  loadFiles();
});

// ==== Load Files ====
async function loadFiles() {
  filesGrid.innerHTML = "";
  const snap = await db.collection("files").orderBy("date", "desc").get();
  snap.forEach(doc => {
    const file = doc.data();
    const div = document.createElement("div");
    div.className = "file-card";
    div.innerHTML = `
      <div class="file-icon"><i class="far fa-file"></i></div>
      <div class="file-name">${file.name}</div>
      <div class="file-details">
        <span>${file.size}</span>
        <span>${file.date}</span>
      </div>
      <a href="${file.url}" target="_blank" class="btn" style="margin-top:8px;display:block;text-align:center;">Download</a>
    `;
    filesGrid.appendChild(div);
  });
}
