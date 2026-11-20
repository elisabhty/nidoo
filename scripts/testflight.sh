#!/bin/bash
# Envoie NIDOO (l'appli et ses widgets) sur TestFlight, d'une seule commande, depuis un Mac :
#
#     TEAM=AB12CD34EF npm run testflight
#
# TEAM : l'identifiant de ton équipe Apple (10 caractères, developer.apple.com > Compte > Membership).
# Il faut qu'Xcode soit connecté à ton compte Apple (Xcode > Settings > Accounts)
# et que l'appli com.getupworkspace.nidoo existe dans App Store Connect.
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM="${TEAM:-RN77C85JG4}"
if [ -z "$TEAM" ]; then
  echo "Il manque l'identifiant d'équipe :  TEAM=AB12CD34EF npm run testflight" >&2
  exit 1
fi

# un numéro de build neuf à chaque envoi (TestFlight refuse deux fois le même), le même pour l'appli et ses widgets
NUMERO=$(date +%Y%m%d%H%M)
SORTIE="$PWD/ios/build"
ARCHIVE="$SORTIE/NIDOO.xcarchive"

echo "→ 1/4  L'appli web"
npm run build
npx cap sync ios

echo "→ 2/4  L'archive (build $NUMERO)"
rm -rf "$SORTIE"
mkdir -p "$SORTIE"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$NUMERO" archive

echo "→ 3/4  Les réglages d'envoi"
cat > "$SORTIE/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>upload</string>
	<key>teamID</key>
	<string>$TEAM</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
PLIST

echo "→ 4/4  L'envoi vers TestFlight"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$SORTIE/ExportOptions.plist" \
  -exportPath "$SORTIE/export" -allowProvisioningUpdates

echo "Envoyé (build $NUMERO). Il apparaît dans TestFlight après quelques minutes de traitement par Apple."
