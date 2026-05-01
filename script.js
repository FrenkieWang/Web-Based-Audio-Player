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
let activeFilter = null;
let activeFilterName = null;
let animationId = null;

const filters = {
  lowPass: {
    type: "lowpass",
    button: document.getElementById("lowPassBtn"),
    freq: document.getElementById("lowPassFreq"),
    value: document.getElementById("lowPassValue")
  },
  highPass: {
    type: "highpass",
    button: document.getElementById("highPassBtn"),
    freq: document.getElementById("highPassFreq"),
    value: document.getElementById("highPassValue")
  },
  bandPass: {
    type: "bandpass",
    button: document.getElementById("bandPassBtn"),
    freq: document.getElementById("bandPassFreq"),
    value: document.getElementById("bandPassValue"),
    q: document.getElementById("bandPassQ"),
    qValue: document.getElementById("bandPassQValue")
  },
  bandStop: {
    type: "notch",
    button: document.getElementById("bandStopBtn"),
    freq: document.getElementById("bandStopFreq"),
    value: document.getElementById("bandStopValue"),
    q: document.getElementById("bandStopQ"),
    qValue: document.getElementById("bandStopQValue")
  }
};

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

  showStatus("Audio loaded. Click play to start.", "success");
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

// Apply filters: low-pass, high-pass, band-pass, band-stop
Object.keys(filters).forEach((key) => {
  const filter = filters[key];

  filter.freq.addEventListener("input", () => {
    filter.value.textContent = `${filter.freq.value} Hz`;

    if (activeFilterName === key && activeFilter) {
      activeFilter.frequency.value = Number(filter.freq.value);
    }
  });

  if (filter.q) {
    filter.q.addEventListener("input", () => {
      filter.qValue.textContent = filter.q.value;

      if (activeFilterName === key && activeFilter) {
        activeFilter.Q.value = Number(filter.q.value);
      }
    });
  }

  filter.button.addEventListener("click", () => {
    setupAudioContext();

    if (activeFilterName === key) {
      removeFilter();
    } else {
      applyFilter(key);
    }
  });
});

function setupAudioContext() {
  if (audioContext) return;

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  source = audioContext.createMediaElementSource(audioPlayer);

  connectWithoutFilter();
}

function connectWithoutFilter() {
  source.disconnect();
  analyser.disconnect();

  source.connect(analyser);
  analyser.connect(audioContext.destination);
}

function applyFilter(key) {
  const filterConfig = filters[key];

  removeFilter(false);

  activeFilter = audioContext.createBiquadFilter();
  activeFilter.type = filterConfig.type;
  activeFilter.frequency.value = Number(filterConfig.freq.value);

  if (filterConfig.q) {
    activeFilter.Q.value = Number(filterConfig.q.value);
  }

  source.disconnect();
  analyser.disconnect();

  source.connect(activeFilter);
  activeFilter.connect(analyser);
  analyser.connect(audioContext.destination);

  activeFilterName = key;
  updateFilterButtons();

  showStatus(`${key} filter applied.`, "success");
}

function removeFilter(updateButtons = true) {
  if (!audioContext || !source || !analyser) return;

  if (activeFilter) {
    activeFilter.disconnect();
    activeFilter = null;
  }

  activeFilterName = null;

  connectWithoutFilter();

  if (updateButtons) {
    updateFilterButtons();
    showStatus("Filter removed.", "");
  }
}

function updateFilterButtons() {
  Object.keys(filters).forEach((key) => {
    const button = filters[key].button;

    if (activeFilterName === key) {
      button.textContent = "Cancel";
      button.classList.add("active");
    } else {
      button.textContent = "Apply";
      button.classList.remove("active");
    }
  });
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