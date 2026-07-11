/**
 * @file logger.js
 * @description Custom Logging Utility for the Rakshak Backend Proxy.
 * 
 * This module implements strict logging guidelines specified for the hackathon:
 * 1. Log as INFO all function calls along with their input parameters.
 * 2. Log all GenAI calls with all their parameters (model name, prompt/system prompt, config)
 *    and their resulting outputs, while stripping out any raw binary or base64 inline visual data
 *    to prevent terminal clutter and log pollution.
 * 
 * USE CASES:
 * 1. Tracking execution flows of websocket handlers and express routes.
 * 2. Auditing LLM classifications and prompts for correctness.
 * 3. Cleaning visual payloads (e.g., base64 screenshots sent to Gemini) from log files.
 * 
 * According to the coding guidelines:
 * - All function calls and GenAI invocations are documented.
 * - Docstrings explain the inputs/outputs of every function.
 * - This file starts with a detailed header comment.
 */

const fs = require('fs');
const path = require('path');

/**
 * Strips or truncates very long base64 inline visual/image data from a string or object.
 * This keeps the log files clean and readable.
 * 
 * @function stripInlineData
 * @param {any} input - The input string, array, or object that might contain base64 payloads.
 * @returns {any} The cleaned input where base64 data has been replaced with a summary placeholder.
 */
function stripInlineData(input) {
  if (!input) return input;

  if (typeof input === 'string') {
    // Regular expression to match standard base64 image strings or extremely long words (> 100 chars)
    const base64Regex = /data:image\/[a-zA-Z]+;base64,[a-zA-Z0-9+/=\s]+/g;
    const longWordRegex = /[a-zA-Z0-9+/=]{150,}/g;

    let result = input;
    if (base64Regex.test(result)) {
      result = result.replace(base64Regex, '[IMAGE_BASE64_DATA_STRIPPED]');
    }
    if (longWordRegex.test(result)) {
      result = result.replace(longWordRegex, '[LONG_BINARY_DATA_STRIPPED]');
    }
    return result;
  }

  if (Array.isArray(input)) {
    return input.map(item => stripInlineData(item));
  }

  if (typeof input === 'object') {
    const cleanedObj = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        // If the key is 'inlineData' or 'data', and contains base64/long strings, replace it
        if ((key === 'data' || key === 'inlineData') && typeof input[key] === 'string' && input[key].length > 100) {
          cleanedObj[key] = `[BINARY_DATA_STRIPPED (${input[key].length} bytes)]`;
        } else if (typeof input[key] === 'object') {
          cleanedObj[key] = stripInlineData(input[key]);
        } else {
          cleanedObj[key] = stripInlineData(input[key]);
        }
      }
    }
    return cleanedObj;
  }

  return input;
}

/**
 * Formats a message with a timestamp and log level prefix.
 * 
 * @function formatMessage
 * @param {string} level - The log level (e.g., INFO, WARN, ERROR).
 * @param {string} message - The main log message.
 * @returns {string} The formatted log string.
 */
function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * Logs a general informational message to the console.
 * 
 * @function info
 * @param {string} message - The information message to log.
 * @param {...any} args - Optional extra arguments to output.
 */
function info(message, ...args) {
  const formatted = formatMessage('INFO', message);
  if (args.length > 0) {
    console.log(formatted, ...args.map(arg => stripInlineData(arg)));
  } else {
    console.log(formatted);
  }
}

/**
 * Logs an error message and its stack trace or error object.
 * 
 * @function error
 * @param {string} message - The error explanation.
 * @param {any} err - The error object or exception stack trace.
 */
function error(message, err) {
  const formatted = formatMessage('ERROR', message);
  console.error(formatted, err);
}

/**
 * Logs a function call and its parameters as INFO, conforming to guidelines.
 * 
 * @function logFunctionCall
 * @param {string} functionName - The name of the function being executed.
 * @param {object|array|null} parameters - An object or array representing arguments passed to the function.
 */
function logFunctionCall(functionName, parameters = {}) {
  const cleanedParams = stripInlineData(parameters);
  const paramString = typeof cleanedParams === 'object' 
    ? JSON.stringify(cleanedParams) 
    : String(cleanedParams);
  
  info(`Function Invoked: ${functionName}() with parameters: ${paramString}`);
}

/**
 * Logs a GenAI model invocation, printing prompt, configuration, and output while stripping inline binary data.
 * 
 * @function logGenAICall
 * @param {string} model - The name of the Gemini model used.
 * @param {any} prompt - The user prompt, system instructions, or message history.
 * @param {object} config - The generation configuration (temperature, safety settings, schema).
 * @param {any} output - The output response text or classification JSON.
 */
function logGenAICall(model, prompt, config, output) {
  const cleanedPrompt = stripInlineData(prompt);
  const cleanedConfig = stripInlineData(config);
  const cleanedOutput = stripInlineData(output);

  const separator = '='.repeat(80);
  console.log(separator);
  console.log(formatMessage('GENAI_CALL', `Model: ${model}`));
  console.log(formatMessage('GENAI_CALL', `Configuration: ${JSON.stringify(cleanedConfig)}`));
  console.log(formatMessage('GENAI_CALL', `Prompt/Instructions:\n${typeof cleanedPrompt === 'object' ? JSON.stringify(cleanedPrompt, null, 2) : cleanedPrompt}`));
  console.log(formatMessage('GENAI_CALL', `Output/Response:\n${typeof cleanedOutput === 'object' ? JSON.stringify(cleanedOutput, null, 2) : cleanedOutput}`));
  console.log(separator);
}

module.exports = {
  info,
  error,
  logFunctionCall,
  logGenAICall,
  stripInlineData
};
