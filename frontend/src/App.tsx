/**
 * @file App.tsx
 * @description Core React Component for the Rakshak Mobile Simulator and Scam Guardian Overlay.
 * 
 * This component renders the entire interactive hackathon showcase interface.
 * Implements a premium UI, robust SessionState, and global keyboard handlers for the demo.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, StopCircle, MonitorPlay, MonitorStop } from 'lucide-react';
import { config } from './config.ts';

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
  const defaultVoice = localStorage.getItem('rakshak_voice') || 'Kore';
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

  const [verdict, setVerdict] = useState<{ scam: boolean; reason: string; warning_hi: string; confidence?: number } | null>(null);
  
  
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
        transmitScreenFrame(socket);
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
  }, [session.language, session.voice]);

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
    // Disabled TTS fallback. We strictly rely on Gemini Live API's native PCM voice output.
    /*
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = session.language;
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.includes(session.language));
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
    */
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

      if (data.type === 'setup_complete') {
        addTerminalLog('SYSTEM', `Gemini configuration active. Voice: ${data.voice}, Language: ${data.language}`);
        lastSentFrameRef.current = '';
        transmitScreenFrame();
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

  const transmitScreenFrame = (activeSocket: WebSocket | null = null) => {
    const targetSocket = activeSocket || socketRef.current;
    if (!targetSocket || targetSocket.readyState !== WebSocket.OPEN) return;

    let frameData = '';

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

    if (!frameData) return;

    // Deduplicate: Don't send if the frame hasn't changed since the last send
    if (frameData === lastSentFrameRef.current) {
      return;
    }

    lastSentFrameRef.current = frameData;

    targetSocket.send(JSON.stringify({
      type: 'screen_frame',
      textContext: '', // Native Multimodal Gemini does not need text Context
      data: frameData
    }));
  };

  // --- Frame Streaming Loop ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (session.watching && isScreenCapturing) {
      addTerminalLog('SYSTEM', 'Streaming live frames to AI core...');
      intervalId = setInterval(() => {
        transmitScreenFrame();
      }, 3000); // Stream a frame every 3 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session.watching, isScreenCapturing]);



  const dismissOverlay = () => {
    setVerdict(null);
    setSession(s => ({ ...s, warningActive: false }));
    window.speechSynthesis.cancel();
    isWarningActiveRef.current = false;
    lastSentFrameRef.current = '';
    // Immediately re-transmit the current frame to resume proactive monitoring
    transmitScreenFrame();
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
                lastSentFrameRef.current = '';
                socketRef.current.send(JSON.stringify({ type: 'setup_live_api', lang: session.language, voice }));
              } else {
                addTerminalLog('SYSTEM', `Voice configured to ${voice} (will apply on next connection)`);
              }
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
                lastSentFrameRef.current = '';
                socketRef.current.send(JSON.stringify({ type: 'setup_live_api', lang, voice: session.voice }));
              } else {
                addTerminalLog('SYSTEM', `Language configured to ${lang} (will apply on next connection)`);
              }
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
        {/* Left Column: Guardian View (Screen Capture) */}
        <section className="guardian-view" style={{ background: '#1c1f2e', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Guardian View</h3>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: isScreenCapturing ? 'var(--guardian-emerald)' : 'var(--warning-crimson)', borderRadius: '4px', color: '#fff', fontWeight: 600 }}>
              {isScreenCapturing ? 'CAPTURING' : 'STANDBY'}
            </span>
          </div>
          <div style={{ flexGrow: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f111a' }}>
            {/* The video element is moved here to be visible to the user */}
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'contain', display: isScreenCapturing ? 'block' : 'none' }} muted playsInline />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {!isScreenCapturing && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <MonitorPlay size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>Start Screen Capture to monitor device activity.</p>
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
