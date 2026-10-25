"""Check Git-tracked source (or a clean source tree before git init) for leaks."""
from pathlib import Path
import os
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
SKIP={'node_modules','.git','.venv','.venv312','__pycache__','.pytest_cache','dist','data','backups'}
try:
    result=subprocess.run(['git','ls-files','-z'],cwd=ROOT,capture_output=True,check=True)
    files=[ROOT/name for name in result.stdout.decode().split('\0') if name]
except (FileNotFoundError,subprocess.CalledProcessError):
    files=[]
    for base,dirs,names in os.walk(ROOT):
        dirs[:]=[d for d in dirs if d not in SKIP and not d.startswith('.venv')]
        files.extend(Path(base)/name for name in names if not name.endswith(('.tsbuildinfo','.log')) and name!='.DS_Store')
issues=[]
for file in files:
    if not file.is_file():continue
    rel=file.relative_to(ROOT)
    name=file.name
    if (set(rel.parts)&{'data','backups','node_modules','dist','__pycache__'} or
        name.endswith(('.db','.sqlite','.sqlite3','.pem','.key','.pyc','.tsbuildinfo')) or
        '.db-' in name or (name.startswith('.env') and not name.endswith('.example'))):
        issues.append(f'{rel}: çalışma verisi, sır veya üretilmiş dosya repoya girmemeli')
    if file.suffix in {'.xlsx','.png','.jpg','.jpeg','.webp'}:continue
    if file.stat().st_size>2_000_000:continue
    content=file.read_text(errors='replace')
    signatures=[r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'\bghp_[A-Za-z0-9]{30,}\b',r'\bAKIA[A-Z0-9]{16}\b']
    if any(re.search(pattern,content) for pattern in signatures):
        issues.append(f'{rel}: olası gizli anahtar (içerik gösterilmedi)')
if issues:
    print('\n'.join(issues));sys.exit(1)
print(f'Kaynak kontrolü başarılı: {len(files)} dosya incelendi. Gizli değerlerin manuel kontrolü de gereklidir.')
