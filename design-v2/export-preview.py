"""Build a single offline review file; never change deployable course files.

Only in the export: embed assets, bridge iframe navigation, isolate preview progress.
The deployable introduction.js remains byte-identical to the approved course.
"""
from pathlib import Path
from bs4 import BeautifulSoup
import base64
import json
import mimetypes
import re
import sys

root = Path(__file__).resolve().parents[1]
archive_a = '--variant-a' in sys.argv
if archive_a:
    root = root / 'variant-a'
assets = {}
pages = {}
names = ['introduction.html'] + [f'lesson-{i}.html' for i in range(1, 6)] + ['introduction-quiz.html', 'components-module-one.html']
full_course = '--full-course' in sys.argv or archive_a
if archive_a:
    names.remove('components-module-one.html')
if full_course:
    names = ['index.html'] + names + ['rules.html'] + [f'rules-lesson-{i}.html' for i in range(1, 6)]

def asset(path):
    path = path.split('?')[0]
    if path not in assets:
        local = root / path
        assets[path] = {'type': mimetypes.guess_type(local)[0] or 'application/octet-stream', 'base64': base64.b64encode(local.read_bytes()).decode()}
    return '@@ASSET:' + path + '@@'

for name in names:
    soup = BeautifulSoup((root / name).read_text(), 'html.parser')
    for link in soup.select('link[rel=stylesheet]'):
        css = (root / link['href'].split('?')[0]).read_text()
        css = re.sub(r"url\(['\"]?([^'\")]+)['\"]?\)", lambda m: 'url("' + asset(m[1]) + '")', css)
        style = soup.new_tag('style')
        style.string = css
        link.replace_with(style)
    for image in soup.select('img[src]'):
        image['src'] = asset(image['src'])
    for link in soup.select('link[href]'):
        if not link['href'].startswith(('http:', 'https:', 'data:', 'blob:')):
            link['href'] = asset(link['href'])
    scripts = []
    for script in soup.select('script[src]'):
        script_file = script['src'].split('?')[0]
        if full_course and script_file in ['auth.js', 'vendor/supabase-2.119.0.js']:
            script.decompose()
            continue
        code = (root / script_file).read_text()
        if script['src'].split('?')[0] == 'introduction.js':
            code = code.replace("'sim-introduction-progress-v1'", "'sim-introduction-offline-preview-v2'")
            code = code.replace("'sim-introduction-progress-variant-a-v1'", "'sim-introduction-offline-preview-A-v2'")
            code = code.replace('window.location.href = url(number + 1)', 'window.parent.simPreviewGo(url(number + 1))')
        if script_file == 'rules.js':
            code = code.replace("'sim-rules-progress-v1'", "'sim-rules-offline-preview-v2'")
            code = code.replace("'sim-rules-progress-variant-a-v1'", "'sim-rules-offline-preview-A-v2'")
            code = code.replace("location.href=n===4?'./#practice':url(n+1)", "window.parent.simPreviewGo(n===4?'index.html#practice':url(n+1))")
        scripts.append(code)
        script.decompose()
    scripts.append("document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a)return;const h=a.getAttribute('href');if(h.startsWith('#'))return;e.preventDefault();window.parent.simPreviewGo(h)});")
    if full_course:
        scripts.append("document.getElementById('auth-open')?.addEventListener('click',()=>window.parent.simPreviewNotice('Авторизация в этом файле не подключена; проверяем оформление курса.'));")
    for code in scripts:
        script = soup.new_tag('script')
        script.string = code
        soup.body.append(script)
    pages[name] = str(soup)

template = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Знакомство — автономный просмотр дизайна</title><style>html,body{margin:0;height:100%;background:#101b2c;color:#bfccda;font:13px/1.5 Arial,sans-serif}body{display:grid;grid-template-rows:auto minmax(0,1fr)}header{padding:10px 16px;display:flex;gap:14px;align-items:center;border-bottom:1px solid #3a526b}header p{margin:0;flex:1}button{font:inherit;padding:8px 12px;border:1px solid #56d9f2;border-radius:10px;background:#14243a;color:#56d9f2;cursor:pointer}button:focus-visible{outline:3px solid #ffca65;outline-offset:3px}iframe{border:0;width:100%;height:100%;background:#101b2c}@media(max-width:600px){header{align-items:flex-start;flex-wrap:wrap}}</style><header><p id="note">Автономный просмотр первого блока. Отметки отдельные от сайта. Главная и остальные блоки не включены.</p><button id="start">К началу</button></header><iframe id="course" title="Просмотр первого блока курса"></iframe><script>
const bundle=__BUNDLE__;
const urls={};for(const[k,a]of Object.entries(bundle.assets)){const bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));urls[k]=URL.createObjectURL(new Blob([bytes],{type:a.type}))}
const pages={};for(const[k,v]of Object.entries(bundle.pages)){let html=v;for(const[path,url]of Object.entries(urls))html=html.split('@@ASSET:'+path+'@@').join(url);pages[k]=html}
const home=__HOME__;window.simPreviewNotice=t=>document.getElementById('note').textContent=t;
window.simPreviewGo=function(href){let path=href.split(/[?#]/)[0];if(home&&(!path||path==='./'))path=home;if(!pages[path]){simPreviewNotice('Эта ссылка ведёт за пределы включённых в просмотр страниц. Для сравнения откройте второй HTML-файл.');return}const frame=document.getElementById('course'),fragment=href.split('#')[1];frame.onload=()=>{if(fragment)frame.contentDocument.getElementById(fragment)?.scrollIntoView()};frame.srcdoc=pages[path];document.title='Просмотр курса — '+path;};document.getElementById('start').onclick=()=>simPreviewGo(home||'introduction.html');simPreviewGo(home||'introduction.html');
</script></html>'''
data = json.dumps({'assets': assets, 'pages': pages}, ensure_ascii=False).replace('</', '<\\/')
if full_course:
    label = 'Сохранённый вариант А для сравнения.' if archive_a else 'Черновик варианта В: новая графика и прежняя структура.'
    template = template.replace('Автономный просмотр первого блока. Отметки отдельные от сайта. Главная и остальные блоки не включены.', label + ' Главная и две готовые части курса; отметки отдельные; авторизация не подключена.')
filename = 'SIM_variant_A_review.html' if archive_a else 'SIM_variant_B_review.html' if full_course else 'SIM_Знакомство_дизайн_2.html'
output = Path('/workspace/shared') / filename
output.write_text(template.replace('__BUNDLE__', data).replace('__HOME__', json.dumps('index.html' if full_course else None)))
print(f'{output}: {output.stat().st_size} bytes, {len(pages)} pages, {len(assets)} local embedded assets')
