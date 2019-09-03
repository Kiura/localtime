const Telegraf = require(`telegraf`)
const LocalSession = require(`telegraf-session-local`)
const geoTz = require(`geo-tz`)
const moment = require(`moment`)
const mtz = require(`moment-timezone`)

const db = require(`./models/db`)

const bot_token = process.env.BOT_TOKEN
const bot = new Telegraf(bot_token)


bot.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`Response time %sms`, ms)
})

bot.use(db)

// -----
bot.start((ctx) => ctx.reply(`Hello, this bot is only useful when you add it to a group.
Add this bot to a group, ask its members to set timezone (it is easy to set: just send current location to the group or to the bot directly or use /settimezone command).
Use /help to display help info
`))

bot.help((ctx) => ctx.reply(`Use /lt to display local time for 10 last active users.
Use /ltall to display local time for all users.
Use /ltu @username to display local time for a user.
If you pass {local time} to /lt and /ltall it will display local times at that specific time ({local time} could be in any of the following formats: 'hh:mm A', 'h:mm A', 'hhmm A', 'hmm A', etc...).
Use /settimezone to set timezone (Example of the command: /settimezone Europe/Berlin).
Or the easiest way to set timezone is to send current location to the bot or group with this bot.
Or choose from the dropdown menu which is promted when you type @localtime_bot.
`))

const ct = require('countries-and-timezones')
const allTZS = ct.getAllTimezones()
let tzs = []

for (let key in allTZS) {
  tzs.push(allTZS[key]) 
}
tzs = tzs.sort((a, b) => {
  const an = a.name.toUpperCase();
  const bn = b.name.toUpperCase();
  if (an>bn) return 1
  else if (an<bn) return -1
  else return 0
})

bot.on('inline_query', (ctx) => {
  let index = 0
  let currenttzs = tzs
  let {query, offset} = ctx.update.inline_query
  offset = 1*offset
  const result = []
  if (query !== ``) {
    currenttzs = tzs.filter((tz)=> tz.name.toUpperCase().includes(query.toUpperCase()))
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
        currenttzs = currenttzs.slice(offset, offset+size)
        offset = offset+size
      }
    }
  }
  
  // if ()
  for (let [i, tz] of Object.entries(currenttzs)) {
    result.push({
      id: i,
      type: `article`,
      title: tz.name,
      description: `UTC offset: ${tz.offsetStr}`,
      input_message_content: {
        message_text: `/settimezone ${tz.name}`
      }
    })
  }
  
  ctx.answerInlineQuery(result, {cache_time: 60*60, next_offset: offset <= 0 ? '' : offset})
})

bot.command('settimezone', async (ctx) => {
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
		if (admin.status === 'creator' || admin.status === 'creator') {
			return ctx.reply(`only admins can set timezone for members`)
		}
		const username = messageArray[2]
		const user = await ctx.getUserByUsername(username)
		if (!user) return ctx.reply(`no user with username ${username}`)
		if (!ctx.changeUserTimeZone(user.userId, tz)){
	  		return ctx.reply(`Could not set timezone`)
		}
		return ctx.reply(`@${ctx.getName(user)} timezone is set to ${tz}`)
	}

  	if (!ctx.changeUserTimeZone(ctx.getUserID(), tz)){
  		return ctx.reply(`Could not set timezone`)
	}
  	return ctx.reply(`@${ctx.getName(ctx.from)} timezone is set to ${tz}`)
})

bot.on([`location`], (ctx) => {
  const {latitude,longitude} = ctx.message.location
  const timezone = geoTz(latitude, longitude)
  const tz = timezone[0]
  if (ctx.changeUserTimeZone(ctx.getUserID(), tz, ctx.message.location)) {
  	return ctx.reply(`@${ctx.getName(ctx.from)} timezone is set to ${tz}`)
  }
  return ctx.reply(`Could not set timezone`)
})

async function showLocaltime(ctx, all) {
	const m = ctx.message.text.substring(ctx.message.text.toLowerCase().indexOf(`/lt`))
	const messageArray = m.split(` `)
	let localTime;
	if (messageArray.length > 1) {
		messageArray.shift()
		const lt = messageArray.join(``)
		const currentUser = await ctx.getUserOne(ctx.getUserID())
		const parsedTime = mtz(lt, ['hh:mm A', 'h:m A', 'h:mm A', 'hhmm A', 'hmm A'])
		localTime = mtz().tz(currentUser.timezone)
		localTime.set('hour', parsedTime.get('hour'))
		localTime.set('minutes', parsedTime.get('minutes'))
	}

	// TODO: here
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
			userTime.push({user:user, time:moment(localTime).tz(user.timezone)})
		} else {
			userTime.push({user:user, time:mtz().tz(user.timezone)})
		}
	}
	userTime = userTime.sort((a,b)=> {
		const aoffset = a.time.format(`ZZ`)
		const boffset = b.time.format(`ZZ`)
		if (aoffset < boffset) return -1
		else if (aoffset === boffset)  return 0
		return 1
	})

	let message = ``
	for (let ut of userTime) {
		message += `${ut.user.flag || ut.user.country || ''} ${ctx.getName(ut.user)} ⏰ <b>${ut.time.format(`hh:mm A`)}</b>
`
	}
	if (message === ``) {
		return ctx.reply(`No user has set timezone in this group`)
	}
	return ctx.replyWithHTML(message)
}

bot.command('ltall', async (ctx) => {
	await showLocaltime(ctx, true)
})
bot.command('lt', async (ctx) => {
	await showLocaltime(ctx, false)
})


bot.command('ltu', async (ctx) => {
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
	let time = mtz().tz(user.timezone).format(`hh:mm A`)
	if (localTime) {
		time = moment(localTime).tz(user.timezone).format(`hh:mm A`)
	}
	return ctx.replyWithHTML(`${user.flag || user.country || ''} ${ctx.getName(user)} ⏰ <b>${time}</b>`)
})

// all
bot.hears(/\/ltall\b|s\/atall\b/ig, async (ctx) => {
	await showLocaltime(ctx, true)
})

bot.hears(/\/lt\b|\/at\b/ig, async (ctx) => {
	await showLocaltime(ctx, false)
})

bot.telegram.setWebhook(`https://localtime.xyz/bot`)



// init project
const express = require(`express`);
const app = express()
app.use(express.json())

const bearerToken = require(`express-bearer-token`)
app.use(bearerToken())

app.get(`/`, (req, res) => res.send(`ok`))

// app.use(bot.webhookCallback('/bot'))
app.post(`/bot`,(req, res)=>{
  bot.handleUpdate(req.body)
  res.status(200).send(`ok`)
})
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`app listening on port ${port}`)
})


