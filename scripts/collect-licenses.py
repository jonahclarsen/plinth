"""Collect installed dependency notices without embedding local machine paths."""
import json, pathlib, subprocess, hashlib
root = pathlib.Path(__file__).resolve().parent.parent
cargo = json.loads(subprocess.check_output(['cargo','metadata','--manifest-path',str(root/'src-tauri/Cargo.toml'),'--format-version','1','--offline']))
js = json.loads(subprocess.check_output(['pnpm','licenses','list','--json'],cwd=root))
entries = []
for p in cargo['packages']:
    if p['name'] == 'plinth': continue
    entries.append((p['name'],p['version'],p.get('license') or 'See upstream',pathlib.Path(p['manifest_path']).parent))
for packages in js.values():
    for p in packages:
        for path in p['paths']: entries.append((p['name'],', '.join(p['versions']),p.get('license','See upstream'),pathlib.Path(path)))
out=['# Dependency license notices','', 'Generated from the pinned installed dependencies, including development/build tools. Identical license texts are included once. Local file paths are intentionally omitted.','', '| Package | Version | License | Notices |', '| --- | --- | --- | --- |']
seen=set()
notices={}
for name,version,license_name,folder in sorted(entries):
    if (name,version) in seen: continue
    seen.add((name,version))
    refs=[]
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.name.lower().startswith(('license','licence','copying','copyright','notice')) and path.stat().st_size < 150000:
            try: text=path.read_text().strip()
            except UnicodeDecodeError: continue
            key=hashlib.sha256(text.encode()).hexdigest()[:12]
            notices[key]=text
            refs.append(f'[{path.name}](#notice-{key})')
    safe_license=license_name.replace('|',' / ')
    out.append(f'| {name} | {version} | {safe_license} | {", ".join(refs) or "See upstream distribution"} |')
for key,text in notices.items():
    out += ['',f'## Notice {key}','',text,'']
(root/'DEPENDENCY_LICENSES.md').write_text('\n'.join(out))
print(f'Collected {len(notices)} unique notices for {len(seen)} dependency versions.')
