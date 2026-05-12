require('dotenv').config();

const { Pool } = require('pg');

const TelegramBot =
 require('node-telegram-bot-api');

const OpenAI =
 require('openai');

const pool = new Pool({
 connectionString: process.env.DATABASE_URL,
 ssl: {
   rejectUnauthorized: false
 }
});

(async ()=>{

 await pool.query(`
 CREATE TABLE IF NOT EXISTS messages (
   id SERIAL PRIMARY KEY,
   chatId TEXT,
   role TEXT,
   content TEXT
 )
 `);

 await pool.query(`
 CREATE TABLE IF NOT EXISTS memories (
   id SERIAL PRIMARY KEY,
   chatId TEXT,
   fact TEXT
 )
 `);

})();

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

 try{

   const chatId = msg.chat.id.toString();
   const text = msg.text;

   const messageResult =
    await pool.query(
      `
      SELECT role, content
      FROM messages
      WHERE chatId = $1
      ORDER BY id ASC
      LIMIT 20
      `,
      [chatId]
    );

   const memoryResult =
    await pool.query(
      `
      SELECT fact
      FROM memories
      WHERE chatId = $1
      `,
      [chatId]
    );

   const rows = messageResult.rows;
   const memoryRows = memoryResult.rows;

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

Always translate important English technical terms
into Vietnamese in parentheses.

User memories:
${memoryRows.map(x => x.fact).join("\n")}
`
      },

      ...rows
   ];

   messages.push({
      role:"user",
      content:text
   });

   if(
    text.toLowerCase().includes("hãy nhớ") ||
    text.toLowerCase().includes("remember")
   ){

      await pool.query(
       `
       INSERT INTO memories
       (chatId, fact)
       VALUES ($1, $2)
       `,
       [chatId, text]
      );
   }

   const response =
    await openai.chat.completions.create({
      model:"gpt-4.1-mini",
      messages:messages
    });

   const reply =
    response.choices[0]
    .message.content;

   await pool.query(
    `
    INSERT INTO messages
    (chatId, role, content)
    VALUES ($1, $2, $3)
    `,
    [chatId, "user", text]
   );

   await pool.query(
    `
    INSERT INTO messages
    (chatId, role, content)
    VALUES ($1, $2, $3)
    `,
    [chatId, "assistant", reply]
   );

   bot.sendMessage(
    chatId,
    reply.substring(0,4000)
   );

 }catch(err){

   console.log(err);

   bot.sendMessage(
    msg.chat.id,
    "Bot đang lỗi."
   );

 }

});