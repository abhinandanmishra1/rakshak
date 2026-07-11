/**
 * @file App.tsx
 * @description Core React Component for the Rakshak Mobile Simulator and Scam Guardian Overlay.
 * 
 * This component renders the entire interactive hackathon showcase interface.
 * Implements a premium UI, robust SessionState, and global keyboard handlers for the demo.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, StopCircle, MonitorPlay, MonitorStop } from 'lucide-react';
import { config, UPIScreen } from './config.ts';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM';
  message: string;
}

interface FraudLog {
  timestamp: string;
  reason: string;
  confidence: number;
  warning_hi: string;
  base64Image: string;
}

interface SessionState {
  connected: boolean;
  watching: boolean;
  warningActive: boolean;
  currentScenario: string;
  conversationHistory: any[];
  lastRiskScore: number;
  language: string;
  voice: string;
}

export default function App() {
  // --- UI and Session State ---
  const defaultLang = localStorage.getItem('rakshak_language') || 'hi-IN';
  const defaultVoice = localStorage.getItem('rakshak_voice') || 'Aoede';
  const [session, setSession] = useState<SessionState>({
    connected: false,
    watching: false,
    warningActive: false,
    currentScenario: config.DEMO_SCREENS[0].id,
    conversationHistory: [],
    lastRiskScore: 0,
    language: defaultLang,
    voice: defaultVoice
  });

  const [currentScreen, setCurrentScreen] = useState<UPIScreen>(config.DEMO_SCREENS[0]);
  const [verdict, setVerdict] = useState<{ scam: boolean; reason: string; warning_hi: string; confidence?: number } | null>(null);
  
  const [customScamText, setCustomScamText] = useState('');
  const [customPayeeName, setCustomPayeeName] = useState('Unknown Sender');
  
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
  const [ttsMissing, setTtsMissing] = useState(false);
  const [fraudLogs, setFraudLogs] = useState<FraudLog[]>([]);

  // Ref holders for background processing
  const socketRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Audio state
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  
  // Tracking for debounce and capture
  const isWarningActiveRef = useRef<boolean>(false);
  const lastSentFrameRef = useRef<string>('');
  const lastSentTextContextRef = useRef<string>('');

  // --- Screen Capture State ---
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);

  // --- Initial Mount Actions ---
  useEffect(() => {
    addTerminalLog('SYSTEM', 'Rakshak React Interface Initialized. Waiting for Guardian Activation...');
    
    // Check for TTS Engine
    if ('speechSynthesis' in window) {
      setTimeout(() => {
        const voices = window.speechSynthesis.getVoices();
        const hasHindi = voices.some(v => v.lang.includes('hi-IN'));
        if (!hasHindi) {
          setTtsMissing(true);
        }
      }, 1000); // Give time for voices to load
    } else {
      setTtsMissing(true);
    }
  }, []);

  // --- Automatic Terminal Scroll --
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const addTerminalLog = (level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM', message: string) => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    setTerminalLogs(prev => [...prev, { timestamp, level, message }]);
  };

  // --- Live Session Manager (WebSocket) ---
  const connectWebSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;
    addTerminalLog('INFO', `Connecting to WS proxy: ${config.WS_PROXY_URL}`);

    try {
      const socket = new WebSocket(config.WS_PROXY_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        addTerminalLog('SYSTEM', 'WebSocket Connection Established.');
        setSession(s => ({ ...s, connected: true, watching: true }));
        socket.send(JSON.stringify({ type: 'setup_live_api', lang: session.language, voice: session.voice }));
        transmitScreenFrame(currentScreen, socket);
      };

      socket.onmessage = (event) => {
        handleSocketMessage(event.data);
      };

      socket.onclose = () => {
        addTerminalLog('WARN', 'WebSocket connection closed.');
        setSession(s => ({ ...s, connected: false, watching: false }));
        socketRef.current = null;
      };

      socket.onerror = () => {
        addTerminalLog('ERROR', 'WebSocket channel error.');
        setSession(s => ({ ...s, connected: false, watching: false }));
        socketRef.current = null;
      };
    } catch (err) {
      addTerminalLog('ERROR', `WebSocket connection failed: ${(err as Error).message}`);
    }
  }, [currentScreen, session.language, session.voice]);

  const disconnectWebSocket = useCallback(() => {
    addTerminalLog('INFO', 'Disconnecting WebSocket...');
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    stopMic();
  }, []);

  // --- Audio Engine (Web Audio API & PCM) ---
  const playAudioChunk = (base64: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 16000);
      audioBuffer.getChannelData(0).set(float32Array);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      const currentTime = audioContextRef.current.currentTime;
      if (nextStartTimeRef.current < currentTime) {
          nextStartTimeRef.current = currentTime;
      }
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
    } catch(err) {
      addTerminalLog('ERROR', 'Audio playback failed');
    }
  };

  const playVoiceWarning = (text: string) => {
    // Left as fallback, but Live API streams audio chunks directly.
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = session.language;
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.includes(session.language));
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const uint8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = window.btoa(binary);

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'audio_chunk', data: base64 }));
        }
      };

      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0; // mute local playback
      gainNodeRef.current = gainNode;
      
      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      setIsMicActive(true);
      addTerminalLog('SYSTEM', 'Microphone capture started. Speak to Rakshak.');
    } catch (err) {
      addTerminalLog('ERROR', 'Failed to start mic: ' + (err as Error).message);
    }
  };

  const stopMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    setIsMicActive(false);
    addTerminalLog('INFO', 'Microphone stopped.');
  };

  // --- Screen Capture Engine ---
  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScreenCapturing(true);
        addTerminalLog('SYSTEM', 'Real screen capture started. Video stream active.');
        
        // Stop capture when user stops sharing via browser UI
        stream.getVideoTracks()[0].onended = () => {
          stopScreenCapture();
        };
      }
    } catch (err) {
      addTerminalLog('ERROR', `Failed to start screen capture: ${(err as Error).message}`);
    }
  };

  const stopScreenCapture = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScreenCapturing(false);
    addTerminalLog('INFO', 'Screen capture stopped.');
  };

  // --- Handlers ---
  const handleSocketMessage = (rawData: string) => {
    try {
      const data = JSON.parse(rawData);
      
      if (data.type === 'connected') {
        addTerminalLog('SYSTEM', data.message);
        return;
      }

      if (data.type === 'audio_response') {
        playAudioChunk(data.data);
      }

      if (data.type === 'text_response') {
        addTerminalLog('SYSTEM', `[Rakshak]: ${data.text}`);
        setSession(s => ({ ...s, warningActive: true, conversationHistory: [...s.conversationHistory, data.text] }));
        
        // Show verdict overlay
        setVerdict(prev => prev || { scam: true, reason: 'Live interaction warning.', confidence: 99, warning_hi: data.text });
      }

      if (data.type === 'verdict') {
        const confidence = data.confidence || 0.9;
        setSession(s => ({ ...s, lastRiskScore: confidence }));

        if (data.scam) {
          addTerminalLog('WARN', `ALARM TRIGGERED: ${data.reason}`);
          setVerdict({
            scam: true,
            reason: data.reason,
            warning_hi: data.warning_hi,
            confidence: Math.round(confidence * 100)
          });
          setSession(s => ({ ...s, warningActive: true, conversationHistory: [...s.conversationHistory, data.warning_hi] }));
          
          // Debounce TTS and capture log only if we are not already showing a warning
          if (!isWarningActiveRef.current) {
            isWarningActiveRef.current = true;
            playVoiceWarning(data.warning_hi);
            
            // Capture fraud log with the last sent frame
            setFraudLogs(prev => [{
              timestamp: new Date().toLocaleTimeString(),
              reason: data.reason,
              confidence: Math.round(confidence * 100),
              warning_hi: data.warning_hi,
              base64Image: lastSentFrameRef.current
            }, ...prev]);
          }
        } else {
          addTerminalLog('INFO', `Screen SAFE: ${data.reason}`);
          setVerdict(null);
          setSession(s => ({ ...s, warningActive: false }));
          window.speechSynthesis.cancel();
          isWarningActiveRef.current = false; // Reset debounce on safe screen
        }
      }
    } catch (err) {
      addTerminalLog('ERROR', `Parsing socket message failed.`);
    }
  };

  const transmitScreenFrame = (screen: UPIScreen, activeSocket: WebSocket | null = null) => {
    const targetSocket = activeSocket || socketRef.current;
    if (!targetSocket || targetSocket.readyState !== WebSocket.OPEN) return;

    const textContext = `
[Screen Metadata]
Title: ${screen.screenTitle}
Payee Name: ${screen.senderName}
Amount: ₹${screen.amount}
Payment Type: ${screen.isCollectRequest ? 'Collect/Debit Request' : 'Direct Outgoing Transfer'}
Requires PIN: ${screen.requiresPin ? 'Yes' : 'No'}

[OCR Text]
${screen.message}
    `.trim();

    let frameData = 'mock_base64_frame_data_omitted_for_demo';

    // Grab real frame if capturing
    if (isScreenCapturing && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frameData = canvas.toDataURL('image/jpeg', 0.7); // 70% quality JPEG
        }
      }
    }

    // Deduplicate: Don't send if the frame and text context haven't changed since the last send
    if (frameData === lastSentFrameRef.current && textContext === lastSentTextContextRef.current) {
      return;
    }

    lastSentFrameRef.current = frameData;
    lastSentTextContextRef.current = textContext;

    targetSocket.send(JSON.stringify({
      type: 'screen_frame',
      textContext: textContext,
      data: frameData
    }));
  };

  const changeSimulatedScreen = useCallback((screen: UPIScreen) => {
    addTerminalLog('INFO', `Switching to beat: ${screen.name}`);
    setVerdict(null);
    setSession(s => ({ ...s, currentScenario: screen.id, warningActive: false }));
    window.speechSynthesis.cancel();
    isWarningActiveRef.current = false;
    
    // Clear last sent tracking so it forces a fresh send immediately on change
    lastSentFrameRef.current = '';
    lastSentTextContextRef.current = '';
    
    setCurrentScreen(screen);
  }, []);

  // --- Frame Streaming Loop ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (session.watching && isScreenCapturing) {
      addTerminalLog('SYSTEM', 'Streaming live frames to AI core...');
      intervalId = setInterval(() => {
        transmitScreenFrame(currentScreen);
      }, 3000); // Stream a frame every 3 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session.watching, isScreenCapturing, currentScreen]);

  // --- Global Keyboard Demo Controller ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= config.DEMO_SCREENS.length) {
        changeSimulatedScreen(config.DEMO_SCREENS[num - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeSimulatedScreen]);

  const simulateCustomScreen = () => {
    if (!customScamText.trim()) return;
    const customScreen: UPIScreen = {
      id: 'custom_screen_' + Date.now(),
      name: `Custom Screen: "${customPayeeName}"`,
      category: 'scam',
      senderName: customPayeeName,
      handle: 'payee-' + Math.floor(Math.random() * 9000) + '@okaxis',
      amount: 1500,
      message: customScamText,
      isCollectRequest: true,
      requiresPin: true,
      screenTitle: 'Custom Incoming Claim'
    };
    changeSimulatedScreen(customScreen);
  };

  const triggerMockScamUI = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'mock_scam' }));
    } else {
      const mockVerdict = {
        scam: true,
        reason: 'This request asks for a UPI PIN while claiming money will be received.',
        warning_hi: 'Ruko! Ye paisa lene ka nahi, dene ka request hai. PIN daalte hi aapke account se paise kat jaayenge. Ye scam hai.',
        confidence: 92
      };
      setVerdict(mockVerdict);
      setSession(s => ({ ...s, warningActive: true, conversationHistory: [...s.conversationHistory, mockVerdict.warning_hi] }));
      playVoiceWarning(mockVerdict.warning_hi);
    }
  };

  const dismissOverlay = () => {
    setVerdict(null);
    setSession(s => ({ ...s, warningActive: false }));
    window.speechSynthesis.cancel();
    isWarningActiveRef.current = false;
  };

  return (
    <div className="app-container">
      {ttsMissing && (
        <div style={{ background: 'var(--warning-crimson)', color: '#fff', padding: '0.5rem', textAlign: 'center', borderRadius: '8px', marginBottom: '1rem', fontWeight: 600 }}>
          ⚠️ Warning: hi-IN (Hindi) Speech Synthesis voice not found on this browser. Voice warnings may be silent.
        </div>
      )}

      {/* App Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <span className="brand-icon">🛡️</span>
          <div className="brand-title-wrap">
            <h1>Rakshak</h1>
            <p>Proactive AI Guardian</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select 
            className="textarea-custom" 
            style={{ padding: '0.2rem 0.5rem', minHeight: 'auto', backgroundColor: '#252936', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
            value={session.voice}
            onChange={(e) => {
              const voice = e.target.value;
              localStorage.setItem('rakshak_voice', voice);
              setSession(s => ({ ...s, voice }));
              if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: 'setup_live_api', lang: session.language, voice }));
              }
              addTerminalLog('SYSTEM', `Voice changed to ${voice}`);
            }}
          >
            <option value="Aoede">Aoede (Soft Female)</option>
            <option value="Kore">Kore (Clear Female)</option>
            <option value="Puck">Puck (Warm Male)</option>
            <option value="Charon">Charon (Deep Male)</option>
            <option value="Fenrir">Fenrir (Bold Male)</option>
          </select>
          <select 
            className="textarea-custom" 
            style={{ padding: '0.2rem 0.5rem', minHeight: 'auto', backgroundColor: '#252936', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
            value={session.language}
            onChange={(e) => {
              const lang = e.target.value;
              localStorage.setItem('rakshak_language', lang);
              setSession(s => ({ ...s, language: lang }));
              if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: 'setup_live_api', lang, voice: session.voice }));
              }
              addTerminalLog('SYSTEM', `Language changed to ${lang}`);
            }}
          >
            <option value="hi-IN">Hindi</option>
            <option value="en-US">English</option>
            <option value="kn-IN">Kannada</option>
            <option value="te-IN">Telugu</option>
          </select>
          <span style={{ fontSize: '0.85rem', color: session.connected ? 'var(--guardian-emerald)' : 'var(--text-muted)' }}>
            ● {session.connected ? 'LIVE SESSION ACTIVE' : 'OFFLINE'}
          </span>
          {session.watching && <span style={{ fontSize: '0.85rem', color: 'var(--primary-glow)', animation: 'pulse 1.5s infinite' }}>👁️ WATCHING</span>}
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
            <div className="phone-screen-header">
              <span className="phone-time">11:00 AM</span>
              <span className="phone-battery">🔋 98%</span>
            </div>

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
                      <div style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>
                        🔒 Enter UPI PIN to Authenticate
                      </div>
                      <div className="keyboard-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'X', 0, '✓'].map((key) => (
                          <div key={key} className="keyboard-key" onClick={() => addTerminalLog('INFO', `Key Pressed: ${key}`)}>
                            {key}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', padding: '1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📱</span>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Simulator Screen</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Use keyboard shortcuts 1, 2, 3, 4 to switch demo scenarios seamlessly.</p>
                </div>
              )}
            </div>

            {/* --- PREMIUM AI OVERLAY --- */}
            {session.warningActive && verdict && (
              <div className="ai-overlay">
                <div className="ai-overlay-card">
                  <div className="ai-overlay-header">
                    <span className="ai-warning-icon">⚠️</span>
                    <h2 className="ai-overlay-title">Potential Unsafe Transaction</h2>
                  </div>
                  
                  <div className="ai-overlay-reason">
                    <strong>Reason:</strong><br/>
                    {verdict.reason}
                  </div>

                  <div className="ai-confidence-meter">
                    <span>Confidence Score</span>
                    <span>{verdict.confidence || 90}%</span>
                  </div>
                  <div className="ai-confidence-bar">
                    <div className="ai-confidence-fill" style={{ width: `${verdict.confidence || 90}%` }}></div>
                  </div>

                  {/* Conversation UX */}
                  <div className="ai-waveform">
                    <div className="ai-wave-bar"></div><div className="ai-wave-bar"></div>
                    <div className="ai-wave-bar"></div><div className="ai-wave-bar"></div><div className="ai-wave-bar"></div>
                  </div>
                  <div className="ai-transcript typing-effect">
                    {verdict.warning_hi}
                  </div>

                  <button className="ai-overlay-dismiss" onClick={dismissOverlay}>
                    [ Dismiss ]
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Controls */}
        <section className="controls-column">
          <div className="glass-panel">
            <h3 className="glass-panel-title">Live Session Manager</h3>
            <button 
              className={`btn-connect ${session.connected ? 'active' : 'inactive'}`}
              onClick={session.connected ? disconnectWebSocket : connectWebSocket}
              style={{ marginBottom: '10px' }}
            >
              {session.connected ? <><StopCircle size={20} /> Close Live Session</> : <><Radio size={20} /> Open Live Session</>}
            </button>
            <button 
              className={`btn-connect ${isScreenCapturing ? 'active' : 'inactive'}`}
              onClick={isScreenCapturing ? stopScreenCapture : startScreenCapture}
              style={{ marginBottom: '10px' }}
            >
              {isScreenCapturing ? <><MonitorStop size={20} /> Stop Screen Capture</> : <><MonitorPlay size={20} /> Start Screen Capture</>}
            </button>
            <button 
              className={`btn-connect ${isMicActive ? 'active' : 'inactive'}`}
              onClick={isMicActive ? stopMic : startMic}
              style={{ borderColor: isMicActive ? 'var(--guardian-emerald)' : 'rgba(255,255,255,0.1)' }}
            >
              {isMicActive ? '🎤 Stop Microphone' : '🎤 Open Microphone'}
            </button>
          </div>

          {/* Hidden elements for capture */}
          <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className="glass-panel">
            <h3 className="glass-panel-title">Demo Flow Controller</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Use keyboard shortcuts to seamlessly switch screens.</p>
            <div className="beats-grid">
              {config.DEMO_SCREENS.map((screen, idx) => (
                <button
                  key={screen.id}
                  className={`btn-beat ${session.currentScenario === screen.id ? 'active' : ''}`}
                  onClick={() => changeSimulatedScreen(screen)}
                >
                  <strong>[{idx + 1}] {screen.name.split(':')[0]}</strong>
                  <br />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{screen.name.split(':')[1] || ''}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel">
            <h3 className="glass-panel-title">Judge Test Bench</h3>
            <div className="input-group">
              <input type="text" className="textarea-custom" style={{ minHeight: '38px', padding: '0.4rem' }} value={customPayeeName} onChange={(e) => setCustomPayeeName(e.target.value)} />
              <textarea className="textarea-custom" value={customScamText} onChange={(e) => setCustomScamText(e.target.value)} />
              <button className="btn-classify" onClick={simulateCustomScreen}>Inject Custom Screen</button>
            </div>
          </div>

          <div className="glass-panel">
            <h3 className="glass-panel-title">UI Test Tools</h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-beat" style={{ flex: 1, borderColor: 'rgba(255,50,50,0.15)' }} onClick={triggerMockScamUI}>🚨 UI: Mock Scam</button>
              <button className="btn-beat" style={{ flex: 1, borderColor: 'rgba(50,255,100,0.15)' }} onClick={dismissOverlay}>🟢 UI: Reset</button>
            </div>
          </div>

          <div className="glass-panel" style={{ flexGrow: 1 }}>
            <h3 className="glass-panel-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Event Logs</span>
              <span style={{ cursor: 'pointer', padding: '2px 6px' }} onClick={() => setTerminalLogs([])}>Clear</span>
            </h3>
            <div className="terminal-console" ref={logContainerRef}>
              {terminalLogs.map((log, index) => (
                <div key={index} className="terminal-line">
                  <span className="terminal-line-timestamp">[{log.timestamp}]</span>
                  <span className={`terminal-line-${log.level.toLowerCase()}`}>[{log.level}] {log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Fraud Detection Logs Dashboard */}
      {fraudLogs.length > 0 && (
        <section className="fraud-logs-container">
          <h2 className="fraud-logs-title">Fraud Detection Logs</h2>
          <div className="fraud-logs-grid">
            {fraudLogs.map((log, index) => (
              <div key={index} className="log-card">
                <div className="log-card-header">
                  <span className="log-timestamp">{log.timestamp}</span>
                  <span className="log-confidence">{log.confidence}% Confidence</span>
                </div>
                <div className="log-card-body">
                  <div className="log-image-wrapper">
                    {log.base64Image && log.base64Image !== 'mock_base64_frame_data_omitted_for_demo' ? (
                      <img src={log.base64Image} alt="Captured Screen" className="log-thumbnail" />
                    ) : (
                      <div className="log-thumbnail-placeholder">No Image</div>
                    )}
                  </div>
                  <div className="log-details">
                    <p className="log-reason"><strong>Reason:</strong> {log.reason}</p>
                    <p className="log-warning"><strong>TTS:</strong> {log.warning_hi}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
