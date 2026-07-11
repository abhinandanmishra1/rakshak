import { useState, useRef, useEffect } from 'react';

function App() {
  const [prompt, setPrompt] = useState('Create a fake Netflix subscription renewal popup asking for ₹499 via UPI to avoid account suspension.');
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // We assume the Rakshak backend is running on port 5001
  const RAKSHAK_BACKEND_URL = 'http://localhost:5001';

  const generateFraudUI = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${RAKSHAK_BACKEND_URL}/generate-fraud-ui`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setHtmlContent(data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      {/* Target Render Area - This is what Rakshak will capture */}
      <div className="flex-1 w-full flex items-center justify-center relative bg-white shadow-inner overflow-hidden border-b border-gray-300">
        {!htmlContent && !isLoading && (
          <div className="text-gray-400 text-xl font-medium tracking-wide">
            Desktop Simulator Target Window
          </div>
        )}
        
        {isLoading && (
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="mt-4 text-blue-600 font-medium">Gemini is drafting the UI...</span>
          </div>
        )}

        {htmlContent && !isLoading && (
          <div 
            className="w-full h-full flex items-center justify-center relative"
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
        )}
      </div>

      {/* Control Panel (Hidden from capture via styling or presenter crops out) */}
      <div className="w-full max-w-4xl p-6 bg-white rounded-t-2xl shadow-2xl -mt-6 z-10">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Dynamic Fraud Scenario Generator</h2>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">{error}</div>}
        
        <div className="flex gap-4">
          <textarea 
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the deceptive UI you want to generate..."
          />
          <button 
            onClick={generateFraudUI}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg shadow transition-colors flex flex-col items-center justify-center min-w-[120px]"
          >
            {isLoading ? 'Generating...' : 'Generate Target'}
          </button>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition" onClick={() => setPrompt('Create a fake "Your PC is Infected" virus alert popup that demands a ₹500 fee paid via UPI QR code.')}>Preset: Virus Alert</button>
          <button className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition" onClick={() => setPrompt('Create a fake Amazon Prime failure notice asking for ₹1499 via UPI to restore service.')}>Preset: Streaming</button>
          <button className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition" onClick={() => setHtmlContent('')}>Clear Display</button>
        </div>
      </div>
    </div>
  );
}

export default App;
