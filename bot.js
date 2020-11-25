const { Client, Intents } = require("discord.js");
const fs = require("fs");
const client = new Client({
  partials: ['MESSAGE', 'REACTION'], ws: new Intents([
    Intents.NON_PRIVILEGED,
    "GUILD_MEMBERS",
  ])
});
const config = require('./config.json');
var CronJob = require('cron').CronJob;

client.on("ready", () => {
  console.log("Test Bot Online");
  battleChannel = client.channels.cache.get(config.battle_channel);
  client.user.setPresence({activity: { name: "Hopefully Getting Better" } });
});

client.on('guildMemberAdd', (guildMember) => {
  //giving the user all the default roles defined in the config
  for(let i = 0; i < config.default_roles; i++) {
    guildMember.guild.roles.fetch(config.default_roles[i]).then(role => guildMember.roles.add(role));
  }
});

client.on("message", ({author, member, guild, content, channel, id, createdTimestamp}) => {

  if (content.startsWith("!battle")) {
    let battles = JSON.parse(fs.readFileSync('battles.json'));
    battles.battles[battles.idCount] = {"users": {}, "currentVoting": {}};
    battles.battles[battles.idCount].users[author.id] = {"submission": "", "opponent": ""};
    battleChannel.send(`@everyone <@${author.id}> has started a battle, type \`!enter ${battles.idCount}\` to join! (1/4). It will start when 3 more people join. **DO NOT JOIN A BATTLE THAT YOU KNOW YOU WILL WIN**. Only join battles where you are around or lower than the skill level of the person who started and the people who have joined.`);
    battles.idCount++;
    fs.writeFileSync('battles.json', JSON.stringify(battles));
  }

  if (content.startsWith("!enter")) {
    let battles = JSON.parse(fs.readFileSync('battles.json'));
    let battleId = content.split(' ')[1];
    if (battles.battles[battleId]) {
      battle = battles.battles[battleId];
      if(battle.users[author.id]) {
        channel.send("you have already joined this battle"); return;
      } else if (Object.keys(battle.users).length >= 4) {
        channel.send("battle is full"); return;
      }
      battle.users[author.id] = {"submission": "", "opponent": ""};
      channel.send("you have successfully joined the battle");
      battleChannel.send(`<@${author.id}> has joined battle ${battleId} (${Object.keys(battle.users).length}/4)`)
      fs.writeFileSync('battles.json', JSON.stringify(battles));
      if (Object.keys(battle.users).length >= 4)
        battleLogic(battleId);
    } else battleChannel.send("no such battle exists");

  }

  let battles = JSON.parse(fs.readFileSync('battles.json'));
  if (content.startsWith("!submit")) {
    let battleId = content.split(' ')[1];
    if (battles.battles[battleId]) {
      let battle = battles.battles[battleId];
      if(battle.users[author.id]) {
        battle.users[author.id].submission = content.split(' ')[2];
        channel.send("submission added");
        if(battle.users[battle.users[author.id].opponent].submission != "") {
          battleChannel.send(`@here <@${author.id}>: ${battle.users[author.id].submission}\n<@${battle.users[author.id].opponent}>: ${battle.users[battle.users[author.id].opponent].submission}\nVote 🔵 for <@${author.id}> and 🔴 for <@${battle.users[author.id].opponent}> voting will end in 8 hours`).then(async message => {
            await message.react("🔵");
            await message.react("🔴");
            battle.currentVoting[message.id] = {"startedAt": Date.now(), users: [author.id, battle.users[author.id].opponent]};
            fs.writeFileSync('battles.json', JSON.stringify(battles));
            //28800000
            new CronJob(new Date(Date.now() + 360000), () => {
              battleVote(message.id, battleId)
            }).start();
          });
        }
        fs.writeFileSync('battles.json', JSON.stringify(battles));
      } else channel.send("you are not part of this battle");
    } else channel.send("no such battle exists");
  }

  Object.keys(battles.battles).forEach(battle => {
    Object.keys(battles.battles[battle].currentVoting).forEach(voteKey => {
      if ((Date.now() - battles.battles[battle].currentVoting[voteKey].startedAt) / 3600000 > 1) {
        console.log("not cronjob");
        console.log(Date.now())
        battleVote(voteKey, battle);
      }
    })
  });

  function battleLogic(id, stage=1) {
    let battles = JSON.parse(fs.readFileSync('battles.json'));
    if(stage == 1) {
      let battle = battles.battles[id];
      let users = Object.keys(battle.users);
      for (let i = 0; i < users.length; i++) {
        battle.users[users[i]].opponent = i % 2 == 0 ? users[i + 1] : users[i - 1];
      }
      battleChannel.send(`Battle ${id} has started. \n<@${users[0]}> vs <@${users[1]}>\n<@${users[2]}> vs <@${users[3]}>`);
      battleChannel.send(`Submit your clips by doing \`!submit ${id} <url>\`. The best way to submit a clip is to upload it in a different channel (#tricking-clips or #trickathome) and then right click -> copy link and use that as the url because discord will auto format it.`);
    } else if (stage == 2) {
      let battle = battles.battles[id];
      let users = Object.keys(battle.users);
      console.log(users);
      for (let i = 0; i < users.length; i++) {
        battle.users[users[i]].opponent = i % 2 == 0 ? users[i + 1] : users[i - 1];
      }
      battleChannel.send(`Battle ${id} finals has started. \n<@${users[0]}> vs <@${users[1]}>`);
      battleChannel.send(`Submit your clips by doing \`!submit ${id} <url>\``);
    } else if (stage == 3) {
      let battle = battles.battles[id];
      let user = Object.keys(battle.users)[0];
      battleChannel.send(`<@${user}> has won battle ${id}!`);
      delete battles.battles[id];
    }
    fs.writeFileSync('battles.json', JSON.stringify(battles));
  }
  
  function battleVote(msgId, battleId) {
    let battles = JSON.parse(fs.readFileSync('battles.json'));
    let battle = battles.battles[battleId];
    battleChannel.messages.fetch(msgId).then(msg => {
      console.log(msg.reactions.cache.array())
      let userId = msg.reactions.cache.array()[0].count > msg.reactions.cache.array()[1].count ? battle.currentVoting[msg.id].users[0] : battle.currentVoting[msg.id].users[1];
      battleChannel.send(`<@${userId}> has beaten <@${battle.users[userId].opponent}>`)
      battle.users[userId].submission = "";
      delete battle.users[battle.users[userId].opponent];
      battle.users[userId].opponent = "";
      delete battle.currentVoting[msgId];
      fs.writeFileSync('battles.json', JSON.stringify(battles));
      if (Object.keys(battle.users).length == 2) {
        battleLogic(battleId, 2);
      } else if (Object.keys(battle.users).length == 1) {
        battleLogic(battleId, 3);
      }
    }).catch(console.error);
  }

  //sampler stuff
  let samplers = JSON.parse(fs.readFileSync('samplers.json'));
  if (content.startsWith("!ranksampler")) {
    //sending the message which shows who the sampler is for, and shows the url that the user passed in. It then loops through all the reactions in the config and adds them.
    guild.channels.cache.get(config.ranksampler_channel).send(`@everyone React to this message to choose what rank this sampler by <@${author.id}> deserves! The rank will be given after 24 hours.${config.ranksampler_msg}${content.split(' ')[1]}`)
      .then(msg => {
        Object.keys(config.ranksampler_reactions).forEach(async key => await msg.react(key));
        samplers[msg.id] = { "createdAt": createdTimestamp, "userId": author.id };
        fs.writeFileSync('samplers.json', JSON.stringify(samplers));
        new CronJob(new Date(Date.now() + 86400000), () => {
          samplerLogic(msg.id, guild);
        }).start();
      });
  }
  Object.keys(samplers).forEach(sampId => {
    if((Date.now() - samplers[sampId.createdAt]) / 86400000 > 1)
      samplerLogic(sampId, guild);
  });

  function samplerLogic(id, guild) {
    let samplers = JSON.parse(fs.readFileSync('samplers.json'));
    sampChannel = guild.channels.cache.get(config.ranksampler_channel);
    sampChannel.messages.fetch(id)
      .then(({ reactions }) => {
        let maxCount = 0, maxEmoji = "";
        //looping through the reactions backwards and checking which one has the greatest count (backwards because we want to give the lowest role if a tie)
        reactions.cache.array().reverse().forEach(reaction => {
          if (reaction.count > maxCount) {
            maxCount = reaction.count;
            maxEmoji = reaction.emoji.name;
          }
        });
        //basically just fetches the user from the json file and gives them the role from the config
        guild.members.fetch(samplers[id].userId).then(guildMember => guild.roles.fetch(config.ranksampler_reactions[maxEmoji]).then(role => guildMember.roles.add(role)));
        reactions.cache.array().forEach(reaction => {
          if (reaction.emoji.name != maxEmoji) {
            guild.members.fetch(samplers[id].userId).then(guildMember => {
              if (guildMember.roles.cache.has(config.ranksampler_reactions[reaction.emoji.name]))
                guild.roles.fetch(config.ranksampler_reactions[reaction.emoji.name]).then(role => guildMember.roles.remove(role));
            });
          }
        });
        sampChannel.send(`Voting for <@${samplers[id].userId}>'s sampler has ended`)
        delete samplers[id];
        fs.writeFileSync('samplers.json', JSON.stringify(samplers));
      })
      .catch(console.error);
  }

  //message counting stuff
  let messages = JSON.parse(fs.readFileSync('messages.json'));
  messages[author.id] ? messages[author.id]++ : messages[author.id] = 1;
  const userMsgNum = messages[author.id];
  for (let i = config.levels.length - 1; i >= 0; i--) {
    const {roleId, num, days} = config.levels[i];
    const userDays = Math.trunc((Date.now() - member.joinedTimestamp) / 86400000);
    if(userMsgNum > num && userDays > days) {
      guild.roles.fetch(roleId).then(role => member.roles.add(role)).catch(console.error);
      //getting rid of the previous roles if the user has them
      for (let j = i - 1; j >= 0; j--) {
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
  //region message stuff
  if(!message.partial) await message.fetch();
  if (message.id == config.region_message)
    message.guild.members.fetch(user.id).then(member => {
      if(config.region_reactions[emoji.name])
        message.guild.roles.fetch(config.region_reactions[emoji.name]).then(role => member.roles.add(role)).catch(console.error);
    })
});

client.login(config.token);
