const me = `89285162`
const trix = `-304017857`

const Telegraf = require(`telegraf`)
const telegrafGetChatMembers = require('telegraf-getchatmembers')
const session = require(`telegraf-session-local`)
const geoTz = require('geo-tz')
const moment = require('moment')
const mtz = require('moment-timezone')

const members = require(`./members`)

const token = process.env.BOT_TOKEN
const bot = new Telegraf(token)

// -----
bot.use(telegrafGetChatMembers)
const localSession = new session({ 
	database: `users.json`,
  storage: session.storageFileAsync,
	getSessionKey: (ctx) => {
		return `users`
	},
})
bot.use(localSession.middleware())
bot.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`Response time %sms`, ms)
})
bot.use(members)
bot.use( (ctx, next) => {
	let users = ctx.session.users || {}
	if (!users.active) users.active = {}
	if (!users.active[ctx.getChatID()]) users.active[ctx.getChatID()] = []
	if (users.active[ctx.getChatID()].includes(ctx.getUserID())) {
		return next()
	}
	users.active[ctx.getChatID()].push(ctx.getUserID())
	if (users.active[ctx.getChatID()].length > 10) {
		users.active[ctx.getChatID()].shift()
	}
	ctx.session.users = users
	return next()
})

bot.use( (ctx, next) => {
	let users = ctx.session.users || {}
	if (!users.all) users.all = {}
	if (!users.all[ctx.getChatID()]) users.all[ctx.getChatID()] = []
	if (users.all[ctx.getChatID()].includes(ctx.getUserID())) {
		return next()
	}
	users.all[ctx.getChatID()].push(ctx.getUserID())
	ctx.session.users = users
	return next()
})

// -----
bot.start((ctx) => ctx.reply(`Hello, this bot is only useful when you add it to a group.
Add this bot to a group, ask its members to set timezone (it is easy to set: just send current location to the group or to the bot directly or use /settimezone command).
Use /help to display help info
`))

bot.help((ctx) => ctx.reply(`Use /lt to display local time for 10 last active users.
Use /ltall to display local time for all users.
Use /ltu @username to display local time for a user.
If you pass {local time} to /lt and /ltall it will display local times at that specific time ({local time} could be in any of the following formats: 'hh:mm A', 'h:mm A', 'hhmm A', 'hmm A').
Use /settimezone to set timezone (Example of the command: /settimezone Europe/Berlin).
Or the easiest way to set timezone is to send current location to the bot or group with this bot.
`))

bot.command('settimezone', (ctx) => {
	// stop if no / present
	if (!ctx.message.text.includes(`/`)) {
		return ctx.reply(`please use this format: /settimezone YourTimezone. (e.g.: /settimezone Europe/Berlin)`)
	}
	const messageArray = ctx.message.text.split(` `)
	if (messageArray.length < 2) {
		return ctx.reply(`please use this format: /settimezone YourTimezone. (e.g.: /settimezone Europe/Berlin)`)
	}
	const tz = messageArray[1]
	if (!!!mtz.tz.zone(tz)) {
		return ctx.reply(`${tz} is not a valid timezone`)
	}
	ctx.changeUserTimeZone(ctx.getUserID(), tz)
  return ctx.reply(`@${ctx.from.username} timezone is set to ${tz}`)
})

bot.on([`location`], (ctx) => {
	// if (ctx.chat.username) {}
  const {latitude,longitude} = ctx.message.location
  const timezone = geoTz(latitude, longitude)
  const tz = timezone[0]
  if (ctx.changeUserTimeZone(ctx.getUserID(), tz, ctx.message.location)) {
  	return ctx.reply(`@${ctx.from.username} timezone is set to ${tz}`)
  }
  return ctx.reply(`Could not set timezone`)
})

function showLocaltime(ctx, all) {
	const messageArray = ctx.message.text.split(` `)
	let localTime;
	if (messageArray.length > 1) {
		messageArray.shift()
		const lt = messageArray.join(``)
		const currentUser = ctx.getUser(ctx.getUserID())
		const parsedTime = mtz(lt, ['hh:mm A', 'h:m A', 'h:mm A', 'hhmm A', 'hmm A'])
		localTime = mtz().tz(currentUser.timezone)
		localTime.set('hour', parsedTime.get('hour'))
		localTime.set('minutes', parsedTime.get('minutes'))
	}

	const chID = ctx.getChatID()
	let users = ctx.session.users || {}
	let usersIDs = users.active[ctx.getChatID()]
	if (all) {
		usersIDs = users.all[ctx.getChatID()]
	}

	let userTime = []
	for (let uID of usersIDs) {
		if (uID === true || uID === false) continue 
		const user = ctx.getUser(uID)
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
		message += `${ut.user.flag || ut.user.country || ''} ${ut.user.user.username} ⏰ <b>${ut.time.format(`hh:mm A`)}</b>
`
	}
	if (message === ``) {
		return ctx.reply(`No user has set timezone in this group`)
	}
	return ctx.replyWithHTML(message)
}

bot.command('ltall', async (ctx) => {
	showLocaltime(ctx, true)
})
bot.command('lt', async (ctx) => {
	showLocaltime(ctx, false)
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
		const currentUser = ctx.getUser(ctx.getUserID())
		const parsedTime = mtz(lt, ['hh:mm A', 'h:m A', 'h:mm A', 'hhmm A', 'hmm A'])
		localTime = mtz().tz(currentUser.timezone)
		localTime.set('hour', parsedTime.get('hour'))
		localTime.set('minutes', parsedTime.get('minutes'))
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
	return ctx.replyWithHTML(`${user.flag || user.country || ''} ${user.user.username} ⏰ <b>${time}</b>`)
})

// bot.hears(/[\s\S]+/g, (ctx) => {
// 	// ctx.reply(`Hey there`)
// 	// for (let user of users) {}
// })

// bot.mention(`@Eleutheromaniac95`, (ctx) => {console.log(ctx.text)})



bot.launch()
