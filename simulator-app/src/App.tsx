import { useState } from 'react';

const STATIC_SCREENS = [
  {
    id: 'home_screen',
    name: 'Home Screen',
    html: `
      <div class="w-[360px] mx-auto h-[740px] bg-[#f1f3f4] relative overflow-hidden font-sans border-8 border-gray-900 rounded-[40px] shadow-2xl flex flex-col">
        <div class="bg-blue-600 p-6 pt-12 text-white shadow-sm rounded-b-3xl">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">U</div>
              <div>
                <p class="text-xs opacity-80">Welcome back,</p>
                <p class="font-bold">User</p>
              </div>
            </div>
            <div class="w-8 h-8 flex items-center justify-center">🔔</div>
          </div>
          <div class="bg-white text-blue-600 rounded-2xl p-4 flex justify-around items-center shadow-lg">
             <div class="flex flex-col items-center gap-1 cursor-pointer sim-link-to-qr">
               <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">📷</div>
               <span class="text-xs font-medium">Scan QR</span>
             </div>
             <div class="flex flex-col items-center gap-1">
               <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">📱</div>
               <span class="text-xs font-medium">Pay Contacts</span>
             </div>
             <div class="flex flex-col items-center gap-1">
               <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">🏦</div>
               <span class="text-xs font-medium">Bank Transfer</span>
             </div>
          </div>
        </div>
        <div class="p-6">
           <h3 class="font-bold text-gray-800 mb-4">Recent Transactions</h3>
           <div class="space-y-4">
             <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
               <div class="flex items-center gap-3">
                 <div class="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">S</div>
                 <div>
                   <p class="font-bold text-gray-800 text-sm">Swiggy</p>
                   <p class="text-xs text-gray-500">2 hours ago</p>
                 </div>
               </div>
               <span class="font-bold text-gray-800">-₹320</span>
             </div>
             <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
               <div class="flex items-center gap-3">
                 <div class="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold">J</div>
                 <div>
                   <p class="font-bold text-gray-800 text-sm">Jio Postpaid</p>
                   <p class="text-xs text-gray-500">Yesterday</p>
                 </div>
               </div>
               <span class="font-bold text-gray-800">-₹299</span>
             </div>
           </div>
        </div>
      </div>
    `
  },
  {
    id: 'qr_scanner',
    name: 'QR Scanner',
    html: `
      <div class="w-[360px] mx-auto h-[740px] bg-black relative overflow-hidden font-sans border-8 border-gray-900 rounded-[40px] shadow-2xl flex flex-col">
        <div class="p-4 pt-10 text-white flex items-center z-10 relative">
          <span class="text-xl mr-3 cursor-pointer">←</span>
          <div class="text-lg font-medium">Scan any QR code</div>
        </div>
        
        <div class="flex-1 relative flex flex-col items-center justify-center mt-[-60px]">
           <!-- Viewfinder frame -->
           <div class="w-64 h-64 border-2 border-white/30 relative">
              <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
              <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
              <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
              <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
              
              <!-- Scanning line animation -->
              <div class="w-full h-0.5 bg-blue-500 absolute top-1/2 left-0 shadow-[0_0_8px_2px_rgba(59,130,246,0.8)] opacity-80" style="animation: scan 2s infinite ease-in-out alternate;"></div>
              
              <style>
                @keyframes scan {
                  0% { top: 10%; }
                  100% { top: 90%; }
                }
              </style>
           </div>
           <p class="text-white/70 mt-6 text-sm">Align QR code within the frame</p>
        </div>

        <!-- Bottom action sheet -->
        <div class="bg-white w-full rounded-t-3xl p-6 absolute bottom-0">
           <div class="flex items-center gap-4 mb-6">
              <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl">🖼️</div>
              <div>
                <p class="font-bold text-gray-800">Scan from Gallery</p>
                <p class="text-xs text-gray-500">Upload a saved QR code</p>
              </div>
           </div>
           <button class="sim-btn-proceed w-full bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold py-3.5 px-4 rounded-xl text-lg shadow-lg">
              Simulate Scan & Proceed
           </button>
        </div>
      </div>
    `
  },
  {
    id: 'olx_messages',
    name: 'OLX Messages (Scam)',
    html: `
      <div class="w-[360px] mx-auto h-[740px] bg-[#f1f3f4] relative overflow-hidden font-sans border-8 border-gray-900 rounded-[40px] shadow-2xl flex flex-col">
        <div class="bg-blue-600 p-4 pt-10 text-white shadow-sm flex items-center">
          <span class="text-xl mr-3">←</span>
          <div class="text-lg font-medium">Messages</div>
        </div>
        <div class="p-4 flex-1 flex flex-col bg-white">
          <div class="bg-gray-100 rounded-lg p-3 mb-3 w-4/5 self-start">
             <p class="text-sm text-gray-800">Hi, is the sofa still available?</p>
             <span class="text-xs text-gray-500 mt-1 block">10:42 AM</span>
          </div>
          <div class="bg-blue-100 rounded-lg p-3 mb-3 w-4/5 self-end">
             <p class="text-sm text-gray-800">Yes, it is.</p>
             <span class="text-xs text-blue-500 mt-1 block text-right">10:45 AM</span>
          </div>
          <div class="bg-gray-100 rounded-lg p-3 mb-3 w-[90%] self-start border border-red-200">
             <p class="text-sm text-gray-800">Great! I am sending the advance payment. Please claim your OLX advance payment return here: <br/><br/><button class="sim-link-to-collect text-blue-600 underline font-bold cursor-pointer text-left">http://olx-refund-claim.co.in/pay</button></p>
             <span class="text-xs text-gray-500 mt-1 block">10:48 AM</span>
          </div>
        </div>
        <div class="bg-gray-100 p-4 flex items-center">
           <div class="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-500 border border-gray-300">Type a message...</div>
           <div class="w-10 h-10 bg-blue-600 rounded-full ml-2 flex items-center justify-center text-white text-lg">➤</div>
        </div>
      </div>
    `
  },
  {
    id: 'collect_scam',
    name: 'UPI Collect Request (Scam)',
    html: `
      <div class="w-[360px] mx-auto h-[740px] bg-[#f1f3f4] relative overflow-hidden font-sans border-8 border-gray-900 rounded-[40px] shadow-2xl flex flex-col">
        <div class="bg-white p-4 pt-10 border-b border-gray-200 text-center shadow-sm">
          <div class="text-xl font-bold text-gray-800">Payment Request</div>
        </div>
        <div class="p-6 flex-1 flex flex-col items-center">
          <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">
            R
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-1">Ramesh Kumar</h2>
          <p class="text-sm text-gray-500 mb-6">ramesh.kumar99@okhdfcbank</p>
          
          <div class="bg-white w-full rounded-2xl p-6 shadow-sm border border-gray-100 text-center mb-6 relative">
             <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">
               Requested from you
             </div>
             <div class="text-5xl font-black text-gray-900 mt-4 mb-2">₹5,000</div>
             <p class="text-sm text-gray-600 italic">"OLX Advance Payment Refund. Enter PIN to receive your money."</p>
          </div>
          
          <div class="w-full space-y-3 mt-auto mb-6">
            <button class="w-full bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold py-3.5 px-4 rounded-xl text-lg transition shadow-md">
              Pay ₹5,000
            </button>
            <button class="w-full bg-white text-gray-700 font-bold py-3 px-4 rounded-xl text-md border border-gray-300 hover:bg-gray-50 transition">
              Decline
            </button>
          </div>
        </div>
      </div>
    `
  },
  {
    id: 'pin_scam',
    name: 'UPI PIN Entry (Receiving Scam)',
    html: `
      <div class="w-[360px] mx-auto h-[740px] bg-[#121212] relative overflow-hidden font-sans border-8 border-gray-900 rounded-[40px] shadow-2xl flex flex-col text-white">
        <div class="p-5 pt-10 flex items-center border-b border-gray-800">
           <span class="text-xl">←</span>
           <span class="ml-4 text-lg font-medium">Enter UPI PIN</span>
        </div>
        
        <div class="p-6 flex flex-col items-center">
          <div class="text-center mb-8 w-full">
            <p class="text-gray-400 text-sm mb-1">To: Unknown Sender</p>
            <p class="text-3xl font-light">Sending: <span class="font-bold">₹10,000</span></p>
            <div class="bg-red-900/30 border border-red-500/50 text-red-200 text-xs p-2 rounded-lg mt-4 text-left">
               <span class="font-bold">Note:</span> Customer support refund. Enter PIN to receive ₹10,000 into your State Bank of India account.
            </div>
          </div>

          <div class="w-full flex justify-center space-x-4 mb-12">
            <div class="w-4 h-4 rounded-full border-2 border-white"></div>
            <div class="w-4 h-4 rounded-full border-2 border-white"></div>
            <div class="w-4 h-4 rounded-full border-2 border-white"></div>
            <div class="w-4 h-4 rounded-full border-2 border-white"></div>
            <div class="w-4 h-4 rounded-full border-2 border-white"></div>
            <div class="w-4 h-4 rounded-full border-2 border-white"></div>
          </div>
        </div>

        <div class="mt-auto bg-[#1e1e1e] p-2 pb-6 grid grid-cols-3 gap-1">
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">1</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">2</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">3</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">4</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">5</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">6</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">7</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">8</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">9</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded text-red-400">⌫</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded">0</button>
           <button class="py-4 text-2xl font-medium active:bg-gray-800 rounded bg-blue-600/20 text-blue-400">✓</button>
        </div>
      </div>
    `
  },
  {
    id: 'legit_merchant',
    name: 'Legit Merchant Payment (Safe)',
    html: `
      <div class="w-[360px] mx-auto h-[740px] bg-white relative overflow-hidden font-sans border-8 border-gray-900 rounded-[40px] shadow-2xl flex flex-col">
        <div class="bg-[#0066cc] p-4 pt-10 text-white shadow-sm flex items-center">
          <span class="text-xl mr-3">←</span>
          <div class="text-lg font-medium">Paying Merchant</div>
        </div>
        <div class="p-6 flex-1 flex flex-col items-center bg-gray-50">
          <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow-sm">
            S
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-1 flex items-center">
            Starbucks Coffee <span class="ml-2 text-green-500 text-lg">✓</span>
          </h2>
          <p class="text-sm text-gray-500 mb-2">Verified Merchant</p>
          <p class="text-xs text-gray-400 mb-8">starbucks.in@okicici</p>
          
          <div class="w-full flex justify-center items-end mb-8">
            <span class="text-3xl text-gray-600 mr-1 mb-1">₹</span>
            <span class="text-6xl font-light text-gray-900">450</span>
          </div>

          <div class="w-full bg-white p-4 rounded-xl border border-gray-200 mb-auto">
             <p class="text-sm text-gray-600">Paying from</p>
             <div class="flex justify-between items-center mt-2">
                <span class="font-bold text-gray-800">HDFC Bank **** 1234</span>
                <span class="text-blue-600 text-sm font-medium">Change</span>
             </div>
          </div>
          
          <div class="w-full mt-6 mb-4">
            <button class="w-full bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold py-3.5 px-4 rounded-xl text-lg shadow-lg flex items-center justify-center">
              Pay ₹450
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
  const [htmlContent, setHtmlContent] = useState(() => STATIC_SCREENS.find(s => s.id === 'home_screen')?.html || '');
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
    <div className="min-h-screen bg-gray-100 flex flex-row">
      {/* Control Panel - Left Side */}
      <div className="w-[380px] flex-shrink-0 p-6 bg-white shadow-2xl z-10 flex flex-col border-r border-gray-300 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Fraud Scenario Simulator</h2>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">{error}</div>}
        
        {viewMode === 'static' ? (
          <div className="flex flex-col gap-4">
            {STATIC_SCREENS.map((screen) => (
              <button 
                key={screen.id}
                onClick={() => loadStaticScreen(screen.html)}
                className="w-full py-4 px-6 bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-300 rounded-xl text-left transition-all group"
              >
                <h3 className="font-semibold text-gray-800 group-hover:text-blue-700">{screen.name}</h3>
                <p className="text-xs text-gray-500 mt-1">Instant load, predefined HTML</p>
              </button>
            ))}
            <button 
                onClick={() => {
                  const homeScreen = STATIC_SCREENS.find(s => s.id === 'home_screen');
                  if (homeScreen) loadStaticScreen(homeScreen.html);
                }}
                className="w-full py-4 px-6 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl text-center text-gray-600 font-medium transition-all"
              >
                Home Screen
              </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <textarea 
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the deceptive UI you want to generate..."
            />
            <button 
              onClick={generateFraudUI}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg shadow transition-colors flex flex-col items-center justify-center"
            >
              {isLoading ? 'Generating...' : 'Generate Target'}
            </button>
            <div className="mt-4 flex flex-col gap-2">
              <button className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 transition" onClick={() => setPrompt('Create a fake "Your PC is Infected" virus alert popup that demands a ₹500 fee paid via UPI QR code.')}>Prompt: Virus Alert</button>
              <button className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 transition" onClick={() => setPrompt('Create a fake Amazon Prime failure notice asking for ₹1499 via UPI to restore service.')}>Prompt: Streaming</button>
              <button className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 transition" onClick={() => setHtmlContent('')}>Clear Display</button>
            </div>
          </div>
        )}
      </div>

      {/* Target Render Area - This is what Rakshak will capture */}
      <div className="flex-1 h-screen flex items-center justify-center relative bg-white shadow-inner overflow-hidden">
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
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.sim-link-to-collect')) {
                const collectScam = STATIC_SCREENS.find(s => s.id === 'collect_scam');
                if (collectScam) {
                  loadStaticScreen(collectScam.html);
                }
              }
              if (target.closest('.sim-link-to-qr')) {
                const qrScreen = STATIC_SCREENS.find(s => s.id === 'qr_scanner');
                if (qrScreen) {
                  loadStaticScreen(qrScreen.html);
                }
              }
              if (target.closest('.sim-btn-proceed')) {
                const legitScreen = STATIC_SCREENS.find(s => s.id === 'legit_merchant');
                if (legitScreen) {
                  loadStaticScreen(legitScreen.html);
                }
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
