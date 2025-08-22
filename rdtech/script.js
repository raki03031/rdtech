document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const fileList = document.getElementById('fileList');
    const previewModal = document.getElementById('previewModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const closeModal = document.getElementById('closeModal');
    const closeBtn = document.getElementById('closeBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    
    let currentFile = null;
    let files = JSON.parse(localStorage.getItem('edushare_files')) || [];

    renderFileList();

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));

    ['dragenter','dragover','dragleave','drop'].forEach(e => {
        dropArea.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }, false);
    });
    ['dragenter','dragover'].forEach(e => dropArea.addEventListener(e, () => dropArea.classList.add('active')));
    ['dragleave','drop'].forEach(e => dropArea.addEventListener(e, () => dropArea.classList.remove('active')));

    dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

    function handleFiles(fileList) {
        for (let i=0; i<fileList.length; i++) {
            const file = fileList[i];
            if (file.size > 10*1024*1024) {
                alert(`${file.name} is too large (max 10MB).`);
                continue;
            }
            const fileObject = {
                id: Date.now()+i,
                name: file.name,
                type: file.type,
                size: file.size,
                uploadDate: new Date().toISOString(),
                data: null
            };
            const reader = new FileReader();
            reader.onload = e => {
                fileObject.data = e.target.result;
                files.push(fileObject);
                localStorage.setItem('edushare_files', JSON.stringify(files));
                renderFileList();
            };
            if (file.type.startsWith('text/') || file.type === 'application/pdf') {
                reader.readAsText(file);
            } else {
                reader.readAsDataURL(file);
            }
        }
    }

    function renderFileList() {
        fileList.innerHTML = files.length === 0 
            ? `<div class="empty-state"><i class="fas fa-folder-open"></i><p>No files uploaded</p></div>`
            : "";
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.id = file.id;
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-icon"><i class="fas fa-file"></i></div>
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <p>${(file.size/1024).toFixed(1)} KB • ${new Date(file.uploadDate).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn btn-preview preview-btn">Preview</button>
                    <button class="action-btn btn-download download-btn">Download</button>
                    <button class="action-btn btn-delete delete-btn">Delete</button>
                </div>
            `;
            fileList.appendChild(fileItem);
        });
        document.querySelectorAll('.preview-btn').forEach(btn =>
            btn.addEventListener('click', () => previewFile(parseInt(btn.closest('.file-item').dataset.id)))
        );
        document.querySelectorAll('.download-btn').forEach(btn =>
            btn.addEventListener('click', () => downloadFile(parseInt(btn.closest('.file-item').dataset.id)))
        );
        document.querySelectorAll('.delete-btn').forEach(btn =>
            btn.addEventListener('click', () => deleteFile(parseInt(btn.closest('.file-item').dataset.id)))
        );
    }

    function previewFile(fileId) {
        const file = files.find(f => f.id === fileId);
        if (!file) return;
        currentFile = file;
        modalTitle.textContent = file.name;
        modalBody.innerHTML = file.type.startsWith('image/') 
            ? `<img src="${file.data}" class="preview-image">`
            : `<p>Preview not supported. Please download.</p>`;
        previewModal.style.display = 'flex';
    }

    function downloadFile(fileId) {
        const file = files.find(f => f.id === fileId);
        if (!file) return;
        const blob = new Blob([file.data], { type: file.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function deleteFile(fileId) {
        if (!confirm('Delete this file?')) return;
        files = files.filter(f => f.id !== fileId);
        localStorage.setItem('edushare_files', JSON.stringify(files));
        renderFileList();
    }

    [closeModal, closeBtn].forEach(btn => btn.addEventListener('click', () => previewModal.style.display = 'none'));
    window.addEventListener('click', e => { if (e.target === previewModal) previewModal.style.display = 'none'; });
});
