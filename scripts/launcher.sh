#!/bin/bash
# Finder opens .command files with a smaller PATH than an interactive shell.
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

launcher_main() {
  if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
  fi
  if ! command -v node >/dev/null 2>&1; then
    printf '\nInstala Node.js 24 LTS desde https://nodejs.org y vuelve a abrir este lanzador.\n'
    return 1
  fi
  node scripts/launcher.mjs "$@"
}

launcher_main "$@"
launcher_status=$?
if [ "$launcher_status" -ne 0 ] && [ "$launcher_status" -ne 130 ] && [ -t 0 ]; then
  printf '\nNo se pudo completar la operación. El mensaje anterior indica el motivo.\n'
  read -r -p 'Pulsa Intro para cerrar… ' launcher_answer
fi
exit "$launcher_status"
