import { useState } from 'react';

const STATIC_SCREENS = [
  {
    id: 'netflix',
    name: 'Netflix Suspension (UPI)',
    html: `
      <div class="max-w-md mx-auto my-8 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden font-sans">
        <div class="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
          <span class="font-bold tracking-wide">Netflix Account Alert</span>
        </div>
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 mb-2">Subscription Suspended</h3>
          <p class="text-gray-600 text-sm mb-4">Your payment could not be processed. Pay ₹499 via UPI to restore access immediately.</p>
          <div class="flex justify-center mb-6">
             <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg" alt="Fake QR" class="w-48 h-48 border border-gray-300 p-2 rounded" />
          </div>
          <button class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm mb-2">
            Pay ₹499 Now
          </button>
        </div>
      </div>
    `
  },
  {
    id: 'virus',
    name: 'Windows Virus Alert',
    html: `
      <div class="max-w-lg mx-auto my-8 bg-blue-900 border border-blue-700 rounded-lg shadow-2xl overflow-hidden font-sans text-white">
        <div class="bg-blue-800 px-4 py-2 border-b border-blue-700 flex justify-between items-center">
          <span class="font-bold">Windows Defender Security Center</span>
          <span class="text-red-400 font-bold">X</span>
        </div>
        <div class="p-6 flex items-start space-x-4">
          <div class="text-6xl text-red-500">⚠️</div>
          <div>
            <h3 class="text-xl font-bold mb-2">System Infected: Trojan.Win32</h3>
            <p class="text-sm text-gray-300 mb-4">Your PC has been blocked due to suspicious activity. Your personal data, bank info, and passwords are at risk.</p>
            <div class="bg-red-900 text-red-200 p-3 rounded text-sm mb-4 border border-red-700">
              Call Tech Support immediately: <strong>+1-800-FAKE-NUM</strong><br/>
              Or pay unlocking fee of ₹2000 via UPI below.
            </div>
            <button class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded text-sm">
              Scan & Repair System
            </button>
          </div>
        </div>
      </div>
    `
  }
];

function App() {
  const [viewMode, setViewMode] = useState<'dynamic' | 'static'>('static');
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

  const loadStaticScreen = (html: string) => {
    setHtmlContent(html);
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

      {/* Control Panel */}
      <div className="w-full max-w-4xl p-6 bg-white rounded-t-2xl shadow-2xl -mt-6 z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Fraud Scenario Simulator</h2>
          
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'static' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('static')}
            >
              Static Presets
            </button>
            <button 
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'dynamic' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('dynamic')}
            >
              Dynamic (Gemini)
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">{error}</div>}
        
        {viewMode === 'static' ? (
          <div className="flex gap-4">
            {STATIC_SCREENS.map((screen) => (
              <button 
                key={screen.id}
                onClick={() => loadStaticScreen(screen.html)}
                className="flex-1 py-4 px-6 bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-300 rounded-xl text-left transition-all group"
              >
                <h3 className="font-semibold text-gray-800 group-hover:text-blue-700">{screen.name}</h3>
                <p className="text-xs text-gray-500 mt-1">Instant load, predefined HTML</p>
              </button>
            ))}
            <button 
                onClick={() => setHtmlContent('')}
                className="py-4 px-6 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl text-center text-gray-600 font-medium transition-all"
              >
                Clear Screen
              </button>
          </div>
        ) : (
          <div>
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
              <button className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 transition" onClick={() => setPrompt('Create a fake "Your PC is Infected" virus alert popup that demands a ₹500 fee paid via UPI QR code.')}>Prompt: Virus Alert</button>
              <button className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 transition" onClick={() => setPrompt('Create a fake Amazon Prime failure notice asking for ₹1499 via UPI to restore service.')}>Prompt: Streaming</button>
              <button className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 transition" onClick={() => setHtmlContent('')}>Clear Display</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
