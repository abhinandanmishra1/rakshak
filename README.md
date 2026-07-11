# 🛡️ Rakshak — Proactive On-Screen UPI Scam Guardian

> *A second pair of eyes that only speaks to save you money.*

Rakshak is a real-time, proactive on-screen guardian built for the **Google DeepMind Bangalore Hackathon (Problem Statement 1: Real-Time Multimodal Interaction)**. It continuously watches a user's simulated phone payment screen, staying completely silent during normal operations, and proactively interrupts visually and verbally in the user's native language (Hindi) the instant it detects a deceptive scam.

---

## 🚀 The Problem & Vision

UPI transactions in India are growing at an exponential rate, but so is UPI fraud. Scammers routinely target elderly, rural, and first-time digital payment users using high-pressure scripts such as **"PIN-to-receive" scams**, **fake customer support verifications**, and **fraudulent cashback claims**. 

The fundamental issue is that these victims do not understand that entering a UPI PIN always **debits** money; it never receives it. 

### Why LLMs (Gemini) beat Hardcoded Rules:
1. **Generalization**: A new scam script or novel wording bypassing regex/keyword filters still gets caught by Gemini's zero-shot visual reasoning.
2. **Intent-vs-Action Mismatch**: Rakshak doesn't alert on normal merchant payments or utility bills. It reasons over the screen context to identify if the user was promised incoming credits but is performing an outgoing debit.
3. **Localized Explanation**: Rakshak speaks directly to the user in friendly, urgent Hindi explaining exactly *why* they shouldn't enter their PIN.

---

## 🛠️ Tech Stack

* **Frontend Client**: Vite + React 18 + TypeScript + Vanilla CSS (Premium glassmorphic dashboard + high-fidelity mobile phone mockup simulator).
* **Backend Proxy**: Node.js + Express + `ws` (Relays capture frames securely to Gemini without exposing API keys in client-side bundles).
* **AI Core**: Google Gemini Vision Model (`gemini-1.5-flash`), leveraging custom security guardrails and structured JSON classification outputs.
* **Vocal Synthesis**: Localized Browser `SpeechSynthesis` (`hi-IN` language voice mapping).

---

## 📂 Repository Structure

The project is modularly split to enforce clean features, secure configuration boundaries, and separation of concerns:

```
rakshak/
├── Design.md                 # Technical blueprint & sequence diagram
├── README.md                 # Project guide (this file)
├── mcp_config.json           # Local Stitch MCP workspace config (gitignored)
├── .gitignore                # Production ignore rules
├── backend/
│   ├── .env                  # Configuration templates (API keys, ports)
│   ├── package.json          # Server dependencies
│   ├── config.js             # Central configuration & System Instructions
│   ├── logger.js             # compliant custom console parameter logger
│   ├── server.js             # Express app & WebSocket relays
│   └── test_gemini.js        # Non-destructive dry-run API tester
└── frontend/
    ├── package.json          # React application dependencies
    ├── tsconfig.json         # TypeScript rules
    ├── vite.config.ts        # Port bindings (localhost:3000)
    ├── index.html            # Mount point with Outfit/Inter fonts
    └── src/
        ├── main.tsx          # Application bootstrap
        ├── config.ts         # Centralized demo scenarios & configurations
        ├── index.css         # Modern styling, dark mode, glassmorphism, & pulsars
        └── App.tsx           # Mobile shell, Websocket hooks, & alert overlays
```

---

## ⚡ Quick Start

### 1. Prerequisites
Ensure you have [Bun](https://bun.sh/) (recommended for speed) or Node/NPM installed.

### 2. Configure Backend
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   bun install --registry=https://registry.npmjs.org/
   ```
3. Copy `.env` template and set your Gemini API key:
   ```bash
   # Add your key inside .env: GEMINI_API_KEY=your_key_here
   ```
4. Verify connections via our non-destructive test script:
   ```bash
   bun run test
   ```
5. Spin up the backend proxy WebSocket server:
   ```bash
   bun start
   ```
   *The WebSocket server will be listening at `ws://localhost:5001`.*

### 3. Configure Frontend
1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install packages:
   ```bash
   bun install --registry=https://registry.npmjs.org/
   ```
3. Boot up the Vite web application:
   ```bash
   bun run dev
   ```
4. Open your browser at [http://localhost:3000](http://localhost:3000).

---

## 🎭 Running the Live 4-Beat Presentation

Once the frontend page loads:
1. **Unlocking Audio**: Click **"⚡ Start Rakshak Guardian"** on the control board. This triggers the required user gesture to initiate WebSockets and unlock browser autoplay permissions.
2. **Beat 1: Safe Home (Stay Silent)**: The phone simulator shows normal chat threads. Rakshak stays quiet.
3. **Beat 2: Classic PIN-to-Receive (Proactive Alarm)**: Click **"Beat 2"** in the controller. A fraudulent lottery screen requests the user to enter their PIN to receive ₹25,000.
   - *Rakshak instantly fires a high-impact red pulsing alert frame, prints the visual warnings, overlays translated subtitles, and speaks the spoken warning proactively in Hindi.*
4. **Beat 3: Novel Scam Wording**: Click **"Beat 3"** to simulate a mandatory account update scam. Gemini reasons zero-shot over the novel threat profile and warns.
5. **Beat 4: Safe Payment (Stay Silent)**: Click **"Beat 4"** to simulate paying a local grocery store owner. Rakshak remains silent, proving we prevent false-positive alert fatigue.
6. **Judge Test Bench (Generalization Proof)**: Write or paste any unique scam text inside the custom block (e.g. *"Scan this QR code to claim your Google cashback reward!"*), click **"Inject Custom Screen"**, and watch Gemini classify it live on stage!

---

## 📝 Compliance with Hackathon Guidelines

We have adhered strictly to your workspace directives:
* **Feature Segregation**: Split logic across highly focused individual modules (`logger`, `config`, `server`, `App`, `test_gemini`).
* **Documented Everything**: Comprehensive file header blocks detailing use cases, and strict function docstring parameters on every single method.
* **Logging Compliance**: Custom log wrapper logs every function execution with parameters and prints GenAI calls with prompt instructions and outputs while stripping heavy inline image base64 hashes.
* **Non-destructive Tests**: Provided standalone `test_gemini.js` scripts to verify classification and safety rules without mutating state.
