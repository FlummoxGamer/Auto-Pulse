async function sendDiscordMessage(text) {
  // Get token from localStorage
  let token = localStorage.getItem('token');
  if (!token) {
    // Fallback: find token from cookies or other sources? We'll try window.
    token = window.localStorage.getItem('token') || document.cookie.match(/token=([^;]+)/)?.[1];
  }
  if (!token) {
    console.error('[Auto Pulse] No token found. Make sure you are logged into Discord web.');
    return false;
  }

  // Get channel ID from URL (e.g., /channels/@me/123456789)
  const match = window.location.pathname.match(/\/channels\/\d+\/(\d+)/);
  if (!match) {
    console.error('[Auto Pulse] No channel ID found. Open a Discord channel first.');
    return false;
  }
  const channelId = match[1];

  // Send via API
  try {
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: text })
    });
    if (response.ok) {
      console.log(`%c[Auto Pulse] Sent: ${text}`, 'color:#00ff00;font-weight:bold;');
      return true;
    } else {
      console.error(`[Auto Pulse] API error: ${response.status}`);
      return false;
    }
  } catch (e) {
    console.error('[Auto Pulse] Network error', e);
    return false;
  }
}
