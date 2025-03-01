// script.js
class FileShare {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.file = null;
        this.fileReader = new FileReader();
        this.retryCount = 0;
        this.maxRetries = 3;
        this.allowedTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'];
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
        downloadBtn.addEventListener('click', () => this.startDownload());
        
        this.updateStatus('Ready', 'connected');
    }

    handleFileSelect() {
        const fileInput = document.getElementById('file-input');
        this.file = fileInput.files[0];
        
        if (!this.file) return;
        
        // File type validation
        if (!this.allowedTypes.some(type => this.file.type.match(type.split('*')[0]))) {
            this.showError('Unsupported file type. Allowed: images, videos, audio, PDFs, text files');
            fileInput.value = '';
            return;
        }

        document.getElementById('error-message').classList.add('hidden');
        document.getElementById('file-info').classList.remove('hidden');
        document.getElementById('file-name').textContent = this.file.name;
        document.getElementById('file-size').textContent = this.formatSize(this.file.size);
        document.getElementById('generate-link').classList.remove('hidden');
    }

    async generateShareLink() {
        try {
            this.updateStatus('Creating connection...', 'waiting');
            this.peer = new RTCPeerConnection();
            this.connection = this.peer.createDataChannel('file-transfer');

            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);
            
            const shareId = btoa(JSON.stringify(this.peer.localDescription));
            const shareLink = `${window.location.origin}?share=${shareId}`;
            document.getElementById('share-link').value = shareLink;
            document.getElementById('link-container').classList.remove('hidden');
            
            this.setupSenderConnection();
        } catch (error) {
            this.handleError('Failed to generate link', error);
        }
    }

    setupSenderConnection() {
        this.connection.onopen = () => {
            this.updateStatus('Connected! Waiting for receiver...', 'connected');
            this.sendFile();
            this.retryCount = 0;
        };

        this.connection.onerror = (error) => {
            this.handleError('Connection error', error);
            this.retryConnection();
        };

        this.connection.onclose = () => {
            this.updateStatus('Connection closed', 'error');
        };

        this.peer.onicecandidate = (event) => {
            if (event.candidate) {
                // Handle ICE candidates
            }
        };
    }

    sendFile() {
        const chunkSize = 16384;
        let offset = 0;

        this.fileReader.onload = (e) => {
            this.connection.send(e.target.result);
            offset += e.target.result.byteLength;
            const progress = (offset / this.file.size) * 100;
            
            document.getElementById('progress-container').classList.remove('hidden');
            document.getElementById('upload-progress').value = progress;
            document.getElementById('progress-text').textContent = `${Math.round(progress)}%`;

            if (offset < this.file.size) {
                this.readSlice(offset);
            } else {
                this.updateStatus('Upload complete!', 'connected');
            }
        };

        this.readSlice(offset);
    }

    readSlice(offset) {
        const slice = this.file.slice(offset, offset + 16384);
        this.fileReader.readAsArrayBuffer(slice);
    }

    checkReceiverMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');
        
        if (shareId) {
            document.getElementById('sender-section').classList.add('hidden');
            document.getElementById('receiver-section').classList.remove('hidden');
            this.setupReceiver(shareId);
        }
    }

    async setupReceiver(shareId) {
        try {
            const offer = JSON.parse(atob(shareId));
            this.peer = new RTCPeerConnection();
            
            this.peer.ondatachannel = (event) => {
                this.connection = event.channel;
                this.receiveFile();
            };

            await this.peer.setRemoteDescription(offer);
            const answer = await this.peer.createAnswer();
            await this.peer.setLocalDescription(answer);
            
            this.updateStatus('Connecting to sender...', 'waiting');
        } catch (error) {
            this.handleError('Failed to setup receiver', error);
        }
    }

    receiveFile() {
        let receivedBuffers = [];
        let receivedSize = 0;

        this.connection.onopen = () => {
            this.updateStatus('Connected! Ready to download', 'connected');
            this.retryCount = 0;
        };

        this.connection.onmessage = (event) => {
            receivedBuffers.push(event.data);
            receivedSize += event.data.byteLength;

            const progress = (receivedSize / this.file.size) * 100;
            document.getElementById('download-progress-container').classList.remove('hidden');
            document.getElementById('download-progress').value = progress;
            document.getElementById('download-progress-text').textContent = `${Math.round(progress)}%`;

            if (progress === 100) {
                this.saveFile(receivedBuffers);
                this.updateStatus('Download complete!', 'connected');
            }
        };

        this.connection.onerror = (error) => {
            this.handleError('Connection error', error);
            this.retryConnection();
        };

        this.connection.onclose = () => {
            this.updateStatus('Connection closed', 'error');
        };
    }

    saveFile(buffers) {
        const blob = new Blob(buffers);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.file.name;
        a.click();
        window.URL.revokeObjectURL(url);
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

    retryConnection() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.updateStatus(`Connection failed. Retrying (${this.retryCount}/${this.maxRetries})...`, 'waiting');
            setTimeout(() => {
                if (this.connection.readyState !== 'open') {
                    this.setupSenderConnection();
                }
            }, 2000 * this.retryCount);
        } else {
            this.updateStatus('Max retries reached. Please try again.', 'error');
        }
    }

    startDownload() {
        this.updateStatus('Initiating download...', 'waiting');
        // File info will be updated once connection is established
        document.getElementById('receive-file-name').textContent = 'Waiting for sender...';
        document.getElementById('receive-file-size').textContent = 'Unknown';
    }
}

new FileShare();
