"""One-time: converts a few of documents/extended/**/*.md into real PDFs
(using reportlab), so rag/ingest.py's PDF-loading path (pypdf) is actually
exercised by the corpus, not just written and never tested against a real
file. The source .md is removed once its .pdf replacement is written, so
the same policy isn't ingested twice.

Usage:
    python -m scripts.make_pdfs
"""

from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "documents" / "extended"

# Relative to documents/extended/. Picked to cover a couple of categories
# and both a plain table-free doc and a table-heavy one.
SOURCE_MARKDOWN_FILES = [
    "hr/benefits_overview_india.md",
    "finance/travel_policy_us.md",
    "security/incident_response_policy.md",
]


def _parse_table(lines: list[str]) -> list[list[str]]:
    rows = []
    for line in lines:
        if set(line.strip()) <= {"-", "|", " "}:
            continue  # markdown's "|---|---|" separator row
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows.append(cells)
    return rows


def _markdown_to_flowables(text: str, styles) -> list:
    flowables = []
    lines = text.splitlines()
    i = 0

    while i < len(lines):
        line = lines[i].rstrip()

        if not line:
            i += 1
            continue

        if line.startswith("| "):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            rows = _parse_table(table_lines)
            table = Table(rows, hAlign="LEFT")
            table.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.5, "#888888"),
                        ("BACKGROUND", (0, 0), (-1, 0), "#DDDDDD"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ]
                )
            )
            flowables.append(table)
            flowables.append(Spacer(1, 0.15 * inch))
            continue

        if line.startswith("# "):
            flowables.append(Paragraph(line[2:], styles["Title"]))
        elif line.startswith("## "):
            flowables.append(Paragraph(line[3:], styles["Heading2"]))
        elif line.startswith("- "):
            flowables.append(Paragraph(f"&bull; {line[2:]}", styles["Normal"]))
        elif line.startswith("> "):
            flowables.append(Paragraph(line[2:], styles["Italic"]))
        else:
            flowables.append(Paragraph(line, styles["Normal"]))

        flowables.append(Spacer(1, 0.08 * inch))
        i += 1

    return flowables


def _render_pdf(markdown_path: Path, pdf_path: Path) -> None:
    text = markdown_path.read_text(encoding="utf-8")
    styles = getSampleStyleSheet()  # already includes "Italic"

    doc = SimpleDocTemplate(str(pdf_path), pagesize=LETTER)
    doc.build(_markdown_to_flowables(text, styles))


def main() -> None:
    for relative_path in SOURCE_MARKDOWN_FILES:
        markdown_path = DOCUMENTS_DIR / relative_path
        pdf_path = markdown_path.with_suffix(".pdf")

        print(f"Rendering {markdown_path} -> {pdf_path}")
        _render_pdf(markdown_path, pdf_path)

        markdown_path.unlink()
        print(f"  removed {markdown_path} (now PDF-only)")


if __name__ == "__main__":
    main()
