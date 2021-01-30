const mongoose = require(`mongoose`)
const mongourl = process.env.MONGO_URL
mongoose.connect(mongourl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })
const db = mongoose.connection

const User = require(`./models/user`)
const Chat = require(`./models/chat`)

let init = async () => {
  
  let chats = await Chat.find({$expr: { "$gt": [ { "$size": "$members" }, 40 ] }});
  chats.forEach(c=>{
    console.log(c.username || "---", "___", c.title, c.members.length, c.active.length)
  })
}

init()


// db.chats.find({$expr: { "$gt": [ { "$size": "$members" }, 40 ] }}, {_id: 0, title: 1}).pretty()
