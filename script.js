const audioInput = document.getElementById("audioInput");
const audioPlayer = document.getElementById("audioPlayer");
const fileInfo = document.getElementById("fileInfo");
const statusText = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const stopBtn = document.getElementById("stopBtn");
const downloadBtn = document.getElementById("downloadBtn");

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

let enabledEffects = {};
let lfoNodes = [];
let isResetting = false;


let audioArrayBuffer = null;

// Default values for all filters and effects
const defaultValues = {
  // Filters
  lowPass: { freq: 1000 },
  highPass: { freq: 800 },
  bandPass: { freq: 1500, q: 5 },
  notch: { freq: 1000, q: 0.1 },
  lowShelf: { freq: 500, gain: 0 },
  highShelf: { freq: 5000, gain: 0 },
  peaking: { freq: 2000, gain: 0, q: 5 },
  allPass: { freq: 2000, q: 5 },
  // Effects
  pan: 0,
  delay: 0.3,
  reverb: 0.4,
  distortion: 300,
  compressor: -24,
  phaser: 1,
  flanger: 0.5,
  chorus: 1.5,
  tremolo: 5,
  vibrato: 5
};

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
  notch: {
    type: "notch",
    button: document.getElementById("notchBtn"),
    freq: document.getElementById("notchFreq"),
    value: document.getElementById("notchValue"),
    q: document.getElementById("notchQ"),
    qValue: document.getElementById("notchQValue")
  },
  lowShelf: {
    type: "lowshelf",
    button: document.getElementById("lowShelfBtn"),
    freq: document.getElementById("lowShelfFreq"),
    value: document.getElementById("lowShelfValue"),
    gain: document.getElementById("lowShelfGain"),
    gainValue: document.getElementById("lowShelfGainValue")
  },

  highShelf: {
    type: "highshelf",
    button: document.getElementById("highShelfBtn"),
    freq: document.getElementById("highShelfFreq"),
    value: document.getElementById("highShelfValue"),
    gain: document.getElementById("highShelfGain"),
    gainValue: document.getElementById("highShelfGainValue")
  },

  peaking: {
    type: "peaking",
    button: document.getElementById("peakingBtn"),
    freq: document.getElementById("peakingFreq"),
    value: document.getElementById("peakingValue"),
    gain: document.getElementById("peakingGain"),
    gainValue: document.getElementById("peakingGainValue"),
    q: document.getElementById("peakingQ"),
    qValue: document.getElementById("peakingQValue")
  },

  allPass: {
    type: "allpass",
    button: document.getElementById("allPassBtn"),
    freq: document.getElementById("allPassFreq"),
    value: document.getElementById("allPassValue"),
    q: document.getElementById("allPassQ"),
    qValue: document.getElementById("allPassQValue")
  }
};

const effects = {
  pan: {
    btn: document.getElementById("panBtn"),
    input: document.getElementById("panValue"),
    text: document.getElementById("panText")
  },
  delay: {
    btn: document.getElementById("delayBtn"),
    input: document.getElementById("delayTime"),
    text: document.getElementById("delayText")
  },
  reverb: {
    btn: document.getElementById("reverbBtn"),
    input: document.getElementById("reverbMix"),
    text: document.getElementById("reverbText")
  },
  distortion: {
    btn: document.getElementById("distortionBtn"),
    input: document.getElementById("distortionAmount"),
    text: document.getElementById("distortionText")
  },
  compressor: {
    btn: document.getElementById("compressorBtn"),
    input: document.getElementById("compressorThreshold"),
    text: document.getElementById("compressorText")
  },
  phaser: {
    btn: document.getElementById("phaserBtn"),
    input: document.getElementById("phaserRate"),
    text: document.getElementById("phaserText")
  },
  flanger: {
    btn: document.getElementById("flangerBtn"),
    input: document.getElementById("flangerRate"),
    text: document.getElementById("flangerText")
  },
  chorus: {
    btn: document.getElementById("chorusBtn"),
    input: document.getElementById("chorusRate"),
    text: document.getElementById("chorusText")
  },
  tremolo: {
    btn: document.getElementById("tremoloBtn"),
    input: document.getElementById("tremoloRate"),
    text: document.getElementById("tremoloText")
  },
  vibrato: {
    btn: document.getElementById("vibratoBtn"),
    input: document.getElementById("vibratoRate"),
    text: document.getElementById("vibratoText")
  }
};

Object.keys(effects).forEach((name) => {
  const effect = effects[name];

  effect.input.addEventListener("input", () => {
    let value = effect.input.value;

    if (name === "delay") effect.text.textContent = `${value}s`;
    else if (name === "compressor") effect.text.textContent = `${value} dB`;
    else if (
      name === "phaser" ||
      name === "flanger" ||
      name === "chorus" ||
      name === "tremolo" ||
      name === "vibrato"
    ) effect.text.textContent = `${value} Hz`;
    else effect.text.textContent = value;

    if (audioContext) {
      rebuildAudioGraph();
    }
  });

  effect.btn.addEventListener("click", () => {
    setupAudioContext();

    enabledEffects[name] = !enabledEffects[name];

    effect.btn.textContent = enabledEffects[name] ? "Cancel" : "Apply";
    effect.btn.classList.toggle("active", enabledEffects[name]);

    rebuildAudioGraph();
  });
});

audioInput.addEventListener("change", async function () {
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
  audioArrayBuffer = await file.arrayBuffer();
  downloadBtn.disabled = false;
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

  stopBtn.disabled = false;

  drawVisualisation();
  showStatus("Playing...", "success");
});

audioPlayer.addEventListener("pause", () => {
  if (isResetting) return;

  showStatus("Paused", "");
});

audioPlayer.addEventListener("ended", () => {
  showStatus("Playback finished", "");
  cancelAnimationFrame(animationId);
});

// Apply filters: low-pass, high-pass, band-pass, notch
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

  if (filter.gain) {
    filter.gain.addEventListener("input", () => {
      filter.gainValue.textContent = `${filter.gain.value} dB`;

      if (activeFilterName === key && activeFilter) {
        activeFilter.gain.value = Number(filter.gain.value);
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

  rebuildAudioGraph();
}


function applyFilter(key) {
  const filterConfig = filters[key];

  if (activeFilter) {
    activeFilter.disconnect();
  }

  activeFilter = audioContext.createBiquadFilter();
  activeFilter.type = filterConfig.type;
  activeFilter.frequency.value = Number(filterConfig.freq.value);

  if (filterConfig.q) {
    activeFilter.Q.value = Number(filterConfig.q.value);
  }

  if (filterConfig.gain) {
    activeFilter.gain.value = Number(filterConfig.gain.value);
  }

  activeFilterName = key;
  updateFilterButtons();
  rebuildAudioGraph();

  showStatus(`${key} filter applied.`, "success");
}

function removeFilter(updateButtons = true) {
  if (!audioContext || !source || !analyser) return;

  if (activeFilter) {
    activeFilter.disconnect();
    activeFilter = null;
  }

  activeFilterName = null;

  rebuildAudioGraph();

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

function rebuildAudioGraph() {
  if (!audioContext || !source || !analyser) return;

  stopLFOs();

  try { source.disconnect(); } catch (e) {}
  try { analyser.disconnect(); } catch (e) {}

  let currentNode = source;

  if (activeFilter) {
    try { activeFilter.disconnect(); } catch (e) {}
    currentNode.connect(activeFilter);
    currentNode = activeFilter;
  }

  currentNode = applyEffects(currentNode);

  currentNode.connect(analyser);
  analyser.connect(audioContext.destination);
}

function stopLFOs() {
  lfoNodes.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) {}
  });

  lfoNodes = [];
}

function applyEffects(inputNode) {
  let node = inputNode;

  if (enabledEffects.pan) {
    const pan = audioContext.createStereoPanner();
    pan.pan.value = Number(effects.pan.input.value);
    node.connect(pan);
    node = pan;
  }

  if (enabledEffects.delay) {
    const delay = audioContext.createDelay();
    const feedback = audioContext.createGain();

    delay.delayTime.value = Number(effects.delay.input.value);
    feedback.gain.value = 0.35;

    node.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);

    node = mixDryWet(node, delay, 0.45);
  }

  if (enabledEffects.reverb) {
    const convolver = audioContext.createConvolver();
    convolver.buffer = createReverbImpulse();

    node.connect(convolver);

    node = mixDryWet(node, convolver, Number(effects.reverb.input.value));
  }

  if (enabledEffects.distortion) {
    const distortion = audioContext.createWaveShaper();
    distortion.curve = makeDistortionCurve(
      Number(effects.distortion.input.value)
    );
    distortion.oversample = "4x";

    node.connect(distortion);
    node = distortion;
  }

  if (enabledEffects.compressor) {
    const compressor = audioContext.createDynamicsCompressor();

    compressor.threshold.value = Number(effects.compressor.input.value);
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    node.connect(compressor);
    node = compressor;
  }

  if (enabledEffects.phaser) {
    const allpass = audioContext.createBiquadFilter();
    allpass.type = "allpass";
    allpass.frequency.value = 1000;
    allpass.Q.value = 1;

    const lfo = audioContext.createOscillator();
    const depth = audioContext.createGain();

    lfo.frequency.value = Number(effects.phaser.input.value);
    depth.gain.value = 700;

    lfo.connect(depth);
    depth.connect(allpass.frequency);
    lfo.start();

    lfoNodes.push(lfo);

    node.connect(allpass);
    node = mixDryWet(node, allpass, 0.5);
  }

  if (enabledEffects.flanger) {
    const delay = audioContext.createDelay();
    delay.delayTime.value = 0.005;

    const lfo = audioContext.createOscillator();
    const depth = audioContext.createGain();

    lfo.frequency.value = Number(effects.flanger.input.value);
    depth.gain.value = 0.004;

    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start();

    lfoNodes.push(lfo);

    node.connect(delay);
    node = mixDryWet(node, delay, 0.5);
  }

  if (enabledEffects.chorus) {
    const delay = audioContext.createDelay();
    delay.delayTime.value = 0.025;

    const lfo = audioContext.createOscillator();
    const depth = audioContext.createGain();

    lfo.frequency.value = Number(effects.chorus.input.value);
    depth.gain.value = 0.01;

    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start();

    lfoNodes.push(lfo);

    node.connect(delay);
    node = mixDryWet(node, delay, 0.45);
  }

  if (enabledEffects.tremolo) {
    const tremoloGain = audioContext.createGain();
    tremoloGain.gain.value = 0.7;

    const lfo = audioContext.createOscillator();
    const depth = audioContext.createGain();

    lfo.frequency.value = Number(effects.tremolo.input.value);
    depth.gain.value = 0.4;

    lfo.connect(depth);
    depth.connect(tremoloGain.gain);
    lfo.start();

    lfoNodes.push(lfo);

    node.connect(tremoloGain);
    node = tremoloGain;
  }

  if (enabledEffects.vibrato) {
    const delay = audioContext.createDelay();
    delay.delayTime.value = 0.01;

    const lfo = audioContext.createOscillator();
    const depth = audioContext.createGain();

    lfo.frequency.value = Number(effects.vibrato.input.value);
    depth.gain.value = 0.006;

    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start();

    lfoNodes.push(lfo);

    node.connect(delay);
    node = delay;
  }

  return node;
}

function mixDryWet(dryInput, wetInput, wetAmount) {
  const output = audioContext.createGain();
  const dryGain = audioContext.createGain();
  const wetGain = audioContext.createGain();

  dryGain.gain.value = 1 - wetAmount;
  wetGain.gain.value = wetAmount;

  dryInput.connect(dryGain);
  wetInput.connect(wetGain);

  dryGain.connect(output);
  wetGain.connect(output);

  return output;
}

function makeDistortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] =
      ((3 + amount) * x * 20 * deg) /
      (Math.PI + amount * Math.abs(x));
  }

  return curve;
}

function createReverbImpulse() {
  const length = audioContext.sampleRate * 2;
  const impulse = audioContext.createBuffer(
    2,
    length,
    audioContext.sampleRate
  );

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
  }

  return impulse;
}

// reset button
resetBtn.addEventListener("click", () => {
  isResetting = true;

  // Keep music playing, don't pause or reset position
  // audioPlayer.pause();  // Removed - keep playing
  // audioPlayer.currentTime = 0;  // Removed - keep current position

  activeFilterName = null;

  if (activeFilter) {
    activeFilter.disconnect();
    activeFilter = null;
  }

  enabledEffects = {};

  stopLFOs();
  updateFilterButtons();
  updateEffectButtons();
  resetSliderValues(); // Reset all slider values to default

  if (audioContext) {
    rebuildAudioGraph();
  }

  cancelAnimationFrame(animationId);
  clearCanvas(waveCanvas, waveCtx);
  clearCanvas(spectrumCanvas, spectrumCtx);

  showStatus("Reset complete. Filters and effects cleared.", "");

  setTimeout(() => {
    isResetting = false;
  }, 0);
});

// Stop button - stops music and resets to initial state
stopBtn.addEventListener("click", () => {
  isResetting = true;

  // Stop the music
  audioPlayer.pause();
  audioPlayer.currentTime = 0;

  activeFilterName = null;

  if (activeFilter) {
    activeFilter.disconnect();
    activeFilter = null;
  }

  enabledEffects = {};

  stopLFOs();
  updateFilterButtons();
  updateEffectButtons();
  resetSliderValues(); // Reset all slider values to default

  if (audioContext) {
    rebuildAudioGraph();
  }

  cancelAnimationFrame(animationId);
  clearCanvas(waveCanvas, waveCtx);
  clearCanvas(spectrumCanvas, spectrumCtx);

  stopBtn.disabled = true;

  showStatus("Stopped. Audio reset to beginning.", "");

  setTimeout(() => {
    isResetting = false;
  }, 0);
});

// Function to reset all slider values to default
function resetSliderValues() {
  // Reset filter sliders
  filters.lowPass.freq.value = defaultValues.lowPass.freq;
  filters.lowPass.value.textContent = defaultValues.lowPass.freq + " Hz";

  filters.highPass.freq.value = defaultValues.highPass.freq;
  filters.highPass.value.textContent = defaultValues.highPass.freq + " Hz";

  filters.bandPass.freq.value = defaultValues.bandPass.freq;
  filters.bandPass.value.textContent = defaultValues.bandPass.freq + " Hz";
  filters.bandPass.q.value = defaultValues.bandPass.q;
  filters.bandPass.qValue.textContent = defaultValues.bandPass.q;

  filters.notch.freq.value = defaultValues.notch.freq;
  filters.notch.value.textContent = defaultValues.notch.freq + " Hz";
  filters.notch.q.value = defaultValues.notch.q;
  filters.notch.qValue.textContent = defaultValues.notch.q;

  filters.lowShelf.freq.value = defaultValues.lowShelf.freq;
  filters.lowShelf.value.textContent = defaultValues.lowShelf.freq + " Hz";
  filters.lowShelf.gain.value = defaultValues.lowShelf.gain;
  filters.lowShelf.gainValue.textContent = defaultValues.lowShelf.gain + " dB";

  filters.highShelf.freq.value = defaultValues.highShelf.freq;
  filters.highShelf.value.textContent = defaultValues.highShelf.freq + " Hz";
  filters.highShelf.gain.value = defaultValues.highShelf.gain;
  filters.highShelf.gainValue.textContent = defaultValues.highShelf.gain + " dB";

  filters.peaking.freq.value = defaultValues.peaking.freq;
  filters.peaking.value.textContent = defaultValues.peaking.freq + " Hz";
  filters.peaking.gain.value = defaultValues.peaking.gain;
  filters.peaking.gainValue.textContent = defaultValues.peaking.gain + " dB";
  filters.peaking.q.value = defaultValues.peaking.q;
  filters.peaking.qValue.textContent = defaultValues.peaking.q;

  filters.allPass.freq.value = defaultValues.allPass.freq;
  filters.allPass.value.textContent = defaultValues.allPass.freq + " Hz";
  filters.allPass.q.value = defaultValues.allPass.q;
  filters.allPass.qValue.textContent = defaultValues.allPass.q;

  // Reset effect sliders
  effects.pan.input.value = defaultValues.pan;
  effects.pan.text.textContent = defaultValues.pan;

  effects.delay.input.value = defaultValues.delay;
  effects.delay.text.textContent = defaultValues.delay + "s";

  effects.reverb.input.value = defaultValues.reverb;
  effects.reverb.text.textContent = defaultValues.reverb;

  effects.distortion.input.value = defaultValues.distortion;
  effects.distortion.text.textContent = defaultValues.distortion;

  effects.compressor.input.value = defaultValues.compressor;
  effects.compressor.text.textContent = defaultValues.compressor + " dB";

  effects.phaser.input.value = defaultValues.phaser;
  effects.phaser.text.textContent = defaultValues.phaser + " Hz";

  effects.flanger.input.value = defaultValues.flanger;
  effects.flanger.text.textContent = defaultValues.flanger + " Hz";

  effects.chorus.input.value = defaultValues.chorus;
  effects.chorus.text.textContent = defaultValues.chorus + " Hz";

  effects.tremolo.input.value = defaultValues.tremolo;
  effects.tremolo.text.textContent = defaultValues.tremolo + " Hz";

  effects.vibrato.input.value = defaultValues.vibrato;
  effects.vibrato.text.textContent = defaultValues.vibrato + " Hz";
}

function updateEffectButtons() {
  Object.keys(effects).forEach((name) => {
    const button = effects[name].btn;
    button.textContent = "Apply";
    button.classList.remove("active");
  });
}

function clearCanvas(canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// download button
downloadBtn.addEventListener("click", async () => {
  if (!audioArrayBuffer) {
    showStatus("No audio file to export.", "error");
    return;
  }

  showStatus("Rendering processed audio...", "success");

  try {
    const processedBuffer = await renderProcessedAudio();
    const wavBlob = audioBufferToWav(processedBuffer);

    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "processed-audio.wav";
    a.click();

    URL.revokeObjectURL(url);

    showStatus("Processed audio downloaded.", "success");
  } catch (error) {
    console.error(error);
    showStatus("Failed to export processed audio.", "error");
  }
});

async function renderProcessedAudio() {
  const arrayBufferCopy = audioArrayBuffer.slice(0);

  const tempContext = new AudioContext();
  const decodedBuffer = await tempContext.decodeAudioData(arrayBufferCopy);
  await tempContext.close();

  const offlineContext = new OfflineAudioContext(
    decodedBuffer.numberOfChannels,
    decodedBuffer.length,
    decodedBuffer.sampleRate
  );

  const sourceNode = offlineContext.createBufferSource();
  sourceNode.buffer = decodedBuffer;

  let currentNode = sourceNode;

  if (activeFilterName) {
    const filterConfig = filters[activeFilterName];

    const offlineFilter = offlineContext.createBiquadFilter();
    offlineFilter.type = filterConfig.type;
    offlineFilter.frequency.value = Number(filterConfig.freq.value);

    if (filterConfig.q) {
      offlineFilter.Q.value = Number(filterConfig.q.value);
    }

    if (filterConfig.gain) {
      offlineFilter.gain.value = Number(filterConfig.gain.value);
    }

    currentNode.connect(offlineFilter);
    currentNode = offlineFilter;
  }

  currentNode = applyOfflineEffects(currentNode, offlineContext);

  currentNode.connect(offlineContext.destination);

  sourceNode.start(0);

  return await offlineContext.startRendering();
}

function applyOfflineEffects(inputNode, context) {
  let node = inputNode;

  if (enabledEffects.pan) {
    const pan = context.createStereoPanner();
    pan.pan.value = Number(effects.pan.input.value);
    node.connect(pan);
    node = pan;
  }

  if (enabledEffects.delay) {
    const delay = context.createDelay();
    const feedback = context.createGain();

    delay.delayTime.value = Number(effects.delay.input.value);
    feedback.gain.value = 0.35;

    node.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);

    node = offlineMixDryWet(node, delay, 0.45, context);
  }

  if (enabledEffects.reverb) {
    const convolver = context.createConvolver();
    convolver.buffer = createOfflineReverbImpulse(context);

    node.connect(convolver);

    node = offlineMixDryWet(
      node,
      convolver,
      Number(effects.reverb.input.value),
      context
    );
  }

  if (enabledEffects.distortion) {
    const distortion = context.createWaveShaper();

    distortion.curve = makeDistortionCurve(
      Number(effects.distortion.input.value)
    );
    distortion.oversample = "4x";

    node.connect(distortion);
    node = distortion;
  }

  if (enabledEffects.compressor) {
    const compressor = context.createDynamicsCompressor();

    compressor.threshold.value = Number(effects.compressor.input.value);
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    node.connect(compressor);
    node = compressor;
  }

  if (enabledEffects.phaser) {
    const allpass = context.createBiquadFilter();
    allpass.type = "allpass";
    allpass.frequency.value = 1000;
    allpass.Q.value = 1;

    const lfo = context.createOscillator();
    const depth = context.createGain();

    lfo.frequency.value = Number(effects.phaser.input.value);
    depth.gain.value = 700;

    lfo.connect(depth);
    depth.connect(allpass.frequency);
    lfo.start(0);

    node.connect(allpass);
    node = offlineMixDryWet(node, allpass, 0.5, context);
  }

  if (enabledEffects.flanger) {
    const delay = context.createDelay();
    delay.delayTime.value = 0.005;

    const lfo = context.createOscillator();
    const depth = context.createGain();

    lfo.frequency.value = Number(effects.flanger.input.value);
    depth.gain.value = 0.004;

    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start(0);

    node.connect(delay);
    node = offlineMixDryWet(node, delay, 0.5, context);
  }

  if (enabledEffects.chorus) {
    const delay = context.createDelay();
    delay.delayTime.value = 0.025;

    const lfo = context.createOscillator();
    const depth = context.createGain();

    lfo.frequency.value = Number(effects.chorus.input.value);
    depth.gain.value = 0.01;

    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start(0);

    node.connect(delay);
    node = offlineMixDryWet(node, delay, 0.45, context);
  }

  if (enabledEffects.tremolo) {
    const tremoloGain = context.createGain();
    tremoloGain.gain.value = 0.7;

    const lfo = context.createOscillator();
    const depth = context.createGain();

    lfo.frequency.value = Number(effects.tremolo.input.value);
    depth.gain.value = 0.4;

    lfo.connect(depth);
    depth.connect(tremoloGain.gain);
    lfo.start(0);

    node.connect(tremoloGain);
    node = tremoloGain;
  }

  if (enabledEffects.vibrato) {
    const delay = context.createDelay();
    delay.delayTime.value = 0.01;

    const lfo = context.createOscillator();
    const depth = context.createGain();

    lfo.frequency.value = Number(effects.vibrato.input.value);
    depth.gain.value = 0.006;

    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start(0);

    node.connect(delay);
    node = delay;
  }

  return node;
}

function offlineMixDryWet(dryInput, wetInput, wetAmount, context) {
  const output = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();

  dryGain.gain.value = 1 - wetAmount;
  wetGain.gain.value = wetAmount;

  dryInput.connect(dryGain);
  wetInput.connect(wetGain);

  dryGain.connect(output);
  wetGain.connect(output);

  return output;
}

function createOfflineReverbImpulse(context) {
  const length = context.sampleRate * 2;
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      data[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - i / length, 2);
    }
  }

  return impulse;
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;

  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, "data");
  view.setUint32(40, length - 44, true);

  let offset = 44;

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, buffer.getChannelData(channel)[i])
      );

      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );

      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}