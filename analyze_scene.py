import json
import collections

with open(r'C:\Users\user\.claude\projects\C--Nestor-Pagonis\b02dbd27-4b6c-448a-80ca-96b4185b6c68\tool-results\mcp-firestore-storage_read_file-1780829119813.txt', encoding='utf-8') as f:
    wrapper = json.load(f)

content_str = wrapper.get('content', '{}')
if isinstance(content_str, str):
    scene = json.loads(content_str)
else:
    scene = content_str

print('ALL TOP-LEVEL KEYS IN SCENE:')
for k, v in scene.items():
    if isinstance(v, list):
        print(f'  {k}: list[{len(v)}]')
        if len(v) > 0 and isinstance(v[0], dict):
            sample = v[0]
            print(f'    sample keys: {list(sample.keys())[:10]}')
            # Show all distinct entityType/type values
            types = collections.Counter()
            for item in v:
                if isinstance(item, dict):
                    t = item.get('entityType') or item.get('type') or item.get('kind') or '?'
                    types[t] += 1
            print(f'    types: {dict(types.most_common(20))}')
    elif isinstance(v, dict):
        print(f'  {k}: dict[{len(v)} keys] -> {list(v.keys())[:10]}')
    else:
        print(f'  {k}: {type(v).__name__} = {repr(v)[:60]}')
