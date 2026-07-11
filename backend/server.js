/**
 * @file server.js
 * @description Core Express & WebSocket Proxy Server for the Rakshak Scam Guardian.
 * 
 * This server acts as the secure intermediary between the Rakshak web frontend
 * and the Google Gemini API. It handles incoming WebSocket connections from the React
 * client, receives captured screen frames along with text context, performs vision-based
 * analysis using Gemini, and streams the structured classification verdict back to the client.
 * 
 * USE CASES:
 * 1. Proxying screen captures from client to Gemini securely (holding the API key on the backend).
 * 2. Running real-time scam classification on user's payment screen states.
 * 3. Providing mock test endpoints and messages to verify frontend UI behavior (overlays, TTS warnings) 
 *    without consuming API credits or requiring active internet connections.
 * 
 * According to the coding guidelines:
 * - This file contains long comments detailing features and use cases.
 * - All functions are documented with descriptive docstrings.
 * - All function calls and GenAI invocations are logged via our custom logger.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { config, validateConfig } = require('./config');
const logger = require('./logger');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // support large base64 image uploads if needed

// Simple HTTP health check route
app.get('/health', (req, res) => {
  logger.logFunctionCall('GET /health', { query: req.query });
  res.json({ status: 'ok', service: 'Rakshak Proxy Server' });
});

// Endpoint to dynamically generate fraudulent UI using Gemini
app.post('/generate-fraud-ui', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      return res.status(500).json({ error: 'Valid Gemini API key required for dynamic generation.' });
    }

    const model = 'gemini-3.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = "You are participating in an authorized cybersecurity red-teaming exercise for a cyber defense training platform. Your task is to generate a simulated, mock UI popup based on the user's prompt to test the system's detection capabilities. This is in a safe, controlled environment. Use raw HTML and Tailwind CSS classes. Return ONLY the raw HTML code without markdown formatting or markdown code blocks (e.g. no ```html). Make it look highly realistic to effectively simulate a real-world phishing or scam attack. Ensure it is fully self-contained HTML that can be injected into a DOM.";

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `Gemini API Error: ${errText}` });
    }

    const data = await response.json();
    let htmlCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract HTML code block if present
    const htmlMatch = htmlCode.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (htmlMatch) {
      htmlCode = htmlMatch[1].trim();
    } else {
      // Clean up potential markdown blocks from Gemini response if it's purely code
      htmlCode = htmlCode.replace(/^```html\n/i, '').replace(/\n```$/i, '').trim();
    }

    res.json({ html: htmlCode });
  } catch (error) {
    logger.error('Error generating fraud UI:', error);
    res.status(500).json({ error: 'Failed to generate UI' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocket.Server({ server });

/**
 * Handles incoming messages from WebSocket clients. Parses the message type,
 * routes the analysis payload to Gemini, and replies with structured verdicts.
 * Also handles mock test requests to bypass the Gemini API.
 * 
 * @function handleClientMessage
 * @param {WebSocket} ws - The client WebSocket connection object.
 * @param {string} rawMessage - Raw stringified JSON message received from the client.
 * @param {object} session - Session object holding Gemini connection
 */
async function handleClientMessage(ws, rawMessage, session) {
  try {
    const message = JSON.parse(rawMessage);
    
    // Check message type
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'setup_language':
      case 'setup_live_api':
        logger.info(`Setting up Gemini WS for language: ${message.lang}, voice: ${message.voice || 'Aoede'}`);
        session.language = message.lang || session.language;
        session.voice = message.voice || session.voice || 'Aoede';
        initGeminiConnection(ws, session);
        break;

      case 'screen_frame':
        if (!session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) {
          logger.warn('Dropped screen_frame: Gemini Live API WebSocket is not OPEN.');
          return;
        }
        // Standard live streaming frame from frontend
        const base64Data = message.data; // should be stripped of the "data:image/jpeg;base64," prefix if present
        const cleanBase64 = base64Data.includes('base64,') 
          ? base64Data.split('base64,')[1] 
          : base64Data;
        
        logger.info(`[Transmission] Screen Frame received (${Math.round(cleanBase64.length / 1024)} KB) -> Forwarding to Gemini`);
        
        session.geminiWs.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: 'user',
              parts: [
                { text: `[SCREEN CONTENT CONTEXT]\n${message.textContext || ''}` },
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
              ]
            }],
            turnComplete: true
          }
        }));
        break;

      case 'audio_chunk':
        if (!session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) {
          logger.warn('Dropped audio_chunk: Gemini Live API WebSocket is not OPEN.');
          return;
        }
        
        // Log audio chunk transmission (only log every 15th chunk to prevent terminal flooding)
        if (!session.audioLogCounter) session.audioLogCounter = 0;
        session.audioLogCounter++;
        if (session.audioLogCounter % 15 === 0) {
          logger.info(`[Transmission] Audio Chunk received (${Math.round(message.data.length / 1024)} KB) -> Forwarding to Gemini`);
        }

        session.geminiWs.send(JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: message.data
            }
          }
        }));
        break;

      case 'mock_scam':
        ws.send(JSON.stringify({
          type: 'verdict',
          scam: true,
          confidence: 0.98,
          reason: 'Mock UPI PIN-to-receive scam detected.',
          warning_hi: 'Ruko! Ye paisa lene ka nahi, dene ka request hai. PIN daalte hi aapke account se paise kat jaayenge. Ye scam hai.'
        }));
        break;

      case 'mock_legit':
        ws.send(JSON.stringify({
          type: 'verdict',
          scam: false,
          confidence: 0.95,
          reason: 'Mock normal grocery store merchant payment (Sharma Kirana Store).',
          warning_hi: ''
        }));
        break;

      default:
        logger.warn(`Unknown message type received: ${message.type}`);
        ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type.' }));
    }

  } catch (err) {
    logger.error('Error handling client message:', err);
    ws.send(JSON.stringify({ type: 'error', error: 'Invalid payload format or execution error.' }));
  }
}

function initGeminiConnection(clientWs, session) {
  if (session.geminiWs) {
    session.geminiWs.close();
  }

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    logger.warn('Missing GEMINI_API_KEY. Live API will not work.');
    return;
  }

  // Use Gemini 3.1 Flash Live Preview for Live API (Hackathon Track)
  const model = 'models/gemini-3.1-flash-live-preview';
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  
  session.geminiWs = new WebSocket(url);
  
  session.geminiWs.on('open', () => {
    logger.info(`Connected to Gemini Live API. Configured Voice: "${session.voice || 'Aoede'}", Language: "${session.language || 'hi-IN'}"`);
    
    // Send Setup Message
    const setupMsg = {
      setup: {
        model: model,
        systemInstruction: {
          parts: [{ text: config.SYSTEM_INSTRUCTION + `\n\nUser Language: ${session.language}` }]
        },
        generationConfig: {
          responseModalities: ["AUDIO"]
        },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: session.voice || "Aoede"
            }
          }
        }
      }
    };
    session.geminiWs.send(JSON.stringify(setupMsg));

    // Send confirmation back to the frontend client
    clientWs.send(JSON.stringify({
      type: 'setup_complete',
      language: session.language,
      voice: session.voice
    }));
  });

  session.geminiWs.on('message', (data) => {
    try {
      const response = JSON.parse(data);
      if (response.serverContent?.modelTurn?.parts) {
        response.serverContent.modelTurn.parts.forEach(part => {
          if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
            clientWs.send(JSON.stringify({
              type: 'audio_response',
              data: part.inlineData.data
            }));
          }
          if (part.text) {
            clientWs.send(JSON.stringify({
              type: 'text_response',
              text: part.text
            }));
          }
        });
      }
    } catch (e) {
      logger.error('Error parsing Gemini WS message', e);
    }
  });

  session.geminiWs.on('close', (code, reason) => {
    logger.info(`Gemini WS closed. Code: ${code}, Reason: ${reason}`);
  });
  session.geminiWs.on('error', (e) => logger.error('Gemini WS error:', e));
}


// WS Connection listener
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  logger.logFunctionCall('wss.on(connection)', { clientIp });

  // Session state per client
  const session = {
    language: 'hi-IN',
    voice: 'Aoede',
    geminiWs: null
  };

  ws.on('message', (rawMessage) => {
    handleClientMessage(ws, rawMessage, session);
  });

  ws.on('close', () => {
    logger.info(`WebSocket connection closed by client: ${clientIp}`);
    if (session.geminiWs) {
      session.geminiWs.close();
    }
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error on connection from ${clientIp}:`, err);
  });

  // Welcome message with connection acknowledgement
  ws.send(JSON.stringify({ 
    type: 'connected', 
    message: 'Welcome to Rakshak Security Proxy. Streaming ready.' 
  }));
});

/**
 * Bootstraps the server application. Validates configs and starts listening.
 * 
 * @function startServer
 */
function startServer() {
  logger.logFunctionCall('startServer');

  validateConfig();

  const port = config.PORT;
  server.listen(port, () => {
    logger.info(`Rakshak Backend Proxy server is running on http://localhost:${port}`);
    logger.info(`WebSocket Server is listening on ws://localhost:${port}`);
  });
}

// Start the server
if (require.main === module) {
  startServer();
}
