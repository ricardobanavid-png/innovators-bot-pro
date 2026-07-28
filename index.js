const express = require("express")
const app = express()

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fetch = require("node-fetch")
require("dotenv").config()

app.get("/", (req, res) => {
  res.send("Innovators Bot Pro 🚀")
})

app.listen(3000, () => {
  console.log("Server running on port 3000")
})


const users = {}
const lastSeen = {}
const activeGame = {}

const shopItems = {
  vip: { price: 200, name: "👑 VIP Access" },
  boost: { price: 100, name: "⚡ XP Boost" }
}


function getLevel(xp) {
  if (xp > 300) return "👑 Legend"
  if (xp > 150) return "🔥 Elite"
  if (xp > 50) return "🚀 Innovator"
  return "🌱 Starter"
}


function today() {
  return new Date().toDateString()
}


async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth")


  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })


  sock.ev.on("creds.update", saveCreds)


  // PAIRING CODE LOGIN
  if (!state.creds.registered) {

    setTimeout(async () => {

      const code = await sock.requestPairingCode(
  process.env.BOT_NUMBER.replace(/[^0-9]/g, "")
)

      console.log("PAIRING CODE:", code)

    }, 5000)

  }


  sock.ev.on("connection.update", (update) => {

  const { connection, lastDisconnect } = update


  if (connection === "open") {
    console.log("✅ WhatsApp Connected")
  }


  if (connection === "close") {

    const shouldReconnect =
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut


    if (shouldReconnect) {

      console.log("🔄 Reconnecting...")

      setTimeout(() => {
        startBot()
      }, 3000)

    } else {

      console.log("❌ Logged out")

    }

  }

})


  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]

    if (!msg.message) return


    const from = msg.key.remoteJid
    const sender = msg.key.participant || from


    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""


    if (!users[sender]) {
      users[sender] = {
        xp: 0,
        coins: 0,
        vip: false
      }
          }
        // DAILY REWARD
    if (lastSeen[sender] !== today()) {
      users[sender].xp += 20
      lastSeen[sender] = today()

      await sock.sendMessage(from, {
        text: "🔥 Daily reward +20 XP"
      })
    }


    // MESSAGE REWARD
    users[sender].xp += 5
    users[sender].coins += 2


    if (users[sender].vip) {
      users[sender].xp += 2
      users[sender].coins += 1
    }


    // COMMANDS
    if (text.startsWith("/")) {

      const cmd = text.split(" ")[0].toLowerCase()


      if (cmd === "/menu") {
        return sock.sendMessage(from,{
          text:
`🤖 Innovators Bot Pro

/menu
/rank
/profile
/leaderboard
/shop
/buy item
/startgame
/guess number
/ask question
/kick @user`
        })
      }


      if (cmd === "/rank") {
        return sock.sendMessage(from,{
          text:
`XP: ${users[sender].xp}
Level: ${getLevel(users[sender].xp)}`
        })
      }


      if (cmd === "/profile") {
        return sock.sendMessage(from,{
          text:
`👤 Profile

XP: ${users[sender].xp}
Coins: ${users[sender].coins}
Level: ${getLevel(users[sender].xp)}
Status: ${users[sender].vip ? "👑 VIP" : "Normal"}`
        })
      }


      if (cmd === "/leaderboard") {

        let top = Object.entries(users)
        .sort((a,b)=>b[1].xp-a[1].xp)
        .slice(0,5)


        let result = "🏆 Leaderboard\n\n"

        top.forEach((u,i)=>{
          result += `${i+1}. ${u[0].split("@")[0]} - ${u[1].xp} XP\n`
        })


        return sock.sendMessage(from,{
          text: result
        })
      }


      if (cmd === "/shop") {

        return sock.sendMessage(from,{
          text:
`🛒 SHOP

vip - 👑 VIP Access (200 coins)
boost - ⚡ XP Boost (100 coins)`
        })

      }


      if (cmd === "/buy") {

        const item = text.split(" ")[1]

        if (!shopItems[item])
          return sock.sendMessage(from,{text:"❌ Item not found"})


        if (users[sender].coins < shopItems[item].price)
          return sock.sendMessage(from,{text:"❌ Not enough coins"})


        users[sender].coins -= shopItems[item].price


        if(item==="vip")
          users[sender].vip=true


        if(item==="boost")
          users[sender].xp += 50


        return sock.sendMessage(from,{
          text:"✅ Purchase successful"
        })

      }


      if(cmd === "/startgame") {

        activeGame[from] =
        Math.floor(Math.random()*10)


        return sock.sendMessage(from,{
          text:"🎮 Guess a number 0-9 using /guess"
        })

      }


      if(cmd === "/guess") {

        const guess =
        parseInt(text.split(" ")[1])


        if(activeGame[from] === guess){

          users[sender].xp += 50

          delete activeGame[from]

          return sock.sendMessage(from,{
            text:"🎉 Correct! +50 XP"
          })

        }else{

          return sock.sendMessage(from,{
            text:"❌ Wrong answer"
          })

        }

      }


      if(cmd === "/kick") {

  if(!from.endsWith("@g.us"))
    return sock.sendMessage(from,{
      text:"❌ Group only"
    })

  const metadata = await sock.groupMetadata(from)

  const admins = metadata.participants
    .filter(p => p.admin)
    .map(p => p.id)

  if(!admins.includes(sender))
    return sock.sendMessage(from,{
      text:"❌ Admin only"
    })

  const mentioned =
  msg.message.extendedTextMessage
  ?.contextInfo
  ?.mentionedJid

  if(!mentioned)
    return sock.sendMessage(from,{
      text:"❌ Tag user"
    })

  await sock.groupParticipantsUpdate(
    from,
    mentioned,
    "remove"
  )

  return sock.sendMessage(from,{
    text:"🚫 User removed"
  })

      }

        const question =
        text.replace("/ask","").trim()


        if(!question)
          return sock.sendMessage(from,{
            text:"Ask something"
          })


        try{

          const response =
          await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method:"POST",
            headers:{
              Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type":"application/json"
            },

            body:JSON.stringify({
              model:"gpt-4o-mini",
              messages:[
                {
                  role:"system",
                  content:"You are a smart WhatsApp assistant"
                },
                {
                  role:"user",
                  content:question
                }
              ]
            })

          })


          const data =
          await response.json()


          return sock.sendMessage(from,{
            text:data.choices[0].message.content
          })


        }catch{

          return sock.sendMessage(from,{
            text:"❌ AI error"
          })

        }

      }

    }


  })


  // WELCOME / GOODBYE

  sock.ev.on("group-participants.update",
  async(update)=>{


    if(update.action==="add"){

      for(let user of update.participants){

        await sock.sendMessage(update.id,{
          text:
          `👋 Welcome @${user.split("@")[0]} 🚀`,
          mentions:[user]
        })

      }

    }


    if(update.action==="remove"){

      await sock.sendMessage(update.id,{
        text:"😢 Someone left the group"
      })

    }


  })


}


startBot()
