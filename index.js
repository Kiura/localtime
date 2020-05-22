const Telegraf = require(`telegraf`)
const geoTz = require(`geo-tz`)
const moment = require(`moment`)
const mtz = require(`moment-timezone`)

const db = require(`./models/db`)

const bot_token = process.env.BOT_TOKEN
const bot = new Telegraf(bot_token)

const eleutheromaniac95 = 89285162

bot.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start,
    hour = start.getHours(),
    minute = start.getMinutes(),
    second = start.getSeconds()
  console.log(`${hour}:${minute}:${second} response time ${ms}`)
})

bot.use(db)

// -----
bot.start((ctx) => ctx.reply(`Hello, this bot is only useful when you add it to a group.
Add this bot to a group, ask its members to set timezone (it is easy to set: just send current location to the group or to the bot directly or use /settimezone command).
Use /help to display help info
`))

const helpMessage = `Use /lt to display local time for 10 last active users.
Use /ltall {local time} to display local time for all users.
Use /ltu {local time} @username to display local time for a user.
If you pass {local time} to /lt and /ltall it will display local times at that specific time ({local time} could be in any of the following formats: 'hh:mm A', 'h:mm A', 'hhmm A', 'hmm A', etc...).
Use /settimezone {timezone} to set timezone (Example of the command: /settimezone Europe/Berlin).
Or the easiest way to set timezone is to send current location to the bot or group with this bot.
Or choose from the dropdown menu which is promted when you type @localtime_bot.
Admins can use /settimezone {timezone} @username to set timezone for any user in the group (if user has not set it already).
Use /listtimezones {filter} to list timezones. only 9 items shown at most to reduce cluttering the chat.
Use /settimeformat {format} to specify whether you want 24 or 12 (AM/PM) based time format (Example of the command: /settimeformat 24 or /settimeformat 12).
Use /add - to add a user to this chat (example: /add Teddy Europe/Berlin)
Use /feedback {message} to send me any feedback :)
`

bot.command(['help@localtime_bot'], (ctx) => ctx.reply(helpMessage))
bot.help((ctx) => ctx.reply(helpMessage))

const allTZS = mtz.tz.names()
let tzs = []

for (let key in allTZS) {
  tzs.push(allTZS[key])
}
tzs = tzs.sort((a, b) => {
  const an = a.toUpperCase();
  const bn = b.toUpperCase();
  if (an > bn) return 1
  else if (an < bn) return -1
  else return 0
})

bot.command(['listtimezones', 'listtimezones@localtime_bot'], async (ctx) => {
  let message = ``
  let currenttzs = tzs
  const messageArray = ctx.message.text.split(` `)
  if (messageArray.length === 2) {
    const query = messageArray[1]
    currenttzs = tzs.filter((tz) => {
      return tz.toUpperCase().includes(query.toUpperCase())
        || tz.offsetStr.toUpperCase().includes(query.toUpperCase())
    })
  }

  for (let [i, tz] of Object.entries(currenttzs)) {
    message += `${tz}
`
    if (i > 7) {
      return ctx.reply(`${message}...`)
    }
  }
  if (!message) return ctx.reply(`could not fetch timezones`)
  return ctx.reply(message)
})

bot.on('inline_query', (ctx) => {
  let index = 0
  let currenttzs = tzs
  let { query, offset } = ctx.update.inline_query
  offset = 1 * offset
  const result = []
  if (query !== ``) {
    currenttzs = tzs.filter((tz) => {
      return tz.toUpperCase().includes(query.toUpperCase())
    })
  }

  if (!offset) {
    if (currenttzs.length > 50) {
      currenttzs = currenttzs.slice(0, 50)
      offset = 50
    }
  } else {
    if (currenttzs.length > offset) {
      if (currenttzs.length - offset > 50) {
        const size = currenttzs.length - offset > 50 ? 50 : currenttzs.length
        currenttzs = currenttzs.slice(offset, offset + size)
        offset = offset + size
      }
    }
  }

  for (let [i, tz] of Object.entries(currenttzs)) {
    result.push({
      id: i,
      type: `article`,
      title: tz,
      description: `Select: ${tz}`,
      input_message_content: {
        message_text: `/settimezone ${tz}`
      }
    })
  }

  ctx.answerInlineQuery(result, { cache_time: 60 * 60, next_offset: offset <= 0 ? '' : offset })
})

bot.command(['add', 'add@localtime_bot'], async (ctx) => {
  const messageArray = ctx.message.text.split(` `)
  if (messageArray.length < 3) {
    return ctx.reply(`please use this format: /add {prefered username} {timezone}. (e.g.: /add Teddy Europe/Berlin)`)
  }
  const chat = await ctx.getOneChat(ctx.getChatID())
  let prefix = chat.username || chat.title || chat.firstName || chat.lastName
  if (!prefix) prefix = Math.floor(100000000 + Math.random() * 900000000)
  const username = `(${prefix}) ${messageArray[1]}`
  const timezone = messageArray[2]
  if (!!!mtz.tz.zone(timezone)) {
    return ctx.reply(`${timezone} is not a valid timezone`)
  }
  let user = await ctx.getUserByUsername(username)
  if (!user) {
    user = await ctx.createUser({ username: username, id: +('11111' + Math.floor(100000000 + Math.random() * 900000000)) })
    ctx.changeUserTimeZone(user.userId, timezone)
  }
  if (await ctx.isMemberOf(user.userId, ctx.getChatID())) {
    return ctx.reply(`cannot add: already added to this chat`)
  }
  await ctx.addToChatAll(ctx.getChatID(), user)
  return ctx.replyWithHTML(`user <b>${user.username}</b> is succesfully added to this chat`)
})

bot.command(['remove', 'remove@localtime_bot'], async (ctx) => {
  const messageArray = ctx.message.text.split(` `)
  if (messageArray.length < 2) {
    return ctx.reply(`please use this format: /remove {username}. (e.g.: /remove Teddy)`)
  }
  const username = ctx.message.text.substring("remove ".length + 1)
  let user = await ctx.getUserByUsername(username)
  if (!user) {
    return ctx.reply(`no such user`)
  }
  const isMemberOf = await ctx.isMemberOf(user.userId, ctx.getChatID())
  if (!isMemberOf) {
    return ctx.reply(`cannot remove: user is not added to this chat`)
  }
  const userId = '' + user.userId
  if (userId.substring(0, 5) != 11111) {
    return ctx.reply(`cannot remove: is not manually added`)
  }
  await ctx.removeFromChatAll(ctx.getChatID(), user)
  return ctx.replyWithHTML(`user <b>${user.username}</b> is succesfully removed from this chat`)
})

bot.command(['settimeformat', 'settimeformat@localtime_bot'], async (ctx) => {
  const messageArray = ctx.message.text.split(` `)
  if (messageArray.length < 2 || (messageArray[1] != `24` && messageArray[1] != `12`)) {
    return ctx.reply(`please use this format: /settimeformat TimeFormat. (e.g.: /settimeformat 24 or /settimeformat 12)`)
  }
  const format = messageArray[1]
  ctx.editChat({ chatId: ctx.getChatID(), timeFormat: format })
  return ctx.reply(`time format for this chat is set to: ${format}`)
})

bot.command(['settimezone', 'settimezone@localtime_bot'], async (ctx) => {
  const messageArray = ctx.message.text.split(` `)
  if (messageArray.length < 2) {
    return ctx.reply(`please use this format: /settimezone YourTimezone. (e.g.: /settimezone Europe/Berlin)`)
  }
  const tz = messageArray[1]
  if (!!!mtz.tz.zone(tz)) {
    return ctx.reply(`${tz} is not a valid timezone`)
  }
  if (messageArray.length === 3) {
    const admin = await ctx.getChatMember(ctx.getUserID()).catch(() => false)
    if (admin.status !== 'creator' && admin.status !== 'administrator') {
      return ctx.reply(`only admins can set timezone for members`)
    }
    const username = messageArray[2]
    // TODO: get only for this group
    const user = await ctx.getUserByUsername(username.substring(1))
    if (!user) return ctx.reply(`no user with username ${username}`)
    if (user.timezone) return ctx.reply(`cannot change timezone for a user who has already set it`)
    const isMemberOf = await ctx.isMemberOf(user.userId, ctx.getChatID())
    if (!isMemberOf) {
      return ctx.reply(`cannot set timezone for a user who is not a member of this group`)
    }
    ctx.changeUserTimeZone(user.userId, tz)
    return ctx.reply(`@${ctx.getName(admin.user)} set timezone to ${tz} for @${ctx.getName(user)}`)
  }

  ctx.changeUserTimeZone(ctx.getUserID(), tz)
  return ctx.reply(`@${ctx.getName(ctx.from)} timezone is set to ${tz}`)
})

bot.on([`location`], (ctx) => {
  const { latitude, longitude } = ctx.message.location
  const timezone = geoTz(latitude, longitude)
  const tz = timezone[0]
  if (!!!mtz.tz.zone(tz)) {
    return ctx.reply(`${tz} is not a valid timezone, please try setting the timezone manually`)
  }
  ctx.changeUserTimeZone(ctx.getUserID(), tz, ctx.message.location)
  return ctx.reply(`@${ctx.getName(ctx.from)} timezone is set to ${tz}`)
})


bot.command(['ltu', 'ltu@localtime_bot'], async (ctx) => {
  const messageArray = ctx.message.text.split(` `)
  let username = null
  if (messageArray.length !== 2 || messageArray[1].charAt(0) !== `@`) {
    return ctx.reply(`please provide a valid username`)
  }
  username = messageArray[1]

  let localTime;
  if (messageArray.length > 1) {
    messageArray.shift()
    const lt = messageArray.join(``)
    const currentUser = await ctx.getOneUser(ctx.getUserID())
    const parsedTime = mtz(lt, ['hh:mm A', 'h:m A', 'h:mm A', 'hhmm A', 'hmm A'])
    if (currentUser && currentUser.timezone && parsedTime) {
      localTime = mtz().tz(currentUser.timezone)
      if (localTime) {
        localTime.set('hour', parsedTime.get('hour'))
        localTime.set('minutes', parsedTime.get('minutes'))
      }
    }
  }

  // TODO: only allow to get user from this group
  const user = await ctx.getUserByUsername(username.substring(1))
  if (!user || !!!mtz.tz.zone(user.timezone)) {
    return ctx.reply(`user has not set timezone or set to incorrect one: ${user.timezone}`)
  }
  const isMemberOf = await ctx.isMemberOf(user.userId, ctx.getChatID())
  if (!isMemberOf) {
    return ctx.reply(`cannot get timezone of a user who is not a member of this group`)
  }
  let format = `hh:mm A`
  let chat = await ctx.getOneChat()
  if (chat && chat.timeFormat && chat.timeFormat === `24`) {
    format = `HH:mm`
  }

  let time = mtz().tz(user.timezone).format(format)
  if (localTime) {
    time = moment(localTime).tz(user.timezone).format(format)
  }
  return ctx.replyWithHTML(`⏰ <b>${time}</b> ${user.flag || ''} ${ctx.getName(user)}`)
})

async function showLocaltime(ctx, all) {
  const m = ctx.message.text.substring(ctx.message.text.toLowerCase().indexOf(`/lt`))
  const messageArray = m.split(` `)
  let localTime;
  if (messageArray.length > 1) {
    messageArray.shift()
    const lt = messageArray.join(``)
    const currentUser = await ctx.getOneUser(ctx.getUserID())
    const parsedTime = mtz(lt, ['hh:mm A', 'h:m A', 'h:mm A', 'hhmm A', 'hmm A'])
    if (!parsedTime) return ctx.reply(`Please provide a time in one of following formats: hh:mm A, h:m A, h:mm A, hhmm A, hmm A`)
    localTime = mtz().tz(currentUser.timezone)
    if (!localTime) return ctx.reply(`could not get timezone for current user, please set your timezone in order to check other users timezone`)
    localTime.set('hour', parsedTime.get('hour'))
    localTime.set('minutes', parsedTime.get('minutes'))
  }

  const chID = ctx.getChatID()
  let users = []
  if (all) {
    users = await ctx.getChatAll(chID)
    if (users && users.length !== 0) users = users.members
    if (!users) return ctx.reply(`No user has set timezone in this group`)
  } else {
    users = await ctx.getChatActive(chID)
    if (users && users.length !== 0) users = users.active
    if (!users) return ctx.reply(`No user has set timezone in this group`)
  }

  let userTime = []
  for (let user of users) {
    if (!user.timezone || !!!mtz.tz.zone(user.timezone)) continue
    if (localTime) {
      userTime.push({ user: user, time: moment(localTime).tz(user.timezone) })
    } else {
      userTime.push({ user: user, time: mtz().tz(user.timezone) })
    }
  }
  userTime = userTime.sort((a, b) => {
    const aoffset = a.time.format(`ZZ`)
    const boffset = b.time.format(`ZZ`)
    if (aoffset < boffset) return -1
    else if (aoffset === boffset) return 0
    return 1
  })
  let format = `hh:mm A`
  let chat = await ctx.getOneChat()
  if (chat && chat.timeFormat && chat.timeFormat === `24`) {
    format = `HH:mm`
  }
  console.log(chat, format)
  let message = ``
  for (let ut of userTime) {
    message += `⏰ <b>${ut.time.format(format)}</b> ${ut.user.flag || ''} ${ctx.getName(ut.user)}
`
  }
  if (message === ``) {
    return ctx.reply(`No user has set timezone in this group`)
  }
  return ctx.replyWithHTML(message)
}

bot.command(['ltall', 'ltall@localtime_bot'], async (ctx) => {
  await showLocaltime(ctx, true)
})
bot.command(['lt', 'lt@localtime_bot'], async (ctx) => {
  await showLocaltime(ctx, false)
})

bot.command(['feedback', 'feedback@localtime_bot'], async (ctx) => {
  const messageArray = ctx.message.text.split(` `)
  if (messageArray.length < 2) {
    return ctx.reply(`empty message`)
  }
  let message = ctx.message.text
  const shortCommand = '/feedback'
  const longCommand = '/feedback@localtime_bot'

  if (message.substring(0, longCommand.length) == longCommand) {
    message = message.substring(longCommand.length + 1, message.length)
  } else if (message.substring(0, shortCommand.length) == shortCommand) {
    message = message.substring(shortCommand.length + 1, message.length)
  }
  const user = await ctx.getOneUser()
  message = `@${user.username} ${message}`

  bot.telegram.sendMessage(eleutheromaniac95, message, {
    parse_mode: `MarkdownV2`
  })
})

// all
bot.hears(/\/ltall\b|s\/atall\b/ig, async (ctx) => {
  await showLocaltime(ctx, true)
})

bot.hears(/\/lt\b|\/at\b/ig, async (ctx) => {
  await showLocaltime(ctx, false)
})

bot.hears(/^\/sendtoall/ig, async (ctx) => {
  if (ctx.getUserID() != eleutheromaniac95) return ctx.reply(`you are not allowed to use this command`)
  const messageArray = ctx.message.text.split(` `)
  if (messageArray.length < 2) {
    return ctx.reply(`empty message`)
  }
  const message = ctx.message.text.substring(11, ctx.message.text.length)

  try {
    const users = await ctx.getUsers()
    for (const user of users) {
      bot.telegram.sendMessage(user.userId, message, {
        parse_mode: `MarkdownV2`
      })
    }
  } catch (e) {
    console.log(e)
  }
})

// bot.telegram.setWebhook(`https://4fbff081.ngrok.io/bot`)
bot.telegram.setWebhook(`https://localtime.xyz/bot`)


// init project
const express = require(`express`);
const app = express()
app.use(express.json())

const bearerToken = require(`express-bearer-token`)
app.use(bearerToken())

app.get(`/`, (req, res) => res.send(`ok`))

// app.use(bot.webhookCallback('/bot'))
app.post(`/bot`, (req, res) => {
  bot.handleUpdate(req.body)
  res.status(200).send(`ok`)
})

// app.post(`/message`, async (req, res) => {
//   const { message } = req.body
//   // const token = req.headers.authorization
//   let users = await db.db.getUsers()
//   for (const user of users) {
//     bot.telegram.sendMessage(user.userId, message, {
//       parse_mode: `MarkdownV2`
//     })
//   }
//   res.status(200).send(`ok`)
// })

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`app listening on port ${port}`)
})


