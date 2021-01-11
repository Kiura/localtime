const mongoose = require(`mongoose`)
const flag = require(`country-code-emoji`)
const wc = require(`which-country`)
const ct = require(`countries-and-timezones`)
const getCountryISO2 = require(`country-iso-3-to-2`)
const User = require(`./user`)
const Chat = require(`./chat`)

const mongourl = process.env.MONGO_URL || `mongodb+srv://user:password@website.com/test?retryWrites=true&w=majority`
mongoose.connect(mongourl, { useNewUrlParser: true, useCreateIndex: true })
const db = mongoose.connection
let IS_DB_READY = false
db.on('error', (err) => {
  throw err
});
db.once('open', function () {
  IS_DB_READY = true
});

let exportDB = {}

exportDB.isDBReady = function () {
  if (!IS_DB_READY) console.error(`db is not ready yet`)
  return IS_DB_READY
}

exportDB.getName = function (user) {
  if (!user) throw new Error(`no user`)
  const u = {
    username: user.username,
    firstName: user.firstName || user.first_name,
    lastName: user.lastName || user.last_name,
  }
  if (u.username) {
    return u.username
  } else if (u.firstName && u.last_name) {
    return `${u.firstName} ${u.last_name}`
  } else if (u.firstName) {
    return u.firstName
  } else if (u.last_name) {
    return u.last_name
  }
  return `anonymous`
}

exportDB.getChatID = function () {
  if (this.chat) return this.chat.id
}

exportDB.getUserID = function () {
  if (this.from) return this.from.id
}

exportDB.editUser = async function (user) {
  if (!this.isDBReady()) return
  let u = await User.findOne({ userId: user.userId })
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
  await u.save()
}

exportDB.createUser = async function (user) {
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
  } catch (err) {
    console.log(`unable to save user: ${err}`)
  }
  return u
}

exportDB.getUsers = async function () {
  if (!this.isDBReady()) return []

  let users = await User.find({})
  return users
}

exportDB.getChats = async function () {
  if (!this.isDBReady()) return []

  let chats = await Chat.find({})
  return chats
}

exportDB.getOneUser = async function (uID) {
  if (!this.isDBReady()) return
  if (!uID) uID = this.getUserID()

  const user = await User.findOne({ userId: uID })
  return user
}

exportDB.userExists = async function (uID) {
  if (!this.isDBReady()) return
  if (!uID) uID = this.getUserID()

  const exists = await User.exists({ userId: uID })
  return exists
}

exportDB.getUserByUsername = async function (username) {
  if (!this.isDBReady()) return
  const user = await User.findOne({ username: username })
  return user
}

exportDB.editChat = async function (chat) {
  if (!this.isDBReady()) return false
  let c = await Chat.findOne({ chatId: chat.chatId })
  if (!c) {
    console.log(`no such chat found in the db`)
    return false
  }
  if (chat.type) c.type = chat.type
  if (chat.title) c.title = chat.title
  if (chat.timeFormat) c.timeFormat = chat.timeFormat
  if (chat.firstName) c.firstName = chat.firstName
  if (chat.lastName) c.lastName = chat.lastName
  if (chat.username) c.username = chat.username
  if (chat.isAutoAddEnabled === true || chat.isAutoAddEnabled === false) {
    c.isAutoAddEnabled = chat.isAutoAddEnabled
  }
  try {
    await c.save()
  } catch (error) {
    console.log("editChat error", error);
    return false
  }
  return true
}

exportDB.enableAutoAdd = async function (chat) {
  const success = await this.editChat({
    chatId: chat.chatId,
    idAutoAddEnabled: true,
  })
  return success
}

exportDB.disableAutoAdd = async function (chat) {
  const success = await this.editChat({
    chatId: chat.chatId,
    isAutoAddEnabled: false,
  })
  return success
}

exportDB.createChat = async function (chat) {
  if (!this.isDBReady()) return
  const ch = new Chat({
    chatId: chat.chatId,
    type: chat.type || '',
    title: chat.title || '',
    timeFormat: chat.timeFormat || '24',
    firstName: chat.first_name || '',
    lastName: chat.last_name || '',
    username: chat.username || '',
  })
  try {
    await ch.save()
  } catch (err) {
    console.log(`unable to save chat: ${err}`)
  }
  return ch
}

exportDB.addToChatAll = async function (chID, user) {
  const chat = await this.getChatAll(chID)
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
  } catch (err) {
    console.log(`cannot add to the group: ${err}`)
    return
  }
}

exportDB.removeFromChatAll = async function (chID, user) {
  const chat = await this.getChatAll(chID)
  if (!chat) return

  let removed = false
  for (let i = chat.members.length - 1; i >= 0; --i) {
    if (chat.members[i].userId === user.userId) {
      chat.members.splice(i, 1)
      removed = true
      break
    }
  }
  if (!removed) return

  try {
    await chat.save()
  } catch (err) {
    console.log(`cannot remove from the group: ${err}`)
    return
  }
}

exportDB.removeFromChatActive = async function (chID, user) {
  const chat = await this.getChatActive(chID)
  if (!chat) return

  let removed = false
  for (let i = chat.active.length - 1; i >= 0; --i) {
    if (chat.active[i].userId === user.userId) {
      chat.active.splice(i, 1)
      removed = true
      break
    }
  }
  if (!removed) return

  try {
    await chat.save()
  } catch (err) {
    console.log(`cannot remove from the group: ${err}`)
    return
  }
}

exportDB.addToChatActive = async function (chID, user) {
  const chat = await this.getChatActive(chID)
  if (!chat) return
  let includes = false
  for (let member of chat.active) {
    if (member.userId === user.userId) {
      includes = true
    }
  }
  if (includes) {
    console.log(`already in active: ${user}`)
    return
  }
  if (user.timezone) {
    console.log(`added to active: ${user}`)
    chat.active.push(user)
  }
  if (chat.active.length > 10) {
    const u = chat.active.shift()
    console.log(`removed from active: ${u}`)
  }

  try {
    await chat.save()
  } catch (err) {
    console.log(`cannot add to the group: ${err}`)
    return
  }
}

exportDB.getOneChat = async function (chID) {
  if (!this.isDBReady()) return
  if (!chID) chID = this.getChatID()

  const chat = await Chat.findOne({ chatId: chID })
  return chat
}

exportDB.chatExists = async function (chID) {
  if (!this.isDBReady()) return
  if (!chID) chID = this.getChatID()

  const exists = await Chat.exists({ chatId: chID })
  return exists
}

exportDB.isMemberOf = async function (uID, chID) {
  if (!this.isDBReady()) return
  if (!uID) uID = this.getUserID()
  if (!chID) chID = this.getChatID()

  const chat = await Chat
    .findOne({ chatId: chID })
    .populate({
      path: 'members',
      match: {
        userId: uID,
      },
    })
  if (!chat || !chat.members) return false
  return chat.members.length === 1
}


exportDB.getChatActive = async function (chID) {
  if (!this.isDBReady()) return
  if (!chID) chID = this.getChatID()

  const chat = await Chat.findOne({ chatId: chID })
    .populate('active');
  return chat
}

exportDB.getChatAll = async function (chID) {
  if (!this.isDBReady()) return
  if (!chID) chID = this.getChatID()

  const chat = await Chat.findOne({ chatId: chID })
    .populate('members');
  return chat
}

exportDB.changeUserTimeZone = function (uID, timezone, location) {
  if (!uID) uID = this.getUserID()

  let user = {}
  user.timezone = timezone
  if (!location) {
    const country = ct.getCountryForTimezone(timezone)
    if (country && country.id) {
      user.country = country.id
      user.flag = flag(user.country)
    }
  } else {
    const { latitude, longitude } = location
    const country = wc([longitude, latitude])
    if (country) {
      user.country = getCountryISO2(country).toUpperCase()
      user.flag = flag(user.country)
    }
  }
  this.editUser({ ...user, userId: uID })
}

module.exports = async function (ctx, next) {
  ctx.isDBReady = exportDB.isDBReady
  ctx.getName = exportDB.getName
  ctx.getChatID = exportDB.getChatID
  ctx.getUserID = exportDB.getUserID
  ctx.editUser = exportDB.editUser
  ctx.createUser = exportDB.createUser
  ctx.getUsers = exportDB.getUsers
  ctx.getChats = exportDB.getChats
  ctx.getOneUser = exportDB.getOneUser
  ctx.userExists = exportDB.userExists
  ctx.getUserByUsername = exportDB.getUserByUsername
  ctx.editChat = exportDB.editChat
  ctx.enableAutoAdd = exportDB.enableAutoAdd
  ctx.disableAutoAdd = exportDB.disableAutoAdd
  ctx.createChat = exportDB.createChat
  ctx.addToChatAll = exportDB.addToChatAll
  ctx.addToChatActive = exportDB.addToChatActive
  ctx.removeFromChatAll = exportDB.removeFromChatAll
  ctx.removeFromChatActive = exportDB.removeFromChatActive
  ctx.getOneChat = exportDB.getOneChat
  ctx.chatExists = exportDB.chatExists
  ctx.isMemberOf = exportDB.isMemberOf
  ctx.getChatActive = exportDB.getChatActive
  ctx.getChatAll = exportDB.getChatAll
  ctx.changeUserTimeZone = exportDB.changeUserTimeZone

  if (ctx.updateType === `inline_query`) return next(ctx)

  const exists = await ctx.chatExists(ctx.getChatID())
  if (ctx.chat && !exists) {
    await ctx.createChat({ ...ctx.chat, chatId: ctx.chat.id })
  }

  const u = await ctx.getOneUser()
  if (u && ctx.getChatID() && ctx.chat && (ctx.chat.isAutoAddEnabled === undefined || ctx.chat.isAutoAddEnabled)) {
    await ctx.addToChatActive(ctx.getChatID(), u)
    await ctx.addToChatAll(ctx.getChatID(), u)
    return next(ctx)
  }

  const user = await ctx.getChatMember(ctx.getUserID()).catch(() => false)
  if (!user) return next(ctx)
  const newUser = await ctx.createUser({ ...user.user, userId: user.id, status: user.status })
  if (ctx.getChatID() && ctx.chat && (ctx.chat.isAutoAddEnabled === undefined || ctx.chat.isAutoAddEnabled)) {
    await ctx.addToChatActive(ctx.getChatID(), newUser)
    await ctx.addToChatAll(ctx.getChatID(), newUser)
  }
  return next(ctx)
}

module.exports.db = exportDB
