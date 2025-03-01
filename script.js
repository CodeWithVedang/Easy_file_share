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
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
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
        this.updateConnectionStatus(false, false);
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

        document.getElementById('error-message').classList.add('hidden');
        document.getElementById('file-info').classList.remove('hidden');
        document.getElementById('file-name').textContent = this.file.name;
        document.getElementById('file-size').textContent = this.formatSize(this.file.size);
        document.getElementById('generate-link').classList.remove('hidden');
    }

    async generateShareLink() {
        try {
            this.updateStatus('Creating connection...', 'waiting');
            this.peer = new RTCPeerConnection(this.configuration);
            this.connection = this.peer.createDataChannel('file-transfer');
            
            const iceCandidates = [];
            this.peer.onicecandidate = (event) => {
                if (event.candidate) {
                    iceCandidates.push(event.candidate);
                } else {
                    this.createShareLink(iceCandidates);
                }
            };

            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);
            this.setupSenderConnection();
        } catch (error) {
            this.handleError('Failed to generate link', error);
        }
    }

    createShareLink(iceCandidates) {
        const connectionData = {
            sdp: this.peer.localDescription,
            candidates: iceCandidates
        };
        const shareId = btoa(JSON.stringify(connectionData));
        const shareLink = `${window.location.origin}?share=${shareId}`;
        document.getElementById('share-link').value = shareLink;
        document.getElementById('link-container').classList.remove('hidden');
    }

    setupSenderConnection() {
        this.connection.onopen = () => {
            this.updateStatus('Connected! Waiting for receiver...', 'connected');
            this.updateConnectionStatus(true, false);
            this.sendFile();
            this.retryCount = 0;
        };

        this.connection.onerror = (error) => {
            this.handleError('Connection error', error);
            this.retryConnection();
        };

        this.connection.onclose = () => {
            this.updateStatus('Connection closed', 'error');
            this.updateConnectionStatus(false, false);
        };

        this.peer.onconnectionstatechange = () => {
            switch(this.peer.connectionState) {
                case 'connected':
                    this.updateConnectionStatus(true, false);
                    break;
                case 'disconnected':
                case 'failed':
                    this.updateConnectionStatus(false, false);
                    break;
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
            const connectionData = JSON.parse(atob(shareId));
            this.peer = new RTCPeerConnection(this.configuration);
            
            this.peer.ondatachannel = (event) => {
                this.connection = event.channel;
                this.receiveFile();
            };

            await this.peer.setRemoteDescription(connectionData.sdp);
            
            // Add ICE candidates
            for (const candidate of connectionData.candidates) {
                await this.peer.addIceCandidate(candidate);
            }

            const answer = await this.peer.createAnswer();
            await this.peer.setLocalDescription(answer);
            
            this.updateStatus('Connecting to sender...', 'waiting');
            this.updateConnectionStatus(false, true);
        } catch (error) {
            this.handleError('Failed to setup receiver', error);
        }
    }

    receiveFile() {
        let receivedBuffers = [];
        let receivedSize = 0;

        this.connection.onopen = () => {
            this.updateStatus('Connected! Ready to download', 'connected');
            this.updateConnectionStatus(true, true);
            this.retryCount = 0;
            document.getElementById('receive-file-name').textContent = this.file ? this.file.name : 'Unknown';
            document.getElementById('receive-file-size').textContent = this.file ? this.formatSize(this.file.size) : 'Unknown';
        };

        this.connection.onmessage = (event) => {
            receivedBuffers.push(event.data);
            receivedSize += event.data.byteLength;

            const progress = (receivedSize / this.file?.size || 1) * 100;
            document.getElementById('download-progress-container').classList.remove('hidden');
            document.getElementById('download-progress').value = progress;
            document.getElementById('download-progress-text').textContent = `${Math.round(progress)}%`;

            if (progress >= 100 && this.file) {
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
            this.updateConnectionStatus(false, false);
        };

        this.peer.onconnectionstatechange = () => {
            switch(this.peer.connectionState) {
                case 'connected':
                    this.updateConnectionStatus(true, true);
                    break;
                case 'disconnected':
                case 'failed':
                    this.updateConnectionStatus(false, true);
                    break;
            }
        };
    }

    saveFile(buffers) {
        const blob = new Blob(buffers);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.file?.name || 'downloaded_file';
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

    updateConnectionStatus(senderConnected, receiverConnected) {
        const connectionStatus = document.getElementById('connection-status');
        connectionStatus.classList.remove('hidden');
        document.getElementById('sender-status').textContent = 
            senderConnected ? 'Connected' : 'Disconnected';
        document.getElementById('sender-status').style.color = 
            senderConnected ? '#155724' : '#721c24';
        document.getElementById('receiver-status').textContent = 
            receiverConnected ? 'Connected' : 'Disconnected';
        document.getElementById('receiver-status').style.color = 
            receiverConnected ? '#155724' : '#721c24';
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
        document.getElementById('receive-file-name').textContent = 'Waiting for sender...';
        document.getElementById('receive-file-size').textContent = 'Unknown';
    }
}

new FileShare();
