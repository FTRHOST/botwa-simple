#!/system/bin/sh
# Dipanggil saat module di-uninstall: matikan proses bot yang masih jalan
pkill -f "node.*index.js" 2>/dev/null; true
