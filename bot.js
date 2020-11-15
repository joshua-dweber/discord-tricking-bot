const Discord = require("discord.js");
const fs = require ("fs");
const client = new Discord.Client({ partials: ['MESSAGE', 'REACTION'] });
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

client.on("message", ({author, member, guild, content, channel, id, createdTimestamp}) => {
  if(content.startsWith("!ranksampler")) {
    //sending the message which shows who the sampler is for, and shows the url that the user passed in. It then loops through all the reactions in the config and adds them.
    guild.channels.cache.get(config.ranksampler_channel).send(`@ everyone React to this message to choose what rank this sampler by <@${author.id}> deserves! The rank will be given after 24 hours.${config.ranksampler_msg}${content.split(' ')[1]}`)
      .then(msg => {
        Object.keys(config.ranksampler_reactions).forEach(async key => await msg.react(key));
        let samplers = JSON.parse(fs.readFileSync('samplers.json'));
        samplers[msg.id] = { "createdAt": createdTimestamp, "userId": author.id };
        fs.writeFileSync('samplers.json', JSON.stringify(samplers));
      });
  }


  let samplers = JSON.parse(fs.readFileSync('samplers.json'));
  Object.keys(samplers).forEach(sampId => {
    if ((Date.now() - samplers[sampId.createdAt]) / 86400000 > 1) {
    sampChannel = guild.channels.cache.get(config.ranksampler_channel);
    sampChannel.messages.fetch(sampId)
      .then(({reactions}) => {
        let maxCount = 0, maxEmoji = "";
        //looping through the reactions backwards and checking which one has the greatest count (backwards because we want to give the lowest role if a tie)
        reactions.cache.array().reverse().forEach(reaction => {
          if(reaction.count > maxCount) {
            maxCount = reaction.count;
            maxEmoji = reaction.emoji.name;
          }
        });
        //basically just fetches the user from the json file and gives them the role from the config
        guild.members.fetch(samplers[sampId].userId).then(guildMember => guild.roles.fetch(config.ranksampler_reactions[maxEmoji]).then(role => guildMember.roles.add(role)));
        reactions.cache.array().forEach(reaction => {
          if(reaction.emoji.name != maxEmoji) {
            guild.members.fetch(samplers[sampId].userId).then(guildMember => guild.roles.fetch(config.ranksampler_reactions[reaction.emoji.name]).then(role => guildMember.roles.remove(role)));
          }
        });
        sampChannel.send(`Voting for <@${samplers[sampId].userId}>'s sampler has ended`)
        delete samplers[sampId];
        fs.writeFileSync('samplers.json', JSON.stringify(samplers));
      })
      .catch(console.error);
    }
  });

  let messages = JSON.parse(fs.readFileSync('messages.json'));
  messages[author.id] ? messages[author.id]++ : messages[author.id] = 1;
  const userMsgNum = messages[author.id];
  for (let i = config.levels.length - 1; i >= 0; i--) {
    const {roleId, num, days} = config.levels[i];
    const userDays = Math.trunc((Date.now() - member.joinedTimestamp) / 86400000);
    if(userMsgNum > num && userDays > days) {
      guild.roles.fetch(roleId).then(role => member.roles.add(role)).catch(console.error);
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
        message.guild.roles.fetch(config.region_reactions[emoji.name]).then(role => member.roles.add(role)).catch(console.error);
    })
});

client.login(config.token);
