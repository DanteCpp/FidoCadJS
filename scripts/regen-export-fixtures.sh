#!/usr/bin/env bash
#
# File: regen-export-fixtures.sh
# Author: Dante Loi
# Date: 2026-05-14
# Description: Regenerate test/export/fixtures/java/*.{svg,pgf,png} by
#              invoking the Java reference (FidoCadJ) on every .fcd fixture
#              under test/export/fixtures/fcd/.
# Copyright: (c) 2026 Dante Loi - GPL v3
#
# Usage:
#   scripts/regen-export-fixtures.sh         # regenerate (overwrite)
#   scripts/regen-export-fixtures.sh --check # diff-only, exit 1 on drift
#
# Requires:
#   - JDK (any modern version; the reference was built against JDK 16+)
#   - $FIDOCADJ_JAR pointing to a built jar, or a jar at the default path
#     /Users/dante/FidoCadJ/jar/fidocadj.jar. Build with:
#       cd ~/FidoCadJ && ./dev_tools/compile && ./dev_tools/createjar

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES_DIR="${REPO_ROOT}/test/export/fixtures"
FCD_DIR="${FIXTURES_DIR}/fcd"
JAVA_DIR="${FIXTURES_DIR}/java"
PNG_DIR="${FIXTURES_DIR}/png-ref"

JAR="${FIDOCADJ_JAR:-/Users/dante/FidoCadJ/jar/fidocadj.jar}"
MODE="${1:-write}"

if [[ ! -f "${JAR}" ]]; then
    echo "ERROR: FidoCadJ jar not found at ${JAR}" >&2
    echo "Set FIDOCADJ_JAR or build with:" >&2
    echo "  cd ~/FidoCadJ && ./dev_tools/compile && ./dev_tools/createjar" >&2
    exit 2
fi

mkdir -p "${JAVA_DIR}" "${PNG_DIR}"

DRIFT=0
TMPDIR=$(mktemp -d)
trap 'rm -rf "${TMPDIR}"' EXIT

# Strip the volatile "Created by FidoCadJ ver. X.Y.Z..." comment line so
# fixtures don't churn on every Java release.
normalise() {
    sed -E 's@<!-- Created by FidoCadJ ver\. [^>]*-->@<!-- Created by FidoCadJ -->@'
}

for fcd in "${FCD_DIR}"/*.fcd; do
    name="$(basename "${fcd}" .fcd)"

    # SVG
    out_svg="${TMPDIR}/${name}.svg"
    java -jar "${JAR}" -n -f -c r1 svg "${out_svg}" "${fcd}" >/dev/null 2>&1 || {
        echo "  ! Java SVG export failed for ${name}" >&2
        continue
    }
    normalise < "${out_svg}" > "${TMPDIR}/${name}.svg.norm"

    target_svg="${JAVA_DIR}/${name}.svg"
    if [[ "${MODE}" == "--check" ]]; then
        if ! diff -q "${TMPDIR}/${name}.svg.norm" "${target_svg}" >/dev/null 2>&1; then
            echo "  DRIFT: java/${name}.svg" >&2
            DRIFT=1
        fi
    else
        mv "${TMPDIR}/${name}.svg.norm" "${target_svg}"
        echo "  wrote java/${name}.svg"
    fi

    # PNG (r2 = 2 px per logical unit)
    out_png="${TMPDIR}/${name}.png"
    java -jar "${JAR}" -n -f -c r2 png "${out_png}" "${fcd}" >/dev/null 2>&1 || {
        echo "  ! Java PNG export failed for ${name}" >&2
        continue
    }
    target_png="${PNG_DIR}/${name}.png"
    if [[ "${MODE}" == "--check" ]]; then
        if ! cmp -s "${out_png}" "${target_png}"; then
            echo "  DRIFT: png-ref/${name}.png" >&2
            DRIFT=1
        fi
    else
        mv "${out_png}" "${target_png}"
        echo "  wrote png-ref/${name}.png"
    fi

    # PGF (Java's "pgf" filter — note: Java has no separate TikZ filter,
    # so the TS port's TikZ output cannot be compared against Java).
    out_pgf="${TMPDIR}/${name}.pgf"
    if java -jar "${JAR}" -n -f -c r1 pgf "${out_pgf}" "${fcd}" >/dev/null 2>&1; then
        target_pgf="${JAVA_DIR}/${name}.pgf"
        if [[ "${MODE}" == "--check" ]]; then
            if ! diff -q "${out_pgf}" "${target_pgf}" >/dev/null 2>&1; then
                echo "  DRIFT: java/${name}.pgf" >&2
                DRIFT=1
            fi
        else
            mv "${out_pgf}" "${target_pgf}"
            echo "  wrote java/${name}.pgf"
        fi
    fi
done

if [[ "${MODE}" == "--check" && "${DRIFT}" -ne 0 ]]; then
    echo "ERROR: committed fixtures no longer match Java reference output" >&2
    exit 1
fi

echo "done."
