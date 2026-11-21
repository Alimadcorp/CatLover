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

async function getThread (client, channel, thread_ts) {
  let msgs = []
  let cursor
  do {
    const res = await client.conversations.replies({
      channel,
      ts: thread_ts,
      limit: 200,
      cursor
    })
    msgs.push(...res.messages)
    cursor = res.response_metadata?.next_cursor
  } while (cursor)
  return msgs
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

  const msgs = await getThread(client, channel, thread_ts)
  if (!msgs.length) return

  const host = msgs[0].user

  let goIdx = -1
  for (let i = 1; i < msgs.length; i++) {
    const m = msgs[i]
    if (parseFloat(m.ts) >= parseFloat(pingTs)) break
    if (m.user === host && /^go!?$/i.test((m.text || '').trim())) {
      goIdx = i
    }
  }

  if (goIdx === -1) {
    await client.chat.postMessage({
      channel,
      thread_ts,
      text: `No \`GO!\` found from <@${host}> in thread.`
    })
    return
  }

  const scores = new Map()
  const dq = new Set()

  for (let i = goIdx + 1; i < msgs.length; i++) {
    const m = msgs[i]
    if (parseFloat(m.ts) >= parseFloat(pingTs)) break
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
      text: 'No `:cat-chips:` were sent before everyone got disqualified'
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
    '*Everyone else:*',
    ...lines
  ].join('\n')

  await client.chat.postMessage({
    channel,
    thread_ts,
    text: out
  })
})

module.exports = receiver.app
