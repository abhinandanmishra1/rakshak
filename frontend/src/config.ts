/**
 * @file config.ts
 * @description Centralized Configuration Module for the Rakshak Frontend Client.
 * 
 * This module stores all configurable variables and static datasets used by the 
 * frontend application. Centralizing constants such as server connection URLs,
 * polling rates, mock UPI screens, and data objects prevents code duplication and
 * simplifies system tuning.
 * 
 * USE CASES:
 * 1. Changing the port or host of the backend WebSocket proxy.
 * 2. Tuning the capture frequency of the simulated screen frame loop.
 * 3. Adding or updating payment screens (such as new fraud or legit examples) for the demo.
 * 
 * According to the coding guidelines:
 * - This file centralizes all configurable frontend items.
 * - This file starts with a long comment explaining features and use cases.
 */

export interface UPIScreen {
  id: string;
  name: string;
  category: 'normal' | 'scam' | 'legit';
  senderName: string;
  handle: string;
  amount: number;
  message: string;
  isCollectRequest: boolean;
  requiresPin: boolean;
  screenTitle: string;
}

export const config = {
  // Backend WebSocket Proxy address
  WS_PROXY_URL: 'ws://localhost:5001',

  // Frequency of frame capture in milliseconds (1 frame per 1000ms = 1fps)
  FRAME_CAPTURE_INTERVAL_MS: 1200,

  // Enable/Disable auto frame capture loop
  AUTO_CAPTURE_ENABLED: true,

  // Datasets representing the 4 Demo Beats and extra test screens
  DEMO_SCREENS: [
    {
      id: 'home',
      name: 'Beat 1: Home / Chat Screen (Safe)',
      category: 'normal',
      senderName: '',
      handle: '',
      amount: 0,
      message: 'Inbox: 2 new messages\nNo payment requests active.',
      isCollectRequest: false,
      requiresPin: false,
      screenTitle: 'Home & Messages'
    },
    {
      id: 'classic_scam',
      name: 'Beat 2: Classic UPI PIN-to-Receive Scam',
      category: 'scam',
      senderName: 'Kaun Banega Crorepati Office',
      handle: 'luckywinner748@okaxis',
      amount: 25000,
      message: 'You have won a cash prize! To claim your ₹25,000 refund/prize, tap Approve and enter your secret UPI PIN to receive money instantly.',
      isCollectRequest: true,
      requiresPin: true,
      screenTitle: 'Receive Money Request'
    },
    {
      id: 'novel_scam',
      name: 'Beat 3: Novel Processing/KYC Scam',
      category: 'scam',
      senderName: 'Paytm Verification Desk',
      handle: 'support-kyc9213@ybl',
      amount: 1,
      message: 'Your account is BLOCKED due to pending KYC update. Pay a verification fee of ₹1 to unblock. We will send you ₹5,000 unblocking bonus immediately.',
      isCollectRequest: true,
      requiresPin: true,
      screenTitle: 'Mandatory Account Verification'
    },
    {
      id: 'legit_payment',
      name: 'Beat 4: Legitimate Merchant QR Payment (Safe)',
      category: 'legit',
      senderName: 'Sharma Grocery & Kirana',
      handle: 'sharmastore@ybl',
      amount: 230,
      message: 'Scanning store QR. Enter PIN to pay.',
      isCollectRequest: false,
      requiresPin: true,
      screenTitle: 'Pay Sharma Grocery'
    }
  ] as UPIScreen[]
};

/**
 * Logs a configuration fetch request and returns the requested configuration block.
 * 
 * @function getFrontendConfig
 * @returns {object} The configuration object.
 */
export function getFrontendConfig() {
  console.log('[INFO] Calling getFrontendConfig()');
  return config;
}
