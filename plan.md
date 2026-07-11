# 🧑‍💻 Rakshak — Developer Implementation & Collaboration Plan

This document serves as the shared roadmap and workflow guide for the developers building, testing, and presenting Rakshak.

---

## 🛠️ Developer Setup & Dev Commands

Both developers should run local instances of the app to test integration. We use **Bun** for rapid package installation, but standard **NPM** is also fully supported.

### 1. Backend Proxy (`rakshak/backend/`)
* **Purpose**: Holds your secret Gemini API key, handles incoming WebSocket connections, and processes visual frame payloads.
* **Setup Commands**:
  ```bash
  cd backend
  bun install --registry=https://registry.npmjs.org/
  cp .env # Set your GEMINI_API_KEY inside the .env file
  ```
* **Verify API Connectivity (Non-destructive)**:
  ```bash
  bun run test
  ```
* **Start local proxy server**:
  ```bash
  bun start
  ```

### 2. Frontend Simulator Client (`rakshak/frontend/`)
* **Purpose**: Smartphone mockup dashboard displaying normal vs scam states, local custom testing consoles, and interactive overlays.
* **Setup Commands**:
  ```bash
  cd frontend
  bun install --registry=https://registry.npmjs.org/
  ```
* **Start React Vite Server**:
  ```bash
  bun run dev
  ```
  *Open your browser at [http://localhost:3000](http://localhost:3000) to inspect.*

---

## 🌿 Branching & Git Policy

> [!IMPORTANT]
> **NO DIRECT PUSHES TO `main`!**
> To avoid code collision, merge conflicts, and protect working baseline builds during the hackathon, we enforce strict feature branches.

### Workflow:
1. Always create a descriptive branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your modular changes:
   ```bash
   git add .
   git commit -m "feat: implement feature detail"
   ```
3. Push your feature branch to GitHub and open a Pull Request (PR) for review:
   ```bash
   git push -u origin feature/your-feature-name
   ```

---

## 📋 Strict Coding & Documenting Guidelines

All code written must adhere to these compliance rules:

1. **One File Per Feature**: Keep files small and focused. Refactor and decompose large classes.
2. **Detailed Header Comments**: Start every code file with a comprehensive multi-line comment block explaining the purpose, scope, and use cases.
3. **Descriptive Docstrings**: Every function/method must have a JSdoc block outlining:
   * `@function` / `@async`
   * `@param {Type} name` — description
   * `@returns {Type}` — description
4. **Centralized Configurations**: Group variable settings in config files (backend: `config.js`, frontend: `config.ts`). Do not hardcode ports, URLs, or prompts.
5. **Standardized Parameter Logging**: 
   * Log as `INFO` all internal function calls alongside their arguments.
   * Log all GenAI (Gemini) inputs and outputs, while running raw strings/arrays through the `logger.stripInlineData()` helper to clean out base64 visual hashes.
6. **Non-Destructive Testing**: Always maintain standalone dry-run scripts (like `test_gemini.js`) to test visual logic without altering user accounts or states.

---

## 🎭 The 4-Beat Rehearsal Flow

Rehearse this exact loop at least 3-4 times before the judges visit your table:

1. **Beat 1 (Normal Chat)**: Turn the guardian **ON**. Navigate to the chat viewport. Ensure the system stays completely quiet.
2. **Beat 2 (Classic PIN-to-Receive Scam)**: Select the lottery scam beat. Ensure:
   * The red overlay pulses.
   * Localized Hindi subtitles display.
   * The spoken Hindi audio warning plays cleanly: *"Ruko! Ye paisa lene ka nahi..."*
3. **Beat 3 (Novel Scam Wording)**: Select the KYC Update scam beat. Show that the model’s zero-shot reasoning catches and explains scams without hardcoded keywords.
4. **Beat 4 (Legitimate Payment)**: Select the grocery store checkout. Verify that the overlay is *not* triggered, maintaining low false-positives.
5. **The Judge Challenge**: Ask a judge to input any scam message into the test box, click inject, and demonstrate Rakshak dynamically generating a custom spoken alert!
