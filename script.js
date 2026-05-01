const audioInput = document.getElementById("audioInput");
const audioPlayer = document.getElementById("audioPlayer");
const fileInfo = document.getElementById("fileInfo");
const statusText = document.getElementById("status");

let currentAudioUrl = null;

audioInput.addEventListener("change", function () {
  const file = this.files[0];

  if (!file) return;

  if (!file.type.startsWith("audio/")) {
    showStatus("Please select a valid audio file.", "error");
    return;
  }

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
  }

  currentAudioUrl = URL.createObjectURL(file);
  audioPlayer.src = currentAudioUrl;
  audioPlayer.style.display = "block";

  const size = (file.size / 1024 / 1024).toFixed(2);
  fileInfo.innerHTML = `File: ${file.name}<br>Size: ${size} MB`;
  fileInfo.style.display = "block";

  showStatus("Audio loaded. Ready to play.", "success");
});

audioPlayer.addEventListener("play", () => {
  showStatus("Playing...", "success");
});

audioPlayer.addEventListener("pause", () => {
  showStatus("Paused", "");
});

audioPlayer.addEventListener("ended", () => {
  showStatus("Playback finished", "");
});

function showStatus(message, type) {
  statusText.textContent = message;
  statusText.className = "status";

  if (type) {
    statusText.classList.add(type);
  }
}