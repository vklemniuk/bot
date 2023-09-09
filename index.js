const Discord = require('discord.js');
const client = new Discord.Client();

const store = {
    general: require('data-store')({ path: process.cwd() + '/data/general.json' }),
    users: require('data-store')({ path: process.cwd() + '/data/users.json' }),
    guilds: require('data-store')({ path: process.cwd() + '/data/guilds.json' })
};

const config = require('./config.json');
let prefix = config.commands.prefix;

//languages
const langNames = ['en', 'es', 'ru'];
const langData = {};

langNames.forEach(l => {
    langData[l] = require(`./langs/${l}.json`);
});

function getString(l, path){
    let d = eval(`langData.${l}.${path}`);
    return d;
}

//main functions for bot interactions
function defaultCommands(msg){
    if(msg.channel.type == 'dm') return;
    let guildPrefix = store.guilds.get(msg.guild.id + '.settings.prefix.value');
    if(!guildPrefix) guildPrefix = prefix;

    if(!msg.content.trim().startsWith(guildPrefix)) return;
    let msgArray = msg.content.slice(guildPrefix.length).trim().split(' ');
    let command = msgArray[0];
    let args = msgArray.slice(1);
    let argsUntrimmed = args;
    /*args.forEach(a => {
        args[a] = a.trim()
    })*/
    let guild = store.guilds.get(msg.guild.id);
    if(guild && guild.settings.disabledChannels && guild.settings.disabledChannels.value.includes(`<#${msg.channel.id}>`)) return;
    let guildLang = 'en';
    if(guild) guildLang = langNames[guild.settings.lang.value]
    if(!guildLang) guildLang = 'en';
    switch(command.toLowerCase()){
        case 'ping':
            msg.channel.send(`:ping_pong: *${randomFromArr(getString(guildLang, 'general.ping'))}* ${args.join('; ')}`);
            break;
        case 'account':
            let user = store.users.get(msg.author.id);
            if(!user){
                user = {
                    id: msg.author.id,
                    settings: {}
                };
                config.user.defaultSettings.forEach(s => {
                    user.settings[s.id] = {
                        n: s.n,
                        value: s.value
                    }
                });
                store.users.set(msg.author.id, user);
            }

            //check for new settings not yet present in the user object
            config.user.defaultSettings.forEach(s => {
                if(!Object.keys(user.settings).includes(s.id)){
                    user.settings[s.id] = {
                        n: s.n,
                        value: s.value
                    }
                    store.users.set(msg.author.id, user);
                }
            });

            let userLang = langNames[user.settings.lang.value];
            store.users.set(msg.author.id + '.name', msg.author.username);
            if(args.length == 0){
                let title = `:bust_in_silhouette: ${getString(userLang, 'account.accountEmbedTitle.s')} ${msg.author.username}${getString(userLang, 'account.accountEmbedTitle.e')}`
                let text = `${getString(userLang, 'account.accountEmbedDesc.s')}\n`;
                Object.values(user.settings).forEach(s => {
                    let sData = config.user.defaultSettings[s.n];
                    if(sData.type == "switch"){
                        let toggleEmjs = [':red_circle:', ':green_circle:'];
                        let toggleTxts = [getString(userLang, 'settings.toggles.d'), getString(userLang, 'settings.toggles.e')];
                        let toggleEmj = s.value ? toggleEmjs[1] : toggleEmjs[0];
                        let toggleTxt = s.value ? toggleTxts[1] : toggleTxts[0];
                        text += `\n${toggleEmj} **${sData.name}** (${toggleTxt}) \n*${sData.desc}*. ${getString(userLang, 'settings.desciprtionHelp.s')} \`${guildPrefix}account toggle ${sData.id}\` ${getString(userLang, 'settings.desciprtionHelp.e')} \n`;
                    }else if(sData.type == "select"){
                        let selected = sData.values[s.value];
                        let toggleEmj = ':blue_circle:';
                        if(selected.emoji) toggleEmj = selected.emoji;
                        text += `\n${toggleEmj} **${sData.name}** (${selected.name}) \n*${sData.desc}*. ${getString(userLang, 'settings.desciprtionHelp.s')} \`${guildPrefix}account set ${sData.id} ${getString(userLang, 'settings.desciprtionHelp.v')}\` ${getString(userLang, 'settings.desciprtionHelp.e')} \n`;
                    }else if(sData.type == "string"){
                        let toggleEmj = ':pencil2:';
                        if(sData.emoji) toggleEmj = sData.emoji;
                        let displayVal = s.value;
                        if(displayVal.length > 10) displayVal = displayVal.s.slice(0, 9) + '...';
                        text += `\n${toggleEmj} **${sData.name}** (set to \`${s.value}\`) \n*${sData.desc}*. ${getString(guildLang, 'settings.desciprtionHelp.s')} \`${guildPrefix}account set ${sData.id} ${getString(guildLang, 'settings.desciprtionHelp.v')}\` ${getString(guildLang, 'settings.desciprtionHelp.e')} \n`;
                    }
                });
                let e = new Discord.MessageEmbed()
                    .setColor('#1679fe')
                    .setTitle(title)
                    .setDescription(text)
                msg.channel.send(e);
            }else if(args[0] == 'toggle'){
                if(!args[1]){
                    msg.channel.send(`:x: ${getString(userLang, 'account.errorOptionToggleNotDefined.s')}`);
                    return;
                }
                let userSettings = store.users.get(msg.author.id + '.settings');
                let userSettingsData = config.user.defaultSettings;
                let command = userSettings[args[1]];
                let commandData = userSettingsData.filter(f => f.id == args[1])[0];
                if(!command || !commandData){
                    msg.channel.send(`:x: ${getString(userLang, 'account.errorOptionNotFound.s')}`);
                    return;
                }
                if(commandData.type != "switch"){
                    msg.channel.send(`:x: ${getString(userLang, 'account.errorOptionNotToggleable.s')}`);
                    return;
                }
                store.users.set(msg.author.id + '.settings.' + commandData.id + '.value', !command.value);
                msg.channel.send(`:white_check_mark: ${getString(userLang, 'account.successToggle.s')} ${commandData.name} ${getString(userLang, 'account.successToggle.m')} ${command.value ? getString(userLang, 'account.successToggle.e1') : getString(userLang, 'account.successToggle.e2')}`);
            }else if(args[0] == 'set'){
                if(!args[1]){
                    msg.channel.send(`:x: ${getString(userLang, 'account.errorOptionSelectNotDefined.s')}`);
                    return;
                }
                let userSettings = store.users.get(msg.author.id + '.settings');
                let userSettingsData = config.user.defaultSettings;
                let command = userSettings[args[1]];
                let commandData = userSettingsData.filter(f => f.id == args[1])[0];
                if(!command || !commandData){
                    msg.channel.send(`:x: ${getString(userLang, 'account.errorOptionNotFound.s')}`);
                    return;
                }
                if(commandData.type != "select"){
                    msg.channel.send(`:x: ${getString(userLang, 'account.errorOptionNotSelectable.s')}`);
                    return;
                }

                let valuesArr = [];
                let valueId = 0;
                let valueIndex = 0;
                commandData.values.forEach(v => {
                    valuesArr.push(v.id);
                    if(v.id == args[2]) valueId = valueIndex;
                    valueIndex++;
                });
                if(!args[2]){
                    msg.channel.send(`${getString(userLang, 'account.selectPossibleOptions.s')} \`${valuesArr.join('`, `')}\``);
                    return;
                }
                let f = commandData.values.filter(h => h.id == args[2])[0];
                if(!f){
                    msg.channel.send(`:x: ${getString(userLang, 'account.errorInvalidValue.s')} ${getString(userLang, 'account.selectPossibleOptions.s')} \`${valuesArr.join('`, `')}\``);
                    return;
                }
                store.users.set(msg.author.id + '.settings.' + commandData.id + '.value', valueId);
                msg.channel.send(`:white_check_mark: ${getString(userLang, 'account.successSelect.s')} ${commandData.name} ${getString(userLang, 'account.successSelect.m')} ${commandData.values[valueId].name}`);
            }
            break;
        case 'server': 
            //if the guild is not in the database yet, add it
            if(!guild){
                guild = {
                    id: msg.guild.id,
                    settings: {}
                };
                config.server.defaultSettings.forEach(s => {
                    guild.settings[s.id] = {
                        n: s.n,
                        value: s.value
                    }
                });
                store.guilds.set(msg.guild.id, guild);
            }

            //check for new settings not yet present in the server object
            config.server.defaultSettings.forEach(s => {
                if(!Object.keys(guild.settings).includes(s.id)){
                    guild.settings[s.id] = {
                        n: s.n,
                        value: s.value
                    }
                    store.guilds.set(msg.guild.id, guild);
                }
            });

            //check for muted role
            let muteRoleApplied = store.guilds.get(msg.guild.id + '.roles.muteRoleApplied');
            let muteRole = store.guilds.get(msg.guild.id + '.settings.muteRole.value').slice(3, -1);
            if(!muteRoleApplied && muteRole){
                let chs = msg.guild.channels.cache;
                let e = false;
                console.log(muteRole);
                chs.forEach(c => {
                    c.createOverwrite(muteRole, {
                        SEND_MESSAGES: false
                    }).catch((b) => {
                        console.log(b);
                        e = true;
                    });
                });
                if(!e) store.guilds.set(msg.guild.id + '.roles.muteRoleApplied', true);
            }else if(!muteRole){
                store.guilds.set(msg.guild.id + '.roles.muteRoleApplied', false);
            }

            //if no args, then just display all the settings
            if(args.length == 0){
                let title = `:compass: ${getString(guildLang, 'server.categoriesEmbedTitle.s')} ${msg.guild.name}${getString(guildLang, 'server.serverEmbedTitle.e')}`
                let text = `${getString(guildLang, 'server.serverEmbedDesc.s')}\n`;
                let i = -1;
                config.server.categoryIds.forEach(c => {
                    i++;
                    let cname = config.server.categories[i];
                    text += `\n**${cname}** (\`${guildPrefix}server ${c}\`) \n`;
                });

                //embed and send
                let e = new Discord.MessageEmbed()
                    .setColor('#1679fe')
                    .setTitle(title)
                    .setDescription(text)
                msg.channel.send(e);
            }else if(config.server.categoryIds.includes(args[0])){
                //view specific category
                let categoryIds = config.server.categoryIds;
                let categoryNames = config.server.categories;
                let title = `:compass: ${getString(guildLang, 'server.serverEmbedTitle.s')} ${msg.guild.name}${getString(guildLang, 'server.serverEmbedTitle.e')} (Category: ${categoryNames[categoryIds.indexOf(args[0])]})`
                let text = `${getString(guildLang, 'server.serverEmbedDesc.s')}\n`;
                let i = -1;
                let ic = categoryIds.indexOf(args[0]);
                Object.values(guild.settings).forEach(s => {
                    i++;
                    let sData = config.server.defaultSettings[s.n];
                    if(sData.category != ic) return;
                    //showif filter
                    let showIf = sData.showif || [1, 2, 3];
                    if(showIf[1] == '='){
                        let val2 = showIf[2];
                        if(guild.settings[showIf[0]].value != val2) return;
                    }else if(showIf[1] == '!='){
                        let val2 = showIf[2];
                        if(guild.settings[showIf[0]].value == val2) return;
                    }
                    if(sData.type == "switch"){
                        //boolean
                        let toggleEmjs = [':red_circle:', ':green_circle:'];
                        let toggleTxts = [getString(guildLang, 'settings.toggles.d'), getString(guildLang, 'settings.toggles.e')];
                        let toggleEmj = s.value ? toggleEmjs[1] : toggleEmjs[0];
                        let toggleTxt = s.value ? toggleTxts[1] : toggleTxts[0];
                        text += `\n${toggleEmj} **${sData.name}** (${toggleTxt}) \n*${sData.desc}*. ${getString(guildLang, 'settings.desciprtionHelp.s')} \`${guildPrefix}server toggle ${sData.id}\` ${getString(guildLang, 'settings.desciprtionHelp.e')} \n`;
                    }else if(sData.type == "select"){
                        //multiple choices
                        let selected = sData.values[s.value];
                        let toggleEmj = ':blue_circle:';
                        if(selected.emoji) toggleEmj = selected.emoji;
                        text += `\n${toggleEmj} **${sData.name}** (${selected.name}) \n*${sData.desc}*. ${getString(guildLang, 'settings.desciprtionHelp.s')} \`${guildPrefix}server set ${sData.id} ${getString(guildLang, 'settings.desciprtionHelp.v')}\` ${getString(guildLang, 'settings.desciprtionHelp.e')} \n`;
                    }else if(sData.type == "string"){
                        //string
                        let toggleEmj = ':pencil2:';
                        if(sData.emoji) toggleEmj = sData.emoji;
                        let displayVal = s.value;
                        if(displayVal.length > 25) displayVal = displayVal.slice(0, 24) + '...';
                        if(sData.filter != "channel" && sData.filter != "role") displayVal = '`' + displayVal + '`';
                        text += `\n${toggleEmj} **${sData.name}** (set to ${s.value ? displayVal : getString(guildLang, 'settings.desciprtionHelp.n')}) \n*${sData.desc}*. ${getString(guildLang, 'settings.desciprtionHelp.s')} \`${guildPrefix}server set ${sData.id} ${getString(guildLang, 'settings.desciprtionHelp.v')}\` ${getString(guildLang, 'settings.desciprtionHelp.e')} \n`;
                    }else if(sData.type == "array"){
                        //array
                        let values = sData.values;
                        if(sData.valuesOverride == "roles"){
                            values = [];
                            msg.guild.roles.cache.forEach(r => {
                                values.push(`<@&${r.id}>`);
                            });
                        }else if(sData.valuesOverride == "channels"){
                            values = [];
                            msg.guild.channels.cache.forEach(r => {
                                values.push(`<#${r.id}>`);
                            });
                        }
                        let toggleEmj = ':notepad_spiral:';
                        if(sData.emoji) toggleEmj = sData.emoji;
                        let displayVal = [];
                        s.value.forEach(v => {
                            displayVal.push(values[values.indexOf(v)]);
                        });
                        
                        if(displayVal.length > 6) {
                            displayVal = displayVal.slice(0, 6);
                            displayVal.push('...');
                        }
                        text += `\n${toggleEmj} **${sData.name}** (contains ${displayVal != "" ? displayVal.join('; ') : getString(guildLang, 'settings.desciprtionHelp.n')}) \n*${sData.desc}*. ${getString(guildLang, 'settings.desciprtionHelp.s')} \`${guildPrefix}server set ${sData.id} ${getString(guildLang, 'settings.desciprtionHelp.vm')}\` ${getString(guildLang, 'settings.desciprtionHelp.e')} \n`;
                    }
                });

                //embed and send
                let e = new Discord.MessageEmbed()
                    .setColor('#1679fe')
                    .setTitle(title)
                    .setDescription(text)
                    .setFooter(getString(guildLang, 'settings.desciprtionHelp.r'))
                msg.channel.send(e);
            }else if(args[0] == 'toggle'){
                //check for permissions
                if(!msg.member.hasPermission('MANAGE_GUILD')){
                    msg.channel.send(`:x: ${getString(guildLang, 'server.errorPermissions.s')}`);
                    return;
                }
                //toggle a boolean option
                if(!args[1]){
                    msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionToggleNotDefined.s')}`);
                    return;
                }
                let guildSettings = store.guilds.get(msg.guild.id + '.settings');
                let guildSettingsData = config.server.defaultSettings;
                let command = guildSettings[args[1]];
                let commandData = guildSettingsData.filter(f => f.id == args[1])[0];
                //command not found
                if(!command || !commandData){
                    msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionNotFound.s')}`);
                    return;
                }
                //command not toggleable
                if(commandData.type != "switch"){
                    msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionNotToggleable.s')}`);
                    return;
                }
                //success
                store.guilds.set(msg.guild.id + '.settings.' + commandData.id + '.value', !command.value);
                msg.channel.send(`:white_check_mark: ${getString(guildLang, 'account.successToggle.s')} ${commandData.name} ${getString(guildLang, 'account.successToggle.m')} ${command.value ? getString(guildLang, 'account.successToggle.e1') : getString(guildLang, 'account.successToggle.e2')}`);
            }else if(args[0] == 'set'){
                //check for permissions
                if(!msg.member.hasPermission('MANAGE_GUILD')){
                    msg.channel.send(`:x: ${getString(guildLang, 'server.errorPermissions.s')}`);
                    return;
                }
                //edit a select or a string
                if(!args[1]){
                    msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionSelectNotDefined.s')}`);
                    return;
                }
                let guildSettings = store.guilds.get(msg.guild.id + '.settings');
                let guildSettingsData = config.server.defaultSettings;
                let command = guildSettings[args[1]];
                let commandData = guildSettingsData.filter(f => f.id == args[1])[0];
                //command not found
                if(!command || !commandData){
                    msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionNotFound.s')}`);
                    return;
                }
                //command not editable
                if(commandData.type != "select" && commandData.type != "string" && commandData.type != "array"){
                    msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionNotSelectable.s')}`);
                    return;
                }
                //success
                let valuesArr = [];
                let valueId = 0;
                let valueIndex = 0;
                if(commandData.type == "select"){
                    commandData.values.forEach(v => {
                        valuesArr.push(v.id);
                        if(v.id == args[2]) valueId = valueIndex;
                        valueIndex++;
                    });
                    if(!args[2]){
                        msg.channel.send(`${getString(guildLang, 'account.selectPossibleOptions.s')} \`${valuesArr.join('`, `')}\``);
                        return;
                    }
                    let f = commandData.values.filter(h => h.id == args[2])[0];
                    if(!f){
                        msg.channel.send(`:x: ${getString(guildLang, 'account.errorInvalidValue.s')} ${getString(guildLang, 'account.selectPossibleOptions.s')} \`${valuesArr.join('`, `')}\``);
                        return;
                    }
                }else if(commandData.type == "string"){
                    valueId = args.slice(2).join(' ').trim();
                    if(!valueId){
                        msg.channel.send(`${getString(guildLang, 'account.selectPossibleOptions.s')}`);
                        return;
                    }
                    //string filters
                    let sf = true;
                    if(commandData.filter == 'channel'){
                        let v = args[2];
                        if(!(v.startsWith('<#') && v.endsWith('>'))) sf = false;
                        else if(v.slice(2, -1) != parseInt(v.slice(2, -1))) sf = false;
                        else {
                            client.channels.fetch(v.slice(2, -1)).then(c => {
                                if((!c) || c.guild.id != msg.guild.id) {
                                    msg.channel.send(`:x: ${getString(guildLang, 'server.errorInvalidChannel.s')}`);
                                    store.guilds.set(msg.guild.id + '.settings.' + commandData.id + '.value', '');
                                    return;
                                }
                            }).catch(c => {
                                msg.channel.send(`:x: ${getString(guildLang, 'server.errorInvalidChannel.s')}`);
                                store.guilds.set(msg.guild.id + '.settings.' + commandData.id + '.value', '');
                                return;
                            });
                        }
                    }else if(commandData.filter == 'role'){
                        let v = args[2];
                        if(!(v.startsWith('<@&') && v.endsWith('>'))) sf = false;
                        else if(v.slice(3, -1) != parseInt(v.slice(3, -1))) sf = false;
                        else if(!msg.guild.roles.cache.get(v.slice(3, -1))) sf = false;
                        //console.log(msg.guild.roles.cache.get(v.slice(3, -1).id), !(v.startsWith('<@&') && v.endsWith('>')))
                    }
                    if(!sf){
                        msg.channel.send(`:x: ${getString(guildLang, 'server.errorInvalidRole.s')}`);
                        return;
                    }
                }else if(commandData.type == "array"){
                    commandData.values.forEach(v => {
                        valuesArr.push(v.id);
                        if(v.id == args[2]) valueId = valueIndex;
                        valueIndex++;
                    });
                    if(!args[2]){
                        msg.channel.send(`${getString(guildLang, 'account.selectPossibleOptions.s')} \`${valuesArr.join('`, `')}\``);
                        return;
                    }
                    let data = args.slice(2);
                    let actualData = [];
                    data.forEach(d => {
                        if(commandData.valuesOverride == "roles"){
                            if(!msg.guild.roles.cache.get(d.slice(3, -1)) && !msg.guild.roles.cache.get(d)) return;
                            if(msg.guild.roles.cache.get(d.slice(3, -1))) actualData.push(d);
                            else actualData.push(`<@&${d}>`);
                        }else if(commandData.valuesOverride == "channels"){
                            if(!msg.guild.channels.cache.get(d.slice(2, -1)) && !msg.guild.channels.cache.get(d)) return;
                            if(msg.guild.channels.cache.get(d.slice(2, -1))) actualData.push(d);
                            else actualData.push(`<#${d}>`);
                        }else{
                            if(commandData.values.includes(d)) actualData.push(d);
                        }
                    });
                    valueId = actualData;
                    
                }
                store.guilds.set(msg.guild.id + '.settings.' + commandData.id + '.value', valueId);
                msg.channel.send(`:white_check_mark: ${getString(guildLang, 'account.successSelect.s')} ${commandData.name} ${getString(guildLang, 'account.successSelect.m')} ${(commandData.type == "select") ? commandData.values[valueId].name : command.value}`);
            }else if(args[0] == 'reset'){
                //check for permissions
                if(!msg.member.hasPermission('MANAGE_GUILD')){
                    msg.channel.send(`:x: ${getString(guildLang, 'server.errorPermissions.s')}`);
                    return;
                }
                if(!args[1]){
                    msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionSelectNotDefined.s')}`);
                    return;
                }
                let guildSettings = store.guilds.get(msg.guild.id + '.settings');
                let guildSettingsData = config.server.defaultSettings;
                let command = guildSettings[args[1]];
                let commandData = guildSettingsData.filter(f => f.id == args[1])[0];
                store.guilds.set(msg.guild.id + '.settings.' + commandData.id + '.value', commandData.value);
                let displayVal = commandData.value;
                if(commandData.type == "switch") displayVal = commandData.value ? "Enabled" : "Disabled";
                else if(commandData.type == "select") displayVal = commandData.values[commandData.value].name;
                msg.channel.send(`:white_check_mark: ${getString(guildLang, 'server.optionReset.s')} **${commandData.name}** ${getString(guildLang, 'server.optionReset.m')} \`${displayVal}\``)
            }
            break;      
        case 'view':
            let settingNames = Object.keys(guild.settings);
            //if no arguments, notify user
            if(args.length == 0){
                msg.channel.send(`:x: ${getString(guildLang, 'server.errorViewOptionNotDefined.s')} ${getString(guildLang, 'server.viewPossibleOptions.s')} \`${settingNames.join('`, `')}\``);
                return;
            }else if(!settingNames.includes(args[0])){
                msg.channel.send(`:x: ${getString(guildLang, 'account.errorOptionNotFound.s')} ${getString(guildLang, 'server.viewPossibleOptions.s')} \`${settingNames.join('`, `')}\``);
                return;
            }else{
                let sData = config.server.defaultSettings[guild.settings[args[0]].n];
                let text = '';
                if(sData.type == "string" && !guild.settings[args[0]].value) text += getString(guildLang, 'settings.desciprtionHelp.n');
                else if(sData.type == "string" && sData.filter) text += `${guild.settings[args[0]].value.toString()}`;
                else if(sData.type == "string") text += `\`\`\`${guild.settings[args[0]].value.toString()}\`\`\``;
                else if(sData.type == "switch") text += `**${guild.settings[args[0]].value ? "Enabled" : "Disabled"}**`;
                else if(sData.type == "select") text += `**${sData.values[guild.settings[args[0]].value].name}**`;
                let e = new Discord.MessageEmbed()
                    .setColor('#1679fe')
                    .setTitle(`:eye: ${getString(guildLang, 'server.viewOption.s')} ${sData.name} ${getString(guildLang, 'server.viewOption.m')}`)
                    .setDescription(text)
                    .setFooter(getString(guildLang, 'settings.desciprtionHelp.r'))
                msg.channel.send(e);
            }
            break;
        case 'welcometags':
            msg.channel.send(
`${getString(guildLang, 'server.welcomeTags.s')}
    \`<user>\` - ${getString(guildLang, 'server.welcomeTags[1]')}
    \`<name>\` - ${getString(guildLang, 'server.welcomeTags[2]')}
    \`<tag>\` - ${getString(guildLang, 'server.welcomeTags[3]')}
    \`<spentdays>\` - ${getString(guildLang, 'server.welcomeTags[4]')}
    \`<spentmonths>\` - ${getString(guildLang, 'server.welcomeTags[5]')}
${getString(guildLang, 'server.welcomeTags.m')} \`<|>\` ${getString(guildLang, 'server.welcomeTags.e')} \`Welcome message 1 <|> Welcome Message 2 <|> Welcome Message 3\``
            );
            break;
        case 'help':
            let guildSettings = store.guilds.get(msg.guild.id + '.settings');

            //list all the commands
            let commandList = config.commands.info;
            let commandCategories = config.commands.categories;
            let categoryNames = [];
            commandCategories.forEach(c => {
                categoryNames.push(c.name);
            });

            let text = 'Here is the list of commands you can use:\n';

            //if no arguments, list all the commands
            if(args.length == 0){
                commandList.forEach(c => {
                    text += `\n:small_blue_diamond: **${guildPrefix}${c.name}** \n*${c.description}*\n`;
                });

                let e = new Discord.MessageEmbed()
                    .setColor('#1679fe')
                    .setTitle('Help me please!!!')
                    .setDescription(text)
                    .setFooter(`Command Categories: ${categoryNames.join(', ')}`);
                if(!guild || !guildSettings.dmHelp || !guildSettings.dmHelp.value) msg.channel.send(e);
                else{
                    msg.author.send(e);
                    msg.reply('Check your DMs!');
                }
            }else if(categoryNames.includes(args[0])){
                let cc = commandCategories.filter(f => f.name == args[0])[0];
                commandList.forEach(c => {
                    if(c.category != cc.id) return;
                    text += `\n:small_blue_diamond: **${guildPrefix}${c.name}** \n*${c.description}*\n`;
                });

                let e = new Discord.MessageEmbed()
                    .setColor('#1679fe')
                    .setTitle(`Help me please!!! (category: ${args[0]})`)
                    .setDescription(text)
                    .setFooter(`Command Categories: ${categoryNames.join(', ')}`)

                if(!guildSettings.dmHelp || !guildSettings.dmHelp.value) msg.channel.send(e);
                else{
                    msg.author.send(e);
                    msg.reply('Check your DMs!');
                }
            }
            break;
        case 'mute':
            if(!msg.member.hasPermission('MANAGE_MEMBERS')){
                msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorPermissions.s')}`);
                return;
            } 
            let guildSettings2 = store.guilds.get(msg.guild.id + '.settings');
            if(args.length == 0){
                msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorMuteNotDefined.s')}`);
            }else{
                let muteRole = guildSettings2.muteRole.value;
                if(!muteRole){
                    msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorMuteRoleNotDefined.s')}`);
                    return;
                }
                if(!(args[0].startsWith('<@!') || args[0].startsWith('<@')) || !args[0].endsWith('>')){
                    msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorInvalidMember.s')}`);
                    return;
                } 
                let mId;
                if(args[0].startsWith('<@!')) mId = args[0].slice(3, -1);
                else mId = args[0].slice(2, -1);

                if(!msg.guild.members.cache.get(mId)){
                    msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorInvalidMember.s')}`);
                    return;
                }

                msg.guild.members.cache.get(mId).roles.add(muteRole.slice(3, -1)).then(() => {
                    msg.channel.send(`**${msg.guild.members.cache.get(mId).user.username}** ${getString(guildLang, 'moderation.successMute.s')}`)
                }).catch(() => {
                    msg.channel.send(`:x: Unknown error`);
                });
            }
            break;
        case 'unmute': 
            if(!msg.member.hasPermission('MANAGE_MEMBERS')){
                msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorPermissions.s')}`);
                return;
            } 
            let guildSettings3 = store.guilds.get(msg.guild.id + '.settings');
            if(args.length == 0){
                msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorUnmuteNotDefined.s')}`);
            }else{
                let muteRole = guildSettings3.muteRole.value;
                if(!muteRole){
                    msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorMuteRoleNotDefined.s')}`);
                    return;
                }
                if(!(args[0].startsWith('<@!') || args[0].startsWith('<@')) || !args[0].endsWith('>')){
                    msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorInvalidMember.s')}`);
                    return;
                } 
                let mId;
                if(args[0].startsWith('<@!')) mId = args[0].slice(3, -1);
                else mId = args[0].slice(2, -1);

                if(!msg.guild.members.cache.get(mId)){
                    msg.channel.send(`:x: ${getString(guildLang, 'moderation.errorInvalidMember.s')}`);
                    return;
                }

                msg.guild.members.cache.get(mId).roles.remove(muteRole.slice(3, -1)).then(() => {
                    msg.channel.send(`**${msg.guild.members.cache.get(mId).user.username}** ${getString(guildLang, 'moderation.successUnmute.s')}`)
                }).catch(() => {
                    msg.channel.send(`:x: Unknown error`);
                });
            }
            break;
    }
}

function randomFromArr(a){
    return a[Math.floor(Math.random() * a.length)];
}

//event listeners
client.on('ready', () => {
    console.log(`Beans! Bot: ${config.bot.name}`);
    store.general.set('geometry', 'dash!');
});

client.on('message', msg => {
    defaultCommands(msg);
});

client.on('guildMemberAdd', m => {
    let guildSettings = store.guilds.get(m.guild + '.settings');
    if(!guildSettings) return;

    //permanent roles
    let oldMRoles = store.guilds.get(m.guild.id + '.members.' + m.id + '.roles');
    if(oldMRoles && guildSettings.permanentRoles.value){
        oldMRoles.forEach(r => {
            if(guildSettings.permanentRoles.value.includes(`<@&${r}>`)){
                m.roles.add(r).catch(() => {
                    console.log('cannot add permanent role');
                });
            }
        })
    }
    //default roles
    if(guildSettings.defaultRoles.value){
        guildSettings.defaultRoles.value.forEach(r => {
            let rr = r.slice(3, -1);
            m.roles.add(rr).catch(() => {
                console.log('cannot add default role');
            });
        })
    }
    if(guildSettings.welcome.value && guildSettings.joinMessage.value && guildSettings.welcomeChannel.value){
        let ms = guildSettings.joinMessage.value;
        let regex = [
            {
                regex: /<user>/gi,
                text: `<@!${m.id}>`
            }, 
            {
                regex: /<name>/gi,
                text: m.user.username
            },
            {
                regex: /<tag>/gi,
                text: m.user.discriminator
            },
        ];
        regex.forEach(r => {
            ms = ms.replace(r.regex, r.text)
        });
        let msA = ms.split('<|>');
        msA = msA.filter(f => f.trim() != '');
        client.channels.fetch(guildSettings.welcomeChannel.value.slice(2, -1)).then(c => {
            c.send(randomFromArr(msA));
        }).catch(() => {
            console.log('error: tried to send welcome, but invalid channel (or missing perms)')
        })
    }
});

client.on('guildMemberRemove', m => {
    //calculate time spent on the server
    let dateNow = new Date();
    let dateThen = m.joinedAt;
    let m1 = dateNow.getMonth();
    let m2 = dateThen.getMonth();
    let mm = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    let timeSpent = (dateNow.getFullYear()*365 + m1*mm[m1] + dateNow.getDate()) - (dateThen.getFullYear()*365 + m2*mm[m2] + dateThen.getDate())
    let timeSpentMonth = (dateNow.getFullYear()*12 + m1) - (dateThen.getFullYear()*12 + m2)
    
    let mRoles = [];
    m.roles.cache.forEach(r => {
        mRoles.push(r.id);
    });
    
    let guildSettings = store.guilds.get(m.guild + '.settings');
    if(!guildSettings) return;

    store.guilds.set(m.guild.id + '.members.' + m.id + '.roles', mRoles);
    if(guildSettings.welcome.value && guildSettings.leaveMessage.value && guildSettings.welcomeChannel.value){
        let ms = guildSettings.leaveMessage.value;
        let regex = [
            {
                regex: /<user>/gi,
                text: `<@!${m.id}>`
            }, 
            {
                regex: /<name>/gi,
                text: m.user.username
            },
            {
                regex: /<tag>/gi,
                text: m.user.discriminator
            },
            {
                regex: /<spentdays>/gi,
                text: timeSpent
            },
            {
                regex: /<spentmonths>/gi,
                text: timeSpentMonth
            }
        ];
        regex.forEach(r => {
            ms = ms.replace(r.regex, r.text)
        });
        let msA = ms.split('<|>');
        msA = msA.filter(f => f.trim() != '');
        client.channels.fetch(guildSettings.welcomeChannel.value.slice(2, -1)).then(c => {
            c.send(randomFromArr(msA));
        }).catch(() => {
            console.log('error: tried to send welcome, but invalid channel (or missing perms)')
        })
    }
});

client.on('channelCreate', c => {
    if(!store.guilds.get(c.guild.id)) return;
    let muteRole = store.guilds.get(c.guild.id + '.settings.muteRole.value').slice(3, -1);
    if(muteRole){
        c.createOverwrite(muteRole, {
            SEND_MESSAGES: false
        }).catch((b) => {
            console.log(b);
            e = true;
        });
    }
});
let token = config.bot.token;
//token = config.bot.devToken; //comment this line when the build is ready
client.login(token);

