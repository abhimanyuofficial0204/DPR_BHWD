import re

ids = ['V-04#0326-3708', 'V-04#0426-051', 'V-22#020', 'P-09/095', 'P-10/094', 'V-10/257']

def get_core_id(batch_id):
    if not batch_id: return None
    # match the last digits after a dash or slash
    m = re.search(r'[-/](\d+)$', str(batch_id))
    if m:
        return str(int(m.group(1))) # normalize '095' to '95'
    
    # Or just extract the last numeric sequence
    m2 = re.findall(r'\d+', str(batch_id))
    if m2:
        return str(int(m2[-1]))
    return batch_id

for i in ids:
    print(f"{i} -> {get_core_id(i)}")
