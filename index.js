const Discord = require('discord.js'); //npm discord
const client = new Discord.Client();
var Promise = require("bluebird")
const token = 'NDMwNDUxNzY2ODU4MDg4NDQ4.DaQZfA.Uqb_Xff-pjSq_e2B-ProzzXdpo4';
var mysql = require('promise-mysql'); //requires bluebird && promise-mysql && mysqljs
var https = require('https');
var fs = require('fs');
var diff = require('arr-diff'); //requires arr-diff
const path = require('path');

var dbdone = false;

var pool;

var guild_lock = false;
var channel_lock = false;

function executeQueries(queries_array, args, statusmsg) { //https://stackoverflow.com/questions/32028552/es6-promises-something-like-async-each/32040125?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa
  return new Promise(function(resolve, reject) {
    if (queries_array.length > 0 && args.length > 0) {
      let conn;
      pool.getConnection()
        .then(connection => {
          conn = connection;
          return queries_array.reduce(function(promise, query, index) {
            return promise.then(results => {
              return parallelqry(conn, query, args[index])
            })
          }, Promise.resolve());
        })
        .then(() => {
          conn.release();
          resolve(statusmsg)
        })
        .catch(err => {
          //console.log(err);
          conn.release();
          reject(err);
        })
    } else {
      //console.log('EMPTY QUERY!!')
      resolve('Qempty');
    }
  });

}

function parallelqry(connector, query, params) {
  return new Promise(function(resolve, reject) {
    connector.query(query, params)
      .then(function(results) {
        resolve(results);
      })
      .catch(err => {
        reject(err);
      });
  });
}

async function fastqry(query, params) {
  return new Promise(function(resolve, reject) {
    var connection;
    pool.getConnection()
      .then(conn => {
        connection = conn;
        return parallelqry(conn, query, params);
      })
      .then(results => {
        resolve(results);
      })
      .catch(err => {
        reject(err);
      })
      .finally(function() {
        connection.release();
      });
  });
}

function download(file_savedest, url) { //https://stackoverflow.com/questions/10343951/http-get-loop-to-download-list-of-files/10343976
  https.get(url, function(res) {
    var imagedata = '';
    res.setEncoding('binary');

    res.on('data', function(chunk) {
      imagedata += chunk
    });

    res.on('end', function() {
      fs.writeFile(file_savedest, imagedata, 'binary', function(err) {
        if (err) {
          console.log(err);
        } else {
          console.log("File:" + file_savedest + " saved");
        }
      });
    });
  });
}

//Multiple statements query to ensure synchrony
function createPool() {
  return new Promise(function(resolve, reject) {
    let temp_conn;
    mysql.createConnection({
        host: '192.168.1.166',
        user: 'griefer',
        password: 'porcodio',
        multipleStatements: true,
        charset: "utf8mb4_unicode_520_ci"
      })
      .then(connection => {
        temp_conn = connection;
        return parallelqry(temp_conn, "CREATE DATABASE IF NOT EXISTS discordlog DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_520_ci")
      })
      .then(() => {
        return parallelqry(temp_conn, "USE discordlog")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS guilds (GuildId bigint, Name varchar(102), Available boolean, BotIsPresent boolean, PRIMARY KEY (GuildId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS categories (CategoryId bigint, Name varchar(102), GuildId bigint, Deleted boolean, PRIMARY KEY (CategoryId), FOREIGN KEY (GuildId) REFERENCES guilds(GuildId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS channels (ChannelId bigint, Name varchar(102), Type varchar(10), CategoryId bigint, GuildId bigint, Deleted boolean, PRIMARY KEY (ChannelId), FOREIGN KEY (CategoryId) REFERENCES categories(CategoryId), FOREIGN KEY (GuildId) REFERENCES guilds(GuildId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS users (UserId bigint, Tag varchar(40), Bot boolean, AvatarUrl varchar(10000), AvatarPath varchar(500), Edited boolean, PRIMARY KEY (UserId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS dmchannels(DmChannelId bigint, UserId bigint, PRIMARY KEY(DmChannelId), FOREIGN KEY (UserId) REFERENCES users(UserId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS attachments(AttachmentId bigint, Path varchar(500), PRIMARY KEY (AttachmentId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS dms(DmId bigint, Content varchar(2010), Timestamp bigint, AttachmentId bigint, DmChannelId bigint, Edited boolean, PRIMARY KEY (DmId), FOREIGN KEY (DmChannelId) REFERENCES dmchannels (DmChannelId), FOREIGN KEY (AttachmentId) REFERENCES attachments(AttachmentId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS messages (MessageId bigint, UserId bigint, Content varchar(2010), Timestamp bigint, AttachmentId bigint, ChannelId bigint, Edited boolean, PRIMARY KEY (MessageId), FOREIGN KEY (UserId) REFERENCES users(UserId), FOREIGN KEY (AttachmentId) REFERENCES attachments(AttachmentId), FOREIGN KEY (ChannelId) REFERENCES channels(ChannelId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS messages_edits (MexEditId bigint NOT NULL AUTO_INCREMENT, OldContent varchar(2010), NewContent varchar(2010), Timestamp bigint, MessageId bigint, PRIMARY KEY (MexEditId), FOREIGN KEY (MessageId) REFERENCES messages(MessageId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS dms_edits (DmEditId bigint NOT NULL AUTO_INCREMENT, OldContent varchar(2010), NewContent varchar(2010), Timestamp bigint, DmId bigint, PRIMARY KEY (DmEditId), FOREIGN KEY (DmId) REFERENCES dms(DmId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS guilds_edits (GuildEditId bigint NOT NULL AUTO_INCREMENT, OldName varchar(102), NewName varchar(102), GuildId bigint, PRIMARY KEY (GuildEditId), FOREIGN KEY (GuildId) REFERENCES guilds(GuildId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS channels_edits (ChannelEditId bigint NOT NULL AUTO_INCREMENT, OldName varchar(102), NewName varchar(102), OldCategoryId bigint, NewCategoryId bigint, ChannelId bigint, PRIMARY KEY (ChannelEditId), FOREIGN KEY (ChannelId) REFERENCES channels(ChannelId), FOREIGN KEY (OldCategoryId) REFERENCES categories(CategoryId), FOREIGN KEY (NewCategoryId) REFERENCES categories(CategoryId))")
      })
      .then(() => {
        return parallelqry(temp_conn, "CREATE TABLE IF NOT EXISTS categories_edits (CategoryEditId bigint NOT NULL AUTO_INCREMENT, OldName varchar(102), NewName varchar(102), CategoryId bigint, PRIMARY KEY (CategoryEditId), FOREIGN KEY (CategoryId) REFERENCES categories(CategoryId))")
      })
      .then(function() {
        return pool = mysql.createPool({
          host: '192.168.1.166',
          user: 'griefer',
          password: 'porcodio',
          database: 'discordlog',
          multipleStatements: true,
          connectionLimit: 20,
          charset: "utf8mb4_unicode_520_ci"
        })

      })
      .then(() => resolve('CreatedPool'))
      .catch(err => {
        console.log(err);
        reject('Error creating Pool')
      })
      .finally(function() {
        if (temp_conn)
          temp_conn.end();
      });
  });
}

function handleUsers(user) {
  return new Promise(function(resolve, reject) {
    var avatarPath = path.resolve(__dirname, './avatars', user.id);
    var conn;
    pool.getConnection()
      .then(connection => {
        conn = connection;
        return parallelqry(conn, "INSERT INTO users (UserId , Tag, Bot, AvatarUrl, Edited) SELECT * FROM (SELECT ?, ?, ?, ?, 0 ) AS tmp WHERE NOT EXISTS (SELECT UserId FROM users WHERE UserId = ? ) LIMIT 1;", [user.id, user.tag, user.bot, user.displayAvatarURL, user.id])
      })
      .then(function() {
        return parallelqry(conn, "SELECT AvatarUrl, AvatarPath FROM users WHERE UserId = ?", user.id);
      })
      .then(results => {
        let currentPath = results[0].AvatarPath;
        let newPath;
        if (currentPath === null)
          newPath = path.resolve(avatarPath + "-0000" + ".png");
        else if (results[0].AvatarUrl !== user.displayAvatarURL)
          newPath = path.resolve(avatarPath + "-" + ((parseInt((currentPath.substr(currentPath.length - 8)).substr(0, 4)) + 1).toString().padStart(4, "0")) + ".png");
        else
          newPath = "unchanged";

        if (newPath !== "unchanged") {
          return parallelqry(conn, "UPDATE users SET AvatarUrl = ?, AvatarPath = ? WHERE UserId = ?", [user.displayAvatarURL, newPath, user.id])
            .then(function() {
              download(newPath, user.displayAvatarURL);
              return 'aggiornato';
            })
            .catch(err => {
              console.log(err);
              return 'err';
            });
        } else {
          return 'unchanged';
        }
      })
      .then(status => {
        if (status !== 'err') {
          resolve(status);
        } else {
          reject(status);
        }
      })
      .catch(err => {
        console.log(err);
        reject(err);
      })
      .finally(function release() {
        if (conn)
          conn.release();
      });
  });
}

function handleGuilds(client_guilds, action, connection) {
  return new Promise(function(resolve, reject) {
    let guilds = [];
    let guilds_queries = [];
    let guilds_args = [];
    let queries_removedguilds = [];
    let args_removedguilds = [];
    let temp_conn = null;

    if (action === 'initialize')
      guilds = client_guilds.array();
    else
      guilds = client_guilds;

    if (action === 'initialize' || action === 'add') {
      for (let i = 0; i < guilds.length; i++) {
        if (guilds[i].available) {
          guilds_queries.push("INSERT INTO guilds (GuildId, Name, Available) SELECT * FROM (SELECT ?, ?, 1) AS tmp WHERE NOT EXISTS (SELECT GuildId FROM guilds WHERE GuildId = ? ) LIMIT 1; UPDATE guilds SET BotIsPresent = 1 WHERE GuildId = ?")
          guilds_args.push([guilds[i].id, guilds[i].name, guilds[i].id, guilds[i].id])
        }
      }
    }
    executeQueries(guilds_queries, guilds_args, 'doneWithInsertGuilds')
      .then(() => {
        return pool.getConnection()
      })
      .then(gotConn => {
        temp_conn = gotConn;
      })
      .then(function handleGuildDeletes() {
        if (action === 'initialize') {
          return parallelqry(temp_conn, "SELECT CAST(GuildId AS CHAR) as GuildId FROM guilds WHERE BotIsPresent = 1")
            .then(results => {
              let allGuildsArr = [];
              let removedGuilds = [];
              for (let i = 0; i < results.length; i++) {
                allGuildsArr.push(results[i].GuildId);
              }
              removedGuilds = diff(allGuildsArr, client_guilds.keyArray());
              for (let i = 0; i < removedGuilds; i++) {
                queries_removedguilds.push("UPDATE guilds SET BotIsPresent = 0 WHERE GuildId = ?");
                args_removedguilds.push(removedGuilds[i]);
              }
            })
        } else if (action === 'remove') {
          queries_removedguilds.push("UPDATE guilds SET BotIsPresent = 0 WHERE GuildId = ?");
          args_removedguilds.push(guilds[0].id);
        }
      })
      .then(() => {
        return executeQueries(queries_removedguilds, args_removedguilds, 'doneWithDeleteGuilds')
      })
      .then(async function updateGuilds() {
        if (action === 'initialize' || action === 'update') {
          let queries2 = [];
          let args2 = [];
          for (let i = 0; i < guilds.length; i++) {
            await parallelqry(temp_conn, "SELECT Name FROM guilds WHERE GuildId = ?", guilds[i].id)
              .then(results => {
                if (results[0].Name !== guilds[i].name) {
                  queries2.push("INSERT INTO guilds_edits(OldName, NewName, GuildId) VALUES (?, ?, ?); UPDATE guilds SET Name = ? WHERE GuildId = ?");
                  args2.push([results[0].Name, guilds[i].name, guilds[i].id, guilds[i].name, guilds[i].id]);
                }
              })
          }
          return executeQueries(queries2, args2, 'doneWithUpdateGuild')
            .then(status => {
              temp_conn.release();
              resolve(status);
            })
        } else {
          resolve('doneHandleGuild_NoUpdate');
        }
      })
      .catch(err => {
        if (temp_conn !== null)
          temp_conn.release();
        reject(err)
      })
  });
}

function handleChannels(client_channels, action, connection) {
  return new Promise(function(resolve, reject) {
    let temp_conn = null;
    let channel_queries = [];
    let channel_args = [];
    let queries_removedchans = [];
    let args_removedchans = [];
    let channels = [];
    if (action === 'initialize')
      channels = client_channels.array();
    else
      channels = client_channels;

    if (typeof conn !== 'undefined')
      conn = connection;
    if (action === 'initialize' || action === 'create') {
      for (let i = 0; i < channels.length; i++) {
        let channel = channels[i];
        if (channels[i].type === 'category') {
          channel_queries.push("INSERT INTO categories (CategoryId, Name, GuildId) SELECT * FROM (SELECT ?, ?, ? ) AS tmp WHERE NOT EXISTS (SELECT CategoryId FROM categories WHERE CategoryId = ? ) LIMIT 1;");
          channel_args.push([channel.id, channel.name, channel.guild.id, channel.id]);
          /*} else if (channels[i].type === 'dm') {
            channel_queries.push("INSERT INTO dmchannels (DmChannelId, UserId) SELECT * FROM (SELECT ?, ? ) AS tmp WHERE NOT EXISTS (SELECT DmChannelId FROM dmchannels WHERE DmChannelId = ? ) LIMIT 1;");
            channel_args.push([channel.id, channel.recipient.id, channel.id]);*/
        } else if (channels[i].type !== 'dm') {
          let parentchan;
          if (channels[i].parentID !== null && channels[i].parentID !== undefined) {
            parentchan = channels[i].guild.channels.get(channels[i].parentID);
            channel_queries.push("INSERT INTO categories (CategoryId, Name, GuildId) SELECT * FROM (SELECT ?, ?, ? ) AS tmp WHERE NOT EXISTS (SELECT CategoryId FROM categories WHERE CategoryId = ? ) LIMIT 1;")
            channel_args.push([parentchan.id, parentchan.name, parentchan.guild.id, parentchan.id]);
          }
          channel_queries.push("INSERT INTO channels (ChannelId, Name, Type, CategoryId, GuildId) SELECT * FROM (SELECT ?, ?, ?, ?, ? ) AS tmp WHERE NOT EXISTS (SELECT ChannelId FROM channels WHERE ChannelId = ? ) LIMIT 1;");
          channel_args.push([channel.id, channel.name, channel.type, channel.parentID, channel.guild.id, channel.id]);
        }
      }
    }
    executeQueries(channel_queries, channel_args, 'doneWithInsertChannels')
      .then(() => {
        return pool.getConnection()
      })
      .then(gotConn => {
        temp_conn = gotConn;
      })
      .then(function handleChannelDeletes() {
        if (action === 'initialize') {
          return parallelqry(temp_conn, "SELECT CAST(ChannelId AS CHAR) as ChannelId FROM channels WHERE Deleted IS NULL")
            .then(results => {
              let removedchannelarr = [];
              let removedchannels = [];
              for (let i = 0; i < results.length; i++) {
                removedchannelarr.push(results[i].ChannelId);
              }
              removedchannels = diff(removedchannelarr, client_channels.keyArray());
              for (let i = 0; i < removedchannels.length; i++) {
                queries_removedchans.push("UPDATE channels SET Deleted = 1 WHERE ChannelId = ?");
                args_removedchans.push([removedchannels[i]]);
              }
              return removedchannels;
            })
            .then(() => {
              return parallelqry(temp_conn, "SELECT CAST(CategoryId AS CHAR) as CategoryId FROM categories WHERE Deleted IS NULL")
                .then(results => {
                  let removedcategoriesarr = [];
                  let removedcategories = [];
                  for (let i = 0; i < results.length; i++) {
                    removedcategoriesarr.push(results[i].CategoryId);
                  }
                  removedcategories = diff(removedcategoriesarr, client_channels.keyArray());
                  for (let i = 0; i < removedcategories.length; i++) {
                    queries_removedchans.push("UPDATE categories SET Deleted = 1 WHERE CategoryId = ?")
                    args_removedchans.push([removedcategories[i]]);
                  }
                  return removedcategories;
                })
            })
        } else if (action === 'delete') {
          queries_removedchans.push("UPDATE categories SET Deleted = 1 WHERE CategoryId = ?; UPDATE channels SET Deleted = 1 WHERE ChannelId = ?");
          args_removedchans.push([channels[0].id, channels[0].id]);
        }
      })
      .then(() => {
        return executeQueries(queries_removedchans, args_removedchans, 'doneWithRemovedChannels')
      })
      .then(async function updateChannels() {
        let queries2 = [];
        let args2 = [];
        for (let i = 0; i < channels.length; i++) {
          if (channels[i].type === 'category') {
            await parallelqry(temp_conn, "SELECT Name FROM categories WHERE CategoryId = ?", channels[i].id)
              .then(results => {
                if (results[0].Name !== channels[i].name) {
                  queries2.push("INSERT INTO categories_edits(OldName, NewName, CategoryId) VALUES (?, ?, ?); UPDATE categories SET Name = ? WHERE CategoryId = ?");
                  args2.push([results[0].Name, channels[i].name, channels[i].id, channels[i].name, channels[i].id]);
                }
              });
          } else if (channels[i].type !== 'dm') {
            await parallelqry(temp_conn, "SELECT Name,CAST(CategoryId AS CHAR) as CategoryId FROM channels WHERE ChannelId = ?", channels[i].id) //CategoryId is too big for node ints, needs to be retrieved as a string
              .then(results => {
                if ((results[0].Name !== channels[i].name) || (results[0].CategoryId !== channels[i].parentID)) {
                  queries2.push("INSERT INTO channels_edits(OldName, NewName, OldCategoryId, NewCategoryId, ChannelId) VALUES (?, ?, ?, ?, ?); UPDATE channels SET Name = ?, CategoryId = ? WHERE ChannelId = ?");
                  args2.push([results[0].Name, channels[i].name, results[0].CategoryId, channels[i].parentID, channels[i].id, channels[i].name, channels[i].parentID, channels[i].id]);
                }
              });
          }
        }
        return executeQueries(queries2, args2, 'doneHandleChannel')
          .then(status => {
            temp_conn.release();
            resolve(status);
          })
      })
      .catch(err => {
        if (temp_conn !== null)
          temp_conn.release();
        reject(err)
      })
  });
}

function populatedb() {
  return new Promise(function(resolve, reject) {
    var client_users = client.users.array();
    //var client_guilds = client.guilds.array();
    //var client_channels = client.channels.array();
    var conn;
    pool.getConnection()
      .then(connection => {
        conn = connection;
      })
      .then(async function users() {
        for (let i = 0; i < client_users.length; i++) {
          await handleUsers(client_users[i]);
        }
      })
      .then(function guilds() {
        return handleGuilds(client.guilds, 'initialize');
      })
      .then(function channels() {
        return handleChannels(client.channels, 'initialize');
      })
      .then(function doneWithPopulate() {
        console.log('doneWithPopulate')
        resolve('doneWithPopulate');
      })
      .catch(err => {
        reject(err);
      })
      .finally(function() {
        if (conn)
          conn.release();
      });
  });
}

function processMsg(msg) {
  return new Promise(function(resolve, reject) {
    if (msg.attachments.array().length > 0) {
      var filenameext = msg.attachments.first().filename;
      var n = filenameext.lastIndexOf(".");
      var attachPath = path.resolve(__dirname, './attachments', (filenameext.substring(0, n) + "-" + msg.attachments.first().id.toString() + filenameext.substring(n)));
      download(attachPath, msg.attachments.first().url);
      if (msg.channel.type === 'text') {
        fastqry("INSERT INTO attachments (AttachmentId, Path) VALUES (?, ?); INSERT INTO messages (MessageId, UserId, Content, Timestamp, AttachmentId, ChannelId ) VALUES (?, ?, ?, ?, ?, ?) ", [msg.attachments.first().id, attachPath, msg.id, msg.author.id, msg.cleanContent, msg.createdTimestamp, msg.attachments.first().id, msg.channel.id])
          .then(() => resolve('doneWithAttachMex'))
          .catch(err => reject(err));
      } else if (msg.channel.type === 'dm') {
        handleUsers(msg.channel.recipient)
          .then(() => {
            return fastqry("INSERT INTO attachments (AttachmentId, Path) VALUES (?, ?); INSERT INTO dmchannels (DmChannelId, UserId) SELECT * FROM (SELECT ?, ?) AS tmp WHERE NOT EXISTS (SELECT DmChannelId FROM dmchannels WHERE DmChannelId = ? ) LIMIT 1; INSERT INTO dms (DmId, Content, Timestamp, AttachmentId, DmChannelId ) VALUES (?, ?, ?, ?, ?)", [msg.attachments.first().id, attachPath, msg.channel.id, msg.channel.recipient.id, msg.channel.id, msg.id, msg.cleanContent, msg.createdTimestamp, msg.attachments.first().id, msg.channel.id])
          })
          .then(() => resolve('doneWithAttachDm'))
          .catch(err => reject(err));
      }
    } else {
      if (msg.channel.type === 'text') {
        fastqry("INSERT INTO messages (MessageId, UserId, Content, Timestamp, ChannelId ) VALUES (?, ?, ?, ?, ?)", [msg.id, msg.author.id, msg.cleanContent, msg.createdTimestamp, msg.channel.id])
          .then(() => resolve('doneWithTextMex'))
          .catch(err => reject(err));
      } else if (msg.channel.type === 'dm') {
        handleUsers(msg.channel.recipient)
          .then(() => {
            return fastqry("INSERT INTO dmchannels (DmChannelId, UserId) SELECT * FROM (SELECT ?, ?) AS tmp WHERE NOT EXISTS (SELECT DmChannelId FROM dmchannels WHERE DmChannelId = ? ) LIMIT 1; INSERT INTO dms (DmId, Content, Timestamp, DmChannelId ) VALUES (?, ?, ?, ?)", [msg.channel.id, msg.channel.recipient.id, msg.channel.id, msg.id, msg.cleanContent, msg.createdTimestamp, msg.channel.id])
          })
          .then(() => resolve('doneWithTextDm'))
          .catch(err => reject(err));
      }
    }
  });
}

function updateMessage(oldmsg, newmsg) {
  return new Promise(function(resolve, reject) {

    let array_commands = [];
    let array_args = [];
    let temp_conn, statusmsg;
    if (newmsg.channel.type === 'text') {
      array_commands = ["UPDATE messages SET Content = ?, Edited = 1 WHERE MessageId = ?", "INSERT INTO messages_edits (OldContent, NewContent, Timestamp, MessageId ) VALUES (?, ?, ?, ?)"];
      array_args = [
        [newmsg.cleanContent, oldmsg.id],
        [oldmsg.cleanContent, newmsg.cleanContent, newmsg.editedTimestamp, newmsg.id]
      ];
      statusmsg = 'doneWithUpdateMex';
    } else if (newmsg.channel.type === 'dm') {
      array_commands = ["UPDATE dms SET Content = ?, Edited = 1 WHERE DmId = ?", "INSERT INTO dms_edits (OldContent, NewContent, Timestamp, DmId ) VALUES (?, ?, ?, ?)"];
      array_args = [
        [newmsg.cleanContent, oldmsg.id],
        [oldmsg.cleanContent, newmsg.cleanContent, newmsg.editedTimestamp, newmsg.id]
      ];
      statusmsg = 'doneWithUpdateDm';
    }
    executeQueries(array_commands, array_args, statusmsg)
      .then(status => resolve(status))
      .catch(err => reject(err));

  });
}



/* TODO:
-SETTARE A 500 LE CLIENT OPTIONS PER I MESSAGE LIFETIME;
-Se Gabri manda più di x messaggi più corti di y lettere in z tempo,  KICK ABBUSO PORKADDIO;
-Chat Log;
-Se spacy dice forse, spam di @spacy DECIDITI!
-Citazioni;
-Memebot per Spacy, priority -1;
- Auto add song playlist yt
-Bestemmie;
-un comando "shittyjoke" e ogni volta che lo scrivi scrive shittyjoke.estensionerandom
*/

if (!fs.existsSync(path.resolve(__dirname, './avatars'))) {
  fs.mkdirSync(path.resolve(__dirname, './avatars'));
}
if (!fs.existsSync(path.resolve(__dirname, './attachments'))) {
  fs.mkdirSync(path.resolve(__dirname, './attachments'));
}


/*EVENTS TO HANDLE
  channelCreate !!!
  channelDelete !!!
  channelUpdate !!!
  guildCreate
  guildDelete
  guildMemberAdd !!?
  guildMemberUpdate ???
  guildUpdate
  message !!!
  messageDelete
  messageDeleteBulk
  messageUpdate !!!
  ready !!!
  resume
  userUpdate ???

*/

client.on('channelCreate', channel => {
  if (dbdone) {
    channel_lock = true;
    if (guild_lock) {
      setTimeout(handleChannels([channel], 'create')
        .then(statusmsg => console.log('channelCreate', statusmsg))
        .catch(err => console.log("Error in 'channelCreate' function_1\n", err)), 5000)
    } else {
      handleChannels()
        .then(statusmsg => console.log('channelCreate', statusmsg))
        .catch(err => console.log("Error in 'channelCreate' function_2\n", err));
    }
  }
});

client.on('channelUpdate', function(oldchannel, newchannel) {
  if (dbdone) {
    handleChannels([newchannel], 'update')
      .then(statusmsg => {
        if (statusmsg !== 'Qempty')
          console.log('channelUpdate', statusmsg)
      })
      .catch(err => console.log("Error in 'channelUpdate' function\n", err));
  }
});

client.on('channelDelete', channel => {
  if (dbdone) {
    handleChannels([channel], 'delete')
      .then(statusmsg => {
        if (statusmsg !== 'Qempty')
          console.log('channelDelete', statusmsg)
      })
      .catch(err => console.log("Error in 'channelDelete' function\n", err));
  }
})

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  createPool()
    .then(() => {
      return populatedb();
    })
    .then(function donePopulate() {
      dbdone = true;
    })
    .catch(err => {
      console.log("Error in 'ready' function\n", err);
    });
});

client.on('message', msg => {
  if (dbdone) {
    if (channel_lock || guild_lock) {
      setTimeout(processMsg(msg)
        .then(status => console.log("Status: " + status))
        .catch(err => console.log("Error in 'message' function\n", err)), 10000)
    } else {
      processMsg(msg)
        .then(status => console.log("Status: " + status))
        .catch(err => console.log("Error in 'message' function\n", err))
    }

  } else {
    console.log("DB not ready");
  }
});


client.on('messageUpdate', function(oldmsg, newmsg) {
  if (dbdone) {
    updateMessage(oldmsg, newmsg)
      .then(statusmsg => console.log('msgup' + statusmsg))
      .catch(err => console.log("Error in 'updateMessage' function\n", err));
  }
});


/*client.on('guildMemberAdd', function(member) {
  handleUsers(member.user, function(err, result) {
    console.log(result);
  });
});*/

client.on('guildCreate', guild => {
  if (dbdone) {
    guild_lock = true;
    handleGuilds([guild], 'add')
      .then(statusmsg => {
        if (statusmsg !== 'Qempty')
          console.log('guildCreate', statusmsg)
      })
      .catch(err => console.log("Error in 'guildCreate' function\n", err));
  }
})

client.on('guildDelete', guild => {
  if (dbdone) {
    handleGuilds([guild], 'delete')
      .then(statusmsg => {
        if (statusmsg !== 'Qempty')
          console.log('guildDelete: ', statusmsg)
      })
      .catch(err => console.log("Error in 'guildDelete' function\n", err));
  }
})

client.on('userUpdate', function(oldmsg, newmsg) {
  console.log("Fired userUpdate");
});

client.login(token);
