const { onRequest } = require("firebase-functions/v2/https");

// ADD THE SECRETS CONFIGURATION HERE
exports.tracker = onRequest({ secrets: ["FOCUSMATE_API_KEY"] }, async (req, res) => {

  // 1. Calculate Monday and Sunday of the current week
  const now = new Date();
  const day = now.getDay() || 7; 
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // 2. Call the Focusmate API
  const url = `https://api.focusmate.com/v1/sessions?start=${monday.toISOString()}&end=${sunday.toISOString()}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'X-API-KEY': process.env.FOCUSMATE_API_KEY } 
    });
    const data = await response.json();

    // 3. Add up minutes and extract session history
    let totalMinutes = 0;
    let totalSessions = 0;
    let sessionsListHtml = '';
    
    if (data.sessions) {
      data.sessions.forEach(session => {
        // Focusmate API returns duration in milliseconds
        const durationMinutes = session.duration / 60000;
        totalMinutes += durationMinutes;
        totalSessions += 1;

        // Format dates
        const startTime = new Date(session.startTime);
        const timeString = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
        const dateString = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        
        // Extract partner name from the users array
        let partnerName = 'Solo / Unmatched';
        if (session.users && session.users.length > 1 && session.users[1].name) {
          partnerName = session.users[1].name;
        }

        // Build list item
        sessionsListHtml += `
          <div class="flex items-center justify-between py-2.5 px-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors rounded-lg">
            <div class="flex flex-col text-left">
              <span class="text-gray-200 font-medium text-sm">${partnerName}</span>
              <span class="text-[11px] text-gray-500 font-mono mt-0.5">${dateString} • ${timeString} (UTC)</span>
            </div>
            <div class="text-xs font-bold text-gray-400 bg-gray-900 px-2 py-1 rounded-md border border-gray-700/50 shadow-sm">
              ${durationMinutes} min
            </div>
          </div>
        `;
      });
    }
    
    // 4. Calculate progress
    const totalHours = (totalMinutes / 60).toFixed(1);
    const targetHours = 25;
    const progressPercent = Math.min((totalHours / targetHours) * 100, 100);
    const isGoalMet = totalHours >= targetHours;

    // 5. Generate the webpage UI using Tailwind CSS for a premium dashboard look
    const html = `
      <!DOCTYPE html>
      <html lang="en" class="bg-gray-950 text-gray-100 font-sans antialiased">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Focusmate Audit Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .glow { box-shadow: 0 0 20px -5px currentColor; }
          .text-glow { text-shadow: 0 0 25px currentColor; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        </style>
      </head>
      <body class="min-h-screen flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
        
        <div class="max-w-xl w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl p-8 sm:p-10 relative overflow-hidden my-8">
          
          <!-- Decorative Background Glow -->
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-${isGoalMet ? 'green' : 'red'}-500/10 blur-[60px] rounded-full pointer-events-none"></div>

          <!-- Header -->
          <div class="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">Weekly Focus Audit</h1>
              <p class="text-gray-400 text-sm mt-1">Target: 25.0 Hours</p>
            </div>
            <div class="px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase ${isGoalMet ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}">
              ${isGoalMet ? 'Verified' : 'Under Target'}
            </div>
          </div>

          <!-- Main Stats -->
          <div class="flex flex-col items-center justify-center mb-10 relative z-10">
            <div class="text-[5.5rem] sm:text-[7rem] font-black leading-none tracking-tighter ${isGoalMet ? 'text-green-400 text-glow' : 'text-white'} transition-all duration-500">
              ${totalHours}<span class="text-3xl sm:text-4xl text-gray-500 font-bold tracking-normal ml-1">/ 25</span>
            </div>
            <p class="text-gray-400 font-medium tracking-wide mt-2">TOTAL HOURS RECORDED</p>
          </div>

          <!-- Progress Bar -->
          <div class="mb-10 relative z-10">
            <div class="flex justify-between text-sm font-semibold mb-3">
              <span class="text-gray-400 uppercase tracking-wider text-xs">Progress</span>
              <span class="${isGoalMet ? 'text-green-400' : 'text-gray-300'}">${progressPercent.toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-950 border border-gray-800 rounded-full h-5 overflow-hidden shadow-inner">
              <div class="h-full rounded-full transition-all duration-1000 ease-out ${isGoalMet ? 'bg-green-500 glow' : 'bg-red-500'}" style="width: ${progressPercent}%;"></div>
            </div>
          </div>

          <!-- Metrics Grid -->
          <div class="grid grid-cols-2 gap-4 mb-8 relative z-10">
            <div class="bg-gray-950/50 rounded-2xl p-4 border border-gray-800">
              <div class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Audit Date Range</div>
              <div class="text-sm sm:text-base font-semibold text-gray-200">
                ${monday.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} &rarr; ${sunday.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
              </div>
            </div>
            <div class="bg-gray-950/50 rounded-2xl p-4 border border-gray-800">
              <div class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Total Sessions</div>
              <div class="text-sm sm:text-base font-semibold text-gray-200">${totalSessions} Sessions</div>
            </div>
          </div>
          
          <!-- Session History List -->
          <div class="mb-8 relative z-10 bg-gray-950/50 rounded-2xl border border-gray-800 overflow-hidden shadow-inner">
            <div class="px-5 py-3 border-b border-gray-800/80 bg-gray-900/80">
              <h3 class="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Session History</h3>
            </div>
            <div class="px-3 py-2 max-h-[250px] overflow-y-auto custom-scrollbar">
              ${sessionsListHtml || '<div class="py-6 text-gray-500 text-sm text-center font-medium">No sessions recorded this week.</div>'}
            </div>
          </div>

          <!-- Footer Audit Links -->
          <div class="mt-4 pt-6 border-t border-gray-800 text-center relative z-10">
            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Immutable Calculation</p>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="https://github.com/yassfix/Focus-auditor" target="_blank" class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2.5 rounded-xl font-semibold text-sm border border-blue-500/10">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path></svg>
                <span>Source Code</span>
              </a>
              <a href="https://github.com/yassfix/Focus-auditor/commits/main" target="_blank" class="w-full sm:w-auto inline-flex items-center justify-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2.5 rounded-xl font-semibold text-sm border border-purple-500/10">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Commit History</span>
              </a>
            </div>
          </div>
          
        </div>
      </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    res.status(500).send("Error fetching data from Focusmate");
  }
});