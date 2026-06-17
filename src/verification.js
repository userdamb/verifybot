const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { APPLICATIONS_CHANNEL_ID, SUPPORT_ROLE_ID, VERIFY_ROLE_ID } = require('./config');
const { buildApplicationContainer } = require('./components');

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

// Временная блокировка слишком молодых аккаунтов.
const blockedUsers = new Map();
const BLOCK_TTL = 60 * 60 * 1000;

function isBlocked(userId) {
  const blockedAt = blockedUsers.get(userId);
  if (!blockedAt) return false;
  if (Date.now() - blockedAt > BLOCK_TTL) {
    blockedUsers.delete(userId);
    return false;
  }
  return true;
}

function formatDate(date) {
  return `${date.getDate().toString().padStart(2, '0')}.` +
    `${(date.getMonth() + 1).toString().padStart(2, '0')}.` +
    `${date.getFullYear()}`;
}

// Проверка, что нажавший имеет право решать (роль саппорта или администратор).
function isSupport(interaction) {
  if (interaction.memberPermissions?.has('Administrator')) return true;
  return interaction.member?.roles?.cache?.has(SUPPORT_ROLE_ID) ?? false;
}

// Разбор контейнера заявки, чтобы перестроить его при принятии/отклонении.
function parseContainerData(rawContainer) {
  let sectionText = '';
  let infoText = '';
  let oldAvatarURL = '';
  let headerText = '';

  for (const comp of rawContainer.components) {
    if (comp.type === 9) {
      for (const inner of comp.components) {
        if (inner.type === 10) sectionText = inner.content;
      }
      if (comp.accessory && comp.accessory.media?.url) {
        oldAvatarURL = comp.accessory.media.url;
      }
    } else if (comp.type === 10 && sectionText && !infoText) {
      infoText = comp.content;
    }
  }

  for (const comp of rawContainer.components) {
    if (comp.type === 10) {
      headerText = comp.content;
      break;
    }
    if (comp.type === 9) break;
  }

  const userMentionMatch = sectionText.match(/・Пользователь: (<@\d+>)/);
  const dateMatch = sectionText.match(/・Дата регистрации: ([\d.]+)/);
  const deviceMatch = sectionText.match(/・Устройство: (.+)/);
  const nameMatch = infoText.match(/Имя:\n> ```(.+?)```/s);
  const ageMatch = infoText.match(/Возраст:\n> ```(.+?)```/s);
  const tagMatch = infoText.match(/Согласие носить тег:\n> ```(.+?)```/s);
  const sourceMatch = infoText.match(/Как узнали про нас\?:\n> ```(.+?)```/s);

  return {
    userMention: userMentionMatch ? userMentionMatch[1] : null,
    regDate: dateMatch ? dateMatch[1] : 'N/A',
    device: deviceMatch ? deviceMatch[1] : null,
    name: nameMatch ? nameMatch[1] : '?',
    age: ageMatch ? ageMatch[1] : '?',
    tag: tagMatch ? tagMatch[1] : '?',
    source: sourceMatch ? sourceMatch[1] : '?',
    headerText,
    avatarURL: oldAvatarURL,
  };
}

async function handleVerifyStart(interaction) {
  if (isBlocked(interaction.user.id)) {
    return interaction.reply({
      content: '❌ Ваш аккаунт создан менее 14 дней назад. Вы не можете пройти верификацию.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const accountAge = Date.now() - interaction.user.createdTimestamp;
  if (accountAge < FOURTEEN_DAYS) {
    blockedUsers.set(interaction.user.id, Date.now());
    return interaction.reply({
      content: '❌ Ваш аккаунт создан менее 14 дней назад. Вы не можете пройти верификацию.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('verify_modal')
    .setTitle('Анкета верификации');

  const nameInput = new TextInputBuilder()
    .setCustomId('verify_name')
    .setLabel('Ваше имя')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  const ageInput = new TextInputBuilder()
    .setCustomId('verify_age')
    .setLabel('Ваш возраст')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(3);

  const tagInput = new TextInputBuilder()
    .setCustomId('verify_tag')
    .setLabel('Согласны носить тег? (Да/Нет)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  const sourceInput = new TextInputBuilder()
    .setCustomId('verify_source')
    .setLabel('Как узнали про нас?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(ageInput),
    new ActionRowBuilder().addComponents(tagInput),
    new ActionRowBuilder().addComponents(sourceInput),
  );

  await interaction.showModal(modal);
}

async function handleCheckAccount(interaction) {
  const user = await interaction.client.users.fetch(interaction.user.id, { force: true });
  const accountAge = Date.now() - user.createdTimestamp;
  const formattedDate = formatDate(user.createdAt);
  const ageDays = Math.floor(accountAge / (24 * 60 * 60 * 1000));
  const meetsRequirements = accountAge >= FOURTEEN_DAYS;

  if (!meetsRequirements) {
    blockedUsers.set(user.id, Date.now());
  }

  const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(`Проверка аккаунта — ${user.username}`)
    .setColor(3092790)
    .setThumbnail(avatarURL)
    .addFields(
      { name: '> Дата создания', value: `\`\`\`${formattedDate}\`\`\``, inline: true },
      { name: '> Количество дней', value: `\`\`\`${ageDays} дней\`\`\``, inline: true },
      { name: '> Выполнение условий', value: meetsRequirements ? '```diff\n+ Выполнены\n```' : '```diff\n- Не выполнены\n```' },
    );

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleVerifyModal(interaction, client) {
  const name = interaction.fields.getTextInputValue('verify_name');
  const age = interaction.fields.getTextInputValue('verify_age');
  const tag = interaction.fields.getTextInputValue('verify_tag');
  const source = interaction.fields.getTextInputValue('verify_source');

  const user = interaction.user;
  const formattedDate = formatDate(user.createdAt);

  const clientStatus = interaction.member?.presence?.clientStatus;
  let device = 'Неизвестно';
  if (clientStatus) {
    const platforms = [];
    if (clientStatus.desktop) platforms.push('PC');
    if (clientStatus.mobile) platforms.push('Mobile');
    if (clientStatus.web) platforms.push('Browser');
    if (platforms.length > 0) device = platforms.join(', ');
  }

  const appContainer = buildApplicationContainer({
    userId: user.id,
    userMention: `<@${user.id}>`,
    regDate: formattedDate,
    status: 'pending',
    name,
    age,
    tag,
    source,
    device,
    supportText: '・Support: Ожидание...',
    headerText: `Новая заявка на верификацию <@${user.id}> <@&${SUPPORT_ROLE_ID}>`,
    avatarURL: user.displayAvatarURL({ size: 256 }),
  });

  appContainer.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${user.id}`)
        .setLabel('Принять')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${user.id}`)
        .setLabel('Отклонить')
        .setStyle(ButtonStyle.Danger),
    ),
  );

  try {
    const channel = await client.channels.fetch(APPLICATIONS_CHANNEL_ID);
    await channel.send({
      components: [appContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (e) {
    console.error('Could not send application:', e);
  }

  const successEmbed = new EmbedBuilder()
    .setTitle('Ваша заявка на верификацию отправлена')
    .setDescription('Ваша заявка на **верификацию** успешно отправлена. Ожидайте **ответа** в личных сообщениях.')
    .setColor(3092790)
    .setThumbnail(user.displayAvatarURL({ size: 256 }));

  await interaction.reply({
    embeds: [successEmbed],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleAccept(interaction, userId, client) {
  if (!isSupport(interaction)) {
    return interaction.reply({
      content: '❌ У вас нет прав для рассмотрения заявок.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const guild = interaction.guild;

  try {
    const member = await guild.members.fetch(userId);
    await member.roles.add(VERIFY_ROLE_ID);
  } catch (e) {
    console.error('Could not add role:', e);
  }

  const parsed = parseContainerData(interaction.message.components[0]);

  const updatedContainer = buildApplicationContainer({
    userId,
    userMention: parsed.userMention || `<@${userId}>`,
    regDate: parsed.regDate,
    status: 'accepted',
    name: parsed.name,
    age: parsed.age,
    tag: parsed.tag,
    source: parsed.source,
    device: parsed.device,
    supportText: `・Support: ${interaction.user.tag} | ${interaction.user.id}`,
    headerText: parsed.headerText,
    avatarURL: parsed.avatarURL,
  });

  await interaction.update({
    components: [updatedContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  try {
    const user = await client.users.fetch(userId);
    const mod = interaction.user;
    const now = new Date();
    const timeStr = `Сегодня, в ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const acceptEmbed = new EmbedBuilder()
      .setTitle('Вам одобрили верификацию')
      .setColor(0x2F3136)
      .addFields(
        { name: '> Модератор', value: `・ <@${mod.id}>\n・ ${mod.id}`, inline: true },
        { name: '> Статус', value: '```diff\n+ Одобрена\n```', inline: true },
      )
      .setFooter({ text: timeStr })
      .setThumbnail(mod.displayAvatarURL({ size: 256 }));
    await user.send({ embeds: [acceptEmbed] });
  } catch (e) {}
}

async function handleRejectButton(interaction) {
  if (!isSupport(interaction)) {
    return interaction.reply({
      content: '❌ У вас нет прав для рассмотрения заявок.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const userId = interaction.customId.split('_')[1];
  const modal = new ModalBuilder()
    .setCustomId(`reject_modal_${userId}`)
    .setTitle('Причина отклонения');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reject_reason')
    .setLabel('Укажите причину отклонения')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

async function handleRejectModal(interaction, userId, client) {
  const reason = interaction.fields.getTextInputValue('reject_reason');

  const parsed = parseContainerData(interaction.message.components[0]);

  const updatedContainer = buildApplicationContainer({
    userId,
    userMention: parsed.userMention || `<@${userId}>`,
    regDate: parsed.regDate,
    status: 'rejected',
    name: parsed.name,
    age: parsed.age,
    tag: parsed.tag,
    source: parsed.source,
    device: parsed.device,
    supportText: `・Support: ${interaction.user.tag} | ${interaction.user.id}`,
    headerText: parsed.headerText,
    avatarURL: parsed.avatarURL,
  });

  await interaction.update({
    components: [updatedContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  try {
    const user = await client.users.fetch(userId);
    const mod = interaction.user;
    const now = new Date();
    const timeStr = `Сегодня, в ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const rejectEmbed = new EmbedBuilder()
      .setTitle('Вам отклонили верификацию')
      .setColor(0x2F3136)
      .addFields(
        { name: '> Модератор', value: `・ <@${mod.id}>\n・ ${mod.id}`, inline: true },
        { name: '> Причина', value: `\`\`\`diff\n- ${reason}\n\`\`\`` },
      )
      .setFooter({ text: timeStr })
      .setThumbnail(mod.displayAvatarURL({ size: 256 }));
    await user.send({ embeds: [rejectEmbed] });
  } catch (e) {}
}

module.exports = {
  handleVerifyStart,
  handleCheckAccount,
  handleVerifyModal,
  handleAccept,
  handleRejectButton,
  handleRejectModal,
};
