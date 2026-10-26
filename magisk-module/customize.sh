#!/system/bin/sh
SKIPUNZIP=0
mkdir -p "$MODPATH/bin" "$MODPATH/lib" "$MODPATH/logs"


# Jika binary node aarch64 (node-aarch64) sudah dimasukkan dalam zip,
# pindahkan otomatis ke bin/
if [ -f "$MODPATH/node-aarch64" ]; then
    mv "$MODPATH/node-aarch64" "$MODPATH/bin/node"
    chmod 755 "$MODPATH/bin/node"
fi


# Pastikan bot + node_modules ada
if [ ! -f "$MODPATH/bot/index.js" ]; then
    echo "! bot/index.js tidak ditemukan, instalasi dibatalkan"
    abort
fi


echo "- WhatsApp Welcome Bot terpasang"
echo "! Edit $MODPATH/bot/config.js untuk mengatur TARGET_GROUPS"
