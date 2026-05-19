// --- MULTIPLE DOMAIN LOCK SECURE PROTOCOL ---
// Yahan SIRF domain name aayega (Bina https:// aur bina folder name ke)
const allowedDomains = [
    "abhishekrai07.github.io",  // Tera sahi GitHub domain
    "localhost", 
    "127.0.0.1"
];

const currentDomain = window.location.hostname;

if (!allowedDomains.includes(currentDomain) && currentDomain !== "") {
    
    document.body.innerHTML = `
        <div style="background-color: #000; width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #ff3366; font-family: monospace;">
            <h1 style="font-size: 40px;">⚠️ PIRATED COPY DETECTED ⚠️</h1>
            <p style="font-size: 20px; color: #fff;">This version of Phantom OS is stolen.</p>
            <p>Redirecting to the original secure gateway in 3 seconds...</p>
        </div>
    `;
    
    // Redirect karne ke liye tu yahan poora link daal sakta hai
    setTimeout(() => {
        window.location.href = "https://abhishekrai07.github.io/live-voice-chat/"; 
    }, 3000);
    
    throw new Error("Security Lock Triggered: Execution Stopped.");
}

// --- GLOBAL VARIABLES ---
let peer;
let localStream;
let audioCtx; 

let processedLocalStream;
let ghostDryGain, ghostWetGain;
let isGhostMode = false;

let myName = ""; 
let myRoomName = ""; 
let isMuted = false;

let handRaiseTimer = null;
let globalMuteStates = {}; 
let pendingRequests = {}; 

const secretPrefix = "phantom-os-v7-"; 
let maxLimit = 10; 
let isHost = false;
let connections = {}; 
let calls = {};       
let visualizerFrames = {}; 

// --- DOM ELEMENTS ---
const initScreen = document.getElementById('initScreen');
const enableMicBtn = document.getElementById('enableMicBtn');
const userNameInput = document.getElementById('userNameInput');
const errorMsg = document.getElementById('errorMsg');
const mainMenu = document.getElementById('mainMenu');
const welcomeUserText = document.getElementById('welcomeUserText');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomArea = document.getElementById('roomArea');
const roomContainer = document.querySelector('.container');
const roomNameDisplay = document.getElementById('roomNameDisplay');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const statusText = document.getElementById('statusText');
const participantList = document.getElementById('participantList');
const lobbyArea = document.getElementById('lobbyArea');
const lobbyList = document.getElementById('lobbyList');

const muteBtn = document.getElementById('muteBtn');
const ghostBtn = document.getElementById('ghostBtn');
const raiseHandBtn = document.getElementById('raiseHandBtn');
const endBtn = document.getElementById('endBtn');
const burnBtn = document.getElementById('burnBtn');

const audioContainer = document.getElementById('audioContainer');
const toastContainer = document.getElementById('toastContainer');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

// --- TAB SWITCH LOGIC ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
};

// --- UTILS ---
function showToast(message, isWarning = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    if (isWarning) toast.style.borderLeftColor = '#ff3366';
    toastContainer.appendChild(toast);
    setTimeout(() => { if (toast) toast.remove(); }, 4000);
}

function showModal(type, text, placeholder = "") {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customModalOverlay');
        const modalText = document.getElementById('modalText');
        const modalInput = document.getElementById('modalInput');
        const okBtn = document.getElementById('modalOkBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        modalText.innerText = text;
        overlay.style.display = 'flex';
        modalInput.value = "";
        
        if (type === 'alert') {
            modalInput.style.display = 'none'; cancelBtn.style.display = 'none';
            okBtn.onclick = () => { overlay.style.display = 'none'; resolve(true); };
        } else if (type === 'confirm') {
            modalInput.style.display = 'none'; cancelBtn.style.display = 'block';
            okBtn.onclick = () => { overlay.style.display = 'none'; resolve(true); };
            cancelBtn.onclick = () => { overlay.style.display = 'none'; resolve(false); };
        } else if (type === 'prompt') {
            modalInput.style.display = 'block'; modalInput.placeholder = placeholder; cancelBtn.style.display = 'block';
            modalInput.focus();
            okBtn.onclick = () => { overlay.style.display = 'none'; resolve(modalInput.value); };
            cancelBtn.onclick = () => { overlay.style.display = 'none'; resolve(null); };
        }
    });
}

function broadcastData(dataObj) {
    Object.values(connections).forEach(conn => {
        if (conn.open) conn.send(dataObj);
    });
}

// --- VISUALIZER LOGIC ---
function attachVisualizer(stream, canvasId) {
    if (!audioCtx) return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    try {
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        src.connect(analyser);
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const ctx = canvas.getContext('2d');
        function draw() {
            visualizerFrames[canvasId] = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#00ffcc';
            let barWidth = (canvas.width / bufferLength) * 2;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                let barHeight = (dataArray[i] / 255) * canvas.height;
                if(barHeight < 1) barHeight = 1; 
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        }
        draw();
    } catch (e) { console.log(e); }
}

function stopVisualizer(canvasId) {
    if (visualizerFrames[canvasId]) {
        cancelAnimationFrame(visualizerFrames[canvasId]);
        delete visualizerFrames[canvasId];
    }
}

// --- AUTHENTICATION & GHOST ENGINE SETUP ---
enableMicBtn.onclick = async () => {
    const enteredName = userNameInput.value.trim();
    if (enteredName === "") {
        errorMsg.style.display = 'block'; errorMsg.innerText = "⚠️ Identity required!";
        userNameInput.classList.add('input-error'); return; 
    }
    myName = enteredName;
    userNameInput.classList.remove('input-error'); errorMsg.style.display = 'none';
    enableMicBtn.innerText = "Requesting Mic...";
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const micSource = audioCtx.createMediaStreamSource(localStream);
        const ghostDest = audioCtx.createMediaStreamDestination();
        
        ghostDryGain = audioCtx.createGain();
        ghostWetGain = audioCtx.createGain();
        ghostDryGain.gain.value = 1; 
        ghostWetGain.gain.value = 0;

        const ringGain = audioCtx.createGain();
        ringGain.gain.value = 0; 
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60; 
        osc.start();

        micSource.connect(ghostDryGain);
        ghostDryGain.connect(ghostDest);

        micSource.connect(ringGain);
        osc.connect(ringGain.gain);
        ringGain.connect(ghostWetGain);
        ghostWetGain.connect(ghostDest);

        processedLocalStream = ghostDest.stream;

        initScreen.style.display = 'none'; mainMenu.style.display = 'flex';
        welcomeUserText.innerText = "Logged in as: " + myName; 
    } catch (error) {
        enableMicBtn.innerText = "Initialize Comm";
        errorMsg.style.display = 'block'; errorMsg.innerText = "Mic access denied.";
    }
};

// --- THE BURN PROTOCOL LOGIC ---
function triggerBurnSequence() {
    if (syncHeartbeat) clearInterval(syncHeartbeat);

    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'square';
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start();

    let isHigh = false;
    const beep = setInterval(() => {
        osc.frequency.value = isHigh ? 500 : 800;
        isHigh = !isHigh;
    }, 150);

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed'; overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100vw'; overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.4)'; overlay.style.zIndex = '99999';
    overlay.style.display = 'flex'; overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center';
    overlay.style.color = '#fff'; overlay.style.fontFamily = 'Courier New, monospace';
    overlay.style.animation = 'burnFlash 0.1s infinite alternate';
    
    const style = document.createElement('style');
    style.innerHTML = `@keyframes burnFlash { from { background-color: rgba(255, 0, 0, 0.3); transform: translate(-3px, 3px); } to { background-color: rgba(255, 0, 0, 0.8); transform: translate(3px, -3px); } }`;
    document.head.appendChild(style);

    const title = document.createElement('h1');
    title.innerText = "☢️ BURN PROTOCOL INITIATED ☢️";
    title.style.fontSize = "26px"; title.style.textAlign = "center";
    
    const timer = document.createElement('h2');
    timer.style.fontSize = "80px";
    
    overlay.appendChild(title); overlay.appendChild(timer);
    document.body.appendChild(overlay);

    let count = 3;
    timer.innerText = count;
    
    const countdown = setInterval(() => {
        count--; timer.innerText = count;
        if(count <= 0) {
            clearInterval(countdown); clearInterval(beep); osc.stop();
            document.body.innerHTML = "<div style='width:100vw; height:100vh; background:#000; display:flex; justify-content:center; align-items:center; color:#ff3366; font-family:monospace; font-size: 20px; font-weight: bold;'>CONNECTION LOST.</div>";
            if(peer) peer.destroy();
            if(localStream) localStream.getTracks().forEach(t => t.stop());
            setTimeout(() => location.reload(), 2000);
        }
    }, 1000);
}

burnBtn.onclick = async () => {
    const confirmBurn = await showModal('confirm', "WARNING: Initiate Self-Destruct? This will permanently erase the room for everyone.");
    if(confirmBurn) {
        broadcastData({ type: 'burn_protocol' });
        triggerBurnSequence();
    }
};

// --- SECRET CHAT LOGIC ---
function renderChatMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `<div class="sender">${sender}</div><div class="text">${text}</div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    setTimeout(() => { msgDiv.style.opacity = '0'; setTimeout(() => msgDiv.remove(), 300); }, 30000);
}

sendChatBtn.onclick = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    renderChatMessage(myName + " (You)", text);
    broadcastData({ type: 'chat', sender: myName, text: text });
    chatInput.value = '';
};
chatInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') sendChatBtn.click(); });

// --- PHANTOM DROP (FILE SHARING) ---
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');

function formatBytes(bytes) {
    if(bytes === 0) return '0 Bytes';
    const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderFileUI(sender, fileName, fileType, fileSize, fileBlob) {
    const emptyText = fileList.querySelector('div');
    if(emptyText && emptyText.innerText.includes('No files')) emptyText.remove();
    const fileUrl = URL.createObjectURL(fileBlob);
    const card = document.createElement('div');
    card.className = 'file-card';
    
    let previewHTML = `<div class="file-preview"><div class="file-icon">📄</div></div>`;
    if (fileType.startsWith('image/')) {
        previewHTML = `<div class="file-preview"><img src="${fileUrl}" alt="Preview"></div>`;
    } else if (fileType.startsWith('video/')) {
        previewHTML = `<div class="file-preview"><video src="${fileUrl}" controls></video></div>`;
    }

    card.innerHTML = `
        <div class="sender">${sender} shared a file:</div>
        ${previewHTML}
        <div class="file-details">
            <div class="file-name">${fileName}</div>
            <div class="file-size">${formatBytes(fileSize)}</div>
        </div>
        <a href="${fileUrl}" download="${fileName}" class="btn-download">⬇ Download</a>
    `;
    fileList.appendChild(card);
    fileList.scrollTop = fileList.scrollHeight;
}

fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // UPDATED LIMIT: 2000 MB (Approx 2 GB)
    if(file.size > 2000 * 1024 * 1024) {
        const proceed = await showModal('confirm', "File is larger than 2 GB. It might take time to send depending on network. Send anyway?");
        if(!proceed) return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        const arrayBuffer = ev.target.result;
        broadcastData({ type: 'file', sender: myName, name: file.name, filetype: file.type, size: file.size, data: arrayBuffer });
        renderFileUI(myName + " (You)", file.name, file.type, file.size, new Blob([arrayBuffer]));
        showToast("✅ File sent to group");
    };
    reader.readAsArrayBuffer(file);
    fileInput.value = '';
};

// --- UNIVERSAL MEDIA ENGINE LOGIC ---
const videoWrapper = document.getElementById('videoWrapper');
const syncVideo = document.getElementById('syncVideo');
const ytPlayerContainer = document.getElementById('ytPlayerContainer');
const genericIframe = document.getElementById('genericIframe');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const hostVideoControls = document.getElementById('hostVideoControls');
const videoWaitingText = document.getElementById('videoWaitingText');
const syncWarning = document.getElementById('syncWarning');
const cinemaBtn = document.getElementById('cinemaBtn'); // CINEMA MODE BUTTON

let isVideoBroadcasting = false;
let ytPlayer = null;
let isYtApiReady = false;
let currentVideoType = 'none';
let syncHeartbeat = null;

window.onYouTubeIframeAPIReady = function() { isYtApiReady = true; };

function parseVideoUrl(url) {
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const ytMatch = url.match(ytRegex);
    if (ytMatch && ytMatch[1]) return { type: 'youtube', id: ytMatch[1], url: url };
    else if (url.match(/\.(mp4|webm|ogg)$/i)) return { type: 'html5', src: url };
    else return { type: 'generic', src: url };
}

function loadVideoPlayer(parsedData) {
    videoWrapper.style.display = 'block';
    videoWaitingText.style.display = 'none';
    cinemaBtn.style.display = 'block'; // Unhide cinema mode button
    currentVideoType = parsedData.type;
    
    syncVideo.pause();
    syncVideo.style.display = 'none';
    ytPlayerContainer.style.display = 'none';
    genericIframe.style.display = 'none';
    syncWarning.style.display = 'none';

    if (parsedData.type === 'youtube') {
        ytPlayerContainer.style.display = 'block';
        if(ytPlayer && ytPlayer.loadVideoById) {
            ytPlayer.loadVideoById(parsedData.id);
        } else if(isYtApiReady) {
            ytPlayer = new YT.Player('ytPlayer', {
                height: '100%', width: '100%', videoId: parsedData.id,
                playerVars: { 'playsinline': 1, 'controls': isHost ? 1 : 0, 'disablekb': isHost ? 0 : 1, 'fs': 1 },
                events: { 'onStateChange': onYtStateChange }
            });
        }
    }
    else if (parsedData.type === 'html5') {
        syncVideo.style.display = 'block';
        syncVideo.src = parsedData.src;
        if(isHost) syncVideo.setAttribute('controls', 'true');
        else syncVideo.removeAttribute('controls');
    } 
    else {
        genericIframe.style.display = 'block';
        genericIframe.src = parsedData.src;
        syncWarning.style.display = 'block';
    }
}

function onYtStateChange(event) {
    if(!isHost || isVideoBroadcasting) return;
    if (event.data == YT.PlayerState.PLAYING) broadcastData({ type: 'vid_play', time: ytPlayer.getCurrentTime(), source: 'youtube' });
    else if (event.data == YT.PlayerState.PAUSED) broadcastData({ type: 'vid_pause', time: ytPlayer.getCurrentTime(), source: 'youtube' });
}

function setupHostVideoSync() {
    hostVideoControls.style.display = 'flex';
    loadVideoBtn.onclick = () => {
        const url = videoUrlInput.value.trim();
        if(!url) return;
        const parsed = parseVideoUrl(url);
        loadVideoPlayer(parsed);
        broadcastData({ type: 'vid_load', parsed: parsed });
        showToast("🎬 Media Loaded for everyone");
    };

    syncVideo.onplay = () => { if(!isVideoBroadcasting && currentVideoType === 'html5') broadcastData({ type: 'vid_play', time: syncVideo.currentTime, source: 'html5' }); };
    syncVideo.onpause = () => { if(!isVideoBroadcasting && currentVideoType === 'html5') broadcastData({ type: 'vid_pause', time: syncVideo.currentTime, source: 'html5' }); };
    syncVideo.onseeked = () => { if(!isVideoBroadcasting && currentVideoType === 'html5') broadcastData({ type: 'vid_seek', time: syncVideo.currentTime, source: 'html5' }); };

    if (syncHeartbeat) clearInterval(syncHeartbeat);
    syncHeartbeat = setInterval(() => {
        if (isHost && isVideoBroadcasting === false && currentVideoType !== 'none') {
            if (currentVideoType === 'youtube' && ytPlayer && ytPlayer.getPlayerState) {
                let state = ytPlayer.getPlayerState();
                if (state == YT.PlayerState.PLAYING) broadcastData({ type: 'vid_sync', time: ytPlayer.getCurrentTime(), source: 'youtube', state: 'playing' });
                else if (state == YT.PlayerState.PAUSED) broadcastData({ type: 'vid_sync', time: ytPlayer.getCurrentTime(), source: 'youtube', state: 'paused' });
            } else if (currentVideoType === 'html5') {
                broadcastData({ type: 'vid_sync', time: syncVideo.currentTime, source: 'html5', state: syncVideo.paused ? 'paused' : 'playing' });
            }
        }
    }, 3000); 
}

function handleRemoteVideoSync(data) {
    isVideoBroadcasting = true; 
    if (data.type === 'vid_load') {
        loadVideoPlayer(data.parsed);
        showToast("🎬 Host started media playback");
    }
    else if (data.type === 'vid_sync' || data.type === 'vid_play' || data.type === 'vid_pause' || data.type === 'vid_seek') {
        if (data.source === 'youtube' && ytPlayer && ytPlayer.seekTo) {
            let localTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
            let hostTime = data.time;
            if (Math.abs(localTime - hostTime) > 2) ytPlayer.seekTo(hostTime, true);
            
            if ((data.state === 'playing' || data.type === 'vid_play') && ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) ytPlayer.playVideo();
            else if ((data.state === 'paused' || data.type === 'vid_pause') && ytPlayer.getPlayerState() !== YT.PlayerState.PAUSED) ytPlayer.pauseVideo();
        } 
        else if (data.source === 'html5') {
            if (Math.abs(syncVideo.currentTime - data.time) > 2) syncVideo.currentTime = data.time;
            
            if ((data.state === 'playing' || data.type === 'vid_play') && syncVideo.paused) syncVideo.play().catch(e => console.log("Auto-play blocked"));
            else if ((data.state === 'paused' || data.type === 'vid_pause') && !syncVideo.paused) syncVideo.pause();
        }
    }
    setTimeout(() => { isVideoBroadcasting = false; }, 500);
}

// --- CINEMA MODE EVENT LISTENER ---
cinemaBtn.onclick = () => {
    if (!document.fullscreenElement) {
        if (videoWrapper.requestFullscreen) videoWrapper.requestFullscreen();
        else if (videoWrapper.webkitRequestFullscreen) videoWrapper.webkitRequestFullscreen();
        else if (videoWrapper.msRequestFullscreen) videoWrapper.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
};

// --- GLOBAL SYNC UI ---
function setPeerIcon(peerId, state) {
    const iconSpan = document.getElementById('icon-' + peerId);
    if (!iconSpan) return;
    if (state === 'hand') iconSpan.innerText = '✋';
    else if (state === 'muted') iconSpan.innerText = '🔇';
    else iconSpan.innerText = '🎙️';
}

// --- PERSONAL CONTROLS ---
function toggleSelfMute(forcedState = null) {
    isMuted = forcedState !== null ? forcedState : !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted; 
    muteBtn.innerText = isMuted ? "Unmuted 🔇" : "Mute 🎙️";
    muteBtn.style.color = isMuted ? "#ff3366" : "#00ffcc";
    muteBtn.style.borderColor = isMuted ? "#ff3366" : "#00ffcc";
    setPeerIcon('me', isMuted ? 'muted' : 'unmuted');
    globalMuteStates['me'] = isMuted;
    broadcastData({ type: 'sync_mute', state: isMuted });
}
muteBtn.onclick = () => toggleSelfMute();

ghostBtn.onclick = () => {
    isGhostMode = !isGhostMode;
    if(isGhostMode) {
        ghostDryGain.gain.value = 0; 
        ghostWetGain.gain.value = 1.5; 
        ghostBtn.innerText = "Ghost 🦹";
        ghostBtn.style.background = "#9d4edd";
        ghostBtn.style.color = "#000";
        showToast("🎭 Phantom Voice Modulator Activated");
    } else {
        ghostDryGain.gain.value = 1; 
        ghostWetGain.gain.value = 0; 
        ghostBtn.innerText = "Ghost 🎭";
        ghostBtn.style.background = "transparent";
        ghostBtn.style.color = "#9d4edd";
        showToast("🎙️ Voice Modulator Deactivated");
    }
};

raiseHandBtn.onclick = () => {
    showToast("✋ You raised your hand");
    setPeerIcon('me', 'hand');
    clearTimeout(handRaiseTimer);
    handRaiseTimer = setTimeout(() => { setPeerIcon('me', globalMuteStates['me'] ? 'muted' : 'unmuted'); }, 5000);
    broadcastData({ type: 'raise_hand', name: myName });
};

// --- UI & HOST FUNCTIONS ---
function addParticipantUI(peerId, name, isCurrentlyMuted = false, stream = null) {
    if (document.getElementById('ui-' + peerId)) return;
    const emptyText = participantList.querySelector('div');
    if(emptyText && emptyText.innerText.includes('Waiting')) emptyText.remove();

    globalMuteStates[peerId] = isCurrentlyMuted;

    const div = document.createElement('div');
    div.id = 'ui-' + peerId;
    div.className = 'participant-item';
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'participant-info';
    
    const iconSpan = document.createElement('span');
    iconSpan.id = 'icon-' + peerId;
    iconSpan.className = 'status-icon';
    iconSpan.innerText = isCurrentlyMuted ? '🔇' : '🎙️';
    
    const nameSpan = document.createElement('span');
    nameSpan.innerText = name + (peerId === 'me' ? " (You)" : "");
    
    const canvasId = 'vis-' + peerId;
    const visCanvas = document.createElement('canvas');
    visCanvas.id = canvasId;
    visCanvas.className = 'visualizer';
    
    infoDiv.appendChild(iconSpan);
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(visCanvas);
    div.appendChild(infoDiv);

    if (isHost && peerId !== 'me') {
        const actionGroup = document.createElement('div');
        actionGroup.className = 'host-action-group';

        const hMuteBtn = document.createElement('button');
        hMuteBtn.className = 'host-action-btn btn-mute-remote';
        hMuteBtn.id = 'host-mute-' + peerId;
        hMuteBtn.innerText = isCurrentlyMuted ? 'Unmute' : 'Mute';
        hMuteBtn.style.color = isCurrentlyMuted ? '#ff3366' : '#ffaa00';
        hMuteBtn.onclick = () => hostToggleMute(peerId, hMuteBtn);
        
        const kickBtn = document.createElement('button');
        kickBtn.className = 'host-action-btn btn-kick-remote';
        kickBtn.innerText = 'Kick';
        kickBtn.onclick = () => kickUser(peerId);

        actionGroup.appendChild(hMuteBtn);
        actionGroup.appendChild(kickBtn);
        div.appendChild(actionGroup);
    }
    participantList.appendChild(div);

    if(stream) { setTimeout(() => attachVisualizer(stream, canvasId), 500); }
}

function removeParticipantUI(peerId) {
    stopVisualizer('vis-' + peerId);
    const div = document.getElementById('ui-' + peerId);
    if (div) div.remove();
    delete globalMuteStates[peerId];
    if (participantList.children.length === 0) {
        participantList.innerHTML = '<div style="color: #555; text-align: center; font-size: 13px; padding: 10px;">Waiting for connections...</div>';
    }
}

function addAudio(peerId, stream) {
    if (document.getElementById('audio-' + peerId)) return;
    const audio = document.createElement('audio');
    audio.id = 'audio-' + peerId; audio.srcObject = stream; audio.autoplay = true;
    audioContainer.appendChild(audio);
    if(document.getElementById('vis-' + peerId)){ attachVisualizer(stream, 'vis-' + peerId); }
}

function removePeer(peerId) {
    if (connections[peerId]) { connections[peerId].close(); delete connections[peerId]; }
    if (calls[peerId]) { calls[peerId].close(); delete calls[peerId]; }
    removeParticipantUI(peerId);
    const audio = document.getElementById('audio-' + peerId);
    if (audio) audio.remove();
}

function hostToggleMute(peerId, btn) {
    const isCurrentlyMuted = btn.innerText === 'Unmute';
    const action = isCurrentlyMuted ? 'unmute' : 'mute';
    if (connections[peerId]) connections[peerId].send({ type: 'host_control', action: action });
}

function kickUser(peerId) {
    if (connections[peerId]) {
        connections[peerId].send({ type: 'kicked' });
        setTimeout(() => removePeer(peerId), 500);
    }
}

// --- LOBBY LOGIC (Host) ---
function renderLobby() {
    lobbyList.innerHTML = "";
    const keys = Object.keys(pendingRequests);
    if (keys.length === 0) { lobbyArea.style.display = 'none'; return; }
    lobbyArea.style.display = 'block';
    
    keys.forEach(peerId => {
        const req = pendingRequests[peerId];
        const div = document.createElement('div');
        div.className = 'lobby-req';
        div.innerHTML = `<span>${req.name}</span>
        <div class="lobby-btns">
            <button class="btn-admit" onclick="admitFromLobby('${peerId}')">Admit</button>
            <button class="btn-deny" onclick="denyFromLobby('${peerId}')">Deny</button>
        </div>`;
        lobbyList.appendChild(div);
    });
}

window.admitFromLobby = function(peerId) {
    const conn = pendingRequests[peerId].conn;
    if (Object.keys(connections).length + 1 >= maxLimit) {
        showToast("Room is full! Kick someone first.", true); return;
    }
    conn.send({ type: 'decision', status: 'approved', peers: Object.keys(connections) });
    setupActiveConnection(conn);
    delete pendingRequests[peerId];
    renderLobby();
}

window.denyFromLobby = function(peerId) {
    const conn = pendingRequests[peerId].conn;
    conn.send({ type: 'decision', status: 'declined', reason: 'Host denied access.' });
    delete pendingRequests[peerId];
    renderLobby();
}

// --- ACTIVE CONNECTION SETUP ---
function setupActiveConnection(conn) {
    connections[conn.peer] = conn;
    
    conn.on('data', async (data) => {
        if (data.type === 'name_broadcast') {
            let stream = null;
            const audioEl = document.getElementById('audio-' + conn.peer);
            if(audioEl && audioEl.srcObject) stream = audioEl.srcObject;
            addParticipantUI(conn.peer, data.name, data.isMuted, stream);

            if(isHost && currentVideoType !== 'none') {
                let urlToSync = (currentVideoType === 'youtube') ? videoUrlInput.value : syncVideo.src;
                let idToSync = (currentVideoType === 'youtube' && ytPlayer && ytPlayer.getVideoData) ? ytPlayer.getVideoData().video_id : null;
                conn.send({ type: 'vid_load', parsed: { type: currentVideoType, src: urlToSync, id: idToSync } });
            }
        }
        else if (data.type === 'chat') { renderChatMessage(data.sender, data.text); }
        else if (data.type === 'file') { renderFileUI(data.sender, data.name, data.filetype, data.size, new Blob([data.data])); }
        else if (data.type.startsWith('vid_')) { handleRemoteVideoSync(data); }
        else if (data.type === 'hangup') { removePeer(conn.peer); }
        else if (data.type === 'kicked') {
            await showModal('alert', "⚠️ You have been KICKED by the Host.");
            location.reload();
        }
        else if (data.type === 'raise_hand') {
            showToast(`✋ ${data.name} raised hand!`);
            setPeerIcon(conn.peer, 'hand');
            setTimeout(() => { setPeerIcon(conn.peer, globalMuteStates[conn.peer] ? 'muted' : 'unmuted'); }, 5000);
        }
        else if (data.type === 'host_control') {
            if (data.action === 'mute') {
                toggleSelfMute(true); showToast("⚠️ You were muted by Host", true);
            } else if (data.action === 'unmute') {
                toggleSelfMute(false); showToast("✅ Host unmuted you");
            }
        }
        else if (data.type === 'sync_mute') {
            globalMuteStates[conn.peer] = data.state;
            setPeerIcon(conn.peer, data.state ? 'muted' : 'unmuted');
            if (isHost) {
                const hBtn = document.getElementById('host-mute-' + conn.peer);
                if (hBtn) { hBtn.innerText = data.state ? 'Unmute' : 'Mute'; hBtn.style.color = data.state ? '#ff3366' : '#ffaa00'; }
            }
        }
        else if (data.type === 'burn_protocol') {
            triggerBurnSequence(); 
        }
    });

    conn.on('close', () => removePeer(conn.peer));
    setTimeout(() => { if (conn.open) conn.send({ type: 'name_broadcast', name: myName, isMuted: isMuted }); }, 1000);
}

function setupActiveCall(call) {
    calls[call.peer] = call;
    call.on('stream', (remoteStream) => addAudio(call.peer, remoteStream));
    call.on('close', () => removePeer(call.peer));
}

// --- HOST LOGIC ---
createBtn.onclick = async () => {
    const enteredRoomName = await showModal('prompt', "Enter Room Name:", "e.g. Secret Squad");
    if (!enteredRoomName || enteredRoomName.trim() === "") return;
    myRoomName = enteredRoomName.trim();

    let inputLimit = await showModal('prompt', "Max Capacity? (2 to 10)", "4");
    if (inputLimit === null) return; 
    maxLimit = parseInt(inputLimit);
    if (isNaN(maxLimit) || maxLimit < 2 || maxLimit > 10) maxLimit = 10;

    // --- NEW: Custom 5-Digit Room Code ---
    let customCode = await showModal('prompt', "Enter a custom 5-digit code (Leave blank for auto-generate):", "e.g. 12345");
    let roomKey = "";
    
    if (customCode !== null && customCode.trim() !== "") {
        roomKey = customCode.trim(); // Uses Custom Code provided by Host
    } else {
        roomKey = Math.floor(10000 + Math.random() * 90000).toString(); // Generates 5-Digit code automatically
    }

    isHost = true;
    setupHostVideoSync(); 
    burnBtn.style.display = 'block'; 

    roomIdDisplay.innerText = roomKey;
    roomNameDisplay.innerText = "ROOM: " + myRoomName;

    peer = new Peer(secretPrefix + roomKey);

    peer.on('open', (id) => {
        mainMenu.style.display = 'none'; roomArea.style.display = 'block';
        roomContainer.classList.add('room-active');
        statusText.innerText = `Host Ready. Capacity: ${maxLimit}`;
        addParticipantUI('me', myName, isMuted, processedLocalStream); 
    });

    peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            if (data.type === 'inquiry') {
                conn.send({ type: 'room_details', hostName: myName, roomName: myRoomName });
            }
            else if (data.type === 'request_access') {
                pendingRequests[conn.peer] = { name: data.joinerName, conn: conn };
                renderLobby();
                showToast(`⏳ ${data.joinerName} is waiting in the Lobby.`);
                conn.on('close', () => { delete pendingRequests[conn.peer]; renderLobby(); });
            }
        });
    });

    peer.on('call', (call) => {
        if (connections[call.peer]) { call.answer(processedLocalStream); setupActiveCall(call); } 
        else { call.close(); }
    });
};

// --- JOINER LOGIC ---
joinBtn.onclick = async () => {
    const roomKey = await showModal('prompt', "Enter 5-digit Invite Key:", "-----");
    
    if (roomKey && roomKey.length >= 4) { // Allows 4 or 5 digits just in case
        isHost = false; peer = new Peer(); 

        peer.on('open', (id) => {
            const hostId = secretPrefix + roomKey;
            statusText.innerText = "Fetching room data...";
            const handshakeConn = peer.connect(hostId);
            
            handshakeConn.on('open', () => { handshakeConn.send({ type: 'inquiry' }); });
            
            handshakeConn.on('data', async (data) => {
                if (data.type === 'room_details') {
                    const wantsToJoin = await showModal('confirm', `Join "${data.hostName}"'s room "${data.roomName}"?`);
                    if (wantsToJoin) {
                        mainMenu.style.display = 'none'; roomArea.style.display = 'block';
                        roomContainer.classList.add('room-active');
                        roomNameDisplay.innerText = "ROOM: " + data.roomName;
                        roomIdDisplay.innerText = roomKey;
                        statusText.innerText = "Waiting in Lobby... ⏳";
                        statusText.style.color = "#ffaa00";
                        handshakeConn.send({ type: 'request_access', joinerName: myName });
                    } else { handshakeConn.close(); }
                }
                else if (data.type === 'decision') {
                    if (data.status === 'approved') {
                        statusText.innerText = "Connection Active 🟢";
                        statusText.style.color = "#00ffcc";
                        await showModal('alert', "Access Granted ✅");
                        
                        setupActiveConnection(handshakeConn);
                        addParticipantUI('me', myName, isMuted, processedLocalStream); 
                        
                        data.peers.forEach(peerId => {
                            if(!connections[peerId]) {
                                const newConn = peer.connect(peerId); setupActiveConnection(newConn);
                                const newCall = peer.call(peerId, processedLocalStream); setupActiveCall(newCall);
                            }
                        });
                        const call = peer.call(hostId, processedLocalStream); setupActiveCall(call);
                    } else {
                        await showModal('alert', "Request Denied: " + data.reason + " ❌");
                        location.reload();
                    }
                }
            });

            handshakeConn.on('error', async () => {
                await showModal('alert', "Invalid Key or Host offline.");
                location.reload();
            });
        });
        
        peer.on('connection', (conn) => { setupActiveConnection(conn); });
        peer.on('call', (call) => { call.answer(processedLocalStream); setupActiveCall(call); });
        
    } else {
        if (roomKey !== null) await showModal('alert', "Please enter a valid key.");
    }
};

// --- NORMAL LEAVE LOGIC ---
endBtn.onclick = () => {
    Object.values(connections).forEach(conn => {
        if (conn.open) conn.send({ type: 'hangup' });
    });
    setTimeout(() => {
        if (peer) peer.destroy(); 
        if (localStream) localStream.getTracks().forEach(track => track.stop()); 
        if (syncHeartbeat) clearInterval(syncHeartbeat);
        location.reload(); 
    }, 200);
};
