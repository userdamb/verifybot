const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const { TOKEN, GUILD_ID, REMINDER_CHANNEL_ID } = require('./src/config');
const { buildPanelContainer } = require('./src/components');
const verification = require('./src/verification');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.User, Partials.GuildMember, Partials.Channel],
});

const panelCommand = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Опубликовать панель верификации в этом канале')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerInGuild(guildId) {
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: [panelCommand.toJSON()],
    });
    console.log(`Команда /panel зарегистрирована в гильдии ${guildId}.`);
  } catch (e) {
    console.error(`Не удалось зарегистрировать /panel в ${guildId}:`, e.message);
  }
}

async function registerCommands() {
  if (GUILD_ID) {
    await registerInGuild(GUILD_ID);
    return;
  }

  // GUILD_ID не задан — регистрируем во всех серверах, где уже есть бот (быстро).
  const guildIds = [...client.guilds.cache.keys()];
  if (guildIds.length === 0) {
    console.log('Бот пока не добавлен ни на один сервер. Пригласите его — команда /panel зарегистрируется автоматически.');
  }
  for (const guildId of guildIds) {
    await registerInGuild(guildId);
  }
}

const REMINDER_TEXT =
  '@everyone @here\n\n' +
  'Кто не верефнут, подавайте заявку только после того, как поставили гильдию в профиль.';

let lastReminderMessage = null;

async function sendReminder() {
  if (!REMINDER_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(REMINDER_CHANNEL_ID);

    // Удаляем предыдущее напоминание перед отправкой нового.
    if (lastReminderMessage) {
      await lastReminderMessage.delete().catch(() => {});
      lastReminderMessage = null;
    }

    lastReminderMessage = await channel.send({
      content: REMINDER_TEXT,
      allowedMentions: { parse: ['everyone'] },
    });
  } catch (e) {
    console.error('Не удалось отправить напоминание:', e.message);
  }
}

function startReminderLoop() {
  if (!REMINDER_CHANNEL_ID) {
    console.log('REMINDER_CHANNEL_ID не задан — ежечасное напоминание отключено.');
    return;
  }
  const HOUR = 60 * 60 * 1000;
  setInterval(sendReminder, HOUR);
  console.log('Ежечасное напоминание включено.');
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  try {
    await registerCommands();
  } catch (e) {
    console.error('Ошибка регистрации команд:', e);
  }
  startReminderLoop();
});

// Регистрируем команду, когда бота добавляют на новый сервер (без перезапуска).
client.on(Events.GuildCreate, (guild) => {
  if (GUILD_ID) return;
  registerInGuild(guild.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') {
        await interaction.channel.send({
          components: [buildPanelContainer()],
          flags: MessageFlags.IsComponentsV2,
        });
        return interaction.reply({
          content: '✅ Панель опубликована.',
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'verify_start') return verification.handleVerifyStart(interaction);
      if (id === 'check_account') return verification.handleCheckAccount(interaction);
      if (id.startsWith('accept_')) {
        return verification.handleAccept(interaction, id.split('_')[1], client);
      }
      if (id.startsWith('reject_')) {
        return verification.handleRejectButton(interaction);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (id === 'verify_modal') return verification.handleVerifyModal(interaction, client);
      if (id.startsWith('reject_modal_')) {
        return verification.handleRejectModal(interaction, id.replace('reject_modal_', ''), client);
      }
      return;
    }
  } catch (e) {
    console.error('Ошибка обработки interaction:', e);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Произошла ошибка.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);
