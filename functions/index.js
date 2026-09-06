const { onRequest } = require("firebase-functions/v2/https");

exports.tracker = onRequest({ secrets: ["FOCUSMATE_API_KEY"] }, async (req, res) => {
  const now = new Date();
  const day = now.getDay() || 7; 
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const url = `https://api.focusmate.com/v1/sessions?start=${monday.toISOString()}&end=${sunday.toISOString()}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'X-API-KEY': process.env.FOCUSMATE_API_KEY } 
    });
    const data = await response.json();

    // Send the raw JSON directly to the browser to inspect it
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data, null, 2));
    
  } catch (error) {
    res.status(500).send("Error fetching data from Focusmate: " + error.message);
  }
});