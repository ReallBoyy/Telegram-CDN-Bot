const { Telegraf } = require('telegraf')
const LocalSession = require('telegraf-session-local') // Local Session
const fs = require('fs')
const path = require('path')
const unzipper = require('unzipper')
const { exec } = require('child_process')

const botToken = "YOUR_BOT_TOKEN_HERE"

function getBytes(mib) {
  return mib * 1024 * 1024;
}

function getFolderSize(folderPath) {
  let total = 0;
  if (!fs.existsSync(folderPath)) return 0;

  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) total += stat.size;
  }
  return total;
}

function SensitivesPath(arg) {
  const args = arg.toLowerCase()
  if (args.includes('windows/') || args.includes('root@') || args.includes('..')) return true
  return false
}

const bot = new Telegraf(botToken)

// Session Middleware -- either can use sqlite as db
bot.use(new LocalSession({ database: 'session/session.json'}).middleware())

bot.use((ctx, next) => {
  console.log('logs:\n', ctx.from)
  console.log('session:', ctx.session)
  return next()
})

bot.telegram.setMyCommands([
  { command: 'start', description: 'Start and regist your own directory folder.'},
  { command: 'checkdb', description: 'Check all file and folder in your directory folder. (default dir: \'./\')' },
  { command: 'upload', description: 'Upload file to your directory folder.' },
  { command: 'remove', description: 'Remove file or folder from your directory folder.' },
  { command: 'unzip', description: 'Extract your .zip extension file'},
  { command: 'move', description: 'Move file to new path.'},
  { command: 'help', description: 'Shows all command.'},
  { command: 'link', description: 'Get your cdn link.'}
])

bot.start((ctx) => {
  if (!ctx.session.registered) // Register case
  {
    if (!fs.existsSync(`./db/${ctx.from.id}`)) fs.mkdirSync(`./db/${ctx.from.id}`, { recursive: true })
    ctx.reply('Hello there!\nYou\'ve successfuly register your ID to the bot database. Use /help command to show all the command list.')
    ctx.session.maxStorage = 1024
    ctx.session.registered = true
  }
})

bot.help((ctx) => {
  ctx.reply('<!> help (Shows all command)\n<!> start (Register your id to database)\n<!> checkdb <path> (Check every file on your directory, default dir: ./)\n<!> upload (Upload file to your directory)\n<!> move <source> <destination> (Move file to a new destination)\n<!> remove <file> (Remove/erase file from directory)\n<!> unzip <file> (Extract your .zip extension file)\n<!> link (Get your cdn link)')
})

bot.command('link', (ctx) => {
  if (!ctx.session.registered) ctx.reply('You have\'nt register yet. Please register your id by using \'/start\' command.')
    else ctx.reply(`https://cdn.reallboyy-store.my.id/cache/${ctx.from.id}`)
})

bot.command('unzip', (ctx) => {
  const args = ctx.message.text.substring(7).trim(); // get param after "/unzip " command
  if (!ctx.session.registered) {
    ctx.reply('Please register your ID first before start using this command')
  }
  else if (!args) {
    ctx.reply('❌ Command Usage: /unzip fileName');
  }
  else if (SensitivesPath(args)) {
    ctx.reply('That path is only for developer')
  }
  else {
    fs.createReadStream(`./db/${ctx.from.id}/${args}.zip`)
      .pipe(unzipper.Extract({ path: `./db/${ctx.from.id}/${args}`}))
      .promise()
      .then(() => {
          ctx.reply(`Successfuly extract ${args}.zip`)
      })
      .catch((err) => {
            ctx.reply('Error with code:\n', err)
            console.log(err)
      })
  }
})

bot.command('checkdb', (ctx) => {
  const args = "/" + ctx.message.text.substring(9).trim();
  const dir = `./db/${ctx.from.id}${args}`
  const name = ctx.from.first_name + (ctx.from.last_name.length >= 1 ? " " + ctx.from.last_name : "")
  if (!ctx.session.registered) {
    ctx.reply('Please register your ID first before start using this command')
  }
  else if (!SensitivesPath(dir) && fs.existsSync(dir))
  {
    const folderSize = (getFolderSize(`./db/${ctx.from.id}`) / 1024 / 1024).toFixed(2)
    let messageSent = `📁 ${name}${args} directory [Storage: ${folderSize}/${ctx.session.maxStorage} MiB]:\n\n`;
    let foundFile = 0
    fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    const type = stat.isDirectory() ? '📁 ' : '📄  '
    messageSent += `${type} ${file}\n`
    foundFile++
    })
    if (foundFile >= 1) ctx.reply(messageSent)
    else ctx.reply(messageSent, '\n\nEmpty Folder')
  }
})

bot.command('upload', (ctx) => { // Upload command handler
  if (!ctx.session.registered) {
    ctx.reply('Please register your ID first before start using this command')
  }
  else if (getFolderSize(`./db/${ctx.from.id}`) >= getBytes(ctx.session.maxStorage)) {
    ctx.reply('Your directory has reached it\'s max file size.')
  }
  else {
      ctx.session.onUploading = true
      ctx.reply('Please send the file and if it is a photo file, do not compress it.')
  }
})

bot.command('move', (ctx) => {
  const args = ctx.message.text.substring(6).trim().split(' ')
  const userDir = `./db/${ctx.from.id}`;
  const src = path.join(userDir, args[0]);
  const dest = path.join(userDir, args[1]);

  if (!ctx.session.registered) {
    ctx.reply('Please register your ID first before start using this command')
  }
  else if (args.length < 2) {
    return ctx.reply('❌ Command Usage: /move filePath destinationPath');
  }
  else if (!SensitivesPath(src) && !SensitivesPath(dest) && fs.existsSync(src)) {
    if (process.platform === 'win32') {
      exec(`move ${src} ${dest}`, (err) => {
        if (err) {
          ctx.reply('Something went wrong')
          console.log(err)
          return
        }
      })
    }
    else if (process.platform === 'linux') {
      exec(`mv ${src} ${dest}`, (err) => {
        if (err) {
          ctx.reply('Something went wrong')
          console.log(err)
          return
        }
      })
    }
    else return ctx.reply('Undefined platform.')
    ctx.reply(`Successfuly move from \'${args[0]}\' to \'${args[1]}\'.`)
  }
})

bot.command('remove', (ctx) => {
  const args = ctx.message.text.substring(8).trim() 
  const userPath = `./db/${ctx.from.id}/${args}`;

  if (!ctx.session.registered) {
    ctx.reply('Please register your ID first before start using this command')
  }
  else if (!args) {
    ctx.reply('❌ Command Usage: /remove file.txt');
  }
  else if (!SensitivesPath(userPath) && fs.existsSync(userPath)) {
    fs.rmSync(userPath, { recursive: true, force: true });
    ctx.reply(`🗑 Successfuly delete \'${args}\' from your directory.`);
  } else {
    ctx.reply(`❌ Cannot find file or folder named "${args}".`)
  }
})


// File handler
bot.on('document', async (ctx) => {
  console.log(ctx.from)
  if (!ctx.session.registered) {
    await ctx.reply('Please register your ID first before start using this command')
  }
  else if (!ctx.session.onUploading) {
    await ctx.reply('Run the command /upload first before you upload a file')
  }
  else if (getFolderSize(`./db/${ctx.from.id}`) >= getBytes(ctx.session.maxStorage)) {
    await ctx.reply('Your directory has reached it\'s max file size.')
  }
  else {
    const fileId = ctx.message.document.file_id
    const fileName = ctx.message.document.file_name

    try {
       const fileLink = await ctx.telegram.getFileLink(fileId)
       const res = await fetch(fileLink.href)
       const buffer = await Buffer.from(await res.arrayBuffer())

       fs.writeFileSync(`./db/${ctx.from.id}/${fileName}`, buffer)
       await ctx.reply(`✅ File ${fileName} successfully downloaded.`)

       ctx.session.onUploading = false;

    }
    catch (err) {
        console.error(err)
        await ctx.reply('❌ Failed to download file.')
        await ctx.reply('Error might be from the file size, because it is not supported to download file that size exceeds 50 MB.')
    }
  }
})

bot.launch(() => {
  console.log('Telegram bot is now running')
  console.log('Initiating cdn service . . .')
})

require('./server.js') //Init cdn service
