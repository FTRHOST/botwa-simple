const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  isJidGroup,
} = require("@whiskeysockets/baileys");
const QRCode = require("qrcode-terminal");
const pino = require("pino");
const fs = require("fs");
const config = require("./config");

const logger = pino({ level: "warn" });

// Simpan kode grup yang pernah di-resolve dari nama -> ID
const groupCacheFile = "./group-cache.json";
let groupCache = {};
if (fs.existsSync(groupCacheFile)) {
  groupCache = JSON.parse(fs.readFileSync(groupCacheFile, "utf8"));
}

function saveGroupCache() {
  fs.writeFileSync(groupCacheFile, JSON.stringify(groupCache, null, 2));
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ["BotWA", "Chrome", "1.0.0"],
  });

  if (!sock.authState.creds.registered && config.SHOW_QR) {
    console.log("⏳ Menunggu QR code...");
  }

  // Mode pairing code (untuk headless/Magisk): isi PAIRING_PHONE di config.js
  if (!sock.authState.creds.registered && config.PAIRING_PHONE) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.PAIRING_PHONE);
        console.log(`🔗 PAIRING CODE: ${code}`);
      } catch (e) {
        console.error("Gagal minta pairing code:", e.message);
      }
    }, 5000);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, qr }) => {
    if (qr) {
      QRCode.generate(qr, { small: true });
      console.log("📱 Scan QR di atas dengan WhatsApp (Perangkat Tertaut)");
    }
    if (connection === "open") {
      console.log("✅ Bot terhubung!");
    }
    if (connection === "close") {
      const shouldReconnect = !(
        arguments[0]?.lastDisconnect?.error?.output?.statusCode === 401
      );
      if (shouldReconnect) {
        console.log("🔄 Terputus, mencoba hubungkan ulang...");
        startBot();
      } else {
        console.log("❌ Sesi berakhir, hapus folder auth dan scan ulang QR.");
      }
    }
  });

  // ================== FITUR UTAMA: Deteksi member join ==================
  sock.ev.on("group-participants.update", async (update) => {
    const { id: groupJid, participants, action } = update;
    try {
      if (action !== "add") return; // hanya join (bukan leave/promote)
      if (!isJidGroup(groupJid)) return;

      // Cek apakah grup ini grup target
      let matched = checkTargetGroup(groupJid);
      if (!matched) return;

      // Ambil nama grup untuk template pesan
      let groupName = groupJid;
      try {
        const meta = await sock.groupMetadata(groupJid);
        groupName = meta.subject;
      } catch {}

      for (const participant of participants) {
        // Baileys v7: participants berupa object {id, phoneNumber, notify, ...}
        const jid =
          typeof participant === "string"
            ? participant
            : participant?.id || participant?.phoneNumber;
        if (!jid) continue;

        const mentionJid = jidNormalizedUser(jid);
        const userName = "@" + mentionJid.split("@")[0];
        const text = config.WELCOME_MESSAGE.replace(
          /@USER|{user}/g,
          userName
        ).replace(/{group}/g, groupName);
        const mentions = [mentionJid];
        await sock.sendMessage(groupJid, { text, mentions });
        console.log(
          `👋 Welcome terkirim ke ${userName} di grup "${groupName}"`,
        );
      }
    } catch (err) {
      console.error("Gagal kirim welcome:", err.message);
    }
  });

  function checkTargetGroup(groupJid) {
    // cocok langsung dengan ID grup jika diisi ID
    if (config.TARGET_GROUPS.includes(groupJid)) return true;
    // cocok dengan nama grup yang sudah di-resolve ke ID lewat cache
    const resolvedIds = Object.values(groupCache);
    for (const target of config.TARGET_GROUPS) {
      if (resolvedIds.includes(target)) return true;
    }
    return false;
  }

  // Simpan mapping nama grup -> ID setiap kali metadata grup tersedia
  sock.ev.on("groups.upsert", async (groups) => {
    for (const g of groups) {
      try {
        const meta = await sock.groupMetadata(g.id);
        groupCache[meta.subject] = g.id;
      } catch {}
    }
    saveGroupCache();
  });

  sock.ev.on("groups.update", async (updates) => {
    for (const u of updates) {
      try {
        const meta = await sock.groupMetadata(u.id);
        groupCache[meta.subject] = u.id;
      } catch {}
    }
    saveGroupCache();
  });

  // ================== COMMAND: /groupid =================================
  // Kirim /groupid oleh owner di grup mana pun untuk dapat ID grup
  const OWNER = (sock.authState.creds?.me?.id || "").split(":")[0];
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg.message) return;

    const jid = msg.key.remoteJid;
    const isGroup = isJidGroup(jid);
    const text =
      msg.message.conversation || msg.message?.extendedTextMessage?.text || "";

    if (!isGroup) {
      // Dapatkan daftar grup saat bot disuruh
      if (text.trim().startsWith("/daftargrup")) {
        const groups = await sock.groupFetchAllParticipating();
        let list = "*Daftar Grup Bot:*\n\n";
        for (const gid of Object.keys(groups)) {
          list += `• ${groups[gid].subject}\n  ➜ ${gid}\n`;
        }
        await sock.sendMessage(jid, { text: list });
      }
      return;
    }

    if (text.trim() === "/groupid") {
      await sock.sendMessage(jid, {
        text: `ID grup ini: *${jid}*`,
      });
    }
  });
}

startBot().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
