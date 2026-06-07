#!/usr/bin/env python3
import json
import math
from collections import defaultdict

filepath = r'C:\Users\user\.claude\projects\C--Nestor-Pagonis\b02dbd27-4b6c-448a-80ca-96b4185b6c68\tool-results\mcp-firestore-storage_read_file-1780829119813.txt'

with open(filepath, encoding='utf-8') as f:
    wrapper = json.load(f)

content_str = wrapper.get('content', '{}')
if isinstance(content_str, str):
    scene = json.loads(content_str)
else:
    scene = content_str

entities = scene.get('entities', [])
lines = [e for e in entities if e.get('type') == 'line']

def dist(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def norm_point(p, precision=4):
    return (round(p[0], precision), round(p[1], precision))

# Build endpoint map
endpoint_to_lines = defaultdict(list)

for idx, line in enumerate(lines):
    s = line.get('startPoint') or line.get('start') or {}
    e = line.get('endPoint') or line.get('end') or {}
    sx, sy = s.get('x', s.get(0, 0)), s.get('y', s.get(1, 0))
    ex, ey = e.get('x', e.get(0, 0)), e.get('y', e.get(1, 0))

    start_norm = norm_point((sx, sy))
    end_norm = norm_point((ex, ey))

    endpoint_to_lines[start_norm].append((idx, 'start'))
    endpoint_to_lines[end_norm].append((idx, 'end'))

print(f"Total lines: {len(lines)}")
print(f"Total unique endpoints: {len(endpoint_to_lines)}")

# Find junctions where 2 or more lines meet
junctions = {pt: lines_list for pt, lines_list in endpoint_to_lines.items() if len(lines_list) >= 2}
print(f"Junctions (2+ lines): {len(junctions)}")
print()

# Print sample junction
if junctions:
    sample_junc = list(junctions.items())[0]
    print(f"Sample junction at {sample_junc[0]}: {len(sample_junc[1])} lines")
    for line_idx, side in sample_junc[1]:
        l = lines[line_idx]
        s = l.get('startPoint') or l.get('start') or {}
        e = l.get('endPoint') or l.get('end') or {}
        length = dist((s.get('x', s.get(0)), s.get('y', s.get(1))),
                      (e.get('x', e.get(0)), e.get('y', e.get(1))))
        print(f"  Line {line_idx} ({side}): len={length:.4f}")
    print()

# Group lines by their endpoints - find potential rectangles
# For each pair of lines that share an endpoint, check if they can form a rectangle

rectangles = []
EPSILON = 0.0001

for junction_pt, lines_at_junction in junctions.items():
    if len(lines_at_junction) >= 2:
        for i in range(len(lines_at_junction)):
            for j in range(i+1, len(lines_at_junction)):
                line_idx1, side1 = lines_at_junction[i]
                line_idx2, side2 = lines_at_junction[j]

                l1 = lines[line_idx1]
                l2 = lines[line_idx2]

                s1 = l1.get('startPoint') or l1.get('start') or {}
                e1 = l1.get('endPoint') or l1.get('end') or {}
                s2 = l2.get('startPoint') or l2.get('start') or {}
                e2 = l2.get('endPoint') or l2.get('end') or {}

                # Get the four endpoints
                pts1 = [(s1.get('x', s1.get(0)), s1.get('y', s1.get(1))),
                        (e1.get('x', e1.get(0)), e1.get('y', e1.get(1)))]
                pts2 = [(s2.get('x', s2.get(0)), s2.get('y', s2.get(1))),
                        (e2.get('x', e2.get(0)), e2.get('y', e2.get(1)))]

                len1 = dist(pts1[0], pts1[1])
                len2 = dist(pts2[0], pts2[1])

                if len1 > 0.01 and len2 > 0.01:  # Skip tiny lines
                    rectangles.append({
                        'line1': line_idx1,
                        'line2': line_idx2,
                        'len1': len1,
                        'len2': len2,
                        'junction': junction_pt
                    })

# Sort by product of lengths
rectangles.sort(key=lambda r: r['len1'] * r['len2'], reverse=True)

print(f"Found {len(rectangles)} pairs of lines at junctions")
print()
print("TOP 15 PAIRS (by area):")
print("-" * 60)
for i, rect in enumerate(rectangles[:15]):
    area = rect['len1'] * rect['len2']
    print(f"{i+1}. Lines {rect['line1']} + {rect['line2']}: {rect['len1']:.4f} x {rect['len2']:.4f} = {area:.6f}")
