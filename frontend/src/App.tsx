/**
 * @file App.tsx
 * @description Core React Component for the Rakshak Mobile Simulator and Scam Guardian Overlay.
 * 
 * This component renders the entire interactive hackathon showcase interface.
 * It simulates a smartphone showing different payment situations (normal, classic scam,
 * novel scam, legit payment) and includes a custom input box where judges can paste
 * arbitrary texts to verify zero-shot generalizability.
 * 
 * KEY FEATURES:
 * 1. State machine for simulated phone screen rendering based on the 4 Demo Beats.
 * 2. WebSocket client connecting to the secure backend proxy server.
 * 3. Screen frame capture simulator (transmits OCR text and visual metadata at 1 FPS).
 * 4. Audio warning synthesis: proactive TTS playback in Hindi (`hi-IN`) upon scam detection.
 * 5. Visual warnings: full-screen pulsing red overlay + glowing hazard shield.
 * 6. Interactive Terminal logs: prints internal React function executions and socket payloads in real-time.
 * 
 * According to the coding guidelines:
 * - This file contains long comments detailing the features, workflows, and use cases.
 * - Every single function contains descriptive docstrings.
 * - Every function call (with its parameters) is logged to our scrollable on-screen console.
 * - Centralized configurations are fetched from the front-end config.ts.
 */

import React, { useState, useEffect, useRef } from 'react';
import { config, UPIScreen } from './config.ts';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM';
  message: string;
}

export default function App() {
  // --- UI and Screen Simulation State ---
  const [currentScreen, setCurrentScreen] = useState<UPIScreen>(config.DEMO_SCREENS[0]);
  const [customScamText, setCustomScamText] = useState('');
  const [customPayeeName, setCustomPayeeName] = useState('Unknown Sender');
  
  // --- WebSocket Connection & Guardian State ---
  const [isGuardianActive, setIsGuardianActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [verdict, setVerdict] = useState<{ scam: boolean; reason: string; warning_hi: string } | null>(null);
  
  // --- Terminal Log State ---
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);

  // Ref holders for background processing
  const socketRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // --- Initial Mount Actions ---
  useEffect(() => {
    addTerminalLog('SYSTEM', 'Rakshak React Interface Initialized. Waiting for Guardian Activation...');
  }, []);

  // --- Automatic Terminal Scroll --
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  /**
   * Appends an operational event message to our on-screen cyber security terminal log.
   * 
   * @function addTerminalLog
   * @param {'INFO' | 'WARN' | 'ERROR' | 'SYSTEM'} level - Severity tier of the log event.
   * @param {string} message - Explanatory text for the event.
   */
  function addTerminalLog(level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM', message: string) {
    const timestamp = new Date().toTimeString().split(' ')[0];
    setTerminalLogs(prev => [...prev, { timestamp, level, message }]);
  }

  /**
   * Connects the frontend to the backend Node.js proxy server via WebSockets.
   * Handles lifecycle events (open, message, close, error) and updates terminal logs.
   * 
   * @function connectWebSocket
   */
  function connectWebSocket() {
    addTerminalLog('INFO', `Calling connectWebSocket() to host: ${config.WS_PROXY_URL}`);
    setConnectionStatus('connecting');

    try {
      const socket = new WebSocket(config.WS_PROXY_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        addTerminalLog('SYSTEM', 'WebSocket Connection Established with secure backend proxy.');
        setConnectionStatus('connected');
        setIsGuardianActive(true);
        // Automatically send the current screen state upon successful connection
        transmitScreenFrame(currentScreen, socket);
      };

      socket.onmessage = (event) => {
        handleSocketMessage(event.data);
      };

      socket.onclose = () => {
        addTerminalLog('WARN', 'WebSocket connection closed by proxy host.');
        setConnectionStatus('disconnected');
        setIsGuardianActive(false);
        socketRef.current = null;
      };

      socket.onerror = (err) => {
        addTerminalLog('ERROR', `WebSocket channel error: ${JSON.stringify(err)}`);
        setConnectionStatus('disconnected');
        setIsGuardianActive(false);
        socketRef.current = null;
      };

    } catch (err: any) {
      addTerminalLog('ERROR', `Failed to construct WebSocket: ${err.message}`);
      setConnectionStatus('disconnected');
    }
  }

  /**
   * Disconnects the active WebSocket session and silences the active state.
   * 
   * @function disconnectWebSocket
   */
  function disconnectWebSocket() {
    addTerminalLog('INFO', 'Calling disconnectWebSocket()');
    if (socketRef.current) {
      socketRef.current.close();
    }
  }

  /**
   * Synthesizes and plays a proactive Hindi voice alert via WebSpeech Synthesis API.
   * Leverages hi-IN localization with fallback mechanisms for stage reliability.
   * 
   * @function playVoiceWarning
   * @param {string} text - The warning narrative in Hindi.
   */
  function playVoiceWarning(text: string) {
    addTerminalLog('INFO', `Calling playVoiceWarning() with payload: "${text}"`);
    
    if (!('speechSynthesis' in window)) {
      addTerminalLog('WARN', 'SpeechSynthesis API not supported in this browser host.');
      return;
    }

    // Cancel any ongoing vocal synthesis to prevent speech overlapping
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95; // slightly slower for maximum clarity in emergency

    // Attempt to locate a Hindi vocal engine on the demo machine
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(voice => voice.lang.includes('hi-IN'));
    if (hindiVoice) {
      utterance.voice = hindiVoice;
      addTerminalLog('INFO', `Loaded localized speech synthesis engine: ${hindiVoice.name}`);
    } else {
      addTerminalLog('WARN', 'No native hi-IN SpeechSynthesis voice located. Falling back to default system voice.');
    }

    utterance.onend = () => {
      addTerminalLog('SYSTEM', 'Voice alert synthesis completed successfully.');
    };

    utterance.onerror = (err) => {
      addTerminalLog('ERROR', `Voice synthesis failed: ${err.error}`);
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Evaluates the JSON response verdict streamed back from the backend proxy.
   * Fired automatically on receiving WebSocket events.
   * 
   * @function handleSocketMessage
   * @param {string} rawData - Stringified JSON payload received from the socket.
   */
  function handleSocketMessage(rawData: string) {
    addTerminalLog('INFO', `Calling handleSocketMessage() with raw data: ${rawData.substring(0, 150)}...`);

    try {
      const data = JSON.parse(rawData);
      
      if (data.type === 'connected') {
        addTerminalLog('SYSTEM', `Server message: ${data.message}`);
        return;
      }

      if (data.type === 'verdict') {
        addTerminalLog('SYSTEM', `Security Verdict Received: scam=${data.scam}, confidence=${data.confidence}`);
        
        if (data.scam) {
          addTerminalLog('WARN', `CRITICAL ALARM TRIGGERED! Reason: ${data.reason}`);
          setVerdict({
            scam: true,
            reason: data.reason,
            warning_hi: data.warning_hi
          });
          // Speak the proactive warning in Hindi
          playVoiceWarning(data.warning_hi);
        } else {
          addTerminalLog('INFO', `Frame classified as SAFE. Reason: ${data.reason}`);
          setVerdict(null);
          window.speechSynthesis.cancel(); // clear previous warning audio if any
        }
      }

    } catch (err: any) {
      addTerminalLog('ERROR', `Parsing socket message failed: ${err.message}`);
    }
  }

  /**
   * Packages the current UI screen state and transmits it as a frame over the WebSocket.
   * Simulates continuous visual capture of the mobile view space (1 FPS stream).
   * 
   * @function transmitScreenFrame
   * @param {UPIScreen} screen - Active screen configuration.
   * @param {WebSocket|null} activeSocket - Active socket object override if needed.
   */
  function transmitScreenFrame(screen: UPIScreen, activeSocket: WebSocket | null = null) {
    const targetSocket = activeSocket || socketRef.current;
    if (!targetSocket || targetSocket.readyState !== WebSocket.OPEN) {
      addTerminalLog('WARN', 'Skipping transmitScreenFrame(): WebSocket is not connected.');
      return;
    }

    addTerminalLog('INFO', `Calling transmitScreenFrame() for screen ID: "${screen.id}"`);

    // OCR context describing what is visually readable on the phone screen
    const textContext = `
[Screen Metadata]
Title: ${screen.screenTitle}
Payee Name: ${screen.senderName}
Payee Address/Handle: ${screen.handle}
Transaction Amount: ₹${screen.amount}
Payment Type: ${screen.isCollectRequest ? 'Collect/Debit Request (Money Leaves User)' : 'Direct Outgoing Transfer'}
Requires PIN: ${screen.requiresPin ? 'Yes, asks for secret PIN' : 'No'}

[OCR / Visual Screen Copy]
${screen.message}
    `.trim();

    const payload = {
      type: 'screen_frame',
      textContext: textContext,
      data: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=' // mock pixel frame for visual stream
    };

    targetSocket.send(JSON.stringify(payload));
    addTerminalLog('INFO', `Screen metadata frame streamed to backend. Character length: ${textContext.length}`);
  }

  /**
   * Overrides the current smartphone simulation page to show a new selected beat.
   * Clears active alarm triggers before transmitting the new visual context.
   * 
   * @function changeSimulatedScreen
   * @param {UPIScreen} screen - The selected screen object to activate.
   */
  function changeSimulatedScreen(screen: UPIScreen) {
    addTerminalLog('INFO', `Calling changeSimulatedScreen() to screen: "${screen.name}"`);
    setVerdict(null);
    window.speechSynthesis.cancel();
    setCurrentScreen(screen);

    // If guardian is actively monitoring, transmit the frame instantly
    if (isGuardianActive) {
      transmitScreenFrame(screen);
    }
  }

  /**
   * Creates and executes a custom UPI screen mock based on judge input fields.
   * Validates generalizability live on stage by allowing ad-hoc scam phrase entry.
   * 
   * @function simulateCustomScreen
   */
  function simulateCustomScreen() {
    addTerminalLog('INFO', `Calling simulateCustomScreen() with text: "${customScamText}"`);
    
    if (!customScamText.trim()) {
      addTerminalLog('WARN', 'Cannot simulate empty custom screen text.');
      return;
    }

    const customScreen: UPIScreen = {
      id: 'custom_screen_' + Date.now(),
      name: `Custom Screen: "${customPayeeName}"`,
      category: 'scam', // default to analyze
      senderName: customPayeeName,
      handle: 'payee-' + Math.floor(Math.random() * 9000) + '@okaxis',
      amount: 1500,
      message: customScamText,
      isCollectRequest: true,
      requiresPin: true,
      screenTitle: 'Custom Incoming Claim'
    };

    changeSimulatedScreen(customScreen);
  }

  /**
   * Fires a mock non-destructive scam event. Useful for demonstrating the overlay UI
   * and spoken alert warnings without invoking the actual Gemini API.
   * 
   * @function triggerMockScamUI
   */
  function triggerMockScamUI() {
    addTerminalLog('INFO', 'Calling triggerMockScamUI() for non-destructive local validation.');
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'mock_scam' }));
    } else {
      addTerminalLog('WARN', 'WebSocket offline. Playing local mock warning directly.');
      const mockVerdict = {
        scam: true,
        reason: 'Mock PIN-to-receive scam triggered locally.',
        warning_hi: 'Ruko! Ye paisa lene ka nahi, dene ka request hai. PIN daalte hi aapke account se paise kat jaayenge. Paisa lene ke liye kabhi PIN nahi daala jaata. Ye scam hai.'
      };
      setVerdict(mockVerdict);
      playVoiceWarning(mockVerdict.warning_hi);
    }
  }

  /**
   * Clears and resets the guardian state to safe silent defaults.
   * 
   * @function resetGuardianStatus
   */
  function resetGuardianStatus() {
    addTerminalLog('INFO', 'Calling resetGuardianStatus()');
    setVerdict(null);
    window.speechSynthesis.cancel();
    addTerminalLog('SYSTEM', 'Overlay and voice alarms cleared. Guardian is silent.');
  }

  // Handle active listening button click
  const handleToggleGuardian = () => {
    addTerminalLog('INFO', 'User triggered handleToggleGuardian()');
    if (connectionStatus === 'connected') {
      disconnectWebSocket();
    } else {
      connectWebSocket();
    }
  };

  return (
    <div className="app-container">
      {/* App Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <span className="brand-icon">🛡️</span>
          <div className="brand-title-wrap">
            <h1>Rakshak</h1>
            <p>Proactive Screen Guardian</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: connectionStatus === 'connected' ? 'var(--guardian-emerald)' : 'var(--text-muted)' }}>
            ● {connectionStatus.toUpperCase()}
          </span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="dashboard-grid">
        {/* Left Column: Simulated Mobile Phone */}
        <section className="phone-mockup">
          <div className="phone-notch">
            <div className="phone-camera"></div>
            <div className="phone-speaker"></div>
          </div>

          <div className="phone-screen">
            {/* Notification/App header bar */}
            <div className="phone-screen-header">
              <span className="phone-time">11:00 AM</span>
              <span className="phone-battery">🔋 98%</span>
            </div>

            {/* Simulated UPI App Body */}
            <div className="upi-app-body">
              <div style={{ textAlign: 'center', margin: '0.5rem 0', padding: '0.25rem', background: '#252936', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-glow)' }}>
                {currentScreen.screenTitle.toUpperCase()}
              </div>

              {currentScreen.id !== 'home' ? (
                <>
                  <div className={`upi-avatar-placeholder ${currentScreen.category === 'scam' ? 'upi-scam-avatar' : ''}`}>
                    {currentScreen.senderName ? currentScreen.senderName[0] : '👤'}
                  </div>
                  <h3 className="upi-sender-title">{currentScreen.senderName || 'Anonymous'}</h3>
                  <p className="upi-sender-handle">{currentScreen.handle || 'unknown-id@okaxis'}</p>

                  <div className="upi-amount-card">
                    <p className="upi-amount-label">Amount Requested</p>
                    <p className="upi-amount-val">₹{currentScreen.amount.toLocaleString()}</p>
                  </div>

                  <div className={`upi-message-box ${currentScreen.category === 'legit' ? 'legit' : ''}`}>
                    {currentScreen.message}
                  </div>

                  {currentScreen.requiresPin && (
                    <div className="upi-pin-keyboard">
                      <div style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center', marginBottom: '0.5rem' }}>
                        🔒 Enter UPI PIN to Authenticate
                      </div>
                      <div className="keyboard-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'X', 0, '✓'].map((key) => (
                          <div 
                            key={key} 
                            className="keyboard-key"
                            onClick={() => addTerminalLog('INFO', `Simulated Key Pressed: ${key}`)}
                          >
                            {key}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', padding: '1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.2))' }}>📱</span>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Simulator Screen</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Choose a beat in the controller panel on the right to start simulating different screen flows.
                  </p>
                </div>
              )}
            </div>

            {/* --- RAKSHAK REAL-TIME PROACTIVE OVERLAY --- */}
            {verdict && verdict.scam && (
              <div className="rakshak-overlay">
                <div className="rakshak-overlay-alert-border" />
                <div className="rakshak-shield">🛡️</div>
                <h2 className="rakshak-title">Rakshak Alert!</h2>
                <p className="rakshak-subtitle">Scam Attempt Blocked</p>
                
                {/* Hindi Subtitles rendering */}
                <div className="rakshak-subtitles-box">
                  {verdict.warning_hi}
                </div>

                <button 
                  className="rakshak-button-primary" 
                  onClick={resetGuardianStatus}
                >
                  Clear Security Alert
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Interactive Dashboard Panels */}
        <section className="controls-column">
          {/* Panel 1: Primary Activation Button */}
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <h3 className="glass-panel-title">Guardian Control</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Enabling the Guardian unlocks browser autoplay and opens a real-time monitor stream with Gemini.
            </p>
            <button 
              className={`btn-connect ${connectionStatus === 'connected' ? 'active' : 'inactive'}`}
              onClick={handleToggleGuardian}
            >
              {connectionStatus === 'connected' ? '🛡️ Guardian Shield Active' : '⚡ Start Rakshak Guardian'}
            </button>
          </div>

          {/* Panel 2: Demo Beats (The Judge Controller) */}
          <div className="glass-panel">
            <h3 className="glass-panel-title">Demo Beats Controller</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Simulate standard payment scenarios to verify the proactive "speak on danger, stay quiet on safety" paradigm.
            </p>
            <div className="beats-grid">
              {config.DEMO_SCREENS.map((screen) => (
                <button
                  key={screen.id}
                  className={`btn-beat ${currentScreen.id === screen.id ? 'active' : ''}`}
                  onClick={() => changeSimulatedScreen(screen)}
                >
                  <strong>{screen.name.split(':')[0]}</strong>
                  <br />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {screen.name.split(':')[1] || ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Panel 3: Novel Scam Input (Generalization Proof) */}
          <div className="glass-panel">
            <h3 className="glass-panel-title">Judge Test Bench</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Type or paste ANY arbitrary message. Gemini will analyze it zero-shot, proving it does not rely on hardcoded rules!
            </p>
            
            <div className="input-group">
              <label className="input-label">Sender Display Name</label>
              <input 
                type="text"
                className="textarea-custom"
                style={{ minHeight: '38px', padding: '0.4rem' }}
                value={customPayeeName}
                onChange={(e) => setCustomPayeeName(e.target.value)}
              />

              <label className="input-label">Scam / Screen Copy Text</label>
              <textarea
                className="textarea-custom"
                placeholder="Example: You have won ₹500 cashback on Google Pay! Tap here, select pay, and input your UPI PIN to transfer it into your bank."
                value={customScamText}
                onChange={(e) => setCustomScamText(e.target.value)}
              />

              <button 
                className="btn-classify"
                onClick={simulateCustomScreen}
              >
                🔬 Inject Custom Screen to Stream
              </button>
            </div>
          </div>

          {/* Panel 4: Quick Testing & Fallbacks */}
          <div className="glass-panel">
            <h3 className="glass-panel-title">Diagnostic Utilities</h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn-beat" 
                style={{ flex: 1, textAlign: 'center', borderColor: 'rgba(255,50,50,0.15)' }}
                onClick={triggerMockScamUI}
              >
                🚨 Trigger Mock Scam UI
              </button>
              <button 
                className="btn-beat" 
                style={{ flex: 1, textAlign: 'center', borderColor: 'rgba(50,255,100,0.15)' }}
                onClick={() => {
                  addTerminalLog('INFO', 'Triggering mock legit local test.');
                  resetGuardianStatus();
                }}
              >
                🟢 Reset Overlay
              </button>
            </div>
          </div>

          {/* Panel 5: Real-Time Cyber Console Terminal */}
          <div className="glass-panel" style={{ flexGrow: 1 }}>
            <h3 className="glass-panel-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Security Stream logs</span>
              <span 
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}
                onClick={() => setTerminalLogs([])}
              >
                Clear
              </span>
            </h3>
            <div className="terminal-console" ref={logContainerRef}>
              {terminalLogs.map((log, index) => (
                <div key={index} className="terminal-line">
                  <span className="terminal-line-timestamp">[{log.timestamp}]</span>
                  <span className={`terminal-line-${log.level.toLowerCase()}`}>
                    [{log.level}] {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
