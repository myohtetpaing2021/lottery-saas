/**
 * SaaS Lottery Bot System (GitHub + Cloudflare D1)
 */

const CONFIG = {
  COST_PER_CALC: 50,
  DEFAULT_CREDITS: 100,
  COMMISSION: 13,
  RATIO: 80
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- ADMIN ROUTE: ADD NEW CLIENT ---
    if (url.pathname === "/admin/addbot") {
      return await handleAddBot(request, env, url);
    }

    // --- WEBHOOK ROUTE ---
    if (url.pathname === "/webhook" && request.method === "POST") {
      const botId = url.searchParams.get("bot_id");
      if (!botId) return new Response("Missing bot_id", { status: 400 });

      const bot = await env.DB.prepare("SELECT * FROM bots WHERE id = ?").bind(botId).first();
      if (!bot || !bot.is_active) return new Response("Bot inactive", { status: 404 });

      try {
        const update = await request.json();
        if (update.message) {
          await processMessage(update.message, env, bot);
        }
        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("System Operational", { status: 200 });
  },
};

// --- LOGIC FUNCTIONS ---
async function processMessage(msg, env, botConfig) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const botId = botConfig.id;

  // 1. Get/Create User
  let user = await env.DB.prepare("SELECT * FROM users WHERE bot_id = ? AND telegram_id = ?")
             .bind(botId, userId).first();

  if (!user) {
    await env.DB.prepare("INSERT INTO users (bot_id, telegram_id, first_name, balance) VALUES (?, ?, ?, ?)")
      .bind(botId, userId, msg.from.first_name || "User", CONFIG.DEFAULT_CREDITS).run();
    user = { balance: CONFIG.DEFAULT_CREDITS };
  }

  // 2. Handle Commands
  if (text === "/start") {
    await sendMessage(botConfig.token, chatId, `👋 Welcome!\nID: ${userId}\nCredits: ${user.balance}`);
  }
  else if (text.startsWith("/add ") && userId == botConfig.owner_id) {
     const parts = text.split(" ");
     if (parts.length === 3) {
       await env.DB.prepare("UPDATE users SET balance = balance + ? WHERE bot_id = ? AND telegram_id = ?")
         .bind(parts[2], botId, parts[1]).run();
       await sendMessage(botConfig.token, chatId, "✅ Credits Added.");
     }
  }
  else {
    // Calculation Logic
    if (user.balance < CONFIG.COST_PER_CALC && userId != botConfig.owner_id) {
       return await sendMessage(botConfig.token, chatId, "⚠️ Not enough credits.");
    }
    
    const result = calculateLottery(text); // (Function below)
    if (!result.error) {
       if (userId != botConfig.owner_id) {
         await env.DB.prepare("UPDATE users SET balance = balance - ? WHERE bot_id = ? AND telegram_id = ?")
             .bind(CONFIG.COST_PER_CALC, botId, userId).run();
       }
       await sendMessage(botConfig.token, chatId, result.msg);
    } else {
       await sendMessage(botConfig.token, chatId, result.msg);
    }
  }
}

async function handleAddBot(request, env, url) {
  if (url.searchParams.get("key") !== env.ADMIN_SECRET) return new Response("Unauthorized", { status: 403 });
  
  const token = url.searchParams.get("token");
  const owner = url.searchParams.get("owner");
  const name = url.searchParams.get("name");

  if (!token) return new Response("Missing Token", { status: 400 });

  const res = await env.DB.prepare("INSERT INTO bots (token, owner_id, client_name) VALUES (?, ?, ?) RETURNING id")
    .bind(token, owner, name).first();

  const workerUrl = `https://${url.hostname}/webhook?bot_id=${res.id}`;
  await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${workerUrl}`);

  return new Response(`✅ Client Added! ID: ${res.id}`, { status: 200 });
}

async function sendMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}

function calculateLottery(text) {
  // Simple check for demo
  if (!text.includes(".")) return { error: true, msg: "❌ Invalid Format" };
  return { error: false, msg: "✅ Results:\n[Calculated Data Here]" };
}
