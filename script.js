const client = new WebTorrent();
let generatedLink = "";

// Modal Functions
function showModal(message) {
    document.getElementById("modal-message").textContent = message;
    document.getElementById("modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
}

// Validation and Error Handling
function shareFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        showModal("Please select a file to share.");
        return;
    }
    client.seed(file, torrent => {
        generatedLink = `?magnet=${encodeURIComponent(torrent.magnetURI)}`;
        document.getElementById("downloadLink").innerHTML = `<a href="${generatedLink}" target="_blank" style="color: #ff6f61;">Download Link</a>`;
        document.getElementById("shareOptions").style.display = "flex";
        showModal("File shared successfully! Copy the link to share.");
    });
}

function copyLink() {
    if (!generatedLink) {
        showModal("No link generated yet. Please share a file first.");
        return;
    }
    navigator.clipboard.writeText(window.location.origin + generatedLink).then(() => {
        showModal("Link copied to clipboard!");
    }).catch(() => {
        showModal("Failed to copy link. Please try again.");
    });
}

function shareWhatsApp() {
    if (!generatedLink) {
        showModal("No link generated yet. Please share a file first.");
        return;
    }
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent("Download file: " + window.location.origin + generatedLink)}`;
    window.open(whatsappUrl, "_blank");
}

function downloadFile() {
    const magnetURI = new URLSearchParams(window.location.search).get("magnet") || document.getElementById("magnetInput").value;
    if (!magnetURI) {
        showModal("Please provide a valid magnet link.");
        return;
    }
    client.add(magnetURI, torrent => {
        torrent.files.forEach(file => {
            file.getBlobURL((err, url) => {
                if (err) {
                    showModal("Failed to download file. Please check the magnet link.");
                    return console.error(err);
                }
                const a = document.createElement("a");
                a.href = url;
                a.download = file.name;
                a.innerText = "Download File";
                document.getElementById("downloadLink").appendChild(a);
                showModal("File downloaded successfully!");
            });
        });
    });
}

window.onload = () => {
    const magnetURI = new URLSearchParams(window.location.search).get("magnet");
    if (magnetURI) downloadFile();
};