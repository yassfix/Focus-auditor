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

    // 3. Add up minutes for completed sessions
    let totalMinutes = 0;
    if (data.sessions) {
      data.sessions.forEach(session => {
        // Only count if the session has a completed status flag
        // Note: Focusmate API returns duration in milliseconds
        totalMinutes += (session.duration / 60000); 
      });
    }
    
    // 4. Calculate progress
    const totalHours = (totalMinutes / 60).toFixed(1);
    const targetHours = 25;
    const progressPercent = Math.min((totalHours / targetHours) * 100, 100);
    const barColor = totalHours >= targetHours ? '#4ade80' : '#f87171'; 

    // 5. Generate the webpage UI
    const html = `
      <!DOCTYPE html>
      <html style="font-family: sans-serif; text-align: center; padding: 50px; background: #111; color: white;">
        <h2>Focusmate Weekly Target: 25 Hours</h2>
        <div style="font-size: 80px; font-weight: bold; margin: 20px 0;">${totalHours} / 25 <span style="font-size: 30px">hrs</span></div>
        
        <div style="width: 100%; max-width: 600px; margin: 0 auto; background: #333; border-radius: 20px; height: 40px; overflow: hidden;">
          <div style="width: ${progressPercent}%; background: ${barColor}; height: 100%; transition: width 0.5s;"></div>
        </div>
        
        <p style="margin-top: 40px; font-size: 18px; color: #aaa;">
          Audit this calculation: <a href="https://github.com/yassfix/Focus-auditor" style="color: #60a5fa;">View Source Code on GitHub</a>
        </p>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    res.status(500).send("Error fetching data from Focusmate");
  }
});