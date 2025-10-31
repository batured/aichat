/**
 * ai_chat.js
 *
 * Single-file Node.js + Express app that:
 * - Serves a simple chat UI (index page)
 * - Proxies chat messages to Google Gemini REST generateContent endpoint
 *
 * Instructions:
 * 1. npm init -y
 * 2. npm install express body-parser
 * 3. node ai_chat.js
 * 4. Browse http://localhost:3000
 *
 * SECURITY: Replace the hard-coded GEMINI_API_KEY with an environment variable for production.
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ----------------- CONFIG -----------------
// The API key you provided (embedded here because you requested it).
// ⚠️ For safety, replace this with: const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_KEY = "AIzaSyCMZwl8pIytgfHQykQhfugOlrK1L5zb8eg";

// Choose a Gemini model. The docs use names like "gemini-2.5-flash" or "gemini-1.5".
// You can change to the model you prefer (check Google docs for available models).
const GEMINI_MODEL = "gemini-2.5-flash"; // change if desired

// Gemini REST endpoint pattern (per official docs).
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// -------------------------------------------

// Serve a simple chat UI
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Simple AI Chat (Gemini)</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; margin:0;display:flex;flex-direction:column;min-height:100vh}
    .wrap{max-width:900px;margin:30px auto;padding:20px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.08)}
    h1{margin:0 0 12px;font-size:20px}
    #messages{height:420px;overflow:auto;border:1px solid #eee;padding:12px;border-radius:8px;background:#fafafa}
    .msg{margin-bottom:10px}
    .user{font-weight:600}
    .ai{color:#0b63d6}
    form{display:flex;margin-top:12px;gap:8px}
    input[type="text"]{flex:1;padding:10px;border-radius:8px;border:1px solid #ddd}
    button{padding:10px 14px;border-radius:8px;border:none;background:#0b63d6;color:white}
    small.note{display:block;margin-top:8px;color:#666}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Simple AI Chat (Gemini)</h1>
    <div id="messages"></div>
    <form id="chatForm">
      <input id="prompt" type="text" placeholder="Say something to the AI..." autocomplete="off" />
      <button type="submit">Send</button>
    </form>
    <small class="note">This demo proxies your messages to Google Gemini from the server. Keep your API key secret.</small>
  </div>

  <script>
    const messagesEl = document.getElementById('messages');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('prompt');

    const addMessage = (role, text) => {
      const div = document.createElement('div');
      div.className = 'msg';
      div.innerHTML = '<div class="'+(role==='user'?'user':'ai')+'">'+(role==='user'?'You':'AI')+':</div><div>' + text.replace(/\\n/g,'<br>') + '</div>';
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage('user', text);
      input.value = '';
      addMessage('ai', '...thinking...');
      // send to server
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({message: text, history: []}) // history optional
        });
        const data = await res.json();
        // replace the last '...thinking...' with actual response
        // remove last child (the thinking message), then append the real AI response
        const last = messagesEl.lastChild;
        if (last && last.innerText.includes('...thinking...')) {
          messagesEl.removeChild(last);
        }
        if (data && data.reply) {
          addMessage('ai', data.reply);
        } else {
          addMessage('ai', 'No reply (check server logs).');
        }
      } catch (err) {
        console.error(err);
        addMessage('ai', 'Error: ' + String(err));
      }
    });
  </script>
</body>
</html>`);
});

// Chat API endpoint: receives { message: "...", history: [...] }
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = (req.body && req.body.message) ? String(req.body.message) : '';
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    if (!userMessage) {
      return res.status(400).json({ error: 'No message provided' });
    }

    // Build a single text prompt that includes recent history (simple approach).
    // You could construct richer system instructions or use structured multimodal content.
    let prompt = '';
    if (history && history.length > 0) {
      // history is expected as [{role:'user'|'assistant', content:'...'}, ...]
      prompt = history.map(h => (h.role === 'user' ? 'User: ' : 'Assistant: ') + h.content).join('\\n') + '\\n';
    }
    prompt += 'User: ' + userMessage + '\\nAssistant:';

    // Prepare the REST payload as shown in Gemini docs:
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      // You can tweak generationConfig - e.g. maxOutputTokens, temperature, etc.
      // generationConfig: { maxOutputTokens: 512, temperature: 0.7 }
    };

    // Send request to Gemini REST API (x-goog-api-key header)
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The docs show x-goog-api-key header. Alternatively you can pass ?key=... in the URL.
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(payload),
      timeout: 200000
    };

    // Use node's global fetch (Node 18+) or fallback gracefully
    const fetchFn = (typeof fetch === 'function') ? fetch : (await import('node-fetch')).default;

    const resp = await fetchFn(GEMINI_ENDPOINT, fetchOptions);
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Gemini API error:', resp.status, text);
      return res.status(500).json({ error: 'Gemini API error', details: text });
    }
    const json = await resp.json();

    // Parse the response: docs indicate candidates[0].content.parts[0].text or candidates[0].content.parts array
    // Newer doc formats may return 'candidates' or 'output' shapes; we handle common patterns:
    let aiReply = '';

    // Pattern 1: candidates[0].content.parts[0].text
    try {
      if (Array.isArray(json.candidates) && json.candidates.length > 0) {
        const c = json.candidates[0];
        // some responses use c.content.parts[].text
        if (c && c.content && Array.isArray(c.content.parts)) {
          aiReply = c.content.parts.map(p => p.text || p).join('\\n');
        } else if (c && c.output && Array.isArray(c.output)) {
          aiReply = c.output.join('\\n');
        } else if (c && c.text) {
          aiReply = c.text;
        }
      }
    } catch (e) {
      console.warn('Pattern 1 parse failed', e);
    }

    // Pattern 2: data.candidates[0].content (older/newer variance)
    if (!aiReply) {
      try {
        if (json && json.candidates && json.candidates[0] && json.candidates[0].content) {
          const parts = json.candidates[0].content.parts || [];
          aiReply = parts.map(p => p.text || p).join('\\n');
        }
      } catch (e) {}
    }

    // Pattern 3: top-level 'output' or 'response' text
    if (!aiReply) {
      if (json.output) {
        if (typeof json.output === 'string') aiReply = json.output;
        else if (Array.isArray(json.output)) aiReply = json.output.join('\\n');
      } else if (json.text) {
        aiReply = json.text;
      } else if (json.candidate && json.candidate.content) {
        const parts = json.candidate.content.parts || [];
        aiReply = parts.map(p => p.text || p).join('\\n');
      }
    }

    if (!aiReply) {
      // fallback: stringify some part of the response for debugging
      aiReply = JSON.stringify(json).slice(0, 1500);
    }

    return res.json({ reply: aiReply, raw: json });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI chat server listening on http://localhost:${PORT}`);
});
