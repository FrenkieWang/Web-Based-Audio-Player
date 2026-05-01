const audioInput = document.getElementById("audioInput");
const audioPlayer = document.getElementById("audioPlayer");
const fileInfo = document.getElementById("fileInfo");
const statusText = document.getElementById("status");

const waveCanvas = document.getElementById("waveCanvas");
const spectrumCanvas = document.getElementById("spectrumCanvas");

const waveCtx = waveCanvas.getContext("2d");
const spectrumCtx = spectrumCanvas.getContext("2d");

let currentAudioUrl = null;
let audioContext = null;
let analyser = null;
let source = null;
let animationId = null;

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

audioPlayer.addEventListener("play", async () => {
  setupAudioContext();
  await audioContext.resume();

  drawVisualisation();
  showStatus("Playing...", "success");
});

audioPlayer.addEventListener("pause", () => {
  showStatus("Paused", "");
});

audioPlayer.addEventListener("ended", () => {
  showStatus("Playback finished", "");
  cancelAnimationFrame(animationId);
});

/* audio visualisation */
function setupAudioContext() {
  if (audioContext) return;

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();

  analyser.fftSize = 2048;

  source = audioContext.createMediaElementSource(audioPlayer);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
}

function drawVisualisation() {
  animationId = requestAnimationFrame(drawVisualisation);

  drawWaveform();
  drawSpectrum();
}

function resizeCanvas(canvas) {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

function drawWaveform() {
  resizeCanvas(waveCanvas);

  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  analyser.getByteTimeDomainData(dataArray);

  waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  waveCtx.lineWidth = 3;
  waveCtx.strokeStyle = "#22c55e";
  waveCtx.beginPath();

  const sliceWidth = waveCanvas.width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * waveCanvas.height) / 2;

    if (i === 0) {
      waveCtx.moveTo(x, y);
    } else {
      waveCtx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  waveCtx.stroke();
}

function drawSpectrum() {
  resizeCanvas(spectrumCanvas);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  analyser.getByteFrequencyData(dataArray);

  spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);

  const barWidth = (spectrumCanvas.width / bufferLength) * 2.5;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * spectrumCanvas.height;

    spectrumCtx.fillStyle = "#3b82f6";
    spectrumCtx.fillRect(
      x,
      spectrumCanvas.height - barHeight,
      barWidth,
      barHeight
    );

    x += barWidth + 1;
  }
}

function showStatus(message, type) {
  statusText.textContent = message;
  statusText.className = "status";

  if (type) {
    statusText.classList.add(type);
  }
}