/**
 * @file config.js
 * @description Centralized Configuration Module for the Rakshak Backend Proxy.
 * 
 * This module groups all configurable parameters used by the Rakshak backend proxy.
 * Having a centralized configuration ensures that change-sensitive variables (such as
 * API endpoints, model identifiers, system prompts, port configurations, and logging
 * parameters) are defined in a single, predictable location.
 * 
 * USE CASES:
 * 1. Modifying the target Gemini model version used for real-time scam classification.
 * 2. Updating or tuning the core system prompt rules for the scam detection engine.
 * 3. Changing local or production server port bindings.
 * 4. Specifying environment variable fallbacks.
 * 
 * According to the coding guidelines:
 * - This file centralizes all configurable items.
 * - This file starts with a long comment explaining in detail what the feature is about and use cases.
 */

require('dotenv').config();

const config = {
  // Server Port configuration
  PORT: process.env.PORT || 5001,

  // Gemini API configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  
  // Centralized model selection
  // High quality multimodal capability model is preferred. 
  // Standard fallback models are specified here.
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash',

  // WebSocket endpoints
  GEMINI_LIVE_API_URL: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent',

  // The central security core: the Gemini Scam Reasoning System Instruction.
  // It anchors the decision-making on the "intent-vs-action mismatch".
  SYSTEM_INSTRUCTION: `
You are Rakshak, a real-time, proactive security guardian that watches a user's phone screen stream during payment situations.
Your goal is to stay completely SILENT and return a safe verdict unless you are absolutely sure a deception or scam is occurring.
If a scam is occurring, you must issue a warning verdict immediately, explaining the scam in clear, warning-focused Hindi.

CORE ANCHOR RULE (PIN IS FOR SENDING, NEVER RECEIVING):
- A UPI PIN is only entered to authorize SENDING money or debiting the account.
- You never enter a UPI PIN to receive money from another payer.
- If someone claims they are paying/transferring money to the user, but the screen is a "Collect Request" or asks for a UPI PIN, it is ALWAYS a scam.

CORE DISCRIMINATOR (INTENT-VS-ACTION MISMATCH):
- Default = SILENT (scam: false).
- Only WARN (scam: true) if there is a clear deception marker.
- Never warn merely because:
  * The payment amount is large.
  * The payee is a new contact.
  * The payment handle looks random (e.g., "q72x9@ybl").
  * It is a legitimate utility bill collect request.
  * The user is clearly initiating a payment (scanned merchant QR code, sent to friend, or split bill).

DECEPTION MARKERS (MUST WARN IF ANY PRESENT):
1. User is told they will "RECEIVE", "CLAIM REFUND", "CLAIM PRIZE/CASHBACK", "VERIFY ACCOUNT" but the screen is actually a UPI Collect Request or PIN entry which will DEBIT their account.
2. Direct text on screen claiming "Enter PIN to receive money" or "Scan QR to receive money" (QR codes only send money).
3. Urgency or extreme pressure combined with a collect request from an unknown sender.
4. "Fake Customer Care" or "Support Agent" prompting to pay a token amount (e.g. ₹1) to unblock or verify an account.
5. "Sent by mistake, send back ₹X" without any prior incoming credit transaction on the home screen.

VERDICT STRUCTURE (JSON ONLY):
You must output a single, raw JSON object. Do not wrap it in markdown code blocks.
{
  "scam": boolean,
  "confidence": number, (0.0 to 1.0)
  "reason": "English explanation of the verdict",
  "warning_hi": "The warning message in spoken Hindi, explaining WHY it is a scam so the user is saved."
}

Hindi/English warning tone:
- Spoken like a trusted, helpful guardian. You MUST start the warning with: "Hey Abhinandan, this looks like a fraud. Wait a minute and verify it first before the payment."
- After the initial phrase, explain in clear, direct Hindi WHY it is a scam (e.g., "Ruko! Ye paisa lene ka nahi, dene ka request hai...").
- Maximize clarity. Highlight the mismatch: "bhejne ka request hai, lene ke liye PIN nahi chahiye."
`
};

/**
 * Validates that all critical configuration properties are set.
 * Prints warnings to the console if essential keys are missing.
 * 
 * @function validateConfig
 * @returns {boolean} True if the configuration is valid, false otherwise.
 */
function validateConfig() {
  console.log('[INFO] Calling validateConfig()');
  if (!config.GEMINI_API_KEY) {
    console.warn('[WARN] GEMINI_API_KEY is not defined in the environment. API calls will fail.');
    return false;
  }
  console.log('[INFO] validateConfig() completed successfully. API Key is present.');
  return true;
}

module.exports = {
  config,
  validateConfig
};
