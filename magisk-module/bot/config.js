// Konfigurasi bot
// TARGET_GROUPS: isi nama grup yang dipantau, atau ID grup (format: xxx@g.us)
// Cara dapat ID grup: jalankan bot, masuk grup, command /groupid
module.exports = {
  TARGET_GROUPS: ["120363413154834814@g.us"], // contoh: ["Grup Test", "123456789@g.us"]

  // Template pesan welcome. {user} = tag member baru (@628xxxx), {group} = nama grup
  WELCOME_MESSAGE: ` Halo {user}! \nSelamat datang di *{group}* 👋`,

  SHOW_QR: true,
};
