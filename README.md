# Cat Lover

A stateless Slack bot for the Hack Club Slack workspace for `:cat-chips:` competitions.

## How It Works
1. Start a thread in any public or private channel where **Cat Lover** is invited.
2. The **original thread author** sends `GO` or `GO!` to start the match.
3. Participants send single-emoji `:cat-chips:` messages under the thread.
4. Sending anything other than `:cat-chips:` and you're disqualified.
5. Ping `@Cat Lover` inside the thread to end the round. The bot tallies all valid `:cat-chips:` sent between the most recent `GO!` and the ping, then posts the winner and leaderboard.

---

## Project Structure
```text
/
├── api/
│   └── slack/
│       └── events.js    # The bot itself
├── manifest.json        # Slack app configuration (update the webhook url btw)
├── package.json
├── vercel.json
└── README.md
```

## Deployment
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAlimadcorp%2FCatLover&env=SLACK_BOT_TOKEN,SLACK_SIGNING_SECRET,SLACK_APP_TOKEN)

### Creating the Slack App
1. Open [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** → **From an app manifest**.
1. Choose the **Hack Club** workspace, paste the contents of `manifest.json` (leave `request_url` as a placeholder URL for now), and create the app.
1. Under **Basic Information** → **App Credentials**, copy the **Signing Secret**.
1. Go to **OAuth & Permissions**, click **Install to Hack Club** → **Allow**, and copy the **Bot User OAuth Token** (`xoxb-...`).
