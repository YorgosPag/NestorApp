#!/usr/bin/env python3
"""QA Webhook Sender — sends simulated Telegram webhook messages to localhost."""
import json
import sys
import urllib.request
import time

URL = "http://localhost:3000/api/communications/webhooks/telegram"
CHAT_ID = 5618410820
USER_NAME = "St€ F@no"
BASE_MSG_ID = 200000

def send(msg_id_offset: int, text: str) -> dict:
    """Send a simulated Telegram webhook payload."""
    payload = {
        "update_id": BASE_MSG_ID + msg_id_offset,
        "message": {
            "message_id": BASE_MSG_ID + msg_id_offset,
            "from": {"id": CHAT_ID, "first_name": USER_NAME, "is_bot": False},
            "chat": {"id": CHAT_ID, "type": "private"},
            "date": int(time.time()),
            "text": text
        }
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=data, headers={"Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read())

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python qa-webhook.py <msg_id_offset> <text>")
        sys.exit(1)
    offset = int(sys.argv[1])
    text = sys.argv[2]
    result = send(offset, text)
    print(json.dumps(result, ensure_ascii=False))
