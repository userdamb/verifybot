require('dotenv').config();

module.exports = {
  TOKEN: process.env.DISCORD_TOKEN,

  APPLICATIONS_CHANNEL_ID: process.env.APPLICATIONS_CHANNEL_ID,
  SUPPORT_ROLE_ID: process.env.SUPPORT_ROLE_ID,
  VERIFY_ROLE_ID: process.env.VERIFY_ROLE_ID,

  // Канал для ежечасного напоминания.
  REMINDER_CHANNEL_ID: process.env.REMINDER_CHANNEL_ID,

  GUILD_ID: process.env.GUILD_ID || null,

  // Картинка-шапка панели и миниатюра-заглушка заявки.
  IMAGE_URL: 'https://cdn.discordapp.com/attachments/1503090560649658500/1516493964474318868/image.png?ex=6a32d890&is=6a318710&hm=eca5eb5b2e44eed492ac6d072d17957ab4e057606fbc86fad0660ba687c22088&',
  THUMBNAIL_URL: 'https://cdn.discordapp.com/attachments/1501586809723814047/1513273576151711855/content.png?ex=6a272157&is=6a25cfd7&hm=b5cde55624f02527233026643dd28c4c198cd7a74fa3894d93cf69c39d19bbad&',
};
