"""Compare authored course copy and out-of-scope files with the pre-design audit."""
from pathlib import Path
import hashlib
import json
from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[2]
baseline = json.loads((root / 'design-v2/audit/content.json').read_text())
count = 0
for name, original in baseline.items():
    page = BeautifulSoup((root / name).read_text(), 'html.parser')
    paragraphs = [x.get_text(' ', strip=True) for x in page.select('.lesson-copy p')]
    assert paragraphs == original['paragraphs'], f'{name}: paragraphs'
    count += len(paragraphs)
    assert [x.get_text(' ', strip=True) for x in page.select('h1,h2,h3')] == original['headings'], f'{name}: headings'
    controls = [{'tag': x.name, 'id': x.get('id'), 'text': x.get_text(' ', strip=True), 'href': x.get('href')} for x in page.select('a, button, summary')]
    # Audit covers authored course actions, excluding chrome/extra links.
    # Each audited occurrence must survive with its own label, target and order.
    position = 0
    for control in original['controls']:
        position = controls.index(control, position) + 1
hashes = json.loads((root / 'design-v2/audit/baseline-sha256.json').read_text())
allowed = set(baseline) | {'DESIGN.md', '.impeccable/design.json'}
for name, digest in hashes.items():
    if name in allowed:
        continue
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, f'Out-of-scope change: {name}'
print(f'PASS {count} paragraphs; all original headings/actions; every other tracked runtime file byte-identical')
