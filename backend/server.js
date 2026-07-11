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

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocket.Server({ server });

/**
 * Sends a POST request to the Google Gemini API to analyze the given screen frame
 * and context text based on the defined scam prevention rules.
 * 
 * @async
 * @function analyzeScreenFrame
 * @param {string} base64Image - Base64 encoded image string (JPEG/PNG) representing the screen capture.
 * @param {string} textContext - Extracted text, active UI state, or user journey description.
 * @returns {Promise<object>} Object containing the scam assessment: { scam: boolean, confidence: number, reason: string, warning_hi: string }
 */
async function analyzeScreenFrame(base64Image, textContext) {
  logger.logFunctionCall('analyzeScreenFrame', { 
    base64ImageLength: base64Image ? base64Image.length : 0, 
    textContext 
  });

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error('Missing GEMINI_API_KEY. Cannot perform analysis.');
    return {
      scam: false,
      confidence: 0,
      reason: 'Backend is misconfigured: Missing API Key.',
      warning_hi: ''
    };
  }

  const model = config.GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build standard Gemini Vision content payload
  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: `[SCREEN CONTENT ANALYSIS]
Identify if this payment screen is a scam/deception.

[SCREEN EXTRACTED TEXT OR CONTEXT]
${textContext || 'No additional text context extracted.'}

Provide your analysis in accordance with your security guidelines.`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: config.SYSTEM_INSTRUCTION }
      ]
    },
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  try {
    logger.logGenAICall(model, payload.contents, payload.generationConfig, 'Awaiting API Response...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error('No classification text returned from Gemini.');
    }

    const verdict = JSON.parse(resultText.trim());
    
    logger.logGenAICall(model, payload.contents, payload.generationConfig, verdict);
    return verdict;

  } catch (err) {
    logger.error('Error during live Gemini analysis:', err);
    return {
      scam: false,
      confidence: 0,
      reason: `Error calling AI model: ${err.message}`,
      warning_hi: ''
    };
  }
}

/**
 * Handles incoming messages from WebSocket clients. Parses the message type,
 * routes the analysis payload to Gemini, and replies with structured verdicts.
 * Also handles mock test requests to bypass the Gemini API.
 * 
 * @function handleClientMessage
 * @param {WebSocket} ws - The client WebSocket connection object.
 * @param {string} rawMessage - Raw stringified JSON message received from the client.
 */
async function handleClientMessage(ws, rawMessage) {
  logger.logFunctionCall('handleClientMessage', { rawMessageLength: rawMessage ? rawMessage.length : 0 });

  try {
    const message = JSON.parse(rawMessage);
    
    // Check message type
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'screen_frame':
        // Standard live streaming frame from frontend
        const base64Data = message.data; // should be stripped of the "data:image/jpeg;base64," prefix if present
        const cleanBase64 = base64Data.includes('base64,') 
          ? base64Data.split('base64,')[1] 
          : base64Data;
        
        const verdict = await analyzeScreenFrame(cleanBase64, message.textContext);
        ws.send(JSON.stringify({
          type: 'verdict',
          ...verdict
        }));
        break;

      case 'mock_scam':
        // Non-destructive mock test for UI validation (Scenario: PIN-to-receive)
        logger.info('Handling mock_scam message for UI testing.');
        ws.send(JSON.stringify({
          type: 'verdict',
          scam: true,
          confidence: 0.98,
          reason: 'Mock UPI PIN-to-receive scam detected.',
          warning_hi: 'Ruko! Ye paisa lene ka nahi, dene ka request hai. PIN daalte hi aapke account se paise kat jaayenge. Paisa lene ke liye kabhi PIN nahi daala jaata. Ye scam hai.'
        }));
        break;

      case 'mock_legit':
        // Non-destructive mock test for UI validation (Scenario: QR Merchant Pay)
        logger.info('Handling mock_legit message for UI testing.');
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

// WS Connection listener
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  logger.logFunctionCall('wss.on(connection)', { clientIp });

  ws.on('message', (rawMessage) => {
    handleClientMessage(ws, rawMessage);
  });

  ws.on('close', () => {
    logger.info(`WebSocket connection closed by client: ${clientIp}`);
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
