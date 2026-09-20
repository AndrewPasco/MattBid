#!/bin/sh
# Cut test/fixture.asc from a real bid package. The fixture is not in git.
# Usage: sh test/make-fixture.sh ~/Downloads/2026_Oct_B777_MEM_LINES.asc
set -e
SRC="$1"; OUT="$(dirname "$0")/fixture.asc"
{
  sed -n '1p' "$SRC"
  for P in 1 105 139 366; do
    awk -v P="$P" '$0 ~ "^ *"P" [A-Z][A-Z]" && /REPORT AT/ {p=1} p {print} p && /^-+$/ {exit}' "$SRC"
  done
  echo '######'
  awk '/Captain ONLY/ && !t {t=1; n=5} n>0 {print; n--}' "$SRC"
  for L in 1001 1002 1150; do
    awk -v L="LINE $L" 'index($0,L)==1 {p=6} p>0 {print; p--}' "$SRC"
  done
  echo '######'
  grep -m1 'First Officer ONLY' "$SRC"
  echo '######'
  awk '/MEM 77C Reserve Lines/ {t=1; n=5} n>0 {print; n--}' "$SRC"
  for N in 7001 7002 7003 7004; do
    grep -E "^ *${N} *\|" "$SRC"
  done
  grep -E '^ *7008-7009 *\|' "$SRC"
  echo '######'
  grep -m1 'MEM 77F Reserve Lines' "$SRC"
  echo '######'
  awk '/^CAP VTO LINES/ {f=1} f {print} f && /^F\/O RDay Value/ {exit}' "$SRC"
} > "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT") lines)"
