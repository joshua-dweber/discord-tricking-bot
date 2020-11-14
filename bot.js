const Discord = require("discord.js");
const fs = require ("fs");
const client = new Discord.Client({ disableEveryone: false, partials: ['MESSAGE', 'REACTION'] });
const config = require('./config.json');

client.on("ready", () => {
  console.log("Test Bot Online");
  client.user.setPresence({activity: { name: "Hopefully Getting Better" } });
});

client.on('guildMemberAdd', (guildMember) => {
  //giving the user all the default roles defined in the config
  for(let i = 0; i < config.default_roles; i++) {
    guildMember.guild.roles.fetch(config.default_roles[i]).then(role => guildMember.roles.add(role));
  }
});

client.on("message", ({author, member, guild}) => {
  let messages = JSON.parse(fs.readFileSync('messages.json'));
  //ternary if statement to either increase the message count of the user or create that user in the dictionary
  messages.ids[author.id] ? messages.ids[author.id]++ : messages.ids[author.id] = 1;
  const userMsgNum = messages.ids[author.id];
  for (let i = config.levels.length - 1; i >= 0; i--) {
    const {roleId, num, days} = config.levels[i];
    const userDays = Math.trunc((Date.now() - member.joinedTimestamp) / 86400000);
    if(userMsgNum > num && userDays > days) {
      guild.roles.fetch(roleId).then(role => member.roles.add(role)).catch(e => console.log(e));
      //getting rid of the previous roles if the user has them
      for (let j = i; j >= 0; j--) {
        guild.roles.fetch(config.levels[j].roleId).then(role => {
          if(member.roles.cache.has(role.id)) member.roles.remove(role);
        });
      }
      break;
    }
  }
  console.log(`${author.tag} has sent a message. Message count: ${userMsgNum}`);
  fs.writeFileSync('messages.json', JSON.stringify(messages));
});

client.on('messageReactionAdd', async ({message, emoji}, user) => { 
  if(!message.partial) await message.fetch();
  if (message.id == config.region_message)
    message.guild.members.fetch(user.id).then(member => {
      if(config.region_reactions[emoji.name])
        message.guild.roles.fetch(config.region_reactions[emoji.name]).then(role => member.roles.add(role)).catch(e => console.log(e));
    })
});

client.login(config.token);
