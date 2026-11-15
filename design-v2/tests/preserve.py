"""Compare authored course copy and out-of-scope files with the pre-design audit."""
from pathlib import Path
import hashlib
import json
import subprocess
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
allowed = set(baseline) | {'DESIGN.md', '.impeccable/design.json', 'index.html', 'variant-b.html', 'variant-a.html', 'rules.html', 'tests/rules.spec.cjs'} | {f'rules-lesson-{i}.html' for i in range(1, 6)}
for name, digest in hashes.items():
    if name in allowed:
        continue
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, f'Out-of-scope change: {name}'
for name in [f'rules-lesson-{i}.html' for i in range(1, 6)]:
    original = BeautifulSoup(subprocess.check_output(['git', 'show', '21b517e:' + name], cwd=root), 'html.parser')
    for prefix in ['', 'variant-a/']:
        page = BeautifulSoup((root / prefix / name).read_text(), 'html.parser')
        for selector in ['.lesson-copy p', 'h1,h2,h3']:
            assert [x.get_text(' ', strip=True) for x in page.select(selector)] == [x.get_text(' ', strip=True) for x in original.select(selector)], prefix + name
archive = json.loads((root / 'variant-a/SNAPSHOT.json').read_text())
for name, saved in archive['files'].items():
    assert hashlib.sha256((root / 'variant-a' / name).read_bytes()).hexdigest() == saved['archive_sha256'], name
old_home = BeautifulSoup(subprocess.check_output(['git', 'show', '21b517e:variant-a.html'], cwd=root), 'html.parser')
new_home = BeautifulSoup((root / 'index.html').read_text(), 'html.parser')
assert len(new_home.select('.module-card .card-object')) == 3
assert not new_home.select('.module-card .module-photo'), 'Do not reuse old photo-card design in B'
for old, new in zip(old_home.select('.module'), new_home.select('.module-card')):
    assert old.select_one(':scope > p').get_text(' ', strip=True) == new.select_one('.module-text > p').get_text(' ', strip=True)
    assert old.select_one('.module-task').get_text(' ', strip=True) == new.select_one('.module-task').get_text(' ', strip=True)
print(f'PASS {count} introduction paragraphs/actions; five rule lessons; original learning/auth scripts; new3D modules with original copy; immutable A snapshot')
