import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const js = `(function(){
  var script = document.currentScript;
  var botId = script && script.getAttribute('data-bot-id');
  if (!botId) return;
  var baseUrl = new URL(script.src).origin;

  var button = document.createElement('button');
  button.textContent = 'Chat';
  button.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#2563eb;color:#fff;border:none;border-radius:999px;padding:12px 16px;font:600 14px sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.2)';

  var frame = document.createElement('iframe');
  frame.src = baseUrl + '/widget/' + encodeURIComponent(botId);
  frame.style.cssText = 'position:fixed;right:20px;bottom:80px;width:360px;max-width:calc(100vw - 24px);height:560px;max-height:70vh;border:1px solid #d1d5db;border-radius:14px;box-shadow:0 15px 45px rgba(0,0,0,.2);z-index:2147483647;background:#fff;display:none';
  frame.setAttribute('title', 'AI Chat Widget');

  button.addEventListener('click', function(){
    frame.style.display = frame.style.display === 'none' ? 'block' : 'none';
  });

  document.body.appendChild(button);
  document.body.appendChild(frame);
})();`;

  return new NextResponse(js, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
