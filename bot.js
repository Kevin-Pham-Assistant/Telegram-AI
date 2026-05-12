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

db.run(`
CREATE TABLE IF NOT EXISTS memories (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 chatId TEXT,
 fact TEXT
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

db.all(
 `SELECT fact
  FROM memories
  WHERE chatId = ?`,
 [chatId],

 async (err, memoryRows)=>{    

const messages = [
   {
      role:"system",
      content:`
You are Kevin Assistant.

You CAN remember information across conversations.

User memories are stored in a database.

When the user asks you to remember something,
acknowledge naturally and say you will remember it.

You are a persistent AI assistant,
not a temporary chat session.

User memories:
${memoryRows.map(x => x.fact).join("\n")}
`
   },

   ...(rows || [])
];

messages.push({
   role:"user",
   content:text
});

if(
 text.toLowerCase().includes("hãy nhớ") ||
 text.toLowerCase().includes("remember")
){

   db.run(
    `INSERT INTO memories
     (chatId, fact)
     VALUES (?, ?)`,
    [chatId, text]
   );
}

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

});