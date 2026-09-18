#!/bin/zsh

# Shared by the installer and Cargo runner. Pin the certificate outside the
# repository so a newly added identity cannot silently change the app identity.
resolve_dev_signing_identity() {
  signing_identity_file="$HOME/Library/Application Support/Plinth/dev-signing-identity"
  local available
  available="$(/usr/bin/security find-identity -v -p codesigning | /usr/bin/sed -nE 's/^[[:space:]]*[0-9]+\) ([A-Fa-f0-9]{40}) "Developer ID Application:.*$/\1/p')"
  signing_identity="${PLINTH_SIGNING_IDENTITY:-}"
  if [[ -z "$signing_identity" && -f "$signing_identity_file" ]]; then
    signing_identity="$(<"$signing_identity_file")"
  fi
  if [[ -z "$signing_identity" ]]; then
    local -a identities
    identities=("${(@f)available}")
    if [[ -z "$available" || ${#identities} -ne 1 ]]; then
      echo "Choose a Developer ID Application certificate: set PLINTH_SIGNING_IDENTITY to its SHA-1 fingerprint from security find-identity -v -p codesigning." >&2
      return 1
    fi
    signing_identity="$identities[1]"
  fi
  if [[ -z "$signing_identity" ]] || ! /usr/bin/grep -Fxq -- "$signing_identity" <<< "$available"; then
    echo "The selected Developer ID Application certificate is unavailable. Restore it in Keychain or set PLINTH_SIGNING_IDENTITY to an available certificate fingerprint. Ad-hoc signing is disabled." >&2
    return 1
  fi
}

sign_dev_app() {
  # Finder can add these after the app first launches; codesign refuses bundles
  # containing either attribute during the next live Rust rebuild.
  /usr/bin/xattr -dr com.apple.FinderInfo "$1" 2>/dev/null || true
  /usr/bin/xattr -dr com.apple.ResourceFork "$1" 2>/dev/null || true
  /usr/bin/codesign --force --deep --sign "$signing_identity" --timestamp=none \
    --identifier com.plinth.desktop "$1" || return
  /usr/bin/codesign --verify --deep --strict "$1" || return
  /bin/mkdir -p "${signing_identity_file:h}"
  (umask 077; print -r -- "$signing_identity" > "$signing_identity_file")
}
