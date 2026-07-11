/**
 * @file test_gemini.js
 * @description Non-destructive Test Script for the Rakshak Scam Detection Engine.
 * 
 * This script allows testing the Gemini API connectivity, system instructions,
 * and JSON classification logic without modifying any database or application states.
 * It mocks screen vision inputs (such as a 1x1 JPEG base64 frame) and prompts Gemini
 * to return a structured security verdict.
 * 
 * USE CASES:
 * 1. Verifying that the provided GEMINI_API_KEY is active and valid.
 * 2. Testing how Gemini responds to normal vs scam user contexts.
 * 3. Validating the structured JSON response format of the system instructions.
 * 
 * According to the coding guidelines:
 * - This file contains long comments detailing features and use cases.
 * - All function calls and their inputs/outputs are logged through our custom logger.
 * - This provides a way to test scripts without altering any state.
 */

const { config, validateConfig } = require('./config');
const logger = require('./logger');

// A valid base64 1x1 white pixel JPEG image to simulate screen capture
const MOCK_SCREEN_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

/**
 * Runs a test classification against the Gemini API using native fetch.
 * Simulates different phone screen states and prints the result via the custom logger.
 * 
 * @async
 * @function runTestClassification
 * @param {string} scenarioDescription - Describe the payment context (e.g. UPI Collect, scan QR).
 * @param {string} textOnScreen - The fake OCR/extracted text that appears on the screen.
 * @returns {Promise<object|null>} The parsed JSON verdict from Gemini, or null if it failed.
 */
async function runTestClassification(scenarioDescription, textOnScreen) {
  // 1. Log function invocation with parameters
  logger.logFunctionCall('runTestClassification', { scenarioDescription, textOnScreen });

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    logger.warn('Cannot run real classification: GEMINI_API_KEY is missing or invalid. Returning offline mock.');
    const context = (textOnScreen || '').toLowerCase();
    return {
      scam: context.includes('lottery') || context.includes('kyc'),
      confidence: 0.98,
      reason: 'Offline Mock Output',
      warning_hi: 'Mock warning.'
    };
  }

  // Use the central model configuration
  const model = config.GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Assemble the contents: custom systemInstruction + image frame + text context
  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: MOCK_SCREEN_JPEG_BASE64
            }
          },
          {
            text: `[SCENARIO CONTEXT]
User is on a payment page. Here is the context of what they are experiencing:
${scenarioDescription}

[TEXT EXTRACTED ON SCREEN]
${textOnScreen}

Analyze this screen. Use your system instructions to decide if this is a deceptive scam/fraud or a safe/legit scenario.`
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
    logger.info(`Sending request to Gemini endpoint using model ${model}...`);
    
    // Note: We log the GenAI call with parameters, stripping out base64 payload
    logger.logGenAICall(model, payload.contents, { responseMimeType: 'application/json' }, 'Awaiting API response...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Parse Gemini's text response content
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Gemini API response structure is invalid or candidates are empty.');
    }

    let parsedVerdict;
    try {
      parsedVerdict = JSON.parse(responseText.trim());
    } catch (parseError) {
      logger.error('Failed to parse Gemini response as JSON. Raw text:', responseText);
      parsedVerdict = { raw_text: responseText };
    }

    // Log the output of the GenAI call
    logger.logGenAICall(model, payload.contents, { responseMimeType: 'application/json' }, parsedVerdict);
    
    return parsedVerdict;

  } catch (err) {
    logger.error('Error during test classification:', err);
    return null;
  }
}

/**
 * Main entry point for the non-destructive test execution.
 * Simulates multiple scenarios (legitimate payment vs. a known "PIN to receive" scam).
 * 
 * @async
 * @function main
 */
async function main() {
  logger.logFunctionCall('main');

  if (!validateConfig()) {
    logger.warn('Setup warning: Configuration is invalid or missing real GEMINI_API_KEY. Using offline mock mode.');
  }

  console.log('\n--- STARTING SCENARIO 1: SCAM DETECTION ---');
  // Scenario 1: Typical collect request fraud
  const scamContext = 'User was told over WhatsApp that they won a lottery and need to enter their UPI PIN to "receive" ₹10,000.';
  const scamScreenOCR = 'Collect Request from Unknown Payee (ka7391@okaxis)\nAmount: ₹10,000\nMessage: Cashprize lottery win. Enter PIN to claim refund / receive reward.\n[BUTTON: Pay/Approve]';
  await runTestClassification(scamContext, scamScreenOCR);

  console.log('\n--- STARTING SCENARIO 2: LEGITIMATE PAYMENT (SILENT) ---');
  // Scenario 2: Normal merchant payment
  const legitContext = 'User scans a QR code at a grocery store and is initiating a payment to a verified store owner.';
  const legitScreenOCR = 'Paying Sharma Kirana Store\nAmount: ₹250\nUPI ID: sharmastore@ybl\n[BUTTON: Pay]';
  await runTestClassification(legitContext, legitScreenOCR);

  logger.info('Test execution completed.');
}

// Automatically execute if run directly
if (require.main === module) {
  main();
}
