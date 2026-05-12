require('dotenv').config();

const sqlite3 =
 require('sqlite3').verbose();

const db =
 new sqlite3.Database('memory.db');

db.run(`
CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 chatId TEXT,
 role TEXT,
 content TEXT
)
`);

const TelegramBot =
 require('node-telegram-bot-api');

const OpenAI =
 require('openai');

const bot =
 new TelegramBot(
   process.env.TELEGRAM_TOKEN,
   { polling:true }
 );

const openai =
 new OpenAI({
   apiKey: process.env.OPENAI_API_KEY
 });

bot.on('message', async (msg)=>{

   const chatId = msg.chat.id;
   const text = msg.text;

   db.all(
    `SELECT role, content
     FROM messages
     WHERE chatId = ?
     ORDER BY id ASC
     LIMIT 20`,
    [chatId],

   async (err, rows)=>{

      if(err){
         console.log(err);
         return;
      }

      const messages = rows || [];

      messages.push({
         role:"user",
         content:text
      });

      try{

         const response =
          await openai.chat.completions.create({
            model:"gpt-4.1-mini",
            messages:messages
          });

         const reply =
          response.choices[0]
          .message.content;

         db.run(
          `INSERT INTO messages
           (chatId, role, content)
           VALUES (?, ?, ?)`,
          [chatId, "user", text]
         );

         db.run(
          `INSERT INTO messages
           (chatId, role, content)
           VALUES (?, ?, ?)`,
          [chatId, "assistant", reply]
         );

         bot.sendMessage(
           chatId,
           reply.substring(0,4000)
         );

      }catch(err){

         console.log(err);

         bot.sendMessage(
          chatId,
          "Bot đang lỗi."
        );

}

   });

});