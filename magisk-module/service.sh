#!/system/bin/sh
# WhatsApp Welcome Bot - service.sh (late_start, mode=service)
# Jalankan bot setelah boot, dengan auto-restart.

MODDIR=${0%/*}
BOT_DIR=$MODDIR/bot
LOG_DIR=$MODDIR/logs
mkdir -p "$LOG_DIR"
echo "[$(date)] service.sh dimulai" >> "$LOG_DIR/boot.log"

# ------------------------------------------------------------------
# Cari binary node (pilih salah satu):
#   1. Node dibundel di $MODDIR/bin/node + library di $MODDIR/lib
#   2. Node dari Termux (harus sudah pkg install nodejs di Termux)
# ------------------------------------------------------------------

if [ -x "$MODDIR/bin/node" ]; then
    NODE_BIN="$MODDIR/bin/node"
    export LD_LIBRARY_PATH="$MODDIR/lib:${LD_LIBRARY_PATH}"
elif [ -d "/data/data/com.termux/files/usr" ]; then
    TERMUX_USR="/data/data/com.termux/files/usr"
    NODE_BIN="$TERMUX_USR/bin/node"
    export LD_LIBRARY_PATH="$TERMUX_USR/lib:${LD_LIBRARY_PATH}"
    export HOME=/data/data/com.termux/files/home
    export PREFIX="$TERMUX_USR"
elif command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
else
    echo "[$(date)] ERROR: tidak ada binary node! Baca README di chat." >> "$LOG_DIR/boot.log"
    exit 1
fi

echo "[$(date)] menggunakan node: $NODE_BIN" >> "$LOG_DIR/boot.log"

# Tunggu boot selesai
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 5
done
sleep 10

# Tunggu koneksi jaringan (maksimal 5 menit)
echo "[$(date)] menunggu koneksi jaringan..." >> "$LOG_DIR/bot.log"
MAX_TRIES=60
i=0
until ping -c1 -W2 8.8.8.8 >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -ge "$MAX_TRIES" ] && break
    sleep 5
done

# Auto-restart loop: kalau bot crash, tunggu 10 dtk lalu jalan lagi
while true; do
    echo "[$(date)] memulai bot..." >> "$LOG_DIR/bot.log"
    cd "$BOT_DIR" || break
    "$NODE_BIN" index.js >> "$LOG_DIR/bot.log" 2>&1
    echo "[$(date)] bot keluar (exit=$?), restart dalam 10 dtk" >> "$LOG_DIR/bot.log"
    sleep 10
done
