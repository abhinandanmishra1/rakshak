/**
 * @file main.tsx
 * @description Application Entrypoint for the Rakshak Frontend Client.
 * 
 * This file bootstraps the React-based client interface. It mounts the main
 * App component onto the HTML root element. The frontend provides a faithful,
 * interactive simulation of a smartphone screen, complete with fake UPI payment
 * flows and the overlaid Rakshak proactive scam guardian overlay.
 * 
 * USE CASES:
 * 1. Mounting the React user interface onto the browser DOM.
 * 2. Importing and binding global stylesheet rules.
 * 
 * According to the coding guidelines:
 * - This file contains long comments detailing the feature and use cases.
 * - This file initializes our main application shell.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Initializes and mounts the React application onto the DOM root element.
 * 
 * @function mountApp
 */
function mountApp() {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

mountApp();
