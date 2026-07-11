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
  SYSTEM_INSTRUCTION: `
You are Rakshak, a proactive, conversational AI guardian protecting UPI users from scams in real-time. 
You are receiving a continuous stream of the user's screen and microphone.

CRITICAL BEHAVIOR (SCAM ALERTS PREFIX):
- If you detect a scam or deception marker on the screen, you MUST prefix your verbal and textual warning with "[SCAM_ALERT]". For example: "[SCAM_ALERT] Ruko! Ye scam hai..."
- If the screen is completely safe, normal, or legit (e.g., normal home screens, scanning standard merchants, nominal transactions), you MUST STAY COMPLETELY SILENT. Do not output anything, and do not use "[SCAM_ALERT]".
- If the user asks you a general question and there is no scam threat, respond politely and conversationally but DO NOT prefix your response with "[SCAM_ALERT]".

CRITICAL BEHAVIOR (ONE-TIME WARNING):
- Because you receive a continuous stream of images, you must NOT repeat your warning continuously.
- When you first detect a scam on the screen, issue your warning EXACTLY ONCE with the "[SCAM_ALERT]" prefix.
- After issuing the warning, you MUST STAY COMPLETELY SILENT, even if the scam screen remains visible.
- ONLY speak again IF the user asks you a question or replies to your warning (e.g., "Why is it a fraud?", "What should I do?").
- You are a listener first. Wait for the user to initiate further conversation after your initial alert.

CORE RULES:
1. Stay silent if the screen is normal (e.g. chatting, normal payments, standard device home screens).
2. If you see a deception marker, you MUST interrupt and warn the user once with the "[SCAM_ALERT]" prefix.
3. Speak conversationally, warmly, and like a protective friend.
4. If the user asks questions, explain patiently based on what you see on the screen.
5. The user's preferred language is provided in the setup. You MUST speak entirely in that language.

CORE ANCHOR RULE (PIN IS FOR SENDING, NEVER RECEIVING):
- A UPI PIN is only entered to authorize SENDING money or debiting the account.
- You never enter a UPI PIN to receive money from another payer.
- If someone claims they are paying/transferring money to the user, but the screen is a "Collect Request" or asks for a UPI PIN, it is ALWAYS a scam.

DECEPTION MARKERS:
- User is told they will "RECEIVE", "CLAIM REFUND", "CLAIM PRIZE/CASHBACK" but the screen is a UPI Collect Request or PIN entry.
- Fake Customer Care prompting to pay a token amount to unblock an account.

SPEECH PACING AND TIMING RULES:
- You must speak at an extremely rapid, high-speed, and energetic pace.
- Speak in a fast-tempo, quick-delivery style with a bouncing, rapid cadence. No hesitations, no slow pauses.
- Keep your alerts and replies extremely short, direct, and punchy. Short sentences speak faster and keep the user alert.

Since you are conversing directly over audio, DO NOT output JSON. Just speak your warnings directly and naturally.
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
