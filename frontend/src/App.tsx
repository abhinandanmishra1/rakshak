/**
 * @file App.tsx
 * @description Core React Component for the Rakshak Mobile Simulator and Scam Guardian Overlay.
 * 
 * This component renders the entire interactive hackathon showcase interface.
 * Implements a premium UI, robust SessionState, and global keyboard handlers for the demo.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, ShieldCheck, Volume2, Eye, ArrowRight, Home, Terminal } from 'lucide-react';
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

  // --- Screen Capture State ---
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);

  // --- Initial Mount Actions ---
  useEffect(() => {
    addTerminalLog('SYSTEM', 'Rakshak AI Intervention Console Initialized. Waiting for Shield Activation...');
    
    // Check for TTS Engine
    if ('speechSynthesis' in window) {
      setTimeout(() => {
        const voices = window.speechSynthesis.getVoices();
        const hasHindi = voices.some(v => v.lang.includes('hi-IN'));
        if (!hasHindi) {
          addTerminalLog('WARN', 'Hindi Speech Synthesis voice not found. PCM Audio stream fallback active.');
        }
      }, 1000); // Give time for voices to load
    } else {
      addTerminalLog('ERROR', 'Speech Synthesis API not supported on this browser.');
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
      
      // Speed up playback to make the guardian's response brisk and prompt (1.20x speed)
      const speed = 1.20;
      source.playbackRate.value = speed;
      
      source.connect(audioContextRef.current.destination);

      const currentTime = audioContextRef.current.currentTime;
      if (nextStartTimeRef.current < currentTime) {
          nextStartTimeRef.current = currentTime;
      }
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += (audioBuffer.duration / speed);
    } catch(err) {
      addTerminalLog('ERROR', 'Audio playback failed');
    }
  };

  const playVoiceWarning = (_text: string) => {
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


  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const dismissOverlay = () => {
    setVerdict(null);
    setSession(s => ({ ...s, warningActive: false }));
    window.speechSynthesis.cancel();
    isWarningActiveRef.current = false;
    lastSentFrameRef.current = '';
    // Immediately re-transmit the current frame to resume proactive monitoring
    transmitScreenFrame();
  };

  if (currentPath === '/') {
    return (
      <div className="landing-layout" style={{ minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="landing-container" style={{ padding: '5rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <section className="landing-hero" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem', marginBottom: '4rem' }}>
            <span className="landing-badge" style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--guardian-emerald)', padding: '0.4rem 1.2rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              🛡️ Real-Time Cognitive Safety
            </span>
            <h2 style={{ fontSize: '3rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
              Proactive <span style={{ background: 'linear-gradient(135deg, #10b981 0%, #0072ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Intervention</span> Engine
            </h2>
            <p style={{ fontSize: '1.15rem', color: '#475569', maxWidth: '720px', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
              Rakshak is an advanced cognitive safety companion. By continuously analyzing device screens and audio feeds, Rakshak pre-emptively intervenes <em>before</em> you complete any unsafe transaction, protectively guarding against all forms of digital deception.
            </p>
            <button 
              className="btn-launch-console" 
              onClick={() => navigateTo('/dashboard')}
              style={{ 
                marginTop: '1rem',
                padding: '0.85rem 2rem', 
                fontSize: '1rem', 
                fontWeight: 700, 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #10b981 0%, #0072ff 100%)', 
                color: '#fff', 
                border: 'none', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              Access AI Intervention Console <ArrowRight size={18} />
            </button>
          </section>

          <section className="landing-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
            <div className="landing-feature-card" style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 20px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="landing-feature-icon-wrapper blue" style={{ width: '48px', height: '42px', borderRadius: '12px', background: 'rgba(0, 114, 255, 0.08)', color: '#0072ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Continuous Interaction Sight</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.5 }}>
                Streams real-time visual screen frames directly to Gemini's multimodal core to analyze design context, uncover hidden deceptions, and detect social engineering.
              </p>
            </div>

            <div className="landing-feature-card" style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 20px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="landing-feature-icon-wrapper green" style={{ width: '48px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--guardian-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Volume2 size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Bilingual Verbal Shield</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.5 }}>
                Pipes native high-speed verbal notifications and natural dialogue directly to your speakers to instantly interrupt unsafe choices in your preferred local language.
              </p>
            </div>

            <div className="landing-feature-card" style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 20px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="landing-feature-icon-wrapper purple" style={{ width: '48px', height: '42px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.08)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Cognitive Safety Hub</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.5 }}>
                A unified core that reasons across multiple scenarios. Guards against UPI PIN fraud, deceptive refunds, phone support traps, and phishing.
              </p>
            </div>
          </section>

          <section className="landing-cta-card" style={{ background: '#fff', padding: '3rem 2rem', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 850, color: '#0f172a' }}>Start Your Cognitive Protection</h3>
            <p style={{ margin: 0, fontSize: '1rem', color: '#475569', maxWidth: '600px', lineHeight: 1.5 }}>
              Open a live session to experience real-time AI security. Share your screen, start the live audio shield, and enjoy immediate assistance across all active apps.
            </p>
            <button 
              className="btn-launch-console" 
              onClick={() => navigateTo('/dashboard')}
              style={{ 
                marginTop: '0.5rem',
                padding: '0.85rem 2rem', 
                fontSize: '1rem', 
                fontWeight: 700, 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #10b981 0%, #0072ff 100%)', 
                color: '#fff', 
                border: 'none', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.25)'
              }}
            >
              Launch AI Intervention Console <ArrowRight size={18} />
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        {/* Brand Section */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">🛡️</div>
          <div className="sidebar-brand-title">
            <h1>Rakshak</h1>
            <p>PROACTIVE AI GUARDIAN</p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="sidebar-nav">
          <button 
            className={`sidebar-nav-btn ${currentPath === '/' ? 'active' : ''}`}
            onClick={() => navigateTo('/')}
          >
            <Home size={18} />
            <span>Home</span>
          </button>

          <button 
            className={`sidebar-nav-btn ${currentPath === '/dashboard' ? 'active' : ''}`}
            onClick={() => navigateTo('/dashboard')}
          >
            <Terminal size={18} />
            <span>Guardian View</span>
          </button>
        </nav>

        {/* System Status bottom card */}
        <div className="sidebar-status-card">
          <div className="sidebar-status-header">
            <div className="sidebar-status-icon">✓</div>
            <div className="sidebar-status-title">
              <span className="sidebar-status-label">System Status</span>
              <span className="sidebar-status-value">STANDBY</span>
            </div>
          </div>
          <span className="sidebar-status-desc">All systems nominal</span>
          {/* Animated Waveform */}
          <div className="sparkline-wave">
            <div className="sparkline-bar"></div>
            <div className="sparkline-bar"></div>
            <div className="sparkline-bar"></div>
            <div className="sparkline-bar"></div>
            <div className="sparkline-bar"></div>
            <div className="sparkline-bar"></div>
            <div className="sparkline-bar"></div>
            <div className="sparkline-bar"></div>
          </div>
        </div>
      </aside>

      {/* Right Main Content Panel */}
      <div className="main-panel">
        {/* Main Content Header */}
        <header className="app-header" style={{
          padding: '1.5rem 2rem',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Guardian View
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Real-time proactive monitoring stream
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Elegant Language Selector Dropdown with light background */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              backgroundColor: '#f1f5f9', 
              padding: '0.45rem 0.85rem', 
              borderRadius: '10px', 
              border: '1px solid #e2e8f0',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: '0.95rem', color: '#64748b', display: 'flex', alignItems: 'center' }}>🌐</span>
              <select 
                style={{ 
                  border: 'none', 
                  backgroundColor: 'transparent', 
                  color: '#0f172a', 
                  fontSize: '0.88rem', 
                  fontWeight: 700, 
                  outline: 'none', 
                  cursor: 'pointer',
                  padding: '0 0.25rem'
                }}
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
                <option value="hi-IN">Hindi (हिंदी)</option>
                <option value="en-US">English</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
              </select>
            </div>

            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: session.connected ? 'var(--guardian-emerald)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: session.connected ? 'rgba(16,185,129,0.06)' : '#f1f5f9', padding: '0.45rem 0.85rem', borderRadius: '10px', border: session.connected ? '1px solid rgba(16,185,129,0.15)' : '1px solid #e2e8f0' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: session.connected ? 'var(--guardian-emerald)' : '#94a3b8' }} />
              {session.connected ? 'LIVE INTERVENTION ACTIVE' : 'OFFLINE'}
            </span>
          </div>
        </header>

        {/* Dashboard Grid Content */}
        <div style={{ padding: '2rem', flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <main className="dashboard-grid">
            {/* Left Column: Intervention View (Screen Capture) */}
            <section className="guardian-view" style={{ background: '#1c1f2e', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Intervention Sight</h3>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: isScreenCapturing ? 'var(--guardian-emerald)' : 'var(--warning-crimson)', borderRadius: '4px', color: '#fff', fontWeight: 600 }}>
                  {isScreenCapturing ? 'MONITORING' : 'STANDBY'}
                </span>
              </div>
              <div style={{ flexGrow: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f111a', minHeight: '320px' }}>
                <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'contain', display: isScreenCapturing ? 'block' : 'none' }} muted playsInline />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {!isScreenCapturing && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Eye size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>Start Screen Capture to monitor user interactions.</p>
                  </div>
                )}
              </div>

              {/* --- PREMIUM AI OVERLAY --- */}
              {session.warningActive && verdict && (
                <div className="ai-overlay">
                  <div className="ai-overlay-card">
                    <div className="ai-overlay-header">
                      <span className="ai-warning-icon">⚠️</span>
                      <h2 className="ai-overlay-title">Unsafe Interaction Detected</h2>
                    </div>
                    
                    <div className="ai-overlay-reason">
                      <strong>Intervention Analysis:</strong><br/>
                      {verdict.reason}
                    </div>

                    <div className="ai-confidence-meter">
                      <span>Intervention Decision Confidence</span>
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
                      [ Resume Protection ]
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Right Column: Controls */}
            <section className="controls-column">
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 className="glass-panel-title" style={{ margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.03)', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '4px', height: '16px', backgroundColor: '#0072ff', borderRadius: '2px' }} />
                  Live Session Manager
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Connection Row */}
                  <button 
                    onClick={session.connected ? disconnectWebSocket : connectWebSocket}
                    className={`interactive-row-btn ${session.connected ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: session.connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 114, 255, 0.08)',
                        color: session.connected ? 'var(--guardian-emerald)' : '#0072ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Radio size={18} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                          {session.connected ? 'Connected to AI Engine' : 'Open Live Session'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {session.connected ? 'WebSocket stream active' : 'Initialize secure bidirectional socket'}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>➔</span>
                  </button>

                  {/* Screen Capture Row */}
                  <button 
                    onClick={isScreenCapturing ? stopScreenCapture : startScreenCapture}
                    className={`interactive-row-btn ${isScreenCapturing ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: isScreenCapturing ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 114, 255, 0.08)',
                        color: isScreenCapturing ? 'var(--guardian-emerald)' : '#0072ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Eye size={18} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                          {isScreenCapturing ? 'Capturing Device Screen' : 'Start Screen Capture'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {isScreenCapturing ? 'Frames streaming live' : 'Observe device interactions proactively'}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>➔</span>
                  </button>

                  {/* Microphone Row */}
                  <button 
                    onClick={isMicActive ? stopMic : startMic}
                    className={`interactive-row-btn ${isMicActive ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: isMicActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 114, 255, 0.08)',
                        color: isMicActive ? 'var(--guardian-emerald)' : '#0072ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Volume2 size={18} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                          {isMicActive ? 'Bilingual Verbal Shield Active' : 'Open Microphone'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {isMicActive ? 'Listening for verbal clues' : 'Enable voice-driven discussion shield'}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>➔</span>
                  </button>
                </div>
              </div>

              {/* Console Event Streams */}
              <div className="glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', minHeight: '220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                  <h3 className="glass-panel-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-block', width: '4px', height: '16px', backgroundColor: '#0072ff', borderRadius: '2px' }} />
                    Console Event Streams
                  </h3>
                  <button 
                    onClick={() => setTerminalLogs([])}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    🗑️ Clear
                  </button>
                </div>
                <div className="terminal-console" ref={logContainerRef} style={{ maxHeight: '180px', flexGrow: 1, minHeight: '120px', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '10px', overflowY: 'auto' }}>
                  {terminalLogs.map((log, index) => (
                    <div key={index} className="terminal-line" style={{ marginBottom: '4px', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      <span className="terminal-line-timestamp" style={{ color: '#94a3b8', marginRight: '6px' }}>[{log.timestamp}]</span>
                      <span className={`terminal-line-${log.level.toLowerCase()}`} style={{ 
                        color: log.level === 'SYSTEM' ? '#38bdf8' : log.level === 'WARN' ? '#f59e0b' : log.level === 'ERROR' ? '#ef4444' : '#10b981'
                      }}>[{log.level}] {log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>

          {/* AI Intervention Logs Dashboard (Full Width Bottom) */}
          {fraudLogs.length > 0 && (
            <section className="fraud-logs-container" style={{ marginTop: '2rem' }}>
              <h2 className="fraud-logs-title" style={{ color: 'var(--primary-glow)', borderLeftColor: 'var(--primary-glow)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>
                AI Intervention Logs
              </h2>
              <div className="fraud-logs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {fraudLogs.map((log, index) => (
                  <div key={index} className="log-card" style={{ borderColor: 'rgba(0, 114, 255, 0.08)', background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div className="log-card-header" style={{ background: 'rgba(0, 114, 255, 0.02)', borderBottom: '1px solid rgba(0, 114, 255, 0.05)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="log-timestamp" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{log.timestamp}</span>
                      <span className="log-confidence" style={{ color: '#0072ff', fontSize: '0.8rem', fontWeight: 700 }}>{log.confidence}% Intervention Confidence</span>
                    </div>
                    <div className="log-card-body" style={{ padding: '1.25rem', display: 'flex', gap: '1rem' }}>
                      <div className="log-image-wrapper" style={{ flexShrink: 0, width: '80px', height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>
                        {log.base64Image && log.base64Image !== 'mock_base64_frame_data_omitted_for_demo' ? (
                          <img src={log.base64Image} alt="Captured Screen" className="log-thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div className="log-thumbnail-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: '0.75rem' }}>No Image</div>
                        )}
                      </div>
                      <div className="log-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p className="log-reason" style={{ fontSize: '0.85rem', margin: 0, color: '#1e293b' }}>
                          <strong style={{ color: '#0f172a' }}>Reason:</strong> {log.reason}
                        </p>
                        <p className="log-warning" style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-muted)' }}>
                          <strong style={{ color: '#475569' }}>Dialogue Shield:</strong> {log.warning_hi}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
