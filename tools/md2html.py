#!/usr/bin/env python3
"""CIVITAS md2html — generate a styled .html twin next to every .md in the repo.

Stdlib only (no pip installs — the no-build-pipeline rule applies to tooling too).
Supports the markdown subset used in this repo: # headings, **bold**, *italic*,
`code`, ``` fences, - / 1. lists, > blockquotes, --- rules, [text](url) links,
and | pipe | tables |.

Usage:  python tools/md2html.py        (from the repo root, or anywhere)
"""

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
 body{{max-width:860px;margin:2rem auto;padding:0 1.2rem 4rem;background:#0d0f14;color:#d8dbe2;
      font:15px/1.65 'Segoe UI',system-ui,sans-serif}}
 h1,h2,h3,h4{{font-family:Consolas,'Courier New',monospace;color:#e8b84b;letter-spacing:.5px;line-height:1.3}}
 h1{{border-bottom:1px solid #262b3b;padding-bottom:.35em}}
 a{{color:#7aa6d8}} a:hover{{color:#e8b84b}}
 code{{background:#151823;border:1px solid #262b3b;border-radius:4px;padding:.1em .4em;
      font-family:Consolas,monospace;font-size:.9em}}
 pre{{background:#10131b;border:1px solid #262b3b;border-radius:8px;padding:14px;overflow-x:auto}}
 pre code{{background:none;border:none;padding:0}}
 blockquote{{border-left:3px solid #b88d2c;margin-left:0;padding-left:14px;color:#8d96a8}}
 table{{border-collapse:collapse;margin:1em 0;width:100%}}
 th,td{{border:1px solid #262b3b;padding:7px 11px;text-align:left}}
 th{{background:#151823;color:#e8b84b;font-family:Consolas,monospace;font-size:.85em;letter-spacing:1px}}
 tr:nth-child(even){{background:#11141d}}
 hr{{border:none;border-top:1px solid #262b3b;margin:2.2rem 0}}
 .src{{font-size:.75em;color:#566074;border-top:1px solid #262b3b;margin-top:3rem;padding-top:.8rem;
      font-family:Consolas,monospace}}
</style>
</head>
<body>
{body}
<p class="src">CIVITAS · generated from {src} by tools/md2html.py — edit the .md, not this file.</p>
</body>
</html>
"""


def inline(s: str) -> str:
    s = re.sub(r'`([^`]+)`', lambda m: f'<code>{m.group(1)}</code>', s)
    s = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', r'<a href="\2">\1</a>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)', r'\1<em>\2</em>', s)
    return s


def convert(md: str) -> str:
    text = html.escape(md, quote=False)

    fences = []
    def stash(m):
        fences.append(f'<pre><code>{m.group(1).lstrip(chr(10))}</code></pre>')
        return f'\x00F{len(fences) - 1}\x00'
    text = re.sub(r'```[a-z]*\n?([\s\S]*?)```', stash, text)

    out, para, list_tag, quote, table = [], [], None, [], []

    def flush_para():
        if para:
            out.append(f'<p>{inline(" ".join(para))}</p>'); para.clear()

    def flush_list():
        nonlocal list_tag
        if list_tag:
            out.append(f'</{list_tag}>'); list_tag = None

    def flush_quote():
        if quote:
            out.append(f'<blockquote>{inline(" ".join(quote))}</blockquote>'); quote.clear()

    def flush_table():
        if table:
            head, *rows = table
            cells = lambda r: [c.strip() for c in r.strip().strip('|').split('|')]
            thead = ''.join(f'<th>{inline(c)}</th>' for c in cells(head))
            body_rows = [r for r in rows if not re.match(r'^[\s|:-]+$', r)]
            tbody = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in cells(r)) + '</tr>'
                            for r in body_rows)
            out.append(f'<table><tr>{thead}</tr>{tbody}</table>'); table.clear()

    def flush_all():
        flush_para(); flush_list(); flush_quote(); flush_table()

    for line in text.split('\n'):
        if not line.strip():
            flush_all(); continue
        m = re.match(r'^(#{1,4})\s+(.*)', line)
        if m:
            flush_all()
            out.append(f'<h{len(m.group(1))}>{inline(m.group(2))}</h{len(m.group(1))}>')
            continue
        if re.match(r'^\s*(---+|\*\*\*+)\s*$', line):
            flush_all(); out.append('<hr>'); continue
        if line.lstrip().startswith('|'):
            flush_para(); flush_list(); flush_quote(); table.append(line); continue
        m = re.match(r'^&gt;\s?(.*)', line) or re.match(r'^>\s?(.*)', line)
        if m:
            flush_para(); flush_list(); flush_table(); quote.append(m.group(1)); continue
        m = re.match(r'^\s*[-*]\s+(.*)', line)
        if m:
            flush_para(); flush_quote(); flush_table()
            nonlocal_tag = 'ul'
            if list_tag != nonlocal_tag:
                flush_list(); out.append('<ul>'); list_tag = nonlocal_tag
            out.append(f'<li>{inline(m.group(1))}</li>'); continue
        m = re.match(r'^\s*\d+\.\s+(.*)', line)
        if m:
            flush_para(); flush_quote(); flush_table()
            if list_tag != 'ol':
                flush_list(); out.append('<ol>'); list_tag = 'ol'
            out.append(f'<li>{inline(m.group(1))}</li>'); continue
        if re.match(r'^\x00F\d+\x00$', line.strip()):
            flush_all(); out.append(line.strip()); continue
        flush_list(); flush_quote(); flush_table(); para.append(line.strip())

    flush_all()
    body = '\n'.join(out)
    body = re.sub(r'\x00F(\d+)\x00', lambda m: fences[int(m.group(1))], body)
    return body


def title_of(md: str, fallback: str) -> str:
    m = re.search(r'^#\s+(.+)$', md, re.M)
    return m.group(1).strip() if m else fallback


def main() -> int:
    count = 0
    for md_path in sorted(ROOT.rglob('*.md')):
        if any(p.startswith('.') for p in md_path.parts):
            continue
        md = md_path.read_text(encoding='utf-8')
        page = TEMPLATE.format(
            title=html.escape(title_of(md, md_path.stem)),
            body=convert(md),
            src=md_path.name,
        )
        out_path = md_path.with_suffix('.html')
        out_path.write_text(page, encoding='utf-8')
        print(f'  {md_path.relative_to(ROOT)} -> {out_path.name}')
        count += 1
    print(f'{count} markdown file(s) converted.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
