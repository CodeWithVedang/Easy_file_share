// script.js
class EasyFileShare {
    constructor() {
        this.file = null;
        this.files = new Map(); // Temporary client-side storage
        this.allowedTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'];
        this.baseUrl = 'https://easy-file-share-by-codewithvedang.vercel.app/';
        this.initUI();
        this.checkReceiverMode();
    }

    initUI() {
        const fileInput = document.getElementById('file-input');
        const generateBtn = document.getElementById('generate-link');
        const copyBtn = document.getElementById('copy-btn');
        const downloadBtn = document.getElementById('download-btn');

        fileInput.addEventListener('change', () => this.handleFileSelect());
        generateBtn.addEventListener('click', () => this.generateShareLink());
        copyBtn.addEventListener('click', () => this.copyLink());
        downloadBtn.addEventListener('click', () => this.downloadFile());
        
        this.updateStatus('Ready to share', 'connected');
    }

    handleFileSelect() {
        const fileInput = document.getElementById('file-input');
        this.file = fileInput.files[0];
        
        if (!this.file) return;
        
        if (!this.allowedTypes.some(type => this.file.type.match(type.split('*')[0]))) {
            this.showError('Unsupported file type. Allowed: images, videos, audio, PDFs, text files');
            fileInput.value = '';
            return;
        }

        if (this.file.size > 100 * 1024 * 1024) { // 100MB limit
            this.showError('File too large. Maximum size is 100MB');
            fileInput.value = '';
            return;
        }

        document.getElementById('error-message').classList.add('hidden');
        document.getElementById('file-info').classList.remove('hidden');
        document.getElementById('file-name').textContent = this.file.name;
        document.getElementById('file-size').textContent = this.formatSize(this.file.size);
        document.getElementById('generate-link').classList.remove('hidden');
    }

    generateShareLink() {
        try {
            const uniqueId = this.generateUniqueId();
            this.files.set(uniqueId, {
                name: this.file.name,
                size: this.file.size,
                blob: this.file
            });

            const shareLink = `${this.baseUrl}?file=${uniqueId}`;
            document.getElementById('share-link').value = shareLink;
            document.getElementById('link-container').classList.remove('hidden');
            
            this.updateStatus('Share link generated! Send it to the recipient', 'connected');
            
            // Clean up after 1 hour
            setTimeout(() => this.files.delete(uniqueId), 60 * 60 * 1000);
        } catch (error) {
            this.handleError('Failed to generate link', error);
        }
    }

    generateUniqueId() {
        return Math.random().toString(36).substr(2, 9) + 
               Date.now().toString(36);
    }

    checkReceiverMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const fileId = urlParams.get('file');
        
        if (fileId) {
            document.getElementById('sender-section').classList.add('hidden');
            document.getElementById('receiver-section').classList.remove('hidden');
            this.setupReceiver(fileId);
        }
    }

    setupReceiver(fileId) {
        const fileData = this.files.get(fileId);
        
        if (fileData) {
            this.file = fileData.blob;
            document.getElementById('receive-file-name').textContent = fileData.name;
            document.getElementById('receive-file-size').textContent = this.formatSize(fileData.size);
            this.updateStatus('File ready to download', 'connected');
        } else {
            this.updateStatus('File not found or link expired', 'error');
            document.getElementById('receive-file-name').textContent = 'Unknown';
            document.getElementById('receive-file-size').textContent = 'Unknown';
            document.getElementById('download-btn').disabled = true;
        }
    }

    downloadFile() {
        try {
            if (!this.file) {
                throw new Error('No file available to download');
            }
            
            const url = window.URL.createObjectURL(this.file);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.updateStatus('Download started!', 'connected');
        } catch (error) {
            this.handleError('Download failed', error);
        }
    }

    copyLink() {
        const linkInput = document.getElementById('share-link');
        linkInput.select();
        document.execCommand('copy');
        this.updateStatus('Link copied to clipboard!', 'connected');
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    updateStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    handleError(message, error) {
        console.error(`${message}:`, error);
        this.updateStatus(`${message}: ${error.message}`, 'error');
    }
}

new EasyFileShare();
