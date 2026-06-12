# Gold News Bot

A Telegram bot for XAU/USD (gold) traders. Every 5 minutes it checks three
sources and posts alerts to a Telegram chat:

1. **Economic calendar** — warns ~30 min before USD High/Medium-impact events
   (ForexFactory's free FairEconomy calendar feed).
2. **Market news** — gold-relevant breaking headlines (Finnhub).
3. **Squawk** — fast squawk-style headlines (FinancialJuice RSS).

Each source de-duplicates alerts and remembers what it sent across restarts
(`seen.json`, `seen-squawk.json`).

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Where to get it |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | yes | Add the bot to your group, then read the id |
| `FINNHUB_API_KEY` | optional | https://finnhub.io/register (news skipped if blank) |

## Run locally

```bash
npm install
node index.js
```

## Deploy on Oracle Cloud (Always Free)

These steps assume an **Always Free VM** running **Ubuntu** (Ampere ARM or AMD).
The bot only makes **outbound** connections (Telegram + feeds), so you do **not**
need to open any inbound ports or firewall rules.

### 1. Create the VM
- Oracle Cloud → Compute → Instances → Create instance.
- Shape: an **Always Free eligible** shape (e.g. `VM.Standard.A1.Flex`, 1 OCPU /
  6 GB is plenty).
- Image: Canonical Ubuntu.
- Download the SSH private key, then connect:
  ```bash
  ssh -i your-key.key ubuntu@<VM_PUBLIC_IP>
  ```

### 2. Install Node.js + git
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
node -v   # confirm it works
```

### 3. Get the code and configure
```bash
git clone <your-repo-url> gold-news-bot
cd gold-news-bot
npm install
cp .env.example .env
nano .env          # paste your real tokens, then Ctrl+O, Enter, Ctrl+X
```

### 4. Run it 24/7 with pm2
```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # run the command it prints (sets up auto-start on reboot)
```

### Useful pm2 commands
```bash
pm2 logs gold-bot      # watch alerts live
pm2 restart gold-bot   # after a code change / git pull
pm2 status             # is it running?
pm2 stop gold-bot
```

### Updating later
```bash
cd gold-news-bot
git pull
npm install
pm2 restart gold-bot
```

## Notes
- Times are always shown in **Cambodia time** (`Asia/Phnom_Penh`), regardless of
  the server's own timezone.
- `seen.json` / `seen-squawk.json` are runtime state and are git-ignored — keep
  them on the server so the bot doesn't re-send old headlines after a restart.
- If your group is upgraded to a supergroup, Telegram changes the chat id;
  update `TELEGRAM_CHAT_ID` in `.env` and `pm2 restart gold-bot`.
