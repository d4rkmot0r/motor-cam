"use strict";

const MotorCam = (() => {

    /* ============================================================
     * UTILS
     * ============================================================ */
    const Utils = {
        getPlatform() {
            const ua = navigator.userAgent.toLowerCase();
            if (/android/.test(ua)) return 'android';
            if (/windows/.test(ua)) return 'windows';
            return 'unknown';
        },
        formatTime(seconds) {
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            return m + ':' + s;
        },
        getTimestamp() {
            return new Date().toLocaleString('en-US', {
                year:'numeric',month:'2-digit',day:'2-digit',
                hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
            });
        },
        clipFilename(num) {
            return 'motorcam_' + num.toString().padStart(3,'0') + '.webm';
        },
        async detectLocalIP() {
            return new Promise((resolve) => {
                try {
                    const pc = new RTCPeerConnection({ iceServers:[] });
                    pc.createDataChannel('');
                    const timeout = setTimeout(() => { pc.close(); resolve('(Check Wi-Fi settings for IP)'); }, 3000);
                    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(()=>{});
                    pc.onicecandidate = (e) => {
                        if (!e || !e.candidate) return;
                        const m = e.candidate.candidate.match(/(\d{1,3}\.){3}\d{1,3}/);
                        if (m) { clearTimeout(timeout); pc.close(); resolve(m[0]); }
                    };
                } catch { resolve('(Could not detect IP)'); }
            });
        }
    };

    /* ============================================================
     * SERVER MODULE
     * ============================================================ */
    const Server = (() => {
        let cameraStream = null, mediaRecorder = null, recordedChunks = [];
        let clipNumber = 0, isRecording = false, recordingStartTime = 0;
        let recordingTimerInterval = null, motionEnabled = false, motionAnimId = null;
        let sensitivity = 50, previousFrame = null, timestampInterval = null, directoryHandle = null;
        const CLIP_DURATION = 300, PORT = 8080;

        async function startCamera() {
            const video = document.getElementById('cameraPreview');
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video:{ facingMode:{ ideal:'environment' }, width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30,max:30} },
                audio: true
            });
            video.srcObject = cameraStream;
            await video.play();
            document.getElementById('btnStartCamera').classList.add('hidden');
            document.getElementById('btnStopCamera').classList.remove('hidden');
            updateStatus('statusCamera','Active','active');
            updateStatus('statusStream','Live','active');
            startTimestamp();
            showToast('Camera started successfully');
        }

        function stopCamera() {
            if (isRecording) stopRecording();
            if (motionEnabled) { toggleMotionDetection(false); document.getElementById('chkMotion').checked = false; }
            if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
            document.getElementById('cameraPreview').srcObject = null;
            if (timestampInterval) { clearInterval(timestampInterval); timestampInterval = null; }
            document.getElementById('btnStartCamera').classList.remove('hidden');
            document.getElementById('btnStopCamera').classList.add('hidden');
            updateStatus('statusCamera','Off','inactive');
            updateStatus('statusStream','Inactive','inactive');
            showToast('Camera stopped');
        }

        function startTimestamp() {
            const el = document.getElementById('timestampOverlay');
            if (timestampInterval) clearInterval(timestampInterval);
            timestampInterval = setInterval(() => { el.textContent = Utils.getTimestamp(); }, 1000);
        }

        function toggleMotionDetection(enabled) {
            motionEnabled = enabled;
            const settings = document.getElementById('motionSettings');
            if (enabled) {
                if (!cameraStream) {
                    showToast('Start camera first to enable motion detection', true);
                    document.getElementById('chkMotion').checked = false;
                    motionEnabled = false; return;
                }
                settings.classList.remove('hidden');
                updateStatus('statusMotion','Active','active');
                previousFrame = null;
                detectMotion();
            } else {
                settings.classList.add('hidden');
                updateStatus('statusMotion','Disabled','inactive');
                if (motionAnimId) { cancelAnimationFrame(motionAnimId); motionAnimId = null; }
                previousFrame = null;
                document.getElementById('motionLevel').textContent = '0%';
                document.getElementById('motionBar').style.width = '0%';
            }
        }

        function setSensitivity(value) {
            sensitivity = parseInt(value, 10);
            document.getElementById('sensitivityValue').textContent = sensitivity;
        }

        function detectMotion() {
            if (!motionEnabled || !cameraStream) return;
            const video = document.getElementById('cameraPreview');
            const canvas = document.getElementById('motionCanvas');
            const ctx = canvas.getContext('2d', { willReadFrequently:true });
            const w = 160, h = 120;
            canvas.width = w; canvas.height = h;

            function processFrame() {
                if (!motionEnabled || !cameraStream) return;
                ctx.drawImage(video, 0, 0, w, h);
                const cur = ctx.getImageData(0, 0, w, h);
                if (previousFrame) {
                    let diff = 0;
                    const d1 = previousFrame.data, d2 = cur.data;
                    for (let i = 0; i < d1.length; i += 16) {
                        if (((Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2]))/3) > 25) diff++;
                    }
                    const pct = Math.min(100, Math.round((diff / (w * h / 4)) * 100));
                    document.getElementById('motionLevel').textContent = pct + '%';
                    document.getElementById('motionBar').style.width = pct + '%';
                    if (pct > (sensitivity / 100) * 50 && !isRecording) startRecording();
                }
                previousFrame = cur;
                motionAnimId = requestAnimationFrame(processFrame);
            }
            motionAnimId = requestAnimationFrame(processFrame);
        }

        function startRecording() {
            if (!cameraStream || isRecording) return;
            isRecording = true; clipNumber++; recordedChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp8,opus';
            mediaRecorder = new MediaRecorder(cameraStream, { mimeType, videoBitsPerSecond:2500000 });
            mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                const blob = new Blob(recordedChunks, { type: mimeType });
                await saveClip(blob, clipNumber); recordedChunks = [];
            };
            mediaRecorder.start(1000);
            recordingStartTime = Date.now();
            document.getElementById('recIndicator').classList.remove('rec-hidden');
            updateStatus('statusRecording','Recording','warning');
            document.getElementById('recStatus').textContent = '⏺ Recording';
            document.getElementById('recStatus').style.color = 'var(--neon-red)';
            document.getElementById('recClipNum').textContent = '#' + clipNumber;
            recordingTimerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const remaining = CLIP_DURATION - elapsed;
                if (remaining <= 0) { stopRecording(); return; }
                document.getElementById('recTimer').textContent = Utils.formatTime(remaining);
                document.getElementById('recCountdown').textContent = Utils.formatTime(remaining);
                document.getElementById('recProgress').style.width = ((elapsed / CLIP_DURATION) * 100) + '%';
            }, 1000);
            showToast('Recording clip #' + clipNumber + ' started');
        }

        function stopRecording() {
            if (!isRecording || !mediaRecorder) return;
            isRecording = false;
            if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            if (recordingTimerInterval) { clearInterval(recordingTimerInterval); recordingTimerInterval = null; }
            document.getElementById('recIndicator').classList.add('rec-hidden');
            updateStatus('statusRecording','Standby','inactive');
            document.getElementById('recStatus').textContent = 'Standby';
            document.getElementById('recStatus').style.color = '';
            document.getElementById('recTimer').textContent = '00:00';
            document.getElementById('recCountdown').textContent = '—';
            document.getElementById('recProgress').style.width = '0%';
        }

        async function saveClip(blob, num) {
            const filename = Utils.clipFilename(num);
            const platform = Utils.getPlatform();
            if (platform === 'windows' && 'showDirectoryPicker' in window) {
                try {
                    if (!directoryHandle) {
                        directoryHandle = await window.showDirectoryPicker({ mode:'readwrite', startIn:'videos', id:'motorcam-recordings' });
                    }
                    const fh = await directoryHandle.getFileHandle(filename, { create:true });
                    const wr = await fh.createWritable();
                    await wr.write(blob); await wr.close();
                    document.getElementById('storageLocation').textContent = directoryHandle.name + '/' + filename;
                } catch (err) {
                    if (err.name !== 'AbortError') downloadClip(blob, filename);
                    else downloadClip(blob, filename);
                }
            } else {
                downloadClip(blob, filename);
            }
            document.getElementById('storageClips').textContent = num;
            showToast('Clip #' + num + ' saved: ' + filename);
        }

        function downloadClip(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.style.display = 'none';
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
        }

        function updateStatus(id, text, cls) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="status-dot ' + cls + '"></span> ' + text;
        }

        async function init() {
            const ip = await Utils.detectLocalIP();
            document.getElementById('statusIP').textContent = ip;
            document.getElementById('localAddressText').textContent = ip + ':' + PORT;
            const platform = Utils.getPlatform();
            const names = { android:'Android', windows:'Windows', unknown:'Unknown' };
            document.getElementById('storagePlatform').textContent = names[platform] || 'Unknown';
            document.getElementById('storageLocation').textContent =
                platform === 'windows' ? 'MotorCam_Recordings/ (select on first save)' : 'Downloads folder';
        }

        function cleanup() {
            stopCamera();
            directoryHandle = null; clipNumber = 0; previousFrame = null;
            document.getElementById('storageClips').textContent = '0';
        }

        return { startCamera, stopCamera, toggleMotionDetection, setSensitivity, init, cleanup };
    })();

    /* ============================================================
     * CLIENT MODULE
     * ============================================================ */
    const Client = (() => {
        let isConnected = false, latencyInterval = null, timestampInterval = null, isMuted = true;

        async function connect() {
            const ip = document.getElementById('clientIP').value.trim();
            const port = document.getElementById('clientPort').value.trim();
            if (!ip) { showToast('Enter the server IP address', true); return; }
            if (!port) { showToast('Enter the port number', true); return; }
            const address = ip + ':' + port;
            updateClientStatus('Connecting…', 'warning');
            document.getElementById('clientServer').textContent = address;
            document.getElementById('btnConnect').classList.add('hidden');
            document.getElementById('btnDisconnect').classList.remove('hidden');

            const image = document.getElementById('clientImage');
            const video = document.getElementById('clientVideo');
            image.onerror = () => { updateClientStatus('Waiting for server…', 'warning'); image.style.display = 'none'; };
            image.onload = () => {
                updateClientStatus('Streaming', 'active');
                image.style.display = 'block'; video.style.display = 'none'; isConnected = true;
            };
            image.src = 'http://' + address + '/stream';
            isConnected = true;
            updateClientStatus('Connected (Waiting for stream)', 'active');
            startLatencyMeasurement(ip, port);
            startClientTimestamp();
            showToast('Connected to ' + address);
        }

        function disconnect() {
            isConnected = false;
            const video = document.getElementById('clientVideo');
            const image = document.getElementById('clientImage');
            video.srcObject = null; video.src = '';
            image.src = ''; image.style.display = 'none'; video.style.display = 'block';
            if (latencyInterval) { clearInterval(latencyInterval); latencyInterval = null; }
            if (timestampInterval) { clearInterval(timestampInterval); timestampInterval = null; }
            document.getElementById('btnConnect').classList.remove('hidden');
            document.getElementById('btnDisconnect').classList.add('hidden');
            updateClientStatus('Disconnected', 'inactive');
            document.getElementById('clientLatency').textContent = '—';
            document.getElementById('clientServer').textContent = '—';
            document.getElementById('clientTimestamp').textContent = 'Waiting for feed…';
            showToast('Disconnected');
        }

        function startLatencyMeasurement(ip, port) {
            if (latencyInterval) clearInterval(latencyInterval);
            latencyInterval = setInterval(async () => {
                if (!isConnected) return;
                const start = performance.now();
                try {
                    await fetch('http://' + ip + ':' + port + '/ping', { method:'HEAD', mode:'no-cors', cache:'no-cache' });
                    document.getElementById('clientLatency').textContent = Math.round(performance.now() - start) + 'ms';
                } catch { document.getElementById('clientLatency').textContent = '—'; }
            }, 5000);
        }

        function startClientTimestamp() {
            const el = document.getElementById('clientTimestamp');
            if (timestampInterval) clearInterval(timestampInterval);
            timestampInterval = setInterval(() => { if (isConnected) el.textContent = Utils.getTimestamp(); }, 1000);
        }

        function updateClientStatus(text, cls) {
            document.getElementById('clientStatus').innerHTML = '<span class="status-dot ' + cls + '"></span> ' + text;
        }

        function toggleFullscreen() {
            const c = document.getElementById('clientVideoContainer');
            if (!document.fullscreenElement) c.requestFullscreen().catch(()=>{});
            else document.exitFullscreen().catch(()=>{});
        }

        function toggleMute() {
            const video = document.getElementById('clientVideo');
            isMuted = !isMuted; video.muted = isMuted;
            document.getElementById('btnMute').textContent = isMuted ? '🔇 Muted' : '🔊 Audio';
        }

        function snapshot() {
            const video = document.getElementById('clientVideo');
            const image = document.getElementById('clientImage');
            const source = image.style.display !== 'none' ? image : video;
            const canvas = document.createElement('canvas');
            canvas.width = source.videoWidth || source.naturalWidth || 640;
            canvas.height = source.videoHeight || source.naturalHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
            ctx.fillStyle = '#00ff88'; ctx.font = '14px monospace';
            ctx.fillText('Motor-Cam | ' + Utils.getTimestamp(), 10, canvas.height - 10);
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'motorcam_snapshot_' + Date.now() + '.png'; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 'image/png');
            showToast('Snapshot saved');
        }

        async function togglePiP() {
            const video = document.getElementById('clientVideo');
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            else if (video.srcObject || video.src) await video.requestPictureInPicture();
            else showToast('No active stream for PiP', true);
        }

        function cleanup() { if (isConnected) disconnect(); }

        return { connect, disconnect, toggleFullscreen, toggleMute, snapshot, togglePiP, cleanup };
    })();

    /* ============================================================
     * SCREEN MANAGEMENT
     * ============================================================ */
    function showScreen(screen) {
        document.getElementById('home-screen').style.display   = screen === 'home'   ? 'flex'  : 'none';
        document.getElementById('server-screen').style.display = screen === 'server' ? 'block' : 'none';
        document.getElementById('client-screen').style.display = screen === 'client' ? 'block' : 'none';
    }

    async function enterServerMode() { showScreen('server'); await Server.init(); }
    function enterClientMode() { showScreen('client'); }
    function goHome() { Server.cleanup(); Client.cleanup(); showScreen('home'); }

    async function copyAddress() {
        const text = document.getElementById('localAddressText').textContent;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Address copied to clipboard');
        } catch {
            const input = document.createElement('input');
            input.value = text; document.body.appendChild(input); input.select();
            document.execCommand('copy'); input.remove();
            showToast('Address copied');
        }
    }

    /* ============================================================
     * TOAST
     * ============================================================ */
    let toastTimeout = null;
    function showToast(message, isError = false) {
        const el = document.getElementById('toast');
        el.textContent = message;
        el.className = isError ? 'toast error show' : 'toast show';
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
    }

    return { Server, Client, Utils, enterServerMode, enterClientMode, goHome, copyAddress };
})();

function toggleCollapse(headerEl) {
    headerEl.nextElementSibling.classList.toggle('open');
    headerEl.classList.toggle('open');
}