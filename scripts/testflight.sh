#!/bin/bash
# Envoie NIDOO (l'appli et ses widgets) sur TestFlight, d'une seule commande, depuis un Mac où Xcode est installé
# (Xcode n'a pas besoin d'être ouvert ni connecté à un compte) :
#
#     npm run testflight
#
# Il se signe avec une clé d'API App Store Connect, qui reste sur ce Mac :
#   1. App Store Connect > Utilisateurs et accès > Intégrations > App Store Connect API : « Générer une clé »,
#      accès « Admin », puis « Télécharger » : un fichier AuthKey_XXXXXXXXXX.p8 arrive dans Téléchargements.
#   2. La première fois, donner l'« Issuer ID » affiché en haut de cette page :
#          ASC_ISSUER=69a6de7e-xxxx-xxxx-xxxx-xxxxxxxxxxxx npm run testflight
#      Le script range la clé et l'Issuer ID dans ~/.appstoreconnect : les fois suivantes, `npm run testflight` suffit.
#
# Sans clé, il essaie le compte Apple connecté dans Xcode (Xcode > Settings > Accounts).
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM="${TEAM:-RN77C85JG4}"
RANGEMENT="$HOME/.appstoreconnect"
CLES="$RANGEMENT/private_keys"

# ── la clé d'API ──
CLE="${ASC_KEY:-}"
if [ -z "$CLE" ]; then
  CLE=$(ls -t "$CLES"/AuthKey_*.p8 2>/dev/null | head -1 || true)
fi
if [ -z "$CLE" ]; then
  TELECHARGEE=$(ls -t "$HOME"/Downloads/AuthKey_*.p8 "$HOME"/Téléchargements/AuthKey_*.p8 2>/dev/null | head -1 || true)
  if [ -n "$TELECHARGEE" ]; then
    # rangée à l'abri, lisible par toi seule (c'est là que les outils d'Apple la cherchent aussi)
    mkdir -p "$CLES"
    chmod 700 "$RANGEMENT" "$CLES"
    mv "$TELECHARGEE" "$CLES/"
    CLE="$CLES/$(basename "$TELECHARGEE")"
    chmod 600 "$CLE"
    echo "Clé d'API rangée dans $CLES"
  fi
fi

AUTH=()
if [ -n "$CLE" ]; then
  KEY_ID=$(basename "$CLE" .p8)
  KEY_ID="${KEY_ID#AuthKey_}"
  if [ -n "${ASC_ISSUER:-}" ] && ! [[ "$ASC_ISSUER" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    echo "« $ASC_ISSUER » n'est pas un Issuer ID. L'Issuer ID est la longue suite en haut de la page" >&2
    echo "App Store Connect > Intégrations > App Store Connect API (8-4-4-4-12 caractères, ex. 69a6de7e-1a2b-…)," >&2
    echo "pas l'ID de la clé ($KEY_ID)." >&2
    exit 1
  fi
  if [ -n "${ASC_ISSUER:-}" ]; then
    mkdir -p "$RANGEMENT"
    printf '%s\n' "$ASC_ISSUER" > "$RANGEMENT/issuer"
    chmod 600 "$RANGEMENT/issuer"
  fi
  ISSUER=$(cat "$RANGEMENT/issuer" 2>/dev/null || true)
  if [ "$ISSUER" = "$KEY_ID" ]; then ISSUER=""; fi
  if [ -z "$ISSUER" ]; then
    echo "Il manque l'Issuer ID (en haut de la page App Store Connect > Intégrations > App Store Connect API) :" >&2
    echo "    ASC_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx npm run testflight" >&2
    exit 1
  fi
  AUTH=(-authenticationKeyPath "$CLE" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER")
  echo "Signature avec la clé d'API $KEY_ID"
else
  echo "Pas de clé d'API (AuthKey_….p8) : on essaie le compte connecté dans Xcode."
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
if ! xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} \
  DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$NUMERO" archive > "$SORTIE/archive.log" 2>&1; then
  grep -E "error:|\*\* ARCHIVE" "$SORTIE/archive.log" | sort -u | tail -15
  echo
  if grep -q "No Accounts" "$SORTIE/archive.log"; then
    echo "Xcode n'a pas de compte Apple et le script n'a pas trouvé de clé d'API : voir le début de scripts/testflight.sh." >&2
  fi
  echo "L'archive a échoué. Journal complet : ios/build/archive.log" >&2
  exit 1
fi
echo "Archive prête."

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
if ! xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$SORTIE/ExportOptions.plist" \
  -exportPath "$SORTIE/export" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} > "$SORTIE/envoi.log" 2>&1; then
  grep -iE "error|fail|refus|no suitable|record" "$SORTIE/envoi.log" | grep -v "IDEDistributionLogging" | sort -u | tail -15
  echo
  if grep -qiE "no suitable application records|application record|Cannot determine the Apple ID|app record|Error Downloading App Information" "$SORTIE/envoi.log"; then
    echo "NIDOO n'existe pas encore dans App Store Connect : crée-la (Apps > + > Nouvelle app, identifiant com.getupworkspace.nidoo)," >&2
    echo "puis relance  npm run testflight" >&2
  fi
  echo "L'envoi a échoué. Journal complet : ios/build/envoi.log" >&2
  exit 1
fi

echo "Envoyé (build $NUMERO). Il apparaît dans TestFlight après quelques minutes de traitement par Apple."
