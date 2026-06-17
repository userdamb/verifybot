const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { THUMBNAIL_URL, IMAGE_URL } = require('./config');

// Иконки статуса. Это кастомные эмодзи СТАРОГО сервера — у нового бота
// они могут не отображаться. Замените на эмодзи своего сервера при желании.
const STATUS_ICONS = {
  pending: '<:yellow:1472531710997692544>',
  accepted: '<:green:1472531622837485773>',
  rejected: '<:red:1472531661030690816>',
};

// Контейнер заявки на верификацию (Components V2) с 4 полями анкеты.
function buildApplicationContainer({
  userId,
  userMention,
  regDate,
  status,
  name,
  age,
  tag,
  source,
  device,
  supportText,
  headerText,
  avatarURL,
}) {
  const statusIcon = STATUS_ICONS[status] || STATUS_ICONS.pending;

  const container = new ContainerBuilder().setAccentColor(0x2F3136);

  if (headerText) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(headerText),
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );
  }

  container
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `・Пользователь: ${userMention}\n` +
            `・ID: ${userId}\n` +
            `・Дата регистрации: ${regDate}\n` +
            (device ? `・Устройство: ${device}\n` : '') +
            `・Статус: ${statusIcon}`,
          ),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder({ media: { url: avatarURL || THUMBNAIL_URL } }),
        ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Имя:\n> \`\`\`${name}\`\`\`\n\n` +
        `Возраст:\n> \`\`\`${age}\`\`\`\n\n` +
        `Согласие носить тег:\n> \`\`\`${tag}\`\`\`\n\n` +
        `Как узнали про нас?:\n> \`\`\`${source}\`\`\``,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${supportText}`),
    );

  return container;
}

// Контейнер панели верификации с кнопками.
function buildPanelContainer() {
  return new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(IMAGE_URL),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# —・Верификация'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '> Для того чтобы **пройти верификацию**, нажми на кнопку ниже и заполни небольшую **анкету**. Убедись, что все данные **верны**.\n\n' +
        '・ Вашему аккаунту должно быть больше **14** дней.\n' +
        '・ Вам должно быть больше **14** лет.',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_start')
          .setLabel('Верифицироваться')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('check_account')
          .setLabel('Проверить аккаунт')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}

module.exports = { buildApplicationContainer, buildPanelContainer };
