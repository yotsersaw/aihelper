import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const botId = searchParams.get("botId");

  let autoOpenDelay = 8;
  let badgeMessage = "👋 Hi! Need help? I can answer questions and book appointments.";
  let widgetColor = "#2563eb";

  if (botId) {
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from("bots")
      .select("auto_open_delay, badge_message, widget_color")
      .eq("public_bot_id", botId)
      .single();
    if (data) {
      autoOpenDelay = data.auto_open_delay ?? 8;
      badgeMessage = data.badge_message ?? badgeMessage;
      widgetColor = data.widget_color ?? widgetColor;
    }
  }

  const js = `(function(){
  var script = document.currentScript;
  var botId = script && script.getAttribute('data-bot-id');
  if (!botId) return;
  var baseUrl = new URL(script.src).origin;
  var autoOpenDelay = ${autoOpenDelay * 1000};
  var badgeMessage = ${JSON.stringify(badgeMessage)};
  var widgetColor = ${JSON.stringify(widgetColor)};
  var opened = false;
  var userClosedManually = false;

  var style = document.createElement('style');
  style.textContent = \`
    .selvanto-btn {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .selvanto-btn:hover { transform: scale(1.08); }
    .selvanto-btn svg { pointer-events: none; }
    .selvanto-frame {
      position: fixed;
      right: 20px;
      bottom: 88px;
      width: 370px;
      max-width: calc(100vw - 24px);
      height: 580px;
      max-height: 75vh;
      border: none;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.22);
      z-index: 2147483647;
      background: #fff;
      display: none;
      opacity: 0;
      transform: translateY(16px) scale(0.97);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .selvanto-frame.open { display: block; }
    .selvanto-frame.visible { opacity: 1; transform: translateY(0) scale(1); }
    .selvanto-badge {
      position: fixed;
      right: 82px;
      bottom: 28px;
      z-index: 2147483646;
      background: #fff;
      border-radius: 12px;
      padding: 10px 14px;
      font: 13px/1.4 sans-serif;
      color: #1e293b;
      box-shadow: 0 4px 20px rgba(0,0,0,0.14);
      max-width: 240px;
      cursor: pointer;
      animation: selvanto-fadein 0.4s ease;
    }
    .selvanto-badge::after {
      content: '';
      position: absolute;
      right: -8px;
      bottom: 14px;
      border: 8px solid transparent;
      border-left-color: #fff;
      border-right: 0;
    }
    .selvanto-badge-close {
      position: absolute;
      top: 4px;
      right: 6px;
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      font-size: 14px;
      line-height: 1;
      padding: 0;
    }
    .selvanto-typing { display: inline-flex; gap: 3px; align-items: center; height: 16px; }
    .selvanto-typing span {
      width: 5px; height: 5px; border-radius: 50%; background: #94a3b8;
      animation: selvanto-bounce 1.2s infinite;
    }
    .selvanto-typing span:nth-child(2) { animation-delay: 0.2s; }
    .selvanto-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes selvanto-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    @keyframes selvanto-fadein {
      from { opacity: 0; transform: translateX(10px); }
      to { opacity: 1; transform: translateX(0); }
    }
  \`;
  document.head.appendChild(style);

  var button = document.createElement('button');
  button.className = 'selvanto-btn';
  button.setAttribute('aria-label', 'Open chat');
  button.style.background = widgetColor;
  button.style.boxShadow = '0 8px 25px ' + widgetColor + '66';

  var chatIcon = \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/></svg>\`;
  var closeIcon = \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>\`;
  button.innerHTML = chatIcon;

  var frame = document.createElement('iframe');
  frame.src = baseUrl + '/widget/' + encodeURIComponent(botId);
  frame.className = 'selvanto-frame';
  frame.setAttribute('title', 'AI Chat Widget');

  var badge = document.createElement('div');
  badge.className = 'selvanto-badge';
  badge.style.display = 'none';
  badge.innerHTML = \`<button class="selvanto-badge-close" id="selvanto-badge-close">✕</button><div class="selvanto-typing"><span></span><span></span><span></span></div>\`;

  function openChat() {
    opened = true;
    badge.style.display = 'none';
    frame.classList.add('open');
    button.innerHTML = closeIcon;
    setTimeout(function(){ frame.classList.add('visible'); }, 10);
  }

  function closeChat() {
    opened = false;
    userClosedManually = true;
    frame.classList.remove('visible');
    button.innerHTML = chatIcon;
    setTimeout(function(){ frame.classList.remove('open'); }, 250);
  }

  button.addEventListener('click', function(){
    if (opened) { closeChat(); } else { openChat(); }
  });

  function showBadge(msg) {
    badge.style.display = 'block';
    var typingEl = badge.querySelector('.selvanto-typing');
    typingEl.style.display = 'inline-flex';
    setTimeout(function(){
      typingEl.style.display = 'none';
      typingEl.insertAdjacentHTML('afterend', '<span>' + msg + '</span>');
    }, 1500);
  }

  if (autoOpenDelay > 0) {
    setTimeout(function(){
      if (!opened && !userClosedManually) {
        // Сначала показываем badge с typing
        showBadge(badgeMessage);
        // Через 3 секунды после badge — открываем чат
        setTimeout(function(){
          if (!opened && !userClosedManually) {
            openChat();
          }
        }, 3000);
      }
    }, autoOpenDelay);
  }

  badge.addEventListener('click', function(e){
    if (e.target.id === 'selvanto-badge-close') {
      badge.style.display = 'none';
      userClosedManually = true;
      return;
    }
    openChat();
  });

  document.body.appendChild(button);
  document.body.appendChild(frame);
  document.body.appendChild(badge);
})();`;

  return new NextResponse(js, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}