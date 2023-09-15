const config = {
  audioFiles: [
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/00.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/01.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/02.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/03.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/04.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/05.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/06.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/07.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/08.wav",
    "https://cdn.jsdelivr.net/gh/AnodeGrindYo/reposForSomeOfMyMusic/amenbreak_parts/09.wav"
  ],
  pattern: ["0", "3", "9", "0", "2", "1", "7", "9", "1", "2"],
  strongBeatsIndices: [0, 2, 4, 6],
  beatsPerMinute: 240,
  visual: {
    sphereRadius: 50,
    rotationSpeed: 0.005
  }
};

const colors = [
  0xff0000, // Red for 00.wav
  0xff7f00, // Orange for 01.wav
  0xffff00, // Yellow for 02.wav
  0x7fff00, // Lime for 03.wav
  0x00ff00, // Green for 04.wav
  0x00ff7f, // Spring Green for 05.wav
  0x00ffff, // Cyan for 06.wav
  0x007fff, // Azure for 07.wav
  0x0000ff, // Blue for 08.wav
  0x7f00ff // Violet for 09.wav
];

class AudioManager {
  constructor(config) {
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.audioElements = config.audioFiles.map((url) => {
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      const source = this.audioContext.createMediaElementSource(audio);
      source.connect(this.audioContext.destination);
      return {
        audio: audio,
        source: source
      };
    });
    this.currentAudio = null;
    this.pattern = config.pattern;
    this.strongBeatsIndices = config.strongBeatsIndices;
    this.strongBeats = this.strongBeatsIndices.map(
      (index) => this.pattern[index]
    );
    this.beatsPerMinute = config.beatsPerMinute;
    this.eventListeners = {};
    this.gains = new Array(config.audioFiles.length).fill(1);
    
  }

  on(event, listener) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  off(event, listener) {
    if (!this.eventListeners[event]) return;
    const index = this.eventListeners[event].indexOf(listener);
    if (index !== -1) {
      this.eventListeners[event].splice(index, 1);
    }
  }

  emit(event, ...args) {
    if (!this.eventListeners[event]) return;
    for (const listener of this.eventListeners[event]) {
      listener(...args);
    }
  }

  getNextSample(currentIndex) {
    if (this.strongBeatsIndices.includes(currentIndex)) {
      const randomStrongBeat = this.strongBeats[
        Math.floor(Math.random() * this.strongBeats.length)
      ];
      return this.audioElements[randomStrongBeat];
    } else {
      return this.audioElements[
        Math.floor(Math.random() * this.audioElements.length)
      ];
    }
  }
  
  playPattern() {
    if (this.currentAudio) {
      this.currentAudio.audio.pause();
      this.currentAudio.audio.currentTime = 0;
    }

    this.currentAudio = this.getNextSample(this.patternIndex);

    const color = colors[this.pattern[this.patternIndex]];
    this.emit("colorChange", color);

    this.currentAudio.source.connect(this.audioContext.destination); // Connecte la source à la destination
    this.currentAudio.audio.play();

    const durationOfEighthNote = ((60 / this.beatsPerMinute) * 4) / 8; // Durée en secondes
    setTimeout(() => {
      this.patternIndex = (this.patternIndex + 1) % this.pattern.length;
      this.playPattern();
    }, durationOfEighthNote * 1000); // Convertir en millisecondes pour setTimeout
  }

  start() {
    this.patternIndex = 0;
    this.playPattern();
  }

  getCurrentAudioSource() {
    return this.currentAudio ? this.currentAudio.source : null;
  }
}

class AudioVisualizer {
  constructor(config) {
    this.audioManager = new AudioManager(config);
    this.audioManager.on('colorChange', this.changeSphereColor.bind(this));

    // Initialisation de la scène Three.js
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // Création de la sphère
    const adjustedSphereRadius = window.innerHeight < 600 ? config.visual.sphereRadius / 2 : config.visual.sphereRadius;
    this.geometry = new THREE.SphereGeometry(
      adjustedSphereRadius,
      32,
      32
    );
    this.material = new THREE.MeshBasicMaterial({ wireframe: true });
    this.sphere = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.sphere);

    // Positionnement de la caméra
    // this.camera.position.z = window.innerHeight < 600 ? 150 : 100;
    this.camera.position.z = 100;

    // Initialisation de l'analyseur audio
    this.analyser = this.audioManager.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    // Copie des sommets originaux de la sphère pour la déformation
    this.originalVertices = Array.from(this.geometry.attributes.position.array);

    // Gestionnaire d'événement pour le redimensionnement de la fenêtre
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    this.createWaveform();
    
    this.basePosition = { x: 0, y: 0, z: 0 };
    this.movementIntensity = 10;
    this.beatDuration = ((60 / config.beatsPerMinute) * 4) / 8;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  getAverageVolume(dataArray) {
    const sum = dataArray.reduce((a, b) => a + b, 0);
    return sum / dataArray.length;
  }
  
  changeSphereColor(color) {
    this.material.color.setHex(color);
  }
  
  createWaveform() {
    const segments = 256; // Correspond à analyser.fftSize
    const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight, segments, 1);
    const material = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true});
  }
  

  animate() {
    requestAnimationFrame(this.animate.bind(this)); // Demande une mise à jour de l'animation

    this.analyser.getByteFrequencyData(this.dataArray); // Récupère les fréquences actuelles du son

    // Détection du son de la grosse caisse (plage de fréquences plus basses)
    const bassKickValue = this.dataArray.slice(0, 20).reduce((a, b) => a + b) / 20;
    const snareValue = this.dataArray.slice(20, 40).reduce((a, b) => a + b) / 20;

    const bassKickFactor = 1 + bassKickValue / 255; // Normalisé entre 1 et 2
    const snareFactor = 1 + snareValue / 255; // Normalisé entre 1 et 2

    const vertices = this.geometry.attributes.position.array;
    const centerIndex = Math.floor(vertices.length / 6); // Index central de la sphère

    for (let i = 0; i < centerIndex; i++) {
        if (i < centerIndex / 2) {
            // Déformation pour la caisse claire
            const factor = snareFactor;
            vertices[(centerIndex + i) * 3] = this.originalVertices[(centerIndex + i) * 3] * factor;
            vertices[(centerIndex + i) * 3 + 1] = this.originalVertices[(centerIndex + i) * 3 + 1] * factor;
            vertices[(centerIndex + i) * 3 + 2] = this.originalVertices[(centerIndex + i) * 3 + 2] * factor;

            vertices[(centerIndex - i) * 3] = this.originalVertices[(centerIndex - i) * 3] * factor;
            vertices[(centerIndex - i) * 3 + 1] = this.originalVertices[(centerIndex - i) * 3 + 1] * factor;
            vertices[(centerIndex - i) * 3 + 2] = this.originalVertices[(centerIndex - i) * 3 + 2] * factor;
        } else {
            // Détection de la grosse caisse et déformation
            if (bassKickValue > 200) {
                const factor = bassKickFactor;
                vertices[i * 3] = this.originalVertices[i * 3] * factor;
                vertices[i * 3 + 1] = this.originalVertices[i * 3 + 1] * factor;
                vertices[i * 3 + 2] = this.originalVertices[i * 3 + 2] * factor;
            } else {
                vertices[i * 3] = this.originalVertices[i * 3];
                vertices[i * 3 + 1] = this.originalVertices[i * 3 + 1];
                vertices[i * 3 + 2] = this.originalVertices[i * 3 + 2];
            }
        }
    }

    // Informer Three.js que la géométrie a été mise à jour
    this.geometry.attributes.position.needsUpdate = true;

    // Appliquer une rotation à la sphère pour la faire tourner
    this.sphere.rotation.y += config.visual.rotationSpeed;
    
    // met à jour la forme d'ondes
    // this.updateWaveform();
    
    const elapsedTime = this.audioManager.audioContext.currentTime;
  
  if (Math.floor(elapsedTime % this.beatDuration) === 0) { // Si nous sommes sur un battement
    this.sphere.position.x = this.basePosition.x + Math.random() * this.movementIntensity - this.movementIntensity / 2;
    this.sphere.position.y = this.basePosition.y + Math.random() * this.movementIntensity - this.movementIntensity / 2;
    this.sphere.position.z = this.basePosition.z + Math.random() * this.movementIntensity - this.movementIntensity / 2;
  } else {
    // Pour que la sphère revienne à sa forme initiale
    this.sphere.position.x = this.basePosition.x;
    this.sphere.position.y = this.basePosition.y;
    this.sphere.position.z = this.basePosition.z;
  }

    // Rendre la scène graphique avec les changements
    this.renderer.render(this.scene, this.camera);
}


  start() {
    this.audioManager.start();
    const currentAudioSource = this.audioManager.getCurrentAudioSource();
    if (currentAudioSource) {
      currentAudioSource.connect(this.analyser);
      this.analyser.connect(this.audioManager.audioContext.destination);
    }
    this.animate();
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const visualizer = new AudioVisualizer(config);

  const startExperience = () => {
    const startMessage = document.getElementById("startMessage");
    startMessage.style.opacity = "0";
    document.documentElement.requestFullscreen();
    visualizer.audioManager.audioContext.resume().then(() => {
      visualizer.start();
    });
    document.removeEventListener("click", startExperience);
  };

  document.addEventListener("click", startExperience);
});


document.addEventListener("click", function() {
  let startMessageElement = document.querySelector("#startMessage");
  if (startMessageElement) {
    startMessageElement.style.display = "none";
  }
});