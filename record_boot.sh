#!/bin/bash
~/Library/Android/sdk/platform-tools/adb -s IUEFTWMM13D3W8EPQKY reboot
echo "Waiting for device to disconnect..."
~/Library/Android/sdk/platform-tools/adb -s IUEFTWMM13D3W8EPQKY wait-for-disconnect
echo "Waiting for device to reconnect..."
~/Library/Android/sdk/platform-tools/adb -s IUEFTWMM13D3W8EPQKY wait-for-device
echo "Device connected. Starting screen record..."
# Try to record screen for 15 seconds
~/Library/Android/sdk/platform-tools/adb -s IUEFTWMM13D3W8EPQKY shell screenrecord --time-limit 15 /sdcard/boot.mp4
~/Library/Android/sdk/platform-tools/adb -s IUEFTWMM13D3W8EPQKY pull /sdcard/boot.mp4 /Users/zhengbiaoxie/.gemini/antigravity-ide/brain/87ebef04-a7c3-4df7-802b-bf11ae1f9d11/scratch/boot.mp4
echo "Done"
