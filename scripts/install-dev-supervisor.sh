#!/bin/sh
set -eu
built_executable=${1:?App executable required}
supervisor_executable=${2:?Supervisor destination required}
signing_identity=${3:?Pinned Developer ID signing identity required}
temporary_executable=$(mktemp "${supervisor_executable}.XXXXXX")
trap '/bin/rm -f "$temporary_executable"' EXIT
/bin/cp "$built_executable" "$temporary_executable"
/bin/chmod +x "$temporary_executable"
/usr/bin/codesign --force --sign "$signing_identity" --timestamp=none \
  --identifier com.plinth.desktop.dev-supervisor "$temporary_executable"
/usr/bin/codesign --verify --strict "$temporary_executable"
/bin/mv -f "$temporary_executable" "$supervisor_executable"
