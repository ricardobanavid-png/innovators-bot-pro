const express = require("express")
const app = express()

const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys")

const fetch = require("node-fetch")
require("dotenv").config()

app.get("/", (req, res) => res.send("Bot running 🚀"))
app.listen(3000, () => console.log("Server running"))

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
  const { state, saveCreds } = await useMultiFileAuthState("auth")

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    if (!users[sender]) users[sender] = { xp: 0, coins: 0, vip: false }

    // DAILY REWARD
    if (lastSeen[sender] !== today()) {
      users[sender].xp += 20
      lastSeen[sender] = today()

      await sock.sendMessage(from, {
        text: "🔥 Daily reward +20 XP"
      })
    }

    // BASE REWARD
    users[sender].xp += 5
    users[sender].coins += 2

    // VIP BONUS
    if (users[sender].vip) {
      users[sender].xp += 2
      users[sender].coins += 1
    }

    // RANDOM DROP
    if (Math.random() < 0.07) {
      users[sender].coins += 30
      await sock.sendMessage(from, {
        text: "🎁 Lucky drop! +30 coins"
      })
    }

    // ADMIN CHECK
    let isAdmin = false
    if (from.endsWith("@g.us")) {
      const meta = await sock.groupMetadata(from)
      const admins = meta.participants.filter(p => p.admin).map(p => p.id)
      isAdmin = admins.includes(sender)
    }

    // COMMANDS
    if (text.startsWith("/")) {
      const cmd = text.split(" ")[0].toLowerCase()

      if (cmd === "/menu") {
        return sock.sendMessage(from, {
          text: `/menu
/ask question
/kick @user
/rank
/leaderboard
/shop
/buy item
/profile
/startgame
/guess number`
        })
      }

      if (cmd === "/kick") {
        if (!isAdmin) return sock.sendMessage(from, { text: "❌ Admin only" })

        const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
        if (!mentioned) return sock.sendMessage(from, { text: "❌ Tag user" })

        await sock.groupParticipantsUpdate(from, mentioned, "remove")
        return sock.sendMessage(from, { text: "🚫 Removed" })
      }

      if (cmd === "/rank") {
        return sock.sendMessage(from, {
          text: `XP: ${users[sender].xp}\nLevel: ${getLevel(users[sender].xp)}`
        })
      }

      if (cmd === "/leaderboard") {
        let top = Object.entries(users)
          .sort((a,b)=>b[1].xp-a[1].xp)
          .slice(0,5)

        let msgText = "🏆 Top Users:\n"
        top.forEach((u,i)=>{
          msgText += `${i+1}. ${u[0].split("@")[0]} (${u[1].xp})\n`
        })

        return sock.sendMessage(from,{text:msgText})
      }

      if (cmd === "/shop") {
        let msgText = "🛒 SHOP:\n"
        for (let k in shopItems) {
          msgText += `${k} - ${shopItems[k].name} (${shopItems[k].price})\n`
        }
        return sock.sendMessage(from,{text:msgText})
      }

      if (cmd === "/buy") {
        const item = text.split(" ")[1]
        if (!shopItems[item]) return sock.sendMessage(from,{text:"❌ Invalid"})

        if (users[sender].coins < shopItems[item].price) {
          return sock.sendMessage(from,{text:"❌ Not enough coins"})
        }

        users[sender].coins -= shopItems[item].price

        if (item === "vip") users[sender].vip = true
        if (item === "boost") users[sender].xp += 50

        return sock.sendMessage(from,{text:"✅ Purchase successful"})
      }

      if (cmd === "/profile") {
        return sock.sendMessage(from,{
          text:`XP: ${users[sender].xp}
Coins: ${users[sender].coins}
Level: ${getLevel(users[sender].xp)}
Status: ${users[sender].vip ? "👑 VIP" : "Normal"}`
        })
      }

      if (cmd === "/startgame") {
        activeGame[from] = Math.floor(Math.random()*10)
        return sock.sendMessage(from,{text:"🎮 Guess number 0-9 using /guess"})
      }

      if (cmd === "/guess") {
        const guess = parseInt(text.split(" ")[1])
        if (activeGame[from] === guess) {
          users[sender].xp += 50
          delete activeGame[from]
          return sock.sendMessage(from,{text:"🎉 Correct +50 XP"})
        } else {
          return sock.sendMessage(from,{text:"❌ Try again"})
        }
      }
    }

    // AI
    if (text.startsWith("/ask")) {
      const q = text.replace("/ask","").trim()
      if (!q) return sock.sendMessage(from,{text:"Ask something"})

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method:"POST",
          headers:{
            Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            model:"gpt-4o-mini",
            messages:[
              {role:"system",content:"You are a smart WhatsApp bot"},
              {role:"user",content:q}
            ]
          })
        })

        const data = await res.json()
        await sock.sendMessage(from,{text:data.choices[0].message.content})
      } catch {
        await sock.sendMessage(from,{text:"❌ AI error"})
      }
    }
  })

  // JOIN/LEAVE
  sock.ev.on("group-participants.update", async (update) => {

    if (update.action === "add") {
      for (let user of update.participants) {
        await sock.sendMessage(update.id,{
          text:`👋 Welcome @${user.split("@")[0]} 🚀`,
          mentions:[user]
        })
      }
    }

    if (update.action === "remove") {
      const code = await sock.groupInviteCode(update.id)
      await sock.sendMessage(update.id,{
        text:`😢 Someone left\nRejoin: https://chat.whatsapp.com/${code}`
      })
    }

  })
}

startBot()
