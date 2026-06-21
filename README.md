================================================================================
                    MOTOR-CAM — Wi-Fi Security Camera System
                              README & User Guide
================================================================================

Version: 1.0  |  License: MIT  |  Browser: Google Chrome (Android & Windows)

================================================================================
  QUICK START
================================================================================

1. Open "index.html" in Google Chrome.
2. Choose Server Mode (camera) or Client Mode (viewer).
3. In Server Mode, tap "Start Camera" and grant permissions.
4. In Client Mode, enter the server IP and port, then connect.

No installation, no server, no frameworks — just open and go.

================================================================================
  FILE STRUCTURE
================================================================================

  MotorCam/
  ├── index.html    ← Main app — open this in Chrome
  ├── style.css     ← All styles (dark theme, neon accents)
  ├── app.js        ← Full application logic
  └── README.txt    ← This file

================================================================================
  SERVER MODE
================================================================================

Turns your device into a live security camera.

  1. Open index.html in Chrome.
  2. Tap "Server Mode".
  3. Tap "▶ Start Camera" — allow camera & microphone when prompted.
  4. Note the IP:Port shown in the Network panel.
  5. (Optional) Enable Motion Detection and adjust the sensitivity slider.

The app will automatically record 5-minute clips when motion is detected.
  - Android:  Files saved to Downloads folder as motorcam_001.webm, etc.
  - Windows:  On first save, you select a folder (File System Access API).

================================================================================
  CLIENT MODE
================================================================================

Monitor a running server camera from any Chrome browser.

  1. Open index.html in Chrome on the viewing device.
  2. Tap "Client Mode".
  3. Enter the server IP address and port (default: 8080).
  4. Tap "🔗 Connect".

Controls:
  ⛶ Fullscreen   — Full-screen video
  🔇 Mute         — Toggle audio
  📸 Snapshot     — Save current frame as PNG
  🖼  PiP          — Picture-in-Picture floating window

================================================================================
  LOCAL NETWORK (SAME WI-FI)
================================================================================

Both devices must be on the same Wi-Fi network.
The server shows its address, e.g.: 192.168.1.100:8080
Enter this exactly on the client device.

Tip: Use the "📋 Copy" button on the server and share via message.

================================================================================
  REMOTE ACCESS OPTIONS
================================================================================

OPTION 1 — PORT FORWARDING
  1. Assign a static IP to the server device in your router (DHCP Reservation).
  2. Forward port 8080 TCP to that static IP.
  3. Visit https://whatismyip.com from the server to get your public IP.
  4. Use that public IP on the client: e.g., 203.45.67.89:8080

OPTION 2 — NGROK (Easiest)
  1. Sign up at https://ngrok.com (free)
  2. Authenticate: ngrok config add-authtoken YOUR_TOKEN
  3. Run: ngrok http 8080
  4. Use the HTTPS URL Ngrok gives you in Client Mode.

OPTION 3 — CLOUDFLARE TUNNEL
  1. Install cloudflared (https://developers.cloudflare.com/cloudflare-one/)
  2. Run: cloudflared tunnel --url http://localhost:8080
  3. Use the provided HTTPS URL in Client Mode.

================================================================================
  TROUBLESHOOTING
================================================================================

Camera won't start
  → Allow camera & microphone in Chrome when prompted.
  → Chrome Settings → Site Settings → Camera → Allow for this site.

Can't connect from client
  → Ensure both devices are on the same Wi-Fi network.
  → Check the IP and port match exactly what the server shows.
  → Some routers have "AP Isolation" — disable it to allow device communication.

HTTPS required error
  → getUserMedia() requires HTTPS or localhost.
  → For remote access, use Ngrok or Cloudflare (they provide HTTPS automatically).
  → For local Chrome exception: chrome://flags/#unsafely-treat-insecure-origin-as-secure

Clips not saving (Android)
  → Check Chrome has storage permission in Android Settings → Apps → Chrome.
  → Ensure free space is available.

Clips not saving (Windows)
  → When prompted, select or create a "MotorCam_Recordings" folder.
  → Ensure you have write permissions to the selected folder.

App becomes slow after many hours
  → Close other tabs. Keep device plugged in.
  → Restart Chrome every 24–48 hours for best performance.
  → Reduce motion detection sensitivity to lower CPU usage.

================================================================================
  MOTION DETECTION
================================================================================

Uses canvas frame-differencing at 160×120 resolution.
Sensitivity slider:
  - Low values  (1–20):   Very sensitive — detects small movements.
  - Medium      (30–60):  Balanced — detects people, door movement.
  - High values (70–100): Low sensitivity — only large movements trigger.

When motion exceeds the threshold:
  - Recording starts automatically (5-minute clips).
  - Clips are saved as motorcam_001.webm, motorcam_002.webm, etc.
  - System returns to standby after each clip.

Storage estimates (at 2.5 Mbps):
  - 1 minute:  ~19 MB
  - 5 minutes: ~94 MB
  - 1 hour:    ~1.1 GB

================================================================================
  END OF README
================================================================================
