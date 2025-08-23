// ==== Firebase Config (replace with your values) ====
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Init
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const storage = firebase.storage();
const db = firebase.firestore();

// DOM Elements
const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");
const filesGrid = document.getElementById("filesGrid");
const loginBtn = document.getElementById("loginBtn");
const guestBtn = document.getElementById("guestBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userDisplay = document.getElementById("userDisplay");
const showUploadBtn = document.getElementById("showUploadBtn");
const uploadModal = document.getElementById("uploadModal");
const fileInput = document.getElementById("fileInput");
const startUploadBtn = document.getElementById("startUploadBtn");
const closeModal = document.getElementById("closeModal");

// Login
loginBtn.onclick = () => {
  const email = document.getElementById("username").value;
  const pass = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, pass)
    .then(u => showApp(u.user.email))
    .catch(e => alert(e.message));
};
guestBtn.onclick = () => {
  auth.signInAnonymously()
    .then(() => showApp("Guest"))
    .catch(e => alert(e.message));
};
logoutBtn.onclick = () => { auth.signOut(); loginPage.style.display="block"; appPage.style.display="none"; };

// Show app
function showApp(user) {
  loginPage.style.display = "none";
  appPage.style.display = "flex";
  userDisplay.textContent = "Welcome, " + user;
  loadFiles();
}

// Upload modal
showUploadBtn.onclick = () => uploadModal.classList.add("active");
closeModal.onclick = () => uploadModal.classList.remove("active");

// Upload
startUploadBtn.onclick = async () => {
  const files = fileInput.files;
  if(!files.length) return alert("Select a file!");
  for (let f of files) {
    const ref = storage.ref("uploads/" + f.name);
    await ref.put(f);
    const url = await ref.getDownloadURL();
    await db.collection("files").add({
      name:f.name, size:(f.size/1024/1024).toFixed(2)+" MB", url,
      date:new Date().toLocaleString()
    });
  }
  alert("Uploaded!");
  uploadModal.classList.remove("active");
  loadFiles();
};

// Load files
async function loadFiles() {
  filesGrid.innerHTML = "";
  const snap = await db.collection("files").orderBy("date","desc").get();
  snap.forEach(doc => {
    const f = doc.data();
    const card = document.createElement("div");
    card.className="file-card";
    card.innerHTML = `
      <div class="file-icon"><i class="fas fa-file"></i></div>
      <div class="file-name">${f.name}</div>
      <div class="file-details"><span>${f.size}</span><span>${f.date}</span></div>
      <a href="${f.url}" target="_blank" class="btn primary" style="margin-top:10px;">Download</a>
    `;
    filesGrid.appendChild(card);
  });
}
