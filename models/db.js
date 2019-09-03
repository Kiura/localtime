const mongoose = require(`mongoose`)
const flag = require(`country-code-emoji`)
const wc = require(`which-country`)
const ct = require(`countries-and-timezones`)
const getCountryISO2 = require(`country-iso-3-to-2`)
const User = require(`./user`)
const Chat = require(`./chat`)

const mongourl = process.env.MONGO_URL || `mongodb+srv://user:password@website.com/test?retryWrites=true&w=majority`
mongoose.connect(mongourl, {useNewUrlParser: true, useCreateIndex: true})
const db = mongoose.connection
let IS_DB_READY = false
db.on('error', (err)=>{
	throw err
});
db.once('open', function() {
  IS_DB_READY = true
});

const isDBReady = function() {
	if (!IS_DB_READY) console.error(`db is not ready yet`)
	return IS_DB_READY
} 

const getName = function(user) {
  if (user.username) {
    return user.username
  } else if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`
  } else if (user.first_name) {
    return user.first_name
  } else if (user.last_name) {
    return user.last_name
  } 
  return `anonymous`
}

const getChatID = function () {
	if (this.chat) {
		return this.chat.id
	}
	return
}

const getUserID = function () {
	if (this.from) {
		return this.from.id
	}
	return
}

const editUser = async function (user) {
	if (!this.isDBReady()) return

	let u = await User.find({userId: user.userId})
	if (!u) {
		console.log(`no such user found in the db`)
		return
	}
	if (user.firstName) u.firstName = user.firstName
	if (user.lastName) u.lastName = user.lastName
	if (user.username) u.username = user.username
	if (user.timezone) u.timezone = user.timezone
	if (user.country) u.country = user.country
	if (user.flag) u.flag = user.flag
}

const createUser = async function (user) {
	if (!this.isDBReady()) return
	const u = new User({
		userId: user.id,
		firstName: user.first_name || '',
		lastName: user.lastName || '',
		username: user.username || '',
		timezone: user.timezone || '',
		country: user.country || '',
		flag: user.flag || '',
	})
	try {
		await u.save()
	} catch(err) {
		console.log(`unable to save user: ${err}`)
	}
	return u
}

const getUsers = async function () {
	if (!this.isDBReady()) return []

	let users = await User.find({})
	return users
}

const getUser = async function (uID) {
	if (!this.isDBReady()) return
	if (!uID) {
		uID = this.getUserID()
	}
	const user = await User.findOne({userId: uID})
	return user
}

const userExists = async function (uID) {
	if (!this.isDBReady()) return
	if (!uID) {
		uID = this.getUserID()
	}
	const exists = await User.exists({userId: uID})
	return exists
}

const getUserByUsername = async function (username) {
	if (!this.isDBReady()) return
	const user = await User.findOne({username: username})
	return user
}

const createChat = async function (chat) {
	if (!this.isDBReady()) return
	const ch = new Chat({
		chatId: chat.chatId,
		type: chat.type || '',
		title: chat.title || '',
		firstName: chat.first_name || '',
		lastName: chat.last_name || '',
		username: chat.username || '',
	})
	try {
		await ch.save()
	} catch(err) {
		console.log(`unable to save chat: ${err}`)
	}
	return ch
}

const addToChatAll = async function (chID, user) {
	const chat = await this.getAllChat(chID)
	if (!chat) return

	let includes = false
	for (let member of chat.members) {
		if (member.userId === user.userId) {
			includes = true
		}
	}
	if (includes) return
	chat.members.push(user)

	try {
		await chat.save()
	} catch(err) {
		console.log(`cannot add to the group: ${err}`)
		return
	}
}

const addToChatActive = async function (chID, user) {
	const chat = await this.getChatActive(chID)
	if (!chat) return
	console.log(111, chat)
	let includes = false
	for (let member of chat.active) {
		if (member.userId === user.userId) {
			includes = true
		}
	}
	if (includes) return
	chat.active.push(user)
	if (chat.active.length > 10) chat.active.shift()

	try {
		await chat.save()
	} catch(err) {
		console.log(`cannot add to the group: ${err}`)
		return
	}
}

const getChat = async function (chID) {
	if (!this.isDBReady()) return
	if (!chID) {
		chID = this.getChatID()
	}
	const chat = await User.findOne({chatId: chID})
	return chat
}

const chatExists = async function (chID) {
	if (!this.isDBReady()) return
	if (!chID) {
		chID = this.getChatID()
	}
	const exists = await Chat.exists({userId: chID})
	return exists
}

const getChatActive = async function (chID) {
	if (!this.isDBReady()) return
	if (!chID) {
		chID = this.getChatID()
	}
	const chat = await User.find({chatId: chID})
	.populate({
		path: 'active',
	});
	return chat
}

const getChatAll = async function (chID) {
	if (!this.isDBReady()) return
	if (!chID) {
		chID = this.getChatID()
	}
	const chat = await User.find({chatId: chID})
	.populate({
		path: 'members',
	});
	return chat
}

const changeUserTimeZone = function (uID, timezone, location) {
	if (!uID) {
		uID = this.getUserID()
	}
	let user = {}
	user.timezone = timezone
	if (!location) {
		const countries = ct.getCountriesForTimezone(timezone)
    if (countries.length === 0) return false
		user.country = countries[0].id.toUpperCase()
		user.flag = flag(user.country)
	} else {
		const {latitude,longitude} = location
		const country = wc([longitude,latitude])
		if (country) {
			user.country = getCountryISO2(country).toUpperCase()
			user.flag = flag(user.country)
		}
	}
	this.editUser(user)
	return true
}

module.exports = async function (ctx, next) {
	ctx.isDBReady = isDBReady
	ctx.getName = getName
	ctx.getChatID = getChatID
	ctx.getUserID = getUserID
	ctx.editUser = editUser
	ctx.createUser = createUser
	ctx.getUsers = getUsers
	ctx.getUser = getUser
	ctx.userExists = userExists
	ctx.getUserByUsername = getUserByUsername
	ctx.createChat = createChat
	ctx.addToChatAll = addToChatAll
	ctx.addToChatActive = addToChatActive
	ctx.getChat = getChat
	ctx.chatExists = chatExists
	ctx.getChatActive = getChatActive
	ctx.getChatAll = getChatAll
	ctx.changeUserTimeZone = changeUserTimeZone

  	if (ctx.updateType === `inline_query`) return next(ctx)

  	const u = ctx.getUser()
  	ctx.addToChatActive(ctx.getChatID(), u)
	if (u) return next(ctx)
	const user = await ctx.getChatMember(ctx.getUserID()).catch(() => false)
	if (!user) return next(ctx)
  
	const newUser = ctx.createUser({...user.user, status: user.status})
	ctx.addToChatAll(ctx.getChatID(), newUser)
	return next(ctx)
}
