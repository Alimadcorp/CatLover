const { App, ExpressReceiver } = require('@slack/bolt')

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
  endpoints: '/api/slack/events'
})

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
})

async function getThread (client, channel, thread_ts, latest) {
  const byTs = new Map()
  let cursor
  do {
    const res = await client.conversations.replies({
      channel,
      ts: thread_ts,
      latest,
      inclusive: true,
      limit: 200,
      cursor
    })
    for (const m of res.messages || []) {
      byTs.set(m.ts, m)
    }
    cursor = res.response_metadata?.next_cursor
  } while (cursor)

  // guarantee strict chronological order from parent (thread_ts) to latest
  return [...byTs.values()].sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))
}

function isGoMessage (text) {
  if (!text) return false
  // strip slack formatting (*, _, ~, `) and invisible unicode characters
  const cleaned = text.replace(/[*_~`\u200B-\u200D\uFEFF]/g, '').trim()
  return /^go!*$/i.test(cleaned)
}

app.event('app_mention', async ({ event, client, context }) => {
  if (context.retryNum) return

  const { channel, thread_ts, ts: pingTs } = event

  if (!thread_ts) {
    await client.chat.postMessage({
      channel,
      text: 'Ping me inside a thread to tally a `:cat-chips:` match!'
    })
    return
  }

  const msgs = await getThread(client, channel, thread_ts, pingTs)
  if (!msgs.length) return

  const parent = msgs[0]
  const host = parent.user

  let goIdx = -1
  for (let i = 1; i < msgs.length; i++) {
    const m = msgs[i]
    if (m.ts === pingTs || parseFloat(m.ts) >= parseFloat(pingTs)) break
    if (m.user === host && isGoMessage(m.text)) {
      goIdx = i
    }
  }

  if (goIdx === -1) {
    console.log('GO not found:', {
      totalFetched: msgs.length,
      host,
      parentTs: parent.ts,
      pingTs,
      sampleMsgs: msgs
        .slice(0, 5)
        .map(m => ({ ts: m.ts, user: m.user, text: m.text }))
    })

    await client.chat.postMessage({
      channel,
      thread_ts,
      text: `No \`GO!\` found from <@${host}> across ${msgs.length} messages. Tell them to send \`GO!\` to start the match.`
    })
    return
  }

  const scores = new Map()
  const dq = new Set()

  for (let i = goIdx + 1; i < msgs.length; i++) {
    const m = msgs[i]
    if (m.ts === pingTs || parseFloat(m.ts) >= parseFloat(pingTs)) break
    if (m.bot_id || !m.user) continue

    const u = m.user
    if (dq.has(u)) continue

    const clean = (m.text || '').trim()
    const isValid =
      clean === ':cat-chips:' && (!m.files || m.files.length === 0)

    if (isValid) {
      scores.set(u, (scores.get(u) || 0) + 1)
    } else {
      dq.add(u)
    }
  }

  if (scores.size === 0) {
    await client.chat.postMessage({
      channel,
      thread_ts,
      text: 'No valid `:cat-chips:` were sent before everyone got disqualified!'
    })
    return
  }

  const board = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const [winnerId, topScore] = board[0]

  const lines = board.map(([u, count], idx) => {
    const badge = dq.has(u) ? ' _(DQ)_' : ''
    return `${idx + 1}. <@${u}> — *${count}* :cat-chips:${badge}`
  })

  const out = [
    `:trophy: *Winner:* <@${winnerId}> with *${topScore}* :cat-chips:!`,
    '',
    '*Leaderboard:*',
    ...lines
  ].join('\n')

  await client.chat.postMessage({
    channel,
    thread_ts,
    text: out
  })
})

module.exports = receiver.app
